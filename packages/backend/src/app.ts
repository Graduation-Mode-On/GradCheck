import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";

import type { Database } from "./db/client.js";
import { errorHandler } from "./middleware/error-handler.js";
import type { LecturePracticeRepository } from "./modules/lecture-practice/lecture-practice.repository.js";
import { createLecturePracticeRouter } from "./modules/lecture-practice/lecture-practice.routes.js";
import type { AuthRepository } from "./modules/auth/auth.repository.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import type { NewsRepository } from "./modules/news/news.repository.js";
import { createNewsRouter } from "./modules/news/news.routes.js";
import type { GpaRepository } from "./modules/gpa/gpa.repository.js";
import { createGpaRouter } from "./modules/gpa/gpa.routes.js";
import type { PlazaRepository } from "./modules/plaza/plaza.repository.js";
import { createPlazaRouter } from "./modules/plaza/plaza.routes.js";
import type { ProgramPlanRepository } from "./modules/program-plans/program-plans.repository.js";
import { createProgramPlansRouter } from "./modules/program-plans/program-plans.routes.js";
import { createProgramRulesRouter } from "./modules/program-rules/expressRouter.js";
import type { CoursesProgressRepository } from "./modules/courses-progress/courses-progress.repository.js";
import { createCoursesProgressRouter } from "./modules/courses-progress/courses-progress.routes.js";
import type { SrtpRepository } from "./modules/srtp/srtp.repository.js";
import { createSrtpRouter } from "./modules/srtp/srtp.routes.js";
import type { SportsRepository } from "./modules/sports/sports.repository.js";
import { createSportsRouter } from "./modules/sports/sports.routes.js";
import { createUserRouter } from "./modules/users/user.routes.js";
import type { VolunteerLaborRepository } from "./modules/volunteer-labor/volunteer-labor.repository.js";
import { createVolunteerLaborRouter } from "./modules/volunteer-labor/volunteer-labor.routes.js";
import { createWeatherRouter } from "./modules/weather/weather.routes.js";
import type { CustomRequirementRepository } from "./modules/custom-requirements/custom-requirement.repository.js";
import { createCustomRequirementRouter } from "./modules/custom-requirements/custom-requirement.routes.js";
import type { CourseRecommendationRepository } from "./modules/course-recommendations/course-recommendations.repository.js";
import { createCourseRecommendationsRouter } from "./modules/course-recommendations/course-recommendations.routes.js";
import { createHomeSummaryRouter } from "./modules/home-summary/home-summary.routes.js";
import type { LabExamEventsDatabase } from "./modules/lab-exam-events/lab-exam-events.repository.js";
import { createLabExamEventsRouter } from "./modules/lab-exam-events/lab-exam-events.routes.js";
import type { LabExamEventRepository } from "./modules/lab-exam-events/lab-exam-events.types.js";
import type { RemindersDatabase } from "./modules/reminders/reminders.repository.js";
import { createRemindersRouter } from "./modules/reminders/reminders.routes.js";
import type { ReminderRepository } from "./modules/reminders/reminders.types.js";
import { createMcpRouter } from "./modules/mcp/mcp.routes.js";
import type { McpDependencies } from "./modules/mcp/mcp.context.js";

export interface AppDependencies {
  authRepository: AuthRepository;
  plazaRepository: PlazaRepository;
  newsRepository: NewsRepository;
  lecturePracticeRepository: LecturePracticeRepository;
  volunteerLaborRepository: VolunteerLaborRepository;
  customRequirementRepository: CustomRequirementRepository;
  srtpRepository: SrtpRepository;
  sportsRepository: SportsRepository;
  programPlanRepository: ProgramPlanRepository;
  gpaRepository: GpaRepository;
  courseRecommendationRepository: CourseRecommendationRepository;
  coursesProgressRepository: CoursesProgressRepository;
  reminderRepository: ReminderRepository;
  labExamEvents: {
    db: Database;
    createLabExamEventRepository: (database: LabExamEventsDatabase) => LabExamEventRepository;
    createReminderRepository: (database: RemindersDatabase) => ReminderRepository;
  };
  corsOrigin?: string;
  amapWeatherKey?: string;
  staticDir?: string;
  mcp: McpDependencies;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();

  app.use(cors({ origin: dependencies.corsOrigin ?? true }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "gradcheck-backend" });
  });

  app.use("/api/auth", createAuthRouter(dependencies.authRepository));
  app.use("/api/users", createUserRouter(dependencies.authRepository));
  app.use("/api/gpa", createGpaRouter(dependencies.authRepository, dependencies.gpaRepository));
  app.use("/api/plaza/posts", createPlazaRouter(dependencies.authRepository, dependencies.plazaRepository));
  app.use("/api/news", createNewsRouter(dependencies.newsRepository));
  app.use("/api/srtp", createSrtpRouter(dependencies.authRepository, dependencies.srtpRepository));
  app.use("/api/sports", createSportsRouter(dependencies.authRepository, dependencies.sportsRepository));
  app.use("/api/program-plans", createProgramPlansRouter(dependencies.authRepository, dependencies.programPlanRepository));
  app.use(
    "/api/courses",
    createCoursesProgressRouter(dependencies.authRepository, dependencies.coursesProgressRepository)
  );
  app.use(
    "/api/lecture-practice",
    createLecturePracticeRouter(dependencies.authRepository, dependencies.lecturePracticeRepository)
  );
  app.use(
    "/api/volunteer-labor",
    createVolunteerLaborRouter(dependencies.authRepository, dependencies.volunteerLaborRepository)
  );
  app.use(
    "/api/custom-requirements",
    createCustomRequirementRouter({
      authRepository: dependencies.authRepository,
      customRequirementRepository: dependencies.customRequirementRepository
    })
  );
  app.use(
    "/api/home",
    createHomeSummaryRouter(dependencies.authRepository, {
      coursesProgressRepository: dependencies.coursesProgressRepository,
      gpaRepository: dependencies.gpaRepository,
      lecturePracticeRepository: dependencies.lecturePracticeRepository,
      volunteerLaborRepository: dependencies.volunteerLaborRepository,
      srtpRepository: dependencies.srtpRepository,
      customRequirementRepository: dependencies.customRequirementRepository
    })
  );
  app.use(
    "/api/reminders",
    createRemindersRouter({
      authRepository: dependencies.authRepository,
      reminderRepository: dependencies.reminderRepository
    })
  );
  app.use(
    "/api/lab-exam-events",
    createLabExamEventsRouter({
      authRepository: dependencies.authRepository,
      db: dependencies.labExamEvents.db,
      createLabExamEventRepository: dependencies.labExamEvents.createLabExamEventRepository,
      createReminderRepository: dependencies.labExamEvents.createReminderRepository
    })
  );
  if (dependencies.amapWeatherKey) {
    app.use("/api/weather", createWeatherRouter(dependencies.amapWeatherKey));
  }
  app.use("/api", createProgramRulesRouter());
  app.use("/mcp", createMcpRouter(dependencies.mcp));
  app.use(
    "/api/course-recommendations",
    createCourseRecommendationsRouter({
      authRepository: dependencies.authRepository,
      courseRecommendationRepository: dependencies.courseRecommendationRepository,
      programPlanRepository: dependencies.programPlanRepository,
      gpaRepository: dependencies.gpaRepository
    })
  );

  if (dependencies.staticDir && existsSync(dependencies.staticDir)) {
    const staticDir = dependencies.staticDir;
    const indexHtml = join(staticDir, "index.html");

    app.use(express.static(staticDir));

    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      if (
        req.path.startsWith("/api") ||
        req.path.startsWith("/mcp") ||
        req.path === "/health"
      ) {
        next();
        return;
      }
      if (!existsSync(indexHtml)) {
        next();
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  app.use(errorHandler);

  return app;
}
