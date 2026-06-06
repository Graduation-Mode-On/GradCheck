<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, reactive, ref, watchEffect } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import LecturePracticeCard from "../components/LecturePracticeCard.vue";
import { getToken, getVolunteerLaborProgress, updateVolunteerLaborProgress } from "../lib/api";
import { decimalToFixedText } from "../schemas/lecturePractice";
import { volunteerLaborCompleted, volunteerLaborProgressSchema } from "../schemas/volunteerLabor";

const router = useRouter();
const queryClient = useQueryClient();

if (!getToken()) {
  void router.replace("/login");
}

const form = reactive({
  volunteerHours: "0.00",
  ordinaryLaborCount: 0,
  specialLaborCount: 0
});
const savedField = ref("");
let savedTimer: ReturnType<typeof setTimeout> | null = null;

const query = useQuery({
  queryKey: ["volunteer-labor-progress"],
  queryFn: getVolunteerLaborProgress,
  enabled: Boolean(getToken())
});

watchEffect(() => {
  const progress = query.data.value?.progress;
  if (!progress) return;
  form.volunteerHours = progress.volunteerHours;
  form.ordinaryLaborCount = progress.ordinaryLaborCount;
  form.specialLaborCount = progress.specialLaborCount;
});

const mutation = useMutation({
  mutationFn: async () =>
    updateVolunteerLaborProgress(
      volunteerLaborProgressSchema.parse({
        ...form,
        volunteerHours: decimalToFixedText(form.volunteerHours)
      })
    ),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["volunteer-labor-progress"] });
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

const completed = computed(() => volunteerLaborCompleted(form));
const missingItems = computed(() =>
  [Number(form.volunteerHours) >= 12, form.ordinaryLaborCount >= 2, form.specialLaborCount >= 1].filter((item) => !item)
    .length
);

function updateHoursAndSave(value: string) {
  form.volunteerHours = String(Math.max(0, Number(value || 0)));
  saveProgress("volunteerHours");
}

function updateCountAndSave(key: "ordinaryLaborCount" | "specialLaborCount", value: string) {
  form[key] = Math.max(0, Math.floor(Number(value || 0)));
  saveProgress(key);
}
</script>

<template>
  <AppShell>
    <section class="space-y-4">
      <!-- 模块说明 Banner -->
      <div
        class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[color-mix(in_srgb,var(--tommy-primary)_8%,white)] to-[color-mix(in_srgb,var(--tommy-info)_4%,white)] p-6 shadow-sm border border-[color-mix(in_srgb,var(--tommy-primary)_10%,white)]"
      >
        <!-- 装饰背景圆圈 -->
        <div class="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--tommy-primary)]/5" />
        <div class="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-[var(--tommy-info)]/5" />

        <div class="relative flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <!-- 装饰图标 -->
              <div
                class="flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)]"
              >
                <svg
                  class="h-5 w-5 text-[var(--tommy-primary)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
                  <path d="M12 8v4l3 3" />
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <span class="text-xs font-semibold uppercase tracking-wider text-[var(--tommy-primary)]">志愿劳育</span>
            </div>

            <h1 class="mt-3 text-2xl font-bold text-[var(--tommy-text)]">志愿劳育进度</h1>
            <p class="mt-1.5 text-sm leading-relaxed text-[var(--tommy-text-secondary)]">
              记录志愿服务时长、普通生产劳动和特色劳动完成情况，追踪毕业要求
            </p>
          </div>

          <!-- 统计数字 -->
          <div class="shrink-0 text-right">
            <div class="text-3xl font-bold text-[var(--tommy-primary)]">
              {{ missingItems }}
            </div>
            <div class="mt-0.5 text-xs text-[var(--tommy-text-secondary)]">
              {{ completed ? "全部达标" : `待完成项` }}
            </div>
          </div>
        </div>
      </div>

      <p
        v-if="mutation.error.value"
        class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-error)]"
      >
        {{ mutation.error.value instanceof Error ? mutation.error.value.message : "保存失败" }}
      </p>

      <div class="grid gap-4 md:grid-cols-2">
        <LecturePracticeCard
          field-key="volunteerHours"
          title="志愿活动时长"
          icon="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 8v4l3 3"
          variant="gauge"
          simple
          :current="Number(form.volunteerHours)"
          :target="12"
          unit="小时"
          :step="0.5"
          :saved="savedField === 'volunteerHours'"
          @update-value="updateHoursAndSave"
        />
        <LecturePracticeCard
          field-key="ordinaryLaborCount"
          title="普通生产劳动"
          icon="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
          variant="dots"
          :current="form.ordinaryLaborCount"
          :target="2"
          unit="次"
          :saved="savedField === 'ordinaryLaborCount'"
          @update-value="updateCountAndSave('ordinaryLaborCount', $event)"
        />
        <LecturePracticeCard
          field-key="specialLaborCount"
          title="特色劳动"
          icon="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
          variant="toggle"
          :current="form.specialLaborCount"
          :target="1"
          unit="次"
          :saved="savedField === 'specialLaborCount'"
          @update-value="updateCountAndSave('specialLaborCount', $event)"
        />
      </div>
    </section>
  </AppShell>
</template>
