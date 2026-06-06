import { and, eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { gpaCalculationResults, gpaCourses } from "../../db/schema.js";
import type { GpaCalculationResult, GpaCourse, GpaCourseInput, PersistedGpaCalculationResult } from "./gpa.types.js";

export interface GpaRepository {
  listCourses(userId: string): Promise<GpaCourse[]>;
  findCourse(userId: string, courseId: string): Promise<GpaCourse | null>;
  createCourse(userId: string, input: GpaCourseInput): Promise<GpaCourse>;
  updateCourse(userId: string, courseId: string, input: GpaCourseInput): Promise<GpaCourse | null>;
  deleteCourse(userId: string, courseId: string): Promise<boolean>;
  getLatestResult(userId: string): Promise<PersistedGpaCalculationResult | null>;
  upsertLatestResult(userId: string, result: GpaCalculationResult): Promise<PersistedGpaCalculationResult>;
}

export function createGpaRepository(db: Database): GpaRepository {
  return {
    async listCourses(userId) {
      return db.select().from(gpaCourses).where(eq(gpaCourses.userId, userId));
    },
    async findCourse(userId, courseId) {
      const [course] = await db
        .select()
        .from(gpaCourses)
        .where(and(eq(gpaCourses.userId, userId), eq(gpaCourses.id, courseId)))
        .limit(1);
      return course ?? null;
    },
    async createCourse(userId, input) {
      const [course] = await db.insert(gpaCourses).values({ userId, ...input }).returning();
      return course;
    },
    async updateCourse(userId, courseId, input) {
      const [course] = await db
        .update(gpaCourses)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(gpaCourses.userId, userId), eq(gpaCourses.id, courseId)))
        .returning();
      return course ?? null;
    },
    async deleteCourse(userId, courseId) {
      const deleted = await db
        .delete(gpaCourses)
        .where(and(eq(gpaCourses.userId, userId), eq(gpaCourses.id, courseId)))
        .returning({ id: gpaCourses.id });
      return deleted.length > 0;
    },
    async getLatestResult(userId) {
      const [result] = await db
        .select()
        .from(gpaCalculationResults)
        .where(eq(gpaCalculationResults.userId, userId))
        .limit(1);
      return result ?? null;
    },
    async upsertLatestResult(userId, result) {
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
  };
}
