import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { SportsRepository } from "./sports.repository.js";
import { sportsProgressSchema } from "./sports.schemas.js";

export function createSportsRouter(authRepository: AuthRepository, sportsRepository: SportsRepository): Router {
  const router = Router();
  router.use(authenticate(authRepository));

  router.get("/me", async (req, res, next) => {
    try {
      const progress = await sportsRepository.getProgress(req.userId ?? "");
      res.json({ progress });
    } catch (error) {
      next(error);
    }
  });

  router.put("/me", async (req, res, next) => {
    try {
      const progress = await sportsRepository.upsertProgress(req.userId ?? "", sportsProgressSchema.parse(req.body));
      res.json({ progress });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
