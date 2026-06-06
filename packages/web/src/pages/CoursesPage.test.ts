import { mount, RouterLinkStub, flushPromises } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CoursesPage from "./CoursesPage.vue";
import type { CoursesProgressResponse, RematchGpaCoursesResponse } from "../lib/api";

const { authState, replace, push, getCoursesProgress, rematchGpaCourses } = vi.hoisted(() => ({
  authState: { token: "token" as string | null },
  replace: vi.fn(),
  push: vi.fn(),
  getCoursesProgress: vi.fn(),
  rematchGpaCourses: vi.fn()
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ replace, push }),
  RouterLink: RouterLinkStub
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    getToken: () => authState.token,
    getCoursesProgress,
    rematchGpaCourses
  };
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
}

function mountPage(queryClient = createTestQueryClient()) {
  return mount(CoursesPage, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: { RouterLink: RouterLinkStub }
    }
  });
}

function emptyResponse(reason: CoursesProgressResponse["emptyReason"]): CoursesProgressResponse {
  return {
    plan:
      reason === "no_plan"
        ? null
        : {
            id: "plan-1",
            school: "东南大学",
            college: "软件学院",
            major: "软件工程",
            grade: "2022级"
          },
    emptyReason: reason,
    overall:
      reason === "no_plan"
        ? null
        : {
            totalCredits: "166.00",
            earnedCredits: "0.00",
            gapCredits: "166.00",
            percent: 0,
            satisfiedRuleCount: 0,
            totalRuleCount: 0
          },
    categories: [],
    rules: []
  };
}

function fullResponse(): CoursesProgressResponse {
  return {
    plan: {
      id: "plan-1",
      school: "东南大学",
      college: "软件学院",
      major: "软件工程",
      grade: "2022级"
    },
    emptyReason: null,
    overall: {
      totalCredits: "166.00",
      earnedCredits: "132.00",
      gapCredits: "34.00",
      percent: 79,
      satisfiedRuleCount: 9,
      totalRuleCount: 13
    },
    categories: [
      {
        name: "通识教育基础课",
        requiredCredits: "40.00",
        earnedCredits: "36.00",
        completedCourseCount: 11,
        totalCourseCount: 12,
        percent: 90
      }
    ],
    rules: [
      {
        id: "rule-required",
        name: "必修核心课",
        requirementType: "required",
        description: null,
        status: "in_progress",
        targetType: "all_courses",
        targetCourses: 3,
        targetCredits: null,
        earnedCourses: 1,
        earnedCredits: "3.00",
        gapText: "差 2 门",
        completedCourses: [
          {
            id: "plan-course-1",
            code: "MATH",
            name: "高等数学",
            credits: "3.00",
            matchedGpaCourseId: "gpa-1",
            matchedGpaCourseTerm: "2024-2025 秋",
            matchedGpaCourseScore: "92.00"
          }
        ],
        candidateCourses: [
          { id: "plan-course-2", code: "PHY", name: "大学物理", credits: "3.00" },
          { id: "plan-course-3", code: "ENG", name: "大学英语", credits: "2.00" }
        ],
        matchedFreeCourses: []
      },
      {
        id: "rule-done",
        name: "已达成课程组",
        requirementType: "choose_one_of",
        description: null,
        status: "completed",
        targetType: "courses",
        targetCourses: 1,
        targetCredits: null,
        earnedCourses: 1,
        earnedCredits: "2.00",
        gapText: "已完成",
        completedCourses: [],
        candidateCourses: [],
        matchedFreeCourses: [
          {
            gpaCourseId: "gpa-free",
            name: "通识自由课",
            credits: "2.00",
            term: "2024-2025 秋",
            score: "85.00"
          }
        ]
      }
    ]
  };
}

describe("CoursesPage", () => {
  beforeEach(() => {
    authState.token = "token";
    replace.mockReset();
    push.mockReset();
    getCoursesProgress.mockReset();
    rematchGpaCourses.mockReset();
  });

  it("redirects unauthenticated users to login", async () => {
    authState.token = null;
    getCoursesProgress.mockResolvedValue(emptyResponse("no_plan"));
    mountPage();
    await flushPromises();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("shows the no_plan empty state with a link to the plans page", async () => {
    getCoursesProgress.mockResolvedValue(emptyResponse("no_plan"));
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="courses-empty-no-plan"]').exists()).toBe(true);
    await wrapper.get('[data-testid="courses-link-plans"]').trigger("click");
    expect(push).toHaveBeenCalledWith("/plans");
  });

  it("renders overall metrics, categories, and rule progress", async () => {
    getCoursesProgress.mockResolvedValue(fullResponse());
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('[data-testid="courses-overall-percent"]').text()).toBe("79%");
    expect(wrapper.get('[data-testid="courses-overall-credits"]').text()).toContain("132.00 / 166.00");
    expect(wrapper.get('[data-testid="courses-metric-earned"]').text()).toBe("132.00");
    expect(wrapper.get('[data-testid="courses-metric-gap"]').text()).toBe("34.00");
    expect(wrapper.get('[data-testid="courses-metric-rules"]').text()).toContain("9 / 13");
    expect(wrapper.find('[data-testid="courses-category"]').text()).toContain("通识教育基础课");

    const rules = wrapper.findAll('[data-testid="courses-rule"]');
    expect(rules).toHaveLength(1);
    expect(rules[0].attributes("data-rule-id")).toBe("rule-required");
    expect(wrapper.get('[data-testid="courses-completed-toggle"]').text()).toContain("已达成 1 条");
  });

  it("expands a rule to reveal completed and candidate courses", async () => {
    getCoursesProgress.mockResolvedValue(fullResponse());
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="courses-rule-done"]').exists()).toBe(false);

    await wrapper.get('[data-testid="courses-rule"] button').trigger("click");

    expect(wrapper.find('[data-testid="courses-rule-done"]').text()).toContain("高等数学");
    const candidates = wrapper.findAll('[data-testid="courses-rule-candidate"]');
    expect(candidates).toHaveLength(2);
    expect(candidates[0].text()).toContain("大学物理");
  });

  it("invokes rematch and invalidates the courses-progress query on success", async () => {
    getCoursesProgress.mockResolvedValueOnce(fullResponse());
    const rematchResult: RematchGpaCoursesResponse = {
      matchedCount: 3,
      courses: [],
      result: {
        requiredFirstAttempt: { weightedGpa: null, weightedAverageScore: null, totalCredits: 0, courseCount: 0 },
        overall: { weightedGpa: null, weightedAverageScore: null, totalCredits: 0, courseCount: 0 }
      }
    };
    rematchGpaCourses.mockResolvedValueOnce(rematchResult);
    getCoursesProgress.mockResolvedValue(fullResponse());

    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get('[data-testid="courses-rematch"]').trigger("click");
    await flushPromises();

    expect(rematchGpaCourses).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="courses-rematch-message"]').text()).toContain("3 门");
  });
});
