/**
 * Seed script: insert mock semester course schedule data.
 *
 * Run with:
 *   pnpm --filter @gradcheck/backend exec tsx scripts/seed-semester-courses.ts [user-email|--all]
 *
 * If no email is provided, uses the first user in the database.
 */

import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

import { createDb } from "../src/db/client.js";
import { semesterCourses, users } from "../src/db/schema.js";

config({ path: "../../.env" });
config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const TERM = "2025-2026 春";

interface ScheduleSlot {
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  startWeek: number;
  endWeek: number;
  weekLabel: string;
}

interface MockCourse {
  courseName: string;
  courseCode: null;
  credits: number;
  teacher: null;
  classroom: null;
  schedule: ScheduleSlot[];
  category: string;
}

function slot(
  weekLabel: string,
  startWeek: number,
  endWeek: number,
  dayOfWeek: number,
  startPeriod: number,
  endPeriod: number
): ScheduleSlot {
  return { weekLabel, startWeek, endWeek, dayOfWeek, startPeriod, endPeriod };
}

const COURSES: MockCourse[] = [
  {
    courseName: "计算机网络专题实践",
    courseCode: null,
    credits: 2,
    teacher: null,
    classroom: null,
    category: "实践",
    schedule: [
      slot("9-16周", 9, 16, 1, 2, 5),
      slot("第11周", 11, 11, 5, 11, 12),
      slot("1-10周", 1, 10, 5, 11, 13)
    ]
  },
  {
    courseName: "软件智能化方法（研讨）",
    courseCode: null,
    credits: 3,
    teacher: null,
    classroom: null,
    category: "研讨",
    schedule: [
      slot("1-8周", 1, 8, 1, 11, 13),
      slot("1-8周", 1, 8, 3, 3, 5),
      slot("9-16周", 9, 16, 4, 6, 11)
    ]
  },
  {
    courseName: "就业导论",
    courseCode: null,
    credits: 1,
    teacher: null,
    classroom: null,
    category: "通识",
    schedule: [slot("1-8周", 1, 8, 2, 1, 2)]
  },
  {
    courseName: "通信原理（跨学科选课）",
    courseCode: null,
    credits: 3,
    teacher: null,
    classroom: null,
    category: "选修",
    schedule: [slot("1-16周", 1, 16, 2, 3, 4)]
  },
  {
    courseName: "强化学习",
    courseCode: null,
    credits: 3,
    teacher: null,
    classroom: null,
    category: "选修",
    schedule: [slot("1-16周", 1, 16, 2, 6, 7)]
  },
  {
    courseName: "移动互联网导论（研讨）",
    courseCode: null,
    credits: 3,
    teacher: null,
    classroom: null,
    category: "研讨",
    schedule: [slot("1-16周", 1, 16, 2, 7, 10)]
  },
  {
    courseName: "分布式系统（全英文、研讨）",
    courseCode: null,
    credits: 3,
    teacher: null,
    classroom: null,
    category: "研讨",
    schedule: [
      slot("1-12周", 1, 12, 2, 8, 10),
      slot("13-14周", 13, 14, 2, 8, 9)
    ]
  },
  {
    courseName: "网络与信息安全（全英文、研讨）",
    courseCode: null,
    credits: 3,
    teacher: null,
    classroom: null,
    category: "必修",
    schedule: [
      slot("12-14周", 12, 14, 3, 3, 5),
      slot("12-14周", 12, 14, 4, 3, 5),
      slot("12-14周", 12, 14, 5, 2, 5),
      slot("第11周", 11, 11, 6, 6, 8),
      slot("第11周", 11, 11, 7, 6, 8),
      slot("第10周", 10, 10, 7, 6, 9)
    ]
  },
  {
    courseName: "软件质量保障",
    courseCode: null,
    credits: 2,
    teacher: null,
    classroom: null,
    category: "选修",
    schedule: [slot("1-2周", 1, 2, 3, 6, 8)]
  },
  {
    courseName: "编译原理专题实践",
    courseCode: null,
    credits: 2,
    teacher: null,
    classroom: null,
    category: "实践",
    schedule: [
      slot("1-2周", 1, 2, 4, 6, 8),
      slot("第3周", 3, 3, 4, 6, 7),
      slot("10-12周", 10, 12, 7, 2, 9)
    ]
  },
  {
    courseName: "机器视觉与应用",
    courseCode: null,
    credits: 3,
    teacher: null,
    classroom: null,
    category: "选修",
    schedule: [slot("1-16周", 1, 16, 5, 3, 4)]
  },
  {
    courseName: "实用数据库系统实践（校企）",
    courseCode: null,
    credits: 3,
    teacher: null,
    classroom: null,
    category: "实践",
    schedule: [slot("9-16周", 9, 16, 5, 6, 9)]
  },
  {
    courseName: "网络与信息安全（研讨）",
    courseCode: null,
    credits: 3,
    teacher: null,
    classroom: null,
    category: "研讨",
    schedule: [slot("9-16周", 9, 16, 5, 6, 8)]
  },
  {
    courseName: "领导力素养（校企）",
    courseCode: null,
    credits: 1,
    teacher: null,
    classroom: null,
    category: "通识",
    schedule: [slot("1-8周", 1, 8, 5, 8, 9)]
  },
  {
    courseName: "IT新技术讲座（校企）",
    courseCode: null,
    credits: 1,
    teacher: null,
    classroom: null,
    category: "讲座",
    schedule: [slot("1-16周", 1, 16, 7, 5, 5)]
  }
];

async function main() {
  const db = createDb(DATABASE_URL!);

  const targetArg = process.argv[2];
  let targetUsers: Array<{ id: string; email: string }>;

  if (targetArg === "--all") {
    targetUsers = await db.select({ id: users.id, email: users.email }).from(users);
    if (targetUsers.length === 0) {
      console.error("No users found in database");
      process.exit(1);
    }
    console.log(`Seeding all users: ${targetUsers.length}`);
  } else if (targetArg) {
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, targetArg))
      .limit(1);
    if (!user) {
      console.error(`User with email "${targetArg}" not found`);
      process.exit(1);
    }
    targetUsers = [user];
    console.log(`Found user: ${targetArg} -> ${user.id}`);
  } else {
    const [user] = await db.select({ id: users.id, email: users.email }).from(users).limit(1);
    if (!user) {
      console.error("No users found in database");
      process.exit(1);
    }
    targetUsers = [user];
    console.log(`Using first user: ${user.email} -> ${user.id}`);
  }

  let deletedCount = 0;
  let insertedCount = 0;

  for (const targetUser of targetUsers) {
    const deleted = await db
      .delete(semesterCourses)
      .where(and(eq(semesterCourses.userId, targetUser.id), eq(semesterCourses.term, TERM)))
      .returning({ id: semesterCourses.id });
    deletedCount += deleted.length;

    const values = COURSES.map((course) => ({
      userId: targetUser.id,
      term: TERM,
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: String(course.credits),
      teacher: course.teacher,
      classroom: course.classroom,
      schedule: course.schedule,
      category: course.category,
      source: "manual" as const,
      selected: true
    }));

    const inserted = await db.insert(semesterCourses).values(values).returning();
    insertedCount += inserted.length;
    console.log(`Seeded ${targetUser.email}: deleted ${deleted.length}, inserted ${inserted.length}`);
  }

  const totalCredits = COURSES.reduce((sum, course) => sum + course.credits, 0);
  const totalSlots = COURSES.reduce((sum, course) => sum + course.schedule.length, 0);
  console.log("\nSummary:");
  console.log(`  Target users: ${targetUsers.length}`);
  console.log(`  Deleted rows: ${deletedCount}`);
  console.log(`  Inserted rows: ${insertedCount}`);
  console.log(`  Total courses: ${COURSES.length}`);
  console.log(`  Total schedule slots: ${totalSlots}`);
  console.log(`  Total credits: ${totalCredits.toFixed(2)}`);
  console.log("  By category:");

  const byCategory = new Map<string, number>();
  for (const course of COURSES) {
    byCategory.set(course.category, (byCategory.get(course.category) ?? 0) + 1);
  }
  for (const [category, count] of byCategory) {
    console.log(`    ${category}: ${count}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
