<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import AppShell from "../components/AppShell.vue";

const route = useRoute();
const title = computed(() => String(route.meta.title ?? "功能模块"));
const description = computed(() => String(route.meta.description ?? "这个模块会在后续迭代中接入真实数据和操作流程。"));
</script>

<template>
  <AppShell>
    <section class="rounded-3xl bg-white p-6 shadow-sm">
      <p class="text-sm font-semibold text-[var(--tommy-primary)]">GradCheck</p>
      <h1 class="mt-2 text-2xl font-bold text-[var(--tommy-text)]">{{ title }}</h1>
      <p class="mt-3 text-sm leading-6 text-[var(--tommy-text-secondary)]">{{ description }}</p>
    </section>
  </AppShell>
</template>
