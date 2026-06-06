import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { LecturePracticeRepository } from "./lecture-practice.repository.js";
import { lecturePracticeProgressSchema } from "./lecture-practice.schemas.js";

export function createLecturePracticeRouter(
  authRepository: AuthRepository,
  lecturePracticeRepository: LecturePracticeRepository
): Router {
  const router = Router();
  router.use(authenticate(authRepository));

  router.get("/me", async (req, res, next) => {
    try {
      const progress = await lecturePracticeRepository.getProgress(req.userId ?? "");
      res.json({ progress });
    } catch (error) {
      next(error);
    }
  });

  router.put("/me", async (req, res, next) => {
    try {
      const progress = await lecturePracticeRepository.upsertProgress(
        req.userId ?? "",
        lecturePracticeProgressSchema.parse(req.body)
      );
      res.json({ progress });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
