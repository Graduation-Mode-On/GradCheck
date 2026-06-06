import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import type { AuthRepository, UserRecord } from "../auth/auth.repository.js";
import { createRemindersRouter } from "./reminders.routes.js";
import type {
  ReminderDeliveryLogDto,
  ReminderDeliveryLogInput,
  ReminderDto,
  ReminderFilters,
  ReminderInput,
  ReminderRepository,
  ReminderUpdateInput
} from "./reminders.types.js";

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

function matchesFilters(row: ReminderDto, filters?: ReminderFilters): boolean {
  if (row.deletedAt) return false;
  if (filters?.status && row.status !== filters.status) return false;
  if (filters?.category && row.category !== filters.category) return false;
  if (filters?.showOnHome !== undefined && row.showOnHome !== filters.showOnHome) return false;
  if (!filters?.includeCompleted && (row.status === "done" || row.status === "cancelled")) return false;
  if (filters?.dueFrom && row.dueAt < filters.dueFrom) return false;
  if (filters?.dueTo && row.dueAt > filters.dueTo) return false;
  return true;
}

function createRepository(seed: ReminderDto[] = []): ReminderRepository {
  const rows = new Map<string, ReminderDto>(seed.map((row) => [row.id, row]));
  const deliveryLogs = new Map<string, ReminderDeliveryLogDto>();

  return {
    async listByUserId(userId, filters) {
      return [...rows.values()]
        .filter((row) => row.userId === userId && matchesFilters(row, filters))
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
        sentAt: input.sentAt,
        providerMessageId: input.providerMessageId,
        errorMessage: input.errorMessage,
        createdAt: now,
        updatedAt: now
      };
      deliveryLogs.set(`${row.reminderId}:${row.channel}:${row.scheduledAt.toISOString()}`, row);
      return row;
    }
  };
}

function createReminder(overrides: Partial<ReminderDto>): ReminderDto {
  return {
    id: "00000000-0000-4000-8000-000000000100",
    userId: user.id,
    title: "默认提醒",
    category: "custom",
    status: "pending",
    priority: "normal",
    startAt: null,
    dueAt: new Date("2026-06-08T10:00:00.000Z"),
    location: null,
    notes: null,
    sourceType: "custom",
    sourceId: null,
    reminderOffsets: [60],
    smsEnabled: false,
    showOnHome: true,
    completedAt: null,
    snoozedUntil: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createApp(repository: ReminderRepository = createRepository()) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/reminders",
    createRemindersRouter({
      authRepository: createAuthRepository(),
      reminderRepository: repository
    })
  );
  app.use(errorHandler);
  return app;
}

function authHeader() {
  const token = jwt.sign({ sub: user.id }, "test-secret-that-is-long-enough");
  return `Bearer ${token}`;
}

describe("reminder routes", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
  });

  it("creates and lists a custom reminder", async () => {
    const app = createApp();

    const createResponse = await request(app)
      .post("/api/reminders")
      .set("Authorization", authHeader())
      .send({
        title: "实验报告截止",
        category: "lab",
        priority: "high",
        startAt: "2026-06-07T09:00:00.000Z",
        dueAt: "2026-06-08T10:00:00.000Z",
        location: "实验楼 302",
        notes: "提交 PDF",
        reminderOffsets: [1440, 60],
        smsEnabled: true,
        showOnHome: true
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.reminder).toMatchObject({
      title: "实验报告截止",
      category: "lab",
      priority: "high",
      sourceType: "custom",
      sourceId: null,
      reminderOffsets: [1440, 60],
      smsEnabled: true,
      showOnHome: true
    });
    expect(createResponse.body.reminder.dueAt).toBe("2026-06-08T10:00:00.000Z");

    const listResponse = await request(app)
      .get("/api/reminders?category=lab&status=pending&showOnHome=true")
      .set("Authorization", authHeader());

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.reminders).toHaveLength(1);
    expect(listResponse.body.reminders[0].title).toBe("实验报告截止");
  });

  it("strips lifecycle and source-binding fields from PUT updates while applying user-editable fields", async () => {
    const app = createApp();

    const createResponse = await request(app)
      .post("/api/reminders")
      .set("Authorization", authHeader())
      .send({
        title: "原始提醒",
        category: "custom",
        priority: "normal",
        dueAt: "2026-06-08T10:00:00.000Z"
      });

    expect(createResponse.status).toBe(201);
    const createdReminder = createResponse.body.reminder;

    const updateResponse = await request(app)
      .put(`/api/reminders/${createdReminder.id}`)
      .set("Authorization", authHeader())
      .send({
        title: "更新后的提醒",
        status: "done",
        completedAt: "2026-06-09T10:00:00.000Z",
        snoozedUntil: "2026-06-10T10:00:00.000Z",
        deletedAt: "2026-06-11T10:00:00.000Z",
        sourceType: "custom",
        sourceId: "00000000-0000-4000-8000-000000000777"
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.reminder).toMatchObject({
      title: "更新后的提醒",
      status: "pending",
      completedAt: null,
      snoozedUntil: null,
      deletedAt: null,
      sourceType: createdReminder.sourceType,
      sourceId: createdReminder.sourceId
    });
  });

  it("returns pending count and top home reminders sorted by due time", async () => {
    const repository = createRepository([
      createReminder({ id: "00000000-0000-4000-8000-000000000001", title: "third", dueAt: new Date("2026-06-10T00:00:00.000Z") }),
      createReminder({ id: "00000000-0000-4000-8000-000000000002", title: "first", dueAt: new Date("2026-06-07T00:00:00.000Z") }),
      createReminder({ id: "00000000-0000-4000-8000-000000000003", title: "hidden", dueAt: new Date("2026-06-06T00:00:00.000Z"), showOnHome: false }),
      createReminder({ id: "00000000-0000-4000-8000-000000000004", title: "done", dueAt: new Date("2026-06-08T00:00:00.000Z"), status: "done" }),
      createReminder({ id: "00000000-0000-4000-8000-000000000005", title: "second", dueAt: new Date("2026-06-09T00:00:00.000Z") }),
      createReminder({ id: "00000000-0000-4000-8000-000000000006", title: "fourth", dueAt: new Date("2026-06-11T00:00:00.000Z") })
    ]);
    const app = createApp(repository);

    const response = await request(app).get("/api/reminders/home").set("Authorization", authHeader());

    expect(response.status).toBe(200);
    expect(response.body.pendingCount).toBe(4);
    expect(response.body.reminders.map((reminder: ReminderDto) => reminder.title)).toEqual(["first", "second", "third"]);
  });

  it("completes and undoes completion", async () => {
    const id = "00000000-0000-4000-8000-000000000011";
    const app = createApp(createRepository([createReminder({ id, snoozedUntil: new Date("2026-06-07T00:00:00.000Z") })]));

    const completeResponse = await request(app)
      .patch(`/api/reminders/${id}/complete`)
      .set("Authorization", authHeader())
      .send({ completed: true });

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.reminder.status).toBe("done");
    expect(completeResponse.body.reminder.completedAt).toEqual(expect.any(String));
    expect(completeResponse.body.reminder.snoozedUntil).toBeNull();

    const undoResponse = await request(app)
      .patch(`/api/reminders/${id}/complete`)
      .set("Authorization", authHeader())
      .send({ completed: false });

    expect(undoResponse.status).toBe(200);
    expect(undoResponse.body.reminder).toMatchObject({ status: "pending", completedAt: null });
  });

  it("snoozes a reminder", async () => {
    const id = "00000000-0000-4000-8000-000000000012";
    const app = createApp(createRepository([createReminder({ id })]));

    const response = await request(app)
      .patch(`/api/reminders/${id}/snooze`)
      .set("Authorization", authHeader())
      .send({ snoozedUntil: "2026-06-09T10:00:00.000Z" });

    expect(response.status).toBe(200);
    expect(response.body.reminder).toMatchObject({ status: "snoozed", snoozedUntil: "2026-06-09T10:00:00.000Z" });
  });

  it("duplicates a reminder as a new custom reminder", async () => {
    const id = "00000000-0000-4000-8000-000000000013";
    const app = createApp(
      createRepository([
        createReminder({
          id,
          title: "系统实验考试",
          category: "exam",
          sourceType: "lab_exam_event",
          sourceId: "00000000-0000-4000-8000-000000000099"
        })
      ])
    );

    const response = await request(app).post(`/api/reminders/${id}/duplicate`).set("Authorization", authHeader());

    expect(response.status).toBe(201);
    expect(response.body.reminder).toMatchObject({
      title: "系统实验考试",
      category: "exam",
      sourceType: "custom",
      sourceId: null,
      status: "pending"
    });
    expect(response.body.reminder.id).not.toBe(id);
  });

  it("soft deletes a reminder", async () => {
    const id = "00000000-0000-4000-8000-000000000014";
    const repository = createRepository([createReminder({ id })]);
    const app = createApp(repository);

    await request(app).delete(`/api/reminders/${id}`).set("Authorization", authHeader()).expect(204);

    const listResponse = await request(app).get("/api/reminders").set("Authorization", authHeader());
    expect(listResponse.body.reminders).toHaveLength(0);
  });

  it("rejects invalid input and invalid route ids", async () => {
    const app = createApp();

    const invalidInputResponse = await request(app)
      .post("/api/reminders")
      .set("Authorization", authHeader())
      .send({
        title: "bad",
        category: "custom",
        priority: "normal",
        dueAt: "not-a-date",
        reminderOffsets: [1, 2, 3, 4, 5, 6]
      });

    expect(invalidInputResponse.status).toBe(400);

    const invalidIdResponse = await request(app)
      .patch("/api/reminders/not-a-uuid/complete")
      .set("Authorization", authHeader())
      .send({ completed: true });

    expect(invalidIdResponse.status).toBe(400);
    expect(invalidIdResponse.body.error.message).toBe("Reminder id must be a valid UUID");
  });

  it("requires authentication", async () => {
    const app = createApp();

    const response = await request(app).get("/api/reminders");

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Authorization bearer token is required");
  });
});
