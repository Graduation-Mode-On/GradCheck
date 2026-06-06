import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import type { AuthRepository } from "./modules/auth/auth.repository.js";
import type { NewsRepository } from "./modules/news/news.repository.js";
import type { NewsItemRecord } from "./modules/news/news.types.js";
import type {
  CreatePlazaPostRecordInput,
  PlazaRepository
} from "./modules/plaza/plaza.repository.js";
import type {
  PlazaListQuery,
  UpdatePlazaPostInput
} from "./modules/plaza/plaza.schemas.js";
import type { PlazaPostStatus } from "./modules/plaza/plaza.types.js";
import type { UserProfile } from "./modules/users/user.repository.js";

const now = new Date("2026-06-06T00:00:00.000Z");

interface TestLecturePracticeProgress {
  userId: string;
  humanLectureCount: number;
  bookReportCount: number;
  socialPracticeCredits: string;
  socialPracticeCourseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TestVolunteerLaborProgress {
  userId: string;
  volunteerHours: string;
  ordinaryLaborCount: number;
  specialLaborCount: number;
  createdAt: Date;
  updatedAt: Date;
}

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

    function createLecturePracticeRepository() {
      const progressByUser = new Map<string, TestLecturePracticeProgress>();

      return {
        async getProgress(userId: string) {
          return (
            progressByUser.get(userId) ?? {
              userId,
              humanLectureCount: 0,
              bookReportCount: 0,
              socialPracticeCredits: "0.00",
              socialPracticeCourseCount: 0,
              createdAt: now,
              updatedAt: now
            }
          );
        },
        async upsertProgress(
          userId: string,
          input: Omit<TestLecturePracticeProgress, "userId" | "createdAt" | "updatedAt">
        ) {
          const progress: TestLecturePracticeProgress = {
            userId,
            ...input,
            createdAt: progressByUser.get(userId)?.createdAt ?? now,
            updatedAt: now
          };
          progressByUser.set(userId, progress);
          return progress;
        }
      };
    }

    function createVolunteerLaborRepository() {
      const progressByUser = new Map<string, TestVolunteerLaborProgress>();

      return {
        async getProgress(userId: string) {
          return (
            progressByUser.get(userId) ?? {
              userId,
              volunteerHours: "0.00",
              ordinaryLaborCount: 0,
              specialLaborCount: 0,
              createdAt: now,
              updatedAt: now
            }
          );
        },
        async upsertProgress(
          userId: string,
          input: Omit<TestVolunteerLaborProgress, "userId" | "createdAt" | "updatedAt">
        ) {
          const progress: TestVolunteerLaborProgress = {
            userId,
            ...input,
            createdAt: progressByUser.get(userId)?.createdAt ?? now,
            updatedAt: now
          };
          progressByUser.set(userId, progress);
          return progress;
        }
      };
    }

    describe("GradCheck API baseline", () => {
      function createTestApp() {
        return createApp({
          authRepository: createRepository(),
          plazaRepository: createPlazaRepository(),
          lecturePracticeRepository: createLecturePracticeRepository(),
          volunteerLaborRepository: createVolunteerLaborRepository()
        });
      }

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

  interface TestPlazaPost {
    id: string;
    authorUserId: string;
    type: "course_exchange" | "team_recruit";
    title: string;
    college: string;
    contact: string;
    description: string;
    tags: string[];
    status: "open" | "closed";
    offeredCourse: string | null;
    wantedCourse: string | null;
    courseTime: string | null;
    teamPurpose: string | null;
    projectType: string | null;
    teammateRequirements: string | null;
    currentMembers: number | null;
    targetMembers: number | null;
    activityTime: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }

  function withTypeSpecificFields(input: CreatePlazaPostRecordInput | UpdatePlazaPostInput) {
    return {
      offeredCourse: input.type === "course_exchange" ? input.offeredCourse : null,
      wantedCourse: input.type === "course_exchange" ? input.wantedCourse : null,
      courseTime: input.type === "course_exchange" ? input.courseTime : null,
      teamPurpose: input.type === "team_recruit" ? input.teamPurpose : null,
      projectType: input.type === "team_recruit" ? input.projectType : null,
      teammateRequirements: input.type === "team_recruit" ? input.teammateRequirements : null,
      currentMembers: input.type === "team_recruit" ? input.currentMembers : null,
      targetMembers: input.type === "team_recruit" ? input.targetMembers : null,
      activityTime: input.type === "team_recruit" ? input.activityTime : null
    };
  }

  function createNewsRepository(): NewsRepository {
    const items = new Map<string, NewsItemRecord>();

    return {
      async listItems(filters) {
        let visible = [...items.values()].filter((item) => item.status === "active");
        if (filters.type) visible = visible.filter((item) => item.type === filters.type);
        if (filters.keyword) {
          const keyword = filters.keyword.toLowerCase();
          visible = visible.filter((item) =>
            [item.title, item.organizer ?? "", item.description ?? ""].some((value) =>
              value.toLowerCase().includes(keyword)
            )
          );
        }
        visible.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id));
        const start = filters.cursor ? visible.findIndex((item) => item.id === filters.cursor) + 1 : 0;
        const page = visible.slice(start, start + filters.limit);
        const nextCursor = visible[start + filters.limit]?.id ?? null;
        return { items: page, nextCursor };
      },
      async findItemById(id: string) {
        return items.get(id) ?? null;
      },
      async createItem(values) {
        const item: NewsItemRecord = {
          id: `news-${items.size + 1}`,
          ...values,
          createdAt: now,
          updatedAt: now
        };
        items.set(item.id, item);
        return item;
      }
    };
  }

  function createPlazaRepository(): PlazaRepository {
    const posts = new Map<string, TestPlazaPost>();

    return {
      async createPost(input) {
        const post: TestPlazaPost = {
          id: `post-${posts.size + 1}`,
          authorUserId: input.authorUserId,
          type: input.type,
          title: input.title,
          college: input.college,
          contact: input.contact,
          description: input.description,
          tags: input.tags,
          status: input.status,
          ...withTypeSpecificFields(input),
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        };
        posts.set(post.id, post);
        return post;
      },
      async listPosts(filters: PlazaListQuery) {
        const normalized = (value: string | null) => value?.toLowerCase() ?? "";
        let visible = [...posts.values()].filter((post) => !post.deletedAt);
        visible = visible.filter((post) => post.status === (filters.status ?? "open"));
        if (filters.type) visible = visible.filter((post) => post.type === filters.type);
        if (filters.keyword) {
          const keyword = filters.keyword.toLowerCase();
          visible = visible.filter((post) =>
            [
              post.title,
              post.description,
              post.contact
            ].some((value) => normalized(value).includes(keyword))
          );
        }
        visible.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id));
        const start = filters.cursor ? visible.findIndex((post) => post.id === filters.cursor) + 1 : 0;
        const page = visible.slice(start, start + filters.limit);
        const nextCursor = visible[start + filters.limit]?.id ?? null;
        return { posts: page, nextCursor };
      },
      async findPostById(id: string) {
        const post = posts.get(id);
        return post && !post.deletedAt ? post : null;
      },
      async updatePost(id: string, input: UpdatePlazaPostInput) {
        const existing = posts.get(id);
        if (!existing || existing.deletedAt) return null;
        const post: TestPlazaPost = {
          ...existing,
          type: input.type,
          title: input.title,
          college: input.college,
          contact: input.contact,
          description: input.description,
          tags: input.tags,
          ...withTypeSpecificFields(input),
          updatedAt: now
        };
        posts.set(id, post);
        return post;
      },
      async updatePostStatus(id: string, status: PlazaPostStatus) {
        const existing = posts.get(id);
        if (!existing || existing.deletedAt) return null;
        const post = { ...existing, status, updatedAt: now };
        posts.set(id, post);
        return post;
      },
      async softDeletePost(id: string) {
        const existing = posts.get(id);
        if (!existing || existing.deletedAt) return false;
        posts.set(id, { ...existing, deletedAt: now, updatedAt: now });
        return true;
      }
    };
  }

  async function registerAndToken(app: ReturnType<typeof createApp>, email: string) {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        email,
        password: "password123",
        profile: {
          displayName: email.split("@")[0],
          college: "计算机科学与工程学院",
          major: "软件工程",
          grade: 2022,
          gpaGoal: "3.70"
        }
      });
    return response.body.token as string;
  }

  describe("plaza API", () => {
    beforeEach(() => {
      vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
    });

    it("creates and lists course exchange posts for authenticated users", async () => {
const app = createTestApp();
      const token = await registerAndToken(app, "owner@example.com");

      const createResponse = await request(app)
        .post("/api/plaza/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: "course_exchange",
          title: "想换软件工程实践课",
          college: "计算机科学与工程学院",
          contact: "QQ 123456",
          description: "时间冲突，想换同课程其他班。",
          tags: ["换课", "软件工程"],
          offeredCourse: "软件工程实践 周一 1-2 节",
          wantedCourse: "软件工程实践 周三 3-4 节",
          courseTime: "周一 1-2 节"
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.post).toMatchObject({
        type: "course_exchange",
        title: "想换软件工程实践课",
        status: "open",
        authorDisplayName: "owner",
        offeredCourse: "软件工程实践 周一 1-2 节",
        wantedCourse: "软件工程实践 周三 3-4 节"
      });

      const listResponse = await request(app)
        .get("/api/plaza/posts?type=course_exchange&course=软件工程&tag=换课")
        .set("Authorization", `Bearer ${token}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.posts).toHaveLength(1);
      expect(listResponse.body.nextCursor).toBeNull();
    });

    it("matches plaza keyword only against title, description, and contact", async () => {
const app = createTestApp();
      const token = await registerAndToken(app, "keyword-owner@example.com");

      await request(app)
        .post("/api/plaza/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: "course_exchange",
          title: "想换数据库课程",
          college: "计算机科学与工程学院",
          contact: "QQ 123456",
          description: "只搜索这里的正文",
          tags: ["标签唯一词"],
          offeredCourse: "课程唯一词",
          wantedCourse: "另一个课程唯一词",
          courseTime: "时间唯一词"
        })
        .expect(201);

      const titleResponse = await request(app)
        .get("/api/plaza/posts?keyword=数据库")
        .set("Authorization", `Bearer ${token}`);
      const courseResponse = await request(app)
        .get("/api/plaza/posts?keyword=课程唯一词")
        .set("Authorization", `Bearer ${token}`);
      const tagResponse = await request(app)
        .get("/api/plaza/posts?keyword=标签唯一词")
        .set("Authorization", `Bearer ${token}`);
      const timeResponse = await request(app)
        .get("/api/plaza/posts?keyword=时间唯一词")
        .set("Authorization", `Bearer ${token}`);

      expect(titleResponse.body.posts).toHaveLength(1);
      expect(courseResponse.body.posts).toHaveLength(0);
      expect(tagResponse.body.posts).toHaveLength(0);
      expect(timeResponse.body.posts).toHaveLength(0);
    });

    it("creates team recruiting posts and rejects invalid member counts", async () => {
const app = createTestApp();
      const token = await registerAndToken(app, "leader@example.com");

      const invalidResponse = await request(app)
        .post("/api/plaza/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: "team_recruit",
          title: "数学建模组队",
          college: "计算机科学与工程学院",
          contact: "微信 gradcheck",
          description: "准备参加数学建模。",
          tags: ["竞赛"],
          teamPurpose: "数学建模竞赛",
          projectType: "竞赛",
          teammateRequirements: "会 Python 或建模",
          currentMembers: 4,
          targetMembers: 3,
          activityTime: "暑假"
        });

      expect(invalidResponse.status).toBe(400);

      const createResponse = await request(app)
        .post("/api/plaza/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: "team_recruit",
          title: "数学建模组队",
          college: "计算机科学与工程学院",
          contact: "微信 gradcheck",
          description: "准备参加数学建模。",
          tags: ["竞赛"],
          teamPurpose: "数学建模竞赛",
          projectType: "竞赛",
          teammateRequirements: "会 Python 或建模",
          currentMembers: 2,
          targetMembers: 3,
          activityTime: "暑假"
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.post).toMatchObject({
        type: "team_recruit",
        currentMembers: 2,
        targetMembers: 3,
        authorDisplayName: "leader"
      });
    });

    it("allows only the author to edit, close, reopen, and soft-delete posts", async () => {
const app = createTestApp();
      const ownerToken = await registerAndToken(app, "post-owner@example.com");
      const otherToken = await registerAndToken(app, "other@example.com");

      const createResponse = await request(app)
        .post("/api/plaza/posts")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          type: "course_exchange",
          title: "换高数习题课",
          college: "数学学院",
          contact: "QQ 8888",
          description: "想换到晚上。",
          tags: ["高数"],
          offeredCourse: "高数习题 周二 1-2 节",
          wantedCourse: "高数习题 周四 9-10 节",
          courseTime: "周二 1-2 节"
        });
      const postId = createResponse.body.post.id as string;

      await request(app)
        .put(`/api/plaza/posts/${postId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({
          type: "course_exchange",
          title: "别人改标题",
          college: "数学学院",
          contact: "QQ 9999",
          description: "不该成功。",
          tags: ["高数"],
          offeredCourse: "高数习题 周二 1-2 节",
          wantedCourse: "高数习题 周四 9-10 节",
          courseTime: "周二 1-2 节"
        })
        .expect(403);

      const closeResponse = await request(app)
        .patch(`/api/plaza/posts/${postId}/status`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "closed" });
      expect(closeResponse.status).toBe(200);
      expect(closeResponse.body.post.status).toBe("closed");

      const reopenResponse = await request(app)
        .patch(`/api/plaza/posts/${postId}/status`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "open" });
      expect(reopenResponse.status).toBe(200);
      expect(reopenResponse.body.post.status).toBe("open");

      await request(app).delete(`/api/plaza/posts/${postId}`).set("Authorization", `Bearer ${ownerToken}`).expect(200);

      const listResponse = await request(app).get("/api/plaza/posts").set("Authorization", `Bearer ${ownerToken}`);
      expect(listResponse.body.posts).toHaveLength(0);
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

  describe("lecture practice and volunteer labor API", () => {
    beforeEach(() => {
      vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
    });

    it("requires authentication for lecture practice and volunteer labor progress", async () => {
      const app = createTestApp();

      await request(app).get("/api/lecture-practice/me").expect(401);
      await request(app).get("/api/volunteer-labor/me").expect(401);
    });

    it("returns default lecture practice progress and persists updates", async () => {
      const app = createTestApp();
      const token = await registerAndToken(app, "lecture-owner@example.com");

      const defaultResponse = await request(app)
        .get("/api/lecture-practice/me")
        .set("Authorization", `Bearer ${token}`);

      expect(defaultResponse.status).toBe(200);
      expect(defaultResponse.body.progress).toMatchObject({
        humanLectureCount: 0,
        bookReportCount: 0,
        socialPracticeCredits: "0.00",
        socialPracticeCourseCount: 0
      });

      const updateResponse = await request(app)
        .put("/api/lecture-practice/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          humanLectureCount: 8,
          bookReportCount: 2,
          socialPracticeCredits: "3.00",
          socialPracticeCourseCount: 1
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.progress).toMatchObject({
        humanLectureCount: 8,
        bookReportCount: 2,
        socialPracticeCredits: "3.00",
        socialPracticeCourseCount: 1
      });

      const savedResponse = await request(app)
        .get("/api/lecture-practice/me")
        .set("Authorization", `Bearer ${token}`);

      expect(savedResponse.body.progress).toMatchObject(updateResponse.body.progress);
    });

    it("rejects invalid lecture practice values", async () => {
      const app = createTestApp();
      const token = await registerAndToken(app, "invalid-lecture@example.com");

      await request(app)
        .put("/api/lecture-practice/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          humanLectureCount: -1,
          bookReportCount: 2,
          socialPracticeCredits: "1.00",
          socialPracticeCourseCount: 1
        })
        .expect(400);

      await request(app)
        .put("/api/lecture-practice/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          humanLectureCount: 1.5,
          bookReportCount: 2,
          socialPracticeCredits: "1.00",
          socialPracticeCourseCount: 1
        })
        .expect(400);
    });

    it("returns default volunteer labor progress and persists updates", async () => {
      const app = createTestApp();
      const token = await registerAndToken(app, "volunteer-owner@example.com");

      const defaultResponse = await request(app)
        .get("/api/volunteer-labor/me")
        .set("Authorization", `Bearer ${token}`);

      expect(defaultResponse.status).toBe(200);
      expect(defaultResponse.body.progress).toMatchObject({
        volunteerHours: "0.00",
        ordinaryLaborCount: 0,
        specialLaborCount: 0
      });

      const updateResponse = await request(app)
        .put("/api/volunteer-labor/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          volunteerHours: "12.00",
          ordinaryLaborCount: 2,
          specialLaborCount: 1
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.progress).toMatchObject({
        volunteerHours: "12.00",
        ordinaryLaborCount: 2,
        specialLaborCount: 1
      });

      const savedResponse = await request(app)
        .get("/api/volunteer-labor/me")
        .set("Authorization", `Bearer ${token}`);

      expect(savedResponse.body.progress).toMatchObject(updateResponse.body.progress);
    });

    it("rejects invalid volunteer labor values", async () => {
      const app = createTestApp();
      const token = await registerAndToken(app, "invalid-volunteer@example.com");

      await request(app)
        .put("/api/volunteer-labor/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          volunteerHours: "-1.00",
          ordinaryLaborCount: 2,
          specialLaborCount: 1
        })
        .expect(400);

      await request(app)
        .put("/api/volunteer-labor/me")
        .set("Authorization", `Bearer ${token}`)
        .send({
          volunteerHours: "12.00",
          ordinaryLaborCount: 1.5,
          specialLaborCount: 1
        })
        .expect(400);
    });
  });
});
