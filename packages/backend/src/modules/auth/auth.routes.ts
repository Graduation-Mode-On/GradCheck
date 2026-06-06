import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "./auth.repository.js";
import { credentialsSchema, registerSchema } from "./auth.schemas.js";
import { getCurrentUser, loginUser, registerUser } from "./auth.service.js";

export function createAuthRouter(repository: AuthRepository): Router {
  const router = Router();

  router.post("/register", async (req, res, next) => {
    try {
      const result = await registerUser(repository, registerSchema.parse(req.body));
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const result = await loginUser(repository, credentialsSchema.parse(req.body));
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", authenticate(repository), async (req, res, next) => {
    try {
      const user = await getCurrentUser(repository, req.userId ?? "");
      res.json({ user });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
