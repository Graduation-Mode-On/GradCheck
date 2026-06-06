import { mount, RouterLinkStub } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import GraduationGuidePage from "./GraduationGuidePage.vue";

describe("GraduationGuidePage", () => {
  it("renders the hero title and all 8 guide sections", () => {
    const wrapper = mount(GraduationGuidePage, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub
        }
      }
    });

    expect(wrapper.text()).toContain("毕业指南");
    expect(wrapper.text()).toContain("适用范围");
    expect(wrapper.text()).toContain("学校行政部门手续");
    expect(wrapper.text()).toContain("时间安排提醒");

    const sectionIds = [
      "scope",
      "enter-system",
      "qualification",
      "administration",
      "college",
      "diploma",
      "timing"
    ];

    for (const id of sectionIds) {
      expect(wrapper.find(`[data-testid="graduation-guide-section-${id}"]`).exists()).toBe(true);
    }
  });

  it("includes the closing finale line", () => {
    const wrapper = mount(GraduationGuidePage, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub
        }
      }
    });

    expect(wrapper.text()).toContain("落幕");
  });
});
