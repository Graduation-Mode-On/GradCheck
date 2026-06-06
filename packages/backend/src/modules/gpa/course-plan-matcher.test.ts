import { describe, expect, it } from "vitest";

import { isTranscriptArtifactName, matchGpaCourseToPlanRequirement, normalizeCourseName } from "./course-plan-matcher.js";
import type { GpaCourse } from "./gpa.types.js";

const now = new Date("2026-06-06T00:00:00.000Z");

function gpaCourse(overrides: Partial<GpaCourse>): GpaCourse {
  return {
    id: "gpa-1",
    userId: "user-1",
    term: "2025-2026 秋",
    name: "大学物理BⅠ",
    credit: "3.00",
    score: "95.00",
    isRequired: false,
    isFirstAttempt: true,
    isGpaEligible: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("course plan matching", () => {
  it("normalizes common transcript and curriculum name differences", () => {
    expect(normalizeCourseName("大学物理BⅠ")).toBe(normalizeCourseName("大学物理BI"));
    expect(normalizeCourseName("管理学热点与探析（研讨）")).toBe(normalizeCourseName("管理学热点与探析(研讨)"));
  });

  it("matches by normalized name and equal credits", () => {
    const match = matchGpaCourseToPlanRequirement(gpaCourse({}), {
      courses: [
        {
          id: "plan-1",
          code: "PHY",
          name: "大学物理BI",
          credits: "3.00",
          requirementType: "required"
        }
      ],
      groups: []
    });

    expect(match).toEqual({
      matchTargetType: "course",
      programPlanCourseId: "plan-1",
      programPlanCourseGroupId: null,
      matchMethod: "normalized_name_credit",
      confidence: "0.92",
      confirmedByUser: false,
      requirementType: "required"
    });
  });

  it("auto-confirms known course aliases", () => {
    const match = matchGpaCourseToPlanRequirement(gpaCourse({ name: "程序设计及算法语言Ⅱ", credit: "2.00" }), {
      courses: [
        {
          id: "plan-2",
          code: "BJSL0030",
          name: "程序设计基础及语言II(双语)",
          credits: "2.00",
          requirementType: "required"
        }
      ],
      groups: []
    });

    expect(match).toEqual(expect.objectContaining({
      matchTargetType: "course",
      programPlanCourseId: "plan-2",
      matchMethod: "alias",
      confidence: "0.98",
      confirmedByUser: true,
      requirementType: "required"
    }));
  });

  it("accepts high-confidence required course matches without exact punctuation", () => {
    const match = matchGpaCourseToPlanRequirement(gpaCourse({ name: "大学物理BⅠ", credit: "3.00" }), {
      courses: [
        {
          id: "plan-3",
          code: "B10M0240",
          name: "大学物理B(I)",
          credits: "3.00",
          requirementType: "required"
        }
      ],
      groups: []
    });

    expect(match).toEqual(expect.objectContaining({
      matchTargetType: "course",
      programPlanCourseId: "plan-3",
      matchMethod: "high_confidence_name_credit",
      confidence: "0.88",
      requirementType: "required"
    }));
  });

  it("falls back to a general education group for marked transcript courses", () => {
    const match = matchGpaCourseToPlanRequirement(gpaCourse({
      name: "电影艺术理论与实践",
      credit: "2.00",
      isGpaEligible: false
    }), {
      courses: [],
      groups: [
        {
          id: "group-1",
          name: "通识教育类课程",
          requirementType: "min_credits"
        }
      ]
    });

    expect(match).toEqual({
      matchTargetType: "group",
      programPlanCourseId: null,
      programPlanCourseGroupId: "group-1",
      matchMethod: "general_education_group",
      confidence: "0.80",
      confirmedByUser: false,
      requirementType: "min_credits"
    });
  });

  it("keeps unrelated low-confidence courses unmatched", () => {
    const match = matchGpaCourseToPlanRequirement(gpaCourse({ name: "国家安全教育", credit: "1.00" }), {
      courses: [
        {
          id: "plan-4",
          code: "B07M2040",
          name: "线性代数",
          credits: "4.00",
          requirementType: "required"
        }
      ],
      groups: []
    });

    expect(match).toBeNull();
  });

  it("rejects numeric grade-scale artifacts as transcript course names", () => {
    expect(isTranscriptArtifactName("3.53.02.82.5")).toBe(true);
    expect(isTranscriptArtifactName("工科数学分析I")).toBe(false);
  });
});
