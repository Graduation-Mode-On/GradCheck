<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import {
  deleteGpaCourseMatch,
  getGpaCourseMatches,
  getToken,
  upsertGpaCourseMatch,
  type GpaCourseMatchItem
} from "../lib/api";

const router = useRouter();
const authToken = getToken();
const keyword = ref("");
const statusFilter = ref("all");
const targetFilter = ref("all");
const message = ref("");

if (!authToken) {
  void router.replace("/login");
}

const matchesQuery = useQuery({
  queryKey: ["gpa-course-matches", authToken],
  queryFn: getGpaCourseMatches,
  enabled: computed(() => Boolean(authToken))
});

const bindMutation = useMutation({
  mutationFn: async ({ courseId, target }: { courseId: string; target: string }) => {
    const [targetType, id] = target.split(":");
    return upsertGpaCourseMatch(
      courseId,
      targetType === "group"
        ? { matchTargetType: "group", programPlanCourseGroupId: id }
        : { matchTargetType: "course", programPlanCourseId: id }
    );
  },
  onSuccess: async () => {
    message.value = "课程匹配已更新";
    await matchesQuery.refetch();
  },
  onError: (error) => {
    message.value = error instanceof Error ? error.message : "保存课程匹配失败";
  }
});

const unbindMutation = useMutation({
  mutationFn: (courseId: string) => deleteGpaCourseMatch(courseId),
  onSuccess: async () => {
    message.value = "课程匹配已解绑";
    await matchesQuery.refetch();
  },
  onError: (error) => {
    message.value = error instanceof Error ? error.message : "取消课程匹配失败";
  }
});

const filteredItems = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return (matchesQuery.data.value?.items ?? []).filter((item) => {
    const searchableText = [
      item.course.name,
      item.course.term,
      currentMatchText(item),
      ...item.candidates.courses.flatMap((course) => [course.name, course.code, course.credits, course.requirementType]),
      ...item.candidates.groups.flatMap((group) => [group.name, group.requirementType])
    ]
      .join(" ")
      .toLowerCase();
    const matchesKeyword = !query || searchableText.includes(query);
    const matchesStatus =
      statusFilter.value === "all" ||
      (statusFilter.value === "matched" && item.match) ||
      (statusFilter.value === "unmatched" && !item.match) ||
      (statusFilter.value === "confirmed" && item.match?.confirmedByUser);
    const matchesTarget =
      targetFilter.value === "all" ||
      (targetFilter.value === "course" && item.match?.matchTargetType === "course") ||
      (targetFilter.value === "group" && item.match?.matchTargetType === "group");
    return matchesKeyword && matchesStatus && matchesTarget;
  });
});

function currentMatchText(item: GpaCourseMatchItem) {
  if (!item.match) return "未匹配";
  if (item.match.matchTargetType === "group") {
    const group = item.candidates.groups.find((candidate) => candidate.id === item.match?.programPlanCourseGroupId);
    return `课程组：${group?.name ?? "未知课程组"}`;
  }
  const course = item.candidates.courses.find((candidate) => candidate.id === item.match?.programPlanCourseId);
  return course ? `${course.name}（${course.credits} 学分）` : "未知课程";
}

function bindCourseTarget(item: GpaCourseMatchItem, target: string) {
  bindMutation.mutate({ courseId: item.course.id, target });
}
</script>

<template>
  <AppShell>
    <section class="mb-5 rounded-3xl bg-white p-5 shadow-sm">
      <RouterLink to="/gpa" class="text-sm font-semibold text-[var(--tommy-info)]">返回 GPA 计算器</RouterLink>
      <h1 class="mt-2 text-2xl font-bold text-[var(--tommy-text)]">课程匹配管理</h1>
      <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">搜索课程，按匹配状态筛选，并用移动端友好的卡片选择培养方案课程或课程组。</p>
    </section>

    <section class="mb-5 rounded-3xl bg-white p-4 shadow-sm">
      <div class="grid gap-3 md:grid-cols-[1fr_12rem_12rem]">
        <input
          v-model="keyword"
          data-testid="gpa-match-search"
          class="rounded-xl border border-slate-300 px-3 py-2"
          placeholder="搜索课程名称"
        />
        <select v-model="statusFilter" data-testid="gpa-match-status-filter" class="rounded-xl border border-slate-300 px-3 py-2">
          <option value="all">全部状态</option>
          <option value="matched">已匹配</option>
          <option value="unmatched">未匹配</option>
          <option value="confirmed">已确认</option>
        </select>
        <select v-model="targetFilter" data-testid="gpa-match-target-filter" class="rounded-xl border border-slate-300 px-3 py-2">
          <option value="all">全部目标</option>
          <option value="course">课程</option>
          <option value="group">课程组</option>
        </select>
      </div>
      <p v-if="message" class="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-info)]">{{ message }}</p>
    </section>

    <section data-testid="gpa-match-list" class="space-y-4">
      <p v-if="matchesQuery.isLoading.value" class="rounded-3xl bg-white p-5 text-sm text-[var(--tommy-text-secondary)] shadow-sm">正在加载匹配结果...</p>
      <article v-for="item in filteredItems" :key="item.course.id" class="rounded-3xl bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-bold text-[var(--tommy-text)]">{{ item.course.name }}</h2>
            <p class="mt-1 text-xs text-[var(--tommy-text-secondary)]">{{ item.course.term }} · {{ item.course.credit }} 学分 · {{ item.course.score }} 分</p>
          </div>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--tommy-text-secondary)]">{{ item.match ? "已匹配" : "未匹配" }}</span>
        </div>
        <p class="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-[var(--tommy-text-secondary)]">当前匹配：{{ currentMatchText(item) }}</p>

        <div class="mt-4 space-y-2">
          <button
            v-for="course in item.candidates.courses"
            :key="`course:${course.id}`"
            class="w-full rounded-2xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-[var(--tommy-primary)]"
            type="button"
            @click="bindCourseTarget(item, `course:${course.id}`)"
          >
            <span class="font-semibold text-[var(--tommy-text)]">{{ course.name }}</span>
            <span class="ml-2 text-xs text-[var(--tommy-text-secondary)]">{{ course.code }} · {{ course.credits }} 学分 · {{ course.requirementType }}</span>
          </button>
          <button
            v-for="group in item.candidates.groups"
            :key="`group:${group.id}`"
            data-testid="gpa-match-candidate-group"
            class="w-full rounded-2xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-[var(--tommy-primary)]"
            type="button"
            @click="bindCourseTarget(item, `group:${group.id}`)"
          >
            <span class="font-semibold text-[var(--tommy-text)]">课程组：{{ group.name }}</span>
            <span class="ml-2 text-xs text-[var(--tommy-text-secondary)]">{{ group.requirementType }}</span>
          </button>
        </div>

        <button
          v-if="item.match"
          data-testid="gpa-match-unbind"
          class="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-[var(--tommy-text)]"
          type="button"
          @click="unbindMutation.mutate(item.course.id)"
        >
          解绑
        </button>
      </article>
      <p v-if="!matchesQuery.isLoading.value && filteredItems.length === 0" class="rounded-3xl bg-white p-5 text-sm text-[var(--tommy-text-secondary)] shadow-sm">没有符合条件的课程。</p>
    </section>
  </AppShell>
</template>
