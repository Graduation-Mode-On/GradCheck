export interface GpaCourseInput {
  term: string;
  name: string;
  credit: string;
  score: string;
  isRequired: boolean;
  isFirstAttempt: boolean;
  isGpaEligible: boolean;
}

export interface GpaCourse extends GpaCourseInput {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GpaScopeResult {
  weightedGpa: number | null;
  weightedAverageScore: number | null;
  totalCredits: number;
  courseCount: number;
}

export interface GpaCalculationResult {
  requiredFirstAttempt: GpaScopeResult;
  overall: GpaScopeResult;
}

export interface PersistedGpaCalculationResult extends GpaCalculationResult {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
