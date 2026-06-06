<script setup lang="ts">
import type { Reminder } from "../lib/api";

defineProps<{
  reminder: Reminder;
  updating?: boolean;
}>();

const emit = defineEmits<{
  (event: "complete", reminder: Reminder): void;
  (event: "snooze", reminder: Reminder): void;
  (event: "edit", reminder: Reminder): void;
  (event: "toggleHome", reminder: Reminder): void;
  (event: "toggleSms", reminder: Reminder): void;
  (event: "duplicate", reminder: Reminder): void;
  (event: "delete", reminder: Reminder): void;
}>();

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function offsetLabel(offset: number): string {
  if (offset === 0) return "到点";
  if (offset % 1440 === 0) return `提前 ${offset / 1440} 天`;
  if (offset % 60 === 0) return `提前 ${offset / 60} 小时`;
  return `提前 ${offset} 分钟`;
}
</script>

<template>
  <article
    :data-testid="`reminder-item-${reminder.id}`"
    class="rounded-3xl bg-white p-5 shadow-sm"
    :class="reminder.status === 'done' ? 'opacity-60' : ''"
  >
    <div class="flex items-start gap-3">
      <button
        :data-testid="`complete-${reminder.id}`"
        :aria-label="reminder.status === 'done' ? '撤销完成' : '标记完成'"
        class="mt-1 h-6 w-6 shrink-0 rounded-full border-2 transition"
        :class="reminder.status === 'done' ? 'border-[var(--tommy-success)] bg-[var(--tommy-success)]' : 'border-slate-300'"
        type="button"
        :disabled="updating"
        @click="emit('complete', reminder)"
      />
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-base font-bold text-[var(--tommy-text)] sm:text-lg">{{ reminder.title }}</h2>
            <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">
              {{ formatDate(reminder.dueAt) }}
              <span v-if="reminder.location"> · {{ reminder.location }}</span>
            </p>
            <p class="mt-1 text-xs text-[var(--tommy-text-secondary)]">
              <span v-for="(offset, index) in reminder.reminderOffsets" :key="offset">
                {{ offsetLabel(offset) }}<span v-if="index < reminder.reminderOffsets.length - 1">、</span>
              </span>
            </p>
          </div>
          <span class="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--tommy-text-secondary)]">
            {{ reminder.category }}
          </span>
        </div>
        <p v-if="reminder.notes" class="mt-3 text-sm leading-6 text-[var(--tommy-text-secondary)]">{{ reminder.notes }}</p>
        <div :data-testid="`reminder-actions-${reminder.id}`" class="mt-4 flex flex-nowrap gap-1.5 overflow-x-auto pb-1">
          <button
            :data-testid="`snooze-${reminder.id}`"
            class="shrink-0 rounded-full border border-slate-200 px-2.5 py-1.5 text-xs disabled:opacity-50"
            type="button"
            :disabled="updating"
            @click="emit('snooze', reminder)"
          >
            延后 1 小时
          </button>
          <button
            :data-testid="`edit-${reminder.id}`"
            class="shrink-0 rounded-full border border-slate-200 px-2.5 py-1.5 text-xs"
            type="button"
            @click="emit('edit', reminder)"
          >
            编辑
          </button>
          <button
            :data-testid="`home-${reminder.id}`"
            class="shrink-0 rounded-full border border-slate-200 px-2.5 py-1.5 text-xs disabled:opacity-50"
            type="button"
            :disabled="updating"
            @click="emit('toggleHome', reminder)"
          >
            {{ reminder.showOnHome ? "取消首页" : "首页展示" }}
          </button>
          <button
            :data-testid="`sms-${reminder.id}`"
            class="shrink-0 rounded-full border border-slate-200 px-2.5 py-1.5 text-xs disabled:opacity-50"
            type="button"
            :disabled="updating"
            @click="emit('toggleSms', reminder)"
          >
            {{ reminder.smsEnabled ? "关闭短信" : "短信提醒" }}
          </button>
          <button
            :data-testid="`duplicate-${reminder.id}`"
            class="shrink-0 rounded-full border border-slate-200 px-2.5 py-1.5 text-xs disabled:opacity-50"
            type="button"
            :disabled="updating"
            @click="emit('duplicate', reminder)"
          >
            复制
          </button>
          <button
            :data-testid="`delete-${reminder.id}`"
            class="shrink-0 rounded-full border border-slate-200 px-2.5 py-1.5 text-xs"
            type="button"
            @click="emit('delete', reminder)"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
