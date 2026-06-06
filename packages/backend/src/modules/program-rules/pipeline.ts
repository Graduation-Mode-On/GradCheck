import { basename, dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createId, createEmptyDraft, type PageParseResult, type ParseMethod, type ProgramMetadata, type ProgramRuleDraft } from "./models.js";
import type { AiRuleExtractor } from "./ruleExtractor.js";
import {
  requirementType,
  stableGroupId,
  inferCategoryType,
  inferCategoryRequirementType,
  stableCategoryId,
  stableRuleId,
  stableNonCourseRequirementId,
  buildRuleDescription,
  rebuildGraduationRequirements
} from "./ruleExtractor.js";
import type { PageOcr } from "./ocr.js";
import { ProgramPdfParser } from "./pdfExtractor.js";
import { ProgramRuleExtractor } from "./ruleExtractor.js";
import { ProgramRuleRepository } from "./repository.js";

export interface ProgramParsePipelineOptions {
  parser?: ProgramPdfParser;
  extractor?: ProgramRuleExtractor;
  repository?: ProgramRuleRepository;
  usePdfPlumber?: boolean;
}

interface PdfPlumberCourse {
  courseCode: string;
  courseName: string;
  credits: number;
  teachingAcademicYear?: string;
  teachingSemester?: string;
  nature?: string;
  group?: string;
  note?: string;
  category?: string;
  sourcePage?: number;
}

interface PdfPlumberCategoryRule {
  name: string;
  minCredits?: number;
  minCourses?: number;
  rule: string;
}

interface PdfPlumberGroupDef {
  name: string;
  courseCount: number;
  courses: string[];
}

interface PdfPlumberNonCourseReq {
  name: string;
  minScore?: number;
  unit?: string;
}

interface PdfPlumberRequirements {
  totalCreditsRequired?: number;
  categoryRules: PdfPlumberCategoryRule[];
  groupDefinitions: PdfPlumberGroupDef[];
  nonCourseRequirements: PdfPlumberNonCourseReq[];
}

interface PdfPlumberOutput {
  courses: PdfPlumberCourse[];
  requirements: PdfPlumberRequirements;
}

export class ProgramParsePipeline {
  private readonly parser: ProgramPdfParser;
  private readonly extractor: ProgramRuleExtractor;
  private repository?: ProgramRuleRepository;
  private readonly usePdfPlumber: boolean;

  constructor(options: ProgramParsePipelineOptions = {}) {
    this.parser = options.parser ?? new ProgramPdfParser();
    this.extractor = options.extractor ?? new ProgramRuleExtractor();
    this.repository = options.repository;
    this.usePdfPlumber = options.usePdfPlumber ?? false;
  }

  static withOcr(options: { ocr: PageOcr; aiExtractor?: AiRuleExtractor; repository?: ProgramRuleRepository }): ProgramParsePipeline {
    return new ProgramParsePipeline({
      parser: new ProgramPdfParser({ ocr: options.ocr }),
      extractor: new ProgramRuleExtractor(options.aiExtractor),
      repository: options.repository
    });
  }

  async parse(input: { pdfPath: string; metadata?: ProgramMetadata; save?: boolean }): Promise<ProgramRuleDraft> {
    const metadata = {
      ...input.metadata,
      sourceFilename: input.metadata?.sourceFilename ?? basename(input.pdfPath)
    };

    let draft: ProgramRuleDraft;

    if (this.usePdfPlumber) {
      draft = await this.parseWithPdfPlumber(input.pdfPath, metadata);
    } else {
      const pages = await this.parser.parse(input.pdfPath);
      draft = await this.extractor.extract(pages, metadata);
      draft.qualitySummary = qualitySummary(draft.pages, draft.courses.length, draft.groups.length);
      draft.parseMethod = parseMethod(draft.pages);
    }

    if (input.save) {
      this.repository ??= new ProgramRuleRepository();
      await this.repository.save(draft);
    }

    return draft;
  }

  private async parseWithPdfPlumber(pdfPath: string, metadata: ProgramMetadata): Promise<ProgramRuleDraft> {
    // 1. 调用 Python 脚本获取结构化数据
    const pyResult = await this.callPdfPlumber(pdfPath);

    // 2. 同时用 pdfjs 获取页面信息（用于质量评估和调试）
    const pages = await this.parser.parse(pdfPath);

    // 3. 构造 draft
    const draft = createEmptyDraft(metadata);
    draft.pages = pages;
    draft.parseMethod = "pdfplumber" as ParseMethod;

    // 4. 填充课程
    for (const c of pyResult.courses) {
      if (!c.courseCode || !c.courseName) continue;
      draft.courses.push({
        id: createId("course"),
        code: c.courseCode,
        name: c.courseName,
        requirementType: requirementType(c.nature || "") || inferCategoryRequirementType(c.category || c.group || ""),
        credits: c.credits,
        teachingAcademicYear: c.teachingAcademicYear,
        teachingSemester: c.teachingSemester,
        suggestedSemester: c.teachingAcademicYear && c.teachingSemester
          ? `${c.teachingAcademicYear}-${c.teachingSemester}`
          : undefined,
        groupId: c.group ? stableGroupId(c.group) : undefined,
        groupName: c.group || undefined,
        sourcePage: c.sourcePage,
        rawText: undefined
      });
    }

    // 5. 填充组
    for (const g of pyResult.requirements.groupDefinitions) {
      draft.groups.push({
        id: stableGroupId(g.name),
        name: g.name,
        requirementType: "elective",
        minCourses: g.courseCount,
        sourcePage: undefined
      });
    }

    // 6. 填充毕业规则
    if (pyResult.requirements.totalCreditsRequired) {
      draft.graduationRule.totalCreditsRequired = pyResult.requirements.totalCreditsRequired;
    }

    // 7. 填充要求分类和规则
    for (const rule of pyResult.requirements.categoryRules) {
      const catId = stableCategoryId(rule.name);
      draft.requirementCategories.push({
        id: catId,
        name: rule.name,
        type: inferCategoryType(rule.name),
        requirementType: requirementType(rule.name),
        minCredits: rule.minCredits,
        minCourses: rule.minCourses,
        completionRule: rule.rule as any,
        sourcePage: undefined
      });

      draft.categoryRules.push({
        id: stableRuleId(catId, `${rule.name}规则`),
        categoryId: catId,
        name: rule.name.endsWith("要求") ? rule.name : `${rule.name}要求`,
        completionRule: rule.rule as any,
        minCredits: rule.minCredits,
        minCourses: rule.minCourses,
        description: buildRuleDescription(rule),
        sourcePage: undefined
      });
    }

    // 8. 填充非课程要求
    for (const req of pyResult.requirements.nonCourseRequirements) {
      draft.nonCourseRequirements.push({
        id: stableNonCourseRequirementId(req.name),
        name: req.name,
        completionRule: "custom",
        minScore: req.minScore,
        unit: req.unit,
        description: `${req.name}${req.minScore ? `不低于 ${req.minScore}` : ""}`,
        sourcePage: undefined
      });
    }

    // 9. 重建毕业要求
    rebuildGraduationRequirements(draft);

    // 10. 质量摘要
    draft.qualitySummary = qualitySummary(pages, draft.courses.length, draft.groups.length);

    return draft;
  }

  private callPdfPlumber(pdfPath: string): Promise<PdfPlumberOutput> {
    return new Promise((resolve, reject) => {
      // 从当前模块位置向上找到 backend 根目录（packages/backend/src/modules/program-rules -> packages/backend）
      const moduleDir = dirname(fileURLToPath(import.meta.url));
      const backendRoot = join(moduleDir, "..", "..", "..");
      const scriptPath = join(backendRoot, "scripts", "pdfplumber_extract.py");
      const child = spawn("python3", [scriptPath, pdfPath], {
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`pdfplumber failed (exit ${code}): ${stderr || stdout}`));
          return;
        }
        try {
          const result = JSON.parse(stdout) as PdfPlumberOutput;
          resolve(result);
        } catch {
          reject(new Error(`pdfplumber output is not valid JSON: ${stdout.slice(0, 200)}`));
        }
      });

      child.on("error", (err) => {
        reject(new Error(`Failed to spawn pdfplumber: ${err.message}`));
      });
    });
  }
}

function qualitySummary(pages: PageParseResult[], coursesExtracted: number, groupsExtracted: number): Record<string, unknown> {
  const scored = pages.map((page) => page.quality?.score).filter((score): score is number => score !== undefined);
  return {
    totalPages: pages.length,
    ocrPages: pages.filter((page) => page.method === "paddleocr").map((page) => page.pageNumber),
    failedTextLayerPages: pages.filter((page) => page.quality && !page.quality.passed).map((page) => page.pageNumber),
    averageTextLayerQuality: scored.length ? Number((scored.reduce((sum, score) => sum + score, 0) / scored.length).toFixed(3)) : 0,
    coursesExtracted,
    groupsExtracted
  };
}

function parseMethod(pages: PageParseResult[]): ParseMethod {
  const methods = new Set(pages.map((page) => page.method));
  return methods.size === 1 ? [...methods][0] ?? "mixed" : "mixed";
}
