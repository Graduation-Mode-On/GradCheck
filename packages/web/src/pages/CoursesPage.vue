<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import {
  getCoursesProgress,
  getToken,
  rematchGpaCourses,
  type CoursesCategoryProgress,
  type CoursesRuleProgress
} from "../lib/api";

const router = useRouter();
const queryClient = useQueryClient();
const authToken = getToken();

if (!authToken) {
  void router.replace("/login");
}

const coursesProgressKey = ["courses-progress", authToken] as const;
const { data, error, isLoading, isFetching, refetch } = useQuery({
  queryKey: coursesProgressKey,
  queryFn: getCoursesProgress,
  enabled: computed(() => Boolean(authToken))
});

const expandedRules = ref<Set<string>>(new Set());
const completedCollapsed = ref(true);
const rematchMessage = ref("");

function toggleRule(id: string) {
  const next = new Set(expandedRules.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  expandedRules.value = next;
}

function isExpanded(id: string) {
  return expandedRules.value.has(id);
}

const errorMessage = computed(() => {
  if (!error.value) return "";
  return error.value instanceof Error ? error.value.message : "加载课程进度失败";
});

const plan = computed(() => data.value?.plan ?? null);
const overall = computed(() => data.value?.overall ?? null);
const categories = computed<CoursesCategoryProgress[]>(() => data.value?.categories ?? []);
const allRules = computed<CoursesRuleProgress[]>(() => data.value?.rules ?? []);
const pendingRules = computed(() => allRules.value.filter((rule) => rule.status !== "completed"));
const completedRules = computed(() => allRules.value.filter((rule) => rule.status === "completed"));

const emptyReason = computed(() => data.value?.emptyReason ?? null);

function statusBarClass(percent: number) {
  if (percent >= 95) return "bg-[var(--tommy-success)]";
  if (percent >= 70) return "bg-[var(--tommy-warning)]";
  return "bg-[var(--tommy-error)]";
}

function ruleChipClass(status: CoursesRuleProgress["status"]) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "in_progress") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function ruleChipText(rule: CoursesRuleProgress) {
  if (rule.status === "completed") return "已达成";
  if (rule.status === "in_progress") return "进行中";
  return "未开始";
}

const rematchMutation = useMutation({
  mutationFn: rematchGpaCourses,
  onSuccess: (result) => {
    rematchMessage.value = `重新匹配完成，本次共匹配 ${result.matchedCount} 门课程。`;
    void queryClient.invalidateQueries({ queryKey: ["courses-progress"] });
    void queryClient.invalidateQueries({ queryKey: ["gpa-dashboard"] });
  },
  onError: (mutationError: unknown) => {
    rematchMessage.value =
      mutationError instanceof Error ? `重新匹配失败：${mutationError.message}` : "重新匹配失败";
  }
});

function handleRematch() {
  rematchMessage.value = "";
  rematchMutation.mutate();
}
</script>

<template>
  <AppShell>
    <div class="flex flex-col gap-3">
      <header class="rounded-3xl bg-white p-5 shadow-sm" data-testid="courses-page-header">
        <p class="text-xs font-semibold text-[var(--tommy-primary)]">毕业进度</p>
        <h1 class="mt-1 text-xl font-bold text-[var(--tommy-text)]">课程进度</h1>
        <p v-if="plan" class="mt-2 text-xs text-[var(--tommy-text-secondary)]" data-testid="courses-plan-summary">
          {{ plan.school }}<span v-if="plan.college"> · {{ plan.college }}</span> · {{ plan.major
          }}<span v-if="plan.grade"> · {{ plan.grade }}</span>
        </p>
        <p v-else class="mt-2 text-xs text-[var(--tommy-text-secondary)]">基于绑定的培养方案与已录入的课程匹配。</p>
      </header>

      <p v-if="isLoading" class="rounded-3xl bg-white p-5 text-sm text-[var(--tommy-text-secondary)] shadow-sm">
        正在加载课程进度…
      </p>

      <p
        v-else-if="errorMessage"
        class="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm"
        data-testid="courses-error"
      >
        {{ errorMessage }}
      </p>

      <section
        v-else-if="emptyReason === 'no_plan'"
        class="rounded-3xl bg-white p-6 shadow-sm"
        data-testid="courses-empty-no-plan"
      >
        <h2 class="text-base font-bold text-[var(--tommy-text)]">还没有绑定培养方案</h2>
        <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
          请先去培养方案页面上传或绑定一份方案，再回来查看课程进度。
        </p>
        <button
          type="button"
          class="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--tommy-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm"
          data-testid="courses-link-plans"
          @click="router.push('/plans')"
        >
          去培养方案
        </button>
      </section>

      <section
        v-else-if="emptyReason === 'no_gpa_courses'"
        class="rounded-3xl bg-white p-6 shadow-sm"
        data-testid="courses-empty-no-gpa"
      >
        <h2 class="text-base font-bold text-[var(--tommy-text)]">还没有录入任何课程</h2>
        <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
          导入或手动添加你的 GPA 课程后，这里会自动呈现各项规则的完成情况。
        </p>
        <button
          type="button"
          class="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--tommy-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm"
          data-testid="courses-link-gpa"
          @click="router.push('/gpa')"
        >
          去录入课程
        </button>
      </section>

      <section
        v-else-if="emptyReason === 'no_matches'"
        class="rounded-3xl bg-white p-6 shadow-sm"
        data-testid="courses-empty-no-matches"
      >
        <h2 class="text-base font-bold text-[var(--tommy-text)]">还没有任何课程匹配</h2>
        <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
          可以试试自动重新匹配，或者前往课程匹配页面逐门确认。
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-full bg-[var(--tommy-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm"
            data-testid="courses-link-matches"
            @click="router.push('/gpa/course-matches')"
          >
            手动匹配
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-full border border-[var(--tommy-primary)] px-4 py-2 text-sm font-semibold text-[var(--tommy-primary)]"
            data-testid="courses-empty-rematch"
            :disabled="rematchMutation.isPending.value"
            @click="handleRematch"
          >
            {{ rematchMutation.isPending.value ? "匹配中…" : "重新匹配课程" }}
          </button>
        </div>
        <p
          v-if="rematchMessage"
          class="mt-3 text-xs text-[var(--tommy-text-secondary)]"
          data-testid="courses-rematch-message"
        >
          {{ rematchMessage }}
        </p>
      </section>

      <template v-else-if="overall">
        <section class="rounded-3xl bg-white p-5 shadow-sm" data-testid="courses-overall">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-[var(--tommy-text-secondary)]">毕业进度（按培养方案）</p>
              <p class="mt-1 text-lg font-bold text-[var(--tommy-text)]" data-testid="courses-overall-credits">
                {{ overall.earnedCredits }} / {{ overall.totalCredits }} 学分
              </p>
            </div>
            <div class="text-2xl font-bold text-[var(--tommy-info)]" data-testid="courses-overall-percent">
              {{ overall.percent }}%
            </div>
          </div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500"
              :style="{ width: overall.percent + '%' }"
            />
          </div>
          <div class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-2xl bg-slate-50 px-2 py-2">
              <p class="text-[10px] text-[var(--tommy-text-secondary)]">已修学分</p>
              <p class="mt-0.5 text-base font-bold text-emerald-600" data-testid="courses-metric-earned">
                {{ overall.earnedCredits }}
              </p>
            </div>
            <div class="rounded-2xl bg-slate-50 px-2 py-2">
              <p class="text-[10px] text-[var(--tommy-text-secondary)]">缺口学分</p>
              <p class="mt-0.5 text-base font-bold text-rose-600" data-testid="courses-metric-gap">
                {{ overall.gapCredits }}
              </p>
            </div>
            <div class="rounded-2xl bg-slate-50 px-2 py-2">
              <p class="text-[10px] text-[var(--tommy-text-secondary)]">规则达成</p>
              <p class="mt-0.5 text-base font-bold text-[var(--tommy-info)]" data-testid="courses-metric-rules">
                {{ overall.satisfiedRuleCount }} / {{ overall.totalRuleCount }}
              </p>
            </div>
          </div>
        </section>

        <section v-if="categories.length" class="rounded-3xl bg-white p-5 shadow-sm" data-testid="courses-categories">
          <h2 class="text-sm font-bold text-[var(--tommy-text)]">大类进度</h2>
          <div class="mt-3 flex flex-col gap-3">
            <div
              v-for="category in categories"
              :key="category.name"
              class="rounded-2xl bg-slate-50 px-3 py-2.5"
              data-testid="courses-category"
            >
              <div class="flex items-center justify-between text-sm">
                <span class="font-semibold text-[var(--tommy-text)]">{{ category.name }}</span>
                <span class="text-xs text-[var(--tommy-text-secondary)]">
                  {{ category.earnedCredits }} / {{ category.requiredCredits }} 学分 · {{ category.completedCourseCount }} /
                  {{ category.totalCourseCount }} 门
                </span>
              </div>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div class="h-full rounded-full" :class="statusBarClass(category.percent)" :style="{ width: category.percent + '%' }" />
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl bg-white p-5 shadow-sm" data-testid="courses-rules">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-[var(--tommy-text)]">规则进度</h2>
            <span class="text-xs text-[var(--tommy-text-secondary)]">{{ pendingRules.length }} 条待完成</span>
          </div>

          <p v-if="!pendingRules.length" class="mt-3 text-sm text-[var(--tommy-text-secondary)]">
            所有规则均已达成。
          </p>

          <div v-else class="mt-3 flex flex-col gap-3">
            <article
              v-for="rule in pendingRules"
              :key="rule.id"
              class="rounded-2xl border border-slate-200 bg-white"
              data-testid="courses-rule"
              :data-rule-id="rule.id"
            >
              <button
                type="button"
                class="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
                :aria-expanded="isExpanded(rule.id)"
                @click="toggleRule(rule.id)"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-[var(--tommy-text)]">{{ rule.name }}</p>
                  <p class="mt-0.5 text-xs text-[var(--tommy-text-secondary)]" data-testid="courses-rule-gap">
                    {{ rule.gapText }} · 已完成 {{ rule.earnedCourses }} 门 · {{ rule.earnedCredits }} 学分
                  </p>
                </div>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" :class="ruleChipClass(rule.status)">
                  {{ ruleChipText(rule) }}
                </span>
              </button>

              <div v-if="isExpanded(rule.id)" class="border-t border-slate-100 px-3 py-2.5">
                <p v-if="rule.description" class="mb-2 text-[11px] text-[var(--tommy-text-secondary)]">
                  {{ rule.description }}
                </p>

                <div v-if="rule.completedCourses.length" class="flex flex-col gap-1.5">
                  <div
                    v-for="course in rule.completedCourses"
                    :key="course.id"
                    class="flex items-center justify-between rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700"
                    data-testid="courses-rule-done"
                  >
                    <span class="truncate">{{ course.name }}</span>
                    <span class="shrink-0 pl-2 text-emerald-600">{{ course.credits }} 学分</span>
                  </div>
                </div>

                <div v-if="rule.matchedFreeCourses.length" class="mt-1.5 flex flex-col gap-1.5">
                  <div
                    v-for="(course, index) in rule.matchedFreeCourses"
                    :key="course.gpaCourseId + '-' + index"
                    class="flex items-center justify-between rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-[11px] text-emerald-700"
                    data-testid="courses-rule-free"
                  >
                    <span class="truncate">{{ course.name }}</span>
                    <span class="shrink-0 pl-2 text-emerald-600">{{ course.credits }} 学分（自由匹配）</span>
                  </div>
                </div>

                <div v-if="rule.candidateCourses.length" class="mt-2">
                  <p class="text-[11px] font-semibold text-[var(--tommy-text-secondary)]">培养方案里还可以选：</p>
                  <div class="mt-1 flex flex-col gap-1.5">
                    <div
                      v-for="course in rule.candidateCourses"
                      :key="course.id"
                      class="flex items-center justify-between rounded-xl border border-dashed border-slate-200 px-2.5 py-1.5 text-[11px] text-[var(--tommy-text-secondary)]"
                      data-testid="courses-rule-candidate"
                    >
                      <span class="truncate">{{ course.name }}</span>
                      <span class="shrink-0 pl-2">{{ course.credits }} 学分</span>
                    </div>
                  </div>
                </div>

                <p
                  v-if="!rule.completedCourses.length && !rule.matchedFreeCourses.length && !rule.candidateCourses.length"
                  class="text-[11px] text-[var(--tommy-text-secondary)]"
                >
                  暂无可显示的课程信息。
                </p>
              </div>
            </article>
          </div>

          <div v-if="completedRules.length" class="mt-3 rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              class="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm"
              data-testid="courses-completed-toggle"
              :aria-expanded="!completedCollapsed"
              @click="completedCollapsed = !completedCollapsed"
            >
              <span class="font-semibold text-[var(--tommy-text)]">已达成 {{ completedRules.length }} 条</span>
              <span class="text-xs text-[var(--tommy-text-secondary)]">{{ completedCollapsed ? "展开" : "收起" }}</span>
            </button>
            <div v-if="!completedCollapsed" class="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5">
              <article
                v-for="rule in completedRules"
                :key="rule.id"
                class="rounded-xl bg-emerald-50/60 px-2.5 py-1.5 text-[11px] text-emerald-700"
                data-testid="courses-rule-completed"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-semibold">{{ rule.name }}</span>
                  <span class="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    已达成
                  </span>
                </div>
                <p class="mt-0.5 text-emerald-600/80">已完成 {{ rule.earnedCourses }} 门 · {{ rule.earnedCredits }} 学分</p>
              </article>
            </div>
          </div>
        </section>

        <p class="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          说明：大类学分仅统计与培养方案课程精确匹配的部分；自由匹配到规则的课程计入"已修学分"，但不计入对应大类。
        </p>

        <section class="rounded-3xl bg-white p-4 shadow-sm">
          <div class="flex items-start gap-3">
            <div class="flex-1">
              <p class="text-sm font-semibold text-[var(--tommy-text)]">重新匹配课程</p>
              <p class="mt-1 text-xs text-[var(--tommy-text-secondary)]">
                根据最新的 GPA 课程与培养方案自动重新计算课程匹配。
              </p>
            </div>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-full bg-[var(--tommy-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              data-testid="courses-rematch"
              :disabled="rematchMutation.isPending.value || isFetching"
              @click="handleRematch"
            >
              {{ rematchMutation.isPending.value ? "匹配中…" : "重新匹配" }}
            </button>
          </div>
          <p
            v-if="rematchMessage"
            class="mt-2 text-xs text-[var(--tommy-text-secondary)]"
            data-testid="courses-rematch-message"
          >
            {{ rematchMessage }}
          </p>
          <button
            type="button"
            class="mt-2 text-[11px] font-semibold text-[var(--tommy-primary)]"
            @click="refetch()"
          >
            刷新数据
          </button>
        </section>
      </template>
    </div>
  </AppShell>
</template>
