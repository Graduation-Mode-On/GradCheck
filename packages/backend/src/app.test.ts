import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import type { AuthRepository } from "./modules/auth/auth.repository.js";
import { createGpaCourse } from "./modules/gpa/gpa.service.js";
import type { GpaCalculationResult, GpaCourse, GpaCourseInput, PersistedGpaCalculationResult } from "./modules/gpa/gpa.types.js";
import type { GpaRepository } from "./modules/gpa/gpa.repository.js";
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

function createGpaRepository(): GpaRepository {
  const courses = new Map<string, GpaCourse>();
  const results = new Map<string, PersistedGpaCalculationResult>();

  return {
    async listCourses(userId) {
      return [...courses.values()].filter((course) => course.userId === userId);
    },
    async findCourse(userId, courseId) {
      const course = courses.get(courseId);
      return course?.userId === userId ? course : null;
    },
    async createCourse(userId, input: GpaCourseInput) {
      const course: GpaCourse = {
        id: `course-${courses.size + 1}`,
        userId,
        ...input,
        createdAt: now,
        updatedAt: now
      };
      courses.set(course.id, course);
      return course;
    },
    async updateCourse(userId, courseId, input) {
      const existing = courses.get(courseId);
      if (!existing || existing.userId !== userId) {
        return null;
      }

      const updated: GpaCourse = {
        ...existing,
        ...input,
        updatedAt: now
      };
      courses.set(courseId, updated);
      return updated;
    },
    async deleteCourse(userId, courseId) {
      const existing = courses.get(courseId);
      if (!existing || existing.userId !== userId) {
        return false;
      }

      courses.delete(courseId);
      return true;
    },
    async getLatestResult(userId) {
      return results.get(userId) ?? null;
    },
    async upsertLatestResult(userId, result: GpaCalculationResult) {
      const persisted: PersistedGpaCalculationResult = {
        userId,
        ...result,
        createdAt: results.get(userId)?.createdAt ?? now,
        updatedAt: now
      };
      results.set(userId, persisted);
      return persisted;
    }
  };
}

function createTestApp() {
  return createApp({
    authRepository: createRepository(),
    gpaRepository: createGpaRepository()
  });
}

describe("GradCheck API baseline", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
  });

  it("returns health status", async () => {
    const app = createTestApp();

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "gradcheck-backend" });
  });

  it("registers a user, returns the current user, and updates profile data", async () => {
    const app = createTestApp();

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
    const app = createTestApp();
    const payload = { email: "student@example.com", password: "password123" };

    await request(app).post("/api/auth/register").send(payload).expect(201);
    const duplicateResponse = await request(app).post("/api/auth/register").send(payload);
    const unauthenticatedResponse = await request(app).get("/api/auth/me");

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body).toEqual({ error: { message: "Email is already registered" } });
    expect(unauthenticatedResponse.status).toBe(401);
    expect(unauthenticatedResponse.body).toEqual({ error: { message: "Authorization bearer token is required" } });
  });

  it("persists GPA courses and recalculates latest results after changes", async () => {
    const app = createTestApp();

    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({ email: "gpa@example.com", password: "password123" })
      .expect(201);
    const token = registerResponse.body.token as string;

    const emptyResponse = await request(app).get("/api/gpa").set("Authorization", `Bearer ${token}`).expect(200);
    expect(emptyResponse.body).toEqual({
      courses: [],
      result: {
        requiredFirstAttempt: {
          weightedGpa: null,
          weightedAverageScore: null,
          totalCredits: 0,
          courseCount: 0
        },
        overall: {
          weightedGpa: null,
          weightedAverageScore: null,
          totalCredits: 0,
          courseCount: 0
        }
      }
    });

    const createResponse = await request(app)
      .post("/api/gpa/courses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        term: "2025-2026 春",
        name: "高等数学",
        credit: "3.00",
        score: "96.00",
        isRequired: true,
        isFirstAttempt: true,
        isGpaEligible: true
      })
      .expect(201);

    expect(createResponse.body.courses).toHaveLength(1);
    expect(createResponse.body.result.requiredFirstAttempt).toEqual({
      weightedGpa: 4.8,
      weightedAverageScore: 96,
      totalCredits: 3,
      courseCount: 1
    });

    const courseId = createResponse.body.courses[0].id as string;
    const updateResponse = await request(app)
      .put(`/api/gpa/courses/${courseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        term: "2025-2026 秋",
        name: "高等数学",
        credit: "3.00",
        score: "90.00",
        isRequired: true,
        isFirstAttempt: true,
        isGpaEligible: true
      })
      .expect(200);

    expect(updateResponse.body.result.requiredFirstAttempt.weightedGpa).toBe(4);
    expect(updateResponse.body.result.requiredFirstAttempt.weightedAverageScore).toBe(90);

    const deleteResponse = await request(app)
      .delete(`/api/gpa/courses/${courseId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(deleteResponse.body.courses).toEqual([]);
    expect(deleteResponse.body.result.overall.weightedGpa).toBeNull();
  });

  it("does not allow users to update another user's GPA course", async () => {
    const app = createTestApp();

    const firstUser = await request(app)
      .post("/api/auth/register")
      .send({ email: "owner@example.com", password: "password123" })
      .expect(201);
    const secondUser = await request(app)
      .post("/api/auth/register")
      .send({ email: "other@example.com", password: "password123" })
      .expect(201);

    const createResponse = await request(app)
      .post("/api/gpa/courses")
      .set("Authorization", `Bearer ${firstUser.body.token}`)
      .send({
        term: "2025-2026 春",
        name: "大学物理",
        credit: "2.00",
        score: "88.00",
        isRequired: true,
        isFirstAttempt: true,
        isGpaEligible: true
      })
      .expect(201);

    const courseId = createResponse.body.courses[0].id as string;

    await request(app)
      .put(`/api/gpa/courses/${courseId}`)
      .set("Authorization", `Bearer ${secondUser.body.token}`)
      .send({
        term: "2025-2026 春",
        name: "大学物理",
        credit: "2.00",
        score: "100.00",
        isRequired: true,
        isFirstAttempt: true,
        isGpaEligible: true
      })
      .expect(404);
  });

  it("calculates the GPA dashboard from courses when the stored result is stale", async () => {
    const staleResult: PersistedGpaCalculationResult = {
      userId: "user-1",
      requiredFirstAttempt: {
        weightedGpa: null,
        weightedAverageScore: null,
        totalCredits: 0,
        courseCount: 0
      },
      overall: {
        weightedGpa: null,
        weightedAverageScore: null,
        totalCredits: 0,
        courseCount: 0
      },
      createdAt: now,
      updatedAt: now
    };
    const course: GpaCourse = {
      id: "course-1",
      userId: "user-1",
      term: "2025-2026 春",
      name: "线性代数",
      credit: "2.00",
      score: "93.00",
      isRequired: true,
      isFirstAttempt: true,
      isGpaEligible: true,
      createdAt: now,
      updatedAt: now
    };
    const gpaRepository = createGpaRepository();
    await gpaRepository.createCourse("user-1", course);
    await gpaRepository.upsertLatestResult("user-1", staleResult);
    const app = createApp({
      authRepository: createRepository(),
      gpaRepository
    });

    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({ email: "fresh@example.com", password: "password123" })
      .expect(201);

    const response = await request(app)
      .get("/api/gpa")
      .set("Authorization", `Bearer ${registerResponse.body.token}`)
      .expect(200);

    expect(response.body.result.requiredFirstAttempt).toEqual({
      weightedGpa: 4.5,
      weightedAverageScore: 93,
      totalCredits: 2,
      courseCount: 1
    });
  });

  it("returns not found when the repository rejects a malformed GPA course id", async () => {
    const gpaRepository = createGpaRepository();
    gpaRepository.updateCourse = async () => {
      throw Object.assign(new Error("invalid input syntax for type uuid"), { code: "22P02" });
    };
    const app = createApp({
      authRepository: createRepository(),
      gpaRepository
    });

    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({ email: "malformed@example.com", password: "password123" })
      .expect(201);

    const response = await request(app)
      .put("/api/gpa/courses/not-a-uuid")
      .set("Authorization", `Bearer ${registerResponse.body.token}`)
      .send({
        term: "2025-2026 春",
        name: "概率论",
        credit: "2.00",
        score: "85.00",
        isRequired: true,
        isFirstAttempt: true,
        isGpaEligible: true
      })
      .expect(404);

    expect(response.body).toEqual({ error: { message: "GPA course was not found" } });
  });

  it("serializes concurrent GPA mutations so the latest result is not overwritten by a stale recalculation", async () => {
    const baseRepository = createGpaRepository();
    let firstUpsertStarted!: () => void;
    let releaseFirstUpsert!: () => void;
    let createCount = 0;
    let secondCreateStarted = false;
    let upsertCount = 0;
    const firstUpsertStartedPromise = new Promise<void>((resolve) => {
      firstUpsertStarted = resolve;
    });
    const releaseFirstUpsertPromise = new Promise<void>((resolve) => {
      releaseFirstUpsert = resolve;
    });
    const gpaRepository: GpaRepository = {
      ...baseRepository,
      async createCourse(userId, input) {
        createCount += 1;
        if (createCount === 2) {
          secondCreateStarted = true;
        }

        return baseRepository.createCourse(userId, input);
      },
      async upsertLatestResult(userId, result) {
        upsertCount += 1;
        if (upsertCount === 1) {
          firstUpsertStarted();
          await releaseFirstUpsertPromise;
        }

        return baseRepository.upsertLatestResult(userId, result);
      }
    };

    const firstCreate = createGpaCourse(gpaRepository, "user-1", {
      term: "2025-2026 春",
      name: "离散数学",
      credit: "2.00",
      score: "96.00",
      isRequired: true,
      isFirstAttempt: true,
      isGpaEligible: true
    });

    await firstUpsertStartedPromise;

    const secondCreate = createGpaCourse(gpaRepository, "user-1", {
      term: "2025-2026 春",
      name: "数据结构",
      credit: "3.00",
      score: "90.00",
      isRequired: true,
      isFirstAttempt: true,
      isGpaEligible: true
    });

    try {
      expect(secondCreateStarted).toBe(false);
    } finally {
      releaseFirstUpsert();
    }
    await Promise.all([firstCreate, secondCreate]);

    const latestResult = await baseRepository.getLatestResult("user-1");
    expect(latestResult?.overall.courseCount).toBe(2);
  });
});
