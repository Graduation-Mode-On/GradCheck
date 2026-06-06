<script setup lang="ts">
import { useInfiniteQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import NewsCard from "../components/NewsCard.vue";
import { getToken, listNewsItems } from "../lib/api";
import { newsTypeLabel } from "../schemas/news";
import type { NewsItemFilters, NewsType } from "../schemas/news";

const router = useRouter();

if (!getToken()) {
  void router.replace("/login");
}

const typeFilter = ref<NewsType | undefined>(undefined);
const keyword = ref("");

const filters = computed<NewsItemFilters>(() => ({
  type: typeFilter.value,
  keyword: keyword.value || undefined
}));

const query = useInfiniteQuery({
  queryKey: computed(() => ["news-items", filters.value]),
  queryFn: ({ pageParam }) => listNewsItems({ ...filters.value, cursor: pageParam, limit: 10 }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  enabled: computed(() => Boolean(getToken()))
});

const items = computed(() => query.data.value?.pages.flatMap((page) => page.items) ?? []);

const totalCount = computed(() => {
  return items.value.length;
});

const hasMore = computed(() => query.hasNextPage.value);

const typeOptions: { label: string; value: NewsType | undefined; icon: string }[] = [
  { label: "全部", value: undefined, icon: "M4 6h16M4 12h16M4 18h16" },
  { label: "讲座", value: "lecture", icon: "M12 14a4 4 0 0 0 4-4V5a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4Zm-7-4a7 7 0 0 0 14 0M12 17v4M8 21h8" },
  { label: "竞赛", value: "competition", icon: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M6 15H4.5a2.5 2.5 0 0 0 0 5H6M18 15h1.5a2.5 2.5 0 0 1 0 5H18M12 4v16" },
  { label: "项目", value: "project", icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" },
  { label: "实践", value: "practice", icon: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" }
];

const activeTypeLabel = computed(() => {
  if (!typeFilter.value) return "全部";
  return newsTypeLabel[typeFilter.value];
});
</script>

<template>
  <AppShell>
    <section class="space-y-4">
      <!-- 浅色渐变 Banner -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[color-mix(in_srgb,var(--tommy-primary)_8%,white)] to-[color-mix(in_srgb,var(--tommy-info)_4%,white)] p-6 shadow-sm border border-[color-mix(in_srgb,var(--tommy-primary)_10%,white)]">
        <!-- 装饰背景圆圈 -->
        <div class="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--tommy-primary)]/5" />
        <div class="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[var(--tommy-info)]/5" />

        <div class="relative flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <!-- 装饰图标 -->
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)]">
                <svg class="h-5 w-5 text-[var(--tommy-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-2H6a2 2 0 0 1-2-2V5Zm4 3h8M8 12h6" />
                </svg>
              </div>
              <span class="text-xs font-semibold uppercase tracking-wider text-[var(--tommy-primary)]">资讯</span>
            </div>

            <h1 class="mt-3 text-2xl font-bold text-[var(--tommy-text)]">
              机会推荐
            </h1>
            <p class="mt-1.5 text-sm leading-relaxed text-[var(--tommy-text-secondary)]">
              讲座、竞赛、项目和实践机会，帮你补齐毕业要求缺口
            </p>
          </div>

          <!-- 统计数字 -->
          <div class="shrink-0 text-right">
            <div class="text-3xl font-bold text-[var(--tommy-primary)]">
              {{ totalCount }}{{ hasMore ? '+' : '' }}
            </div>
            <div class="mt-0.5 text-xs text-[var(--tommy-text-secondary)]">
              {{ activeTypeLabel }}机会
            </div>
          </div>
        </div>

        <!-- 快捷类型筛选 -->
        <div class="relative mt-5 flex flex-wrap gap-2">
          <button
            v-for="option in typeOptions"
            :key="option.label"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition border"
            :class="
              typeFilter === option.value
                ? 'bg-[var(--tommy-primary)] text-white border-[var(--tommy-primary)] shadow-sm'
                : 'bg-white text-[var(--tommy-text-secondary)] border-slate-200 hover:border-[color-mix(in_srgb,var(--tommy-primary)_30%,white)] hover:text-[var(--tommy-primary)]'
            "
            @click="typeFilter = option.value"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path :d="option.icon" />
            </svg>
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- 搜索栏 -->
      <div class="flex gap-2">
        <div class="relative flex-1">
          <svg
            class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="keyword"
            type="text"
            placeholder="搜索标题、主办方..."
            class="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-[var(--tommy-text)] placeholder:text-slate-400 focus:border-[var(--tommy-primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tommy-primary)_15%,white)] shadow-sm"
          />
        </div>
        <button
          v-if="typeFilter || keyword"
          type="button"
          class="flex items-center gap-1 rounded-2xl bg-white px-4 py-3 text-xs font-medium text-slate-500 hover:bg-slate-50 border border-slate-200 shadow-sm"
          @click="typeFilter = undefined; keyword = ''"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          重置
        </button>
      </div>

      <p
        v-if="query.isError.value"
        class="rounded-2xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] p-4 text-sm text-[var(--tommy-error)]"
      >
        加载资讯失败，请稍后重试。
      </p>

      <div
        v-else-if="items.length === 0 && !query.isLoading.value"
        class="rounded-3xl bg-white p-8 text-center text-sm text-[var(--tommy-text-secondary)] shadow-sm"
      >
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <svg class="h-6 w-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        暂无相关资讯
      </div>

      <div class="space-y-3">
        <NewsCard v-for="item in items" :key="item.id" :item="item" />
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
    </section>
  </AppShell>
</template>
