import { integer, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

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

export const plazaPosts = pgTable("plaza_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorUserId: uuid("author_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  college: varchar("college", { length: 120 }).notNull(),
  contact: varchar("contact", { length: 200 }).notNull(),
  description: text("description").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  status: varchar("status", { length: 32 }).notNull().default("open"),
  offeredCourse: varchar("offered_course", { length: 160 }),
  wantedCourse: varchar("wanted_course", { length: 160 }),
  courseTime: varchar("course_time", { length: 160 }),
  teamPurpose: varchar("team_purpose", { length: 160 }),
  projectType: varchar("project_type", { length: 120 }),
  teammateRequirements: text("teammate_requirements"),
  currentMembers: integer("current_members"),
  targetMembers: integer("target_members"),
  activityTime: varchar("activity_time", { length: 160 }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
