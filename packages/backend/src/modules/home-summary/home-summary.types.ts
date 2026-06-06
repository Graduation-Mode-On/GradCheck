export type DimensionStatus = "completed" | "in_progress" | "not_started" | "unknown";

export type DimensionKey =
  | "courses"
  | "gpa"
  | "human_lecture"
  | "book_report"
  | "social_practice_credits"
  | "social_practice_courses"
  | "volunteer_hours"
  | "ordinary_labor"
  | "special_labor"
  | "srtp"
  | "custom_requirement";

export interface DimensionProgress {
  key: DimensionKey;
  id: string;
  label: string;
  status: DimensionStatus;
  current: number;
  target: number;
  unit: string;
  percent: number;
  route: string;
  detail: string;
}

export interface GraduationSummaryResponse {
  overall: {
    coursesPercent: number;
    completedDimensions: number;
    totalDimensions: number;
    unfinishedCount: number;
  };
  dimensions: DimensionProgress[];
}
