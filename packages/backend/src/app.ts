import cors from "cors";
import express from "express";

import { errorHandler } from "./middleware/error-handler.js";
import type { LecturePracticeRepository } from "./modules/lecture-practice/lecture-practice.repository.js";
import { createLecturePracticeRouter } from "./modules/lecture-practice/lecture-practice.routes.js";
import type { AuthRepository } from "./modules/auth/auth.repository.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import type { NewsRepository } from "./modules/news/news.repository.js";
import { createNewsRouter } from "./modules/news/news.routes.js";
import type { PlazaRepository } from "./modules/plaza/plaza.repository.js";
import { createPlazaRouter } from "./modules/plaza/plaza.routes.js";
import { createProgramRulesRouter } from "./modules/program-rules/expressRouter.js";
import type { SrtpRepository } from "./modules/srtp/srtp.repository.js";
import { createSrtpRouter } from "./modules/srtp/srtp.routes.js";
import { createUserRouter } from "./modules/users/user.routes.js";
import type { VolunteerLaborRepository } from "./modules/volunteer-labor/volunteer-labor.repository.js";
import { createVolunteerLaborRouter } from "./modules/volunteer-labor/volunteer-labor.routes.js";
import { createWeatherRouter } from "./modules/weather/weather.routes.js";

export interface AppDependencies {
  authRepository: AuthRepository;
  plazaRepository: PlazaRepository;
  newsRepository: NewsRepository;
  lecturePracticeRepository: LecturePracticeRepository;
  volunteerLaborRepository: VolunteerLaborRepository;
  srtpRepository: SrtpRepository;
  corsOrigin?: string;
  amapWeatherKey?: string;
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
  app.use("/api/plaza/posts", createPlazaRouter(dependencies.authRepository, dependencies.plazaRepository));
  app.use("/api/news", createNewsRouter(dependencies.newsRepository));
  app.use("/api/srtp", createSrtpRouter(dependencies.authRepository, dependencies.srtpRepository));
  app.use(
    "/api/lecture-practice",
    createLecturePracticeRouter(dependencies.authRepository, dependencies.lecturePracticeRepository)
  );
  app.use(
    "/api/volunteer-labor",
    createVolunteerLaborRouter(dependencies.authRepository, dependencies.volunteerLaborRepository)
  );
  if (dependencies.amapWeatherKey) {
    app.use("/api/weather", createWeatherRouter(dependencies.amapWeatherKey));
  }
  app.use("/api", createProgramRulesRouter());
  app.use(errorHandler);

  return app;
}
