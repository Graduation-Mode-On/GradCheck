import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import { getGraduationSummary, type HomeSummaryDependencies } from "./home-summary.service.js";

export function createHomeSummaryRouter(
  authRepository: AuthRepository,
  dependencies: HomeSummaryDependencies
): Router {
  const router = Router();
  router.use(authenticate(authRepository));

  router.get("/graduation-summary", async (req, res, next) => {
    try {
      const summary = await getGraduationSummary(dependencies, req.userId ?? "");
      res.json(summary);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
