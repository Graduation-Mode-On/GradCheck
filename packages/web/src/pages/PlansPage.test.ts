import { VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, RouterLinkStub } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PlansPage from "./PlansPage.vue";

const mocks = vi.hoisted(() => ({
  token: null as string | null,
  replace: vi.fn(),
  getCurrentProgramPlan: vi.fn(),
  mockUploadProgramPlan: vi.fn(),
  importProgramPlan: vi.fn()
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
    getCurrentProgramPlan: mocks.getCurrentProgramPlan,
    mockUploadProgramPlan: mocks.mockUploadProgramPlan,
    importProgramPlan: mocks.importProgramPlan
  };
});

const samplePlan = {
  sourceFilename: "software-plan.pdf",
  school: "东南大学",
  college: "软件学院",
  major: "软件工程",
  grade: "2022级",
  totalCredits: "166",
  courseCount: 3,
  requirementCount: 2,
  warningCount: 0,
  planJson: {
    program: { school: "东南大学", college: "软件学院", major: "软件工程", grade: "2022级", total_credits: 166 },
    courses: [
      { code: "BJSL1010", name: "数据结构", credits: 3, category: "专业主干课", subcategory: "软件工程", term: { year: "二", semester: "1" } },
      { code: "B07M1050", name: "工科数学分析I", credits: 6, category: "通识教育基础课", subcategory: "数学类", term: { year: "一", semester: "1" } },
      { code: "BJSL0020", name: "程序设计基础及语言I(双语)", credits: 2, category: "大类学科基础课", subcategory: "软件工程", term: { year: "一", semester: "1" } }
    ],
    requirements: [
      { id: "sishi_choose_one", type: "choose_one_of", title: "四史四选一" },
      { id: "major_required", type: "all_required", title: "专业主干必修课" }
    ],
    semester_plan: [
      { academic_year: "第一学年", semester: "第1学期", courses: [{ code: "B07M1050", name: "工科数学分析I", credits: 6, required_type: "必修" }] }
    ],
    warnings: [],
    provenance: { source_pdf: "software-plan.pdf", extractor_version: "pdf-extract-sample" }
  }
};

function mountPage() {
  return mount(PlansPage, {
    global: {
      plugins: [VueQueryPlugin],
      stubs: { RouterLink: RouterLinkStub }
    }
  });
}

describe("PlansPage", () => {
  beforeEach(() => {
    mocks.token = null;
    mocks.replace.mockClear();
    mocks.getCurrentProgramPlan.mockReset();
    mocks.mockUploadProgramPlan.mockReset();
    mocks.importProgramPlan.mockReset();
    mocks.getCurrentProgramPlan.mockResolvedValue({ plan: null });
    mocks.mockUploadProgramPlan.mockResolvedValue({ preview: samplePlan });
    mocks.importProgramPlan.mockResolvedValue({ plan: { id: "plan-1", ...samplePlan }, binding: {} });
  });

  it("redirects unauthenticated users to login", () => {
    mountPage();

    expect(mocks.replace).toHaveBeenCalledWith("/login");
  });

  it("uploads a PDF and renders the parsed preview", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();
    Object.defineProperty(wrapper.get('[data-testid="program-plan-file"]').element, "files", {
      value: [new File(["pdf"], "software-plan.pdf", { type: "application/pdf" })]
    });
    await wrapper.get('[data-testid="program-plan-file"]').trigger("change");
    expect(wrapper.get('[data-testid="program-plan-mock-upload"]').text()).toBe("解析");
    await wrapper.get('[data-testid="program-plan-mock-upload"]').trigger("click");
    await flushPromises();

    expect(mocks.mockUploadProgramPlan).toHaveBeenCalledWith(expect.any(File));
    expect(wrapper.text()).toContain("软件工程");
    expect(wrapper.text()).toContain("166");
    expect(wrapper.text()).toContain("3 门课程");
    expect(wrapper.text()).toContain("2 条规则");
    expect(wrapper.text()).toContain("工科数学分析I");
  });

  it("filters preview courses by search and category", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();
    Object.defineProperty(wrapper.get('[data-testid="program-plan-file"]').element, "files", {
      value: [new File(["pdf"], "software-plan.pdf", { type: "application/pdf" })]
    });
    await wrapper.get('[data-testid="program-plan-file"]').trigger("change");
    await wrapper.get('[data-testid="program-plan-mock-upload"]').trigger("click");
    await flushPromises();

    await wrapper.get('[data-testid="program-course-search"]').setValue("数据结构");

    expect(wrapper.text()).toContain("数据结构");
    expect(wrapper.text()).not.toContain("工科数学分析I");

    await wrapper.get('[data-testid="program-course-search"]').setValue("");
    await wrapper.get('[data-testid="program-course-category"]').setValue("通识教育基础课");

    expect(wrapper.text()).toContain("工科数学分析I");
    expect(wrapper.text()).not.toContain("数据结构");
  });

  it("filters preview courses by semester alongside category", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();
    Object.defineProperty(wrapper.get('[data-testid="program-plan-file"]').element, "files", {
      value: [new File(["pdf"], "software-plan.pdf", { type: "application/pdf" })]
    });
    await wrapper.get('[data-testid="program-plan-file"]').trigger("change");
    await wrapper.get('[data-testid="program-plan-mock-upload"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="program-course-semester"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="program-course-semester"] option').map((option) => option.attributes("value"))).toEqual(["all", "一-1", "二-1"]);
    await wrapper.get('[data-testid="program-course-semester"]').setValue("二-1");

    expect(wrapper.text()).toContain("数据结构");
    expect(wrapper.text()).not.toContain("工科数学分析I");
  });

  it("imports and binds the preview plan", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();
    Object.defineProperty(wrapper.get('[data-testid="program-plan-file"]').element, "files", {
      value: [new File(["pdf"], "software-plan.pdf", { type: "application/pdf" })]
    });
    await wrapper.get('[data-testid="program-plan-file"]').trigger("change");
    await wrapper.get('[data-testid="program-plan-mock-upload"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="program-plan-import"]').trigger("click");

    expect(mocks.importProgramPlan).toHaveBeenCalledWith({
      sourceFilename: "software-plan.pdf",
      planJson: samplePlan.planJson
    });
  });

  it("renders the current bound plan summary", async () => {
    mocks.token = "token";
    mocks.getCurrentProgramPlan.mockResolvedValue({ plan: { id: "plan-1", ...samplePlan } });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).not.toContain("当前绑定方案");
    expect(wrapper.text()).toContain("软件工程");
    expect(wrapper.text()).toContain("2022级");
  });

  it("shows a display page for an existing plan and opens reimport on demand", async () => {
    mocks.token = "token";
    mocks.getCurrentProgramPlan.mockResolvedValue({ plan: { id: "plan-1", ...samplePlan } });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain("我的培养方案");
    expect(wrapper.text()).toContain("课程总览");
    expect(wrapper.text()).toContain("毕业要求清单");
    expect(wrapper.find('[data-testid="program-plan-file"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="program-plan-import"]').exists()).toBe(false);

    await wrapper.get('[data-testid="program-plan-reimport"]').trigger("click");

    expect(wrapper.find('[data-testid="program-plan-file"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("重新导入培养方案");
  });
});
