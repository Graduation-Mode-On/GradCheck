import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { gpaCalculationResults, gpaCourses } from "../../db/schema.js";
import { calculateGpaResult } from "./gpa.calculator.js";
import type { GpaCalculationResult, GpaCourse, GpaCourseInput, PersistedGpaCalculationResult } from "./gpa.types.js";

export interface GpaDashboard {
  courses: GpaCourse[];
  result: GpaCalculationResult;
}

export interface GpaRepository {
  listCourses(userId: string): Promise<GpaCourse[]>;
  createCourseAndRecalculate(userId: string, input: GpaCourseInput): Promise<GpaDashboard>;
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
    async createCourseAndRecalculate(userId, input) {
      return db.transaction(async (tx) => {
        await lockUserGpa(tx, userId);
        await tx.insert(gpaCourses).values({ userId, ...input });
        return recalculateAndPersist(tx, userId);
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
