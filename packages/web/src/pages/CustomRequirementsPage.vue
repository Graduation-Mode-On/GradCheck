<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ZodError } from "zod";

import AppShell from "../components/AppShell.vue";
import {
  type CustomRequirement,
  createCustomRequirement,
  deleteCustomRequirement,
  getToken,
  listCustomRequirements,
  updateCustomRequirement
} from "../lib/api";
import { customRequirementSchema, type CustomRequirementInput } from "../schemas/customRequirement";

const router = useRouter();
const queryClient = useQueryClient();
const message = ref("");
const editingRequirementId = ref<string | null>(null);
const updatingRequirementIds = ref(new Set<string>());

if (!getToken()) {
  void router.replace("/login");
}

const form = reactive<CustomRequirementInput>({
  name: "",
  kind: "count",
  category: "lecture",
  targetValue: "1",
  currentValue: "0",
  unit: "次",
  importance: "required",
  source: "user_custom",
  includeInProgress: true,
  showOnHome: true,
  deadline: null,
  notes: null
});

const { data } = useQuery({
  queryKey: ["custom-requirements"],
  queryFn: listCustomRequirements,
  enabled: Boolean(getToken())
});

const saveMutation = useMutation({
  mutationFn: async () => {
    const input = customRequirementSchema.parse(form);
    return editingRequirementId.value
      ? updateCustomRequirement(editingRequirementId.value, input)
      : createCustomRequirement(input);
  },
  onSuccess: async () => {
    message.value = editingRequirementId.value ? "自定义要求已保存" : "自定义要求已创建";
    editingRequirementId.value = null;
    await queryClient.invalidateQueries({ queryKey: ["custom-requirements"] });
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

function editRequirement(requirement: CustomRequirement) {
  editingRequirementId.value = requirement.id;
  form.name = requirement.name;
  form.kind = requirement.kind;
  form.category = requirement.category;
  form.targetValue = requirement.targetValue;
  form.currentValue = requirement.currentValue;
  form.unit = requirement.unit;
  form.importance = requirement.importance;
  form.source = requirement.source;
  form.includeInProgress = requirement.includeInProgress;
  form.showOnHome = requirement.showOnHome;
  form.deadline = requirement.deadline;
  form.notes = requirement.notes;
}

async function incrementProgress(id: string, currentValue: string) {
  await updateRequirement(id, { currentValue: String(Number(currentValue) + 1) });
}

async function markComplete(id: string, targetValue: string) {
  await updateRequirement(id, { currentValue: targetValue });
}

async function toggleShowOnHome(id: string, showOnHome: boolean) {
  await updateRequirement(id, { showOnHome: !showOnHome });
}

async function removeRequirement(id: string) {
  await deleteCustomRequirement(id);
  await queryClient.invalidateQueries({ queryKey: ["custom-requirements"] });
}

async function updateRequirement(id: string, input: Parameters<typeof updateCustomRequirement>[1]) {
  if (updatingRequirementIds.value.has(id)) {
    return;
  }

  updatingRequirementIds.value = new Set(updatingRequirementIds.value).add(id);
  try {
    await updateCustomRequirement(id, input);
    await queryClient.invalidateQueries({ queryKey: ["custom-requirements"] });
  } finally {
    const nextUpdatingIds = new Set(updatingRequirementIds.value);
    nextUpdatingIds.delete(id);
    updatingRequirementIds.value = nextUpdatingIds;
  }
}

function isRequirementUpdating(id: string): boolean {
  return updatingRequirementIds.value.has(id);
}
</script>

<template>
  <AppShell>
    <section class="rounded-3xl bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-bold text-[var(--tommy-text)]">自定义要求</h1>
      <p class="mt-2 text-sm text-[var(--tommy-text-secondary)]">维护学院特色要求、个人目标和待确认毕业任务。</p>

      <form class="mt-6 grid gap-4 sm:grid-cols-2" @submit.prevent="saveMutation.mutate()">
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          名称
          <input data-testid="custom-requirement-name" v-model="form.name" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          类型
          <select data-testid="custom-requirement-kind" v-model="form.kind" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="count">次数</option>
            <option value="hours">时长</option>
            <option value="credits">学分</option>
            <option value="boolean">完成项</option>
          </select>
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          目标值
          <input data-testid="custom-requirement-target" v-model="form.targetValue" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          当前值
          <input data-testid="custom-requirement-current" v-model="form.currentValue" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          单位
          <input data-testid="custom-requirement-unit" v-model="form.unit" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          分类
          <select data-testid="custom-requirement-category" v-model="form.category" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="lecture">讲座</option>
            <option value="volunteer">志愿</option>
            <option value="labor">劳育</option>
            <option value="practice">实践</option>
            <option value="college">学院特色</option>
            <option value="sports">体育</option>
            <option value="exam">实验考试</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          重要性
          <select data-testid="custom-requirement-importance" v-model="form.importance" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="required">必需</option>
            <option value="optional">可选</option>
            <option value="personal_goal">个人目标</option>
          </select>
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          来源
          <select data-testid="custom-requirement-source" v-model="form.source" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="user_custom">用户自定义</option>
            <option value="college_requirement">学院要求</option>
            <option value="pending_confirmation">待确认</option>
          </select>
        </label>
        <label class="flex items-center gap-2 text-sm font-medium text-[var(--tommy-text-secondary)]">
          <input data-testid="custom-requirement-include-in-progress" v-model="form.includeInProgress" type="checkbox" />
          计入毕业进度
        </label>
        <label class="flex items-center gap-2 text-sm font-medium text-[var(--tommy-text-secondary)] sm:col-span-2">
          <input data-testid="custom-requirement-show-on-home" v-model="form.showOnHome" type="checkbox" />
          主页展示
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          截止时间
          <input
            data-testid="custom-requirement-deadline"
            :value="form.deadline ?? ''"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            type="date"
            @input="form.deadline = ($event.target as HTMLInputElement).value || null"
          />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          备注
          <textarea
            data-testid="custom-requirement-notes"
            :value="form.notes ?? ''"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            rows="3"
            @input="form.notes = ($event.target as HTMLTextAreaElement).value || null"
          />
        </label>
        <button data-testid="custom-requirement-submit" class="rounded-xl bg-[var(--tommy-primary)] px-5 py-2.5 font-semibold text-white sm:col-span-2" type="submit">
          {{ editingRequirementId ? "保存自定义要求" : "新增自定义要求" }}
        </button>
      </form>

      <p v-if="message" class="mt-4 rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-info)]">{{ message }}</p>
    </section>

    <section class="mt-5 grid gap-3">
      <article v-for="requirement in data?.customRequirements ?? []" :key="requirement.id" class="rounded-3xl bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-[var(--tommy-text)]">{{ requirement.name }}</h2>
            <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">{{ requirement.currentValue }} / {{ requirement.targetValue }} {{ requirement.unit }}</p>
          </div>
          <span class="rounded-full bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-1 text-xs font-semibold text-[var(--tommy-info)]">
            {{ requirement.showOnHome ? "主页展示" : "不在主页展示" }}
          </span>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            :data-testid="`increment-${requirement.id}`"
            class="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
            type="button"
            :disabled="isRequirementUpdating(requirement.id)"
            @click="incrementProgress(requirement.id, requirement.currentValue)"
          >
            +1
          </button>
          <button
            class="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
            type="button"
            :disabled="isRequirementUpdating(requirement.id)"
            @click="markComplete(requirement.id, requirement.targetValue)"
          >
            标记完成
          </button>
          <button
            :data-testid="`edit-${requirement.id}`"
            class="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            type="button"
            @click="editRequirement(requirement)"
          >
            编辑
          </button>
          <button
            :data-testid="`toggle-home-${requirement.id}`"
            class="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
            type="button"
            :disabled="isRequirementUpdating(requirement.id)"
            @click="toggleShowOnHome(requirement.id, requirement.showOnHome)"
          >
            {{ requirement.showOnHome ? "取消主页展示" : "主页展示" }}
          </button>
          <button class="rounded-xl border border-slate-200 px-3 py-2 text-sm" type="button" @click="removeRequirement(requirement.id)">删除</button>
        </div>
      </article>
    </section>
  </AppShell>
</template>
