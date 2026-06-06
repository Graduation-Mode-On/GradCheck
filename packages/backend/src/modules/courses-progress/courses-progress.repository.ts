import { and, eq } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import {
  gpaCourses,
  programPlanCourseGroups,
  programPlanCourses,
  programPlans,
  userCoursePlanMatches,
  userIgnoredProgramPlanGroups,
  userProgramPlanBindings
} from "../../db/schema.js";

export type PlanRow = typeof programPlans.$inferSelect;
export type PlanCourseRow = typeof programPlanCourses.$inferSelect;
export type PlanCourseGroupRow = typeof programPlanCourseGroups.$inferSelect;
export type GpaCourseRow = typeof gpaCourses.$inferSelect;
export type CourseMatchRow = typeof userCoursePlanMatches.$inferSelect;

export interface CoursesProgressData {
  plan: PlanRow | null;
  planCourses: PlanCourseRow[];
  planGroups: PlanCourseGroupRow[];
  gpaCourses: GpaCourseRow[];
  matches: CourseMatchRow[];
  ignoredGroupIds: string[];
}

export interface CoursesProgressRepository {
  loadProgressData(userId: string): Promise<CoursesProgressData>;
  ignoreGroup(userId: string, groupId: string): Promise<void>;
  unignoreGroup(userId: string, groupId: string): Promise<void>;
}

export function createCoursesProgressRepository(db: Database): CoursesProgressRepository {
  return {
    async loadProgressData(userId) {
      const [binding] = await db
        .select()
        .from(userProgramPlanBindings)
        .where(eq(userProgramPlanBindings.userId, userId))
        .limit(1);

      if (!binding) {
        const gpaRows = await db.select().from(gpaCourses).where(eq(gpaCourses.userId, userId));
        return {
          plan: null,
          planCourses: [],
          planGroups: [],
          gpaCourses: gpaRows,
          matches: [],
          ignoredGroupIds: []
        };
      }

      const [plan] = await db
        .select()
        .from(programPlans)
        .where(eq(programPlans.id, binding.programPlanId))
        .limit(1);

      const [planCoursesRows, planGroupsRows, gpaRows, matchRows, ignoredRows] = await Promise.all([
        db.select().from(programPlanCourses).where(eq(programPlanCourses.programPlanId, binding.programPlanId)),
        db.select().from(programPlanCourseGroups).where(eq(programPlanCourseGroups.programPlanId, binding.programPlanId)),
        db.select().from(gpaCourses).where(eq(gpaCourses.userId, userId)),
        db.select().from(userCoursePlanMatches).where(eq(userCoursePlanMatches.userId, userId)),
        db
          .select({ programPlanCourseGroupId: userIgnoredProgramPlanGroups.programPlanCourseGroupId })
          .from(userIgnoredProgramPlanGroups)
          .where(eq(userIgnoredProgramPlanGroups.userId, userId))
      ]);

      return {
        plan: plan ?? null,
        planCourses: planCoursesRows,
        planGroups: planGroupsRows,
        gpaCourses: gpaRows,
        matches: matchRows,
        ignoredGroupIds: ignoredRows.map((row) => row.programPlanCourseGroupId)
      };
    },
    async ignoreGroup(userId, groupId) {
      const existing = await db
        .select({ id: userIgnoredProgramPlanGroups.id })
        .from(userIgnoredProgramPlanGroups)
        .where(
          and(
            eq(userIgnoredProgramPlanGroups.userId, userId),
            eq(userIgnoredProgramPlanGroups.programPlanCourseGroupId, groupId)
          )
        )
        .limit(1);
      if (existing.length > 0) return;
      await db.insert(userIgnoredProgramPlanGroups).values({ userId, programPlanCourseGroupId: groupId });
    },
    async unignoreGroup(userId, groupId) {
      await db
        .delete(userIgnoredProgramPlanGroups)
        .where(
          and(
            eq(userIgnoredProgramPlanGroups.userId, userId),
            eq(userIgnoredProgramPlanGroups.programPlanCourseGroupId, groupId)
          )
        );
    }
  };
}
