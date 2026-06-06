import { mount, flushPromises } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./LoginPage.vue";

const { login, register, setToken, push } = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  setToken: vi.fn(),
  push: vi.fn()
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push })
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    login,
    register,
    setToken
  };
});

function mountPage() {
  return mount(LoginPage, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) }]]
    }
  });
}

describe("LoginPage", () => {
  beforeEach(() => {
    login.mockReset();
    register.mockReset();
    setToken.mockReset();
    push.mockReset();
  });

  it("uses a predefined college selector during registration", async () => {
    register.mockResolvedValueOnce({ token: "token", user: { id: "u1" } });
    const wrapper = mountPage();

    await wrapper.get('[data-testid="register-mode"]').trigger("click");

    const collegeSelect = wrapper.get('[data-testid="register-college"]');
    expect(collegeSelect.element.tagName).toBe("SELECT");
    expect(collegeSelect.text()).toContain("建筑学院");
    expect(collegeSelect.text()).toContain("东南大学—蒙纳士大学苏州联合研究生院");

    await wrapper.get('[data-testid="login-email"]').setValue("user@example.com");
    await wrapper.get('[data-testid="login-password"]').setValue("password123");
    await wrapper.get('[data-testid="register-display-name"]').setValue("同学");
    await collegeSelect.setValue("软件学院");
    await wrapper.get('[data-testid="register-major"]').setValue("软件工程");
    await wrapper.get('[data-testid="login-form"]').trigger("submit");
    await flushPromises();

    expect(register).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
      profile: {
        displayName: "同学",
        college: "软件学院",
        major: "软件工程",
        grade: new Date().getFullYear(),
        gpaGoal: "2.00"
      }
    });
  });
});
