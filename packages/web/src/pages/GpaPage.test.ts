import { mount, RouterLinkStub, flushPromises } from "@vue/test-utils";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { describe, expect, it, vi } from "vitest";

import GpaPage from "./GpaPage.vue";

const { replace, createGpaCourse, updateGpaCourse, deleteGpaCourse } = vi.hoisted(() => ({
  replace: vi.fn(),
  createGpaCourse: vi.fn(),
  updateGpaCourse: vi.fn(),
  deleteGpaCourse: vi.fn()
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
    getToken: () => "token",
    getGpaDashboard: async () => ({
      courses: [
        {
          id: "course-1",
          userId: "user-1",
          term: "2025-2026 春",
          name: "高等数学",
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
    }),
    createGpaCourse,
    updateGpaCourse,
    deleteGpaCourse
  };
});

function mountPage() {
  return mount(GpaPage, {
    global: {
      plugins: [VueQueryPlugin],
      stubs: {
        RouterLink: RouterLinkStub
      }
    }
  });
}

describe("GpaPage", () => {
  it("shows persisted GPA results and courses", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('[data-testid="gpa-required-result"]').text()).toContain("4.8");
    expect(wrapper.get('[data-testid="gpa-overall-result"]').text()).toContain("96");
    expect(wrapper.get('[data-testid="gpa-course-list"]').text()).toContain("高等数学");
    expect(wrapper.get('[data-testid="gpa-course-list"]').text()).toContain("2025-2026 春");
  });

  it("submits a new course through the API", async () => {
    createGpaCourse.mockResolvedValueOnce({
      courses: [],
      result: {
        requiredFirstAttempt: { weightedGpa: null, weightedAverageScore: null, totalCredits: 0, courseCount: 0 },
        overall: { weightedGpa: null, weightedAverageScore: null, totalCredits: 0, courseCount: 0 }
      }
    });

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
});
