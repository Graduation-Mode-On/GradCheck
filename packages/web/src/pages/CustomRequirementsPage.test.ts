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
    expect(wrapper.get('[data-testid="custom-requirement-submit"]').text()).toBe("保存自定义要求");
  });
});
