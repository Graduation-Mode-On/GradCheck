import { VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, RouterLinkStub } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PlazaPage from "./PlazaPage.vue";

const mocks = vi.hoisted(() => ({
  token: null as string | null,
  replace: vi.fn(),
  listPlazaPosts: vi.fn()
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
    listPlazaPosts: mocks.listPlazaPosts
  };
});

function mountPlazaPage() {
  return mount(PlazaPage, {
    global: {
      plugins: [VueQueryPlugin],
      stubs: {
        RouterLink: RouterLinkStub
      }
    }
  });
}

describe("PlazaPage", () => {
  beforeEach(() => {
    mocks.token = null;
    mocks.replace.mockClear();
    mocks.listPlazaPosts.mockReset();
    mocks.listPlazaPosts.mockResolvedValue({ posts: [], nextCursor: null });
  });

  it("redirects unauthenticated users to login", () => {
    mountPlazaPage();

    expect(mocks.replace).toHaveBeenCalledWith("/login");
  });

  it("renders list-first plaza controls for authenticated users", () => {
    mocks.token = "token";

    const wrapper = mountPlazaPage();

    expect(wrapper.get('[data-testid="plaza-page"]').text()).toContain("广场");
    expect(wrapper.get('[data-testid="plaza-create-button"]').text()).toContain("发布");
    expect(wrapper.find('[data-testid="plaza-search-input"]').exists()).toBe(true);
  });

  it("only shows keyword search and status filter in plaza filters", () => {
    mocks.token = "token";

    const wrapper = mountPlazaPage();

    expect(wrapper.find('[data-testid="plaza-search-input"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="plaza-status-filter"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="plaza-course-filter"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="plaza-college-filter"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="plaza-time-filter"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="plaza-tag-filter"]').exists()).toBe(false);
  });

  it("shows an empty state and opens the create form", async () => {
    mocks.token = "token";
    const wrapper = mountPlazaPage();

    await flushPromises();

    expect(wrapper.text()).toContain("暂无广场帖子");
    await wrapper.get('[data-testid="plaza-create-button"]').trigger("click");
    expect(wrapper.text()).toContain("发布帖子");
  });

  it("renders owner controls for owned plaza posts", async () => {
    mocks.token = "token";
    mocks.listPlazaPosts.mockResolvedValue({
      posts: [
        {
          id: "post-1",
          type: "course_exchange",
          title: "想换软件工程实践课",
          college: "计算机科学与工程学院",
          contact: "QQ 123456",
          description: "时间冲突，想换同课程其他班。",
          tags: ["换课", "软件工程"],
          status: "open",
          authorDisplayName: "owner",
          isOwner: true,
          offeredCourse: "软件工程实践 周一 1-2 节",
          wantedCourse: "软件工程实践 周三 3-4 节",
          courseTime: "周一 1-2 节",
          createdAt: "2026-06-06T00:00:00.000Z",
          updatedAt: "2026-06-06T00:00:00.000Z",
          deletedAt: null
        }
      ],
      nextCursor: null
    });

    const wrapper = mountPlazaPage();

    await flushPromises();

    expect(wrapper.text()).toContain("想换软件工程实践课");
    expect(wrapper.text()).toContain("owner");
    expect(wrapper.text()).toContain("编辑");
    expect(wrapper.text()).toContain("关闭");
  });
});
