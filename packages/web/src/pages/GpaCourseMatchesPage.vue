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
const activeCourseId = ref<string | null>(null);
const targetKeyword = ref("");
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
    activeCourseId.value = null;
    targetKeyword.value = "";
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
      currentMatchText(item)
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

function toggleTargetPicker(courseId: string) {
  activeCourseId.value = activeCourseId.value === courseId ? null : courseId;
  targetKeyword.value = "";
}

function filteredCandidateCourses(item: GpaCourseMatchItem) {
  const query = targetKeyword.value.trim().toLowerCase();
  return item.candidates.courses.filter((course) => {
    const searchableText = [course.name, course.code, course.credits, course.requirementType].join(" ").toLowerCase();
    return !query || searchableText.includes(query);
  });
}

function filteredCandidateGroups(item: GpaCourseMatchItem) {
  const query = targetKeyword.value.trim().toLowerCase();
  return item.candidates.groups.filter((group) => {
    const searchableText = [group.name, group.requirementType].join(" ").toLowerCase();
    return !query || searchableText.includes(query);
  });
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
      <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">先找到要处理的 GPA 课程，再打开单门课程的匹配面板搜索培养方案课程或课程组。</p>
    </section>

    <section class="mb-5 rounded-3xl bg-white p-4 shadow-sm">
      <div class="grid gap-3 md:grid-cols-[1fr_12rem_12rem]">
        <input
          v-model="keyword"
          data-testid="gpa-match-search"
          class="rounded-xl border border-slate-300 px-3 py-2"
          placeholder="搜索 GPA 课程名称或学期"
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
          <div class="min-w-0 flex-1">
            <h2 class="font-bold text-[var(--tommy-text)]">{{ item.course.name }}</h2>
            <p class="mt-1 text-xs text-[var(--tommy-text-secondary)]">{{ item.course.term }} · {{ item.course.credit }} 学分 · {{ item.course.score }} 分</p>
          </div>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--tommy-text-secondary)]">{{ item.match ? "已匹配" : "未匹配" }}</span>
        </div>
        <p class="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-[var(--tommy-text-secondary)]">当前匹配：{{ currentMatchText(item) }}</p>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            data-testid="gpa-match-open"
            class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            type="button"
            @click="toggleTargetPicker(item.course.id)"
          >
            {{ activeCourseId === item.course.id ? "收起" : item.match ? "修改匹配" : "匹配" }}
          </button>
          <button
            v-if="item.match"
            data-testid="gpa-match-unbind"
            class="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-[var(--tommy-text)]"
            type="button"
            @click="unbindMutation.mutate(item.course.id)"
          >
            解绑
          </button>
        </div>

        <div v-if="activeCourseId === item.course.id" class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <input
            v-model="targetKeyword"
            data-testid="gpa-match-target-search"
            class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="搜索可匹配课程或课程组"
          />
          <div class="mt-3 space-y-2">
          <button
            v-for="course in filteredCandidateCourses(item)"
            :key="`course:${course.id}`"
            data-testid="gpa-match-candidate-course"
            class="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-[var(--tommy-primary)]"
            type="button"
            @click="bindCourseTarget(item, `course:${course.id}`)"
          >
            <span class="font-semibold text-[var(--tommy-text)]">{{ course.name }}</span>
            <span class="ml-2 text-xs text-[var(--tommy-text-secondary)]">{{ course.code }} · {{ course.credits }} 学分 · {{ course.requirementType }}</span>
          </button>
          <button
            v-for="group in filteredCandidateGroups(item)"
            :key="`group:${group.id}`"
            data-testid="gpa-match-candidate-group"
            class="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-[var(--tommy-primary)]"
            type="button"
            @click="bindCourseTarget(item, `group:${group.id}`)"
          >
            <span class="font-semibold text-[var(--tommy-text)]">课程组：{{ group.name }}</span>
            <span class="ml-2 text-xs text-[var(--tommy-text-secondary)]">{{ group.requirementType }}</span>
          </button>
          <p
            v-if="filteredCandidateCourses(item).length === 0 && filteredCandidateGroups(item).length === 0"
            class="rounded-xl bg-white px-3 py-2 text-sm text-[var(--tommy-text-secondary)]"
          >
            没有符合条件的匹配目标。
          </p>
          </div>
        </div>
      </article>
      <p v-if="!matchesQuery.isLoading.value && filteredItems.length === 0" class="rounded-3xl bg-white p-5 text-sm text-[var(--tommy-text-secondary)] shadow-sm">没有符合条件的课程。</p>
    </section>
  </AppShell>
</template>
