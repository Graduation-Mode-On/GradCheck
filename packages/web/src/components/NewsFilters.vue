<script setup lang="ts">
import type { NewsType } from "../schemas/news";

const typeFilter = defineModel<NewsType | undefined>("type");
const keyword = defineModel<string>("keyword");

const typeOptions: { label: string; value: NewsType | undefined }[] = [
  { label: "全部", value: undefined },
  { label: "讲座", value: "lecture" },
  { label: "竞赛", value: "competition" },
  { label: "项目", value: "project" },
  { label: "实践", value: "practice" }
];

function resetFilters() {
  typeFilter.value = undefined;
  keyword.value = "";
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2">
      <button
        v-for="option in typeOptions"
        :key="option.label"
        type="button"
        class="rounded-xl px-3.5 py-2 text-xs font-semibold transition"
        :class="
          typeFilter === option.value
            ? 'bg-[var(--tommy-primary)] text-white'
            : 'bg-white text-[var(--tommy-text-secondary)] hover:bg-[color-mix(in_srgb,var(--tommy-primary)_8%,white)]'
        "
        @click="typeFilter = option.value"
      >
        {{ option.label }}
      </button>
    </div>

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
          class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-[var(--tommy-text)] placeholder:text-slate-400 focus:border-[var(--tommy-primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tommy-primary)_15%,white)]"
        />
      </div>
      <button
        v-if="typeFilter || keyword"
        type="button"
        class="flex items-center gap-1 rounded-xl bg-white px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 border border-slate-200"
        @click="resetFilters"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        重置
      </button>
    </div>
  </div>
</template>
