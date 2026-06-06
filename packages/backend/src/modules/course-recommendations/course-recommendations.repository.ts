import { and, eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import { courseRecommendations, semesterCourses } from "../../db/schema.js";
import type {
  CourseConflictDto,
  RecommendationResultDto,
  ScheduleSlot,
  SemesterCourseDto
} from "./course-recommendations.types.js";

export interface SemesterCourseInput {
  term: string;
  courseCode?: string | null;
  courseName: string;
  credits: number;
  teacher?: string | null;
  classroom?: string | null;
  schedule: ScheduleSlot[];
  category?: string | null;
  source?: string;
  selected?: boolean;
}

export interface SemesterCourseUpdateInput {
  term?: string;
  courseCode?: string | null;
  courseName?: string;
  credits?: number;
  teacher?: string | null;
  classroom?: string | null;
  schedule?: ScheduleSlot[];
  category?: string | null;
  source?: string;
  selected?: boolean;
}

export interface CourseRecommendationRepository {
  listSemesterCourses(userId: string, term: string): Promise<SemesterCourseDto[]>;
  createSemesterCourse(userId: string, input: SemesterCourseInput): Promise<SemesterCourseDto>;
  updateSemesterCourse(
    userId: string,
    id: string,
    input: SemesterCourseUpdateInput
  ): Promise<SemesterCourseDto | null>;
  deleteSemesterCourse(userId: string, id: string): Promise<boolean>;
  batchCreateSemesterCourses(
    userId: string,
    term: string,
    courses: SemesterCourseInput[]
  ): Promise<SemesterCourseDto[]>;
  saveRecommendation(
    userId: string,
    term: string,
    preferences: Record<string, unknown>,
    result: {
      recommendedCourses: unknown[];
      totalCredits: number;
      summary: string;
      warnings: string[];
      conflicts: CourseConflictDto[];
    }
  ): Promise<RecommendationResultDto>;
  listRecommendations(userId: string, term: string): Promise<RecommendationResultDto[]>;
}

function toSemesterCourseDto(row: typeof semesterCourses.$inferSelect): SemesterCourseDto {
  return {
    id: row.id,
    userId: row.userId,
    term: row.term,
    courseCode: row.courseCode,
    courseName: row.courseName,
    credits: String(row.credits),
    teacher: row.teacher,
    classroom: row.classroom,
    schedule: (row.schedule ?? []) as ScheduleSlot[],
    category: row.category,
    source: row.source,
    selected: row.selected,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toRecommendationDto(row: typeof courseRecommendations.$inferSelect): RecommendationResultDto {
  return {
    id: row.id,
    userId: row.userId,
    term: row.term,
    preferences: row.preferences as Record<string, unknown>,
    recommendedCourses: (row.recommendedCourses ?? []) as unknown as RecommendationResultDto["recommendedCourses"],
    totalCredits: row.totalCredits ? String(row.totalCredits) : null,
    summary: row.summary,
    warnings: (row.warnings ?? []) as string[],
    conflicts: (row.conflicts ?? []) as CourseConflictDto[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function createCourseRecommendationRepository(db: Database): CourseRecommendationRepository {
  return {
    async listSemesterCourses(userId, term) {
      const rows = await db
        .select()
        .from(semesterCourses)
        .where(and(eq(semesterCourses.userId, userId), eq(semesterCourses.term, term)))
        .orderBy(semesterCourses.courseName);
      return rows.map(toSemesterCourseDto);
    },

    async createSemesterCourse(userId, input) {
      const [row] = await db
        .insert(semesterCourses)
        .values({
          userId,
          term: input.term,
          courseCode: input.courseCode ?? null,
          courseName: input.courseName,
          credits: String(input.credits),
          teacher: input.teacher ?? null,
          classroom: input.classroom ?? null,
          schedule: input.schedule,
          category: input.category ?? null,
          source: input.source ?? "manual",
          selected: input.selected ?? false
        })
        .returning();
      return toSemesterCourseDto(row);
    },

    async updateSemesterCourse(userId, id, input) {
      const [row] = await db
        .update(semesterCourses)
        .set({
          ...(input.term !== undefined ? { term: input.term } : {}),
          ...(input.courseCode !== undefined ? { courseCode: input.courseCode } : {}),
          ...(input.courseName !== undefined ? { courseName: input.courseName } : {}),
          ...(input.credits !== undefined ? { credits: String(input.credits) } : {}),
          ...(input.teacher !== undefined ? { teacher: input.teacher } : {}),
          ...(input.classroom !== undefined ? { classroom: input.classroom } : {}),
          ...(input.schedule !== undefined ? { schedule: input.schedule } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.selected !== undefined ? { selected: input.selected } : {}),
          updatedAt: new Date()
        })
        .where(and(eq(semesterCourses.userId, userId), eq(semesterCourses.id, id)))
        .returning();
      return row ? toSemesterCourseDto(row) : null;
    },

    async deleteSemesterCourse(userId, id) {
      const rows = await db
        .delete(semesterCourses)
        .where(and(eq(semesterCourses.userId, userId), eq(semesterCourses.id, id)))
        .returning({ id: semesterCourses.id });
      return rows.length > 0;
    },

    async batchCreateSemesterCourses(userId, term, courses) {
      if (courses.length === 0) return [];
      const values = courses.map((c) => ({
        userId,
        term,
        courseCode: c.courseCode ?? null,
        courseName: c.courseName,
        credits: String(c.credits),
        teacher: c.teacher ?? null,
        classroom: c.classroom ?? null,
        schedule: c.schedule,
        category: c.category ?? null,
        source: c.source ?? "manual",
        selected: c.selected ?? false
      }));
      const rows = await db.insert(semesterCourses).values(values).returning();
      return rows.map(toSemesterCourseDto);
    },

    async saveRecommendation(userId, term, preferences, result) {
      const [row] = await db
        .insert(courseRecommendations)
        .values({
          userId,
          term,
          preferences,
          recommendedCourses: result.recommendedCourses as Record<string, unknown>[],
          totalCredits: String(result.totalCredits),
          summary: result.summary,
          warnings: result.warnings,
          conflicts: result.conflicts as CourseConflictDto[]
        })
        .returning();
      return toRecommendationDto(row);
    },

    async listRecommendations(userId, term) {
      const rows = await db
        .select()
        .from(courseRecommendations)
        .where(and(eq(courseRecommendations.userId, userId), eq(courseRecommendations.term, term)))
        .orderBy(courseRecommendations.createdAt);
      return rows.map(toRecommendationDto);
    }
  };
}
