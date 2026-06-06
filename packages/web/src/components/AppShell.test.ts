import { mount, RouterLinkStub } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import AppShell from "./AppShell.vue";

describe("AppShell responsive navigation", () => {
  it("keeps the desktop top navigation and adds a mobile graduation prompt", () => {
    const wrapper = mount(AppShell, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub
        }
      },
      slots: {
        default: "<p>content</p>"
      }
    });

    expect(wrapper.get('[data-testid="desktop-navigation"]').text()).toContain("首页");
    expect(wrapper.get('[data-testid="desktop-navigation"]').text()).toContain("个人信息");
    expect(wrapper.get('[data-testid="mobile-graduation-prompt"]').text()).toBe("你现在能毕业吗？");
    expect(wrapper.get('[data-testid="mobile-navigation"]').text()).not.toContain("退出");
  });

  it("renders four mobile bottom navigation tabs", () => {
    const wrapper = mount(AppShell, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub
        }
      }
    });

    const mobileNav = wrapper.get('[data-testid="mobile-bottom-navigation"]');

    expect(mobileNav.classes()).toContain("sm:hidden");
    expect(mobileNav.text()).toContain("首页");
    expect(mobileNav.text()).toContain("资讯");
    expect(mobileNav.text()).toContain("广场");
    expect(mobileNav.text()).toContain("个人");
  });
});
