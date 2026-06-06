import { mount, RouterLinkStub } from "@vue/test-utils";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CustomRequirementsPage from "./CustomRequirementsPage.vue";

const updateCustomRequirementMock = vi.hoisted(() => vi.fn());
const createCustomRequirementMock = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  RouterLink: RouterLinkStub
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    getToken: () => "token",
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
          notes: "需要学院认定",
          status: "in_progress",
          progressPercent: 50,
          createdAt: "2026-06-06T00:00:00.000Z",
          updatedAt: "2026-06-06T00:00:00.000Z"
        }
      ]
    }),
    createCustomRequirement: createCustomRequirementMock,
    updateCustomRequirement: updateCustomRequirementMock,
    deleteCustomRequirement: vi.fn()
  };
});

describe("CustomRequirementsPage", () => {
  beforeEach(() => {
    updateCustomRequirementMock.mockReset();
    createCustomRequirementMock.mockReset();
  });

  it("shows existing custom requirements and the show-on-home setting", async () => {
    const wrapper = mount(CustomRequirementsPage, {
      global: {
        plugins: [VueQueryPlugin],
        stubs: { RouterLink: RouterLinkStub }
      }
    });

    await vi.dynamicImportSettled();

    expect(wrapper.text()).toContain("自定义要求");
    expect(wrapper.text()).toContain("人文讲座");
    expect(wrapper.text()).toContain("2 / 4 次");
    expect(wrapper.text()).toContain("主页展示");
  });

  it("renders the create form fields for the template model", () => {
    const wrapper = mount(CustomRequirementsPage, {
      global: {
        plugins: [VueQueryPlugin],
        stubs: { RouterLink: RouterLinkStub }
      }
    });

    expect(wrapper.find('[data-testid="custom-requirement-name"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="custom-requirement-kind"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="custom-requirement-target"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="custom-requirement-current"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="custom-requirement-unit"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="custom-requirement-category"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="custom-requirement-importance"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="custom-requirement-source"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="custom-requirement-include-in-progress"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="custom-requirement-show-on-home"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="custom-requirement-deadline"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="custom-requirement-notes"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="custom-requirement-form-card"]').classes()).toEqual(
      expect.arrayContaining(["bg-gradient-to-br", "from-white"])
    );
  });

  it("lets users toggle whether an existing requirement is shown on home", async () => {
    const wrapper = mount(CustomRequirementsPage, {
      global: {
        plugins: [VueQueryPlugin],
        stubs: { RouterLink: RouterLinkStub }
      }
    });

    await vi.dynamicImportSettled();
    await wrapper.get('[data-testid="toggle-home-requirement-1"]').trigger("click");

    expect(updateCustomRequirementMock).toHaveBeenCalledWith("requirement-1", { showOnHome: false });
  });

  it("disables quick actions while a custom requirement update is pending", async () => {
    let resolveUpdate: (value: unknown) => void = () => undefined;
    updateCustomRequirementMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    const wrapper = mount(CustomRequirementsPage, {
      global: {
        plugins: [VueQueryPlugin],
        stubs: { RouterLink: RouterLinkStub }
      }
    });

    await vi.dynamicImportSettled();
    await wrapper.get('[data-testid="increment-requirement-1"]').trigger("click");
    await wrapper.get('[data-testid="increment-requirement-1"]').trigger("click");

    expect(updateCustomRequirementMock).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="increment-requirement-1"]').attributes("disabled")).toBeDefined();
    resolveUpdate({});
  });

  it("keeps mobile requirement actions in one compact row", async () => {
    const wrapper = mount(CustomRequirementsPage, {
      global: {
        plugins: [VueQueryPlugin],
        stubs: { RouterLink: RouterLinkStub }
      }
    });

    await vi.dynamicImportSettled();
    const actions = wrapper.get('[data-testid="custom-requirement-actions-requirement-1"]');

    expect(actions.classes()).toEqual(expect.arrayContaining(["flex-nowrap", "overflow-x-auto"]));
    expect(actions.text()).toContain("+1");
    expect(actions.text()).toContain("完成");
    expect(actions.text()).toContain("编辑");
    expect(actions.text()).toContain("首页");
    expect(actions.text()).toContain("删除");
    expect(actions.text()).not.toContain("标记完成");
    expect(actions.text()).not.toContain("取消主页展示");
  });


  it("loads an existing requirement into the form for editing", async () => {
    const wrapper = mount(CustomRequirementsPage, {
      global: {
        plugins: [VueQueryPlugin],
        stubs: { RouterLink: RouterLinkStub }
      }
    });

    await vi.dynamicImportSettled();
    await wrapper.get('[data-testid="edit-requirement-1"]').trigger("click");

    expect((wrapper.get('[data-testid="custom-requirement-name"]').element as HTMLInputElement).value).toBe("人文讲座");
    expect((wrapper.get('[data-testid="custom-requirement-unit"]').element as HTMLInputElement).value).toBe("次");
    expect((wrapper.get('[data-testid="custom-requirement-deadline"]').element as HTMLInputElement).value).toBe("2026-06-30");
    expect((wrapper.get('[data-testid="custom-requirement-notes"]').element as HTMLTextAreaElement).value).toBe("需要学院认定");
    expect(wrapper.get('[data-testid="custom-requirement-submit"]').text()).toBe("保存自定义要求");
  });
});
