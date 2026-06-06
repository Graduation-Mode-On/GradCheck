export type ParseMethod = "pdfjs" | "paddleocr" | "pdfplumber" | "mixed" | "manual";
export type ReviewStatus = "draft" | "pending_review" | "approved" | "rejected";
export type RequirementType = "required" | "elective" | "general" | "unknown";
export type RequirementCategoryType =
  | "course_category"
  | "required_course_group"
  | "elective_group"
  | "general_education"
  | "practice"
  | "non_course";
export type CompletionRule =
  | "all_courses_required"
  | "credits_at_least"
  | "courses_at_least"
  | "credits_or_courses_at_least"
  | "custom"
  | "manual_review";

export interface ProgramMetadata {
  school?: string;
  college?: string;
  major?: string;
  grade?: string;
  version?: string;
  sourceFilename?: string;
}

export interface TableBlock {
  rows: string[][];
  source: "pdf-table" | "text-derived" | "ocr-derived";
}

export interface PageQuality {
  score: number;
  passed: boolean;
  issues: string[];
  textChars: number;
  nonEmptyTableCells: number;
}

export interface PageParseResult {
  pageNumber: number;
  method: ParseMethod;
  text: string;
  tables: TableBlock[];
  quality?: PageQuality;
  warnings: string[];
}

export interface CourseRequirement {
  id: string;
  code?: string;
  name: string;
  requirementType: RequirementType;
  credits?: number;
  teachingAcademicYear?: string;
  teachingSemester?: string;
  suggestedSemester?: string;
  groupId?: string;
  groupName?: string;
  sourcePage?: number;
  rawText?: string;
}

export interface ProgramCourseInfo {
  courseCode: string;
  courseName: string;
  credits: number;
  teachingAcademicYear?: string;
  teachingSemester?: string;
  sourcePage?: number;
  rawText?: string;
}

export interface CourseGroupRule {
  id: string;
  name: string;
  requirementType: RequirementType;
  minCourses?: number;
  minCredits?: number;
  sourcePage?: number;
  rawText?: string;
}

export interface GraduationRule {
  totalCreditsRequired?: number;
  requiredCourseCredits?: number;
  electiveCourseCredits?: number;
  notes: string[];
}

export interface RequirementCategory {
  id: string;
  name: string;
  type: RequirementCategoryType;
  parentId?: string;
  requirementType: RequirementType;
  minCredits?: number;
  minCourses?: number;
  completionRule: CompletionRule;
  sourcePage?: number;
  rawText?: string;
}

export interface CategoryRule {
  id: string;
  categoryId: string;
  name: string;
  completionRule: CompletionRule;
  minCredits?: number;
  minCourses?: number;
  description: string;
  sourcePage?: number;
  rawText?: string;
}

export interface CourseAssignment {
  id: string;
  courseCode: string;
  categoryId: string;
  confidence: number;
  sourcePage?: number;
  rawText?: string;
}

export interface NonCourseRequirement {
  id: string;
  name: string;
  completionRule: CompletionRule;
  minCredits?: number;
  minCourses?: number;
  minScore?: number;
  unit?: string;
  description: string;
  sourcePage?: number;
  rawText?: string;
}

export type GraduationRequirementScope = "program" | "category" | "course_group" | "non_course";

export interface GraduationRequirement {
  id: string;
  name: string;
  scope: GraduationRequirementScope;
  completionRule: CompletionRule;
  targetCategoryId?: string;
  targetNonCourseRequirementId?: string;
  minCredits?: number;
  minCourses?: number;
  minScore?: number;
  unit?: string;
  description: string;
  sourcePage?: number;
  rawText?: string;
}

export interface ProgramRuleDraft {
  id: string;
  metadata: ProgramMetadata;
  status: ReviewStatus;
  parseMethod: ParseMethod;
  qualitySummary: Record<string, unknown>;
  pages: PageParseResult[];
  courses: CourseRequirement[];
  groups: CourseGroupRule[];
  graduationRule: GraduationRule;
  requirementCategories: RequirementCategory[];
  categoryRules: CategoryRule[];
  courseAssignments: CourseAssignment[];
  nonCourseRequirements: NonCourseRequirement[];
  graduationRequirements: GraduationRequirement[];
  extractionWarnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProgramRequirementSet {
  id: string;
  draftId: string;
  metadata: ProgramMetadata;
  status: ReviewStatus;
  graduationRule: GraduationRule;
  requirementCategories: RequirementCategory[];
  categoryRules: CategoryRule[];
  courseAssignments: CourseAssignment[];
  nonCourseRequirements: NonCourseRequirement[];
  graduationRequirements: GraduationRequirement[];
  extractionWarnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProgramCourseCatalog {
  id: string;
  draftId: string;
  metadata: ProgramMetadata;
  status: ReviewStatus;
  courses: ProgramCourseInfo[];
  extractionWarnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CorrectionPatch {
  upsertCourses?: CourseRequirement[];
  deleteCourseIds?: string[];
  upsertGroups?: CourseGroupRule[];
  deleteGroupIds?: string[];
  upsertRequirementCategories?: RequirementCategory[];
  deleteRequirementCategoryIds?: string[];
  upsertCategoryRules?: CategoryRule[];
  deleteCategoryRuleIds?: string[];
  upsertCourseAssignments?: CourseAssignment[];
  deleteCourseAssignmentIds?: string[];
  upsertNonCourseRequirements?: NonCourseRequirement[];
  deleteNonCourseRequirementIds?: string[];
  upsertGraduationRequirements?: GraduationRequirement[];
  deleteGraduationRequirementIds?: string[];
  graduationRule?: GraduationRule;
  status?: ReviewStatus;
  reviewerNote?: string;
}

export function createId(prefix = "id"): string {
  return `${prefix}_${randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createEmptyDraft(metadata: ProgramMetadata = {}): ProgramRuleDraft {
  const now = nowIso();
  return {
    id: createId("draft"),
    metadata,
    status: "draft",
    parseMethod: "mixed",
    qualitySummary: {},
    pages: [],
    courses: [],
    groups: [],
    graduationRule: { notes: [] },
    requirementCategories: [],
    categoryRules: [],
    courseAssignments: [],
    nonCourseRequirements: [],
    graduationRequirements: [],
    extractionWarnings: [],
    createdAt: now,
    updatedAt: now
  };
}

export function toRequirementSet(draft: ProgramRuleDraft): ProgramRequirementSet {
  return {
    id: `requirements_${draft.id}`,
    draftId: draft.id,
    metadata: draft.metadata,
    status: draft.status,
    graduationRule: draft.graduationRule,
    requirementCategories: draft.requirementCategories,
    categoryRules: draft.categoryRules,
    courseAssignments: draft.courseAssignments,
    nonCourseRequirements: draft.nonCourseRequirements,
    graduationRequirements: draft.graduationRequirements,
    extractionWarnings: draft.extractionWarnings,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  };
}

export function toCourseCatalog(draft: ProgramRuleDraft): ProgramCourseCatalog {
  return {
    id: `course_catalog_${draft.id}`,
    draftId: draft.id,
    metadata: draft.metadata,
    status: draft.status,
    courses: draft.courses
      .filter((course): course is CourseRequirement & { code: string; credits: number } => Boolean(course.code) && course.credits !== undefined)
      .map((course) => ({
        courseCode: course.code,
        courseName: course.name,
        credits: course.credits,
        teachingAcademicYear: course.teachingAcademicYear,
        teachingSemester: course.teachingSemester,
        sourcePage: course.sourcePage,
        rawText: course.rawText
      })),
    extractionWarnings: draft.extractionWarnings,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  };
}
import { randomUUID } from "node:crypto";
