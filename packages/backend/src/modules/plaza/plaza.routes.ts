import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import {
  createPlazaPostSchema,
  plazaListQuerySchema,
  updatePlazaPostSchema,
  updatePlazaPostStatusSchema
} from "./plaza.schemas.js";
import type { PlazaRepository } from "./plaza.repository.js";
import {
  createPlazaPost,
  deletePlazaPost,
  listPlazaPosts,
  updatePlazaPost,
  updatePlazaPostStatus
} from "./plaza.service.js";

export function createPlazaRouter(authRepository: AuthRepository, plazaRepository: PlazaRepository): Router {
  const router = Router();
  router.use(authenticate(authRepository));

  router.get("/", async (req, res, next) => {
    try {
      const result = await listPlazaPosts(
        authRepository,
        plazaRepository,
        req.userId ?? "",
        plazaListQuerySchema.parse(req.query)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const post = await createPlazaPost(
        authRepository,
        plazaRepository,
        req.userId ?? "",
        createPlazaPostSchema.parse(req.body)
      );
      res.status(201).json({ post });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const post = await updatePlazaPost(
        authRepository,
        plazaRepository,
        req.userId ?? "",
        req.params.id,
        updatePlazaPostSchema.parse(req.body)
      );
      res.json({ post });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/status", async (req, res, next) => {
    try {
      const post = await updatePlazaPostStatus(
        authRepository,
        plazaRepository,
        req.userId ?? "",
        req.params.id,
        updatePlazaPostStatusSchema.parse(req.body)
      );
      res.json({ post });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      await deletePlazaPost(authRepository, plazaRepository, req.userId ?? "", req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
