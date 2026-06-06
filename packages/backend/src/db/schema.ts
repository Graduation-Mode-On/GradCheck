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
  studentId: varchar("student_id", { length: 9 }).unique(),
  pushplusToken: varchar("pushplus_token", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const customRequirements = pgTable("custom_requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  kind: varchar("kind", { length: 32 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  targetValue: numeric("target_value", { precision: 8, scale: 2 }).notNull(),
  currentValue: numeric("current_value", { precision: 8, scale: 2 }).notNull().default("0"),
  unit: varchar("unit", { length: 24 }).notNull(),
  importance: varchar("importance", { length: 32 }).notNull(),
  source: varchar("source", { length: 32 }).notNull(),
  includeInProgress: boolean("include_in_progress").notNull().default(true),
  showOnHome: boolean("show_on_home").notNull().default(true),
  deadline: varchar("deadline", { length: 10 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const reminders = pgTable("reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  priority: varchar("priority", { length: 32 }).notNull().default("normal"),
  startAt: timestamp("start_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  location: varchar("location", { length: 200 }),
  notes: text("notes"),
  sourceType: varchar("source_type", { length: 32 }).notNull().default("custom"),
  sourceId: uuid("source_id"),
  reminderOffsets: jsonb("reminder_offsets").$type<number[]>().notNull().default([1440, 60]),
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  showOnHome: boolean("show_on_home").notNull().default(true),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const labExamEvents = pgTable("lab_exam_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reminderId: uuid("reminder_id")
    .notNull()
    .references(() => reminders.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  courseName: varchar("course_name", { length: 160 }),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }),
  location: varchar("location", { length: 200 }),
  teacher: varchar("teacher", { length: 120 }),
  seatOrGroup: varchar("seat_or_group", { length: 120 }),
  notes: text("notes"),
  status: varchar("status", { length: 32 }).notNull().default("scheduled"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const reminderDeliveryLogs = pgTable("reminder_delivery_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  reminderId: uuid("reminder_id")
    .notNull()
    .references(() => reminders.id, { onDelete: "cascade" }),
  channel: varchar("channel", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  providerMessageId: varchar("provider_message_id", { length: 160 }),
  errorMessage: text("error_message"),
  attemptCount: integer("attempt_count").notNull().default(0),
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

export const newsItems = pgTable("news_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  organizer: varchar("organizer", { length: 200 }),
  location: varchar("location", { length: 200 }),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  registrationUrl: text("registration_url"),
  targetAudience: varchar("target_audience", { length: 200 }),
  creditCategory: varchar("credit_category", { length: 100 }),
  description: text("description"),
  sourceUrl: text("source_url"),
  sourceName: varchar("source_name", { length: 100 }),
  dataQuality: varchar("data_quality", { length: 20 }).notNull().default("complete"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const lecturePracticeProgress = pgTable("lecture_practice_progress", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  humanLectureCount: integer("human_lecture_count").notNull().default(0),
  bookReportCount: integer("book_report_count").notNull().default(0),
  socialPracticeCredits: numeric("social_practice_credits", { precision: 5, scale: 2 }).notNull().default("0.00"),
  socialPracticeCourseCount: integer("social_practice_course_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const volunteerLaborProgress = pgTable("volunteer_labor_progress", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  volunteerHours: numeric("volunteer_hours", { precision: 6, scale: 2 }).notNull().default("0.00"),
  ordinaryLaborCount: integer("ordinary_labor_count").notNull().default(0),
  specialLaborCount: integer("special_labor_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const sportsProgress = pgTable("sports_progress", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  currentRuns: integer("current_runs").notNull().default(0),
  targetRuns: integer("target_runs").notNull().default(45),
  lastRunDate: varchar("last_run_date", { length: 10 }),
  runDates: jsonb("run_dates").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const srtpRecords = pgTable("srtp_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  credits: numeric("credits", { precision: 5, scale: 2 }).notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
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

export const programPlans = pgTable("program_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceFilename: varchar("source_filename", { length: 240 }).notNull(),
  school: varchar("school", { length: 120 }).notNull(),
  college: varchar("college", { length: 120 }),
  major: varchar("major", { length: 120 }).notNull(),
  grade: varchar("grade", { length: 40 }),
  totalCredits: numeric("total_credits", { precision: 6, scale: 2 }),
  courseCount: integer("course_count").notNull(),
  requirementCount: integer("requirement_count").notNull(),
  warningCount: integer("warning_count").notNull(),
  planJson: jsonb("plan_json").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const programPlanCourseGroups = pgTable("program_plan_course_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  programPlanId: uuid("program_plan_id")
    .notNull()
    .references(() => programPlans.id, { onDelete: "cascade" }),
  sourceRequirementId: varchar("source_requirement_id", { length: 160 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  requirementType: varchar("requirement_type", { length: 40 }).notNull(),
  minCourses: numeric("min_courses", { precision: 6, scale: 2 }),
  minCredits: numeric("min_credits", { precision: 6, scale: 2 }),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const programPlanCourses = pgTable("program_plan_courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  programPlanId: uuid("program_plan_id")
    .notNull()
    .references(() => programPlans.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => programPlanCourseGroups.id, { onDelete: "set null" }),
  sourceRequirementId: varchar("source_requirement_id", { length: 160 }),
  code: varchar("code", { length: 80 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  credits: numeric("credits", { precision: 5, scale: 2 }).notNull(),
  category: varchar("category", { length: 120 }),
  subcategory: varchar("subcategory", { length: 120 }),
  suggestedTerm: varchar("suggested_term", { length: 40 }),
  requirementType: varchar("requirement_type", { length: 40 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const userCoursePlanMatches = pgTable("user_course_plan_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gpaCourseId: uuid("gpa_course_id")
    .notNull()
    .references(() => gpaCourses.id, { onDelete: "cascade" }),
  programPlanCourseId: uuid("program_plan_course_id").references(() => programPlanCourses.id, { onDelete: "cascade" }),
  programPlanCourseGroupId: uuid("program_plan_course_group_id").references(() => programPlanCourseGroups.id, {
    onDelete: "cascade"
  }),
  matchTargetType: varchar("match_target_type", { length: 20 }).notNull().default("course"),
  matchMethod: varchar("match_method", { length: 40 }).notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 2 }).notNull(),
  confirmedByUser: boolean("confirmed_by_user").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const userProgramPlanBindings = pgTable("user_program_plan_bindings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  programPlanId: uuid("program_plan_id")
    .notNull()
    .references(() => programPlans.id, { onDelete: "cascade" }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const userIgnoredProgramPlanGroups = pgTable("user_ignored_program_plan_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  programPlanCourseGroupId: uuid("program_plan_course_group_id")
    .notNull()
    .references(() => programPlanCourseGroups.id, { onDelete: "cascade" }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
