<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { ZodError } from "zod";

import type { PlazaPost, PlazaPostInput, PlazaPostType } from "../schemas/plaza";
import { plazaPostInputSchema, plazaTagsFromText } from "../schemas/plaza";

const props = defineProps<{
  modelValue: boolean;
  post?: PlazaPost | null;
}>();

const emit = defineEmits<{
  close: [];
  submit: [input: PlazaPostInput];
}>();

const errorMessage = ref("");
const form = reactive({
  type: "course_exchange" as PlazaPostType,
  title: "",
  college: "",
  contact: "",
  description: "",
  tagsText: "",
  offeredCourse: "",
  wantedCourse: "",
  courseTime: "",
  teamPurpose: "",
  projectType: "",
  teammateRequirements: "",
  currentMembers: 1,
  targetMembers: 2,
  activityTime: ""
});

function reset() {
  const post = props.post;
  form.type = post?.type ?? "course_exchange";
  form.title = post?.title ?? "";
  form.college = post?.college ?? "";
  form.contact = post?.contact ?? "";
  form.description = post?.description ?? "";
  form.tagsText = post?.tags.join(", ") ?? "";
  form.offeredCourse = post?.type === "course_exchange" ? post.offeredCourse : "";
  form.wantedCourse = post?.type === "course_exchange" ? post.wantedCourse : "";
  form.courseTime = post?.type === "course_exchange" ? post.courseTime : "";
  form.teamPurpose = post?.type === "team_recruit" ? post.teamPurpose : "";
  form.projectType = post?.type === "team_recruit" ? post.projectType : "";
  form.teammateRequirements = post?.type === "team_recruit" ? post.teammateRequirements : "";
  form.currentMembers = post?.type === "team_recruit" ? post.currentMembers : 1;
  form.targetMembers = post?.type === "team_recruit" ? post.targetMembers : 2;
  form.activityTime = post?.type === "team_recruit" ? post.activityTime : "";
  errorMessage.value = "";
}

watch(() => [props.modelValue, props.post?.id], reset, { immediate: true });

function submit() {
  try {
    const base = {
      type: form.type,
      title: form.title,
      college: form.college,
      contact: form.contact,
      description: form.description,
      tags: plazaTagsFromText(form.tagsText)
    };
    const input =
      form.type === "course_exchange"
        ? plazaPostInputSchema.parse({
            ...base,
            type: "course_exchange",
            offeredCourse: form.offeredCourse,
            wantedCourse: form.wantedCourse,
            courseTime: form.courseTime
          })
        : plazaPostInputSchema.parse({
            ...base,
            type: "team_recruit",
            teamPurpose: form.teamPurpose,
            projectType: form.projectType,
            teammateRequirements: form.teammateRequirements,
            currentMembers: form.currentMembers,
            targetMembers: form.targetMembers,
            activityTime: form.activityTime
          });
    emit("submit", input);
  } catch (error) {
    errorMessage.value = error instanceof ZodError ? (error.issues[0]?.message ?? "表单信息不完整") : "表单信息不完整";
  }
}
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-30 overflow-y-auto bg-slate-900/40 px-4 py-8">
    <form class="mx-auto max-w-2xl rounded-3xl bg-white p-5 shadow-xl" @submit.prevent="submit">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold text-[var(--tommy-primary)]">广场</p>
          <h2 class="mt-1 text-xl font-bold text-[var(--tommy-text)]">{{ post ? "编辑帖子" : "发布帖子" }}</h2>
        </div>
        <button class="rounded-full bg-slate-100 px-3 py-1 text-sm" type="button" @click="emit('close')">关闭</button>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          类型
          <select v-model="form.type" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2">
            <option value="course_exchange">换课</option>
            <option value="team_recruit">组队</option>
          </select>
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          标题
          <input v-model="form.title" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          学院
          <input v-model="form.college" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          联系方式
          <input v-model="form.contact" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)] sm:col-span-2">
          标签
          <input v-model="form.tagsText" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="换课, 竞赛" />
        </label>
      </div>

      <div v-if="form.type === 'course_exchange'" class="mt-4 grid gap-4 sm:grid-cols-3">
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          换出课程
          <input v-model="form.offeredCourse" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          期望换入
          <input v-model="form.wantedCourse" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          课程时间
          <input v-model="form.courseTime" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
      </div>

      <div v-else class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          组队目的
          <input v-model="form.teamPurpose" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          项目类型
          <input v-model="form.projectType" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          当前人数
          <input v-model.number="form.currentMembers" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" type="number" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
          目标人数
          <input v-model.number="form.targetMembers" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" type="number" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)] sm:col-span-2">
          时间信息
          <input v-model="form.activityTime" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label class="block text-sm font-medium text-[var(--tommy-text-secondary)] sm:col-span-2">
          队友要求
          <textarea v-model="form.teammateRequirements" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" rows="3" />
        </label>
      </div>

      <label class="mt-4 block text-sm font-medium text-[var(--tommy-text-secondary)]">
        说明
        <textarea v-model="form.description" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" rows="4" />
      </label>

      <p v-if="errorMessage" class="mt-4 rounded-xl bg-[color-mix(in_srgb,var(--tommy-error)_12%,white)] px-3 py-2 text-sm text-[var(--tommy-error)]">
        {{ errorMessage }}
      </p>

      <button class="mt-5 w-full rounded-xl bg-[var(--tommy-primary)] px-4 py-2.5 font-semibold text-white" type="submit">
        {{ post ? "保存修改" : "发布帖子" }}
      </button>
    </form>
  </div>
</template>
