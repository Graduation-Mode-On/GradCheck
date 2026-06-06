import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { CoursesProgressRepository } from "./courses-progress.repository.js";
import { getCoursesProgress } from "./courses-progress.service.js";

export function createCoursesProgressRouter(
  authRepository: AuthRepository,
  repository: CoursesProgressRepository
): Router {
  const router = Router();

  router.get("/progress", authenticate(authRepository), async (req, res, next) => {
    try {
      res.json(await getCoursesProgress(repository, req.userId ?? ""));
    } catch (error) {
      next(error);
    }
  });

  router.post<{ groupId: string }>("/rules/:groupId/ignore", authenticate(authRepository), async (req, res, next) => {
    try {
      await repository.ignoreGroup(req.userId ?? "", req.params.groupId);
      res.json(await getCoursesProgress(repository, req.userId ?? ""));
    } catch (error) {
      next(error);
    }
  });

  router.delete<{ groupId: string }>("/rules/:groupId/ignore", authenticate(authRepository), async (req, res, next) => {
    try {
      await repository.unignoreGroup(req.userId ?? "", req.params.groupId);
      res.json(await getCoursesProgress(repository, req.userId ?? ""));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
