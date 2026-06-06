<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import { bindProgramPlan, getCurrentProgramPlan, getToken, importProgramPlan, listReusableProgramPlans, mockUploadProgramPlan } from "../lib/api";
import type { ProgramCourse, ProgramPlanPreview } from "../schemas/programPlan";

const router = useRouter();
const queryClient = useQueryClient();
const gradeOrder = ["一", "二", "三", "四"];

if (!getToken()) {
  void router.replace("/login");
}

const selectedFile = ref<File | null>(null);
const preview = ref<ProgramPlanPreview | null>(null);
const message = ref("");
const errorMessage = ref("");
const importPanel = ref<HTMLElement | null>(null);
const courseSearch = ref("");
const categoryFilter = ref("all");
const semesterFilter = ref("all");
const coursesExpanded = ref(false);
const isReimporting = ref(false);

const currentQuery = useQuery({
  queryKey: ["current-program-plan"],
  queryFn: getCurrentProgramPlan,
  enabled: Boolean(getToken())
});
const reusablePlansQuery = useQuery({
  queryKey: ["reusable-program-plans"],
  queryFn: listReusableProgramPlans,
  enabled: Boolean(getToken())
});

const uploadMutation = useMutation({
  mutationFn: async () => {
    if (!selectedFile.value) throw new Error("请选择 PDF 文件");
    return mockUploadProgramPlan(selectedFile.value);
  },
  onSuccess: (response) => {
    preview.value = response.preview;
    message.value = "示例解析已完成";
    errorMessage.value = "";
  },
  onError: (error) => {
    errorMessage.value = error instanceof Error ? error.message : "模拟解析失败";
  }
});

const importMutation = useMutation({
  mutationFn: async () => {
    if (!preview.value) throw new Error("请先完成解析预览");
    return importProgramPlan({ sourceFilename: preview.value.sourceFilename, planJson: preview.value.planJson });
  },
  onSuccess: async () => {
    message.value = "已导入并绑定为我的培养方案";
    preview.value = null;
    selectedFile.value = null;
    isReimporting.value = false;
    await queryClient.invalidateQueries({ queryKey: ["current-program-plan"] });
  },
  onError: (error) => {
    errorMessage.value = error instanceof Error ? error.message : "导入失败";
  }
});
const bindExistingMutation = useMutation({
  mutationFn: (planId: string) => bindProgramPlan(planId),
  onSuccess: async () => {
    message.value = "已绑定同专业年级培养方案";
    isReimporting.value = false;
    preview.value = null;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["current-program-plan"] }),
      queryClient.invalidateQueries({ queryKey: ["reusable-program-plans"] })
    ]);
  },
  onError: (error) => {
    errorMessage.value = error instanceof Error ? error.message : "绑定培养方案失败";
  }
});

const boundPlan = computed(() => currentQuery.data.value?.plan ?? null);
const reusablePlans = computed(() => (reusablePlansQuery.data.value?.plans ?? []).filter((plan) => plan.id !== boundPlan.value?.id));
const activePlan = computed(() => preview.value ?? boundPlan.value);
const showImportFlow = computed(() => !boundPlan.value || isReimporting.value || Boolean(preview.value));
const uploadTitle = computed(() => (boundPlan.value ? "重新导入培养方案" : "首次导入培养方案"));
const displayTitle = computed(() => (preview.value ? "解析预览" : "我的培养方案"));
const selectedFileName = computed(() => selectedFile.value?.name ?? "未选择文件");
const categories = computed(() => [
  "all",
  ...new Set((activePlan.value?.planJson.courses ?? []).map((course) => course.category).filter(Boolean) as string[])
]);
const semesterOptions = computed(() => {
  const options = new Map<string, string>();
  for (const course of activePlan.value?.planJson.courses ?? []) {
    const year = course.term?.year;
    const semester = course.term?.semester;
    if (!year || !semester) continue;
    const key = getSemesterKey(course);
    options.set(key, `${year}年级第${semester}学期`);
  }
  return [...options.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => compareSemesterValues(left.value, right.value));
});
const filteredCourses = computed(() => {
  const query = courseSearch.value.trim().toLowerCase();
  return (activePlan.value?.planJson.courses ?? []).filter((course) => {
    const matchesQuery = !query || course.code.toLowerCase().includes(query) || course.name.toLowerCase().includes(query);
    const matchesCategory = categoryFilter.value === "all" || course.category === categoryFilter.value;
    const matchesSemester = semesterFilter.value === "all" || getSemesterKey(course) === semesterFilter.value;
    return matchesQuery && matchesCategory && matchesSemester;
  });
});
const displayedCourses = computed(() => (coursesExpanded.value ? filteredCourses.value : filteredCourses.value.slice(0, 3)));

watch([courseSearch, categoryFilter, semesterFilter], () => {
  coursesExpanded.value = false;
});

function getSemesterKey(course: ProgramCourse) {
  return `${course.term?.year ?? ""}-${course.term?.semester ?? ""}`;
}

function compareSemesterValues(left: string, right: string) {
  const [leftYear, leftSemester = ""] = left.split("-");
  const [rightYear, rightSemester = ""] = right.split("-");
  const leftGradeIndex = gradeOrder.indexOf(leftYear);
  const rightGradeIndex = gradeOrder.indexOf(rightYear);
  const normalizedLeftGrade = leftGradeIndex === -1 ? gradeOrder.length : leftGradeIndex;
  const normalizedRightGrade = rightGradeIndex === -1 ? gradeOrder.length : rightGradeIndex;

  if (normalizedLeftGrade !== normalizedRightGrade) {
    return normalizedLeftGrade - normalizedRightGrade;
  }

  return Number(leftSemester) - Number(rightSemester);
}

function onFileChange(event: Event) {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

async function startReimport() {
  isReimporting.value = true;
  preview.value = null;
  message.value = "";
  errorMessage.value = "";
  await nextTick();
  importPanel.value?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}
</script>

<template>
  <AppShell>
    <section class="space-y-4">
    <section
      v-if="activePlan"
      class="overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--tommy-primary)] to-[color-mix(in_srgb,var(--tommy-primary)_72%,#7dd3fc)] p-5 text-white shadow-sm"
    >
      <p class="text-sm font-semibold text-white/80">培养方案</p>
      <h1 class="mt-1 text-2xl font-bold">{{ displayTitle }}</h1>
      <p class="mt-2 text-sm leading-6 text-white/85">
        {{ activePlan.school }} · {{ activePlan.college }} · {{ activePlan.grade }} · {{ activePlan.major }}
      </p>
      <div class="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span class="rounded-full bg-white/20 px-3 py-1">总学分 {{ activePlan.totalCredits }}</span>
        <span class="rounded-full bg-white/20 px-3 py-1">{{ activePlan.courseCount }} 门课程</span>
      </div>
    </section>

    <section v-else class="rounded-3xl bg-white p-5 shadow-sm">
      <p class="text-sm font-semibold text-[var(--tommy-primary)]">培养方案</p>
      <h1 class="mt-1 text-2xl font-bold text-[var(--tommy-text)]">上传并导入培养方案</h1>
      <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">
        第一次使用时上传 PDF 并解析导入；后续会默认展示已绑定的培养方案。
      </p>
    </section>

    <section v-if="showImportFlow" ref="importPanel" class="scroll-mt-24 rounded-3xl bg-white p-5 shadow-sm">
      <h2 class="text-lg font-bold text-[var(--tommy-text)]">{{ uploadTitle }}</h2>
      <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">可以直接使用同专业同年级已上传的培养方案；没有合适方案时再上传 PDF。</p>
      <div v-if="reusablePlans.length > 0" data-testid="program-plan-reusable-list" class="mt-4 space-y-3">
        <article v-for="plan in reusablePlans" :key="plan.id" class="rounded-2xl border border-slate-200 p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="font-bold text-[var(--tommy-text)]">{{ plan.major }} · {{ plan.grade }}</h3>
              <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">
                {{ plan.school }} · {{ plan.college ?? "未标注学院" }} · {{ plan.courseCount }} 门课程 · 总学分 {{ plan.totalCredits ?? "未知" }}
              </p>
            </div>
            <button
              data-testid="program-plan-bind-existing"
              class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              type="button"
              @click="bindExistingMutation.mutate(plan.id ?? '')"
            >
              直接使用
            </button>
          </div>
        </article>
      </div>
      <div class="mt-4 flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
        <label
          class="shrink-0 cursor-pointer rounded-lg border border-[color-mix(in_srgb,var(--tommy-primary)_28%,white)] bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-4 py-2 text-sm font-semibold text-[var(--tommy-primary)] transition hover:bg-[color-mix(in_srgb,var(--tommy-primary)_18%,white)]"
          for="program-plan-file"
        >
          选择文件
        </label>
        <input
          id="program-plan-file"
          data-testid="program-plan-file"
          class="sr-only"
          type="file"
          accept=".pdf,application/pdf"
          @change="onFileChange"
        />
        <span
          class="min-w-0 flex-1 truncate px-2 text-sm"
          :class="selectedFile ? 'text-[var(--tommy-text)]' : 'text-[var(--tommy-text-secondary)]'"
        >
          {{ selectedFileName }}
        </span>
      </div>
      <button
        data-testid="program-plan-mock-upload"
        class="mt-4 w-full rounded-xl bg-[var(--tommy-primary)] px-4 py-2.5 text-sm font-semibold text-white"
        type="button"
        @click="uploadMutation.mutate()"
      >
        解析
      </button>
    </section>

      <p v-if="message" class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-success)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-success)]">
        {{ message }}
      </p>
      <p v-if="errorMessage" class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-error)]">
        {{ errorMessage }}
      </p>

      <section v-if="activePlan" class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-4">
          <article class="rounded-3xl bg-white p-4 shadow-sm">
            <p class="text-xs text-[var(--tommy-text-secondary)]">总学分</p>
            <strong class="mt-1 block text-2xl text-[var(--tommy-primary)]">{{ activePlan.totalCredits }}</strong>
          </article>
          <article class="rounded-3xl bg-white p-4 shadow-sm">
            <p class="text-xs text-[var(--tommy-text-secondary)]">课程总览</p>
            <strong class="mt-1 block text-2xl text-[var(--tommy-primary)]">{{ activePlan.courseCount }} 门课程</strong>
          </article>
          <article class="rounded-3xl bg-white p-4 shadow-sm">
            <p class="text-xs text-[var(--tommy-text-secondary)]">毕业规则</p>
            <strong class="mt-1 block text-2xl text-[var(--tommy-primary)]">{{ activePlan.requirementCount }} 条规则</strong>
          </article>
          <article class="rounded-3xl bg-white p-4 shadow-sm">
            <p class="text-xs text-[var(--tommy-text-secondary)]">解析警告</p>
            <strong class="mt-1 block text-2xl text-[var(--tommy-primary)]">{{ activePlan.warningCount }}</strong>
          </article>
        </div>

        <section class="rounded-3xl bg-white p-5 shadow-sm">
          <h2 class="text-lg font-bold text-[var(--tommy-text)]">课程总览</h2>
          <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
            按课程名、课程号、类别和学期快速查看培养方案中的课程安排。
          </p>

          <div class="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <input
              v-model="courseSearch"
              data-testid="program-course-search"
              class="min-w-0 rounded-xl border border-slate-300 px-3 py-2"
              placeholder="搜索课程名或课程号"
            />
            <select
              v-model="categoryFilter"
              data-testid="program-course-category"
              class="min-w-0 rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="all">全部类别</option>
              <option v-for="category in categories.filter((item) => item !== 'all')" :key="category" :value="category">
                {{ category }}
              </option>
            </select>
            <select
              v-model="semesterFilter"
              data-testid="program-course-semester"
              class="min-w-0 rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="all">全部学期</option>
              <option v-for="semester in semesterOptions" :key="semester.value" :value="semester.value">
                {{ semester.label }}
              </option>
            </select>
          </div>

          <div class="mt-4 grid gap-3 md:grid-cols-2">
            <article v-for="course in displayedCourses" :key="course.code" class="rounded-2xl border border-slate-200 p-4">
              <h3 class="font-bold text-[var(--tommy-text)]">{{ course.name }}</h3>
              <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">
                {{ course.code }} · {{ course.credits }} 学分 · {{ course.category ?? "未分类" }}
              </p>
            </article>
          </div>

          <button
            v-if="filteredCourses.length > 3"
            class="mt-4 w-full rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-4 py-2.5 text-sm font-semibold text-[var(--tommy-primary)]"
            type="button"
            @click="coursesExpanded = !coursesExpanded"
          >
            {{ coursesExpanded ? "收起课程" : `展开全部 ${filteredCourses.length} 门课程` }}
          </button>

          <div class="mt-5">
            <h3 class="font-bold text-[var(--tommy-text)]">毕业要求清单</h3>
            <div class="mt-2 grid gap-2">
              <p v-for="requirement in activePlan.planJson.requirements" :key="requirement.id" class="rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                {{ requirement.title }}
              </p>
            </div>
          </div>
        </section>

        <section v-if="preview" class="rounded-3xl bg-white p-5 shadow-sm">
          <h2 class="text-lg font-bold text-[var(--tommy-text)]">确认导入</h2>
          <button
            data-testid="program-plan-import"
            class="mt-4 w-full rounded-xl bg-[var(--tommy-primary)] px-4 py-2.5 text-sm font-semibold text-white"
            type="button"
            @click="importMutation.mutate()"
          >
            导入并绑定为我的培养方案
          </button>
        </section>

        <button
          v-else-if="boundPlan && !showImportFlow"
          data-testid="program-plan-reimport"
          class="w-full rounded-2xl border border-dashed border-[var(--tommy-primary)] bg-white px-4 py-3 text-sm font-semibold text-[var(--tommy-primary)]"
          type="button"
          @click="startReimport"
        >
          重新导入培养方案
        </button>
      </section>
    </section>
  </AppShell>
</template>
