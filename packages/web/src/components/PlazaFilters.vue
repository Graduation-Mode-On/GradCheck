<script setup lang="ts">
import type { PlazaPostStatus } from "../schemas/plaza";

const keyword = defineModel<string>("keyword", { default: "" });
const status = defineModel<PlazaPostStatus>("status", { default: "open" });
</script>

<template>
  <section class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="grid gap-3 sm:grid-cols-[1fr_10rem]">
      <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
      搜索
        <input
          v-model="keyword"
          data-testid="plaza-search-input"
          class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          placeholder="搜索标题、说明、联系方式"
        />
      </label>

      <label class="block text-sm font-medium text-[var(--tommy-text-secondary)]">
        状态
        <select
          v-model="status"
          data-testid="plaza-status-filter"
          class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="open">开放中</option>
          <option value="closed">已关闭</option>
        </select>
      </label>
    </div>
  </section>
</template>
