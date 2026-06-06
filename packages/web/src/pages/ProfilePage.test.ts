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
});
