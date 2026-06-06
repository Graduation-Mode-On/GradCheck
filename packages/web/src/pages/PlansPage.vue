<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import { getCurrentProgramPlan, getToken, importProgramPlan, mockUploadProgramPlan } from "../lib/api";
import type { ProgramPlanPreview } from "../schemas/programPlan";

const router = useRouter();
const queryClient = useQueryClient();

if (!getToken()) {
  void router.replace("/login");
}

const selectedFile = ref<File | null>(null);
const preview = ref<ProgramPlanPreview | null>(null);
const message = ref("");
const errorMessage = ref("");
const courseSearch = ref("");
const categoryFilter = ref("all");

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
    await queryClient.invalidateQueries({ queryKey: ["current-program-plan"] });
  },
  onError: (error) => {
    errorMessage.value = error instanceof Error ? error.message : "导入失败";
  }
});

const activePlan = computed(() => preview.value ?? currentQuery.data.value?.plan ?? null);
const categories = computed(() => [
  "all",
  ...new Set((activePlan.value?.planJson.courses ?? []).map((course) => course.category).filter(Boolean) as string[])
]);
const filteredCourses = computed(() => {
  const query = courseSearch.value.trim().toLowerCase();
  return (activePlan.value?.planJson.courses ?? []).filter((course) => {
    const matchesQuery = !query || course.code.toLowerCase().includes(query) || course.name.toLowerCase().includes(query);
    const matchesCategory = categoryFilter.value === "all" || course.category === categoryFilter.value;
    return matchesQuery && matchesCategory;
  });
});

function onFileChange(event: Event) {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}
</script>

<template>
  <AppShell>
    <section class="space-y-4">
      <section class="rounded-3xl bg-white p-5 shadow-sm">
        <p class="text-sm font-semibold text-[var(--tommy-primary)]">培养方案</p>
        <h1 class="mt-1 text-2xl font-bold text-[var(--tommy-text)]">上传并导入培养方案</h1>
        <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">
          当前使用 pdf-extract 示例 JSON 模拟解析结果，真实 PDF 解析会在后续接入。
        </p>
      </section>

      <section v-if="currentQuery.data.value?.plan" class="rounded-3xl bg-white p-5 shadow-sm">
        <p class="text-sm font-semibold text-[var(--tommy-success)]">当前绑定方案</p>
        <h2 class="mt-1 text-xl font-bold text-[var(--tommy-text)]">
          {{ currentQuery.data.value.plan.grade }} {{ currentQuery.data.value.plan.major }}
        </h2>
        <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
          {{ currentQuery.data.value.plan.school }} · {{ currentQuery.data.value.plan.college }} · 总学分 {{ currentQuery.data.value.plan.totalCredits }}
        </p>
      </section>

      <section class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 class="text-lg font-bold text-[var(--tommy-text)]">1. 上传 PDF</h2>
        <input data-testid="program-plan-file" class="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2" type="file" accept=".pdf,application/pdf" @change="onFileChange" />
        <button
          data-testid="program-plan-mock-upload"
          class="mt-4 w-full rounded-xl bg-[var(--tommy-primary)] px-4 py-2.5 text-sm font-semibold text-white"
          type="button"
          @click="uploadMutation.mutate()"
        >
          模拟解析
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
            <p class="text-xs text-[var(--tommy-text-secondary)]">课程数</p>
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
          <h2 class="text-lg font-bold text-[var(--tommy-text)]">2. 预览解析结果</h2>
          <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">
            {{ activePlan.school }} · {{ activePlan.college }} · {{ activePlan.grade }} · {{ activePlan.major }}
          </p>

          <div class="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
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
            <h3 class="font-bold text-[var(--tommy-text)]">毕业要求</h3>
            <div class="mt-2 grid gap-2">
              <p v-for="requirement in activePlan.planJson.requirements" :key="requirement.id" class="rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                {{ requirement.title }}
              </p>
            </div>
          </div>
        </section>

        <section class="rounded-3xl bg-white p-5 shadow-sm">
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
      </section>
    </section>
  </AppShell>
</template>
