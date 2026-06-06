<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, reactive, ref, watchEffect } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import RequirementProgressCard from "../components/RequirementProgressCard.vue";
import { getLecturePracticeProgress, getToken, updateLecturePracticeProgress } from "../lib/api";
import {
  decimalToFixedText,
  lecturePracticeCompleted,
  lecturePracticeProgressSchema,
  socialPracticeStatus
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

function updateCount(key: "humanLectureCount" | "bookReportCount" | "socialPracticeCourseCount", value: string) {
  form[key] = Math.max(0, Math.floor(Number(value || 0)));
}

function updateCredits(value: string) {
  form.socialPracticeCredits = String(Math.max(0, Number(value || 0)));
}

function countStatus(value: number, target: number) {
  return value >= target ? "已完成" : `还差 ${target - value}`;
}
</script>

<template>
  <AppShell>
    <section class="space-y-4">
      <div class="rounded-3xl bg-white p-5 shadow-sm">
        <p class="text-sm font-semibold text-[var(--tommy-primary)]">讲座实践</p>
        <h1 class="mt-1 text-2xl font-bold text-[var(--tommy-text)]">讲座实践进度</h1>
        <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">
          {{ completed ? "已满足毕业要求" : `还差 ${missingItems} 项要求` }}
        </p>
      </div>

      <p v-if="mutation.error.value" class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-error)]">
        {{ mutation.error.value instanceof Error ? mutation.error.value.message : "保存失败" }}
      </p>

      <div class="grid gap-4 md:grid-cols-2">
        <RequirementProgressCard
          field-key="humanLectureCount"
          title="人文讲座"
          :value="String(form.humanLectureCount)"
          target-text="8 次"
          unit="次"
          :status-text="countStatus(form.humanLectureCount, 8)"
          :missing-text="form.humanLectureCount >= 8 ? '人文讲座已满足毕业要求' : `还差 ${8 - form.humanLectureCount} 次人文讲座`"
          :saved="savedField === 'humanLectureCount'"
          @update-value="updateCount('humanLectureCount', $event)"
          @save="saveProgress('humanLectureCount')"
        />
        <RequirementProgressCard
          field-key="bookReportCount"
          title="读书报告"
          :value="String(form.bookReportCount)"
          target-text="2 次"
          unit="次"
          :status-text="countStatus(form.bookReportCount, 2)"
          :missing-text="form.bookReportCount >= 2 ? '读书报告已满足毕业要求' : `还差 ${2 - form.bookReportCount} 次读书报告`"
          :saved="savedField === 'bookReportCount'"
          @update-value="updateCount('bookReportCount', $event)"
          @save="saveProgress('bookReportCount')"
        />
        <RequirementProgressCard
          field-key="socialPracticeCredits"
          title="社会实践学分"
          :value="String(Number(form.socialPracticeCredits))"
          target-text="1 学分"
          unit="学分"
          :step="0.1"
          :status-text="Number(form.socialPracticeCredits) >= 1 ? '已及格' : '未及格'"
          :missing-text="socialPracticeStatus(form.socialPracticeCredits)"
          :saved="savedField === 'socialPracticeCredits'"
          @update-value="updateCredits"
          @save="saveProgress('socialPracticeCredits')"
        />
        <RequirementProgressCard
          field-key="socialPracticeCourseCount"
          title="社会实践公开课"
          :value="String(form.socialPracticeCourseCount)"
          target-text="1 次"
          unit="次"
          :status-text="countStatus(form.socialPracticeCourseCount, 1)"
          :missing-text="form.socialPracticeCourseCount >= 1 ? '公开课已满足毕业要求' : '还差 1 次社会实践公开课'"
          :saved="savedField === 'socialPracticeCourseCount'"
          @update-value="updateCount('socialPracticeCourseCount', $event)"
          @save="saveProgress('socialPracticeCourseCount')"
        />
      </div>
    </section>
  </AppShell>
</template>
