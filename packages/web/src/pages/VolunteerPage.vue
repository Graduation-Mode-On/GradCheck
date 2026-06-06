<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, reactive, ref, watchEffect } from "vue";
import { useRouter } from "vue-router";

import AppShell from "../components/AppShell.vue";
import RequirementProgressCard from "../components/RequirementProgressCard.vue";
import { getToken, getVolunteerLaborProgress, updateVolunteerLaborProgress } from "../lib/api";
import { volunteerLaborCompleted, volunteerLaborProgressSchema } from "../schemas/volunteerLabor";
import { decimalToFixedText } from "../schemas/lecturePractice";

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

function updateCount(key: "ordinaryLaborCount" | "specialLaborCount", value: string) {
  form[key] = Math.max(0, Math.floor(Number(value || 0)));
}

function updateHours(value: string) {
  form.volunteerHours = String(Math.max(0, Number(value || 0)));
}

function countStatus(value: number, target: number) {
  return value >= target ? "已完成" : `还差 ${target - value}`;
}
</script>

<template>
  <AppShell>
    <section class="space-y-4">
      <div class="rounded-3xl bg-white p-5 shadow-sm">
        <p class="text-sm font-semibold text-[var(--tommy-primary)]">志愿劳育</p>
        <h1 class="mt-1 text-2xl font-bold text-[var(--tommy-text)]">志愿劳育进度</h1>
        <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">
          {{ completed ? "已满足毕业要求" : `还差 ${missingItems} 项要求` }}
        </p>
      </div>

      <p v-if="mutation.error.value" class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-error)]">
        {{ mutation.error.value instanceof Error ? mutation.error.value.message : "保存失败" }}
      </p>

      <div class="grid gap-4 md:grid-cols-2">
        <RequirementProgressCard
          field-key="volunteerHours"
          title="志愿活动时长"
          :value="String(Number(form.volunteerHours))"
          target-text="12 小时"
          unit="小时"
          :status-text="Number(form.volunteerHours) >= 12 ? '已完成' : `还差 ${12 - Number(form.volunteerHours)}`"
          :missing-text="Number(form.volunteerHours) >= 12 ? '志愿时长已满足毕业要求' : `还差 ${12 - Number(form.volunteerHours)} 小时志愿活动`"
          :saved="savedField === 'volunteerHours'"
          @update-value="updateHours"
          @save="saveProgress('volunteerHours')"
        />
        <RequirementProgressCard
          field-key="ordinaryLaborCount"
          title="普通生产劳动"
          :value="String(form.ordinaryLaborCount)"
          target-text="2 次"
          unit="次"
          :status-text="countStatus(form.ordinaryLaborCount, 2)"
          :missing-text="form.ordinaryLaborCount >= 2 ? '普通生产劳动已满足毕业要求' : `还差 ${2 - form.ordinaryLaborCount} 次普通生产劳动`"
          :saved="savedField === 'ordinaryLaborCount'"
          @update-value="updateCount('ordinaryLaborCount', $event)"
          @save="saveProgress('ordinaryLaborCount')"
        />
        <RequirementProgressCard
          field-key="specialLaborCount"
          title="特色劳动"
          :value="String(form.specialLaborCount)"
          target-text="1 次"
          unit="次"
          :status-text="countStatus(form.specialLaborCount, 1)"
          :missing-text="form.specialLaborCount >= 1 ? '特色劳动已满足毕业要求' : '还差 1 次特色劳动'"
          :saved="savedField === 'specialLaborCount'"
          @update-value="updateCount('specialLaborCount', $event)"
          @save="saveProgress('specialLaborCount')"
        />
      </div>
    </section>
  </AppShell>
</template>
