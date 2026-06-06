import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import type { AuthRepository, UserRecord } from "../auth/auth.repository.js";
import type { Database } from "../../db/client.js";
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

const otherUser: UserRecord = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "other@example.com",
  passwordHash: "hash",
  createdAt: now,
  updatedAt: now
};

function createAuthRepository(): AuthRepository {
  const users = new Map([user, otherUser].map((record) => [record.id, record]));
  return {
    async findUserByEmail(email) {
      return [...users.values()].find((record) => record.email === email) ?? null;
    },
    async findUserById(id) {
      return users.get(id) ?? null;
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

type ReminderStore = {
  rows: Map<string, ReminderDto>;
  deliveryLogs: Map<string, ReminderDeliveryLogDto>;
};

function createReminderStore(seed: ReminderDto[] = []): ReminderStore {
  return {
    rows: new Map<string, ReminderDto>(seed.map((row) => [row.id, row])),
    deliveryLogs: new Map<string, ReminderDeliveryLogDto>()
  };
}

function cloneReminderStore(store: ReminderStore): ReminderStore {
  return {
    rows: new Map(store.rows),
    deliveryLogs: new Map(store.deliveryLogs)
  };
}

function commitReminderStore(target: ReminderStore, source: ReminderStore) {
  target.rows.clear();
  source.rows.forEach((row, id) => target.rows.set(id, row));
  target.deliveryLogs.clear();
  source.deliveryLogs.forEach((row, id) => target.deliveryLogs.set(id, row));
}

function createReminderRepository(seedOrStore: ReminderDto[] | ReminderStore = []): ReminderRepository {
  const store = Array.isArray(seedOrStore) ? createReminderStore(seedOrStore) : seedOrStore;
  const { rows, deliveryLogs } = store;

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
        id: input.id ?? nextUuid(rows.size + 1),
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

type LabExamEventStore = {
  rows: Map<string, LabExamEventDto>;
};

function createLabExamEventStore(seed: LabExamEventDto[] = []): LabExamEventStore {
  return {
    rows: new Map<string, LabExamEventDto>(seed.map((row) => [row.id, row]))
  };
}

function cloneLabExamEventStore(store: LabExamEventStore): LabExamEventStore {
  return {
    rows: new Map(store.rows)
  };
}

function commitLabExamEventStore(target: LabExamEventStore, source: LabExamEventStore) {
  target.rows.clear();
  source.rows.forEach((row, id) => target.rows.set(id, row));
}

function createLabExamEventRepository(seedOrStore: LabExamEventDto[] | LabExamEventStore = []): LabExamEventRepository {
  const store = Array.isArray(seedOrStore) ? createLabExamEventStore(seedOrStore) : seedOrStore;
  const { rows } = store;

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
        id: input.id ?? nextUuid(rows.size + 101),
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

type TestDatabase = {
  transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
};

function createTestDatabase(onTransaction?: () => void): TestDatabase {
  return {
    async transaction(fn) {
      onTransaction?.();
      return fn({});
    }
  };
}

type TestRepositoryFactory<TRepository> = (database: unknown) => TRepository;

function createApp({
  labExamEventRepository = createLabExamEventRepository(),
  reminderRepository = createReminderRepository(),
  db = createTestDatabase(),
  labExamEventRepositoryFactory = () => labExamEventRepository,
  reminderRepositoryFactory = () => reminderRepository
}: {
  labExamEventRepository?: LabExamEventRepository;
  reminderRepository?: ReminderRepository;
  db?: TestDatabase;
  labExamEventRepositoryFactory?: TestRepositoryFactory<LabExamEventRepository>;
  reminderRepositoryFactory?: TestRepositoryFactory<ReminderRepository>;
} = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/lab-exam-events",
    createLabExamEventsRouter({
      authRepository: createAuthRepository(),
      db: db as unknown as Database,
      createLabExamEventRepository: labExamEventRepositoryFactory,
      createReminderRepository: reminderRepositoryFactory
    })
  );
  app.use(errorHandler);
  return app;
}

function authHeader(userId = user.id) {
  const token = jwt.sign({ sub: userId }, "test-secret-that-is-long-enough");
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

  it("synchronizes eventType changes to the linked reminder category", async () => {
    const app = createApp();
    const { event } = await createEvent(app);

    const response = await request(app)
      .put(`/api/lab-exam-events/${event.id}`)
      .set("Authorization", authHeader())
      .send({ eventType: "midterm" });

    expect(response.status).toBe(200);
    expect(response.body.event.eventType).toBe("midterm");
    expect(response.body.reminder.category).toBe("exam");
  });

  it("synchronizes startAt changes to linked reminder startAt and dueAt", async () => {
    const app = createApp();
    const { event } = await createEvent(app);
    const updatedStartAt = "2026-06-09T13:30:00.000Z";

    const response = await request(app)
      .put(`/api/lab-exam-events/${event.id}`)
      .set("Authorization", authHeader())
      .send({ startAt: updatedStartAt, endAt: "2026-06-09T15:30:00.000Z" });

    expect(response.status).toBe(200);
    expect(response.body.event.startAt).toBe(updatedStartAt);
    expect(response.body.reminder.startAt).toBe(updatedStartAt);
    expect(response.body.reminder.dueAt).toBe(updatedStartAt);
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

  it("deletes the event and soft-deletes the linked reminder", async () => {
    const reminderRepository = createReminderRepository();
    const app = createApp({ reminderRepository });
    const { event } = await createEvent(app);

    const response = await request(app)
      .delete(`/api/lab-exam-events/${event.id}`)
      .set("Authorization", authHeader());

    expect(response.status).toBe(204);
    const listResponse = await request(app).get("/api/lab-exam-events").set("Authorization", authHeader());
    expect(listResponse.body.events).toEqual([]);
    expect(await reminderRepository.listByUserId(user.id)).toEqual([]);
  });

  it("returns 404 when another user updates or deletes an event", async () => {
    const app = createApp();
    const { event } = await createEvent(app);

    const updateResponse = await request(app)
      .put(`/api/lab-exam-events/${event.id}`)
      .set("Authorization", authHeader(otherUser.id))
      .send({ title: "Other user update" });
    const deleteResponse = await request(app)
      .delete(`/api/lab-exam-events/${event.id}`)
      .set("Authorization", authHeader(otherUser.id));

    expect(updateResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
  });

  it("wraps lab exam event mutations in database transactions", async () => {
    let transactionCount = 0;
    const app = createApp({
      db: createTestDatabase(() => {
        transactionCount += 1;
      })
    });
    const { event } = await createEvent(app);

    await request(app)
      .put(`/api/lab-exam-events/${event.id}`)
      .set("Authorization", authHeader())
      .send({ title: "Transactional update" })
      .expect(200);
    await request(app)
      .patch(`/api/lab-exam-events/${event.id}/status`)
      .set("Authorization", authHeader())
      .send({ status: "done" })
      .expect(200);
    await request(app).delete(`/api/lab-exam-events/${event.id}`).set("Authorization", authHeader()).expect(204);

    expect(transactionCount).toBe(4);
  });

  it("rolls back linked reminder creation when event creation fails in a transaction", async () => {
    type TransactionState = {
      reminders: ReminderStore;
      events: LabExamEventStore;
    };

    const committedReminders = createReminderStore();
    const committedEvents = createLabExamEventStore();
    const db: TestDatabase = {
      async transaction(fn) {
        const txState: TransactionState = {
          reminders: cloneReminderStore(committedReminders),
          events: cloneLabExamEventStore(committedEvents)
        };

        const result = await fn(txState);
        commitReminderStore(committedReminders, txState.reminders);
        commitLabExamEventStore(committedEvents, txState.events);
        return result;
      }
    };
    const reminderRepositoryFactory = (database: unknown) =>
      createReminderRepository(database === db ? committedReminders : (database as TransactionState).reminders);
    const labExamEventRepositoryFactory = (database: unknown) => {
      const repository = createLabExamEventRepository(
        database === db ? committedEvents : (database as TransactionState).events
      );
      if (database === db) return repository;

      return {
        ...repository,
        async create(userId: string, input: LabExamEventInput) {
          await repository.create(userId, input);
          throw new Error("event write failed");
        }
      };
    };
    const app = createApp({
      db,
      reminderRepositoryFactory,
      labExamEventRepositoryFactory
    });

    const response = await request(app)
      .post("/api/lab-exam-events")
      .set("Authorization", authHeader())
      .send({
        title: "Transactional Failure",
        eventType: "midterm",
        startAt: "2026-06-08T09:00:00.000Z",
        endAt: "2026-06-08T10:00:00.000Z"
      });

    expect(response.status).toBe(500);
    expect(await createReminderRepository(committedReminders).listByUserId(user.id)).toEqual([]);
    expect(await createLabExamEventRepository(committedEvents).listByUserId(user.id)).toEqual([]);
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
