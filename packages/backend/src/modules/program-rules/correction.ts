import { nowIso, type CorrectionPatch, type ProgramRuleDraft } from "./models.js";

export class DraftCorrectionService {
  apply(draft: ProgramRuleDraft, patch: CorrectionPatch): ProgramRuleDraft {
    const courses = new Map(draft.courses.map((course) => [course.id, course]));
    for (const id of patch.deleteCourseIds ?? []) {
      courses.delete(id);
    }
    for (const course of patch.upsertCourses ?? []) {
      courses.set(course.id, course);
    }
    draft.courses = [...courses.values()];

    const groups = new Map(draft.groups.map((group) => [group.id, group]));
    for (const id of patch.deleteGroupIds ?? []) {
      groups.delete(id);
    }
    for (const group of patch.upsertGroups ?? []) {
      groups.set(group.id, group);
    }
    draft.groups = [...groups.values()];

    const categories = new Map(draft.requirementCategories.map((category) => [category.id, category]));
    for (const id of patch.deleteRequirementCategoryIds ?? []) {
      categories.delete(id);
    }
    for (const category of patch.upsertRequirementCategories ?? []) {
      categories.set(category.id, category);
    }
    draft.requirementCategories = [...categories.values()];

    const categoryRules = new Map(draft.categoryRules.map((rule) => [rule.id, rule]));
    for (const id of patch.deleteCategoryRuleIds ?? []) {
      categoryRules.delete(id);
    }
    for (const rule of patch.upsertCategoryRules ?? []) {
      categoryRules.set(rule.id, rule);
    }
    draft.categoryRules = [...categoryRules.values()];

    const assignments = new Map(draft.courseAssignments.map((assignment) => [assignment.id, assignment]));
    for (const id of patch.deleteCourseAssignmentIds ?? []) {
      assignments.delete(id);
    }
    for (const assignment of patch.upsertCourseAssignments ?? []) {
      assignments.set(assignment.id, assignment);
    }
    draft.courseAssignments = [...assignments.values()];

    const nonCourseRequirements = new Map(draft.nonCourseRequirements.map((requirement) => [requirement.id, requirement]));
    for (const id of patch.deleteNonCourseRequirementIds ?? []) {
      nonCourseRequirements.delete(id);
    }
    for (const requirement of patch.upsertNonCourseRequirements ?? []) {
      nonCourseRequirements.set(requirement.id, requirement);
    }
    draft.nonCourseRequirements = [...nonCourseRequirements.values()];

    const graduationRequirements = new Map(draft.graduationRequirements.map((requirement) => [requirement.id, requirement]));
    for (const id of patch.deleteGraduationRequirementIds ?? []) {
      graduationRequirements.delete(id);
    }
    for (const requirement of patch.upsertGraduationRequirements ?? []) {
      graduationRequirements.set(requirement.id, requirement);
    }
    draft.graduationRequirements = [...graduationRequirements.values()];

    if (patch.graduationRule) draft.graduationRule = patch.graduationRule;
    if (patch.status) draft.status = patch.status;
    if (patch.reviewerNote) draft.graduationRule.notes.push(patch.reviewerNote);
    draft.updatedAt = nowIso();
    return draft;
  }
}
