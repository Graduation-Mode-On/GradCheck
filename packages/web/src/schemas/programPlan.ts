export interface ProgramInfo {
  school: string;
  college?: string | null;
  major: string;
  grade?: string | null;
  total_credits?: number | null;
}

export interface ProgramCourse {
  code: string;
  name: string;
  credits: number;
  category?: string | null;
  subcategory?: string | null;
  term?: {
    year?: string | null;
    semester?: string | null;
  };
}

export interface ProgramRequirement {
  id: string;
  type: string;
  title: string;
  min_courses?: number | null;
  min_credits?: number | null;
}

export interface CurriculumPlan {
  program: ProgramInfo;
  courses: ProgramCourse[];
  requirements: ProgramRequirement[];
  semester_plan: unknown[];
  warnings: unknown[];
  provenance: Record<string, unknown>;
}

export interface ProgramPlanPreview {
  id?: string;
  sourceFilename: string;
  school: string;
  college: string | null;
  major: string;
  grade: string | null;
  totalCredits: string | null;
  courseCount: number;
  requirementCount: number;
  warningCount: number;
  planJson: CurriculumPlan;
}

