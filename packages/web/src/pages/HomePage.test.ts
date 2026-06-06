import { mount, RouterLinkStub } from "@vue/test-utils";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { describe, expect, it, vi } from "vitest";

import HomePage from "./HomePage.vue";

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

function mountHomePage() {
  return mount(HomePage, {
    global: {
      plugins: [VueQueryPlugin],
      stubs: {
        RouterLink: RouterLinkStub
      }
    }
  });
}

describe("HomePage dashboard layout", () => {
  it("shows the progress card before the 10-entry feature grid", () => {
    const wrapper = mountHomePage();

    const progressCard = wrapper.get('[data-testid="graduation-progress-card"]');
    const featureGrid = wrapper.get('[data-testid="feature-entry-grid"]');

    expect(progressCard.text()).toContain("毕业进度总览");
    expect(progressCard.text()).not.toContain("数据可信度");
    expect(progressCard.element.compareDocumentPosition(featureGrid.element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("renders the 10 PRD feature entries in a 5-column grid", () => {
    const wrapper = mountHomePage();
    const featureGrid = wrapper.get('[data-testid="feature-entry-grid"]');
    const featureGridCard = wrapper.get('[data-testid="feature-entry-grid-card"]');
    const entries = featureGrid.findAll('[data-testid="feature-entry"]');

    expect(featureGridCard.classes()).toContain("border");
    expect(featureGrid.classes()).toContain("grid-cols-5");
    expect(entries).toHaveLength(10);
    expect(featureGrid.findAll('[data-testid="feature-entry-icon"]')).toHaveLength(10);
    expect(featureGrid.findAll('[data-testid="feature-entry-icon"]')[0]?.classes()).toEqual(expect.arrayContaining(["h-7", "w-7"]));
    expect(entries[0]?.get('[data-testid="feature-entry-icon-shell"]').classes()).toEqual(expect.arrayContaining(["h-14", "w-14"]));
    expect(entries[0]?.get('[data-testid="feature-entry-label"]').classes()).toContain("text-[10px]");
    expect(featureGrid.text()).not.toMatch(/[📘✅🎯🧭🏃🎤🤝🧪⚙️🎁]/u);
    expect(entries.map((entry) => entry.get('[data-testid="feature-entry-label"]').text())).toEqual([
      "培养方案",
      "课程进度",
      "GPA目标",
      "选课推荐",
      "体育跑操",
      "讲座实践",
      "志愿劳育",
      "实验考试",
      "自定义要求",
      "毕业礼包"
    ]);
    expect(featureGrid.findAllComponents(RouterLinkStub)[5]?.props("to")).toBe("/lecture-practice");
  });

  it("renders dashboard cards with jump hints", () => {
    const wrapper = mountHomePage();
    const dashboard = wrapper.get('[data-testid="dashboard-card-grid"]');

    expect(dashboard.text()).toContain("GPA计算器");
    expect(dashboard.text()).toContain("点击卡片估算绩点 >");
    expect(dashboard.text()).toContain("提醒事项");
    expect(dashboard.text()).toContain("查看全部提醒 >");
    expect(dashboard.text()).toContain("机会推荐");
    expect(dashboard.text()).toContain("查看补齐机会 >");
  });
});
