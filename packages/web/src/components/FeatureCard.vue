<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  status: string;
}>();
</script>

<template>
  <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="mb-3 inline-flex rounded-full bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-1 text-xs font-semibold text-[var(--tommy-info)]">
      {{ status }}
    </div>
    <h3 class="text-base font-semibold text-[var(--tommy-text)]">{{ title }}</h3>
    <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">{{ description }}</p>
  </article>
</template>
