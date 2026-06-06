import { Router } from "express";

import { HttpError } from "../../lib/http-error.js";
import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { CustomRequirementRepository } from "./custom-requirement.repository.js";
import { createCustomRequirementSchema, updateCustomRequirementSchema } from "./custom-requirement.schemas.js";

interface Dependencies {
  authRepository: AuthRepository;
  customRequirementRepository: CustomRequirementRepository;
}

function getRouteId(id: string | string[] | undefined): string {
  if (typeof id !== "string") {
    throw new HttpError(400, "Custom requirement id is required");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError(400, "Custom requirement id must be a valid UUID");
  }

  return id;
}

export function createCustomRequirementRouter(dependencies: Dependencies): Router {
  const router = Router();
  const requireAuth = authenticate(dependencies.authRepository);

  router.get("/", requireAuth, async (req, res, next) => {
    try {
      const customRequirements = await dependencies.customRequirementRepository.listByUserId(req.userId ?? "");
      res.json({ customRequirements });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", requireAuth, async (req, res, next) => {
    try {
      const input = createCustomRequirementSchema.parse(req.body);
      const customRequirement = await dependencies.customRequirementRepository.create(req.userId ?? "", input);
      await dependencies.authRepository.recordAuditLog({
        actorUserId: req.userId ?? null,
        action: "custom_requirement.create",
        entityType: "custom_requirement",
        entityId: customRequirement.id
      });
      res.status(201).json({ customRequirement });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", requireAuth, async (req, res, next) => {
    try {
      const input = updateCustomRequirementSchema.parse(req.body);
      const id = getRouteId(req.params.id);
      const customRequirement = await dependencies.customRequirementRepository.update(req.userId ?? "", id, input);
      if (!customRequirement) {
        throw new HttpError(404, "Custom requirement not found");
      }

      await dependencies.authRepository.recordAuditLog({
        actorUserId: req.userId ?? null,
        action: "custom_requirement.update",
        entityType: "custom_requirement",
        entityId: customRequirement.id
      });
      res.json({ customRequirement });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", requireAuth, async (req, res, next) => {
    try {
      const id = getRouteId(req.params.id);
      const deleted = await dependencies.customRequirementRepository.delete(req.userId ?? "", id);
      if (!deleted) {
        throw new HttpError(404, "Custom requirement not found");
      }

      await dependencies.authRepository.recordAuditLog({
        actorUserId: req.userId ?? null,
        action: "custom_requirement.delete",
        entityType: "custom_requirement",
        entityId: id
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
