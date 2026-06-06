<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{
  fieldKey: string;
  title: string;
  icon: string;
  variant: "dots" | "gauge" | "toggle";
  current: number;
  target: number;
  unit: string;
  step?: number;
  saved?: boolean;
  /** 简化 gauge 模式：不显示目标切换，使用 target 作为目标值 */
  simple?: boolean;
}>();

const emit = defineEmits<{
  updateValue: [value: string];
}>();

function clamp(value: number): number {
  return Math.max(0, value);
}

function adjust(delta: number) {
  const step = props.step ?? 1;
  const next = clamp(props.current + delta * step);
  emit("updateValue", String(Number(next.toFixed(2))));
}

function toggle() {
  const next = props.current >= 1 ? 0 : 1;
  emit("updateValue", String(next));
}

// gauge 模式：目标值
const creditGoal = ref(1.0);
const gaugeGoal = computed(() => (props.simple ? props.target : creditGoal.value));
const gaugeSegments = computed(() => (props.simple ? Math.ceil(props.target) : 10));

/** 计算第 index 个格子（从0开始）的填充比例 0~1 */
function segmentFillRatio(index: number): number {
  const totalRatio = Math.min(props.current / gaugeGoal.value, 1);
  const segmentRatio = totalRatio * gaugeSegments.value;
  return Math.max(0, Math.min(1, segmentRatio - index));
}

// 提示文字
const hintText = computed(() => {
  if (props.variant === "gauge") {
    if (props.simple) {
      if (props.current < props.target) {
        return `还差 ${Number((props.target - props.current).toFixed(2))} ${props.unit}`;
      }
      return "已完成";
    }
    const credits = props.current;
    if (credits < 1) {
      return `距及格还差 ${Number((1 - credits).toFixed(2))} 学分`;
    }
    if (credits < 3) {
      return `已及格，距优秀还差 ${Number((3 - credits).toFixed(2))} 学分`;
    }
    return "已达优秀";
  }
  if (props.current >= props.target) return "已完成";
  const diff = props.target - props.current;
  return `还差 ${diff} ${props.unit}`;
});

// gauge 模式下当前值的显示（保留1位小数）
const displayCurrent = computed(() => {
  if (props.variant === "gauge") {
    return props.current.toFixed(1);
  }
  return String(props.current);
});

// gauge 模式下目标切换按钮文字
const goalOptions = [
  { label: "及格", value: 1.0 },
  { label: "优秀", value: 3.0 }
];
</script>

<template>
  <article class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <!-- 头部 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_10%,white)]"
        >
          <svg
            class="h-5 w-5 text-[var(--tommy-primary)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path :d="icon" />
          </svg>
        </div>
        <h2 class="text-base font-bold text-[var(--tommy-text)]">{{ title }}</h2>
      </div>

      <!-- 右上角计数 / 目标切换 -->
      <div class="flex items-center gap-2">
        <template v-if="variant === 'gauge' && !simple">
          <div class="flex rounded-lg bg-slate-100 p-0.5">
            <button
              v-for="opt in goalOptions"
              :key="opt.value"
              type="button"
              class="rounded-md px-2 py-0.5 text-[11px] font-semibold transition"
              :class="
                creditGoal === opt.value
                  ? 'bg-white text-[var(--tommy-primary)] shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              "
              @click="creditGoal = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </template>
        <span class="text-sm font-bold text-[var(--tommy-primary)]">
          <template v-if="variant === 'gauge'">
            {{ displayCurrent }} / {{ simple ? target : creditGoal }}
          </template>
          <template v-else>
            {{ current }} / {{ target }}
          </template>
          {{ unit }}
        </span>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="mt-4">
      <!-- dots 变体 -->
      <template v-if="variant === 'dots'">
        <div class="flex flex-wrap justify-center gap-2">
          <div
            v-for="i in Math.ceil(target)"
            :key="i"
            class="flex h-8 w-8 items-center justify-center rounded-full transition"
            :class="
              i <= current
                ? 'bg-[var(--tommy-primary)] text-white shadow-sm'
                : 'border-2 border-slate-200 text-slate-300'
            "
          >
            <svg
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path v-if="i <= current" d="M5 13l4 4L19 7" />
              <path v-else :d="icon" />
            </svg>
          </div>
        </div>

        <p class="mt-3 text-center text-sm text-[var(--tommy-text-secondary)]">
          {{ hintText }}
        </p>

        <div class="mt-3 flex gap-3">
          <button
            :data-testid="`progress-${fieldKey}-decrement`"
            type="button"
            class="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-[var(--tommy-text)] active:bg-slate-200"
            @click="adjust(-1)"
          >
            -1
          </button>
          <button
            :data-testid="`progress-${fieldKey}-increment`"
            type="button"
            class="flex-1 rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] py-2.5 text-sm font-bold text-[var(--tommy-primary)] active:opacity-80"
            @click="adjust(1)"
          >
            +1
          </button>
        </div>
      </template>

      <!-- gauge 变体 -->
      <template v-if="variant === 'gauge'">
        <div class="text-center">
          <div class="text-4xl font-bold text-[var(--tommy-text)]">{{ displayCurrent }}</div>
          <div class="mt-0.5 text-xs text-[var(--tommy-text-secondary)]">{{ unit }}</div>
        </div>

        <div class="mt-4 flex gap-1.5">
          <div
            v-for="i in gaugeSegments"
            :key="i"
            class="relative h-2.5 flex-1 rounded-full bg-slate-200 overflow-hidden"
          >
            <div
              class="absolute inset-y-0 left-0 rounded-full bg-[var(--tommy-primary)] transition-all duration-300"
              :style="{ width: (segmentFillRatio(i - 1) * 100) + '%' }"
            />
          </div>
        </div>

        <p class="mt-3 text-center text-sm text-[var(--tommy-text-secondary)]">
          {{ hintText }}
        </p>

        <div class="mt-3 flex gap-3">
          <button
            :data-testid="`progress-${fieldKey}-decrement`"
            type="button"
            class="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-[var(--tommy-text)] active:bg-slate-200"
            @click="adjust(-1)"
          >
            -{{ step ?? 0.1 }}
          </button>
          <button
            :data-testid="`progress-${fieldKey}-increment`"
            type="button"
            class="flex-1 rounded-xl bg-[color-mix(in_srgb,var(--tommy-primary)_12%,white)] py-2.5 text-sm font-bold text-[var(--tommy-primary)] active:opacity-80"
            @click="adjust(1)"
          >
            +{{ step ?? 0.1 }}
          </button>
        </div>
      </template>

      <!-- toggle 变体 -->
      <template v-if="variant === 'toggle'">
        <button
          :data-testid="`progress-${fieldKey}-toggle`"
          type="button"
          class="mt-2 w-full rounded-2xl border-2 py-5 text-center transition active:scale-[0.98]"
          :class="
            current >= 1
              ? 'border-[var(--tommy-primary)] bg-[var(--tommy-primary)] text-white shadow-sm'
              : 'border-slate-200 bg-white text-[var(--tommy-text-secondary)] hover:border-[color-mix(in_srgb,var(--tommy-primary)_30%,white)] hover:text-[var(--tommy-primary)]'
          "
          @click="toggle"
        >
          <div class="flex items-center justify-center gap-2">
            <svg
              v-if="current >= 1"
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
            <svg
              v-else
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span class="text-sm font-bold">{{ current >= 1 ? "已完成" : "标记为已完成" }}</span>
          </div>
        </button>
      </template>
    </div>

    <!-- 已保存提示 -->
    <div
      v-if="saved"
      class="mt-2 text-center text-xs font-semibold text-[var(--tommy-success)]"
    >
      已保存
    </div>
  </article>
</template>
