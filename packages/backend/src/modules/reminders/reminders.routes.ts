import { Router } from "express";

import { HttpError } from "../../lib/http-error.js";
import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import {
  completeReminderSchema,
  createReminderSchema,
  listReminderQuerySchema,
  snoozeReminderSchema,
  updateReminderSchema
} from "./reminders.schemas.js";
import { createReminderService } from "./reminders.service.js";
import type { ReminderRepository } from "./reminders.types.js";

interface Dependencies {
  authRepository: AuthRepository;
  reminderRepository: ReminderRepository;
}

function getRouteId(id: string | string[] | undefined): string {
  if (typeof id !== "string") {
    throw new HttpError(400, "Reminder id is required");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError(400, "Reminder id must be a valid UUID");
  }

  return id;
}

export function createRemindersRouter(dependencies: Dependencies): Router {
  const router = Router();
  const requireAuth = authenticate(dependencies.authRepository);
  const service = createReminderService(dependencies.reminderRepository);

  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      const reminders = await service.list(req.userId ?? "", listReminderQuerySchema.parse(req.query));
      res.json({ reminders });
    } catch (error) {
      next(error);
    }
  });

  router.get("/home", async (req, res, next) => {
    try {
      res.json(await service.home(req.userId ?? ""));
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const reminder = await service.createCustom(req.userId ?? "", createReminderSchema.parse(req.body));
      res.status(201).json({ reminder });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const id = getRouteId(req.params.id);
      const reminder = await service.update(req.userId ?? "", id, updateReminderSchema.parse(req.body));
      res.json({ reminder });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/complete", async (req, res, next) => {
    try {
      const id = getRouteId(req.params.id);
      const input = completeReminderSchema.parse(req.body);
      const reminder = await service.setCompleted(req.userId ?? "", id, input.completed);
      res.json({ reminder });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/snooze", async (req, res, next) => {
    try {
      const id = getRouteId(req.params.id);
      const input = snoozeReminderSchema.parse(req.body);
      const reminder = await service.snooze(req.userId ?? "", id, input.snoozedUntil);
      res.json({ reminder });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/duplicate", async (req, res, next) => {
    try {
      const id = getRouteId(req.params.id);
      const reminder = await service.duplicate(req.userId ?? "", id);
      res.status(201).json({ reminder });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const id = getRouteId(req.params.id);
      await service.delete(req.userId ?? "", id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
