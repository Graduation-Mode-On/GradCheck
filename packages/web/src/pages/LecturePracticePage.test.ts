import { VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, RouterLinkStub } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LecturePracticePage from "./LecturePracticePage.vue";

const mocks = vi.hoisted(() => ({
  token: null as string | null,
  replace: vi.fn(),
  getLecturePracticeProgress: vi.fn(),
  updateLecturePracticeProgress: vi.fn()
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  RouterLink: RouterLinkStub
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    getToken: () => mocks.token,
    getLecturePracticeProgress: mocks.getLecturePracticeProgress,
    updateLecturePracticeProgress: mocks.updateLecturePracticeProgress
  };
});

function mountPage() {
  return mount(LecturePracticePage, {
    global: {
      plugins: [VueQueryPlugin],
      stubs: { RouterLink: RouterLinkStub }
    }
  });
}

describe("LecturePracticePage", () => {
  beforeEach(() => {
    mocks.token = null;
    mocks.replace.mockClear();
    mocks.getLecturePracticeProgress.mockReset();
    mocks.updateLecturePracticeProgress.mockReset();
    mocks.getLecturePracticeProgress.mockResolvedValue({
      progress: {
        humanLectureCount: 0,
        bookReportCount: 0,
        socialPracticeCredits: "1.00",
        socialPracticeCourseCount: 0
      }
    });
    mocks.updateLecturePracticeProgress.mockResolvedValue({
      progress: {
        humanLectureCount: 1,
        bookReportCount: 0,
        socialPracticeCredits: "1.00",
        socialPracticeCourseCount: 0
      }
    });
  });

  it("redirects unauthenticated users to login", () => {
    mountPage();

    expect(mocks.replace).toHaveBeenCalledWith("/login");
  });

  it("renders lecture practice requirements and social practice excellence state", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();

    expect(wrapper.text()).toContain("讲座实践");
    expect(wrapper.text()).toContain("人文讲座");
    expect(wrapper.text()).toContain("8 次");
    expect(wrapper.text()).toContain("读书报告");
    expect(wrapper.text()).toContain("2 次");
    expect(wrapper.text()).toContain("社会实践学分");
    expect(wrapper.text()).toContain("1 学分");
    expect(wrapper.text()).toContain("距优秀还差 2 学分");
    expect(wrapper.text()).toContain("社会实践公开课");
  });

  it("uses different badge colors for incomplete and completed statuses", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();

    expect(wrapper.get('[data-testid="progress-humanLectureCount-status"]').classes()).toEqual(
      expect.arrayContaining(["bg-[color-mix(in_srgb,var(--tommy-warning)_14%,white)]", "text-[var(--tommy-warning)]"])
    );

    await wrapper.get('[data-testid="progress-humanLectureCount-input"]').setValue("8");

    expect(wrapper.get('[data-testid="progress-humanLectureCount-status"]').classes()).toEqual(
      expect.arrayContaining(["bg-[color-mix(in_srgb,var(--tommy-success)_14%,white)]", "text-[var(--tommy-success)]"])
    );
  });

  it("supports plus minus controls, manual input, and save", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();

    const lectureInput = wrapper.get('[data-testid="progress-humanLectureCount-input"]');
    await wrapper.get('[data-testid="progress-humanLectureCount-increment"]').trigger("click");
    expect((lectureInput.element as HTMLInputElement).value).toBe("1");
    await wrapper.get('[data-testid="progress-humanLectureCount-decrement"]').trigger("click");
    await wrapper.get('[data-testid="progress-humanLectureCount-decrement"]').trigger("click");
    expect((lectureInput.element as HTMLInputElement).value).toBe("0");
    await lectureInput.setValue("8");
    await wrapper.get('[data-testid="progress-humanLectureCount-save"]').trigger("click");

    expect(mocks.updateLecturePracticeProgress).toHaveBeenCalledWith(
      expect.objectContaining({ humanLectureCount: 8 })
    );
  });

  it("adjusts social practice credits in 0.1 increments", async () => {
    mocks.token = "token";
    mocks.getLecturePracticeProgress.mockResolvedValue({
      progress: {
        humanLectureCount: 0,
        bookReportCount: 0,
        socialPracticeCredits: "0.00",
        socialPracticeCourseCount: 0
      }
    });
    const wrapper = mountPage();

    await flushPromises();

    const creditsInput = wrapper.get('[data-testid="progress-socialPracticeCredits-input"]');
    expect(wrapper.get('[data-testid="progress-socialPracticeCredits-increment"]').text()).toBe("+");
    expect(wrapper.get('[data-testid="progress-socialPracticeCredits-decrement"]').text()).toBe("-");
    await wrapper.get('[data-testid="progress-socialPracticeCredits-increment"]').trigger("click");
    expect((creditsInput.element as HTMLInputElement).value).toBe("0.1");
    await wrapper.get('[data-testid="progress-socialPracticeCredits-decrement"]').trigger("click");
    await wrapper.get('[data-testid="progress-socialPracticeCredits-decrement"]').trigger("click");
    expect((creditsInput.element as HTMLInputElement).value).toBe("0");
  });
});
