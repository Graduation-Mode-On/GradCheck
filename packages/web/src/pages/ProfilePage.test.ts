import { mount, RouterLinkStub } from "@vue/test-utils";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { describe, expect, it, vi } from "vitest";

import ProfilePage from "./ProfilePage.vue";

vi.mock("vue-router", () => ({
  useRouter: () => ({
    replace: vi.fn()
  }),
  RouterLink: RouterLinkStub
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");

  return {
    ...actual,
    getToken: () => "token",
    getCurrentUser: async () => ({
      user: {
        id: "user-1",
        email: "student@example.com",
        profile: {
          displayName: "东大学生",
          college: "计算机科学与工程学院",
          major: "软件工程",
          grade: 2022,
          gpaGoal: "3.50",
          studentId: "213220001",
          pushplusToken: null
        }
      }
    })
  };
});

describe("ProfilePage", () => {
  it("shows the logout action on the personal profile page", () => {
    const wrapper = mount(ProfilePage, {
      global: {
        plugins: [VueQueryPlugin],
        stubs: {
          RouterLink: RouterLinkStub
        }
      }
    });

    expect(wrapper.get('[data-testid="profile-logout"]').text()).toBe("退出登录");
  });

  it("shows the graduation gift entry on the personal profile page", () => {
    const wrapper = mount(ProfilePage, {
      global: {
        plugins: [VueQueryPlugin],
        stubs: {
          RouterLink: RouterLinkStub
        }
      }
    });

    const guideEntry = wrapper
      .findAllComponents(RouterLinkStub)
      .find((entry) => entry.attributes("data-testid") === "profile-graduation-guide");

    expect(guideEntry?.text()).toContain("毕业指南");
    expect(guideEntry?.props("to")).toBe("/graduation-guide");
  });

  it("uses the shared college selector on the personal profile page", () => {
    const wrapper = mount(ProfilePage, {
      global: {
        plugins: [VueQueryPlugin],
        stubs: {
          RouterLink: RouterLinkStub
        }
      }
    });

    const collegeSelect = wrapper.get('[data-testid="profile-college"]');

    expect(collegeSelect.element.tagName).toBe("SELECT");
    expect(collegeSelect.text()).toContain("计算机科学与工程学院");
    expect(collegeSelect.text()).toContain("东南大学—蒙纳士大学苏州联合研究生院");
  });

  it("uses a 2021-2026 grade selector on the personal profile page", () => {
    const wrapper = mount(ProfilePage, {
      global: {
        plugins: [VueQueryPlugin],
        stubs: {
          RouterLink: RouterLinkStub
        }
      }
    });

    const gradeSelect = wrapper.get('[data-testid="profile-grade"]');

    expect(gradeSelect.element.tagName).toBe("SELECT");
    expect(wrapper.findAll('[data-testid="profile-grade"] option').map((option) => option.attributes("value"))).toEqual(["2021", "2022", "2023", "2024", "2025", "2026"]);
  });
});
