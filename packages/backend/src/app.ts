import cors from "cors";
import express from "express";

import { errorHandler } from "./middleware/error-handler.js";
import type { AuthRepository } from "./modules/auth/auth.repository.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import type { CustomRequirementRepository } from "./modules/custom-requirements/custom-requirement.repository.js";
import { createCustomRequirementRouter } from "./modules/custom-requirements/custom-requirement.routes.js";
import { createUserRouter } from "./modules/users/user.routes.js";

export interface AppDependencies {
  authRepository: AuthRepository;
  customRequirementRepository: CustomRequirementRepository;
  corsOrigin?: string;
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
  app.use(
    "/api/custom-requirements",
    createCustomRequirementRouter({
      authRepository: dependencies.authRepository,
      customRequirementRepository: dependencies.customRequirementRepository
    })
  );
  app.use(errorHandler);

  return app;
}
