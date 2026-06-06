<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ZodError } from "zod";

import AppShell from "../components/AppShell.vue";
import ReminderListItem from "../components/ReminderListItem.vue";
import {
  type Reminder,
  completeReminder,
  createReminder,
  deleteReminder,
  duplicateReminder,
  getToken,
  listReminders,
  snoozeReminder,
  updateReminder
} from "../lib/api";
import { reminderInputSchema, type ReminderInput } from "../schemas/reminder";

const router = useRouter();
const queryClient = useQueryClient();

if (!getToken()) {
  void router.replace("/login");
}

type FilterKey = "all" | "today" | "week" | "overdue" | "lab" | "exam" | "custom" | "completed";

const activeFilter = ref<FilterKey>("all");
const message = ref("");
const editingReminderId = ref<string | null>(null);
const updatingIds = ref(new Set<string>());

const filters = [
  { key: "all", label: "全部" },
  { key: "today", label: "今天" },
  { key: "week", label: "本周" },
  { key: "overdue", label: "逾期" },
  { key: "lab", label: "实验" },
  { key: "exam", label: "考试" },
  { key: "custom", label: "自定义" },
  { key: "completed", label: "已完成" }
] as const;

const form = reactive<ReminderInput>(emptyForm());

function emptyForm(): ReminderInput {
  return {
    title: "",
    category: "custom",
    priority: "normal",
    startAt: null,
    dueAt: "",
    location: null,
    notes: null,
    reminderOffsets: [1440, 60],
    smsEnabled: false,
    showOnHome: true
  };
}

const queryParams = computed(() => {
  switch (activeFilter.value) {
    case "today":
      return { range: "today" as const };
    case "week":
      return { range: "week" as const };
    case "overdue":
      return { range: "overdue" as const };
    case "lab":
      return { category: "lab" as const };
    case "exam":
      return { category: "exam" as const };
    case "custom":
      return { category: "custom" as const };
    case "completed":
      return { includeCompleted: true, status: "done" as const };
    default:
      return {};
  }
});

const remindersQueryKey = computed(() => ["reminders", activeFilter.value] as const);

const { data: remindersData } = useQuery({
  queryKey: remindersQueryKey,
  queryFn: () => listReminders(queryParams.value),
  enabled: computed(() => Boolean(getToken()))
});

const saveMutation = useMutation({
  mutationFn: async () => {
    const parsed = reminderInputSchema.parse(toApiInput(form));
    if (editingReminderId.value) {
      return updateReminder(editingReminderId.value, parsed);
    }
    return createReminder(parsed);
  },
  onSuccess: async () => {
    message.value = editingReminderId.value ? "提醒已更新" : "提醒已创建";
    editingReminderId.value = null;
    Object.assign(form, emptyForm());
    await queryClient.invalidateQueries({ queryKey: ["reminders"] });
  },
  onError: (error) => {
    message.value =
      error instanceof ZodError
        ? (error.issues[0]?.message ?? "表单信息不完整")
        : error instanceof Error
          ? error.message
          : "保存失败";
  }
});

function toApiInput(input: ReminderInput): ReminderInput {
  return {
    ...input,
    dueAt: input.dueAt ? toIso(input.dueAt) : "",
    startAt: input.startAt ? toIso(input.startAt) : null
  };
}

function toIso(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function startEdit(reminder: Reminder) {
  editingReminderId.value = reminder.id;
  form.title = reminder.title;
  form.category = reminder.category;
  form.priority = reminder.priority;
  form.startAt = reminder.startAt ? toLocalInput(reminder.startAt) : null;
  form.dueAt = toLocalInput(reminder.dueAt);
  form.location = reminder.location;
  form.notes = reminder.notes;
  form.reminderOffsets = [...reminder.reminderOffsets];
  form.smsEnabled = reminder.smsEnabled;
  form.showOnHome = reminder.showOnHome;
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function cancelEdit() {
  editingReminderId.value = null;
  Object.assign(form, emptyForm());
}

async function withUpdate(id: string, action: () => Promise<unknown>) {
  if (updatingIds.value.has(id)) return;
  updatingIds.value = new Set(updatingIds.value).add(id);
  try {
    await action();
    await queryClient.invalidateQueries({ queryKey: ["reminders"] });
  } finally {
    const next = new Set(updatingIds.value);
    next.delete(id);
    updatingIds.value = next;
  }
}

function handleComplete(reminder: Reminder) {
  void withUpdate(reminder.id, () => completeReminder(reminder.id, reminder.status !== "done"));
}

function handleSnooze(reminder: Reminder) {
  const target = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  void withUpdate(reminder.id, () => snoozeReminder(reminder.id, target));
}

function handleToggleHome(reminder: Reminder) {
  void withUpdate(reminder.id, () => updateReminder(reminder.id, { showOnHome: !reminder.showOnHome }));
}

function handleToggleSms(reminder: Reminder) {
  void withUpdate(reminder.id, () => updateReminder(reminder.id, { smsEnabled: !reminder.smsEnabled }));
}

function handleDuplicate(reminder: Reminder) {
  void withUpdate(reminder.id, () => duplicateReminder(reminder.id));
}

function handleDelete(reminder: Reminder) {
  void withUpdate(reminder.id, () => deleteReminder(reminder.id));
}

function isUpdating(id: string): boolean {
  return updatingIds.value.has(id);
}
</script>

<template>
  <AppShell>
    <section data-testid="reminders-page" class="rounded-3xl bg-white p-5 shadow-sm">
      <div class="flex items-start justify-between">
        <div>
          <p class="text-xs font-semibold text-[var(--tommy-info)]">Reminders</p>
          <h1 class="mt-1 text-2xl font-bold text-[var(--tommy-text)]">提醒事项</h1>
          <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">集中管理实验考试和自定义提醒，开启短信后会按设定的提前量提醒你。</p>
        </div>
        <span class="rounded-full bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-1 text-xs font-semibold text-[var(--tommy-info)]">
          {{ remindersData?.reminders.length ?? 0 }} 项
        </span>
      </div>

      <div data-testid="reminder-filter-row" class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="filter in filters"
          :key="filter.key"
          :data-testid="`filter-${filter.key}`"
          class="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
          :class="
            activeFilter === filter.key
              ? 'border-[var(--tommy-primary)] bg-[var(--tommy-primary)] text-white'
              : 'border-slate-200 bg-white text-[var(--tommy-text-secondary)]'
          "
          type="button"
          @click="activeFilter = filter.key"
        >
          {{ filter.label }}
        </button>
      </div>
    </section>

    <section
      data-testid="reminder-form-card"
      class="mt-5 overflow-hidden rounded-3xl border border-[color-mix(in_srgb,var(--tommy-primary)_14%,white)] bg-gradient-to-br from-white to-[color-mix(in_srgb,var(--tommy-primary)_8%,white)] shadow-sm"
    >
      <div class="border-b border-slate-100 px-5 py-4">
        <h2 class="text-lg font-bold text-[var(--tommy-text)]">{{ editingReminderId ? "编辑提醒" : "新增自定义提醒" }}</h2>
        <p class="mt-1 text-xs text-[var(--tommy-text-secondary)]">实验和考试请到「实验考试」页登记，会自动同步到这里。</p>
      </div>

      <form class="grid gap-3 p-5 sm:grid-cols-2" @submit.prevent="saveMutation.mutate()">
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)] sm:col-span-2">
          标题
          <input
            data-testid="reminder-title"
            v-model="form.title"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="例如：交志愿心得"
          />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          提醒时间
          <input
            data-testid="reminder-due"
            v-model="form.dueAt"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            type="datetime-local"
          />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          分类
          <select v-model="form.category" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="custom">自定义</option>
            <option value="volunteer">志愿</option>
            <option value="labor">劳育</option>
            <option value="sports">体育</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          地点
          <input
            v-model.lazy="form.location"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="可选"
          />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          优先级
          <select v-model="form.priority" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="low">低</option>
            <option value="normal">普通</option>
            <option value="high">高</option>
          </select>
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)] sm:col-span-2">
          备注
          <textarea
            v-model.lazy="form.notes"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            rows="2"
          />
        </label>
        <label class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-[var(--tommy-text-secondary)]">
          <input v-model="form.smsEnabled" type="checkbox" />
          <span>启用短信提醒</span>
        </label>
        <label class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-[var(--tommy-text-secondary)]">
          <input v-model="form.showOnHome" type="checkbox" />
          <span>在首页展示</span>
        </label>
        <div class="flex items-center gap-2 sm:col-span-2">
          <button
            data-testid="reminder-submit"
            type="submit"
            class="rounded-xl bg-[var(--tommy-primary)] px-5 py-2.5 font-semibold text-white shadow-sm"
          >
            {{ editingReminderId ? "保存提醒" : "新增提醒" }}
          </button>
          <button
            v-if="editingReminderId"
            type="button"
            class="rounded-xl border border-slate-200 px-4 py-2 text-sm text-[var(--tommy-text-secondary)]"
            @click="cancelEdit"
          >
            取消
          </button>
        </div>
      </form>

      <p
        v-if="message"
        class="mx-5 mb-5 rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-info)]"
      >
        {{ message }}
      </p>
    </section>

    <section class="mt-5 space-y-3">
      <ReminderListItem
        v-for="reminder in remindersData?.reminders ?? []"
        :key="reminder.id"
        :reminder="reminder"
        :updating="isUpdating(reminder.id)"
        @complete="handleComplete"
        @snooze="handleSnooze"
        @edit="startEdit"
        @toggle-home="handleToggleHome"
        @toggle-sms="handleToggleSms"
        @duplicate="handleDuplicate"
        @delete="handleDelete"
      />
      <p
        v-if="(remindersData?.reminders.length ?? 0) === 0"
        class="rounded-3xl bg-white p-6 text-center text-sm text-[var(--tommy-text-secondary)] shadow-sm"
      >
        当前筛选下没有提醒。
      </p>
    </section>
  </AppShell>
</template>
