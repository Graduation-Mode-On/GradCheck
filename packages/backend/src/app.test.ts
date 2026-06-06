import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp, type AppDependencies } from "./app.js";
import type { AuthRepository } from "./modules/auth/auth.repository.js";
import type { CustomRequirementRepository } from "./modules/custom-requirements/custom-requirement.repository.js";
import { calculateGpaResult } from "./modules/gpa/gpa.calculator.js";
import { matchGpaCourseToPlanRequirement } from "./modules/gpa/course-plan-matcher.js";
import type { GpaDashboard, GpaRepository } from "./modules/gpa/gpa.repository.js";
import type { GpaCourse, GpaCourseInput } from "./modules/gpa/gpa.types.js";
import type { LabExamEventRepository } from "./modules/lab-exam-events/lab-exam-events.types.js";
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
import type { ProgramPlanBinding, ProgramPlanRepository } from "./modules/program-plans/program-plans.repository.js";
import type { CurriculumPlan, ProgramPlanSummary } from "./modules/program-plans/program-plans.schemas.js";
import { normalizeProgramPlanCourses } from "./modules/program-plans/program-plan-normalizer.js";
import type { ReminderRepository } from "./modules/reminders/reminders.types.js";
import type { SrtpRepository } from "./modules/srtp/srtp.repository.js";
import type { SrtpRecord, SrtpRecordInput } from "./modules/srtp/srtp.schemas.js";
import type { SportsRepository } from "./modules/sports/sports.repository.js";
import type { UserProfile } from "./modules/users/user.repository.js";
import { HttpError } from "./lib/http-error.js";

const now = new Date("2026-06-06T00:00:00.000Z");
const testPlanCoursesByUser = new Map<
  string,
  Array<{ id: string; code: string; name: string; credits: string; requirementType: string }>
>();
const testPlanGroupsByUser = new Map<string, Array<{ id: string; name: string; requirementType: string }>>();

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

interface TestSportsProgress {
  userId: string;
  currentRuns: number;
  targetRuns: number;
  lastRunDate?: string | null;
  runDates: string[];
  createdAt: Date;
  updatedAt: Date;
}

function createProgramPlanRepository(): ProgramPlanRepository {
  const plans = new Map<string, ProgramPlanSummary>();
  const bindings = new Map<string, ProgramPlanBinding>();
  const normalizedStats = new Map<string, { groupCount: number; courseCount: number }>();

  return {
    async createAndBind(userId: string, sourceFilename: string, planJson: CurriculumPlan) {
      const plan: ProgramPlanSummary = {
        id: `program-plan-${plans.size + 1}`,
        sourceFilename,
        school: planJson.program.school,
        college: planJson.program.college ?? null,
        major: planJson.program.major,
        grade: planJson.program.grade ?? null,
        totalCredits: planJson.program.total_credits == null ? null : String(planJson.program.total_credits),
        courseCount: planJson.courses.length,
        requirementCount: planJson.requirements.length,
        warningCount: planJson.warnings.length,
        planJson,
        createdAt: now,
        updatedAt: now
      };
      plans.set(plan.id, plan);
      const normalized = normalizeProgramPlanCourses(planJson);
      normalizedStats.set(plan.id, { groupCount: normalized.groups.length, courseCount: normalized.courses.length });
      testPlanGroupsByUser.set(
        userId,
        normalized.groups.map((group, index) => ({
          id: `plan-group-${plans.size + 1}-${index + 1}`,
          name: group.name,
          requirementType: group.requirementType
        }))
      );
      testPlanCoursesByUser.set(
        userId,
        normalized.courses.map((course, index) => ({
          id: `plan-course-${plans.size + 1}-${index + 1}`,
          code: course.code,
          name: course.name,
          credits: course.credits,
          requirementType: course.requirementType
        }))
      );
      const binding: ProgramPlanBinding = {
        userId,
        programPlanId: plan.id,
        confirmedAt: now,
        createdAt: bindings.get(userId)?.createdAt ?? now,
        updatedAt: now
      };
      bindings.set(userId, binding);
      return { plan, binding, normalized: normalizedStats.get(plan.id) ?? { groupCount: 0, courseCount: 0 } };
    },
    async getNormalizedStats(programPlanId: string) {
      return normalizedStats.get(programPlanId) ?? null;
    },
    async backfillNormalizedCourses() {
      for (const plan of plans.values()) {
        const normalized = normalizeProgramPlanCourses(plan.planJson);
        normalizedStats.set(plan.id, { groupCount: normalized.groups.length, courseCount: normalized.courses.length });
      }
      return { planCount: plans.size };
    },
    async getBoundPlan(userId: string) {
      const binding = bindings.get(userId);
      return binding ? (plans.get(binding.programPlanId) ?? null) : null;
    },
    async listReusablePlans() {
      return [...plans.values()];
    },
    async bindExistingPlan(userId: string, programPlanId: string) {
      const plan = plans.get(programPlanId);
      if (!plan) return null;
      const binding: ProgramPlanBinding = {
        userId,
        programPlanId,
        confirmedAt: now,
        createdAt: bindings.get(userId)?.createdAt ?? now,
        updatedAt: now
      };
      bindings.set(userId, binding);
      return { plan, binding };
    }
  };
}

function createSrtpRepository(): SrtpRepository {
  const records = new Map<string, SrtpRecord>();

  return {
    async listRecords(userId) {
      return [...records.values()]
        .filter((record) => record.userId === userId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id));
    },
    async createRecord(userId: string, input: SrtpRecordInput) {
      const record: SrtpRecord = {
        id: `00000000-0000-0000-0000-${String(records.size + 1).padStart(12, "0")}`,
        userId,
        ...input,
        createdAt: now,
        updatedAt: now
      };
      records.set(record.id, record);
      return record;
    },
    async updateRecord(userId: string, id: string, input: SrtpRecordInput) {
      const existing = records.get(id);
      if (!existing || existing.userId !== userId) return null;
      const record = { ...existing, ...input, updatedAt: now };
      records.set(id, record);
      return record;
    },
    async deleteRecord(userId: string, id: string) {
      const existing = records.get(id);
      if (!existing || existing.userId !== userId) return false;
      records.delete(id);
      return true;
    }
  };
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
      const existingForStudentId = [...profiles.values()].find(
        (entry) => entry.studentId === input.studentId && entry.userId !== userId
      );
      if (existingForStudentId) {
        throw new HttpError(409, "该学生一卡通已被其他账号使用");
      }

      const profile: UserProfile = {
        userId,
        displayName: input.displayName,
        college: input.college,
        major: input.major,
        grade: input.grade,
        gpaGoal: input.gpaGoal,
        studentId: input.studentId,
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
  const matches = new Map<string, any>();

  function dashboard(userId: string): GpaDashboard {
    const userCourses = [...courses.values()].filter((course) => course.userId === userId);
    return {
      courses: userCourses,
      result: calculateGpaResult(userCourses)
    };
  }

  return {
    async listCourses(userId) {
      return dashboard(userId).courses;
    },
    async listUserIdsWithGpaCourses() {
      return [...new Set([...courses.values()].map((course) => course.userId))];
    },
    async createCourseAndRecalculate(userId, input: GpaCourseInput) {
      const course: GpaCourse = {
        id: `course-${courses.size + 1}`,
        userId,
        ...input,
        createdAt: now,
        updatedAt: now
      };
      courses.set(course.id, course);
      return dashboard(userId);
    },
    async createCoursesAndRecalculate(userId, input: GpaCourseInput[]) {
      for (const courseInput of input) {
        const course: GpaCourse = {
          id: `course-${courses.size + 1}`,
          userId,
          ...courseInput,
          createdAt: now,
          updatedAt: now
        };
        courses.set(course.id, course);
      }
      return dashboard(userId);
    },
    async matchCoursesToProgramPlan(userId) {
      let matchedCount = 0;
      const planCourses = testPlanCoursesByUser.get(userId) ?? [];
      const planGroups = testPlanGroupsByUser.get(userId) ?? [];
      for (const key of [...matches.keys()].filter((key) => key.startsWith(`${userId}|`))) matches.delete(key);
      for (const course of [...courses.values()].filter((value) => value.userId === userId)) {
        const match = matchGpaCourseToPlanRequirement(course, { courses: planCourses, groups: planGroups });
        if (!match) continue;
        matchedCount += 1;
        const planCourse = planCourses.find((value) => value.id === match.programPlanCourseId);
        const planGroup = planGroups.find((value) => value.id === match.programPlanCourseGroupId);
        matches.set(`${userId}|${course.id}`, { ...match, gpaCourseId: course.id });
        if ((planCourse?.requirementType ?? planGroup?.requirementType) === "required") {
          courses.set(course.id, { ...course, isRequired: true, updatedAt: now });
        }
      }
      return { ...dashboard(userId), matchedCount };
    },
    async listCourseMatches(userId) {
      const planCourses = testPlanCoursesByUser.get(userId) ?? [];
      const planGroups = testPlanGroupsByUser.get(userId) ?? [];
      return {
        items: dashboard(userId).courses.map((course) => ({
          course,
          match: matches.get(`${userId}|${course.id}`) ?? null,
          candidates: { courses: planCourses, groups: planGroups }
        }))
      };
    },
    async upsertManualCourseMatch(userId, gpaCourseId, input) {
      const course = courses.get(gpaCourseId);
      if (!course || course.userId !== userId) return null;
      const planCourses = testPlanCoursesByUser.get(userId) ?? [];
      const planGroups = testPlanGroupsByUser.get(userId) ?? [];
      const targetType = input.matchTargetType;
      const planCourse = planCourses.find((value) => value.id === input.programPlanCourseId);
      const planGroup = planGroups.find((value) => value.id === input.programPlanCourseGroupId);
      const match = {
        matchTargetType: targetType,
        programPlanCourseId: targetType === "course" ? input.programPlanCourseId : null,
        programPlanCourseGroupId: targetType === "group" ? input.programPlanCourseGroupId : null,
        matchMethod: "manual",
        confidence: "1.00",
        confirmedByUser: true,
        requirementType: planCourse?.requirementType ?? planGroup?.requirementType ?? "unknown",
        gpaCourseId
      };
      matches.set(`${userId}|${gpaCourseId}`, match);
      courses.set(gpaCourseId, { ...course, isRequired: match.requirementType === "required", updatedAt: now });
      return { match, dashboard: dashboard(userId) };
    },
    async deleteCourseMatch(userId, gpaCourseId) {
      const course = courses.get(gpaCourseId);
      if (!course || course.userId !== userId) return null;
      matches.delete(`${userId}|${gpaCourseId}`);
      courses.set(gpaCourseId, { ...course, isRequired: false, updatedAt: now });
      return { dashboard: dashboard(userId) };
    },
    async cleanupTranscriptArtifactsAndRecalculate(userId) {
      return { ...dashboard(userId), deletedCount: 0 };
    },
    async updateCourseAndRecalculate(userId, courseId, input) {
      const existing = courses.get(courseId);
      if (!existing || existing.userId !== userId) {
        return null;
      }
      courses.set(courseId, { ...existing, ...input, updatedAt: now });
      return dashboard(userId);
    },
    async deleteCourseAndRecalculate(userId, courseId) {
      const existing = courses.get(courseId);
      if (!existing || existing.userId !== userId) {
        return null;
      }
      courses.delete(courseId);
      return dashboard(userId);
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

    function createSportsRepository(): SportsRepository {
      const progressByUser = new Map<string, TestSportsProgress>();

      return {
        async getProgress(userId: string) {
          return (
            progressByUser.get(userId) ?? {
              userId,
              currentRuns: 0,
              targetRuns: 45,
              lastRunDate: null,
              runDates: [],
              createdAt: new Date(0),
              updatedAt: new Date(0)
            }
          );
        },
        async upsertProgress(userId: string, input: Omit<TestSportsProgress, "userId" | "createdAt" | "updatedAt">) {
          const progress: TestSportsProgress = {
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

    function createCustomRequirementRepository(): CustomRequirementRepository {
      return {
        async listByUserId() {
          return [];
        },
        async create() {
          throw new Error("not used");
        },
        async update() {
          throw new Error("not used");
        },
        async delete() {
          throw new Error("not used");
        }
      };
    }

    function createReminderRepositoryStub(): ReminderRepository {
      return {
        async listByUserId() {
          return [];
        },
        async findById() {
          return null;
        },
        async create() {
          throw new Error("not used");
        },
        async update() {
          return null;
        },
        async softDelete() {
          return false;
        },
        async listDueSmsCandidates() {
          return [];
        },
        async findDeliveryLog() {
          return null;
        },
        async createDeliveryLog() {
          throw new Error("not used");
        }
      };
    }

    function createLabExamEventRepositoryStub(): LabExamEventRepository {
      return {
        async listByUserId() {
          return [];
        },
        async findById() {
          return null;
        },
        async create() {
          throw new Error("not used");
        },
        async update() {
          return null;
        },
        async softDelete() {
          return false;
        }
      };
    }

    function createLabExamEventsDeps(): AppDependencies["labExamEvents"] {
      const reminderRepository = createReminderRepositoryStub();
      const labExamEventRepository = createLabExamEventRepositoryStub();
      const stubDb = {
        async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
          return fn({});
        }
      } as unknown as AppDependencies["labExamEvents"]["db"];
      return {
        db: stubDb,
        createLabExamEventRepository: () => labExamEventRepository,
        createReminderRepository: () => reminderRepository
      };
    }

    describe("GradCheck API baseline", () => {
      function createTestApp() {
        return createApp({
          authRepository: createRepository(),
          plazaRepository: createPlazaRepository(),
          newsRepository: createNewsRepository(),
          srtpRepository: createSrtpRepository(),
          programPlanRepository: createProgramPlanRepository(),
          gpaRepository: createGpaRepository(),
          lecturePracticeRepository: createLecturePracticeRepository(),
          volunteerLaborRepository: createVolunteerLaborRepository(),
          sportsRepository: createSportsRepository(),
          customRequirementRepository: createCustomRequirementRepository(),
          coursesProgressRepository: {
            async loadProgressData() {
              return { plan: null, planCourses: [], planGroups: [], gpaCourses: [], matches: [], ignoredGroupIds: [] };
            },
            async ignoreGroup() {},
            async unignoreGroup() {}
          },
          reminderRepository: createReminderRepositoryStub(),
          labExamEvents: createLabExamEventsDeps()
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

  it("mounts reminder and lab exam routes behind authentication", async () => {
    const app = createTestApp();

    await request(app).get("/api/reminders").expect(401);
    await request(app).get("/api/lab-exam-events").expect(401);
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
          gpaGoal: "3.70",
          studentId: "213220001"
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
        gpaGoal: "3.70",
        studentId: "213220001"
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
        gpaGoal: "3.90",
        studentId: "213220002"
      });

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.profile).toMatchObject({
      displayName: "GradCheck 用户",
      college: "计算机科学与工程学院",
      major: "计算机科学与技术",
      grade: 2023,
      gpaGoal: "3.90",
      studentId: "213220002"
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

  function studentIdFromEmail(email: string): string {
    let hash = 0;
    for (const ch of email) {
      hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    }
    return String(200000000 + (hash % 100000000)).padStart(9, "0");
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
          gpaGoal: "3.70",
          studentId: studentIdFromEmail(email)
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

  describe("SRTP API", () => {
    beforeEach(() => {
      vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
    });

    it("requires authentication for SRTP records", async () => {
      const app = createTestApp();

      await request(app).get("/api/srtp/me").expect(401);
      await request(app).post("/api/srtp/me/records").send({}).expect(401);
    });

    it("returns an empty SRTP summary for users with no records", async () => {
      const app = createTestApp();
      const token = await registerAndToken(app, "srtp-empty@example.com");

      const response = await request(app).get("/api/srtp/me").set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        records: [],
        summary: {
          totalCredits: "0.00",
          passingRequiredCredits: "2.00",
          excellentRequiredCredits: "6.00",
          status: "not_passing",
          missingForPassing: "2.00",
          missingForExcellent: "6.00"
        }
      });

    });

    it("creates SRTP records and calculates passing and excellent summary", async () => {
      const app = createTestApp();
      const token = await registerAndToken(app, "srtp-owner@example.com");

      await request(app)
        .post("/api/srtp/me/records")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "挑战杯竞赛", type: "competition", credits: "1.20", description: "校赛获奖" })
        .expect(201);
      await request(app)
        .post("/api/srtp/me/records")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "SRTP 项目", type: "project", credits: "1.00", description: "项目结题" })
        .expect(201);

      const passingResponse = await request(app).get("/api/srtp/me").set("Authorization", `Bearer ${token}`);

      expect(passingResponse.body.summary).toMatchObject({
        totalCredits: "2.20",
        status: "passing",
        missingForPassing: "0.00",
        missingForExcellent: "3.80"
      });

      await request(app)
        .post("/api/srtp/me/records")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "SRTP 讲座", type: "lecture", credits: "3.80", description: "系列讲座" })
        .expect(201);

      const excellentResponse = await request(app).get("/api/srtp/me").set("Authorization", `Bearer ${token}`);

      expect(excellentResponse.body.summary).toMatchObject({
        totalCredits: "6.00",
        status: "excellent",
        missingForPassing: "0.00",
        missingForExcellent: "0.00"
      });
      expect(excellentResponse.body.records).toHaveLength(3);
    });

    it("edits and deletes owned SRTP records", async () => {
      const app = createTestApp();
      const token = await registerAndToken(app, "srtp-edit@example.com");

      const createResponse = await request(app)
        .post("/api/srtp/me/records")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "SRTP 讲座", type: "lecture", credits: "0.50", description: "讲座记录" });
      const recordId = createResponse.body.record.id as string;

      await request(app)
        .put(`/api/srtp/me/records/${recordId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "SRTP 讲座更新", type: "lecture", credits: "1.50", description: "更新后" })
        .expect(200);

      const updatedResponse = await request(app).get("/api/srtp/me").set("Authorization", `Bearer ${token}`);
      expect(updatedResponse.body.records[0]).toMatchObject({ title: "SRTP 讲座更新", credits: "1.50" });
      expect(updatedResponse.body.summary.totalCredits).toBe("1.50");

      await request(app).delete(`/api/srtp/me/records/${recordId}`).set("Authorization", `Bearer ${token}`).expect(200);

      const deletedResponse = await request(app).get("/api/srtp/me").set("Authorization", `Bearer ${token}`);
      expect(deletedResponse.body.records).toHaveLength(0);
      expect(deletedResponse.body.summary.totalCredits).toBe("0.00");
    });

    it("rejects invalid SRTP record input and missing records", async () => {
      const app = createTestApp();
      const token = await registerAndToken(app, "srtp-invalid@example.com");

      await request(app)
        .post("/api/srtp/me/records")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "", type: "competition", credits: "1.00", description: "" })
        .expect(400);

      await request(app)
        .post("/api/srtp/me/records")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "无效类型", type: "invalid", credits: "1.00", description: "" })
        .expect(400);

      await request(app)
        .post("/api/srtp/me/records")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "负学分", type: "other", credits: "-0.10", description: "" })
        .expect(400);

      await request(app)
        .put("/api/srtp/me/records/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "不存在", type: "other", credits: "1.00", description: "" })
        .expect(404);
    });
  });

  describe("program plan import API", () => {
    beforeEach(() => {
      vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
    });

    it("requires authentication for program plan import APIs", async () => {
      const app = createTestApp();

      await request(app).get("/api/program-plans/me").expect(401);
      await request(app).post("/api/program-plans/import").send({}).expect(401);
    });

    it("returns null when the user has no bound program plan", async () => {
      const app = createTestApp();
      const token = await registerAndToken(app, "plan-empty@example.com");

      const response = await request(app).get("/api/program-plans/me").set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ plan: null });
    });

    it("mock uploads a PDF and returns pdf-extract sample preview", async () => {
      const app = createTestApp();
      const token = await registerAndToken(app, "plan-upload@example.com");

      const response = await request(app)
        .post("/api/program-plans/mock-upload")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("%PDF-1.4"), "software-plan.pdf");

      expect(response.status).toBe(200);
      expect(response.body.preview).toMatchObject({
        sourceFilename: "software-plan.pdf",
        school: "东南大学",
        major: "软件工程",
        totalCredits: "166",
        courseCount: 134,
        requirementCount: 13,
        warningCount: 0
      });
      expect(response.body.preview.planJson.courses[0]).toMatchObject({ code: "B15M0010", name: "马克思主义基本原理概论" });
    });

    it("rejects non-PDF mock uploads", async () => {
      const app = createTestApp();
      const token = await registerAndToken(app, "plan-upload-invalid@example.com");

      await request(app)
        .post("/api/program-plans/mock-upload")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("not pdf"), "plan.txt")
        .expect(400);
    });

    it("imports and binds a preview plan to the current user", async () => {
      const app = createTestApp();
      const token = await registerAndToken(app, "plan-import@example.com");
      const uploadResponse = await request(app)
        .post("/api/program-plans/mock-upload")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("%PDF-1.4"), "software-plan.pdf");

      const importResponse = await request(app)
        .post("/api/program-plans/import")
        .set("Authorization", `Bearer ${token}`)
        .send({
          sourceFilename: uploadResponse.body.preview.sourceFilename,
          planJson: uploadResponse.body.preview.planJson
        });

      expect(importResponse.status).toBe(201);
      expect(importResponse.body.plan).toMatchObject({
        sourceFilename: "software-plan.pdf",
        school: "东南大学",
        major: "软件工程",
        courseCount: 134,
        requirementCount: 13
      });
      expect(importResponse.body.normalized).toMatchObject({
        groupCount: expect.any(Number),
        courseCount: 134
      });

      const currentResponse = await request(app).get("/api/program-plans/me").set("Authorization", `Bearer ${token}`);
      expect(currentResponse.body.plan.id).toBe(importResponse.body.plan.id);
    });

    it("lets users reuse a program plan uploaded for the same major and grade", async () => {
      const app = createTestApp();
      const ownerToken = await registerAndToken(app, "plan-reuse-owner@example.com");
      const uploadResponse = await request(app)
        .post("/api/program-plans/mock-upload")
        .set("Authorization", `Bearer ${ownerToken}`)
        .attach("file", Buffer.from("%PDF-1.4"), "software-plan.pdf");
      const importResponse = await request(app)
        .post("/api/program-plans/import")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          sourceFilename: uploadResponse.body.preview.sourceFilename,
          planJson: uploadResponse.body.preview.planJson
        });
      const reuseToken = await registerAndToken(app, "plan-reuse-peer@example.com");

      const optionsResponse = await request(app)
        .get("/api/program-plans/reusable")
        .set("Authorization", `Bearer ${reuseToken}`);

      expect(optionsResponse.status).toBe(200);
      expect(optionsResponse.body.plans).toEqual([
        expect.objectContaining({
          id: importResponse.body.plan.id,
          major: "软件工程",
          grade: "2022级",
          courseCount: 134
        })
      ]);

      const bindResponse = await request(app)
        .post(`/api/program-plans/${importResponse.body.plan.id}/bind`)
        .set("Authorization", `Bearer ${reuseToken}`);

      expect(bindResponse.status).toBe(200);
      expect(bindResponse.body.plan.id).toBe(importResponse.body.plan.id);

      const currentResponse = await request(app).get("/api/program-plans/me").set("Authorization", `Bearer ${reuseToken}`);
      expect(currentResponse.body.plan.id).toBe(importResponse.body.plan.id);
    });

    describe("GPA API", () => {
      beforeEach(() => {
        vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough");
      });

      it("persists GPA courses and recalculates latest results after changes", async () => {
        const app = createTestApp();
        const token = await registerAndToken(app, "gpa@example.com");

        const emptyResponse = await request(app).get("/api/gpa").set("Authorization", `Bearer ${token}`);

        expect(emptyResponse.status).toBe(200);
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
          });

        expect(createResponse.status).toBe(201);
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
          });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.result.requiredFirstAttempt.weightedGpa).toBe(4);
        expect(updateResponse.body.result.requiredFirstAttempt.weightedAverageScore).toBe(90);

        const deleteResponse = await request(app)
          .delete(`/api/gpa/courses/${courseId}`)
          .set("Authorization", `Bearer ${token}`);

        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body.courses).toEqual([]);
        expect(deleteResponse.body.result.overall.weightedGpa).toBeNull();
      });

      it("does not allow users to update another user's GPA course", async () => {
        const app = createTestApp();
        const firstToken = await registerAndToken(app, "gpa-owner@example.com");
        const secondToken = await registerAndToken(app, "gpa-other@example.com");

        const createResponse = await request(app)
          .post("/api/gpa/courses")
          .set("Authorization", `Bearer ${firstToken}`)
          .send({
            term: "2025-2026 春",
            name: "大学物理",
            credit: "2.00",
            score: "88.00",
            isRequired: true,
            isFirstAttempt: true,
            isGpaEligible: true
          });

        const courseId = createResponse.body.courses[0].id as string;

        await request(app)
          .put(`/api/gpa/courses/${courseId}`)
          .set("Authorization", `Bearer ${secondToken}`)
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

      it("rejects non-PDF transcript preview uploads", async () => {
        const app = createTestApp();
        const token = await registerAndToken(app, "gpa-preview-invalid@example.com");

        await request(app)
          .post("/api/gpa/transcript/preview")
          .set("Authorization", `Bearer ${token}`)
          .attach("file", Buffer.from("not a pdf"), "grades.txt")
          .expect(400);
      });

      it("imports confirmed transcript courses and skips duplicates", async () => {
        const app = createTestApp();
        const token = await registerAndToken(app, "gpa-import@example.com");
        await request(app)
          .post("/api/program-plans/import")
          .set("Authorization", `Bearer ${token}`)
          .send({
            sourceFilename: "software-plan.json",
            planJson: {
              program: { school: "东南大学", college: "软件学院", major: "软件工程", grade: "2022级", total_credits: 166 },
              courses: [
                {
                  code: "BSEDB001",
                  name: "数据库原理(全英文)",
                  credits: 3,
                  category: "专业主干课",
                  subcategory: "软件工程",
                  term: { year: "四", semester: "1" }
                }
              ],
              requirements: [{ id: "required_core", type: "required", title: "必修课程" }],
              semester_plan: [],
              warnings: [],
              provenance: {}
            }
          })
          .expect(201);
        const course = {
          term: "2025-2026 春",
          name: "数据库原理(全英文)",
          credit: "3",
          score: "85",
          isRequired: false,
          isFirstAttempt: true,
          isGpaEligible: true
        };

        const firstImport = await request(app)
          .post("/api/gpa/transcript/import")
          .set("Authorization", `Bearer ${token}`)
          .send({ courses: [course] });

        expect(firstImport.status).toBe(201);
        expect(firstImport.body.importedCount).toBe(1);
        expect(firstImport.body.skippedCount).toBe(0);
        expect(firstImport.body.dashboard.courses).toHaveLength(1);
        expect(firstImport.body.dashboard.courses[0]).toMatchObject({ name: "数据库原理(全英文)", isRequired: true });

        const secondImport = await request(app)
          .post("/api/gpa/transcript/import")
          .set("Authorization", `Bearer ${token}`)
          .send({ courses: [course] });

        expect(secondImport.status).toBe(200);
        expect(secondImport.body.importedCount).toBe(0);
        expect(secondImport.body.skippedCount).toBe(1);
        expect(secondImport.body.dashboard.courses).toHaveLength(1);
      });

      it("lets users view, override, and remove GPA course matches", async () => {
        const app = createTestApp();
        const token = await registerAndToken(app, "gpa-match-manage@example.com");
        await request(app)
          .post("/api/program-plans/import")
          .set("Authorization", `Bearer ${token}`)
          .send({
            sourceFilename: "software-plan.json",
            planJson: {
              program: { school: "东南大学", college: "软件学院", major: "软件工程", grade: "2022级", total_credits: 166 },
              courses: [
                { code: "MATH", name: "线性代数", credits: 4, category: "通识教育基础课", term: { year: "一", semester: "2" } },
                { code: "ELEC", name: "专业阅读与写作(研讨)", credits: 2, category: "专业选修课", term: { year: "三", semester: "2" } }
              ],
              requirements: [
                { id: "required_core", type: "required", title: "必修课程" },
                { id: "elective_group", type: "choose_one_of", title: "专业选修课", course_codes: ["ELEC"] }
              ],
              semester_plan: [],
              warnings: [],
              provenance: {}
            }
          })
          .expect(201);
        const importResponse = await request(app)
          .post("/api/gpa/transcript/import")
          .set("Authorization", `Bearer ${token}`)
          .send({
            courses: [
              {
                term: "2025-2026 春",
                name: "线性代数",
                credit: "4",
                score: "94",
                isRequired: false,
                isFirstAttempt: true,
                isGpaEligible: true
              }
            ]
          })
          .expect(201);
        const gpaCourseId = importResponse.body.dashboard.courses[0].id as string;

        const listResponse = await request(app).get("/api/gpa/course-matches").set("Authorization", `Bearer ${token}`);
        expect(listResponse.status).toBe(200);
        expect(listResponse.body.items[0]).toMatchObject({
          course: { id: gpaCourseId, name: "线性代数" },
          match: { matchTargetType: "course", confirmedByUser: false }
        });
        expect(listResponse.body.items[0].candidates.courses).toHaveLength(2);

        const groupId = listResponse.body.items[0].candidates.groups[0].id as string;
        const overrideResponse = await request(app)
          .put(`/api/gpa/course-matches/${gpaCourseId}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ matchTargetType: "group", programPlanCourseGroupId: groupId });
        expect(overrideResponse.status).toBe(200);
        expect(overrideResponse.body.match).toMatchObject({
          matchTargetType: "group",
          programPlanCourseGroupId: groupId,
          confirmedByUser: true
        });

        await request(app).delete(`/api/gpa/course-matches/${gpaCourseId}`).set("Authorization", `Bearer ${token}`).expect(200);
        const afterDelete = await request(app).get("/api/gpa/course-matches").set("Authorization", `Bearer ${token}`);
        expect(afterDelete.body.items[0].match).toBeNull();
      });
    });
  });
});
