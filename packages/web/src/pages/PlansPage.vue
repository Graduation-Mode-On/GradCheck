<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import { getCurrentProgramPlan, getToken, importProgramPlan, mockUploadProgramPlan } from "../lib/api";
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
const courseSearch = ref("");
const categoryFilter = ref("all");
const semesterFilter = ref("all");
const isReimporting = ref(false);

const currentQuery = useQuery({
  queryKey: ["current-program-plan"],
  queryFn: getCurrentProgramPlan,
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

const boundPlan = computed(() => currentQuery.data.value?.plan ?? null);
const activePlan = computed(() => preview.value ?? boundPlan.value);
const showImportFlow = computed(() => !boundPlan.value || isReimporting.value || Boolean(preview.value));
const uploadTitle = computed(() => (boundPlan.value ? "重新导入培养方案" : "首次导入培养方案"));
const displayTitle = computed(() => (preview.value ? "解析预览" : "我的培养方案"));
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

function startReimport() {
  isReimporting.value = true;
  preview.value = null;
  message.value = "";
  errorMessage.value = "";
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
        <span class="rounded-full bg-white/20 px-3 py-1">{{ preview ? "待确认导入" : "当前绑定方案" }}</span>
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

    <section v-if="showImportFlow" class="rounded-3xl bg-white p-5 shadow-sm">
      <h2 class="text-lg font-bold text-[var(--tommy-text)]">{{ uploadTitle }}</h2>
      <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">当前使用 pdf-extract 示例 JSON 模拟解析结果，真实 PDF 解析会在后续接入。</p>
      <input data-testid="program-plan-file" class="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2" type="file" accept=".pdf,application/pdf" @change="onFileChange" />
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

          <div class="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
            <input
              v-model="courseSearch"
              data-testid="program-course-search"
              class="rounded-xl border border-slate-300 px-3 py-2"
              placeholder="搜索课程名或课程号"
            />
            <select
              v-model="categoryFilter"
              data-testid="program-course-category"
              class="rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="all">全部类别</option>
              <option v-for="category in categories.filter((item) => item !== 'all')" :key="category" :value="category">
                {{ category }}
              </option>
            </select>
            <select
              v-model="semesterFilter"
              data-testid="program-course-semester"
              class="rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="all">全部学期</option>
              <option v-for="semester in semesterOptions" :key="semester.value" :value="semester.value">
                {{ semester.label }}
              </option>
            </select>
          </div>

          <div class="mt-4 grid gap-3 md:grid-cols-2">
            <article v-for="course in filteredCourses" :key="course.code" class="rounded-2xl border border-slate-200 p-4">
              <h3 class="font-bold text-[var(--tommy-text)]">{{ course.name }}</h3>
              <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">
                {{ course.code }} · {{ course.credits }} 学分 · {{ course.category ?? "未分类" }}
              </p>
            </article>
          </div>

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
          <h2 class="text-lg font-bold text-[var(--tommy-text)]">3. 确认导入</h2>
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
