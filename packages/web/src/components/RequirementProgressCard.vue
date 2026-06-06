<script setup lang="ts">
const props = defineProps<{
  fieldKey: string;
  title: string;
  value: string;
  targetText: string;
  statusText: string;
  missingText: string;
  unit: string;
  step?: number;
  saved?: boolean;
}>();

const emit = defineEmits<{
  updateValue: [value: string];
  save: [];
}>();

function clamp(value: number): number {
  return Math.max(0, value);
}

function adjust(delta: number) {
  const step = props.step ?? 1;
  const next = clamp(Number(props.value || 0) + delta * step);
  emit("updateValue", String(Number(next.toFixed(2))));
}

function statusClass(statusText: string): string {
  if (statusText.includes("未及格")) {
    return "bg-[color-mix(in_srgb,var(--tommy-error)_14%,white)] text-[var(--tommy-error)]";
  }
  if (statusText.includes("已完成") || statusText.includes("已及格") || statusText.includes("优秀")) {
    return "bg-[color-mix(in_srgb,var(--tommy-success)_14%,white)] text-[var(--tommy-success)]";
  }
  return "bg-[color-mix(in_srgb,var(--tommy-warning)_14%,white)] text-[var(--tommy-warning)]";
}
</script>

<template>
  <article class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-lg font-bold text-[var(--tommy-text)]">{{ title }}</h2>
        <p class="mt-1 text-sm text-[var(--tommy-text-secondary)]">目标：{{ targetText }}</p>
      </div>
      <span
        :data-testid="`progress-${fieldKey}-status`"
        class="rounded-full px-3 py-1 text-xs font-semibold"
        :class="statusClass(statusText)"
      >
        {{ statusText }}
      </span>
    </div>

    <p class="mt-3 text-sm text-[var(--tommy-text-secondary)]">{{ missingText }}</p>

    <div class="mt-4 grid grid-cols-[2.5rem_1fr_2.5rem] gap-2">
      <button
        :data-testid="`progress-${fieldKey}-decrement`"
        class="rounded-xl bg-slate-100 px-3 py-2 font-bold text-[var(--tommy-text)]"
        type="button"
        :aria-label="`减少 ${step ?? 1}`"
        @click="adjust(-1)"
      >
        -
      </button>
      <label class="sr-only" :for="`progress-${fieldKey}`">{{ title }}</label>
      <div class="relative">
        <input
          :id="`progress-${fieldKey}`"
          :data-testid="`progress-${fieldKey}-input`"
          class="w-full rounded-xl border border-slate-300 px-3 py-2 pr-12 text-center"
          min="0"
          :step="step ?? 1"
          type="number"
          :value="value"
          @input="emit('updateValue', ($event.target as HTMLInputElement).value)"
        />
        <span class="absolute right-3 top-2.5 text-sm text-[var(--tommy-text-secondary)]">{{ unit }}</span>
      </div>
      <button
        :data-testid="`progress-${fieldKey}-increment`"
        class="rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] px-3 py-2 font-bold text-[var(--tommy-primary)]"
        type="button"
        :aria-label="`增加 ${step ?? 1}`"
        @click="adjust(1)"
      >
        +
      </button>
    </div>

    <button
      :data-testid="`progress-${fieldKey}-save`"
      class="mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
      :class="saved ? 'bg-[var(--tommy-success)]' : 'bg-[var(--tommy-primary)]'"
      type="button"
      @click="emit('save')"
    >
      {{ saved ? "已保存" : "保存" }}
    </button>
  </article>
</template>
