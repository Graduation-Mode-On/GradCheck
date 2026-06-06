import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import {
  gpaCalculationResults,
  gpaCourses,
  programPlanCourseGroups,
  programPlanCourses,
  userCoursePlanMatches,
  userProgramPlanBindings
} from "../../db/schema.js";
import { calculateGpaResult } from "./gpa.calculator.js";
import { isTranscriptArtifactName, matchGpaCourseToPlanRequirement } from "./course-plan-matcher.js";
import type { GpaCalculationResult, GpaCourse, GpaCourseInput, PersistedGpaCalculationResult } from "./gpa.types.js";

export interface GpaDashboard {
  courses: GpaCourse[];
  result: GpaCalculationResult;
}

export interface GpaRepository {
  listCourses(userId: string): Promise<GpaCourse[]>;
  listUserIdsWithGpaCourses(): Promise<string[]>;
  createCourseAndRecalculate(userId: string, input: GpaCourseInput): Promise<GpaDashboard>;
  createCoursesAndRecalculate(userId: string, input: GpaCourseInput[]): Promise<GpaDashboard>;
  matchCoursesToProgramPlan(userId: string): Promise<GpaDashboard & { matchedCount: number }>;
  listCourseMatches(userId: string): Promise<{
    items: Array<{
      course: GpaCourse;
      match: Record<string, unknown> | null;
      candidates: { courses: unknown[]; groups: unknown[] };
    }>;
  }>;
  upsertManualCourseMatch(
    userId: string,
    gpaCourseId: string,
    input: { matchTargetType: "course" | "group"; programPlanCourseId?: string; programPlanCourseGroupId?: string }
  ): Promise<{ match: Record<string, unknown>; dashboard: GpaDashboard } | null>;
  deleteCourseMatch(userId: string, gpaCourseId: string): Promise<{ dashboard: GpaDashboard } | null>;
  cleanupTranscriptArtifactsAndRecalculate(userId: string): Promise<GpaDashboard & { deletedCount: number }>;
  updateCourseAndRecalculate(userId: string, courseId: string, input: GpaCourseInput): Promise<GpaDashboard | null>;
  deleteCourseAndRecalculate(userId: string, courseId: string): Promise<GpaDashboard | null>;
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type GpaDatabase = Database | Transaction;

async function listCourses(db: GpaDatabase, userId: string): Promise<GpaCourse[]> {
  return db.select().from(gpaCourses).where(eq(gpaCourses.userId, userId));
}

async function upsertLatestResult(
  db: GpaDatabase,
  userId: string,
  result: GpaCalculationResult
): Promise<PersistedGpaCalculationResult> {
  const [persisted] = await db
    .insert(gpaCalculationResults)
    .values({ userId, ...result })
    .onConflictDoUpdate({
      target: gpaCalculationResults.userId,
      set: { ...result, updatedAt: new Date() }
    })
    .returning();
  return persisted;
}

async function recalculateAndPersist(db: GpaDatabase, userId: string): Promise<GpaDashboard> {
  const courses = await listCourses(db, userId);
  const result = calculateGpaResult(courses);
  await upsertLatestResult(db, userId, result);
  return { courses, result };
}

async function lockUserGpa(tx: Transaction, userId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
}

export function createGpaRepository(db: Database): GpaRepository {
  return {
    async listCourses(userId) {
      return listCourses(db, userId);
    },
    async listUserIdsWithGpaCourses() {
      const rows = await db.selectDistinct({ userId: gpaCourses.userId }).from(gpaCourses);
      return rows.map((row) => row.userId);
    },
    async createCourseAndRecalculate(userId, input) {
      return db.transaction(async (tx) => {
        await lockUserGpa(tx, userId);
        await tx.insert(gpaCourses).values({ userId, ...input });
        return recalculateAndPersist(tx, userId);
      });
    },
    async createCoursesAndRecalculate(userId, input) {
      return db.transaction(async (tx) => {
        await lockUserGpa(tx, userId);
        if (input.length > 0) {
          await tx.insert(gpaCourses).values(input.map((course) => ({ userId, ...course })));
        }
        return recalculateAndPersist(tx, userId);
      });
    },
    async matchCoursesToProgramPlan(userId) {
      return db.transaction(async (tx) => {
        await lockUserGpa(tx, userId);
        const courses = await listCourses(tx, userId);
        const [binding] = await tx
          .select()
          .from(userProgramPlanBindings)
          .where(eq(userProgramPlanBindings.userId, userId))
          .limit(1);
        if (!binding) {
          return { ...(await recalculateAndPersist(tx, userId)), matchedCount: 0 };
        }

        const planCourses = await tx
          .select()
          .from(programPlanCourses)
          .where(eq(programPlanCourses.programPlanId, binding.programPlanId));
        const planGroups = await tx
          .select()
          .from(programPlanCourseGroups)
          .where(eq(programPlanCourseGroups.programPlanId, binding.programPlanId));
        let matchedCount = 0;

        await tx.delete(userCoursePlanMatches).where(eq(userCoursePlanMatches.userId, userId));

        for (const course of courses) {
          const match = matchGpaCourseToPlanRequirement(course, { courses: planCourses, groups: planGroups });
          if (!match) {
            continue;
          }

          const matchedPlanCourse = planCourses.find((planCourse) => planCourse.id === match.programPlanCourseId);
          await tx.insert(userCoursePlanMatches).values({
            userId,
            gpaCourseId: course.id,
            programPlanCourseId: match.programPlanCourseId,
            programPlanCourseGroupId: match.programPlanCourseGroupId,
            matchTargetType: match.matchTargetType,
            matchMethod: match.matchMethod,
            confidence: match.confidence,
            confirmedByUser: match.confirmedByUser
          });
          matchedCount += 1;

          const matchedGroup = planGroups.find((group) => group.id === match.programPlanCourseGroupId);
          const matchedRequirementType = matchedPlanCourse?.requirementType ?? matchedGroup?.requirementType;
          if (matchedRequirementType === "required" && !course.isRequired) {
            await tx.update(gpaCourses).set({ isRequired: true, updatedAt: new Date() }).where(eq(gpaCourses.id, course.id));
          }
        }

        return { ...(await recalculateAndPersist(tx, userId)), matchedCount };
      });
    },
    async listCourseMatches(userId) {
      const courses = await listCourses(db, userId);
      const [binding] = await db
        .select()
        .from(userProgramPlanBindings)
        .where(eq(userProgramPlanBindings.userId, userId))
        .limit(1);
      const planCourses = binding
        ? await db.select().from(programPlanCourses).where(eq(programPlanCourses.programPlanId, binding.programPlanId))
        : [];
      const planGroups = binding
        ? await db.select().from(programPlanCourseGroups).where(eq(programPlanCourseGroups.programPlanId, binding.programPlanId))
        : [];
      const matches = await db.select().from(userCoursePlanMatches).where(eq(userCoursePlanMatches.userId, userId));
      const matchByCourseId = new Map(matches.map((match) => [match.gpaCourseId, match]));

      return {
        items: courses.map((course) => ({
          course,
          match: matchByCourseId.get(course.id) ?? null,
          candidates: { courses: planCourses, groups: planGroups }
        }))
      };
    },
    async upsertManualCourseMatch(userId, gpaCourseId, input) {
      return db.transaction(async (tx) => {
        await lockUserGpa(tx, userId);
        const [course] = await tx
          .select()
          .from(gpaCourses)
          .where(and(eq(gpaCourses.id, gpaCourseId), eq(gpaCourses.userId, userId)))
          .limit(1);
        if (!course) return null;

        await tx.delete(userCoursePlanMatches).where(and(eq(userCoursePlanMatches.userId, userId), eq(userCoursePlanMatches.gpaCourseId, gpaCourseId)));
        const [planCourse] = input.programPlanCourseId
          ? await tx.select().from(programPlanCourses).where(eq(programPlanCourses.id, input.programPlanCourseId)).limit(1)
          : [];
        const [planGroup] = input.programPlanCourseGroupId
          ? await tx.select().from(programPlanCourseGroups).where(eq(programPlanCourseGroups.id, input.programPlanCourseGroupId)).limit(1)
          : [];
        const requirementType = planCourse?.requirementType ?? planGroup?.requirementType ?? "unknown";
        const [match] = await tx
          .insert(userCoursePlanMatches)
          .values({
            userId,
            gpaCourseId,
            programPlanCourseId: input.matchTargetType === "course" ? input.programPlanCourseId : null,
            programPlanCourseGroupId: input.matchTargetType === "group" ? input.programPlanCourseGroupId : null,
            matchTargetType: input.matchTargetType,
            matchMethod: "manual",
            confidence: "1.00",
            confirmedByUser: true
          })
          .returning();
        await tx.update(gpaCourses).set({ isRequired: requirementType === "required", updatedAt: new Date() }).where(eq(gpaCourses.id, gpaCourseId));
        return { match: { ...match, requirementType }, dashboard: await recalculateAndPersist(tx, userId) };
      });
    },
    async deleteCourseMatch(userId, gpaCourseId) {
      return db.transaction(async (tx) => {
        await lockUserGpa(tx, userId);
        const [course] = await tx
          .select()
          .from(gpaCourses)
          .where(and(eq(gpaCourses.id, gpaCourseId), eq(gpaCourses.userId, userId)))
          .limit(1);
        if (!course) return null;
        await tx.delete(userCoursePlanMatches).where(and(eq(userCoursePlanMatches.userId, userId), eq(userCoursePlanMatches.gpaCourseId, gpaCourseId)));
        await tx.update(gpaCourses).set({ isRequired: false, updatedAt: new Date() }).where(eq(gpaCourses.id, gpaCourseId));
        return { dashboard: await recalculateAndPersist(tx, userId) };
      });
    },
    async cleanupTranscriptArtifactsAndRecalculate(userId) {
      return db.transaction(async (tx) => {
        await lockUserGpa(tx, userId);
        const courses = await listCourses(tx, userId);
        const artifactIds = courses.filter((course) => isTranscriptArtifactName(course.name)).map((course) => course.id);
        if (artifactIds.length === 0) {
          return { ...(await recalculateAndPersist(tx, userId)), deletedCount: 0 };
        }
        for (const id of artifactIds) {
          await tx.delete(gpaCourses).where(eq(gpaCourses.id, id));
        }
        return { ...(await recalculateAndPersist(tx, userId)), deletedCount: artifactIds.length };
      });
    },
    async updateCourseAndRecalculate(userId, courseId, input) {
      return db.transaction(async (tx) => {
        await lockUserGpa(tx, userId);
        const [course] = await tx
          .update(gpaCourses)
          .set({ ...input, updatedAt: new Date() })
          .where(and(eq(gpaCourses.userId, userId), eq(gpaCourses.id, courseId)))
          .returning();
        if (!course) {
          return null;
        }

        return recalculateAndPersist(tx, userId);
      });
    },
    async deleteCourseAndRecalculate(userId, courseId) {
      return db.transaction(async (tx) => {
        await lockUserGpa(tx, userId);
        const deleted = await tx
          .delete(gpaCourses)
          .where(and(eq(gpaCourses.userId, userId), eq(gpaCourses.id, courseId)))
          .returning({ id: gpaCourses.id });
        if (deleted.length === 0) {
          return null;
        }

        return recalculateAndPersist(tx, userId);
      });
    }
  };
}
