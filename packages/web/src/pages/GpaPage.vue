<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, nextTick, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ZodError } from "zod";

import AppShell from "../components/AppShell.vue";
import {
  createGpaCourse,
  deleteGpaCourse,
  deleteGpaCourseMatch,
  getGpaCourseMatches,
  getGpaDashboard,
  getToken,
  importGpaTranscriptCourses,
  updateGpaCourse,
  upsertGpaCourseMatch,
  uploadGpaTranscript,
  type GpaCourse,
  type GpaCourseMatchItem,
  type GpaDashboardResponse,
  type GpaScopeResult,
  type GpaTranscriptCoursePreview
} from "../lib/api";
import { gpaCourseSchema, gpaTerms, type GpaCourseInput } from "../schemas/gpa";

const router = useRouter();
const queryClient = useQueryClient();
const authToken = getToken();
const message = ref("");
const editingCourseId = ref<string | null>(null);
const openActionsCourseId = ref<string | null>(null);
const formPanel = ref<HTMLElement | null>(null);
const transcriptFile = ref<File | null>(null);
const transcriptPreview = ref<{
  sourceFilename: string;
  courseCount: number;
  importableCourseCount: number;
  courses: GpaTranscriptCoursePreview[];
  warnings: string[];
} | null>(null);
const selectedTranscriptCourseKeys = ref<Set<string>>(new Set());
const selectedMatchTargets = ref<Record<string, string>>({});
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
const { data, error, isLoading } = useQuery({
  queryKey: gpaDashboardQueryKey,
  queryFn: getGpaDashboard,
  enabled: computed(() => Boolean(authToken))
});
const courseMatchesQuery = useQuery({
  queryKey: ["gpa-course-matches", authToken],
  queryFn: getGpaCourseMatches,
  enabled: computed(() => Boolean(authToken))
});

const courses = computed(() => data.value?.courses ?? []);
const result = computed(() => data.value?.result ?? null);
const dashboardErrorMessage = computed(() => {
  const dashboardError = error.value;

  if (!dashboardError) {
    return "";
  }

  return dashboardError instanceof Error ? dashboardError.message : "加载 GPA 数据失败";
});

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

const bindMatchMutation = useMutation({
  mutationFn: async ({ courseId, target }: { courseId: string; target: string }) => {
    const [matchTargetType, id] = target.split(":");
    return upsertGpaCourseMatch(
      courseId,
      matchTargetType === "group"
        ? { matchTargetType: "group", programPlanCourseGroupId: id }
        : { matchTargetType: "course", programPlanCourseId: id }
    );
  },
  onSuccess: async (response) => {
    await applyDashboard(response.dashboard);
    await courseMatchesQuery.refetch();
  },
  onError: (error) => {
    message.value = error instanceof Error ? error.message : "保存课程匹配失败";
  }
});

const unbindMatchMutation = useMutation({
  mutationFn: deleteGpaCourseMatch,
  onSuccess: async (response) => {
    await applyDashboard(response.dashboard);
    await courseMatchesQuery.refetch();
  },
  onError: (error) => {
    message.value = error instanceof Error ? error.message : "取消课程匹配失败";
  }
});

const transcriptPreviewMutation = useMutation({
  mutationFn: async () => {
    if (!transcriptFile.value) {
      throw new Error("请先选择电子成绩单 PDF");
    }
    return uploadGpaTranscript(transcriptFile.value);
  },
  onSuccess: (response) => {
    transcriptPreview.value = response.preview;
    selectedTranscriptCourseKeys.value = new Set(response.preview.courses.map(transcriptCourseKey));
    message.value = `已解析 ${response.preview.courseCount} 门课程`;
  },
  onError: (error) => {
    message.value = error instanceof Error ? error.message : "解析成绩单失败";
  }
});

const transcriptImportMutation = useMutation({
  mutationFn: async () => {
    const selectedCourses = (transcriptPreview.value?.courses ?? [])
      .filter((course) => selectedTranscriptCourseKeys.value.has(transcriptCourseKey(course)))
      .map(toGpaCourseInput);
    return importGpaTranscriptCourses(selectedCourses);
  },
  onSuccess: async (response) => {
    await applyDashboard(response.dashboard);
    transcriptPreview.value = null;
    selectedTranscriptCourseKeys.value = new Set();
    message.value = `已导入 ${response.importedCount} 门课程，跳过 ${response.skippedCount} 门重复课程`;
  },
  onError: (error) => {
    message.value = error instanceof Error ? error.message : "导入成绩单失败";
  }
});

function submit() {
  message.value = "";
  saveMutation.mutate();
}

function onTranscriptFileChange(event: Event) {
  transcriptFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

function toggleCourseActions(courseId: string) {
  openActionsCourseId.value = openActionsCourseId.value === courseId ? null : courseId;
}

async function editCourse(course: GpaCourse) {
  openActionsCourseId.value = null;
  editingCourseId.value = course.id;
  form.term = course.term;
  form.name = course.name;
  form.credit = course.credit;
  form.score = course.score;
  form.isRequired = course.isRequired;
  form.isFirstAttempt = course.isFirstAttempt;
  form.isGpaEligible = course.isGpaEligible;
  await nextTick();
  formPanel.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteCourse(courseId: string) {
  openActionsCourseId.value = null;
  deleteMutation.mutate(courseId);
}

function transcriptCourseKey(course: GpaCourseInput) {
  return [course.term, course.name, course.credit, course.score].join("|");
}

function isTranscriptCourseSelected(course: GpaTranscriptCoursePreview) {
  return selectedTranscriptCourseKeys.value.has(transcriptCourseKey(course));
}

function toggleTranscriptCourse(course: GpaTranscriptCoursePreview, checked: boolean) {
  const next = new Set(selectedTranscriptCourseKeys.value);
  const key = transcriptCourseKey(course);
  if (checked) {
    next.add(key);
  } else {
    next.delete(key);
  }
  selectedTranscriptCourseKeys.value = next;
}

function toGpaCourseInput(course: GpaTranscriptCoursePreview): GpaCourseInput {
  return {
    term: course.term,
    name: course.name,
    credit: course.credit,
    score: course.score,
    isRequired: course.isRequired,
    isFirstAttempt: course.isFirstAttempt,
    isGpaEligible: course.isGpaEligible
  };
}

function selectedMatchTarget(item: GpaCourseMatchItem) {
  if (selectedMatchTargets.value[item.course.id]) {
    return selectedMatchTargets.value[item.course.id];
  }
  if (item.match?.matchTargetType === "group" && item.match.programPlanCourseGroupId) {
    return `group:${item.match.programPlanCourseGroupId}`;
  }
  if (item.match?.programPlanCourseId) {
    return `course:${item.match.programPlanCourseId}`;
  }
  return "";
}

function setSelectedMatchTarget(courseId: string, value: string) {
  selectedMatchTargets.value = { ...selectedMatchTargets.value, [courseId]: value };
}

function bindSelectedMatch(item: GpaCourseMatchItem) {
  const target = selectedMatchTarget(item);
  if (!target) {
    message.value = "请先选择匹配目标";
    return;
  }
  bindMatchMutation.mutate({ courseId: item.course.id, target });
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

    <section data-testid="gpa-result-grid" class="mb-5 grid grid-cols-2 gap-3 md:gap-4">
      <article data-testid="gpa-required-result" class="rounded-3xl bg-white p-3 shadow-sm md:p-4">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-semibold text-[var(--tommy-info)]">首修必修课程</p>
          <span class="rounded-full bg-[color-mix(in_srgb,var(--tommy-primary)_10%,white)] px-2.5 py-1 text-xs font-semibold text-[var(--tommy-primary)]">GPA</span>
        </div>
        <p class="mt-2 text-3xl font-bold leading-none text-[var(--tommy-primary)] md:text-4xl">{{ formatMetric(result?.requiredFirstAttempt.weightedGpa ?? null) }}</p>
        <p data-testid="gpa-required-summary" class="mt-2 text-xs text-[var(--tommy-text-secondary)]">
          均分 {{ formatMetric(result?.requiredFirstAttempt.weightedAverageScore ?? null) }} · 学分 {{ result?.requiredFirstAttempt.totalCredits ?? 0 }} · {{ result?.requiredFirstAttempt.courseCount ?? 0 }} 门
        </p>
        <p v-if="!result?.requiredFirstAttempt.courseCount" class="mt-1 text-xs text-[var(--tommy-text-secondary)]">{{ scopeSubtitle(result?.requiredFirstAttempt) }}</p>
      </article>

      <article data-testid="gpa-overall-result" class="rounded-3xl bg-white p-3 shadow-sm md:p-4">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-semibold text-[var(--tommy-info)]">总课程</p>
          <span class="rounded-full bg-[color-mix(in_srgb,var(--tommy-primary)_10%,white)] px-2.5 py-1 text-xs font-semibold text-[var(--tommy-primary)]">GPA</span>
        </div>
        <p class="mt-2 text-3xl font-bold leading-none text-[var(--tommy-primary)] md:text-4xl">{{ formatMetric(result?.overall.weightedGpa ?? null) }}</p>
        <p data-testid="gpa-overall-summary" class="mt-2 text-xs text-[var(--tommy-text-secondary)]">
          均分 {{ formatMetric(result?.overall.weightedAverageScore ?? null) }} · 学分 {{ result?.overall.totalCredits ?? 0 }} · {{ result?.overall.courseCount ?? 0 }} 门
        </p>
        <p v-if="!result?.overall.courseCount" class="mt-1 text-xs text-[var(--tommy-text-secondary)]">{{ scopeSubtitle(result?.overall) }}</p>
      </article>
    </section>

    <section class="mb-5 rounded-3xl bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-[var(--tommy-text)]">导入电子成绩单</h2>
          <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">上传东南大学电子成绩单 PDF，先预览解析结果，确认后写入 GPA 课程。</p>
        </div>
        <button
          data-testid="gpa-transcript-preview"
          class="rounded-xl bg-[var(--tommy-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          type="button"
          :disabled="transcriptPreviewMutation.isPending.value"
          @click="transcriptPreviewMutation.mutate()"
        >
          {{ transcriptPreviewMutation.isPending.value ? "解析中..." : "解析成绩单" }}
        </button>
      </div>
      <input data-testid="gpa-transcript-file" class="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" type="file" accept=".pdf,application/pdf" @change="onTranscriptFileChange" />

      <div v-if="transcriptPreview" class="mt-4 rounded-2xl bg-slate-50 p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm font-semibold text-[var(--tommy-text)]">
            {{ transcriptPreview.sourceFilename }} · 解析 {{ transcriptPreview.courseCount }} 门 · 默认选中 {{ selectedTranscriptCourseKeys.size }} 门
          </p>
          <button
            data-testid="gpa-transcript-import"
            class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            type="button"
            :disabled="selectedTranscriptCourseKeys.size === 0 || transcriptImportMutation.isPending.value"
            @click="transcriptImportMutation.mutate()"
          >
            {{ transcriptImportMutation.isPending.value ? "导入中..." : "确认导入" }}
          </button>
        </div>
        <div data-testid="gpa-transcript-preview-list" class="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
          <label
            v-for="course in transcriptPreview.courses"
            :key="transcriptCourseKey(course)"
            class="flex items-start gap-3 rounded-xl bg-white p-3 text-sm"
          >
            <input
              class="mt-1"
              type="checkbox"
              :checked="isTranscriptCourseSelected(course)"
              @change="toggleTranscriptCourse(course, ($event.target as HTMLInputElement).checked)"
            />
            <span class="min-w-0 flex-1">
              <span class="block font-semibold text-[var(--tommy-text)]">{{ course.name }}</span>
              <span class="mt-1 block text-xs text-[var(--tommy-text-secondary)]">
                {{ course.term }} · {{ course.credit }} 学分 · 原成绩 {{ course.rawGrade }} · 录入 {{ course.score }} 分 · {{ course.isGpaEligible ? "计入 GPA" : "不计入 GPA" }}
              </span>
              <span v-if="course.exclusionReason" class="mt-1 block text-xs text-[var(--tommy-warning)]">{{ course.exclusionReason }}</span>
            </span>
          </label>
        </div>
      </div>
    </section>

    <section class="mb-5 rounded-3xl bg-white p-5 shadow-sm">
      <h2 class="text-lg font-bold text-[var(--tommy-text)]">课程匹配</h2>
      <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">查看 GPA 课程与培养方案课程/课程组的对应关系，也可以手动调整。</p>
      <p v-if="courseMatchesQuery.isLoading.value" class="mt-4 text-sm text-[var(--tommy-text-secondary)]">正在加载匹配结果...</p>
      <div v-else data-testid="gpa-match-list" class="mt-4 space-y-3">
        <div
          v-for="item in courseMatchesQuery.data.value?.items ?? []"
          :key="item.course.id"
          class="rounded-2xl border border-slate-200 p-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="font-semibold text-[var(--tommy-text)]">{{ item.course.name }}</p>
              <p class="mt-1 text-xs text-[var(--tommy-text-secondary)]">
                当前：{{ item.match ? (item.match.matchTargetType === "group" ? "课程组匹配" : "课程匹配") : "未匹配" }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <select
                data-testid="gpa-match-select"
                class="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                :value="selectedMatchTarget(item)"
                @change="setSelectedMatchTarget(item.course.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">选择匹配目标</option>
                <option v-for="course in item.candidates.courses" :key="`course:${course.id}`" :value="`course:${course.id}`">
                  {{ course.name }}（{{ course.credits }} 学分）
                </option>
                <option v-for="group in item.candidates.groups" :key="`group:${group.id}`" :value="`group:${group.id}`">
                  课程组：{{ group.name }}
                </option>
              </select>
              <button
                data-testid="gpa-match-bind"
                class="rounded-xl bg-[var(--tommy-primary)] px-3 py-2 text-sm font-semibold text-white"
                type="button"
                @click="bindSelectedMatch(item)"
              >
                绑定
              </button>
              <button
                data-testid="gpa-match-unbind"
                class="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-[var(--tommy-text)]"
                type="button"
                @click="unbindMatchMutation.mutate(item.course.id)"
              >
                解绑
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-5 lg:grid-cols-[1fr_360px]">
      <article class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 class="text-lg font-bold text-[var(--tommy-text)]">我的课程</h2>
        <p v-if="isLoading" class="mt-4 text-sm text-[var(--tommy-text-secondary)]">正在加载课程...</p>
        <p v-else-if="dashboardErrorMessage" class="mt-4 rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-info)]">{{ dashboardErrorMessage }}</p>
        <p v-else-if="courses.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-[var(--tommy-text-secondary)]">
          还没有课程，先添加一门课程开始计算。
        </p>
        <div v-else data-testid="gpa-course-list" class="mt-4 space-y-3">
          <div v-for="course in courses" :key="course.id" class="rounded-2xl border border-slate-200 p-4">
            <div class="relative flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-[var(--tommy-text)]">{{ course.name }}</p>
                <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">
                  {{ course.term }} · {{ course.credit }} 学分 · {{ course.score }} 分
                </p>
                <p class="mt-2 text-xs text-[var(--tommy-text-secondary)]">
                  {{ course.isRequired ? "必修" : "非必修" }} · {{ course.isFirstAttempt ? "首修" : "非首修" }} · {{ course.isGpaEligible ? "计入 GPA" : "不计入 GPA" }}
                </p>
              </div>
              <div class="relative">
                <button
                  data-testid="gpa-course-actions"
                  class="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-[var(--tommy-text)]"
                  type="button"
                  @click="toggleCourseActions(course.id)"
                >
                  操作
                </button>
                <div
                  v-if="openActionsCourseId === course.id"
                  class="absolute right-0 top-11 z-10 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm shadow-lg"
                >
                  <button data-testid="gpa-course-edit" class="block w-full px-3 py-2 text-left hover:bg-slate-50" type="button" @click="editCourse(course)">
                    编辑
                  </button>
                  <button data-testid="gpa-course-delete" class="block w-full px-3 py-2 text-left text-[var(--tommy-error)] hover:bg-slate-50" type="button" @click="deleteCourse(course.id)">
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>

      <aside ref="formPanel" class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 data-testid="gpa-course-form-title" class="text-lg font-bold text-[var(--tommy-text)]">{{ editingCourseId ? "编辑课程" : "添加课程" }}</h2>
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
