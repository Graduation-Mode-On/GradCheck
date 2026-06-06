<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ZodError } from "zod";

import AppShell from "../components/AppShell.vue";
import { createSrtpRecord, deleteSrtpRecord, getSrtpOverview, getToken, updateSrtpRecord } from "../lib/api";
import type { SrtpRecord, SrtpRecordInput, SrtpRecordType } from "../schemas/srtp";
import { fixedCredit, srtpRecordInputSchema, srtpTypeLabel } from "../schemas/srtp";

const router = useRouter();
const queryClient = useQueryClient();

if (!getToken()) {
  void router.replace("/login");
}

const formOpen = ref(false);
const editingRecord = ref<SrtpRecord | null>(null);
const pendingDeleteRecord = ref<SrtpRecord | null>(null);
const actionMenuId = ref("");
const message = ref("");
const errorMessage = ref("");
const form = reactive({
  title: "",
  type: "competition" as SrtpRecordType,
  credits: "0.10",
  description: ""
});

const query = useQuery({
  queryKey: ["srtp-overview"],
  queryFn: getSrtpOverview,
  enabled: Boolean(getToken())
});

const overview = computed(() => query.data.value);
const summary = computed(() => overview.value?.summary);
const records = computed(() => overview.value?.records ?? []);

const statusText = computed(() => {
  if (summary.value?.status === "excellent") return "优秀";
  if (summary.value?.status === "passing") return "已及格";
  return "未及格";
});

const statusClass = computed(() =>
  summary.value?.status === "not_passing"
    ? "bg-[color-mix(in_srgb,var(--tommy-error)_14%,white)] text-[var(--tommy-error)]"
    : "bg-[color-mix(in_srgb,var(--tommy-success)_14%,white)] text-[var(--tommy-success)]"
);

const progressPercent = computed(() => `${Math.min(100, (Number(summary.value?.totalCredits ?? 0) / 6) * 100)}%`);
const missingText = computed(() => {
  if (!summary.value) return "";
  if (summary.value.status === "not_passing") return `还差 ${summary.value.missingForPassing} 分及格`;
  if (summary.value.status === "passing") return `还差 ${summary.value.missingForExcellent} 分优秀`;
  return "已达到优秀要求";
});

const createMutation = useMutation({
  mutationFn: (input: SrtpRecordInput) => createSrtpRecord(input),
  onSuccess: async () => {
    formOpen.value = false;
    message.value = "SRTP 记录已保存";
    await queryClient.invalidateQueries({ queryKey: ["srtp-overview"] });
  },
  onError: (error) => {
    errorMessage.value = error instanceof Error ? error.message : "保存失败";
  }
});

const updateMutation = useMutation({
  mutationFn: ({ id, input }: { id: string; input: SrtpRecordInput }) => updateSrtpRecord(id, input),
  onSuccess: async () => {
    formOpen.value = false;
    editingRecord.value = null;
    message.value = "SRTP 记录已保存";
    await queryClient.invalidateQueries({ queryKey: ["srtp-overview"] });
  },
  onError: (error) => {
    errorMessage.value = error instanceof Error ? error.message : "保存失败";
  }
});

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteSrtpRecord(id),
  onSuccess: async () => {
    pendingDeleteRecord.value = null;
    message.value = "SRTP 记录已删除";
    await queryClient.invalidateQueries({ queryKey: ["srtp-overview"] });
  }
});

watch(editingRecord, (record) => {
  form.title = record?.title ?? "";
  form.type = record?.type ?? "competition";
  form.credits = record?.credits ?? "0.10";
  form.description = record?.description ?? "";
});

function openCreateForm() {
  editingRecord.value = null;
  form.title = "";
  form.type = "competition";
  form.credits = "0.10";
  form.description = "";
  errorMessage.value = "";
  formOpen.value = true;
}

function openEditForm(record: SrtpRecord) {
  editingRecord.value = record;
  actionMenuId.value = "";
  errorMessage.value = "";
  formOpen.value = true;
}

function submitForm() {
  try {
    const input = srtpRecordInputSchema.parse({ ...form, credits: fixedCredit(form.credits) });
    if (editingRecord.value) {
      updateMutation.mutate({ id: editingRecord.value.id, input });
      return;
    }
    createMutation.mutate(input);
  } catch (error) {
    errorMessage.value = error instanceof ZodError ? (error.issues[0]?.message ?? "表单信息不完整") : "表单信息不完整";
  }
}

function removeRecord(record: SrtpRecord) {
  actionMenuId.value = "";
  pendingDeleteRecord.value = record;
}

function closeDeleteDialog() {
  if (!deleteMutation.isPending.value) {
    pendingDeleteRecord.value = null;
  }
}

function confirmDeleteRecord() {
  if (pendingDeleteRecord.value) {
    deleteMutation.mutate(pendingDeleteRecord.value.id);
  }
}
</script>

<template>
  <AppShell>
    <section class="space-y-4">
      <div class="rounded-3xl bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-[var(--tommy-primary)]">SRTP（课外实践）</p>
            <h1 class="mt-1 text-2xl font-bold text-[var(--tommy-text)]">{{ summary?.totalCredits ?? "0.00" }} 学分</h1>
            <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">2.00 分及格 · 6.00 分优秀 · {{ missingText }}</p>
          </div>
          <span data-testid="srtp-status-badge" class="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold" :class="statusClass">
            {{ statusText }}
          </span>
        </div>
        <div class="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full bg-[var(--tommy-primary)]" :style="{ width: progressPercent }" />
        </div>
      </div>

      <button
        data-testid="srtp-create-button"
        class="w-full rounded-xl bg-[var(--tommy-primary)] px-4 py-2.5 text-sm font-semibold text-white"
        type="button"
        @click="openCreateForm"
      >
        新增记录
      </button>

      <p v-if="message" class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-success)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-success)]">
        {{ message }}
      </p>

      <div v-if="records.length === 0 && !query.isLoading.value" class="rounded-3xl bg-white p-6 text-center text-sm text-[var(--tommy-text-secondary)] shadow-sm">
        暂无 SRTP 记录
      </div>

      <div class="space-y-3">
        <article v-for="record in records" :key="record.id" class="relative rounded-3xl bg-white p-5 shadow-sm">
          <button
            :data-testid="`srtp-record-actions-${record.id}`"
            class="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-[var(--tommy-text-secondary)]"
            type="button"
            @click="actionMenuId = actionMenuId === record.id ? '' : record.id"
          >
            ...
          </button>
          <div v-if="actionMenuId === record.id" class="absolute right-4 top-14 z-10 w-28 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm shadow-lg">
            <button :data-testid="`srtp-record-edit-${record.id}`" class="block w-full px-4 py-2 text-left hover:bg-slate-50" type="button" @click="openEditForm(record)">
              编辑
            </button>
            <button :data-testid="`srtp-record-delete-${record.id}`" class="block w-full px-4 py-2 text-left text-[var(--tommy-error)] hover:bg-slate-50" type="button" @click="removeRecord(record)">
              删除
            </button>
          </div>
          <p class="text-xs font-semibold text-[var(--tommy-info)]">{{ srtpTypeLabel(record.type) }}</p>
          <h2 class="mt-1 pr-12 text-lg font-bold text-[var(--tommy-text)]">{{ record.title }}</h2>
          <p class="mt-2 text-xl font-bold text-[var(--tommy-primary)]">{{ record.credits }} 学分</p>
          <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">{{ record.description || "无备注" }}</p>
        </article>
      </div>
    </section>

    <div v-if="formOpen" class="fixed inset-0 z-30 overflow-y-auto bg-slate-900/40 px-4 py-8">
      <form class="mx-auto max-w-lg rounded-3xl bg-white p-5 shadow-xl" @submit.prevent="submitForm">
        <div class="flex items-start justify-between gap-4">
          <h2 class="text-xl font-bold text-[var(--tommy-text)]">{{ editingRecord ? "编辑 SRTP 记录" : "新增 SRTP 记录" }}</h2>
          <button class="rounded-full bg-slate-100 px-3 py-1 text-sm" type="button" @click="formOpen = false">关闭</button>
        </div>
        <label class="mt-4 block text-sm font-medium text-[var(--tommy-text-secondary)]">
          名称
          <input v-model="form.title" data-testid="srtp-title-input" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="mt-4 block text-sm font-medium text-[var(--tommy-text-secondary)]">
          类型
          <select v-model="form.type" data-testid="srtp-type-input" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="competition">竞赛</option>
            <option value="project">SRTP项目</option>
            <option value="lecture">SRTP讲座</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label class="mt-4 block text-sm font-medium text-[var(--tommy-text-secondary)]">
          学分
          <input v-model="form.credits" data-testid="srtp-credits-input" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" min="0" step="0.1" type="number" />
        </label>
        <label class="mt-4 block text-sm font-medium text-[var(--tommy-text-secondary)]">
          备注
          <textarea v-model="form.description" data-testid="srtp-description-input" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" rows="3" />
        </label>
        <p v-if="errorMessage" class="mt-4 rounded-xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-error)]">
          {{ errorMessage }}
        </p>
        <button
          data-testid="srtp-submit-button"
          class="mt-5 w-full rounded-xl bg-[var(--tommy-primary)] px-4 py-2.5 font-semibold text-white"
          type="button"
          @click="submitForm"
        >
          保存记录
        </button>
      </form>
    </div>

    <div
      v-if="pendingDeleteRecord"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="srtp-delete-dialog-title"
    >
      <div class="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
        <h2 id="srtp-delete-dialog-title" class="text-lg font-bold text-[var(--tommy-text)]">删除 SRTP 记录</h2>
        <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">
          确定删除「<span class="font-bold text-[var(--tommy-text)]">{{ pendingDeleteRecord.title }}</span>」吗？删除后这条记录将不再计入 SRTP 学分。
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            data-testid="srtp-delete-cancel"
            class="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-[var(--tommy-text)] disabled:opacity-60"
            type="button"
            :disabled="deleteMutation.isPending.value"
            @click="closeDeleteDialog"
          >
            取消
          </button>
          <button
            data-testid="srtp-delete-confirm"
            class="rounded-xl bg-[var(--tommy-error)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            type="button"
            :disabled="deleteMutation.isPending.value"
            @click="confirmDeleteRecord"
          >
            {{ deleteMutation.isPending.value ? "删除中..." : "确认删除" }}
          </button>
        </div>
      </div>
    </div>
  </AppShell>
</template>
