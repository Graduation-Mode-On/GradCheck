import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 80 }).notNull(),
  college: varchar("college", { length: 120 }).notNull(),
  major: varchar("major", { length: 120 }).notNull(),
  grade: integer("grade").notNull(),
  gpaGoal: numeric("gpa_goal", { precision: 3, scale: 2 }).notNull().default("2.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 120 }).notNull(),
  entityId: varchar("entity_id", { length: 120 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const gpaCourses = pgTable("gpa_courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  term: varchar("term", { length: 20 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  credit: numeric("credit", { precision: 5, scale: 2 }).notNull(),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  isRequired: boolean("is_required").notNull().default(false),
  isFirstAttempt: boolean("is_first_attempt").notNull().default(true),
  isGpaEligible: boolean("is_gpa_eligible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const gpaCalculationResults = pgTable("gpa_calculation_results", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  requiredFirstAttempt: jsonb("required_first_attempt")
    .$type<{
      weightedGpa: number | null;
      weightedAverageScore: number | null;
      totalCredits: number;
      courseCount: number;
    }>()
    .notNull(),
  overall: jsonb("overall")
    .$type<{
      weightedGpa: number | null;
      weightedAverageScore: number | null;
      totalCredits: number;
      courseCount: number;
    }>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
