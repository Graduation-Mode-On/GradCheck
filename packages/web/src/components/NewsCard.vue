<script setup lang="ts">
import type { NewsItem } from "../schemas/news";
import { newsTypeLabel, newsTypeColor } from "../schemas/news";

const props = defineProps<{
  item: NewsItem;
}>();

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "时间待定";
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${month}月${day}日 ${hours}:${minutes}`;
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "";
  const target = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "已结束";
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "明天";
  if (diffDays <= 7) return `${diffDays}天后`;
  return "";
}
</script>

<template>
  <div class="rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold"
            :class="newsTypeColor[props.item.type]"
          >
            {{ newsTypeLabel[props.item.type] }}
          </span>
          <span
            v-if="props.item.dataQuality === 'partial'"
            class="inline-flex rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600"
          >
            信息待核实
          </span>
          <span
            v-if="props.item.creditCategory"
            class="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
          >
            {{ props.item.creditCategory }}
          </span>
        </div>
        <h3 class="mt-2 text-base font-bold text-[var(--tommy-text)] leading-snug">
          {{ props.item.title }}
        </h3>
      </div>
      <span
        v-if="formatRelative(props.item.startTime)"
        class="shrink-0 rounded-lg bg-[color-mix(in_srgb,var(--tommy-primary)_10%,white)] px-2 py-1 text-xs font-semibold text-[var(--tommy-info)]"
      >
        {{ formatRelative(props.item.startTime) }}
      </span>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--tommy-text-secondary)]">
      <span v-if="props.item.startTime" class="flex items-center gap-1">
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {{ formatDate(props.item.startTime) }}
      </span>
      <span v-if="props.item.location" class="flex items-center gap-1">
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        {{ props.item.location }}
      </span>
      <span v-if="props.item.organizer" class="flex items-center gap-1">
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        {{ props.item.organizer }}
      </span>
      <span v-if="props.item.targetAudience && props.item.targetAudience !== '全校'" class="flex items-center gap-1">
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        {{ props.item.targetAudience }}
      </span>
    </div>

    <p
      v-if="props.item.description"
      class="mt-2 text-sm leading-relaxed text-[var(--tommy-text-secondary)] line-clamp-2"
    >
      {{ props.item.description }}
    </p>

    <div v-if="props.item.sourceUrl" class="mt-3">
      <a
        :href="props.item.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
        @click.stop
      >
        <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        来源
      </a>
    </div>
  </div>
</template>
