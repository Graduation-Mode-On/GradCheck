import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import type { AuthRepository } from "./modules/auth/auth.repository.js";
import type { UserProfile } from "./modules/users/user.repository.js";

const now = new Date("2026-06-06T00:00:00.000Z");

function createRepository(): AuthRepository {
  const users = new Map<string, Parameters<AuthRepository["createUser"]>[0] & { id: string; createdAt: Date; updatedAt: Date }>();
  const profiles = new Map<string, UserProfile>();

  return {
    async findUserByEmail(email) {
      return [...users.values()].find((user) => user.email === email) ?? null;
    },
    async findUserById(id) {
      return users.get(id) ?? null;
    },
    async createUser(input) {
      const user = {
        id: `user-${users.size + 1}`,
        email: input.email,
        passwordHash: input.passwordHash,
        createdAt: now,
        updatedAt: now
      };
      users.set(user.id, user);
      return user;
    },
    async getProfile(userId) {
      return profiles.get(userId) ?? null;
    },
    async upsertProfile(userId, input) {
      const profile: UserProfile = {
        userId,
        displayName: input.displayName,
        college: input.college,
        major: input.major,
        grade: input.grade,
        gpaGoal: input.gpaGoal,
        createdAt: now,
        updatedAt: now
      };
      profiles.set(userId, profile);
      return profile;
    },
    async recordAuditLog() {
      return;
    }
  };
}

describe("GradCheck API baseline", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
  });

  it("returns health status", async () => {
    const app = createApp({ authRepository: createRepository() });

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "gradcheck-backend" });
  });

  it("registers a user, returns the current user, and updates profile data", async () => {
    const app = createApp({ authRepository: createRepository() });

    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        email: "student@example.com",
        password: "password123",
        profile: {
          displayName: "东大学生",
          college: "计算机科学与工程学院",
          major: "软件工程",
          grade: 2022,
          gpaGoal: "3.70"
        }
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.token).toEqual(expect.any(String));
    expect(registerResponse.body.user).toMatchObject({
      email: "student@example.com",
      profile: {
        displayName: "东大学生",
        college: "计算机科学与工程学院",
        major: "软件工程",
        grade: 2022,
        gpaGoal: "3.70"
      }
    });

    const token = registerResponse.body.token as string;

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: "student@example.com", password: "password123" });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.email).toBe("student@example.com");
    expect(loginResponse.body.token).toEqual(expect.any(String));

    const meResponse = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.email).toBe("student@example.com");

    const profileResponse = await request(app)
      .put("/api/users/me/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({
        displayName: "GradCheck 用户",
        college: "计算机科学与工程学院",
        major: "计算机科学与技术",
        grade: 2023,
        gpaGoal: "3.90"
      });

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.profile).toMatchObject({
      displayName: "GradCheck 用户",
      college: "计算机科学与工程学院",
      major: "计算机科学与技术",
      grade: 2023,
      gpaGoal: "3.90"
    });
  });

  it("rejects duplicate registration and unauthenticated profile access", async () => {
    const app = createApp({ authRepository: createRepository() });
    const payload = { email: "student@example.com", password: "password123" };

    await request(app).post("/api/auth/register").send(payload).expect(201);
    const duplicateResponse = await request(app).post("/api/auth/register").send(payload);
    const unauthenticatedResponse = await request(app).get("/api/auth/me");

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body).toEqual({ error: { message: "Email is already registered" } });
    expect(unauthenticatedResponse.status).toBe(401);
    expect(unauthenticatedResponse.body).toEqual({ error: { message: "Authorization bearer token is required" } });
  });
});
