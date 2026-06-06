<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  status: string;
}>();
</script>

<template>
  <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="mb-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
      {{ status }}
    </div>
    <h3 class="text-base font-semibold text-slate-900">{{ title }}</h3>
    <p class="mt-2 text-sm leading-6 text-slate-600">{{ description }}</p>
  </article>
</template>
