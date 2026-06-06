<script setup lang="ts">
import type { PlazaPostStatus } from "../schemas/plaza";

const keyword = defineModel<string>("keyword", { default: "" });
const course = defineModel<string>("course", { default: "" });
const college = defineModel<string>("college", { default: "" });
const time = defineModel<string>("time", { default: "" });
const tag = defineModel<string>("tag", { default: "" });
const status = defineModel<PlazaPostStatus>("status", { default: "open" });
</script>

<template>
  <section class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
      搜索
      <input
        v-model="keyword"
        data-testid="plaza-search-input"
        class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
        placeholder="搜索标题、说明、联系方式"
      />
    </label>

    <div class="mt-3 grid gap-3 sm:grid-cols-5">
      <input
        v-model="course"
        data-testid="plaza-course-filter"
        class="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        placeholder="课程"
      />
      <input
        v-model="college"
        data-testid="plaza-college-filter"
        class="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        placeholder="学院"
      />
      <input
        v-model="time"
        data-testid="plaza-time-filter"
        class="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        placeholder="时间"
      />
      <input
        v-model="tag"
        data-testid="plaza-tag-filter"
        class="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        placeholder="标签"
      />
      <select
        v-model="status"
        data-testid="plaza-status-filter"
        class="rounded-xl border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="open">开放中</option>
        <option value="closed">已关闭</option>
      </select>
    </div>
  </section>
</template>
