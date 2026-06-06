<script setup lang="ts">
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import PlazaFilters from "../components/PlazaFilters.vue";
import PlazaPostCard from "../components/PlazaPostCard.vue";
import PlazaPostForm from "../components/PlazaPostForm.vue";
import {
  createPlazaPost,
  deletePlazaPost,
  getToken,
  listPlazaPosts,
  updatePlazaPost,
  updatePlazaPostStatus
} from "../lib/api";
import type { PlazaPost, PlazaPostFilters, PlazaPostInput, PlazaPostStatus, PlazaPostType } from "../schemas/plaza";

const router = useRouter();
const queryClient = useQueryClient();

if (!getToken()) {
  void router.replace("/login");
}

const activeType = ref<PlazaPostType | "all">("all");
const status = ref<PlazaPostStatus>("open");
const keyword = ref("");
const isFormOpen = ref(false);
const editingPost = ref<PlazaPost | null>(null);
const pendingDeletePost = ref<PlazaPost | null>(null);
const formError = ref("");

const filters = computed<PlazaPostFilters>(() => ({
  type: activeType.value === "all" ? undefined : activeType.value,
  status: status.value,
  keyword: keyword.value || undefined
}));

const query = useInfiniteQuery({
  queryKey: computed(() => ["plaza-posts", filters.value]),
  queryFn: ({ pageParam }) => listPlazaPosts({ ...filters.value, cursor: pageParam, limit: 20 }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  enabled: computed(() => Boolean(getToken()))
});

const posts = computed(() => query.data.value?.pages.flatMap((page) => page.posts) ?? []);

const createMutation = useMutation({
  mutationFn: createPlazaPost,
  onSuccess: async () => {
    isFormOpen.value = false;
    await queryClient.invalidateQueries({ queryKey: ["plaza-posts"] });
  },
  onError: (error) => {
    formError.value = error instanceof Error ? error.message : "发布失败";
  }
});

const updateMutation = useMutation({
  mutationFn: ({ id, input }: { id: string; input: PlazaPostInput }) => updatePlazaPost(id, input),
  onSuccess: async () => {
    isFormOpen.value = false;
    editingPost.value = null;
    await queryClient.invalidateQueries({ queryKey: ["plaza-posts"] });
  },
  onError: (error) => {
    formError.value = error instanceof Error ? error.message : "保存失败";
  }
});

const statusMutation = useMutation({
  mutationFn: (post: PlazaPost) => updatePlazaPostStatus(post.id, post.status === "open" ? "closed" : "open"),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["plaza-posts"] });
  }
});

const deleteMutation = useMutation({
  mutationFn: (post: PlazaPost) => deletePlazaPost(post.id),
  onSuccess: async () => {
    pendingDeletePost.value = null;
    await queryClient.invalidateQueries({ queryKey: ["plaza-posts"] });
  }
});

function openCreateForm() {
  formError.value = "";
  editingPost.value = null;
  isFormOpen.value = true;
}

function openEditForm(post: PlazaPost) {
  formError.value = "";
  editingPost.value = post;
  isFormOpen.value = true;
}

function submitPost(input: PlazaPostInput) {
  formError.value = "";
  if (editingPost.value) {
    updateMutation.mutate({ id: editingPost.value.id, input });
    return;
  }
  createMutation.mutate(input);
}

function deletePost(post: PlazaPost) {
  pendingDeletePost.value = post;
}

function closeDeleteDialog() {
  if (!deleteMutation.isPending.value) {
    pendingDeletePost.value = null;
  }
}

function confirmDeletePost() {
  if (pendingDeletePost.value) {
    deleteMutation.mutate(pendingDeletePost.value);
  }
}
</script>

<template>
  <AppShell>
    <section data-testid="plaza-page" class="space-y-4">
      <div class="rounded-3xl bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-[var(--tommy-primary)]">广场</p>
            <h1 class="mt-1 text-2xl font-bold text-[var(--tommy-text)]">换课 / 组队</h1>
            <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">
              发布换课需求和组队招募，用自行填写的联系方式完成后续沟通。
            </p>
          </div>
          <button
            data-testid="plaza-create-button"
            class="min-w-16 whitespace-nowrap rounded-xl bg-[var(--tommy-primary)] px-4 py-2.5 text-sm font-semibold text-white"
            type="button"
            @click="openCreateForm"
          >
            发布
          </button>
        </div>

        <div class="mt-5 grid grid-cols-3 rounded-full bg-slate-100 p-1 text-sm font-semibold">
          <button
            class="rounded-full px-3 py-2"
            :class="activeType === 'all' ? 'bg-white text-[var(--tommy-primary)] shadow-sm' : 'text-[var(--tommy-text-secondary)]'"
            type="button"
            @click="activeType = 'all'"
          >
            全部
          </button>
          <button
            class="rounded-full px-3 py-2"
            :class="activeType === 'course_exchange' ? 'bg-white text-[var(--tommy-primary)] shadow-sm' : 'text-[var(--tommy-text-secondary)]'"
            type="button"
            @click="activeType = 'course_exchange'"
          >
            换课
          </button>
          <button
            class="rounded-full px-3 py-2"
            :class="activeType === 'team_recruit' ? 'bg-white text-[var(--tommy-primary)] shadow-sm' : 'text-[var(--tommy-text-secondary)]'"
            type="button"
            @click="activeType = 'team_recruit'"
          >
            组队
          </button>
        </div>
      </div>

      <PlazaFilters
        v-model:keyword="keyword"
        v-model:status="status"
      />

      <p v-if="query.isError.value" class="rounded-2xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] p-4 text-sm text-[var(--tommy-error)]">
        加载广场失败，请稍后重试。
      </p>

      <div v-else-if="posts.length === 0 && !query.isLoading.value" class="rounded-3xl bg-white p-6 text-center text-sm text-[var(--tommy-text-secondary)] shadow-sm">
        暂无广场帖子
      </div>

      <div class="space-y-3">
        <PlazaPostCard
          v-for="post in posts"
          :key="post.id"
          :post="post"
          @edit="openEditForm"
          @status="statusMutation.mutate"
          @delete="deletePost"
        />
      </div>

      <button
        v-if="query.hasNextPage.value"
        class="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        type="button"
        :disabled="query.isFetchingNextPage.value"
        @click="query.fetchNextPage()"
      >
        {{ query.isFetchingNextPage.value ? "加载中..." : "加载更多" }}
      </button>

      <p v-if="formError" class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-error)]">
        {{ formError }}
      </p>
    </section>

    <PlazaPostForm
      :model-value="isFormOpen"
      :post="editingPost"
      @close="isFormOpen = false"
      @submit="submitPost"
    />

    <div
      v-if="pendingDeletePost"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plaza-delete-dialog-title"
    >
      <div class="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
        <h2 id="plaza-delete-dialog-title" class="text-lg font-bold text-[var(--tommy-text)]">删除广场帖子</h2>
        <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">
          确定删除「<span class="font-bold text-[var(--tommy-text)]">{{ pendingDeletePost.title }}</span>」吗？删除后这条帖子将不再展示。
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            data-testid="plaza-delete-cancel"
            class="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-[var(--tommy-text)] disabled:opacity-60"
            type="button"
            :disabled="deleteMutation.isPending.value"
            @click="closeDeleteDialog"
          >
            取消
          </button>
          <button
            data-testid="plaza-delete-confirm"
            class="rounded-xl bg-[var(--tommy-error)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            type="button"
            :disabled="deleteMutation.isPending.value"
            @click="confirmDeletePost"
          >
            {{ deleteMutation.isPending.value ? "删除中..." : "确认删除" }}
          </button>
        </div>
      </div>
    </div>
  </AppShell>
</template>
