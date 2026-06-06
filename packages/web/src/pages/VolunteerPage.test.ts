import { VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, RouterLinkStub } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VolunteerPage from "./VolunteerPage.vue";

const mocks = vi.hoisted(() => ({
  token: null as string | null,
  replace: vi.fn(),
  getVolunteerLaborProgress: vi.fn(),
  updateVolunteerLaborProgress: vi.fn()
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
    getVolunteerLaborProgress: mocks.getVolunteerLaborProgress,
    updateVolunteerLaborProgress: mocks.updateVolunteerLaborProgress
  };
});

function mountPage() {
  return mount(VolunteerPage, {
    global: {
      plugins: [VueQueryPlugin],
      stubs: { RouterLink: RouterLinkStub }
    }
  });
}

describe("VolunteerPage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.token = null;
    mocks.replace.mockClear();
    mocks.getVolunteerLaborProgress.mockReset();
    mocks.updateVolunteerLaborProgress.mockReset();
    mocks.getVolunteerLaborProgress.mockResolvedValue({
      progress: {
        volunteerHours: "0.00",
        ordinaryLaborCount: 0,
        specialLaborCount: 0
      }
    });
    mocks.updateVolunteerLaborProgress.mockResolvedValue({
      progress: {
        volunteerHours: "1.00",
        ordinaryLaborCount: 0,
        specialLaborCount: 0
      }
    });
  });

  it("redirects unauthenticated users to login", () => {
    mountPage();

    expect(mocks.replace).toHaveBeenCalledWith("/login");
  });

  it("renders volunteer labor requirements", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();

    expect(wrapper.text()).toContain("志愿劳育");
    expect(wrapper.text()).toContain("志愿活动时长");
    expect(wrapper.text()).toContain("12 小时");
    expect(wrapper.text()).toContain("普通生产劳动");
    expect(wrapper.text()).toContain("2 次");
    expect(wrapper.text()).toContain("特色劳动");
    expect(wrapper.text()).toContain("1 次");
  });

  it("supports plus minus controls, manual input, and save", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();

    const hoursInput = wrapper.get('[data-testid="progress-volunteerHours-input"]');
    await wrapper.get('[data-testid="progress-volunteerHours-increment"]').trigger("click");
    expect((hoursInput.element as HTMLInputElement).value).toBe("1");
    await wrapper.get('[data-testid="progress-volunteerHours-decrement"]').trigger("click");
    await wrapper.get('[data-testid="progress-volunteerHours-decrement"]').trigger("click");
    expect((hoursInput.element as HTMLInputElement).value).toBe("0");
    await hoursInput.setValue("12");
    await wrapper.get('[data-testid="progress-volunteerHours-save"]').trigger("click");

    expect(mocks.updateVolunteerLaborProgress).toHaveBeenCalledWith(
      expect.objectContaining({ volunteerHours: "12.00" })
    );
  });

  it("shows a temporary saved state after saving progress", async () => {
    vi.useFakeTimers();
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();
    await wrapper.get('[data-testid="progress-volunteerHours-save"]').trigger("click");
    await flushPromises();

    const saveButton = wrapper.get('[data-testid="progress-volunteerHours-save"]');
    expect(saveButton.text()).toBe("已保存");
    expect(saveButton.classes()).toContain("bg-[var(--tommy-success)]");

    vi.advanceTimersByTime(1000);
    await flushPromises();

    expect(saveButton.text()).toBe("保存");
    expect(saveButton.classes()).toContain("bg-[var(--tommy-primary)]");
    vi.useRealTimers();
  });
});
