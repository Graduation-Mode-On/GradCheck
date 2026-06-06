<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, reactive, ref, watchEffect } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import LecturePracticeCard from "../components/LecturePracticeCard.vue";
import { getLecturePracticeProgress, getToken, updateLecturePracticeProgress } from "../lib/api";
import {
  decimalToFixedText,
  lecturePracticeCompleted,
  lecturePracticeProgressSchema
} from "../schemas/lecturePractice";

const router = useRouter();
const queryClient = useQueryClient();

if (!getToken()) {
  void router.replace("/login");
}

const form = reactive({
  humanLectureCount: 0,
  bookReportCount: 0,
  socialPracticeCredits: "0.00",
  socialPracticeCourseCount: 0
});
const savedField = ref("");
let savedTimer: ReturnType<typeof setTimeout> | null = null;

const query = useQuery({
  queryKey: ["lecture-practice-progress"],
  queryFn: getLecturePracticeProgress,
  enabled: Boolean(getToken())
});

watchEffect(() => {
  const progress = query.data.value?.progress;
  if (!progress) return;
  form.humanLectureCount = progress.humanLectureCount;
  form.bookReportCount = progress.bookReportCount;
  form.socialPracticeCredits = progress.socialPracticeCredits;
  form.socialPracticeCourseCount = progress.socialPracticeCourseCount;
});

const mutation = useMutation({
  mutationFn: async () =>
    updateLecturePracticeProgress(
      lecturePracticeProgressSchema.parse({
        ...form,
        socialPracticeCredits: decimalToFixedText(form.socialPracticeCredits)
      })
    ),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["lecture-practice-progress"] });
  }
});

function markSaved(fieldKey: string) {
  savedField.value = fieldKey;
  if (savedTimer) clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    savedField.value = "";
  }, 1000);
}

function saveProgress(fieldKey: string) {
  mutation.mutate(undefined, {
    onSuccess: () => markSaved(fieldKey)
  });
}

const completed = computed(() => lecturePracticeCompleted(form));
const missingItems = computed(() =>
  [
    form.humanLectureCount >= 8,
    form.bookReportCount >= 2,
    Number(form.socialPracticeCredits) >= 1,
    form.socialPracticeCourseCount >= 1
  ].filter((item) => !item).length
);

function updateCountAndSave(key: "humanLectureCount" | "bookReportCount" | "socialPracticeCourseCount", value: string) {
  form[key] = Math.max(0, Math.floor(Number(value || 0)));
  saveProgress(key);
}

function updateCreditsAndSave(value: string) {
  form.socialPracticeCredits = String(Math.max(0, Number(value || 0)));
  saveProgress("socialPracticeCredits");
}

</script>

<template>
  <AppShell>
    <section class="space-y-4">
      <!-- 模块说明 Banner -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[color-mix(in_srgb,var(--tommy-primary)_8%,white)] to-[color-mix(in_srgb,var(--tommy-info)_4%,white)] p-6 shadow-sm border border-[color-mix(in_srgb,var(--tommy-primary)_10%,white)]">
        <!-- 装饰背景圆圈 -->
        <div class="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--tommy-primary)]/5" />
        <div class="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-[var(--tommy-info)]/5" />

        <div class="relative flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <!-- 装饰图标 -->
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)]">
                <svg class="h-5 w-5 text-[var(--tommy-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 14a4 4 0 0 0 4-4V5a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4Zm-7-4a7 7 0 0 0 14 0M12 17v4M8 21h8" />
                </svg>
              </div>
              <span class="text-xs font-semibold uppercase tracking-wider text-[var(--tommy-primary)]">讲座实践</span>
            </div>

            <h1 class="mt-3 text-2xl font-bold text-[var(--tommy-text)]">
              讲座实践进度
            </h1>
            <p class="mt-1.5 text-sm leading-relaxed text-[var(--tommy-text-secondary)]">
              记录人文讲座、读书报告、社会实践学分等完成情况，追踪毕业要求
            </p>
          </div>

          <!-- 统计数字 -->
          <div class="shrink-0 text-right">
            <div class="text-3xl font-bold text-[var(--tommy-primary)]">
              {{ missingItems }}
            </div>
            <div class="mt-0.5 text-xs text-[var(--tommy-text-secondary)]">
              {{ completed ? '全部达标' : `待完成项` }}
            </div>
          </div>
        </div>
      </div>

      <p v-if="mutation.error.value" class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-error)]">
        {{ mutation.error.value instanceof Error ? mutation.error.value.message : "保存失败" }}
      </p>

      <div class="grid gap-4 md:grid-cols-2">
        <LecturePracticeCard
          field-key="humanLectureCount"
          title="人文讲座"
          icon="M12 14a4 4 0 0 0 4-4V5a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4Zm-7-4a7 7 0 0 0 14 0M12 17v4M8 21h8"
          variant="dots"
          :current="form.humanLectureCount"
          :target="8"
          unit="次"
          :saved="savedField === 'humanLectureCount'"
          @update-value="updateCountAndSave('humanLectureCount', $event)"
        />
        <LecturePracticeCard
          field-key="bookReportCount"
          title="读书报告"
          icon="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
          variant="dots"
          :current="form.bookReportCount"
          :target="2"
          unit="次"
          :saved="savedField === 'bookReportCount'"
          @update-value="updateCountAndSave('bookReportCount', $event)"
        />
        <LecturePracticeCard
          field-key="socialPracticeCredits"
          title="社会实践学分"
          icon="M12 2a4 4 0 0 0-4 4c0 2.5 2 3.5 4 6 2-2.5 4-3.5 4-6a4 4 0 0 0-4-4zM6 22l6-3 6 3v-5l-6 3-6-3v5z"
          variant="gauge"
          :current="Number(form.socialPracticeCredits)"
          :target="1"
          unit="学分"
          :step="0.1"
          :saved="savedField === 'socialPracticeCredits'"
          @update-value="updateCreditsAndSave($event)"
        />
        <LecturePracticeCard
          field-key="socialPracticeCourseCount"
          title="社会实践公开课"
          icon="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
          variant="toggle"
          :current="form.socialPracticeCourseCount"
          :target="1"
          unit="次"
          :saved="savedField === 'socialPracticeCourseCount'"
          @update-value="updateCountAndSave('socialPracticeCourseCount', $event)"
        />
      </div>
    </section>
  </AppShell>
</template>
