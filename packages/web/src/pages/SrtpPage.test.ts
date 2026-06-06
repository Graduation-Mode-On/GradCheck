import { VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, RouterLinkStub } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SrtpPage from "./SrtpPage.vue";

const mocks = vi.hoisted(() => ({
  token: null as string | null,
  replace: vi.fn(),
  getSrtpOverview: vi.fn(),
  createSrtpRecord: vi.fn(),
  updateSrtpRecord: vi.fn(),
  deleteSrtpRecord: vi.fn()
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
    getSrtpOverview: mocks.getSrtpOverview,
    createSrtpRecord: mocks.createSrtpRecord,
    updateSrtpRecord: mocks.updateSrtpRecord,
    deleteSrtpRecord: mocks.deleteSrtpRecord
  };
});

function mountPage() {
  return mount(SrtpPage, {
    global: {
      plugins: [VueQueryPlugin],
      stubs: { RouterLink: RouterLinkStub }
    }
  });
}

const emptyOverview = {
  records: [],
  summary: {
    totalCredits: "0.00",
    passingRequiredCredits: "2.00",
    excellentRequiredCredits: "6.00",
    status: "not_passing",
    missingForPassing: "2.00",
    missingForExcellent: "6.00"
  }
};

describe("SrtpPage", () => {
  beforeEach(() => {
    mocks.token = null;
    mocks.replace.mockClear();
    mocks.getSrtpOverview.mockReset();
    mocks.createSrtpRecord.mockReset();
    mocks.updateSrtpRecord.mockReset();
    mocks.deleteSrtpRecord.mockReset();
    mocks.getSrtpOverview.mockResolvedValue(emptyOverview);
    mocks.createSrtpRecord.mockResolvedValue({ record: {} });
    mocks.updateSrtpRecord.mockResolvedValue({ record: {} });
    mocks.deleteSrtpRecord.mockResolvedValue({ success: true });
  });

  it("redirects unauthenticated users to login", () => {
    mountPage();

    expect(mocks.replace).toHaveBeenCalledWith("/login");
  });

  it("renders empty summary with pass and excellent thresholds", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();

    expect(wrapper.text()).toContain("SRTP（课外实践）");
    expect(wrapper.text()).toContain("0.00");
    expect(wrapper.text()).toContain("2.00 分及格");
    expect(wrapper.text()).toContain("6.00 分优秀");
    expect(wrapper.text()).toContain("还差 2.00 分及格");
    expect(wrapper.text()).toContain("暂无 SRTP 记录");
    expect(wrapper.get('[data-testid="srtp-status-badge"]').classes()).toEqual(
      expect.arrayContaining(["bg-[color-mix(in_srgb,var(--tommy-error)_14%,white)]", "text-[var(--tommy-error)]"])
    );
    expect(wrapper.get('[data-testid="srtp-status-badge"]').classes()).toContain("whitespace-nowrap");
  });

  it("opens create form and submits a SRTP record with 0.1 credit input", async () => {
    mocks.token = "token";
    const wrapper = mountPage();

    await flushPromises();
    await wrapper.get('[data-testid="srtp-create-button"]').trigger("click");

    expect(wrapper.text()).toContain("新增 SRTP 记录");
    expect(wrapper.get('[data-testid="srtp-credits-input"]').attributes("step")).toBe("0.1");
    await wrapper.get('[data-testid="srtp-title-input"]').setValue("挑战杯竞赛");
    await wrapper.get('[data-testid="srtp-type-input"]').setValue("competition");
    await wrapper.get('[data-testid="srtp-credits-input"]').setValue("1.2");
    await wrapper.get('[data-testid="srtp-description-input"]').setValue("校赛获奖");
    await wrapper.get('[data-testid="srtp-submit-button"]').trigger("click");

    expect(mocks.createSrtpRecord).toHaveBeenCalledWith({
      title: "挑战杯竞赛",
      type: "competition",
      credits: "1.20",
      description: "校赛获奖"
    });
  });

  it("renders records and exposes edit and delete actions", async () => {
    mocks.token = "token";
    mocks.getSrtpOverview.mockResolvedValue({
      records: [
        {
          id: "record-1",
          title: "SRTP 讲座",
          type: "lecture",
          credits: "0.50",
          description: "讲座记录",
          createdAt: "2026-06-06T00:00:00.000Z",
          updatedAt: "2026-06-06T00:00:00.000Z"
        }
      ],
      summary: {
        ...emptyOverview.summary,
        totalCredits: "0.50",
        missingForPassing: "1.50",
        missingForExcellent: "5.50"
      }
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain("SRTP 讲座");
    expect(wrapper.text()).toContain("SRTP讲座");
    expect(wrapper.text()).toContain("0.50 学分");
    await wrapper.get('[data-testid="srtp-record-actions-record-1"]').trigger("click");
    expect(wrapper.find('[data-testid="srtp-record-edit-record-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="srtp-record-delete-record-1"]').exists()).toBe(true);
  });
});
