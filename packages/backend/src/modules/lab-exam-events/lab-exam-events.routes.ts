import { Router } from "express";

import type { Database } from "../../db/client.js";
import { HttpError } from "../../lib/http-error.js";
import { authenticate } from "../../middleware/authenticate.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import type { RemindersDatabase } from "../reminders/reminders.repository.js";
import type { ReminderRepository } from "../reminders/reminders.types.js";
import {
  createLabExamEventSchema,
  listLabExamEventsQuerySchema,
  updateLabExamEventSchema,
  updateLabExamEventStatusSchema
} from "./lab-exam-events.schemas.js";
import { createLabExamEventService } from "./lab-exam-events.service.js";
import type { LabExamEventsDatabase } from "./lab-exam-events.repository.js";
import type { LabExamEventRepository } from "./lab-exam-events.types.js";

interface Dependencies {
  authRepository: AuthRepository;
  db: Database;
  createLabExamEventRepository: (database: LabExamEventsDatabase) => LabExamEventRepository;
  createReminderRepository: (database: RemindersDatabase) => ReminderRepository;
}

function getRouteId(id: string | string[] | undefined): string {
  if (typeof id !== "string") {
    throw new HttpError(400, "Lab exam event id is required");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError(400, "Lab exam event id must be a valid UUID");
  }

  return id;
}

export function createLabExamEventsRouter(dependencies: Dependencies): Router {
  const router = Router();
  const requireAuth = authenticate(dependencies.authRepository);
  const service = createLabExamEventService({
    db: dependencies.db,
    createLabExamEventRepository: dependencies.createLabExamEventRepository,
    createReminderRepository: dependencies.createReminderRepository
  });

  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      const events = await service.list(req.userId ?? "", listLabExamEventsQuerySchema.parse(req.query));
      res.json({ events });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const result = await service.create(req.userId ?? "", createLabExamEventSchema.parse(req.body));
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const id = getRouteId(req.params.id);
      const result = await service.update(req.userId ?? "", id, updateLabExamEventSchema.parse(req.body));
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/status", async (req, res, next) => {
    try {
      const id = getRouteId(req.params.id);
      const input = updateLabExamEventStatusSchema.parse(req.body);
      const result = await service.updateStatus(req.userId ?? "", id, input.status);
      res.json(result);
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
