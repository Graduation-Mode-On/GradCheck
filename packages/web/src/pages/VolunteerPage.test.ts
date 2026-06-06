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
        volunteerHours: "0.50",
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
    expect(wrapper.text()).toContain("12");
    expect(wrapper.text()).toContain("普通生产劳动");
    expect(wrapper.text()).toContain("2");
    expect(wrapper.text()).toContain("特色劳动");
    expect(wrapper.text()).toContain("1");
  });

  it("increments volunteer hours via +0.5 button and auto-saves", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();

    expect(wrapper.get('[data-testid="progress-volunteerHours-increment"]').text()).toBe("+0.5");

    await wrapper.get('[data-testid="progress-volunteerHours-increment"]').trigger("click");
    await flushPromises();

    expect(mocks.updateVolunteerLaborProgress).toHaveBeenCalledWith(
      expect.objectContaining({ volunteerHours: "0.50" })
    );
  });

  it("increments ordinary labor count via +1 button and auto-saves", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();

    await wrapper.get('[data-testid="progress-ordinaryLaborCount-increment"]').trigger("click");
    await flushPromises();

    expect(mocks.updateVolunteerLaborProgress).toHaveBeenCalledWith(
      expect.objectContaining({ ordinaryLaborCount: 1 })
    );
  });

  it("toggles special labor completion and auto-saves", async () => {
    mocks.token = "token";
    mocks.updateVolunteerLaborProgress.mockResolvedValue({
      progress: {
        volunteerHours: "0.00",
        ordinaryLaborCount: 0,
        specialLaborCount: 1
      }
    });
    const wrapper = mountPage();

    await flushPromises();

    await wrapper.get('[data-testid="progress-specialLaborCount-toggle"]').trigger("click");
    await flushPromises();

    expect(mocks.updateVolunteerLaborProgress).toHaveBeenCalledWith(
      expect.objectContaining({ specialLaborCount: 1 })
    );
  });

  it("shows a temporary saved state after auto-saving", async () => {
    vi.useFakeTimers();
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();
    await wrapper.get('[data-testid="progress-ordinaryLaborCount-increment"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("已保存");

    vi.advanceTimersByTime(1000);
    await flushPromises();

    expect(wrapper.text()).not.toContain("已保存");
    vi.useRealTimers();
  });
});
