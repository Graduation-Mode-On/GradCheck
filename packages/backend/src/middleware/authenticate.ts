import type { NextFunction, Request, Response } from "express";

import type { AuthRepository } from "../modules/auth/auth.repository.js";
import { getCurrentUser, verifyToken } from "../modules/auth/auth.service.js";
import { HttpError } from "../lib/http-error.js";

export function authenticate(repository: AuthRepository) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const authorization = req.header("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      next(new HttpError(401, "Authorization bearer token is required"));
      return;
    }

    const token = authorization.slice("Bearer ".length);
    const userId = verifyToken(token);
    await getCurrentUser(repository, userId);
    req.userId = userId;
    next();
  };
}
