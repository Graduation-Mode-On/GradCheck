<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ZodError } from "zod";

import AppShell from "../components/AppShell.vue";
import {
  createGpaCourse,
  deleteGpaCourse,
  getGpaDashboard,
  getToken,
  updateGpaCourse,
  type GpaCourse,
  type GpaDashboardResponse,
  type GpaScopeResult
} from "../lib/api";
import { gpaCourseSchema, gpaTerms, type GpaCourseInput } from "../schemas/gpa";

const router = useRouter();
const queryClient = useQueryClient();
const authToken = getToken();
const message = ref("");
const editingCourseId = ref<string | null>(null);
const form = reactive<GpaCourseInput>({
  term: "2025-2026 春",
  name: "",
  credit: "",
  score: "",
  isRequired: true,
  isFirstAttempt: true,
  isGpaEligible: true
});

if (!authToken) {
  void router.replace("/login");
}

const gpaDashboardQueryKey = ["gpa-dashboard", authToken] as const;
const { data, isLoading } = useQuery({
  queryKey: gpaDashboardQueryKey,
  queryFn: getGpaDashboard,
  enabled: computed(() => Boolean(authToken))
});

const courses = computed(() => data.value?.courses ?? []);
const result = computed(() => data.value?.result ?? null);

function resetForm() {
  editingCourseId.value = null;
  form.term = "2025-2026 春";
  form.name = "";
  form.credit = "";
  form.score = "";
  form.isRequired = true;
  form.isFirstAttempt = true;
  form.isGpaEligible = true;
}

async function applyDashboard(response: GpaDashboardResponse) {
  await queryClient.cancelQueries({ queryKey: gpaDashboardQueryKey });
  queryClient.setQueryData(gpaDashboardQueryKey, response);
  message.value = "GPA 数据已更新";
  resetForm();
}

const saveMutation = useMutation({
  mutationFn: async () => {
    const input = gpaCourseSchema.parse(form);
    return editingCourseId.value ? updateGpaCourse(editingCourseId.value, input) : createGpaCourse(input);
  },
  onSuccess: applyDashboard,
  onError: (error) => {
    if (error instanceof ZodError) {
      message.value = error.issues[0]?.message ?? "课程信息不完整";
      return;
    }

    message.value = error instanceof Error ? error.message : "保存失败";
  }
});

const deleteMutation = useMutation({
  mutationFn: deleteGpaCourse,
  onSuccess: applyDashboard,
  onError: (error) => {
    message.value = error instanceof Error ? error.message : "删除失败";
  }
});

function submit() {
  message.value = "";
  saveMutation.mutate();
}

function editCourse(course: GpaCourse) {
  editingCourseId.value = course.id;
  form.term = course.term;
  form.name = course.name;
  form.credit = course.credit;
  form.score = course.score;
  form.isRequired = course.isRequired;
  form.isFirstAttempt = course.isFirstAttempt;
  form.isGpaEligible = course.isGpaEligible;
}

function formatMetric(value: number | null): string {
  return value === null ? "暂无" : String(value);
}

function scopeSubtitle(scope: GpaScopeResult | undefined): string {
  if (!scope || scope.courseCount === 0) {
    return "暂无可计算课程";
  }

  return `${scope.courseCount} 门课程 / ${scope.totalCredits} 学分`;
}
</script>

<template>
  <AppShell>
    <section class="mb-5 rounded-3xl bg-white p-6 shadow-sm">
      <p class="text-sm font-semibold text-[var(--tommy-primary)]">GPA Calculator</p>
      <h1 class="mt-2 text-2xl font-bold text-[var(--tommy-text)]">GPA 计算器</h1>
      <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
        添加自己的课程成绩后，系统会按东南大学 4.8 制规则自动保存并重新计算。
      </p>
    </section>

    <section class="mb-5 grid gap-4 md:grid-cols-2">
      <article data-testid="gpa-required-result" class="rounded-3xl bg-white p-5 shadow-sm">
        <p class="text-sm font-semibold text-[var(--tommy-info)]">首修必修课程</p>
        <p class="mt-3 text-3xl font-bold text-[var(--tommy-primary)]">{{ formatMetric(result?.requiredFirstAttempt.weightedGpa ?? null) }}</p>
        <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
          加权均分 {{ formatMetric(result?.requiredFirstAttempt.weightedAverageScore ?? null) }} · {{ scopeSubtitle(result?.requiredFirstAttempt) }}
        </p>
      </article>

      <article data-testid="gpa-overall-result" class="rounded-3xl bg-white p-5 shadow-sm">
        <p class="text-sm font-semibold text-[var(--tommy-info)]">总课程</p>
        <p class="mt-3 text-3xl font-bold text-[var(--tommy-primary)]">{{ formatMetric(result?.overall.weightedGpa ?? null) }}</p>
        <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
          加权均分 {{ formatMetric(result?.overall.weightedAverageScore ?? null) }} · {{ scopeSubtitle(result?.overall) }}
        </p>
      </article>
    </section>

    <section class="grid gap-5 lg:grid-cols-[1fr_360px]">
      <article class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 class="text-lg font-bold text-[var(--tommy-text)]">我的课程</h2>
        <p v-if="isLoading" class="mt-4 text-sm text-[var(--tommy-text-secondary)]">正在加载课程...</p>
        <p v-else-if="courses.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-[var(--tommy-text-secondary)]">
          还没有课程，先添加一门课程开始计算。
        </p>
        <div v-else data-testid="gpa-course-list" class="mt-4 space-y-3">
          <div v-for="course in courses" :key="course.id" class="rounded-2xl border border-slate-200 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-[var(--tommy-text)]">{{ course.name }}</p>
                <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">
                  {{ course.term }} · {{ course.credit }} 学分 · {{ course.score }} 分
                </p>
                <p class="mt-2 text-xs text-[var(--tommy-text-secondary)]">
                  {{ course.isRequired ? "必修" : "非必修" }} · {{ course.isFirstAttempt ? "首修" : "非首修" }} · {{ course.isGpaEligible ? "计入 GPA" : "不计入 GPA" }}
                </p>
              </div>
              <div class="flex gap-2">
                <button class="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold" type="button" @click="editCourse(course)">
                  编辑
                </button>
                <button class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] px-3 py-2 text-sm font-semibold text-[var(--tommy-error)]" type="button" @click="deleteMutation.mutate(course.id)">
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>

      <aside class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 class="text-lg font-bold text-[var(--tommy-text)]">{{ editingCourseId ? "编辑课程" : "添加课程" }}</h2>
        <form data-testid="gpa-course-form" class="mt-4 space-y-4" @submit.prevent="submit">
          <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
            学期
            <select v-model="form.term" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
              <option v-for="term in gpaTerms" :key="term" :value="term">{{ term }}</option>
            </select>
          </label>
          <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
            课程名称
            <input data-testid="gpa-course-name" v-model="form.name" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
              学分
              <input data-testid="gpa-course-credit" v-model="form.credit" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" inputmode="decimal" />
            </label>
            <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
              成绩
              <input data-testid="gpa-course-score" v-model="form.score" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" inputmode="decimal" />
            </label>
          </div>
          <label class="flex items-center gap-2 text-sm text-[var(--tommy-text-secondary)]">
            <input v-model="form.isRequired" type="checkbox" />
            必修课程
          </label>
          <label class="flex items-center gap-2 text-sm text-[var(--tommy-text-secondary)]">
            <input v-model="form.isFirstAttempt" type="checkbox" />
            首修成绩
          </label>
          <label class="flex items-center gap-2 text-sm text-[var(--tommy-text-secondary)]">
            <input v-model="form.isGpaEligible" type="checkbox" />
            计入 GPA/均分
          </label>

          <p v-if="message" class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-info)]">{{ message }}</p>

          <div class="flex flex-wrap gap-2">
            <button class="rounded-xl bg-[var(--tommy-primary)] px-4 py-2.5 font-semibold text-white disabled:opacity-60" type="submit" :disabled="saveMutation.isPending.value">
              {{ saveMutation.isPending.value ? "保存中..." : editingCourseId ? "保存修改" : "添加课程" }}
            </button>
            <button v-if="editingCourseId" class="rounded-xl bg-slate-100 px-4 py-2.5 font-semibold text-[var(--tommy-text)]" type="button" @click="resetForm">
              取消编辑
            </button>
          </div>
        </form>
      </aside>
    </section>
  </AppShell>
</template>
