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
          gpaGoal: "3.50"
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

    const giftEntry = wrapper
      .findAllComponents(RouterLinkStub)
      .find((entry) => entry.attributes("data-testid") === "profile-graduation-gift");

    expect(giftEntry?.text()).toContain("毕业礼包");
    expect(giftEntry?.props("to")).toBe("/graduation-gift");
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
});
