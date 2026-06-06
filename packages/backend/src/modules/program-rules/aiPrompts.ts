import type { PageParseResult, ProgramMetadata } from "./models.js";

export const PROGRAM_RULE_SYSTEM_PROMPT = [
  "You extract university program graduation rules from parsed PDF pages.",
  "Return strict JSON only.",
  "Do not invent courses or requirements.",
  "Keep source page numbers and raw evidence for every extracted item.",
  "Prefer explicit course tables over prose.",
  "Ignore school introduction, major overview, employment descriptions, and any prose that is not a requirement."
].join(" ");

export function buildProgramRulePrompt(metadata: ProgramMetadata, pages: PageParseResult[], maxChars = 30_000): string {
  const chunks = [
    "Metadata:",
    JSON.stringify(metadata, null, 2),
    [
      "Return JSON with exactly these top-level keys:",
      "requirementCategories, categoryRules, courseAssignments, nonCourseRequirements, graduationRequirements, courses, groups, graduationRule.",
      "Focus on requirementCategories, categoryRules, courseAssignments, and nonCourseRequirements first.",
      "Do not flatten all rules into notes when a structured category or non-course requirement can represent it.",
      "requirementCategories item shape: {id,name,type,parentId,requirementType,minCredits,minCourses,completionRule,sourcePage,rawText}.",
      "Allowed category type: course_category, required_course_group, elective_group, general_education, practice, non_course.",
      "Allowed completionRule: all_courses_required, credits_at_least, courses_at_least, credits_or_courses_at_least, custom, manual_review.",
      "categoryRules item shape: {categoryId,categoryName,name,completionRule,minCredits,minCourses,description,sourcePage,rawText}.",
      "courseAssignments item shape: {courseCode,categoryId,categoryName,confidence,sourcePage,rawText}.",
      "nonCourseRequirements item shape: {name,completionRule,minCredits,minCourses,minScore,unit,description,sourcePage,rawText}.",
      "graduationRequirements item shape: {name,scope,completionRule,targetCategoryId,targetNonCourseRequirementId,minCredits,minCourses,minScore,unit,description,sourcePage,rawText}.",
      "Allowed graduation requirement scope: program, category, course_group, non_course.",
      "courses item shape: {code,name,credits,teachingAcademicYear,teachingSemester,sourcePage,rawText}.",
      "For courses, extract only table facts: course code, course name, credits, teaching academic year, and teaching semester.",
      "groups item shape: {name,requirementType,minCourses,minCredits,sourcePage,rawText}.",
      "graduationRule shape: {totalCreditsRequired,requiredCourseCredits,electiveCourseCredits,notes}.",
      "Only include courses with a visible course code and credit value.",
      "Extract categories such as required courses, elective groups, general education, A/B groups, practice, short-term courses, and module requirements.",
      "Extract rules such as all required courses must be completed, minimum credits, minimum courses, A group/B group course counts, seminar credit requirements, English-course requirements, sports score, GPA, foreign language standard, labor/practice requirements.",
      "For graduationRule.notes, summarize usable non-course rules such as English-course count, sports, practice, labor, lectures, internships, or special graduation constraints.",
      "Use requirementType only as required, elective, general, or unknown.",
      "If a value is uncertain, omit it instead of guessing."
    ].join(" "),
    "Parsed pages:"
  ];

  for (const page of pages) {
    const tables = page.tables
      .flatMap((table) => table.rows.map((row) => row.join(" | ")))
      .join("\n");
    chunks.push(`\n[page=${page.pageNumber}, method=${page.method}]\n${page.text}\n${tables}`);
  }

  return chunks.join("\n").slice(0, maxChars);
}
