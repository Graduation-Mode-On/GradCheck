import { describe, expect, it } from "vitest";

import { isTranscriptArtifactName, matchGpaCourseToPlanCourse, normalizeCourseName } from "./course-plan-matcher.js";
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
    const match = matchGpaCourseToPlanCourse(gpaCourse({}), [
      {
        id: "plan-1",
        code: "PHY",
        name: "大学物理BI",
        credits: "3.00",
        requirementType: "required"
      }
    ]);

    expect(match).toEqual({
      programPlanCourseId: "plan-1",
      matchMethod: "normalized_name_credit",
      confidence: "0.92"
    });
  });

  it("rejects numeric grade-scale artifacts as transcript course names", () => {
    expect(isTranscriptArtifactName("3.53.02.82.5")).toBe(true);
    expect(isTranscriptArtifactName("工科数学分析I")).toBe(false);
  });
});
