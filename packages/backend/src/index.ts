import { createDb } from "./db/client.js";
import { loadConfig } from "./lib/config.js";
import { createApp } from "./app.js";
import { createAuthRepository } from "./modules/auth/auth.repository.js";
import { createGpaRepository } from "./modules/gpa/gpa.repository.js";
import { createLecturePracticeRepository } from "./modules/lecture-practice/lecture-practice.repository.js";
import { createNewsRepository } from "./modules/news/news.repository.js";
import { createPlazaRepository } from "./modules/plaza/plaza.repository.js";
import { createProgramPlanRepository } from "./modules/program-plans/program-plans.repository.js";
import { createSrtpRepository } from "./modules/srtp/srtp.repository.js";
import { createSportsRepository } from "./modules/sports/sports.repository.js";
import { createVolunteerLaborRepository } from "./modules/volunteer-labor/volunteer-labor.repository.js";
import { createCustomRequirementRepository } from "./modules/custom-requirements/custom-requirement.repository.js";
import { createCourseRecommendationRepository } from "./modules/course-recommendations/course-recommendations.repository.js";
import { createCoursesProgressRepository } from "./modules/courses-progress/courses-progress.repository.js";
import { createLabExamEventRepository } from "./modules/lab-exam-events/lab-exam-events.repository.js";
import { createReminderRepository } from "./modules/reminders/reminders.repository.js";
import { PushPlusAdapter } from "./modules/reminders/pushplus-adapter.js";
import { createPushplusTokenResolver } from "./modules/reminders/pushplus-token-resolver.js";
import { startReminderScheduler } from "./modules/reminders/start-reminder-scheduler.js";

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const reminderRepository = createReminderRepository(db);
const app = createApp({
  authRepository: createAuthRepository(db),
  plazaRepository: createPlazaRepository(db),
  newsRepository: createNewsRepository(db),
  srtpRepository: createSrtpRepository(db),
  sportsRepository: createSportsRepository(db),
  programPlanRepository: createProgramPlanRepository(db),
  lecturePracticeRepository: createLecturePracticeRepository(db),
  volunteerLaborRepository: createVolunteerLaborRepository(db),
  customRequirementRepository: createCustomRequirementRepository(db),
  gpaRepository: createGpaRepository(db),
  courseRecommendationRepository: createCourseRecommendationRepository(db),
  coursesProgressRepository: createCoursesProgressRepository(db),
  reminderRepository,
  labExamEvents: {
    db,
    createLabExamEventRepository,
    createReminderRepository
  },
  mcp: {
    authRepository: createAuthRepository(db),
    reminderRepository,
    coursesProgressRepository: createCoursesProgressRepository(db),
    gpaRepository: createGpaRepository(db),
    programPlanRepository: createProgramPlanRepository(db),
    customRequirementRepository: createCustomRequirementRepository(db),
    homeSummaryDependencies: {
      coursesProgressRepository: createCoursesProgressRepository(db),
      gpaRepository: createGpaRepository(db),
      lecturePracticeRepository: createLecturePracticeRepository(db),
      volunteerLaborRepository: createVolunteerLaborRepository(db),
      srtpRepository: createSrtpRepository(db),
      customRequirementRepository: createCustomRequirementRepository(db)
    },
    labExamEvents: {
      db,
      createLabExamEventRepository,
      createReminderRepository
    },
    rateLimitPerMinute: config.MCP_RATE_LIMIT_PER_MINUTE
  },
  corsOrigin: config.CORS_ORIGIN,
  amapWeatherKey: config.AMAP_WEATHER_KEY
});

const scheduler = startReminderScheduler({
  repository: reminderRepository,
  smsAdapter: new PushPlusAdapter({ publicBaseUrl: config.REMINDER_PUBLIC_BASE_URL }),
  tokenResolver: createPushplusTokenResolver(db),
  intervalMs: config.REMINDER_SCHEDULER_INTERVAL_MS,
  enabled: config.REMINDER_SCHEDULER_ENABLED
});

const server = app.listen(config.PORT, () => {
  console.log(`GradCheck backend listening on port ${config.PORT}`);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down…`);
  scheduler.stop();
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
