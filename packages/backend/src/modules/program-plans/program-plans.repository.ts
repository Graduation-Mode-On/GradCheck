import { eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { programPlans, userProgramBindings } from "../../db/schema.js";
import type { CurriculumPlan, ProgramPlanSummary } from "./program-plans.schemas.js";

export interface ProgramPlanBinding {
  userId: string;
  programPlanId: string;
  confirmedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgramPlanRepository {
  createAndBind(userId: string, sourceFilename: string, planJson: CurriculumPlan): Promise<{
    plan: ProgramPlanSummary;
    binding: ProgramPlanBinding;
  }>;
  getBoundPlan(userId: string): Promise<ProgramPlanSummary | null>;
}

function valuesFromPlan(sourceFilename: string, planJson: CurriculumPlan) {
  return {
    sourceFilename,
    school: planJson.program.school,
    college: planJson.program.college ?? null,
    major: planJson.program.major,
    grade: planJson.program.grade ?? null,
    totalCredits: planJson.program.total_credits == null ? null : String(planJson.program.total_credits),
    courseCount: planJson.courses.length,
    requirementCount: planJson.requirements.length,
    warningCount: planJson.warnings.length,
    planJson
  };
}

export function createProgramPlanRepository(db: Database): ProgramPlanRepository {
  return {
    async createAndBind(userId, sourceFilename, planJson) {
      const [plan] = await db.insert(programPlans).values(valuesFromPlan(sourceFilename, planJson)).returning();
      const [binding] = await db
        .insert(userProgramBindings)
        .values({ userId, programPlanId: plan.id })
        .onConflictDoUpdate({
          target: userProgramBindings.userId,
          set: { programPlanId: plan.id, confirmedAt: new Date(), updatedAt: new Date() }
        })
        .returning();
      return { plan: plan as ProgramPlanSummary, binding };
    },

    async getBoundPlan(userId) {
      const [binding] = await db
        .select()
        .from(userProgramBindings)
        .where(eq(userProgramBindings.userId, userId))
        .limit(1);
      if (!binding) return null;
      const [plan] = await db
        .select()
        .from(programPlans)
        .where(eq(programPlans.id, binding.programPlanId))
        .limit(1);
      return (plan as ProgramPlanSummary | undefined) ?? null;
    }
  };
}
