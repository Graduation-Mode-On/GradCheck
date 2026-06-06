import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import type { AuthRepository, UserRecord } from "../auth/auth.repository.js";
import { createCustomRequirementRouter } from "./custom-requirement.routes.js";
import type { CustomRequirementRepository } from "./custom-requirement.repository.js";
import type { CustomRequirementDto } from "./custom-requirement.types.js";

const now = new Date("2026-06-06T00:00:00.000Z");
const user: UserRecord = {
  id: "user-1",
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

function createRepository(): CustomRequirementRepository {
  const rows = new Map<string, CustomRequirementDto>();

  return {
    async listByUserId(userId) {
      return [...rows.values()].filter((row) => row.userId === userId);
    },
    async create(userId, input) {
      const row: CustomRequirementDto = {
        id: `00000000-0000-4000-8000-${String(rows.size + 1).padStart(12, "0")}`,
        userId,
        ...input,
        status: input.source === "pending_confirmation" ? "pending_confirmation" : "in_progress",
        progressPercent: 50,
        createdAt: now,
        updatedAt: now
      };
      rows.set(row.id, row);
      return row;
    },
    async update(userId, id, input) {
      const existing = rows.get(id);
      if (!existing || existing.userId !== userId) {
        return null;
      }

      const row: CustomRequirementDto = { ...existing, ...input, updatedAt: now };
      rows.set(id, row);
      return row;
    },
    async delete(userId, id) {
      const existing = rows.get(id);
      if (!existing || existing.userId !== userId) {
        return false;
      }

      rows.delete(id);
      return true;
    }
  };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/custom-requirements",
    createCustomRequirementRouter({
      authRepository: createAuthRepository(),
      customRequirementRepository: createRepository()
    })
  );
  app.use(errorHandler);
  return app;
}

describe("custom requirement routes", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
  });

  it("creates and lists a custom requirement with showOnHome enabled", async () => {
    const app = createApp();
    const token = jwt.sign({ sub: user.id }, "test-secret-that-is-long-enough");

    const createResponse = await request(app)
      .post("/api/custom-requirements")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "人文讲座",
        kind: "count",
        category: "lecture",
        targetValue: "4",
        currentValue: "2",
        unit: "次",
        importance: "required",
        source: "user_custom",
        includeInProgress: true,
        showOnHome: true,
        deadline: "2026-06-30",
        notes: "需要学院认定"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.customRequirement).toMatchObject({
      name: "人文讲座",
      kind: "count",
      showOnHome: true,
      includeInProgress: true
    });

    const listResponse = await request(app).get("/api/custom-requirements").set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.customRequirements).toHaveLength(1);
  });

  it("updates progress and deletes a custom requirement", async () => {
    const app = createApp();
    const token = jwt.sign({ sub: user.id }, "test-secret-that-is-long-enough");

    const createResponse = await request(app)
      .post("/api/custom-requirements")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "志愿服务",
        kind: "hours",
        category: "volunteer",
        targetValue: "20",
        currentValue: "5",
        unit: "小时",
        importance: "required",
        source: "user_custom",
        includeInProgress: true,
        showOnHome: false,
        deadline: null,
        notes: null
      });

    const id = createResponse.body.customRequirement.id as string;

    const updateResponse = await request(app)
      .put(`/api/custom-requirements/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ currentValue: "20", showOnHome: true });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.customRequirement).toMatchObject({ currentValue: "20", showOnHome: true });
    expect(updateResponse.body.customRequirement.name).toBe("志愿服务");
    expect(updateResponse.body.customRequirement.targetValue).toBe("20");
    expect(updateResponse.body.customRequirement.unit).toBe("小时");
    expect(updateResponse.body.customRequirement.includeInProgress).toBe(true);

    const toggleHomeResponse = await request(app)
      .put(`/api/custom-requirements/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ showOnHome: false });

    expect(toggleHomeResponse.status).toBe(200);
    expect(toggleHomeResponse.body.customRequirement.currentValue).toBe("20");
    expect(toggleHomeResponse.body.customRequirement.showOnHome).toBe(false);

    await request(app).delete(`/api/custom-requirements/${id}`).set("Authorization", `Bearer ${token}`).expect(204);
  });

  it("rejects invalid ids, out-of-range numeric values, and impossible deadlines", async () => {
    const app = createApp();
    const token = jwt.sign({ sub: user.id }, "test-secret-that-is-long-enough");

    const invalidIdResponse = await request(app)
      .put("/api/custom-requirements/not-a-uuid")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentValue: "1" });

    expect(invalidIdResponse.status).toBe(400);
    expect(invalidIdResponse.body.error.message).toBe("Custom requirement id must be a valid UUID");

    const outOfRangeResponse = await request(app)
      .post("/api/custom-requirements")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "超大目标",
        kind: "count",
        category: "other",
        targetValue: "1000000",
        currentValue: "0",
        unit: "次",
        importance: "required",
        source: "user_custom",
        includeInProgress: true,
        showOnHome: true,
        deadline: null,
        notes: null
      });

    expect(outOfRangeResponse.status).toBe(400);

    const invalidDeadlineResponse = await request(app)
      .post("/api/custom-requirements")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "错误日期",
        kind: "count",
        category: "other",
        targetValue: "1",
        currentValue: "0",
        unit: "次",
        importance: "required",
        source: "user_custom",
        includeInProgress: true,
        showOnHome: true,
        deadline: "2026-99-99",
        notes: null
      });

    expect(invalidDeadlineResponse.status).toBe(400);

    const zeroTargetResponse = await request(app)
      .post("/api/custom-requirements")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "零目标",
        kind: "count",
        category: "other",
        targetValue: "0",
        currentValue: "0",
        unit: "次",
        importance: "required",
        source: "user_custom",
        includeInProgress: true,
        showOnHome: true,
        deadline: null,
        notes: null
      });

    expect(zeroTargetResponse.status).toBe(400);
  });
});
