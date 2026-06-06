export interface ScheduleSlot {
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  startWeek?: number;
  endWeek?: number;
  weekLabel?: string;
}

export interface SemesterCourse {
  id: string;
  courseCode: string | null;
  courseName: string;
  credits: number;
  teacher: string | null;
  classroom: string | null;
  schedule: ScheduleSlot[];
  category: string | null;
  source: string;
  selected: boolean;
}

export interface CandidateCourse {
  code: string;
  name: string;
  credits: number;
  category: string | null;
  subcategory: string | null;
  term: { year?: string | null; semester?: string | null };
  status: "completed" | "available";
  isRequired: boolean;
}

export interface CandidateTermContext {
  requestedTerm: string | null;
  planYear: string | null;
  planSemester: string | null;
  label: string | null;
  canInfer: boolean;
  gradeYear: number | null;
  gradeSource: "profile" | "program_plan" | "unknown";
  profileGradeYear: number | null;
  planGradeYear: number | null;
}

export interface CandidateCourseStats {
  totalCount: number;
  totalCredits: number;
  completedCount: number;
  completedCredits: number;
  remainingCount: number;
  remainingCredits: number;
  requiredRemainingCount: number;
  requiredRemainingCredits: number;
  electiveRemainingCount: number;
  electiveRemainingCredits: number;
}

export interface CandidateCoursesResponse {
  hasPlan: boolean;
  termContext: CandidateTermContext;
  courses: CandidateCourse[];
  candidates: CandidateCourse[];
  stats: CandidateCourseStats;
}

export interface RecommendationPreferences {
  avoidDays: number[];
  avoidEarlyMorning: boolean;
  scheduleStyle: "compact" | "spread";
  maxCoursesPerDay?: number;
  notes?: string;
}

export interface RecommendedCourse {
  courseCode?: string;
  courseName: string;
  credits: number;
  teacher?: string;
  classroom?: string;
  schedule: ScheduleSlot[];
  reason: string;
}

export interface CourseConflict {
  id: string;
  incoming: RecommendedCourse;
  existing: RecommendedCourse[];
  defaultChoice: "incoming" | "existing";
  reason: string;
}

export interface RecommendationResult {
  id: string;
  userId: string;
  term: string;
  preferences: Record<string, unknown>;
  recommendedCourses: RecommendedCourse[];
  totalCredits: string | null;
  summary: string | null;
  warnings: string[];
  conflicts: CourseConflict[];
  createdAt: string;
  updatedAt: string;
}
