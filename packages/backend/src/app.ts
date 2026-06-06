import cors from "cors";
import express from "express";

import { errorHandler } from "./middleware/error-handler.js";
import type { AuthRepository } from "./modules/auth/auth.repository.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createUserRouter } from "./modules/users/user.routes.js";
import { createWeatherRouter } from "./modules/weather/weather.routes.js";

export interface AppDependencies {
  authRepository: AuthRepository;
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
  if (dependencies.amapWeatherKey) {
    app.use("/api/weather", createWeatherRouter(dependencies.amapWeatherKey));
  }
  app.use(errorHandler);

  return app;
}
