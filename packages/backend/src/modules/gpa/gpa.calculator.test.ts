import { describe, expect, it } from "vitest";

import { calculateGpaResult, convertScoreToSeuGradePoint } from "./gpa.calculator.js";
import type { GpaCourse } from "./gpa.types.js";

function course(overrides: Partial<GpaCourse>): GpaCourse {
  return {
    id: "course-1",
    userId: "user-1",
    term: "2025-2026 春",
    name: "高等数学",
    credit: "4.00",
    score: "96.00",
    isRequired: true,
    isFirstAttempt: true,
    isGpaEligible: true,
    createdAt: new Date("2026-06-06T00:00:00.000Z"),
    updatedAt: new Date("2026-06-06T00:00:00.000Z"),
    ...overrides
  };
}

describe("convertScoreToSeuGradePoint", () => {
  it.each([
    [100, 4.8],
    [96, 4.8],
    [95, 4.5],
    [93, 4.5],
    [92, 4.0],
    [90, 4.0],
    [89, 3.8],
    [86, 3.8],
    [85, 3.5],
    [83, 3.5],
    [82, 3.0],
    [80, 3.0],
    [79, 2.8],
    [76, 2.8],
    [75, 2.5],
    [73, 2.5],
    [72, 2.0],
    [70, 2.0],
    [69, 1.8],
    [66, 1.8],
    [65, 1.5],
    [63, 1.5],
    [62, 1.0],
    [60, 1.0],
    [59, 0],
    [0, 0]
  ])("maps %i to %f", (score, expected) => {
    expect(convertScoreToSeuGradePoint(score)).toBe(expected);
  });
});

describe("calculateGpaResult", () => {
  it("calculates both GPA scopes with credit weighting and four-decimal rounding", () => {
    const result = calculateGpaResult([
      course({ id: "required-a", credit: "3.00", score: "96.00", isRequired: true, isFirstAttempt: true }),
      course({ id: "required-b", credit: "2.00", score: "90.00", isRequired: true, isFirstAttempt: true }),
      course({ id: "elective", credit: "1.00", score: "80.00", isRequired: false, isFirstAttempt: true }),
      course({ id: "retake", credit: "2.00", score: "100.00", isRequired: true, isFirstAttempt: false })
    ]);

    expect(result.requiredFirstAttempt).toEqual({
      weightedGpa: 4.48,
      weightedAverageScore: 93.6,
      totalCredits: 5,
      courseCount: 2
    });
    expect(result.overall).toEqual({
      weightedGpa: 4.375,
      weightedAverageScore: 93.5,
      totalCredits: 8,
      courseCount: 4
    });
  });

  it("excludes courses that are not GPA eligible from both scopes", () => {
    const result = calculateGpaResult([
      course({ id: "pass-fail", credit: "2.00", score: "100.00", isGpaEligible: false })
    ]);

    expect(result).toEqual({
      requiredFirstAttempt: {
        weightedGpa: null,
        weightedAverageScore: null,
        totalCredits: 0,
        courseCount: 0
      },
      overall: {
        weightedGpa: null,
        weightedAverageScore: null,
        totalCredits: 0,
        courseCount: 0
      }
    });
  });
});
