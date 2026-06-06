import type { GpaCourse } from "./gpa.types.js";

export interface MatchableProgramPlanCourse {
  id: string;
  code: string;
  name: string;
  credits: string;
  requirementType: string;
}

export interface MatchableProgramPlanCourseGroup {
  id: string;
  name: string;
  requirementType: string;
}

export interface CoursePlanMatchCandidate {
  matchTargetType: "course" | "group";
  programPlanCourseId: string | null;
  programPlanCourseGroupId: string | null;
  matchMethod: "normalized_name_credit" | "normalized_name" | "alias" | "high_confidence_name_credit" | "general_education_group" | "elective_group";
  confidence: string;
  confirmedByUser: boolean;
  requirementType: string;
}

const romanMap: Record<string, string> = {
  "Ⅰ": "i",
  "Ⅱ": "ii",
  "Ⅲ": "iii",
  "Ⅳ": "iv",
  "Ⅴ": "v",
  "Ⅵ": "vi"
};

const aliasPairs = new Map<string, string>([
  [normalizeCourseName("程序设计及算法语言Ⅰ"), normalizeCourseName("程序设计基础及语言I(双语)")],
  [normalizeCourseName("程序设计及算法语言Ⅱ"), normalizeCourseName("程序设计基础及语言II(双语)")],
  [normalizeCourseName("大学物理BⅠ"), normalizeCourseName("大学物理(B)Ⅰ")],
  [normalizeCourseName("大学物理BⅡ"), normalizeCourseName("大学物理(B)Ⅱ")],
  [normalizeCourseName("离散数学"), normalizeCourseName("离散数学(双语)")]
]);

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
  return matchGpaCourseToPlanRequirement(course, { courses: planCourses, groups: [] });
}

export function matchGpaCourseToPlanRequirement(
  course: GpaCourse,
  candidates: { courses: MatchableProgramPlanCourse[]; groups: MatchableProgramPlanCourseGroup[] }
): CoursePlanMatchCandidate | null {
  const normalizedName = normalizeCourseName(course.name);
  const aliasTarget = aliasPairs.get(normalizedName);
  if (aliasTarget) {
    const aliasCourse = candidates.courses.find(
      (planCourse) => normalizeCourseName(planCourse.name) === aliasTarget && Number(planCourse.credits) === Number(course.credit)
    );
    if (aliasCourse) {
      return courseMatch(aliasCourse, "alias", "0.98", true);
    }
  }

  const sameName = candidates.courses.filter((planCourse) => normalizeCourseName(planCourse.name) === normalizedName);
  const sameCredit = sameName.find((planCourse) => Number(planCourse.credits) === Number(course.credit));
  if (sameCredit) {
    return courseMatch(sameCredit, "normalized_name_credit", "0.92", false);
  }

  const highConfidence = candidates.courses.find(
    (planCourse) =>
      planCourse.requirementType === "required" &&
      Number(planCourse.credits) === Number(course.credit) &&
      courseNameSimilarity(normalizedName, normalizeCourseName(planCourse.name)) >= 0.74
  );
  if (highConfidence) {
    return courseMatch(highConfidence, "high_confidence_name_credit", "0.88", false);
  }

  if (sameName[0]) {
    return courseMatch(sameName[0], "normalized_name", "0.75", false);
  }

  return groupMatch(course, candidates.groups);
}

function courseMatch(
  course: MatchableProgramPlanCourse,
  matchMethod: CoursePlanMatchCandidate["matchMethod"],
  confidence: string,
  confirmedByUser: boolean
): CoursePlanMatchCandidate {
  return {
    matchTargetType: "course",
    programPlanCourseId: course.id,
    programPlanCourseGroupId: null,
    matchMethod,
    confidence,
    confirmedByUser,
    requirementType: course.requirementType
  };
}

function groupMatch(course: GpaCourse, groups: MatchableProgramPlanCourseGroup[]): CoursePlanMatchCandidate | null {
  const generalEducationGroup = groups.find((group) => /通识|任选|选修/.test(group.name));
  if (!course.isGpaEligible && generalEducationGroup) {
    return {
      matchTargetType: "group",
      programPlanCourseId: null,
      programPlanCourseGroupId: generalEducationGroup.id,
      matchMethod: "general_education_group",
      confidence: "0.80",
      confirmedByUser: false,
      requirementType: generalEducationGroup.requirementType
    };
  }

  const electiveGroup = groups.find((group) => /选修|任选|限选/.test(group.name));
  if (course.isGpaEligible && electiveGroup && Number(course.credit) > 0) {
    return {
      matchTargetType: "group",
      programPlanCourseId: null,
      programPlanCourseGroupId: electiveGroup.id,
      matchMethod: "elective_group",
      confidence: "0.70",
      confirmedByUser: false,
      requirementType: electiveGroup.requirementType
    };
  }

  return null;
}

function courseNameSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }
  const leftSet = new Set([...left]);
  const rightSet = new Set([...right]);
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}
