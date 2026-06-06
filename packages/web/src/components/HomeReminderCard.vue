<script setup lang="ts">
import type { Reminder } from "../lib/api";

defineProps<{
  reminders: Reminder[];
  pendingCount: number;
  onComplete: (id: string) => void;
}>();

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function rowColor(reminder: Reminder): string {
  const now = Date.now();
  const due = new Date(reminder.dueAt).getTime();
  if (due < now) return "text-[var(--tommy-error)]";
  if (due - now < 24 * 60 * 60 * 1000) return "text-[var(--tommy-warning)]";
  return "text-[var(--tommy-text-secondary)]";
}
</script>

<template>
  <RouterLink
    to="/reminders"
    data-testid="home-reminder-card"
    class="block rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-bold text-[var(--tommy-text)]">提醒事项</h2>
        <p
          data-testid="home-reminder-count"
          class="mt-1 text-3xl font-bold text-[var(--tommy-primary)]"
        >
          {{ pendingCount }}
        </p>
      </div>
      <span class="text-xs font-semibold text-[var(--tommy-info)]">查看全部 &gt;</span>
    </div>

    <div v-if="reminders.length" class="mt-4 space-y-3">
      <div
        v-for="reminder in reminders"
        :key="reminder.id"
        :data-testid="`home-reminder-row-${reminder.id}`"
        class="flex items-start gap-3"
      >
        <button
          :data-testid="`home-complete-${reminder.id}`"
          :aria-label="`标记完成 ${reminder.title}`"
          class="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-[var(--tommy-primary)] bg-white"
          type="button"
          @click.prevent.stop="onComplete(reminder.id)"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-[var(--tommy-text)]">{{ reminder.title }}</p>
          <p class="mt-0.5 truncate text-xs" :class="rowColor(reminder)">
            {{ formatDate(reminder.dueAt) }}
            <span v-if="reminder.location"> · {{ reminder.location }}</span>
          </p>
        </div>
      </div>
    </div>

    <p v-else class="mt-4 text-sm text-[var(--tommy-text-secondary)]">暂无待办提醒</p>
  </RouterLink>
</template>
