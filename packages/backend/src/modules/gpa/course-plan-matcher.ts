import type { GpaCourse } from "./gpa.types.js";

export interface MatchableProgramPlanCourse {
  id: string;
  code: string;
  name: string;
  credits: string;
  requirementType: string;
}

export interface CoursePlanMatchCandidate {
  programPlanCourseId: string;
  matchMethod: "normalized_name_credit" | "normalized_name";
  confidence: string;
}

const romanMap: Record<string, string> = {
  "Ⅰ": "i",
  "Ⅱ": "ii",
  "Ⅲ": "iii",
  "Ⅳ": "iv",
  "Ⅴ": "v",
  "Ⅵ": "vi"
};

export function normalizeCourseName(value: string): string {
  return value
    .replace(/[▲●☆*]/g, "")
    .replace(/[ⅠⅡⅢⅣⅤⅥ]/g, (match) => romanMap[match] ?? match)
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function isTranscriptArtifactName(value: string): boolean {
  const normalized = value.trim();
  return /^[\d.]+$/.test(normalized) || normalized.length < 2;
}

export function matchGpaCourseToPlanCourse(
  course: GpaCourse,
  planCourses: MatchableProgramPlanCourse[]
): CoursePlanMatchCandidate | null {
  const normalizedName = normalizeCourseName(course.name);
  const sameName = planCourses.filter((planCourse) => normalizeCourseName(planCourse.name) === normalizedName);
  if (sameName.length === 0) {
    return null;
  }

  const sameCredit = sameName.find((planCourse) => Number(planCourse.credits) === Number(course.credit));
  if (sameCredit) {
    return {
      programPlanCourseId: sameCredit.id,
      matchMethod: "normalized_name_credit",
      confidence: "0.92"
    };
  }

  return {
    programPlanCourseId: sameName[0].id,
    matchMethod: "normalized_name",
    confidence: "0.75"
  };
}
