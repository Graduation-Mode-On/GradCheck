import type { CurriculumPlan } from "./program-plans.schemas.js";

export interface NormalizedProgramPlanCourseGroup {
  sourceRequirementId: string;
  name: string;
  requirementType: string;
  minCourses: string | null;
  minCredits: string | null;
  description: string | null;
}

export interface NormalizedProgramPlanCourse {
  sourceRequirementId: string | null;
  code: string;
  name: string;
  credits: string;
  category: string | null;
  subcategory: string | null;
  suggestedTerm: string | null;
  requirementType: string;
}

type RequirementWithCourseLinks = CurriculumPlan["requirements"][number] & {
  min_courses?: number;
  min_credits?: number;
  course_codes?: string[];
  description?: string;
};

export function normalizeProgramPlanCourses(planJson: CurriculumPlan) {
  const groups = new Map<string, NormalizedProgramPlanCourseGroup>();
  const courseCodeToRequirement = new Map<string, string>();

  for (const requirement of planJson.requirements as RequirementWithCourseLinks[]) {
    groups.set(requirement.id, {
      sourceRequirementId: requirement.id,
      name: requirement.title,
      requirementType: requirement.type,
      minCourses: requirement.min_courses == null ? null : String(requirement.min_courses),
      minCredits: requirement.min_credits == null ? null : String(requirement.min_credits),
      description: requirement.description ?? null
    });

    for (const code of requirement.course_codes ?? []) {
      courseCodeToRequirement.set(code, requirement.id);
    }
  }

  if (!groups.has("required_core")) {
    groups.set("required_core", {
      sourceRequirementId: "required_core",
      name: "必修课程",
      requirementType: "required",
      minCourses: null,
      minCredits: null,
      description: null
    });
  }

  const courses = planJson.courses.map((course): NormalizedProgramPlanCourse => {
    const linkedRequirementId = courseCodeToRequirement.get(course.code) ?? null;
    const linkedGroup = linkedRequirementId ? groups.get(linkedRequirementId) : null;
    const requirementType = linkedGroup?.requirementType ?? inferRequirementType(course.category);

    return {
      sourceRequirementId: linkedRequirementId ?? (requirementType === "required" ? "required_core" : null),
      code: course.code,
      name: course.name,
      credits: String(course.credits),
      category: course.category ?? null,
      subcategory: course.subcategory ?? null,
      suggestedTerm: course.term?.year && course.term.semester ? `${course.term.year}-${course.term.semester}` : null,
      requirementType
    };
  });

  return { groups: [...groups.values()], courses };
}

function inferRequirementType(category?: string | null) {
  if (!category) {
    return "unknown";
  }

  return category.includes("选修") || category.includes("任选") || category.includes("限选") ? "elective" : "required";
}
