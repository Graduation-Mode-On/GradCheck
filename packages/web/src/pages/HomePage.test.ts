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
    }),
    getGpaDashboard: async () => ({
      courses: [],
      result: {
        requiredFirstAttempt: {
          weightedGpa: 3.67,
          weightedAverageScore: 91.2,
          totalCredits: 24,
          courseCount: 8
        },
        overall: {
          weightedGpa: 3.58,
          weightedAverageScore: 89.5,
          totalCredits: 30,
          courseCount: 10
        }
      }
    }),
    listCustomRequirements: async () => ({
      customRequirements: [
        {
          id: "requirement-1",
          userId: "user-1",
          name: "人文讲座",
          kind: "count",
          category: "lecture",
          targetValue: "4",
          currentValue: "2",
          unit: "次",
          importance: "required",
          source: "user_custom",
          includeInProgress: true,
          showOnHome: true,
          deadline: "2026-06-30",
          notes: null,
          status: "in_progress",
          progressPercent: 50,
          createdAt: "2026-06-06T00:00:00.000Z",
          updatedAt: "2026-06-06T00:00:00.000Z"
        },
        {
          id: "requirement-2",
          userId: "user-1",
          name: "个人阅读目标",
          kind: "count",
          category: "other",
          targetValue: "10",
          currentValue: "1",
          unit: "本",
          importance: "personal_goal",
          source: "user_custom",
          includeInProgress: false,
          showOnHome: false,
          deadline: null,
          notes: null,
          status: "in_progress",
          progressPercent: 10,
          createdAt: "2026-06-06T00:00:00.000Z",
          updatedAt: "2026-06-06T00:00:00.000Z"
        }
      ]
    }),
    getGraduationSummary: async () => ({
      overall: {
        coursesPercent: 64,
        completedDimensions: 3,
        totalDimensions: 11,
        unfinishedCount: 8
      },
      dimensions: [
        { key: "courses", id: "courses", label: "培养方案课程", status: "in_progress", current: 100, target: 160, unit: "学分", percent: 64, route: "/courses", detail: "进行中" },
        { key: "gpa", id: "gpa", label: "GPA", status: "completed", current: 3.5, target: 2, unit: "", percent: 100, route: "/gpa", detail: "已通过" },
        { key: "human_lecture", id: "human_lecture", label: "人文讲座", status: "in_progress", current: 5, target: 8, unit: "次", percent: 63, route: "/lecture-practice", detail: "5/8 次" },
        { key: "book_report", id: "book_report", label: "读书报告", status: "not_started", current: 0, target: 2, unit: "篇", percent: 0, route: "/lecture-practice", detail: "0/2 篇" },
        { key: "social_practice_credits", id: "social_practice_credits", label: "社会实践学分", status: "completed", current: 1, target: 1, unit: "学分", percent: 100, route: "/lecture-practice", detail: "已完成" },
        { key: "social_practice_courses", id: "social_practice_courses", label: "社会实践课程", status: "not_started", current: 0, target: 1, unit: "门", percent: 0, route: "/lecture-practice", detail: "0/1 门" },
        { key: "volunteer_hours", id: "volunteer_hours", label: "志愿服务", status: "in_progress", current: 6, target: 12, unit: "小时", percent: 50, route: "/volunteer", detail: "6/12 小时" },
        { key: "ordinary_labor", id: "ordinary_labor", label: "普通劳动", status: "not_started", current: 0, target: 2, unit: "次", percent: 0, route: "/volunteer", detail: "0/2 次" },
        { key: "special_labor", id: "special_labor", label: "专项劳动", status: "not_started", current: 0, target: 1, unit: "次", percent: 0, route: "/volunteer", detail: "0/1 次" },
        { key: "srtp", id: "srtp", label: "SRTP", status: "completed", current: 2, target: 2, unit: "学分", percent: 100, route: "/srtp", detail: "通过" },
        { key: "custom_requirement", id: "custom:requirement-1", label: "人文讲座", status: "in_progress", current: 2, target: 4, unit: "次", percent: 50, route: "/custom-requirements", detail: "2/4 次" }
      ]
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

  it("renders the graduation progress card driven by the summary endpoint", async () => {
    const wrapper = mountHomePage();

    await vi.dynamicImportSettled();

    const card = wrapper.get('[data-testid="graduation-progress-card"]');
    expect(card.get('[data-testid="graduation-dimension-count"]').text()).toContain("3");
    expect(card.get('[data-testid="graduation-dimension-count"]').text()).toContain("11");
    expect(card.get('[data-testid="courses-percent"]').text()).toBe("64%");

    const bar = card.get('[data-testid="courses-percent-bar"]');
    expect(bar.attributes("style")).toContain("width: 64%");

    const segments = card.findAll('[data-testid="graduation-status-segment"]');
    expect(segments).toHaveLength(11);
    expect(segments[0].attributes("data-status")).toBe("in_progress");
    expect(segments[0].attributes("data-key")).toBe("courses");
    expect(segments[1].attributes("data-status")).toBe("completed");
    expect(segments[1].classes()).toContain("bg-[var(--tommy-success)]");
    expect(segments[3].attributes("data-status")).toBe("not_started");
    expect(segments[3].classes()).toContain("bg-slate-300");

    const legendEntries = card.findAll('[data-testid="graduation-status-legend-entry"]');
    expect(legendEntries).toHaveLength(3);
    expect(legendEntries[0].attributes("data-status")).toBe("completed");
    expect(legendEntries[0].text()).toContain("已完成");
    expect(legendEntries[0].text()).toContain("3");
    expect(legendEntries[1].attributes("data-status")).toBe("in_progress");
    expect(legendEntries[1].text()).toContain("进行中");
    expect(legendEntries[1].text()).toContain("4");
    expect(legendEntries[2].attributes("data-status")).toBe("not_started");
    expect(legendEntries[2].text()).toContain("未开始");
    expect(legendEntries[2].text()).toContain("4");

    const footer = card.get('[data-testid="graduation-progress-footer"]');
    expect(footer.text()).toContain("还有 8 项未完成");
    expect(footer.text()).not.toContain("圆点");
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
      "GPA",
      "选课推荐",
      "体育跑操",
      "讲座实践",
      "志愿劳育",
      "实验考试",
      "自定义",
      "SRTP"
    ]);
    expect(featureGrid.findAllComponents(RouterLinkStub)[5]?.props("to")).toBe("/lecture-practice");
    expect(featureGrid.text()).not.toContain("毕业礼包");
  });

  it("renders dashboard cards with jump hints", async () => {
    const wrapper = mountHomePage();

    await vi.dynamicImportSettled();

    const dashboard = wrapper.get('[data-testid="dashboard-card-grid"]');
    const primaryCardRow = dashboard.find(".grid");
    const customSummary = wrapper.get('[data-testid="custom-requirements-home-summary"]');
    const customPrimaryText = customSummary.get('[data-testid="custom-requirement-primary-text"]');

    expect(primaryCardRow.classes()).toContain("grid-cols-2");
    expect(customPrimaryText.classes()).toEqual(expect.arrayContaining(["break-words", "text-base", "sm:text-2xl"]));
    expect(dashboard.text()).toContain("GPA计算器");
    expect(dashboard.text()).toContain("3.67");
    expect(dashboard.text()).toContain(">");
    expect(dashboard.text()).not.toContain("点击卡片估算绩点 >");
    expect(dashboard.text()).not.toContain("录入课程成绩后，估算剩余课程需要达到的平均绩点。");
    expect(dashboard.text()).not.toContain("把学院特色要求或个人目标固定在首页，随时查看进度。");
    expect(dashboard.text()).toContain("提醒事项");
    expect(dashboard.text()).toContain("查看全部提醒 >");
    expect(dashboard.text()).toContain("机会推荐");
    expect(dashboard.text()).toContain("查看补齐机会 >");
  });

  it("shows only show-on-home custom requirements in the homepage summary", async () => {
    const wrapper = mountHomePage();

    await vi.dynamicImportSettled();

    const customSummary = wrapper.get('[data-testid="custom-requirements-home-summary"]');
    expect(customSummary.text()).toContain("人文讲座");
    expect(customSummary.text()).toContain("2 / 4 次");
    expect(customSummary.text()).not.toContain("1 项展示");
    expect(customSummary.text()).not.toContain("个人阅读目标");
  });
});
