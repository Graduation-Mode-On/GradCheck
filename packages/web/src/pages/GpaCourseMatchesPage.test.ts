import { mount, RouterLinkStub, flushPromises } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GpaCourseMatchesPage from "./GpaCourseMatchesPage.vue";

const { authState, replace, getGpaCourseMatches, upsertGpaCourseMatch, deleteGpaCourseMatch } = vi.hoisted(() => ({
  authState: { token: "token" as string | null },
  replace: vi.fn(),
  getGpaCourseMatches: vi.fn(),
  upsertGpaCourseMatch: vi.fn(),
  deleteGpaCourseMatch: vi.fn()
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ replace }),
  RouterLink: RouterLinkStub
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    getToken: () => authState.token,
    getGpaCourseMatches,
    upsertGpaCourseMatch,
    deleteGpaCourseMatch
  };
});

function queryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function mountPage() {
  return mount(GpaCourseMatchesPage, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: queryClient() }]],
      stubs: { RouterLink: RouterLinkStub }
    }
  });
}

describe("GpaCourseMatchesPage", () => {
  beforeEach(() => {
    authState.token = "token";
    replace.mockReset();
    upsertGpaCourseMatch.mockReset();
    deleteGpaCourseMatch.mockReset();
    getGpaCourseMatches.mockReset();
    getGpaCourseMatches.mockResolvedValue({
      items: [
        {
          course: { id: "c1", userId: "u1", term: "2025-2026 春", name: "高等数学", credit: "3.00", score: "96.00", isRequired: true, isFirstAttempt: true, isGpaEligible: true, createdAt: "", updatedAt: "" },
          match: { matchTargetType: "course", programPlanCourseId: "p1", programPlanCourseGroupId: null, matchMethod: "normalized_name_credit", confidence: "0.92", confirmedByUser: false },
          candidates: {
            courses: [{ id: "p1", code: "MATH", name: "高等数学", credits: "3.00", requirementType: "required" }],
            groups: [{ id: "g1", name: "通识选修课", requirementType: "min_credits" }]
          }
        },
        {
          course: { id: "c2", userId: "u1", term: "2025-2026 春", name: "电影艺术理论与实践", credit: "2.00", score: "90.00", isRequired: false, isFirstAttempt: true, isGpaEligible: false, createdAt: "", updatedAt: "" },
          match: null,
          candidates: {
            courses: [],
            groups: [{ id: "g1", name: "通识选修课", requirementType: "min_credits" }]
          }
        }
      ]
    });
  });

  it("filters course matches and binds with mobile-friendly candidate cards", async () => {
    upsertGpaCourseMatch.mockResolvedValueOnce({ match: { confirmedByUser: true }, dashboard: { courses: [], result: { requiredFirstAttempt: { weightedGpa: null, weightedAverageScore: null, totalCredits: 0, courseCount: 0 }, overall: { weightedGpa: null, weightedAverageScore: null, totalCredits: 0, courseCount: 0 } } } });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('[data-testid="gpa-match-search"]').attributes("placeholder")).toBe("搜索课程名称");
    expect(wrapper.get('[data-testid="gpa-match-status-filter"]').element.tagName).toBe("SELECT");
    await wrapper.get('[data-testid="gpa-match-search"]').setValue("电影");

    expect(wrapper.get('[data-testid="gpa-match-list"]').text()).toContain("电影艺术理论与实践");
    expect(wrapper.get('[data-testid="gpa-match-list"]').text()).not.toContain("高等数学");

    await wrapper.get('[data-testid="gpa-match-candidate-group"]').trigger("click");

    expect(upsertGpaCourseMatch).toHaveBeenCalledWith("c2", {
      matchTargetType: "group",
      programPlanCourseGroupId: "g1"
    });
  });

  it("searches candidate targets and only allows unbinding matched courses", async () => {
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get('[data-testid="gpa-match-search"]').setValue("通识选修课");

    expect(wrapper.get('[data-testid="gpa-match-list"]').text()).toContain("高等数学");
    expect(wrapper.get('[data-testid="gpa-match-list"]').text()).toContain("电影艺术理论与实践");
    expect(wrapper.findAll('[data-testid="gpa-match-unbind"]')).toHaveLength(1);

    await wrapper.get('[data-testid="gpa-match-unbind"]').trigger("click");

    expect(deleteGpaCourseMatch).toHaveBeenCalledWith("c1");
  });
});
