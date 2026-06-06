import { describe, expect, it } from "vitest";

import { normalizeProgramPlanCourses } from "./program-plan-normalizer.js";
import type { CurriculumPlan } from "./program-plans.schemas.js";

describe("normalizeProgramPlanCourses", () => {
  it("normalizes required and elective courses from plan JSON", () => {
    const plan: CurriculumPlan = {
      program: { school: "东南大学", college: "软件学院", major: "软件工程", grade: "2022级", total_credits: 166 },
      courses: [
        { code: "MATH1", name: "工科数学分析I", credits: 6, category: "通识教育基础课", subcategory: "数学类", term: { year: "一", semester: "1" } },
        { code: "ELEC1", name: "专业选修A", credits: 2, category: "专业选修课", subcategory: "方向选修", term: { year: "三", semester: "1" } }
      ],
      requirements: [
        { id: "required_core", type: "required", title: "必修课程" },
        { id: "major_electives", type: "min_credits", title: "专业选修课", min_credits: 6, course_codes: ["ELEC1"] }
      ],
      semester_plan: [],
      warnings: [],
      provenance: {}
    };

    const normalized = normalizeProgramPlanCourses(plan);

    expect(normalized.groups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceRequirementId: "required_core",
        name: "必修课程",
        requirementType: "required",
        minCourses: null,
        minCredits: null
      }),
      expect.objectContaining({
        sourceRequirementId: "major_electives",
        name: "专业选修课",
        requirementType: "min_credits",
        minCourses: null,
        minCredits: "6"
      })
    ]));
    expect(normalized.courses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "MATH1",
        name: "工科数学分析I",
        credits: "6",
        requirementType: "required",
        suggestedTerm: "一-1"
      }),
      expect.objectContaining({
        code: "ELEC1",
        name: "专业选修A",
        credits: "2",
        requirementType: "min_credits",
        sourceRequirementId: "major_electives"
      })
    ]));
  });
});
