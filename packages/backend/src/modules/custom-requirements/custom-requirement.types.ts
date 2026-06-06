export type CustomRequirementKind = "count" | "hours" | "credits" | "boolean";
export type CustomRequirementCategory = "lecture" | "volunteer" | "labor" | "practice" | "college" | "sports" | "exam" | "other";
export type CustomRequirementImportance = "required" | "optional" | "personal_goal";
export type CustomRequirementSource = "user_custom" | "college_requirement" | "pending_confirmation";
export type CustomRequirementStatus = "pending_confirmation" | "completed" | "in_progress" | "not_started";

export interface CustomRequirementDto {
  id: string;
  userId: string;
  name: string;
  kind: CustomRequirementKind;
  category: CustomRequirementCategory;
  targetValue: string;
  currentValue: string;
  unit: string;
  importance: CustomRequirementImportance;
  source: CustomRequirementSource;
  includeInProgress: boolean;
  showOnHome: boolean;
  deadline: string | null;
  notes: string | null;
  status: CustomRequirementStatus;
  progressPercent: number;
  createdAt: Date;
  updatedAt: Date;
}
