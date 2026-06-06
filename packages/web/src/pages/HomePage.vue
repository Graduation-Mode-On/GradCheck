<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import { getCurrentUser, getToken } from "../lib/api";

const router = useRouter();

if (!getToken()) {
  void router.replace("/login");
}

const { data } = useQuery({
  queryKey: ["current-user"],
  queryFn: getCurrentUser,
  enabled: computed(() => Boolean(getToken()))
});

const featureEntries = [
  {
    title: "培养方案",
    iconPath: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4Zm3 4h7M8 12h7",
    to: "/plans"
  },
  {
    title: "课程进度",
    iconPath: "M5 12l4 4L19 6M5 20h14",
    to: "/courses"
  },
  {
    title: "GPA目标",
    iconPath: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-5h.01",
    to: "/gpa"
  },
  {
    title: "选课推荐",
    iconPath: "M12 3l8 18-8-4-8 4 8-18Zm0 0v14",
    to: "/course-recommendations"
  },
  {
    title: "体育跑操",
    iconPath: "M13 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-2 4 3 2 2 5M9 22l3-7-3-2-4 3M15 9l4 2",
    to: "/sports"
  },
  {
    title: "讲座实践",
    iconPath: "M12 14a4 4 0 0 0 4-4V5a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4Zm-7-4a7 7 0 0 0 14 0M12 17v4M8 21h8",
    to: "/news"
  },
  {
    title: "志愿劳育",
    iconPath: "M7 11l3 3a3 3 0 0 0 4 0l3-3M4 12l4-5 4 3 4-3 4 5-4 6H8l-4-6Z",
    to: "/volunteer"
  },
  {
    title: "实验考试",
    iconPath: "M9 3h6M10 3v5l-5 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-9V3M8 16h8",
    to: "/exams"
  },
  {
    title: "自定义要求",
    iconPath: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
    to: "/custom-requirements"
  },
  {
    title: "毕业礼包",
    iconPath: "M4 11h16v10H4V11Zm0 0V7h16v4M12 7v14M8 7a2 2 0 1 1 4 0M16 7a2 2 0 1 0-4 0",
    to: "/graduation-gift"
  }
];

const progressSegments = [
  { label: "已完成", value: "42 项", color: "bg-[var(--tommy-success)]" },
  { label: "进行中", value: "8 项", color: "bg-[var(--tommy-primary)]" },
  { label: "存在风险", value: "3 项", color: "bg-[var(--tommy-warning)]" },
  { label: "未满足", value: "6 项", color: "bg-[var(--tommy-error)]" }
];

const dashboardCards = [
  {
    title: "GPA计算器",
    hint: "点击卡片估算绩点 >",
    metric: "目标 3.50",
    description: "录入课程成绩后，估算剩余课程需要达到的平均绩点。",
    to: "/gpa"
  },
  {
    title: "提醒事项",
    hint: "查看全部提醒 >",
    metric: "5 个待办",
    description: "实验、考试、志愿心得、劳育和跑操提醒会集中展示在这里。",
    to: "/profile"
  },
  {
    title: "机会推荐",
    hint: "查看补齐机会 >",
    metric: "12 条机会",
    description: "根据讲座、竞赛、实践等缺口推荐可补齐要求的机会。",
    to: "/news"
  }
];
</script>

<template>
  <AppShell>
    <section data-testid="graduation-progress-card" class="mb-5 rounded-3xl bg-white p-5 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold text-[var(--tommy-primary)]">欢迎回来</p>
          <h1 class="mt-1 text-2xl font-bold text-[var(--tommy-text)]">
            毕业进度总览
          </h1>
          <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
            {{ data?.user.profile?.displayName ?? data?.user.email ?? "GradCheck 用户" }}，录入数据后这里会实时更新你的毕业任务状态。
          </p>
        </div>
        <div class="rounded-2xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-4 py-3 text-right">
          <p class="text-xs font-semibold text-[var(--tommy-info)]">当前估算</p>
          <p class="text-2xl font-bold text-[var(--tommy-primary)]">68%</p>
        </div>
      </div>

      <div class="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
        <div class="h-full w-[68%] rounded-full bg-gradient-to-r from-[var(--tommy-success)] to-[var(--tommy-primary)]" />
      </div>

      <div class="mt-4 grid grid-cols-4 gap-2">
        <div v-for="segment in progressSegments" :key="segment.label" class="rounded-2xl bg-slate-50 p-3">
          <div class="mb-2 h-1.5 w-8 rounded-full" :class="segment.color" />
          <p class="text-xs text-[var(--tommy-text-secondary)]">{{ segment.label }}</p>
          <p class="mt-1 text-sm font-bold text-[var(--tommy-text)]">{{ segment.value }}</p>
        </div>
      </div>
    </section>

    <section data-testid="feature-entry-grid-card" class="mb-5 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      <div data-testid="feature-entry-grid" class="grid grid-cols-5 gap-2">
        <RouterLink
          v-for="entry in featureEntries"
          :key="entry.title"
          :to="entry.to"
          data-testid="feature-entry"
          class="rounded-2xl px-2 py-3 text-center transition hover:bg-[color-mix(in_srgb,var(--tommy-primary)_8%,white)]"
        >
          <div data-testid="feature-entry-icon-shell" class="mx-auto mb-1.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--tommy-primary)_10%,white)] text-[var(--tommy-info)]">
            <svg
              data-testid="feature-entry-icon"
              class="h-7 w-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              aria-hidden="true"
            >
              <path :d="entry.iconPath" />
            </svg>
          </div>
          <p data-testid="feature-entry-label" class="text-[10px] font-semibold leading-4 text-[var(--tommy-text)]">{{ entry.title }}</p>
        </RouterLink>
      </div>
    </section>

    <section data-testid="dashboard-card-grid" class="grid gap-4 lg:grid-cols-3">
      <RouterLink
        v-for="card in dashboardCards"
        :key="card.title"
        :to="card.to"
        class="rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-[var(--tommy-text)]">{{ card.title }}</h2>
            <p class="mt-2 text-2xl font-bold text-[var(--tommy-primary)]">{{ card.metric }}</p>
          </div>
          <span class="text-xs font-semibold text-[var(--tommy-info)]">{{ card.hint }}</span>
        </div>
        <p class="mt-3 text-sm leading-6 text-[var(--tommy-text-secondary)]">{{ card.description }}</p>
      </RouterLink>
    </section>
  </AppShell>
</template>
