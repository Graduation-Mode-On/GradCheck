import { mount, RouterLinkStub, flushPromises } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GpaPage from "./GpaPage.vue";
import type { GpaDashboardResponse } from "../lib/api";

const {
  authState,
  replace,
  getGpaDashboard,
  createGpaCourse,
  updateGpaCourse,
  deleteGpaCourse,
  uploadGpaTranscript,
  importGpaTranscriptCourses,
  getGpaCourseMatches,
  upsertGpaCourseMatch,
  deleteGpaCourseMatch
} = vi.hoisted(() => ({
  authState: {
    token: "token" as string | null
  },
  replace: vi.fn(),
  getGpaDashboard: vi.fn(),
  createGpaCourse: vi.fn(),
  updateGpaCourse: vi.fn(),
  deleteGpaCourse: vi.fn(),
  uploadGpaTranscript: vi.fn(),
  importGpaTranscriptCourses: vi.fn(),
  getGpaCourseMatches: vi.fn(),
  upsertGpaCourseMatch: vi.fn(),
  deleteGpaCourseMatch: vi.fn()
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({
    replace
  }),
  RouterLink: RouterLinkStub
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");

  return {
    ...actual,
    getToken: () => authState.token,
    getGpaDashboard,
    createGpaCourse,
    updateGpaCourse,
    deleteGpaCourse,
    uploadGpaTranscript,
    importGpaTranscriptCourses,
    getGpaCourseMatches,
    upsertGpaCourseMatch,
    deleteGpaCourseMatch
  };
});

function createDashboard(name = "高等数学", term = "2025-2026 春"): GpaDashboardResponse {
  return {
    courses: [
      {
        id: "course-1",
        userId: "user-1",
        term,
        name,
        credit: "3.00",
        score: "96.00",
        isRequired: true,
        isFirstAttempt: true,
        isGpaEligible: true,
        createdAt: "2026-06-06T00:00:00.000Z",
        updatedAt: "2026-06-06T00:00:00.000Z"
      }
    ],
    result: {
      requiredFirstAttempt: {
        weightedGpa: 4.8,
        weightedAverageScore: 96,
        totalCredits: 3,
        courseCount: 1
      },
      overall: {
        weightedGpa: 4.8,
        weightedAverageScore: 96,
        totalCredits: 3,
        courseCount: 1
      }
    }
  };
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      },
      mutations: {
        retry: false
      }
    }
  });
}

function createDeferredDashboard() {
  let resolve: (dashboard: GpaDashboardResponse) => void = () => {};
  const promise = new Promise<GpaDashboardResponse>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function mountPage(queryClient = createTestQueryClient()) {
  return mount(GpaPage, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        RouterLink: RouterLinkStub
      }
    }
  });
}

describe("GpaPage", () => {
  beforeEach(() => {
    authState.token = "token";
    replace.mockReset();
    getGpaDashboard.mockReset();
    createGpaCourse.mockReset();
    updateGpaCourse.mockReset();
    deleteGpaCourse.mockReset();
    uploadGpaTranscript.mockReset();
    importGpaTranscriptCourses.mockReset();
    getGpaCourseMatches.mockReset();
    upsertGpaCourseMatch.mockReset();
    deleteGpaCourseMatch.mockReset();
    getGpaDashboard.mockResolvedValue(createDashboard());
    getGpaCourseMatches.mockResolvedValue({
      items: [
        {
          course: createDashboard().courses[0],
          match: null,
          candidates: {
            courses: [{ id: "plan-course-1", name: "高等数学", code: "MATH", credits: "3.00", requirementType: "required" }],
            groups: [{ id: "group-1", name: "通识选修课", requirementType: "min_credits" }]
          }
        }
      ]
    });
  });

  it("shows persisted GPA results and courses", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('[data-testid="gpa-result-grid"]').classes()).toContain("grid-cols-2");
    expect(wrapper.get('[data-testid="gpa-required-result"]').text()).toContain("4.8");
    expect(wrapper.get('[data-testid="gpa-overall-result"]').text()).toContain("96");
    expect(wrapper.get('[data-testid="gpa-required-summary"]').text()).toBe("均分 96 · 学分 3 · 1 门");
    expect(wrapper.get('[data-testid="gpa-course-list"]').text()).toContain("高等数学");
    expect(wrapper.get('[data-testid="gpa-course-list"]').text()).toContain("2025-2026 春");
  });

  it("shows initial load errors instead of the empty course state", async () => {
    getGpaDashboard.mockRejectedValueOnce(new Error("GPA service unavailable"));

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain("GPA service unavailable");
    expect(wrapper.text()).not.toContain("还没有课程，先添加一门课程开始计算。");
  });

  it("submits a new course through the API", async () => {
    createGpaCourse.mockResolvedValueOnce(createDashboard("程序设计"));

    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get('[data-testid="gpa-course-name"]').setValue("程序设计");
    await wrapper.get('[data-testid="gpa-course-credit"]').setValue("4.00");
    await wrapper.get('[data-testid="gpa-course-score"]').setValue("90.00");
    await wrapper.get('[data-testid="gpa-course-form"]').trigger("submit");

    expect(createGpaCourse).toHaveBeenCalledWith({
      term: "2025-2026 春",
      name: "程序设计",
      credit: "4.00",
      score: "90.00",
      isRequired: true,
      isFirstAttempt: true,
      isGpaEligible: true
    });
  });

  it("does not render cached courses when the auth token changes", async () => {
    const queryClient = createTestQueryClient();
    authState.token = "token-a";
    getGpaDashboard.mockResolvedValueOnce(createDashboard("高等数学"));

    const firstWrapper = mountPage(queryClient);
    await flushPromises();
    expect(firstWrapper.get('[data-testid="gpa-course-list"]').text()).toContain("高等数学");
    firstWrapper.unmount();

    authState.token = "token-b";
    getGpaDashboard.mockResolvedValueOnce(createDashboard("大学英语"));
    const secondWrapper = mountPage(queryClient);

    expect(secondWrapper.text()).not.toContain("高等数学");

    await flushPromises();
    expect(secondWrapper.get('[data-testid="gpa-course-list"]').text()).toContain("大学英语");
  });

  it("keeps mutation results in the GPA query cache after remounting", async () => {
    const queryClient = createTestQueryClient();
    createGpaCourse.mockResolvedValueOnce(createDashboard("程序设计"));

    const wrapper = mountPage(queryClient);
    await flushPromises();

    await wrapper.get('[data-testid="gpa-course-name"]').setValue("程序设计");
    await wrapper.get('[data-testid="gpa-course-credit"]').setValue("4.00");
    await wrapper.get('[data-testid="gpa-course-score"]').setValue("90.00");
    await wrapper.get('[data-testid="gpa-course-form"]').trigger("submit");
    await flushPromises();

    expect(wrapper.get('[data-testid="gpa-course-list"]').text()).toContain("程序设计");
    wrapper.unmount();

    const remountedWrapper = mountPage(queryClient);
    expect(remountedWrapper.get('[data-testid="gpa-course-list"]').text()).toContain("程序设计");
  });

  it("keeps stale in-flight dashboard fetches from overwriting mutation results", async () => {
    const pendingDashboard = createDeferredDashboard();
    getGpaDashboard.mockReturnValueOnce(pendingDashboard.promise);
    createGpaCourse.mockResolvedValueOnce(createDashboard("程序设计"));

    const wrapper = mountPage();

    await wrapper.get('[data-testid="gpa-course-name"]').setValue("程序设计");
    await wrapper.get('[data-testid="gpa-course-credit"]').setValue("4.00");
    await wrapper.get('[data-testid="gpa-course-score"]').setValue("90.00");
    await wrapper.get('[data-testid="gpa-course-form"]').trigger("submit");
    await flushPromises();

    expect(wrapper.get('[data-testid="gpa-course-list"]').text()).toContain("程序设计");

    pendingDashboard.resolve(createDashboard("高等数学"));
    await flushPromises();

    expect(wrapper.get('[data-testid="gpa-course-list"]').text()).toContain("程序设计");
    expect(wrapper.get('[data-testid="gpa-course-list"]').text()).not.toContain("高等数学");
  });

  it("opens course actions and scrolls to the form when editing", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get('[data-testid="gpa-course-actions"]').trigger("click");

    expect(wrapper.get('[data-testid="gpa-course-edit"]').text()).toBe("编辑");
    expect(wrapper.get('[data-testid="gpa-course-delete"]').text()).toBe("删除");

    await wrapper.get('[data-testid="gpa-course-edit"]').trigger("click");

    expect(wrapper.get('[data-testid="gpa-course-form-title"]').text()).toBe("编辑课程");
    expect((wrapper.get('[data-testid="gpa-course-name"]').element as HTMLInputElement).value).toBe("高等数学");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("previews and imports transcript courses", async () => {
    const transcriptCourse = {
      term: "2025-2026 春",
      name: "数据库原理(全英文)",
      credit: "3",
      score: "85",
      isRequired: false,
      isFirstAttempt: true,
      isGpaEligible: true,
      rawName: "数据库原理(全英文)",
      rawGrade: "85",
      exclusionReason: null,
      warnings: []
    };
    uploadGpaTranscript.mockResolvedValueOnce({
      preview: {
        sourceFilename: "grades.pdf",
        courseCount: 1,
        importableCourseCount: 1,
        courses: [transcriptCourse],
        warnings: []
      }
    });
    importGpaTranscriptCourses.mockResolvedValueOnce({
      importedCount: 1,
      skippedCount: 0,
      dashboard: createDashboard("数据库原理(全英文)", "2025-2026 春")
    });
    const wrapper = mountPage();
    await flushPromises();
    const fileInput = wrapper.get('[data-testid="gpa-transcript-file"]');
    const file = new File(["pdf"], "grades.pdf", { type: "application/pdf" });
    Object.defineProperty(fileInput.element, "files", { value: [file] });

    await fileInput.trigger("change");
    await wrapper.get('[data-testid="gpa-transcript-preview"]').trigger("click");
    await flushPromises();

    expect(uploadGpaTranscript).toHaveBeenCalledWith(file);
    expect(wrapper.get('[data-testid="gpa-transcript-preview-list"]').text()).toContain("数据库原理(全英文)");

    await wrapper.get('[data-testid="gpa-transcript-import"]').trigger("click");
    await flushPromises();

    expect(importGpaTranscriptCourses).toHaveBeenCalledWith([
      {
        term: "2025-2026 春",
        name: "数据库原理(全英文)",
        credit: "3",
        score: "85",
        isRequired: false,
        isFirstAttempt: true,
        isGpaEligible: true
      }
    ]);
    expect(wrapper.get('[data-testid="gpa-course-list"]').text()).toContain("数据库原理(全英文)");
  });

  it("shows and updates GPA course matches", async () => {
    upsertGpaCourseMatch.mockResolvedValueOnce({ match: { confirmedByUser: true }, dashboard: createDashboard() });
    deleteGpaCourseMatch.mockResolvedValueOnce({ dashboard: createDashboard() });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('[data-testid="gpa-match-list"]').text()).toContain("高等数学");
    await wrapper.get('[data-testid="gpa-match-select"]').setValue("course:plan-course-1");
    await wrapper.get('[data-testid="gpa-match-bind"]').trigger("click");

    expect(upsertGpaCourseMatch).toHaveBeenCalledWith("course-1", {
      matchTargetType: "course",
      programPlanCourseId: "plan-course-1"
    });

    await wrapper.get('[data-testid="gpa-match-unbind"]').trigger("click");
    expect(deleteGpaCourseMatch.mock.calls[0]?.[0]).toBe("course-1");
  });
});
