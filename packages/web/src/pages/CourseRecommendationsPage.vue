<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed, reactive, ref, watch } from "vue";

import AppShell from "../components/AppShell.vue";
import ConflictChoiceCard from "../components/ConflictChoiceCard.vue";
import WeeklyScheduleView from "../components/WeeklyScheduleView.vue";
import {
  generateRecommendation,
  getCandidateCourses,
  listSemesterCourses
} from "../lib/api";
import type {
  RecommendationPreferences,
  RecommendationResult
} from "../lib/api";

const currentTerm = ref(getCurrentTerm());

// Recommendation result
const recommendationResult = ref<RecommendationResult | null>(null);
const generating = ref(false);

// User overrides for conflict choices keyed by conflict id
const userConflictChoices = reactive<Record<string, "incoming" | "existing">>({});

watch(
  () => recommendationResult.value?.conflicts,
  (conflicts) => {
    // Clear existing choices
    for (const key of Object.keys(userConflictChoices)) {
      delete userConflictChoices[key];
    }
    if (!conflicts) return;
    for (const conflict of conflicts) {
      userConflictChoices[conflict.id] = conflict.defaultChoice;
    }
  },
  { immediate: true }
);

// Preferences
const preferences = reactive<RecommendationPreferences>({
  avoidDays: [],
  avoidEarlyMorning: false,
  scheduleStyle: "spread",
  maxCoursesPerDay: undefined,
  notes: ""
});

function getCurrentTerm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month <= 6 ? year - 1 : year;
  const endYear = startYear + 1;
  const semester = month <= 6 ? "春" : "秋";
  return `${startYear}-${endYear} ${semester}`;
}

// Queries
const { data: candidatesData } = useQuery({
  queryKey: computed(() => ["candidate-courses", currentTerm.value]),
  queryFn: () => getCandidateCourses(currentTerm.value),
  refetchOnMount: "always"
});

const { data: semesterCoursesData } = useQuery({
  queryKey: computed(() => ["semester-courses", currentTerm.value]),
  queryFn: () => listSemesterCourses(currentTerm.value)
});

const termContext = computed(() => candidatesData.value?.termContext ?? null);
const candidates = computed(() => candidatesData.value?.courses ?? candidatesData.value?.candidates ?? []);
const availableCandidates = computed(() => candidates.value.filter((c) => c.status === "available"));
const requiredCandidates = computed(() => availableCandidates.value.filter((c) => c.isRequired));
const electiveCandidates = computed(() => availableCandidates.value.filter((c) => !c.isRequired));
const semesterCourses = computed(() => semesterCoursesData.value?.courses ?? []);

// Statistics
const candidateStats = computed(() => {
  const stats = candidatesData.value?.stats;
  if (stats) {
    return {
      totalCount: stats.totalCount,
      totalCredits: stats.totalCredits,
      completedCount: stats.completedCount,
      completedCredits: stats.completedCredits,
      remainingCount: stats.remainingCount,
      remainingCredits: stats.remainingCredits,
      requiredCount: stats.requiredRemainingCount,
      requiredCredits: stats.requiredRemainingCredits,
      electiveCount: stats.electiveRemainingCount,
      electiveCredits: stats.electiveRemainingCredits
    };
  }
  return {
    totalCount: candidates.value.length,
    totalCredits: candidates.value.reduce((s, c) => s + c.credits, 0),
    completedCount: candidates.value.filter((c) => c.status === "completed").length,
    completedCredits: candidates.value.filter((c) => c.status === "completed").reduce((s, c) => s + c.credits, 0),
    remainingCount: availableCandidates.value.length,
    remainingCredits: availableCandidates.value.reduce((s, c) => s + c.credits, 0),
    requiredCount: requiredCandidates.value.length,
    requiredCredits: requiredCandidates.value.reduce((s, c) => s + c.credits, 0),
    electiveCount: electiveCandidates.value.length,
    electiveCredits: electiveCandidates.value.reduce((s, c) => s + c.credits, 0)
  };
});

const candidateEmptyMessage = computed(() => {
  if (!candidatesData.value) return "正在读取培养方案课程...";
  if (!candidatesData.value.hasPlan) return "暂无候选课程，请先导入培养方案";
  if (!termContext.value?.canInfer) return "无法推断当前对应的培养方案学期，请检查个人年级和学期格式";
  return "当前学期在培养方案中暂无课程";
});

const semesterStats = computed(() => {
  const courses = semesterCourses.value;
  return {
    count: courses.length,
    credits: courses.reduce((s, c) => s + Number(c.credits), 0),
    byDay: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
      day: d,
      label: ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"][d],
      count: courses.filter((c) => c.schedule.some((s) => s.dayOfWeek === d)).length
    }))
  };
});

// Mutations
const generateMutation = useMutation({
  mutationFn: () =>
    generateRecommendation({
      term: currentTerm.value,
      preferences: { ...preferences },
      candidateCourseIds: []
    }),
  onSuccess: (data) => {
    recommendationResult.value = data.recommendation;
  }
});

function handleGenerate() {
  generating.value = true;
  void generateMutation.mutateAsync().finally(() => {
    generating.value = false;
  });
}

function formatSchedule(
  schedule: Array<{
    dayOfWeek: number;
    startPeriod: number;
    endPeriod: number;
    startWeek?: number;
    endWeek?: number;
    weekLabel?: string;
  }>
): string {
  const dayMap = ["", "一", "二", "三", "四", "五", "六", "日"];
  return schedule
    .map((s) => {
      const week = s.weekLabel ?? (s.startWeek && s.endWeek ? `${s.startWeek}-${s.endWeek}周` : "");
      return `${week ? `${week} ` : ""}周${dayMap[s.dayOfWeek] ?? s.dayOfWeek} ${s.startPeriod}-${s.endPeriod}节`;
    })
    .join("，");
}

function formatCredits(value: number | string | null | undefined): string {
  if (value == null || value === "") return "-";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
}

function getConflictKey(conflict: { id: string }): string {
  return conflict.id;
}

const displayedRecommendedCourses = computed(() => {
  if (!recommendationResult.value) return [];
  const courses = [...recommendationResult.value.recommendedCourses];
  const nameSet = new Set(courses.map((c) => c.courseName));

  for (const conflict of recommendationResult.value.conflicts ?? []) {
    const choice = userConflictChoices[getConflictKey(conflict)] ?? conflict.defaultChoice;

    if (choice === "incoming") {
      if (!nameSet.has(conflict.incoming.courseName)) {
        courses.push({
          courseCode: conflict.incoming.courseCode,
          courseName: conflict.incoming.courseName,
          credits: conflict.incoming.credits,
          teacher: conflict.incoming.teacher,
          classroom: conflict.incoming.classroom,
          schedule: conflict.incoming.schedule,
          reason: "手动选择替代冲突课程"
        });
        nameSet.add(conflict.incoming.courseName);
      }
      for (const existing of conflict.existing) {
        const idx = courses.findIndex((c) => c.courseName === existing.courseName);
        if (idx >= 0) {
          courses.splice(idx, 1);
          nameSet.delete(existing.courseName);
        }
      }
    } else {
      const idx = courses.findIndex((c) => c.courseName === conflict.incoming.courseName);
      if (idx >= 0) {
        courses.splice(idx, 1);
        nameSet.delete(conflict.incoming.courseName);
      }
      for (const existing of conflict.existing) {
        if (!nameSet.has(existing.courseName)) {
          courses.push({
            courseCode: existing.courseCode,
            courseName: existing.courseName,
            credits: existing.credits,
            teacher: existing.teacher,
            classroom: existing.classroom,
            schedule: existing.schedule,
            reason: "手动选择保留原课程"
          });
          nameSet.add(existing.courseName);
        }
      }
    }
  }

  return courses;
});

const scheduleViewCourses = computed(() => {
  return displayedRecommendedCourses.value.map((c) => ({
    courseName: c.courseName,
    courseCode: c.courseCode,
    classroom: c.classroom,
    teacher: c.teacher,
    schedule: c.schedule
  }));
});

const displayStats = computed(() => {
  const courses = displayedRecommendedCourses.value;
  const daySet = new Set(courses.flatMap((c) => c.schedule.map((s) => s.dayOfWeek)));
  const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
  return {
    totalCredits,
    courseCount: courses.length,
    dayCount: daySet.size,
    averagePerDay:
      courses.length > 0 && daySet.size > 0
        ? (courses.length / daySet.size).toFixed(1)
        : "-"
  };
});

const nonConflictWarnings = computed(() => {
  if (!recommendationResult.value) return [];
  const conflictNames = new Set(
    (recommendationResult.value.conflicts ?? []).flatMap((c) => [
      c.incoming.courseName,
      ...c.existing.map((e) => e.courseName)
    ])
  );
  return recommendationResult.value.warnings.filter((w) => {
    return !Array.from(conflictNames).some((name) => w.includes(name));
  });
});
</script>

<template>
  <AppShell>
    <div class="space-y-5">
      <!-- Header -->
      <section class="rounded-3xl bg-white p-6 shadow-sm">
        <p class="text-sm font-semibold text-[var(--tommy-primary)]">GradCheck</p>
        <h1 class="mt-2 text-2xl font-bold text-[var(--tommy-text)]">选课推荐</h1>
        <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
          根据培养方案缺口和课程时间，帮你生成最优选课方案
        </p>
        <div class="mt-4 flex items-center gap-3">
          <label class="text-sm font-medium text-[var(--tommy-text)]">学期：</label>
          <input
            v-model="currentTerm"
            type="text"
            class="rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-[var(--tommy-primary)]"
            placeholder="如 2025-2026 春"
          />
        </div>
      </section>

      <!-- Candidate Courses Card -->
      <section class="rounded-3xl bg-white p-5 shadow-sm">
        <div class="mb-4">
          <div>
            <h2 class="text-lg font-bold text-[var(--tommy-text)]"
            >📚 培养方案当前学期课程
            </h2>
            <p class="text-xs text-[var(--tommy-text-secondary)]"
            >{{ currentTerm }}{{ termContext?.label ? `，对应${termContext.label}` : "" }}，共 {{ candidateStats.totalCount }} 门应修
            </p>
          </div>
        </div>

        <!-- Candidate Stats -->
        <div class="mb-3 flex flex-wrap gap-3 text-xs"
        >
          <span class="rounded-md bg-red-50 px-2 py-1 text-red-600"
          >必修 {{ candidateStats.requiredCount }} 门 / {{ formatCredits(candidateStats.requiredCredits) }} 学分
          </span>
          <span class="rounded-md bg-blue-50 px-2 py-1 text-blue-600"
          >待推荐 {{ candidateStats.remainingCount }} 门 / {{ formatCredits(candidateStats.remainingCredits) }} 学分
          </span>
        </div>

        <!-- Candidate List -->
        <div class="max-h-48 overflow-y-auto rounded-xl border border-slate-100">
          <div
            v-if="candidates.length === 0"
            class="px-3 py-4 text-center text-sm text-slate-400"
          >
            <template v-if="candidatesData && !candidatesData.hasPlan">
              暂无候选课程，请先
              <RouterLink to="/plans" class="text-[var(--tommy-primary)] hover:underline">导入培养方案</RouterLink>
            </template>
            <template v-else>
              {{ candidateEmptyMessage }}
            </template>
          </div>
          <div
            v-for="course in candidates"
            :key="course.code"
            class="flex items-center gap-2 border-b border-slate-50 px-3 py-2 last:border-b-0"
          >
            <span
              v-if="course.isRequired"
              class="shrink-0 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600"
            >必修
            </span>
            <span
              v-else
              class="shrink-0 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600"
            >选修
            </span>
            <span
              class="flex-1 text-sm"
              :class="course.status === 'completed' ? 'text-slate-400 line-through' : 'text-[var(--tommy-text)]'"
            >
              {{ course.name }}
            </span>
            <span class="text-xs text-slate-400">{{ formatCredits(course.credits) }}学分</span>
            <span v-if="course.term?.year" class="text-[10px] text-slate-400"
            >{{ course.term.year }}{{ course.term.semester }}
            </span>
          </div>
        </div>

        <!-- Day distribution -->
        <div class="mt-4 flex gap-2">
          <div
            v-for="day in semesterStats.byDay"
            :key="day.day"
            class="flex-1 rounded-lg py-2 text-center"
            :class="day.count > 0 ? 'bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)]' : 'bg-slate-50'"
          >
            <p class="text-xs font-medium" :class="day.count > 0 ? 'text-[var(--tommy-primary)]' : 'text-slate-400'">
              {{ day.label }}
            </p>
            <p class="text-lg font-bold" :class="day.count > 0 ? 'text-[var(--tommy-text)]' : 'text-slate-300'">
              {{ day.count }}
            </p>
          </div>
        </div>
      </section>

      <!-- Recommendation Section -->
      <section class="rounded-3xl bg-white p-5 shadow-sm">
        <div class="mb-4 flex items-center gap-3">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-lg">🎯</span>
          <h2 class="text-lg font-bold text-[var(--tommy-text)]">选课方案推荐</h2>
        </div>

        <!-- Preferences Bar -->
        <div class="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500">上课时间</label>
            <button
              class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
              :class="
                preferences.avoidEarlyMorning
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              "
              @click="preferences.avoidEarlyMorning = !preferences.avoidEarlyMorning"
            >
              不想上早八
            </button>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500">排课方式</label>
            <div class="flex rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                v-for="option in [
                  { value: 'compact', label: '课程集中' },
                  { value: 'spread', label: '课程分散' }
                ]"
                :key="option.value"
                class="rounded-md px-3 py-1 text-sm font-medium transition-colors"
                :class="
                  preferences.scheduleStyle === option.value
                    ? 'bg-[var(--tommy-primary)] text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                "
                @click="preferences.scheduleStyle = option.value as RecommendationPreferences['scheduleStyle']"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-500">单日最多几门</label>
            <input
              v-model.number="preferences.maxCoursesPerDay"
              type="number"
              min="1"
              max="12"
              placeholder="不限"
              class="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-[var(--tommy-primary)]"
            />
          </div>
          <div class="flex flex-1 flex-col gap-1">
            <label class="text-xs font-medium text-slate-500">其他要求（自由填写）</label>
            <input
              v-model="preferences.notes"
              type="text"
              placeholder="如：下午想空出来；周末能少排就少排..."
              class="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-[var(--tommy-primary)]"
            />
          </div>
          <button
            class="ml-auto rounded-xl bg-[var(--tommy-primary)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            :disabled="generating"
            @click="handleGenerate"
          >
            {{ generating ? "生成中..." : "生成推荐方案" }}
          </button>
        </div>

        <!-- Result Area -->
        <div class="mt-5">
          <!-- Empty State -->
          <div
            v-if="!recommendationResult && !generating"
            class="flex flex-col items-center gap-3 rounded-xl bg-slate-50 py-12 text-center"
          >
            <svg
              class="h-12 w-12 text-slate-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p class="text-sm text-slate-400">
              设置偏好条件后，点击生成按钮获取推荐方案
            </p>
          </div>

          <!-- Loading -->
          <div
            v-else-if="generating"
            class="flex flex-col items-center gap-3 rounded-xl bg-slate-50 py-12 text-center"
          >
            <div class="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--tommy-primary)]" />
            <p class="text-sm text-slate-400">正在为你排课，请稍候...</p>
          </div>

          <!-- Result -->
          <div v-else-if="recommendationResult" class="space-y-4">
            <!-- Summary -->
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_8%,white)] p-3">
                <p class="text-xs text-slate-500">总学分</p>
                <p class="text-xl font-bold text-[var(--tommy-primary)]">
                  {{ formatCredits(displayStats.totalCredits) }}
                </p>
              </div>
              <div class="rounded-xl bg-blue-50 p-3">
                <p class="text-xs text-slate-500">课程数</p>
                <p class="text-xl font-bold text-blue-600">
                  {{ displayStats.courseCount }}
                </p>
              </div>
              <div class="rounded-xl bg-green-50 p-3">
                <p class="text-xs text-slate-500">有课天数</p>
                <p class="text-xl font-bold text-green-600">
                  {{ displayStats.dayCount }}
                </p>
              </div>
              <div class="rounded-xl bg-amber-50 p-3">
                <p class="text-xs text-slate-500">日均门数</p>
                <p class="text-xl font-bold text-amber-600">
                  {{ displayStats.averagePerDay }}
                </p>
              </div>
            </div>

            <div v-if="recommendationResult.summary" class="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {{ recommendationResult.summary }}
            </div>

            <!-- Conflict choices -->
            <div
              v-if="recommendationResult.conflicts && recommendationResult.conflicts.length > 0"
              class="space-y-3"
            >
              <ConflictChoiceCard
                v-for="conflict in recommendationResult.conflicts"
                :key="conflict.id"
                :conflict="conflict"
                v-model="userConflictChoices[conflict.id]"
              />
            </div>

            <!-- Non-conflict warnings -->
            <div
              v-if="nonConflictWarnings.length > 0"
              class="space-y-1"
            >
              <div
                v-for="(warning, idx) in nonConflictWarnings"
                :key="idx"
                class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
              >
                ⚠️ {{ warning }}
              </div>
            </div>

            <!-- Weekly Schedule -->
            <div>
              <h3 class="mb-3 text-sm font-semibold text-[var(--tommy-text)]">周视图</h3>
              <WeeklyScheduleView :courses="scheduleViewCourses" />
            </div>

            <!-- Course List -->
            <div>
              <h3 class="mb-3 text-sm font-semibold text-[var(--tommy-text)]">推荐课程清单</h3>
              <div class="space-y-2">
                <div
                  v-for="course in displayedRecommendedCourses"
                  :key="course.courseName"
                  class="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3"
                >
                  <div class="flex-1">
                    <div class="font-medium text-[var(--tommy-text)]">
                      {{ course.courseName }}
                      <span v-if="course.courseCode" class="ml-1 text-xs text-slate-400">({{ course.courseCode }})</span>
                    </div>
                    <div class="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{{ formatCredits(course.credits) }}学分</span>
                      <span v-if="course.teacher">{{ course.teacher }}</span>
                      <span v-if="course.classroom">{{ course.classroom }}</span>
                      <span>{{ formatSchedule(course.schedule) }}</span>
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="inline-block rounded-lg bg-green-50 px-2 py-1 text-xs text-green-600">
                      {{ course.reason }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </AppShell>
</template>
