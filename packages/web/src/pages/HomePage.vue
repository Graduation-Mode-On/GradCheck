<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import FeatureCard from "../components/FeatureCard.vue";
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

const featureCards = [
  {
    title: "毕业进度",
    description: "汇总课程、讲座、体育、志愿、劳育等毕业任务完成状态。",
    status: "占位"
  },
  {
    title: "培养方案",
    description: "后续接入 PDF 解析、确认和同专业方案复用。",
    status: "占位"
  },
  {
    title: "课程与 GPA",
    description: "记录课程状态、成绩和目标绩点，估算剩余课程压力。",
    status: "占位"
  },
  {
    title: "机会推荐",
    description: "根据当前缺口推荐讲座、竞赛、项目和实践机会。",
    status: "占位"
  },
  {
    title: "提醒中心",
    description: "集中展示实验、考试、志愿心得、劳育和跑操提醒。",
    status: "占位"
  },
  {
    title: "换课 / 组队",
    description: "提供换课发帖和竞赛、社会实践组队信息入口。",
    status: "占位"
  }
];
</script>

<template>
  <AppShell>
    <section class="mb-6 rounded-3xl bg-gradient-to-br from-[var(--tommy-primary)] to-[var(--tommy-info)] p-6 text-white shadow-lg">
      <p class="text-sm opacity-80">欢迎回来</p>
      <h1 class="mt-2 text-2xl font-bold">
        {{ data?.user.profile?.displayName ?? data?.user.email ?? "GradCheck 用户" }}
      </h1>
      <p class="mt-3 max-w-2xl text-sm leading-6 opacity-90">
        基础设施已预留毕业进度、培养方案、课程绩点、机会推荐、提醒和社区协作入口，后续模块可以按卡片拆分开发。
      </p>
    </section>

    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <FeatureCard
        v-for="card in featureCards"
        :key="card.title"
        :title="card.title"
        :description="card.description"
        :status="card.status"
      />
    </section>
  </AppShell>
</template>
