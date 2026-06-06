import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import type { AuthRepository, UserRecord } from "../auth/auth.repository.js";
import type {
  ReminderDeliveryLogDto,
  ReminderDeliveryLogInput,
  ReminderDto,
  ReminderFilters,
  ReminderInput,
  ReminderRepository,
  ReminderUpdateInput
} from "../reminders/reminders.types.js";
import { createLabExamEventsRouter } from "./lab-exam-events.routes.js";
import type {
  LabExamEventDto,
  LabExamEventFilters,
  LabExamEventInput,
  LabExamEventRepository,
  LabExamEventUpdateInput
} from "./lab-exam-events.types.js";

const now = new Date("2026-06-06T00:00:00.000Z");
const user: UserRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "student@example.com",
  passwordHash: "hash",
  createdAt: now,
  updatedAt: now
};

function createAuthRepository(): AuthRepository {
  return {
    async findUserByEmail() {
      return user;
    },
    async findUserById(id) {
      return id === user.id ? user : null;
    },
    async createUser() {
      return user;
    },
    async getProfile() {
      return null;
    },
    async upsertProfile() {
      throw new Error("not used");
    },
    async recordAuditLog() {
      return;
    }
  };
}

function nextUuid(sequence: number): string {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function matchesReminderFilters(row: ReminderDto, filters?: ReminderFilters): boolean {
  if (row.deletedAt) return false;
  if (filters?.status && row.status !== filters.status) return false;
  if (filters?.category && row.category !== filters.category) return false;
  if (filters?.showOnHome !== undefined && row.showOnHome !== filters.showOnHome) return false;
  if (filters?.includeCompleted === false && (row.status === "done" || row.status === "cancelled")) return false;
  if (filters?.dueFrom && row.dueAt < filters.dueFrom) return false;
  if (filters?.dueTo && row.dueAt > filters.dueTo) return false;
  return true;
}

function createReminderRepository(seed: ReminderDto[] = []): ReminderRepository {
  const rows = new Map<string, ReminderDto>(seed.map((row) => [row.id, row]));
  const deliveryLogs = new Map<string, ReminderDeliveryLogDto>();

  return {
    async listByUserId(userId, filters) {
      return [...rows.values()]
        .filter((row) => row.userId === userId && matchesReminderFilters(row, filters))
        .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime());
    },
    async findById(userId, id) {
      const row = rows.get(id);
      return row && row.userId === userId && !row.deletedAt ? row : null;
    },
    async create(userId, input: ReminderInput) {
      const row: ReminderDto = {
        id: nextUuid(rows.size + 1),
        userId,
        title: input.title,
        category: input.category,
        status: "pending",
        priority: input.priority,
        startAt: input.startAt,
        dueAt: input.dueAt,
        location: input.location,
        notes: input.notes,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        reminderOffsets: input.reminderOffsets,
        smsEnabled: input.smsEnabled,
        showOnHome: input.showOnHome,
        completedAt: null,
        snoozedUntil: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      };
      rows.set(row.id, row);
      return row;
    },
    async update(userId, id, input: ReminderUpdateInput) {
      const existing = rows.get(id);
      if (!existing || existing.userId !== userId || existing.deletedAt) return null;
      const row: ReminderDto = { ...existing, ...input, updatedAt: now };
      rows.set(id, row);
      return row;
    },
    async softDelete(userId, id) {
      const existing = rows.get(id);
      if (!existing || existing.userId !== userId || existing.deletedAt) return false;
      rows.set(id, { ...existing, deletedAt: now, updatedAt: now });
      return true;
    },
    async listDueSmsCandidates(candidateNow) {
      return [...rows.values()].filter(
        (row) =>
          row.smsEnabled &&
          !row.deletedAt &&
          row.dueAt <= candidateNow &&
          row.status !== "done" &&
          row.status !== "cancelled"
      );
    },
    async findDeliveryLog(reminderId, channel, scheduledAt) {
      return deliveryLogs.get(`${reminderId}:${channel}:${scheduledAt.toISOString()}`) ?? null;
    },
    async createDeliveryLog(input: ReminderDeliveryLogInput) {
      const row: ReminderDeliveryLogDto = {
        id: nextUuid(deliveryLogs.size + 1),
        ...input,
        createdAt: now,
        updatedAt: now
      };
      deliveryLogs.set(`${row.reminderId}:${row.channel}:${row.scheduledAt.toISOString()}`, row);
      return row;
    }
  };
}

function matchesEventFilters(row: LabExamEventDto, filters?: LabExamEventFilters): boolean {
  if (row.deletedAt) return false;
  if (filters?.status && row.status !== filters.status) return false;
  if (filters?.eventType && row.eventType !== filters.eventType) return false;
  return true;
}

function createLabExamEventRepository(seed: LabExamEventDto[] = []): LabExamEventRepository {
  const rows = new Map<string, LabExamEventDto>(seed.map((row) => [row.id, row]));

  return {
    async listByUserId(userId, filters) {
      return [...rows.values()]
        .filter((row) => row.userId === userId && matchesEventFilters(row, filters))
        .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
    },
    async findById(userId, id) {
      const row = rows.get(id);
      return row && row.userId === userId && !row.deletedAt ? row : null;
    },
    async create(userId, input: LabExamEventInput) {
      const row: LabExamEventDto = {
        id: nextUuid(rows.size + 101),
        userId,
        reminderId: input.reminderId,
        title: input.title,
        courseName: input.courseName,
        eventType: input.eventType,
        startAt: input.startAt,
        endAt: input.endAt,
        location: input.location,
        teacher: input.teacher,
        seatOrGroup: input.seatOrGroup,
        notes: input.notes,
        status: "scheduled",
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      };
      rows.set(row.id, row);
      return row;
    },
    async update(userId, id, input: LabExamEventUpdateInput) {
      const existing = rows.get(id);
      if (!existing || existing.userId !== userId || existing.deletedAt) return null;
      const row: LabExamEventDto = { ...existing, ...input, updatedAt: now };
      rows.set(id, row);
      return row;
    },
    async softDelete(userId, id) {
      const existing = rows.get(id);
      if (!existing || existing.userId !== userId || existing.deletedAt) return false;
      rows.set(id, { ...existing, deletedAt: now, updatedAt: now });
      return true;
    }
  };
}

function createApp(
  labExamEventRepository: LabExamEventRepository = createLabExamEventRepository(),
  reminderRepository: ReminderRepository = createReminderRepository()
) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/lab-exam-events",
    createLabExamEventsRouter({
      authRepository: createAuthRepository(),
      labExamEventRepository,
      reminderRepository
    })
  );
  app.use(errorHandler);
  return app;
}

function authHeader() {
  const token = jwt.sign({ sub: user.id }, "test-secret-that-is-long-enough");
  return `Bearer ${token}`;
}

async function createEvent(app: express.Express) {
  const response = await request(app)
    .post("/api/lab-exam-events")
    .set("Authorization", authHeader())
    .send({
      title: "Physics Lab Practical",
      courseName: "College Physics",
      eventType: "lab",
      startAt: "2026-06-08T09:00:00.000Z",
      endAt: "2026-06-08T11:00:00.000Z",
      location: "Lab 302",
      teacher: "Dr. Chen",
      seatOrGroup: "Group A",
      notes: "Bring goggles"
    });
  expect(response.status).toBe(201);
  return response.body as { event: LabExamEventDto; reminder: ReminderDto };
}

describe("lab exam event routes", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
  });

  it("creates a lab exam event and a linked lab reminder with default offsets", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/lab-exam-events")
      .set("Authorization", authHeader())
      .send({
        title: "Chemistry Lab Checkoff",
        courseName: "Chemistry",
        eventType: "lab",
        startAt: "2026-06-08T09:00:00.000Z",
        endAt: "2026-06-08T10:00:00.000Z",
        location: "Chem Lab 1",
        teacher: "Prof. Lin",
        seatOrGroup: "Bench 4",
        notes: "Submit worksheet"
      });

    expect(response.status).toBe(201);
    expect(response.body.event).toMatchObject({
      title: "Chemistry Lab Checkoff",
      eventType: "lab",
      status: "scheduled"
    });
    expect(response.body.reminder).toMatchObject({
      title: "Chemistry Lab Checkoff",
      category: "lab",
      sourceType: "lab_exam_event",
      sourceId: response.body.event.id,
      reminderOffsets: [1440, 60],
      dueAt: "2026-06-08T09:00:00.000Z",
      startAt: "2026-06-08T09:00:00.000Z",
      location: "Chem Lab 1",
      notes: "Submit worksheet"
    });
    expect(response.body.event.reminderId).toBe(response.body.reminder.id);
  });

  it("synchronizes title, location, and notes updates to the linked reminder", async () => {
    const app = createApp();
    const { event } = await createEvent(app);

    const response = await request(app)
      .put(`/api/lab-exam-events/${event.id}`)
      .set("Authorization", authHeader())
      .send({
        title: "Updated Physics Lab Practical",
        location: "Lab 405",
        notes: "Bring calculator",
        smsEnabled: true,
        showOnHome: false,
        reminderOffsets: [30]
      });

    expect(response.status).toBe(200);
    expect(response.body.event).toMatchObject({
      title: "Updated Physics Lab Practical",
      location: "Lab 405",
      notes: "Bring calculator"
    });
    expect(response.body.event).not.toHaveProperty("smsEnabled");
    expect(response.body.event).not.toHaveProperty("showOnHome");
    expect(response.body.event).not.toHaveProperty("reminderOffsets");
    expect(response.body.reminder).toMatchObject({
      title: "Updated Physics Lab Practical",
      location: "Lab 405",
      notes: "Bring calculator",
      smsEnabled: true,
      showOnHome: false,
      reminderOffsets: [30]
    });
  });

  it("marks the linked reminder done when status is done", async () => {
    const app = createApp();
    const { event } = await createEvent(app);

    const response = await request(app)
      .patch(`/api/lab-exam-events/${event.id}/status`)
      .set("Authorization", authHeader())
      .send({ status: "done" });

    expect(response.status).toBe(200);
    expect(response.body.event.status).toBe("done");
    expect(response.body.reminder.status).toBe("done");
    expect(response.body.reminder.completedAt).toEqual(expect.any(String));
  });

  it("cancels the linked reminder when status is cancelled", async () => {
    const app = createApp();
    const { event } = await createEvent(app);

    const response = await request(app)
      .patch(`/api/lab-exam-events/${event.id}/status`)
      .set("Authorization", authHeader())
      .send({ status: "cancelled" });

    expect(response.status).toBe(200);
    expect(response.body.event.status).toBe("cancelled");
    expect(response.body.reminder.status).toBe("cancelled");
  });

  it("rejects endAt values that are not after startAt", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/lab-exam-events")
      .set("Authorization", authHeader())
      .send({
        title: "Invalid Exam",
        eventType: "midterm",
        startAt: "2026-06-08T09:00:00.000Z",
        endAt: "2026-06-08T09:00:00.000Z"
      });

    expect(response.status).toBe(400);
  });

  it("rejects partial updates that would make endAt not after startAt", async () => {
    const app = createApp();
    const { event } = await createEvent(app);

    const response = await request(app)
      .put(`/api/lab-exam-events/${event.id}`)
      .set("Authorization", authHeader())
      .send({ endAt: "2026-06-08T08:30:00.000Z" });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("endAt must be after startAt");
  });

  it("requires authentication for listing lab exam events", async () => {
    const app = createApp();

    const response = await request(app).get("/api/lab-exam-events");

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Authorization bearer token is required");
  });
});
