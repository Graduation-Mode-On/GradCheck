export type RuleStatus = "completed" | "in_progress" | "not_started";

export type RuleTargetType = "all_courses" | "courses" | "credits" | "either" | "manual";

export interface PlanCourseRef {
  id: string;
  code: string;
  name: string;
  credits: string;
}

export interface CompletedPlanCourse extends PlanCourseRef {
  matchedGpaCourseId: string;
  matchedGpaCourseTerm: string;
  matchedGpaCourseScore: string;
}

export interface MatchedFreeCourse {
  gpaCourseId: string;
  name: string;
  credits: string;
  term: string;
  score: string;
}

export interface RuleProgress {
  id: string;
  name: string;
  requirementType: string;
  description: string | null;
  status: RuleStatus;
  targetType: RuleTargetType;
  targetCourses: number | null;
  targetCredits: string | null;
  earnedCourses: number;
  earnedCredits: string;
  gapText: string;
  completedCourses: CompletedPlanCourse[];
  candidateCourses: PlanCourseRef[];
  matchedFreeCourses: MatchedFreeCourse[];
}

export interface CategoryProgress {
  name: string;
  requiredCredits: string;
  earnedCredits: string;
  completedCourseCount: number;
  totalCourseCount: number;
  percent: number;
}

export interface OverallProgress {
  totalCredits: string;
  earnedCredits: string;
  gapCredits: string;
  percent: number;
  satisfiedRuleCount: number;
  totalRuleCount: number;
}

export interface PlanSummaryRef {
  id: string;
  school: string;
  college: string | null;
  major: string;
  grade: string | null;
}

export type CoursesProgressEmptyReason = "no_plan" | "no_gpa_courses" | "no_matches";

export interface CoursesProgressResponse {
  plan: PlanSummaryRef | null;
  emptyReason: CoursesProgressEmptyReason | null;
  overall: OverallProgress | null;
  categories: CategoryProgress[];
  rules: RuleProgress[];
}
