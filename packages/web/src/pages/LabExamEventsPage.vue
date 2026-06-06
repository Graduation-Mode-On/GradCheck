<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ZodError } from "zod";

import AppShell from "../components/AppShell.vue";
import {
  type LabExamEvent,
  createLabExamEvent,
  deleteLabExamEvent,
  getToken,
  listLabExamEvents,
  updateLabExamEvent,
  updateLabExamEventStatus
} from "../lib/api";
import { labExamEventInputSchema, type LabExamEventInput } from "../schemas/labExamEvent";

const router = useRouter();
const queryClient = useQueryClient();
const message = ref("");
const editingEventId = ref<string | null>(null);
const updatingEventIds = ref(new Set<string>());

if (!getToken()) {
  void router.replace("/login");
}

const form = reactive<LabExamEventInput>(emptyForm());

function emptyForm(): LabExamEventInput {
  return {
    title: "",
    courseName: null,
    eventType: "lab",
    startAt: "",
    endAt: null,
    location: null,
    teacher: null,
    seatOrGroup: null,
    notes: null,
    reminderOffsets: [1440, 60],
    smsEnabled: false,
    showOnHome: true
  };
}

const { data: eventsData } = useQuery({
  queryKey: ["lab-exam-events"],
  queryFn: () => listLabExamEvents(),
  enabled: computed(() => Boolean(getToken()))
});

const upcomingEvents = computed(() =>
  (eventsData.value?.events ?? []).filter((event) => event.status === "scheduled")
);
const completedEvents = computed(() =>
  (eventsData.value?.events ?? []).filter((event) => event.status !== "scheduled")
);

const saveMutation = useMutation({
  mutationFn: async () => {
    const parsed = labExamEventInputSchema.parse(toApiInput(form));
    if (editingEventId.value) {
      return updateLabExamEvent(editingEventId.value, parsed);
    }
    return createLabExamEvent(parsed);
  },
  onSuccess: async () => {
    message.value = editingEventId.value ? "已更新登记" : "已登记实验/考试，提醒已自动创建";
    editingEventId.value = null;
    Object.assign(form, emptyForm());
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lab-exam-events"] }),
      queryClient.invalidateQueries({ queryKey: ["reminders"] })
    ]);
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

function toApiInput(input: LabExamEventInput): LabExamEventInput {
  return {
    ...input,
    startAt: input.startAt ? toIso(input.startAt) : "",
    endAt: input.endAt ? toIso(input.endAt) : null
  };
}

function toIso(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function startEdit(event: LabExamEvent) {
  editingEventId.value = event.id;
  form.title = event.title;
  form.courseName = event.courseName;
  form.eventType = event.eventType;
  form.startAt = toLocalInput(event.startAt);
  form.endAt = event.endAt ? toLocalInput(event.endAt) : null;
  form.location = event.location;
  form.teacher = event.teacher;
  form.seatOrGroup = event.seatOrGroup;
  form.notes = event.notes;
  form.reminderOffsets = [1440, 60];
  form.smsEnabled = false;
  form.showOnHome = true;
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function cancelEdit() {
  editingEventId.value = null;
  Object.assign(form, emptyForm());
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

async function withUpdate(id: string, action: () => Promise<unknown>) {
  if (updatingEventIds.value.has(id)) return;
  updatingEventIds.value = new Set(updatingEventIds.value).add(id);
  try {
    await action();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lab-exam-events"] }),
      queryClient.invalidateQueries({ queryKey: ["reminders"] })
    ]);
  } finally {
    const next = new Set(updatingEventIds.value);
    next.delete(id);
    updatingEventIds.value = next;
  }
}

function markDone(event: LabExamEvent) {
  void withUpdate(event.id, () => updateLabExamEventStatus(event.id, "done"));
}

function cancelEvent(event: LabExamEvent) {
  void withUpdate(event.id, () => updateLabExamEventStatus(event.id, "cancelled"));
}

function deleteEvent(event: LabExamEvent) {
  void withUpdate(event.id, () => deleteLabExamEvent(event.id));
}
</script>

<template>
  <AppShell>
    <section data-testid="lab-exam-events-page" class="rounded-3xl bg-white p-5 shadow-sm">
      <p class="text-xs font-semibold text-[var(--tommy-info)]">Lab &amp; Exam</p>
      <h1 class="mt-1 text-2xl font-bold text-[var(--tommy-text)]">实验考试</h1>
      <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">登记后会自动创建提醒，默认在事项前 1 天和 1 小时各提醒一次。</p>
    </section>

    <section
      data-testid="lab-exam-form-card"
      class="mt-5 overflow-hidden rounded-3xl border border-[color-mix(in_srgb,var(--tommy-primary)_14%,white)] bg-gradient-to-br from-white to-[color-mix(in_srgb,var(--tommy-primary)_8%,white)] shadow-sm"
    >
      <div class="border-b border-slate-100 px-5 py-4">
        <h2 class="text-lg font-bold text-[var(--tommy-text)]">{{ editingEventId ? "编辑实验/考试" : "登记实验/考试" }}</h2>
        <p class="mt-1 text-xs text-[var(--tommy-text-secondary)]">提前 1 天 · 提前 1 小时（默认）</p>
      </div>

      <form class="grid gap-3 p-5 sm:grid-cols-2" @submit.prevent="saveMutation.mutate()">
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)] sm:col-span-2">
          标题
          <input
            data-testid="lab-exam-title"
            v-model="form.title"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            placeholder="例如：光电效应实验"
          />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          课程名
          <input
            data-testid="lab-exam-course"
            :value="form.courseName ?? ''"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            @input="form.courseName = ($event.target as HTMLInputElement).value || null"
          />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          类型
          <select v-model="form.eventType" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="lab">实验</option>
            <option value="midterm">期中考试</option>
            <option value="final">期末考试</option>
            <option value="quiz">随堂测验</option>
            <option value="other_exam">其他考试</option>
          </select>
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          开始时间
          <input
            data-testid="lab-exam-start"
            v-model="form.startAt"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            type="datetime-local"
          />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          结束时间
          <input
            :value="form.endAt ?? ''"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            type="datetime-local"
            @input="form.endAt = ($event.target as HTMLInputElement).value || null"
          />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          地点
          <input
            :value="form.location ?? ''"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            @input="form.location = ($event.target as HTMLInputElement).value || null"
          />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          老师
          <input
            :value="form.teacher ?? ''"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            @input="form.teacher = ($event.target as HTMLInputElement).value || null"
          />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          座位 / 分组
          <input
            :value="form.seatOrGroup ?? ''"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            @input="form.seatOrGroup = ($event.target as HTMLInputElement).value || null"
          />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)] sm:col-span-2">
          备注
          <textarea
            :value="form.notes ?? ''"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            rows="2"
            @input="form.notes = ($event.target as HTMLTextAreaElement).value || null"
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
            data-testid="lab-exam-submit"
            type="submit"
            class="rounded-xl bg-[var(--tommy-primary)] px-5 py-2.5 font-semibold text-white shadow-sm"
          >
            {{ editingEventId ? "保存" : "登记并创建提醒" }}
          </button>
          <button
            v-if="editingEventId"
            type="button"
            class="rounded-xl border border-slate-200 px-4 py-2 text-sm text-[var(--tommy-text-secondary)]"
            @click="cancelEdit"
          >
            取消编辑
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
      <h2 class="text-base font-bold text-[var(--tommy-text)]">即将到来</h2>
      <article
        v-for="event in upcomingEvents"
        :key="event.id"
        :data-testid="`lab-exam-card-${event.id}`"
        class="rounded-3xl bg-white p-5 shadow-sm"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-lg font-bold text-[var(--tommy-text)]">{{ event.title }}</h3>
            <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">
              {{ formatDateTime(event.startAt) }}
              <span v-if="event.location"> · {{ event.location }}</span>
            </p>
            <p v-if="event.courseName" class="mt-0.5 text-xs text-[var(--tommy-text-secondary)]">{{ event.courseName }}</p>
          </div>
          <span class="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--tommy-text-secondary)]">
            {{ event.eventType }}
          </span>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            :data-testid="`mark-event-done-${event.id}`"
            class="rounded-full border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-50"
            type="button"
            :disabled="updatingEventIds.has(event.id)"
            @click="markDone(event)"
          >
            完成
          </button>
          <button
            :data-testid="`cancel-event-${event.id}`"
            class="rounded-full border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-50"
            type="button"
            :disabled="updatingEventIds.has(event.id)"
            @click="cancelEvent(event)"
          >
            取消
          </button>
          <button
            :data-testid="`edit-event-${event.id}`"
            class="rounded-full border border-slate-200 px-3 py-1.5 text-xs"
            type="button"
            @click="startEdit(event)"
          >
            编辑
          </button>
          <button
            :data-testid="`delete-event-${event.id}`"
            class="rounded-full border border-slate-200 px-3 py-1.5 text-xs"
            type="button"
            @click="deleteEvent(event)"
          >
            删除
          </button>
        </div>
      </article>
      <p v-if="upcomingEvents.length === 0" class="rounded-3xl bg-white p-6 text-center text-sm text-[var(--tommy-text-secondary)] shadow-sm">
        暂无即将到来的实验或考试。
      </p>
    </section>

    <section v-if="completedEvents.length" class="mt-5 space-y-3">
      <h2 class="text-base font-bold text-[var(--tommy-text)]">已完成 / 已取消</h2>
      <article
        v-for="event in completedEvents"
        :key="event.id"
        class="rounded-3xl bg-white p-4 shadow-sm opacity-70"
      >
        <p class="text-sm font-semibold text-[var(--tommy-text)]">{{ event.title }}</p>
        <p class="mt-1 text-xs text-[var(--tommy-text-secondary)]">{{ formatDateTime(event.startAt) }} · {{ event.status }}</p>
      </article>
    </section>
  </AppShell>
</template>
