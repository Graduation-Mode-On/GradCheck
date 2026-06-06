export interface ScheduleSlot {
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  startWeek?: number;
  endWeek?: number;
  weekLabel?: string;
}

export interface SemesterCourseDto {
  id: string;
  userId: string;
  term: string;
  courseCode: string | null;
  courseName: string;
  credits: string;
  teacher: string | null;
  classroom: string | null;
  schedule: ScheduleSlot[];
  category: string | null;
  source: string;
  selected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateCourseDto {
  code: string;
  name: string;
  credits: number;
  category: string | null;
  subcategory: string | null;
  term: { year?: string | null; semester?: string | null };
  status: "completed" | "available";
  isRequired: boolean;
}

export interface RecommendedCourseDto {
  courseCode?: string;
  courseName: string;
  credits: number;
  teacher?: string;
  classroom?: string;
  schedule: ScheduleSlot[];
  reason: string;
}

export interface CourseConflictDto {
  id: string;
  incoming: RecommendedCourseDto;
  existing: RecommendedCourseDto[];
  defaultChoice: "incoming" | "existing";
  reason: string;
}

export interface RecommendationResultDto {
  id: string;
  userId: string;
  term: string;
  preferences: Record<string, unknown>;
  recommendedCourses: RecommendedCourseDto[];
  totalCredits: string | null;
  summary: string | null;
  warnings: string[];
  conflicts: CourseConflictDto[];
  createdAt: Date;
  updatedAt: Date;
}
