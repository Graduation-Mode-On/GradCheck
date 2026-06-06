<script setup lang="ts">
import { ref } from "vue";

import type { PlazaPost } from "../schemas/plaza";

const props = defineProps<{
  post: PlazaPost;
}>();

const emit = defineEmits<{
  edit: [post: PlazaPost];
  status: [post: PlazaPost];
  delete: [post: PlazaPost];
}>();

const expanded = ref(false);

const typeLabel = props.post.type === "course_exchange" ? "换课" : "组队";
const statusLabel = props.post.status === "open" ? "开放中" : "已关闭";
</script>

<template>
  <article class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <button class="w-full text-left" type="button" @click="expanded = !expanded">
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-full bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-1 text-xs font-semibold text-[var(--tommy-info)]">
          {{ typeLabel }}
        </span>
        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--tommy-text-secondary)]">
          {{ statusLabel }}
        </span>
        <span class="text-xs text-[var(--tommy-text-secondary)]">作者：{{ post.authorDisplayName }}</span>
      </div>
      <h2 class="mt-3 text-lg font-bold text-[var(--tommy-text)]">{{ post.title }}</h2>
      <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">
        <template v-if="post.type === 'course_exchange'">
          {{ post.offeredCourse }} → {{ post.wantedCourse }} · {{ post.courseTime }}
        </template>
        <template v-else>
          {{ post.teamPurpose }} · {{ post.currentMembers }}/{{ post.targetMembers }} 人 · {{ post.activityTime }}
        </template>
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <span v-for="tag in post.tags" :key="tag" class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-[var(--tommy-text-secondary)]">
          #{{ tag }}
        </span>
      </div>
    </button>

    <div v-if="expanded" class="mt-4 border-t border-slate-100 pt-4 text-sm leading-6 text-[var(--tommy-text-secondary)]">
      <p><strong class="text-[var(--tommy-text)]">联系方式：</strong>{{ post.contact }}</p>
      <p><strong class="text-[var(--tommy-text)]">说明：</strong>{{ post.description }}</p>
      <template v-if="post.type === 'team_recruit'">
        <p><strong class="text-[var(--tommy-text)]">项目类型：</strong>{{ post.projectType }}</p>
        <p><strong class="text-[var(--tommy-text)]">队友要求：</strong>{{ post.teammateRequirements }}</p>
      </template>
    </div>

    <div v-if="post.isOwner" class="mt-4 flex flex-wrap gap-2">
      <button class="rounded-xl bg-[var(--tommy-primary)] px-3 py-2 text-sm font-semibold text-white" type="button" @click="emit('edit', post)">
        编辑
      </button>
      <button class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white" type="button" @click="emit('status', post)">
        {{ post.status === "open" ? "关闭" : "重新打开" }}
      </button>
      <button class="rounded-xl bg-[var(--tommy-error)] px-3 py-2 text-sm font-semibold text-white" type="button" @click="emit('delete', post)">
        删除
      </button>
    </div>
  </article>
</template>
