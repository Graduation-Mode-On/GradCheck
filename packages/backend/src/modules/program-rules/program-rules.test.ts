import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DraftCorrectionService } from "./correction.js";
import { type CourseRequirement } from "./models.js";
import { type PdfTextExtractor, ProgramPdfParser } from "./pdfExtractor.js";
import { ProgramParsePipeline } from "./pipeline.js";
import { PageQualityEvaluator } from "./quality.js";
import { ProgramRuleRepository } from "./repository.js";
import { ProgramRuleExtractor } from "./ruleExtractor.js";

describe("program rule parser", () => {
  it("flags sparse text layers", () => {
    const quality = new PageQualityEvaluator().evaluate("", []);

    expect(quality.passed).toBe(false);
    expect(quality.issues).toContain("text_layer_too_short");
    expect(quality.issues).toContain("low_quality_score");
  });

  it("extracts courses, rules, assignments, and total credits", async () => {
    const draft = await new ProgramRuleExtractor().extract(
      [
        {
          pageNumber: 1,
          method: "pdfjs",
          text: "毕业最低要求 160 学分\n专业选修模块至少 12 学分 4 门",
          tables: [
            {
              source: "text-derived",
              rows: [
                ["课程代码", "课程名称", "课程性质", "学分", "建议学期"],
                ["SE101", "程序设计基础", "必修", "4", "一", "1"],
                ["SE205", "软件工程实践", "选修", "2.5", "5"]
              ]
            }
          ],
          warnings: []
        }
      ],
      { major: "软件工程" }
    );

    expect(draft.graduationRule.totalCreditsRequired).toBe(160);
    expect(new Set(draft.courses.map((course) => course.name))).toEqual(new Set(["程序设计基础", "软件工程实践"]));
    expect(draft.courses.find((course) => course.code === "SE101")?.requirementType).toBe("required");
    expect(draft.courses.find((course) => course.code === "SE101")?.teachingAcademicYear).toBe("一");
    expect(draft.courses.find((course) => course.code === "SE101")?.teachingSemester).toBe("1");
    expect(draft.requirementCategories.some((category) => category.name === "专业选修模块" && category.minCredits === 12)).toBe(true);
    expect(draft.courseAssignments.some((assignment) => assignment.courseCode === "SE101")).toBe(true);
    expect(draft.graduationRequirements.some((requirement) => requirement.name === "毕业总学分要求" && requirement.minCredits === 160)).toBe(true);
    expect(draft.graduationRequirements.some((requirement) => requirement.targetCategoryId && requirement.minCredits === 12)).toBe(true);
  });

  it("falls back to OCR for low-quality pages", async () => {
    const fakeExtractor: PdfTextExtractor = {
      async extract() {
        return [{ pageNumber: 1, text: "", tables: [], warnings: [] }];
      }
    };
    const pipeline = new ProgramParsePipeline({
      parser: new ProgramPdfParser({
        textExtractor: fakeExtractor,
        ocr: {
          async recognizePage() {
            return {
              text: "课程代码  课程名称  课程性质  学分\nSE101  程序设计基础  必修  4",
              warnings: []
            };
          }
        }
      })
    });

    const draft = await pipeline.parse({ pdfPath: "program.pdf", metadata: { major: "软件工程" } });

    expect(draft.qualitySummary.ocrPages).toEqual([1]);
    expect(draft.pages[0]?.method).toBe("paddleocr");
  });

  it("saves requirements and course catalog separately", async () => {
    const storageDir = await mkdtemp(join(tmpdir(), "gradcheck-program-rules-"));
    const repository = new ProgramRuleRepository(storageDir);
    const course: CourseRequirement = {
      id: "course_1",
      code: "SE101",
      name: "程序设计基础",
      requirementType: "unknown",
      credits: 3
    };
    const draft = await new ProgramRuleExtractor().extract([], { major: "软件工程" });
    draft.courses = [course];

    const corrected = new DraftCorrectionService().apply(draft, {
      upsertCourses: [{ ...course, requirementType: "required", credits: 4 }],
      graduationRule: { totalCreditsRequired: 160, notes: [] },
      status: "pending_review",
      reviewerNote: "人工修正课程学分"
    });
    const savedPath = await repository.save(corrected);
    const loaded = await repository.get(corrected.id);
    const requirementSet = await repository.getRequirementSet(corrected.id);
    const courseCatalog = await repository.getCourseCatalog(corrected.id);

    expect(savedPath).toContain("draft_");
    expect(loaded.courses[0]?.credits).toBe(4);
    expect(loaded.status).toBe("pending_review");
    expect(loaded.graduationRule.notes[0]).toBe("人工修正课程学分");
    expect(requirementSet.draftId).toBe(corrected.id);
    expect((requirementSet as unknown as { courses?: unknown }).courses).toBeUndefined();
    expect(courseCatalog.draftId).toBe(corrected.id);
    expect(courseCatalog.courses[0]?.courseName).toBe("程序设计基础");
    expect(courseCatalog.courses[0]?.courseCode).toBe("SE101");
    expect(courseCatalog.courses[0]?.credits).toBe(4);
    expect((courseCatalog.courses[0] as unknown as { requirementType?: unknown }).requirementType).toBeUndefined();
    expect((courseCatalog as unknown as { graduationRequirements?: unknown }).graduationRequirements).toBeUndefined();
    expect(await readFile(savedPath, "utf8")).toContain("程序设计基础");
  });

  it("merges valid AI rules while discarding invalid AI courses", async () => {
    const draft = await new ProgramRuleExtractor({
      async extract() {
        return {
          courses: [
            {
              code: "NOPE",
              name: "模型幻想课程",
              credits: 100,
              requirementType: "required",
              sourcePage: 99
            }
          ],
          requirementCategories: [
            {
              name: "专业选修 A 组",
              type: "elective_group",
              requirementType: "elective",
              minCourses: 2,
              completionRule: "courses_at_least",
              sourcePage: 1,
              rawText: "A 组至少选修 2 门"
            }
          ],
          categoryRules: [
            {
              categoryName: "专业选修 A 组",
              name: "A组选修门数要求",
              completionRule: "courses_at_least",
              minCourses: 2,
              description: "A 组至少选修 2 门。",
              sourcePage: 1,
              rawText: "A 组至少选修 2 门"
            }
          ],
          courseAssignments: [
            {
              courseCode: "SE101",
              categoryName: "专业选修 A 组",
              confidence: 0.9,
              sourcePage: 1,
              rawText: "SE101 程序设计基础 必修 4"
            }
          ],
          nonCourseRequirements: [
            {
              name: "全英文课程要求",
              completionRule: "credits_or_courses_at_least",
              minCourses: 2,
              minCredits: 4,
              unit: "门/学分",
              description: "必须至少选择全英文课程 2 门，或不少于 4 学分。",
              sourcePage: 1,
              rawText: "必须至少选择全英文课程 2 门 (或≥ 4 学分)"
            }
          ],
          graduationRule: {
            totalCreditsRequired: 160,
            notes: ["必须至少选择全英文课程 2 门，或不少于 4 学分。"]
          }
        };
      }
    }).extract(
      [
        {
          pageNumber: 1,
          method: "pdfjs",
          text: "课程代码 课程名称 课程性质 学分\nSE101 程序设计基础 必修 4\n必须至少选择全英文课程 2 门 (或≥ 4 学分)",
          tables: [
            {
              source: "text-derived",
              rows: [
                ["课程代码", "课程名称", "课程性质", "学分"],
                ["SE101", "程序设计基础", "必修", "4"]
              ]
            }
          ],
          warnings: []
        }
      ],
      { major: "软件工程" }
    );

    expect(draft.courses).toHaveLength(1);
    expect(draft.courses[0]?.name).toBe("程序设计基础");
    expect(draft.extractionWarnings.some((warning) => warning.startsWith("ai_course_discarded"))).toBe(true);
    expect(draft.categoryRules.some((rule) => rule.minCourses === 2 && rule.completionRule === "courses_at_least")).toBe(true);
    expect(draft.courseAssignments.some((assignment) => assignment.courseCode === "SE101")).toBe(true);
    expect(draft.nonCourseRequirements.some((requirement) => requirement.name === "全英文课程要求")).toBe(true);
    expect(draft.graduationRequirements.some((requirement) => requirement.scope === "non_course" && requirement.name === "全英文课程要求")).toBe(true);
    expect(draft.graduationRule.totalCreditsRequired).toBe(160);
  });
});
