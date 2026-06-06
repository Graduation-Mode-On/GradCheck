import { VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount, RouterLinkStub } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PlazaPage from "./PlazaPage.vue";

const mocks = vi.hoisted(() => ({
  token: null as string | null,
  replace: vi.fn(),
  listPlazaPosts: vi.fn(),
  deletePlazaPost: vi.fn()
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
    listPlazaPosts: mocks.listPlazaPosts,
    deletePlazaPost: mocks.deletePlazaPost
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

function createPost() {
  return {
    id: "post-1",
    type: "course_exchange",
    title: "Software Practice Exchange",
    college: "Computer Science",
    contact: "QQ 123456",
    description: "Schedule conflict",
    tags: ["exchange", "software"],
    status: "open",
    authorDisplayName: "owner",
    isOwner: true,
    offeredCourse: "Software Practice Monday",
    wantedCourse: "Software Practice Wednesday",
    courseTime: "Monday 1-2",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    deletedAt: null
  };
}

describe("PlazaPage", () => {
  beforeEach(() => {
    mocks.token = null;
    mocks.replace.mockClear();
    mocks.listPlazaPosts.mockReset();
    mocks.deletePlazaPost.mockReset();
    mocks.listPlazaPosts.mockResolvedValue({ posts: [], nextCursor: null });
    mocks.deletePlazaPost.mockResolvedValue({ success: true });
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
    expect(wrapper.get('[data-testid="plaza-create-button"]').classes()).toContain("whitespace-nowrap");
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

  it("shows owner actions from a single top-right menu", async () => {
    mocks.token = "token";
    mocks.listPlazaPosts.mockResolvedValue({
      posts: [createPost()],
      nextCursor: null
    });

    const wrapper = mountPlazaPage();

    await flushPromises();

    expect(wrapper.text()).toContain("Software Practice Exchange");
    expect(wrapper.text()).toContain("owner");
    expect(wrapper.find('[data-testid="plaza-post-actions-menu"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="plaza-post-edit"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="plaza-post-status"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="plaza-post-delete"]').exists()).toBe(false);

    await wrapper.get('[data-testid="plaza-post-actions-menu"]').trigger("click");

    expect(wrapper.find('[data-testid="plaza-post-edit"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="plaza-post-status"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="plaza-post-delete"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("编辑");
    expect(wrapper.text()).toContain("关闭");
  });

  it("opens an in-app confirmation dialog before deleting a plaza post", async () => {
    mocks.token = "token";
    mocks.listPlazaPosts.mockResolvedValue({
      posts: [createPost()],
      nextCursor: null
    });

    const wrapper = mountPlazaPage();
    await flushPromises();

    await wrapper.get('[data-testid="plaza-post-actions-menu"]').trigger("click");
    await wrapper.get('[data-testid="plaza-post-delete"]').trigger("click");

    expect(wrapper.get('[role="dialog"]').text()).toContain("Software Practice Exchange");
    expect(mocks.deletePlazaPost).not.toHaveBeenCalled();

    await wrapper.get('[data-testid="plaza-delete-confirm"]').trigger("click");

    expect(mocks.deletePlazaPost).toHaveBeenCalledWith("post-1");
  });
});
