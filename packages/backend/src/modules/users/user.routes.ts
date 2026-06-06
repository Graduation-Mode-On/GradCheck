import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import { profileSchema } from "../auth/auth.schemas.js";

export function createUserRouter(repository: AuthRepository): Router {
  const router = Router();

  router.put("/me/profile", authenticate(repository), async (req, res, next) => {
    try {
      const profileInput = profileSchema.parse(req.body);
      const profile = await repository.upsertProfile(req.userId ?? "", profileInput);

      await repository.recordAuditLog({
        actorUserId: req.userId ?? null,
        action: "user.profile.update",
        entityType: "user_profile",
        entityId: req.userId ?? ""
      });

      res.json({ profile });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
