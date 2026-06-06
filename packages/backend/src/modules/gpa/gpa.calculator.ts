import type { GpaCalculationResult, GpaCourse, GpaScopeResult } from "./gpa.types.js";

const EMPTY_SCOPE_RESULT: GpaScopeResult = {
  weightedGpa: null,
  weightedAverageScore: null,
  totalCredits: 0,
  courseCount: 0
};

export function convertScoreToSeuGradePoint(score: number): number {
  if (score >= 96) return 4.8;
  if (score >= 93) return 4.5;
  if (score >= 90) return 4.0;
  if (score >= 86) return 3.8;
  if (score >= 83) return 3.5;
  if (score >= 80) return 3.0;
  if (score >= 76) return 2.8;
  if (score >= 73) return 2.5;
  if (score >= 70) return 2.0;
  if (score >= 66) return 1.8;
  if (score >= 63) return 1.5;
  if (score >= 60) return 1.0;
  return 0;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function toNumber(value: string): number {
  return Number(value);
}

function calculateScope(courses: GpaCourse[]): GpaScopeResult {
  if (courses.length === 0) {
    return { ...EMPTY_SCOPE_RESULT };
  }

  const totalCredits = courses.reduce((sum, course) => sum + toNumber(course.credit), 0);
  if (totalCredits === 0) {
    return { ...EMPTY_SCOPE_RESULT };
  }

  const weightedGpaTotal = courses.reduce(
    (sum, course) => sum + convertScoreToSeuGradePoint(toNumber(course.score)) * toNumber(course.credit),
    0
  );
  const weightedScoreTotal = courses.reduce((sum, course) => sum + toNumber(course.score) * toNumber(course.credit), 0);

  return {
    weightedGpa: round4(weightedGpaTotal / totalCredits),
    weightedAverageScore: round4(weightedScoreTotal / totalCredits),
    totalCredits: round4(totalCredits),
    courseCount: courses.length
  };
}

export function calculateGpaResult(courses: GpaCourse[]): GpaCalculationResult {
  const eligibleCourses = courses.filter((course) => course.isGpaEligible);
  const requiredFirstAttemptCourses = eligibleCourses.filter((course) => course.isRequired && course.isFirstAttempt);

  return {
    requiredFirstAttempt: calculateScope(requiredFirstAttemptCourses),
    overall: calculateScope(eligibleCourses)
  };
}
