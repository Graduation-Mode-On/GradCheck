import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { VolunteerLaborRepository } from "./volunteer-labor.repository.js";
import { volunteerLaborProgressSchema } from "./volunteer-labor.schemas.js";

export function createVolunteerLaborRouter(
  authRepository: AuthRepository,
  volunteerLaborRepository: VolunteerLaborRepository
): Router {
  const router = Router();
  router.use(authenticate(authRepository));

  router.get("/me", async (req, res, next) => {
    try {
      const progress = await volunteerLaborRepository.getProgress(req.userId ?? "");
      res.json({ progress });
    } catch (error) {
      next(error);
    }
  });

  router.put("/me", async (req, res, next) => {
    try {
      const progress = await volunteerLaborRepository.upsertProgress(
        req.userId ?? "",
        volunteerLaborProgressSchema.parse(req.body)
      );
      res.json({ progress });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
