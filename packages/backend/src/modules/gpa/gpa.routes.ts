import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { GpaRepository } from "./gpa.repository.js";
import { gpaCourseInputSchema } from "./gpa.schemas.js";
import { createGpaCourse, deleteGpaCourse, getGpaDashboard, updateGpaCourse } from "./gpa.service.js";

export function createGpaRouter(authRepository: AuthRepository, gpaRepository: GpaRepository): Router {
  const router = Router();

  router.get("/", authenticate(authRepository), async (req, res, next) => {
    try {
      res.json(await getGpaDashboard(gpaRepository, req.userId ?? ""));
    } catch (error) {
      next(error);
    }
  });

  router.post("/courses", authenticate(authRepository), async (req, res, next) => {
    try {
      const input = gpaCourseInputSchema.parse(req.body);
      res.status(201).json(await createGpaCourse(gpaRepository, req.userId ?? "", input));
    } catch (error) {
      next(error);
    }
  });

  router.put<{ id: string }>("/courses/:id", authenticate(authRepository), async (req, res, next) => {
    try {
      const input = gpaCourseInputSchema.parse(req.body);
      res.json(await updateGpaCourse(gpaRepository, req.userId ?? "", req.params.id, input));
    } catch (error) {
      next(error);
    }
  });

  router.delete<{ id: string }>("/courses/:id", authenticate(authRepository), async (req, res, next) => {
    try {
      res.json(await deleteGpaCourse(gpaRepository, req.userId ?? "", req.params.id));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
