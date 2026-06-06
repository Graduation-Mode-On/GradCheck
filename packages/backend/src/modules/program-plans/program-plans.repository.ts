import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { programPlanCourseGroups, programPlanCourses, programPlans, userProfiles, userProgramPlanBindings } from "../../db/schema.js";
import { normalizeProgramPlanCourses } from "./program-plan-normalizer.js";
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
    normalized: ProgramPlanNormalizedStats;
  }>;
  getBoundPlan(userId: string): Promise<ProgramPlanSummary | null>;
  listReusablePlans(userId: string): Promise<ProgramPlanSummary[]>;
  bindExistingPlan(userId: string, programPlanId: string): Promise<{
    plan: ProgramPlanSummary;
    binding: ProgramPlanBinding;
  } | null>;
  getNormalizedStats(programPlanId: string): Promise<ProgramPlanNormalizedStats | null>;
  backfillNormalizedCourses(): Promise<{ planCount: number }>;
}

export interface ProgramPlanNormalizedStats {
  groupCount: number;
  courseCount: number;
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
      return db.transaction(async (tx) => {
        const [plan] = await tx.insert(programPlans).values(valuesFromPlan(sourceFilename, planJson)).returning();
        const normalized = await writeNormalizedPlanCourses(tx, plan.id, planJson);
        const [binding] = await tx
          .insert(userProgramPlanBindings)
          .values({ userId, programPlanId: plan.id })
          .onConflictDoUpdate({
            target: userProgramPlanBindings.userId,
            set: { programPlanId: plan.id, confirmedAt: new Date(), updatedAt: new Date() }
          })
          .returning();
        return { plan: plan as ProgramPlanSummary, binding, normalized };
      });
    },

    async getBoundPlan(userId) {
      const [binding] = await db
        .select()
        .from(userProgramPlanBindings)
        .where(eq(userProgramPlanBindings.userId, userId))
        .limit(1);
      if (!binding) return null;
      const [plan] = await db
        .select()
        .from(programPlans)
        .where(eq(programPlans.id, binding.programPlanId))
        .limit(1);
      return (plan as ProgramPlanSummary | undefined) ?? null;
    },

    async listReusablePlans(userId) {
      const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
      if (!profile) return [];
      const grade = `${profile.grade}级`;
      return (await db
        .select()
        .from(programPlans)
        .where(and(eq(programPlans.major, profile.major), eq(programPlans.grade, grade)))
        .orderBy(desc(programPlans.createdAt))) as ProgramPlanSummary[];
    },

    async bindExistingPlan(userId, programPlanId) {
      return db.transaction(async (tx) => {
        const [profile] = await tx.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
        if (!profile) return null;
        const [plan] = await tx
          .select()
          .from(programPlans)
          .where(and(eq(programPlans.id, programPlanId), eq(programPlans.major, profile.major), eq(programPlans.grade, `${profile.grade}级`)))
          .limit(1);
        if (!plan) return null;
        const [binding] = await tx
          .insert(userProgramPlanBindings)
          .values({ userId, programPlanId })
          .onConflictDoUpdate({
            target: userProgramPlanBindings.userId,
            set: { programPlanId, confirmedAt: new Date(), updatedAt: new Date() }
          })
          .returning();
        return { plan: plan as ProgramPlanSummary, binding };
      });
    },

    async getNormalizedStats(programPlanId) {
      const [groupRows, courseRows] = await Promise.all([
        db.select().from(programPlanCourseGroups).where(eq(programPlanCourseGroups.programPlanId, programPlanId)),
        db.select().from(programPlanCourses).where(eq(programPlanCourses.programPlanId, programPlanId))
      ]);
      if (groupRows.length === 0 && courseRows.length === 0) {
        return null;
      }
      return { groupCount: groupRows.length, courseCount: courseRows.length };
    },

    async backfillNormalizedCourses() {
      const plans = await db.select().from(programPlans);
      for (const plan of plans) {
        await db.transaction(async (tx) => {
          await writeNormalizedPlanCourses(tx, plan.id, plan.planJson as CurriculumPlan);
        });
      }
      return { planCount: plans.length };
    }
  };
}

type ProgramPlanTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function writeNormalizedPlanCourses(
  db: ProgramPlanTransaction,
  programPlanId: string,
  planJson: CurriculumPlan
): Promise<ProgramPlanNormalizedStats> {
  await db.delete(programPlanCourses).where(eq(programPlanCourses.programPlanId, programPlanId));
  await db.delete(programPlanCourseGroups).where(eq(programPlanCourseGroups.programPlanId, programPlanId));

  const normalized = normalizeProgramPlanCourses(planJson);
  const groupIdByRequirement = new Map<string, string>();

  if (normalized.groups.length > 0) {
    const insertedGroups = await db
      .insert(programPlanCourseGroups)
      .values(
        normalized.groups.map((group) => ({
          programPlanId,
          sourceRequirementId: group.sourceRequirementId,
          name: group.name,
          requirementType: group.requirementType,
          minCourses: group.minCourses,
          minCredits: group.minCredits,
          description: group.description
        }))
      )
      .returning();

    for (const group of insertedGroups) {
      groupIdByRequirement.set(group.sourceRequirementId, group.id);
    }
  }

  if (normalized.courses.length > 0) {
    await db.insert(programPlanCourses).values(
      normalized.courses.map((course) => ({
        programPlanId,
        groupId: course.sourceRequirementId ? groupIdByRequirement.get(course.sourceRequirementId) ?? null : null,
        sourceRequirementId: course.sourceRequirementId,
        code: course.code,
        name: course.name,
        credits: course.credits,
        category: course.category,
        subcategory: course.subcategory,
        suggestedTerm: course.suggestedTerm,
        requirementType: course.requirementType
      }))
    );
  }

  return { groupCount: normalized.groups.length, courseCount: normalized.courses.length };
}
