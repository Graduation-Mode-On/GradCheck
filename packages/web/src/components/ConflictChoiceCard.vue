<script setup lang="ts">
import { computed } from "vue";

import type { CourseConflict, RecommendedCourse } from "../lib/api";

const props = defineProps<{
  conflict: CourseConflict;
  modelValue: "incoming" | "existing";
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: "incoming" | "existing"): void;
}>();

const isIncoming = computed(() => props.modelValue === "incoming");
const isExisting = computed(() => props.modelValue === "existing");

const dayMap = ["", "一", "二", "三", "四", "五", "六", "日"];

function formatSchedule(course: RecommendedCourse): string {
  return course.schedule
    .map((slot) => {
      const week =
        slot.weekLabel ??
        (slot.startWeek && slot.endWeek ? `${slot.startWeek}-${slot.endWeek}周` : "");
      return `${week ? `${week} ` : ""}周${dayMap[slot.dayOfWeek] ?? slot.dayOfWeek} ${slot.startPeriod}-${slot.endPeriod}节`;
    })
    .join("，");
}

function formatCourseMeta(course: RecommendedCourse): string {
  const parts: string[] = [];
  if (course.teacher) parts.push(course.teacher);
  if (course.classroom) parts.push(course.classroom);
  parts.push(`${course.credits}学分`);
  return parts.join(" · ");
}
</script>

<template>
  <div class="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
    <p class="mb-3 text-sm font-semibold text-amber-800">
      ⚠️ 时间冲突：{{ conflict.reason }}
    </p>

    <div class="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        class="relative rounded-xl border px-4 py-3 text-left transition"
        :class="
          isIncoming
            ? 'border-[var(--tommy-primary)] bg-white ring-1 ring-[var(--tommy-primary)]'
            : 'border-amber-200 bg-white/70 text-slate-600 hover:border-amber-300 hover:bg-white'
        "
        @click="emit('update:modelValue', 'incoming')"
      >
        <span
          class="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border text-xs"
          :class="isIncoming ? 'border-[var(--tommy-primary)] bg-[var(--tommy-primary)] text-white' : 'border-amber-300 bg-white'"
        >
          <svg
            v-if="isIncoming"
            class="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span class="block pr-7 text-xs font-medium text-amber-600">改选新课程</span>
        <span class="mt-1 block pr-7 text-sm font-semibold text-slate-800">{{ conflict.incoming.courseName }}</span>
        <span class="mt-1 block pr-7 text-xs text-slate-500">{{ formatCourseMeta(conflict.incoming) }}</span>
        <span class="mt-1 block pr-7 text-xs text-slate-400">{{ formatSchedule(conflict.incoming) }}</span>
      </button>

      <button
        type="button"
        class="relative rounded-xl border px-4 py-3 text-left transition"
        :class="
          isExisting
            ? 'border-[var(--tommy-primary)] bg-white ring-1 ring-[var(--tommy-primary)]'
            : 'border-amber-200 bg-white/70 text-slate-600 hover:border-amber-300 hover:bg-white'
        "
        @click="emit('update:modelValue', 'existing')"
      >
        <span
          class="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border text-xs"
          :class="isExisting ? 'border-[var(--tommy-primary)] bg-[var(--tommy-primary)] text-white' : 'border-amber-300 bg-white'"
        >
          <svg
            v-if="isExisting"
            class="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span class="block pr-7 text-xs font-medium text-amber-600">保留已选课程</span>
        <span
          v-for="course in conflict.existing"
          :key="course.courseName"
          class="mt-2 block pr-7 first:mt-1"
        >
          <span class="block text-sm font-semibold text-slate-800">{{ course.courseName }}</span>
          <span class="block text-xs text-slate-500">{{ formatCourseMeta(course) }}</span>
          <span class="block text-xs text-slate-400">{{ formatSchedule(course) }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
