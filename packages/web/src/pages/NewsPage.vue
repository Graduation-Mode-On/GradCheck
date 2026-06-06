<script setup lang="ts">
import { useInfiniteQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import NewsCard from "../components/NewsCard.vue";
import NewsFilters from "../components/NewsFilters.vue";
import { getToken, listNewsItems } from "../lib/api";
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
</script>

<template>
  <AppShell>
    <section class="space-y-4">
      <div class="rounded-3xl bg-white p-5 shadow-sm">
        <p class="text-sm font-semibold text-[var(--tommy-primary)]">资讯</p>
        <h1 class="mt-1 text-2xl font-bold text-[var(--tommy-text)]">机会推荐</h1>
        <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">
          讲座、竞赛、项目和实践机会，帮你补齐毕业要求缺口。
        </p>

        <div class="mt-5">
          <NewsFilters v-model:type="typeFilter" v-model:keyword="keyword" />
        </div>
      </div>

      <p
        v-if="query.isError.value"
        class="rounded-2xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] p-4 text-sm text-[var(--tommy-error)]"
      >
        加载资讯失败，请稍后重试。
      </p>

      <div
        v-else-if="items.length === 0 && !query.isLoading.value"
        class="rounded-3xl bg-white p-6 text-center text-sm text-[var(--tommy-text-secondary)] shadow-sm"
      >
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
