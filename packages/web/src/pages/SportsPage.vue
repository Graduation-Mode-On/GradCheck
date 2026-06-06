<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed, ref, watch } from "vue";

import AppShell from "../components/AppShell.vue";
import cancelTestIcon from "../assets/cancel-test.svg";
import sportsRestIcon from "../assets/sports-rest.svg";
import sportsRunnerIcon from "../assets/sports-runner.svg";
import { getSportsProgress, getToken, getWeather, updateSportsProgress } from "../lib/api";
import {
  buildSportsPlan,
  clampTargetRuns,
  MAX_SPORTS_RUNS,
  MIN_SPORTS_RUNS,
  normalizeDate,
  SPORTS_DEADLINE,
  type AmapForecastCast
} from "../lib/sports";

interface AmapForecast {
  casts?: AmapForecastCast[];
}

interface SavedSportsProgress {
  currentRuns: number;
  targetRuns: number;
  lastRunDate?: string;
  runDates: string[];
}

interface WallDay {
  date: string;
  day: number;
  monthLabel: string;
  active: boolean;
}

const STORAGE_KEY = "gradcheck.sports.progress";
const WALL_DAYS = 35;
const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function loadSavedProgress(): SavedSportsProgress | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SavedSportsProgress>;
    const runDates = Array.isArray(parsed.runDates) ? parsed.runDates.filter((date) => typeof date === "string") : [];
    const lastRunDate = typeof parsed.lastRunDate === "string" ? parsed.lastRunDate : runDates.at(-1);

    return {
      currentRuns: Math.max(0, Math.trunc(Number(parsed.currentRuns) || 0)),
      targetRuns: clampTargetRuns(Number(parsed.targetRuns) || MIN_SPORTS_RUNS),
      lastRunDate,
      runDates
    };
  } catch {
    return null;
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function weatherIcon(weather: string): string {
  if (weather.includes("雨") || weather.includes("雷")) return "🌧";
  if (weather.includes("雪")) return "❄";
  if (weather.includes("阴")) return "☁";
  if (weather.includes("云")) return "🌤";
  if (weather.includes("雾") || weather.includes("霾")) return "🌫";
  return "☀";
}

function toNumber(value?: string): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const savedProgress = loadSavedProgress();
const currentRuns = ref(savedProgress?.currentRuns ?? 0);
const targetRuns = ref(savedProgress?.targetRuns ?? MIN_SPORTS_RUNS);
const lastRunDate = ref(savedProgress?.lastRunDate);
const runDates = ref<string[]>(savedProgress?.runDates ?? []);
const serverProgressLoaded = ref(false);
const isEditingCurrentRuns = ref(!savedProgress);
const isEditingTargetRuns = ref(!savedProgress);
const runMenuVisible = ref(false);
const importHintVisible = ref(false);
const todayText = normalizeDate(new Date());
const reactionTick = ref(0);
const sparkStages = [
  { label: "微光", className: "spark-level-1" },
  { label: "小火花", className: "spark-level-2" },
  { label: "燃起", className: "spark-level-3" },
  { label: "连燃", className: "spark-level-4" },
  { label: "亮焰", className: "spark-level-5" },
  { label: "炽焰", className: "spark-level-6" },
  { label: "满燃", className: "spark-level-7" }
];

function saveProgress(): void {
  const input = {
    currentRuns: currentRuns.value,
    targetRuns: targetRuns.value,
    lastRunDate: lastRunDate.value ?? null,
    runDates: runDates.value
  };
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(input)
  );
  if (serverProgressLoaded.value) {
    sportsProgressMutation.mutate(input);
  }
}

function syncRunDate(date: string, active: boolean): void {
  const dates = new Set(runDates.value);
  if (active) dates.add(date);
  else dates.delete(date);
  runDates.value = Array.from(dates).sort();
}

watch(targetRuns, (value) => {
  if (!Number.isFinite(Number(value)) || value < MIN_SPORTS_RUNS || value > MAX_SPORTS_RUNS) return;
  saveProgress();
});

watch(currentRuns, (value) => {
  const normalized = Math.max(0, Math.trunc(Number(value) || 0));
  if (value !== normalized) {
    currentRuns.value = normalized;
    return;
  }
  saveProgress();
});

function toggleTodayRun(): void {
  if (lastRunDate.value === todayText) {
    currentRuns.value = Math.max(0, currentRuns.value - 1);
    lastRunDate.value = undefined;
    syncRunDate(todayText, false);
    saveProgress();
    return;
  }

  currentRuns.value += 1;
  lastRunDate.value = todayText;
  syncRunDate(todayText, true);
  reactionTick.value += 1;
  saveProgress();
}

function toggleRunMenu(): void {
  runMenuVisible.value = !runMenuVisible.value;
}

function saveRunsFromMenu(): void {
  currentRuns.value = Math.max(0, Math.trunc(currentRuns.value));
  targetRuns.value = clampTargetRuns(targetRuns.value);
  saveProgress();
  isEditingCurrentRuns.value = false;
  isEditingTargetRuns.value = false;
  runMenuVisible.value = false;
}

function editRunsFromMenu(): void {
  isEditingCurrentRuns.value = true;
  isEditingTargetRuns.value = true;
  runMenuVisible.value = false;
}

const { data, isLoading, error, refetch } = useQuery({
  queryKey: ["sports-weather", "320100"],
  queryFn: () => getWeather("320100", "all")
});

const sportsProgressQuery = useQuery({
  queryKey: ["sports-progress"],
  queryFn: getSportsProgress,
  enabled: Boolean(getToken())
});

const sportsProgressMutation = useMutation({
  mutationFn: updateSportsProgress
});

watch(
  () => sportsProgressQuery.data.value?.progress,
  (progress) => {
    if (!progress || serverProgressLoaded.value) return;

    const serverHasProgress = progress.createdAt && !progress.createdAt.startsWith("1970-");
    const initialProgress = serverHasProgress ? progress : savedProgress;
    if (!initialProgress) {
      serverProgressLoaded.value = true;
      return;
    }

    currentRuns.value = initialProgress.currentRuns;
    targetRuns.value = clampTargetRuns(initialProgress.targetRuns);
    lastRunDate.value = initialProgress.lastRunDate ?? undefined;
    runDates.value = initialProgress.runDates;
    serverProgressLoaded.value = true;

    if (!serverHasProgress && savedProgress) {
      saveProgress();
    }
  },
  { immediate: true }
);

const casts = computed(() => {
  const forecast = data.value?.forecasts?.[0] as AmapForecast | undefined;
  return forecast?.casts ?? [];
});

const plan = computed(() => buildSportsPlan(casts.value));
const runnableDays = computed(() => plan.value.filter((day) => day.runnable));
const remainingRuns = computed(() => Math.max(0, targetRuns.value - currentRuns.value));
const guaranteedRemainingRuns = computed(() => Math.max(0, MIN_SPORTS_RUNS - currentRuns.value));
const availableRunnableDays = computed(() => runnableDays.value.length);
const runDateSet = computed(() => new Set(runDates.value));
const consecutiveRunStreak = computed(() => {
  if (!runDateSet.value.has(todayText)) return 0;

  let streak = 0;
  let date = new Date(todayText);
  while (runDateSet.value.has(normalizeDate(date))) {
    streak += 1;
    date = addDays(date, -1);
  }
  return streak;
});
const activeSpark = computed(() => sparkStages[Math.min(consecutiveRunStreak.value, sparkStages.length) - 1] ?? sparkStages[0]);
const isSparkLit = computed(() => consecutiveRunStreak.value > 0);
const runningExperience = computed(() => {
  const today = plan.value[0];
  if (!today) return "先刷新天气，帮你挑一个舒服的跑操窗口。";
  if (!today.runnable) return "今天不太适合跑操，可以先把计划排到天气更友好的日期。";
  const dayTemp = toNumber(casts.value[0]?.daytemp);
  if (dayTemp !== null && dayTemp >= 30) return "天气可跑，但温度偏高，建议选择傍晚并注意补水。";
  if (dayTemp !== null && dayTemp <= 10) return "天气可跑，但体感偏凉，开跑前多热身。";
  return "今天体感不错，适合安排一次轻松跑操。";
});
const wallDays = computed<WallDay[]>(() => {
  const today = new Date(todayText);
  const start = addDays(today, -(WALL_DAYS - 1));

  return Array.from({ length: WALL_DAYS }, (_, index) => {
    const date = addDays(start, index);
    const dateText = normalizeDate(date);
    const day = date.getDay() || 7;
    return {
      date: dateText,
      day,
      monthLabel: date.getDate() === 1 || index === 0 ? `${date.getMonth() + 1}月` : "",
      active: runDateSet.value.has(dateText)
    };
  });
});
const wallColumns = computed(() => Array.from({ length: Math.ceil(WALL_DAYS / 7) }, (_, index) => wallDays.value.slice(index * 7, index * 7 + 7)));

const chartDays = computed(() =>
  casts.value
    .slice(0, 5)
    .map((cast) => ({
      date: cast.date,
      label: cast.date === todayText ? "今天" : cast.date.slice(5),
      dayweather: cast.dayweather ?? "未知",
      nightweather: cast.nightweather ?? "未知",
      daytemp: toNumber(cast.daytemp),
      nighttemp: toNumber(cast.nighttemp)
    }))
    .filter((cast) => cast.daytemp !== null && cast.nighttemp !== null)
);
const chartBounds = computed(() => {
  const temps = chartDays.value.flatMap((day) => [day.daytemp ?? 0, day.nighttemp ?? 0]);
  return {
    min: Math.min(...temps, 0) - 2,
    max: Math.max(...temps, 10) + 2
  };
});
function chartX(index: number): number {
  if (chartDays.value.length <= 1) return 180;
  return 34 + (index * 292) / (chartDays.value.length - 1);
}
function chartY(temp: number | null): number {
  if (temp === null) return 180;
  const { min, max } = chartBounds.value;
  return 202 - ((temp - min) / (max - min)) * 72;
}
function chartPath(type: "daytemp" | "nighttemp"): string {
  return chartDays.value
    .map((day, index) => `${index === 0 ? "M" : "L"} ${chartX(index)} ${chartY(day[type])}`)
    .join(" ");
}

const riskLevel = computed(() => {
  if (currentRuns.value >= targetRuns.value) return "done";
  if (availableRunnableDays.value === 0) return "danger";
  if (guaranteedRemainingRuns.value > availableRunnableDays.value) return "danger";
  if (remainingRuns.value > availableRunnableDays.value) return "warning";
  if (remainingRuns.value === availableRunnableDays.value) return "warning";
  return "steady";
});

const reminder = computed(() => {
  if (riskLevel.value === "done") return "你已经达到目标次数，后续只需要保持记录准确。";
  if (riskLevel.value === "danger") {
    if (availableRunnableDays.value === 0) return "当前暂无适合跑步的天气窗口，请关注天气变化并及时安排跑操。";
    return `保底还差 ${guaranteedRemainingRuns.value} 次，但近期适合跑操天数只有 ${availableRunnableDays.value} 天，当前风险较高，建议尽快增加安排。`;
  }
  if (riskLevel.value === "warning") {
    if (remainingRuns.value > availableRunnableDays.value) {
      return `目标还差 ${remainingRuns.value} 次，近期适合跑操天数只有 ${availableRunnableDays.value} 天，目标节奏偏紧，建议优先安排可跑日期。`;
    }
    return "剩余次数和适合跑步天数已经比较接近，建议尽快补齐。";
  }
  return "节奏比较稳，优先选择天气适合的日期完成跑操即可。";
});
</script>

<template>
  <AppShell>
    <section data-testid="sports-page" class="space-y-5">
      <div class="rounded-3xl bg-gradient-to-br from-white via-sky-50 to-emerald-50 p-5 shadow-sm">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="text-sm font-semibold text-[var(--tommy-primary)]">体育跑操</p>
            <h1 class="mt-2 text-2xl font-bold text-[var(--tommy-text)]">跑操进度提醒</h1>
            <p class="mt-2 text-sm leading-6 text-[var(--tommy-text-secondary)]">
              截止日期统一为 {{ SPORTS_DEADLINE }}，保证体育不挂科需完成至少 {{ MIN_SPORTS_RUNS }} 次。
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="shrink-0 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5"
              type="button"
              @click="toggleTodayRun"
            >
              {{ lastRunDate === todayText ? "取消今日已跑" : "今日已跑" }}
            </button>
            <div :key="reactionTick" class="spark-card" :class="{ 'spark-card-lit': isSparkLit }">
              <div class="spark-badge" :class="[isSparkLit ? activeSpark.className : 'spark-level-off']" aria-hidden="true">
                <span class="spark-flame spark-flame-back" />
                <span class="spark-flame spark-flame-front" />
                <span class="spark-glow" />
              </div>
              <div class="min-w-0">
                <p class="spark-title">{{ isSparkLit ? activeSpark.label : "待点燃" }}</p>
                <p class="spark-copy">{{ isSparkLit ? `连续 ${consecutiveRunStreak} 天已跑` : "今日未跑，火花休眠" }}</p>
                <div class="spark-library" aria-label="火花等级">
                  <span
                    v-for="(_, index) in sparkStages"
                    :key="index"
                    class="spark-dot"
                    :class="{ 'spark-dot-lit': consecutiveRunStreak >= index + 1 }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="relative rounded-3xl bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-bold text-[var(--tommy-text)]">录入次数</h2>
            <button
              class="flex h-9 w-9 items-center justify-center bg-transparent transition hover:-translate-y-0.5"
              type="button"
              aria-label="打开录入次数操作菜单"
              @click="toggleRunMenu"
            >
              <img class="h-7 w-7" :src="cancelTestIcon" alt="" aria-hidden="true" />
            </button>
            <div
              v-if="runMenuVisible"
              class="absolute right-5 top-14 z-10 grid w-24 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm font-semibold text-[var(--tommy-text)] shadow-lg"
            >
              <button class="px-4 py-2 text-left transition hover:bg-slate-50" type="button" @click="saveRunsFromMenu">保存</button>
              <button class="px-4 py-2 text-left transition hover:bg-slate-50" type="button" @click="editRunsFromMenu">修改</button>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="grid min-h-28 grid-rows-[auto_1fr] gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label class="text-sm font-semibold text-[var(--tommy-text)]" for="sports-current-runs">目前已跑次数</label>
              <div class="grid items-center">
                <input
                  id="sports-current-runs"
                  v-model.number="currentRuns"
                  class="h-12 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-lg disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                  :disabled="!isEditingCurrentRuns"
                  min="0"
                  type="number"
                />
              </div>
            </div>
            <div class="grid min-h-28 grid-rows-[auto_1fr] gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label class="text-sm font-semibold text-[var(--tommy-text)]" for="sports-target-runs">目标次数</label>
              <div class="grid items-center">
                <input
                  id="sports-target-runs"
                  v-model.number="targetRuns"
                  class="h-12 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-lg disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                  :disabled="!isEditingTargetRuns"
                  :max="MAX_SPORTS_RUNS"
                  :min="MIN_SPORTS_RUNS"
                  type="number"
                />
              </div>
            </div>
          </div>
          <p class="mt-3 text-xs leading-5 text-[var(--tommy-text-secondary)]">
            首次录入后会自动保存。之后需要点击“修改”才可编辑，目标次数范围为 {{ MIN_SPORTS_RUNS }}-{{ MAX_SPORTS_RUNS }} 次。
          </p>
        </section>

        <section class="rounded-3xl bg-white p-5 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-bold text-[var(--tommy-text)]">跑操记录</h2>
              <p class="mt-1 text-xs text-[var(--tommy-text-secondary)]">记录最近一段时间的跑操分布。</p>
            </div>
            <button class="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-[var(--tommy-primary)] shadow-sm transition hover:-translate-y-0.5" type="button" @click="importHintVisible = !importHintVisible">
              导入跑操数据
            </button>
          </div>
          <div class="mt-3 flex items-center gap-3 text-xs text-[var(--tommy-text-secondary)]">
            <img class="mini-day mini-day-run" :src="sportsRunnerIcon" alt="" aria-hidden="true" />
            <span>已跑</span>
            <img class="mini-day mini-day-rest ml-1" :src="sportsRestIcon" alt="" aria-hidden="true" />
            <span>未跑</span>
          </div>
          <p v-if="importHintVisible" class="mt-2 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-[var(--tommy-text-secondary)]">
            暂未对接东南大学跑操系统。后续接入学校权限接口后，可从系统导入已跑日期，补齐忘记在页面登记的记录。
          </p>
          <div class="mt-3">
            <div class="w-full">
              <div class="ml-6 grid grid-flow-col auto-cols-fr gap-0.5 text-[9px] text-[var(--tommy-text-secondary)] sm:ml-7">
                <span v-for="(column, index) in wallColumns" :key="index" class="h-4 text-center">
                  {{ column[0]?.monthLabel }}
                </span>
              </div>
              <div class="mt-1 flex gap-1.5">
                <div class="grid grid-rows-7 gap-1 text-[9px] leading-5 text-[var(--tommy-text-secondary)]">
                  <span v-for="label in WEEK_LABELS" :key="label" class="h-5">{{ label }}</span>
                </div>
                <div class="grid flex-1 grid-flow-col auto-cols-fr gap-1">
                  <div v-for="(column, columnIndex) in wallColumns" :key="columnIndex" class="grid grid-rows-7 gap-1">
                    <img
                      v-for="day in column"
                      :key="day.date"
                      class="mini-day w-full"
                      :class="day.active ? 'mini-day-run' : 'mini-day-rest'"
                      :src="day.active ? sportsRunnerIcon : sportsRestIcon"
                      alt=""
                      :title="`${day.date}${day.active ? ' 已跑' : ' 未记录'}`"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section class="grid grid-cols-3 gap-2 sm:gap-3">
        <div class="flex min-h-24 flex-col justify-center gap-2 rounded-3xl bg-white p-4 shadow-sm">
          <p class="text-sm font-semibold text-[var(--tommy-text-secondary)]">目标还差</p>
          <p class="text-2xl font-bold leading-none text-[var(--tommy-primary)]">{{ remainingRuns }} <span class="text-base">次</span></p>
        </div>
        <div class="flex min-h-24 flex-col justify-center gap-2 rounded-3xl bg-white p-4 shadow-sm">
          <p class="text-sm font-semibold text-[var(--tommy-text-secondary)]">保底还差</p>
          <p class="text-2xl font-bold leading-none text-[var(--tommy-warning)]">{{ guaranteedRemainingRuns }} <span class="text-base">次</span></p>
        </div>
        <div class="flex min-h-24 flex-col justify-center gap-2 rounded-3xl bg-white p-4 shadow-sm">
          <p class="text-sm font-semibold text-[var(--tommy-text-secondary)]">适合天数</p>
          <p class="text-2xl font-bold leading-none text-[var(--tommy-success)]">{{ availableRunnableDays }} <span class="text-base">天</span></p>
        </div>
      </section>

      <div class="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section
          class="rounded-3xl border p-5 shadow-sm"
          :class="{
            'border-emerald-200 bg-emerald-50': riskLevel === 'done' || riskLevel === 'steady',
            'border-amber-200 bg-amber-50': riskLevel === 'warning',
            'border-red-200 bg-red-50': riskLevel === 'danger'
          }"
        >
          <h2 class="text-lg font-bold text-[var(--tommy-text)]">提醒</h2>
          <p class="mt-2 text-sm leading-6 text-[var(--tommy-text)]">{{ reminder }}</p>
        </section>

        <section class="overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-5 text-[var(--tommy-text)] shadow-sm">
          <div class="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1">
            <div>
              <h2 class="text-lg font-bold">跑操体验预览</h2>
            </div>
            <button class="h-10 shrink-0 whitespace-nowrap rounded-lg border border-cyan-300 bg-gradient-to-r from-cyan-100 to-sky-100 px-4 text-sm font-semibold text-[var(--tommy-primary)] shadow-sm transition hover:-translate-y-0.5 hover:from-cyan-200 hover:to-sky-200" type="button" @click="refetch()">
              刷新天气
            </button>
            <p class="col-span-2 text-xs leading-5 text-[var(--tommy-text-secondary)]">{{ runningExperience }}</p>
          </div>

          <p v-if="isLoading" class="mt-4 text-sm text-[var(--tommy-text-secondary)]">正在读取天气预报...</p>
          <p v-else-if="error" class="mt-4 text-sm text-[var(--tommy-error)]">天气读取失败，请检查后端服务和高德 Key。</p>
          <p v-else-if="chartDays.length === 0" class="mt-4 text-sm text-[var(--tommy-text-secondary)]">暂未获取到可绘制的天气预报。</p>

          <div v-else class="mx-auto mt-4 w-full max-w-2xl">
            <svg class="block h-auto w-full" viewBox="0 0 360 260" role="img" aria-label="南京近期温度趋势折线图">
              <path :d="chartPath('daytemp')" fill="none" stroke="#14a9c9" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" />
              <path :d="chartPath('nighttemp')" fill="none" stroke="#8dd8c8" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" />
              <g v-for="(day, index) in chartDays" :key="day.date">
                <text :x="chartX(index)" y="24" fill="#35505f" font-size="13" font-weight="700" text-anchor="middle">{{ day.label }}</text>
                <text :x="chartX(index)" y="52" fill="#14a9c9" font-size="19" text-anchor="middle">{{ weatherIcon(day.dayweather) }}</text>
                <text :x="chartX(index)" y="76" fill="#22313f" font-size="12" font-weight="700" text-anchor="middle">{{ day.dayweather }}</text>
                <circle :cx="chartX(index)" :cy="chartY(day.daytemp)" r="4" fill="#14a9c9" />
                <circle :cx="chartX(index)" :cy="chartY(day.nighttemp)" r="4" fill="#8dd8c8" />
                <text :x="chartX(index)" :y="chartY(day.daytemp) - 8" fill="#0f7ea0" font-size="13" font-weight="700" text-anchor="middle">{{ day.daytemp }}°C</text>
                <text :x="chartX(index)" :y="chartY(day.nighttemp) + 20" fill="#348f7f" font-size="13" font-weight="700" text-anchor="middle">{{ day.nighttemp }}°C</text>
                <text :x="chartX(index)" y="232" fill="#14a9c9" font-size="19" text-anchor="middle">{{ weatherIcon(day.nightweather) }}</text>
                <text :x="chartX(index)" y="254" fill="#22313f" font-size="12" font-weight="700" text-anchor="middle">{{ day.nightweather }}</text>
              </g>
            </svg>
          </div>
        </section>
      </div>
    </section>
  </AppShell>
</template>

<style scoped>
.spark-card {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  border: 1px solid rgb(203 213 225 / 70%);
  border-radius: 18px;
  background: linear-gradient(135deg, rgb(255 255 255 / 92%), rgb(248 250 252 / 86%));
  padding: 10px 12px;
  box-shadow: 0 14px 30px rgb(15 23 42 / 8%);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.spark-card-lit {
  border-color: rgb(251 191 36 / 45%);
  box-shadow: 0 16px 34px rgb(245 158 11 / 18%);
  transform: translateY(-1px);
}

.spark-badge {
  --spark-a: #cbd5e1;
  --spark-b: #94a3b8;
  --spark-c: #e2e8f0;
  position: relative;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  border-radius: 16px;
  background:
    radial-gradient(circle at 50% 74%, rgb(255 255 255 / 95%) 0 15%, transparent 16%),
    linear-gradient(145deg, rgb(255 255 255 / 86%), rgb(241 245 249 / 72%));
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 80%),
    0 10px 22px rgb(15 23 42 / 10%);
  overflow: hidden;
}

.spark-flame,
.spark-glow {
  position: absolute;
  display: block;
}

.spark-flame {
  left: 50%;
  bottom: 9px;
  border-radius: 62% 38% 58% 42% / 68% 42% 58% 32%;
  transform: translateX(-50%) rotate(45deg);
}

.spark-flame-back {
  width: 27px;
  height: 27px;
  background: linear-gradient(135deg, var(--spark-a), var(--spark-b));
  box-shadow: 0 0 18px color-mix(in srgb, var(--spark-a), transparent 40%);
}

.spark-flame-front {
  bottom: 14px;
  width: 15px;
  height: 15px;
  background: linear-gradient(135deg, #fff7ed, var(--spark-c));
}

.spark-glow {
  inset: 8px;
  border-radius: 999px;
  background: radial-gradient(circle, color-mix(in srgb, var(--spark-a), transparent 52%), transparent 62%);
}

.spark-level-off {
  filter: grayscale(1);
  opacity: 0.76;
}

.spark-level-1 {
  --spark-a: #fde68a;
  --spark-b: #f59e0b;
  --spark-c: #fff7ad;
}

.spark-level-2 {
  --spark-a: #fbbf24;
  --spark-b: #fb7185;
  --spark-c: #fed7aa;
}

.spark-level-3 {
  --spark-a: #fb923c;
  --spark-b: #ef4444;
  --spark-c: #fde68a;
}

.spark-level-4 {
  --spark-a: #f97316;
  --spark-b: #ec4899;
  --spark-c: #fef3c7;
}

.spark-level-5 {
  --spark-a: #22d3ee;
  --spark-b: #14b8a6;
  --spark-c: #cffafe;
}

.spark-level-6 {
  --spark-a: #a78bfa;
  --spark-b: #06b6d4;
  --spark-c: #f5d0fe;
}

.spark-level-7 {
  --spark-a: #facc15;
  --spark-b: #f97316;
  --spark-c: #ffffff;
}

.spark-title {
  margin: 0;
  color: var(--tommy-text);
  font-size: 14px;
  font-weight: 800;
  line-height: 1.2;
}

.spark-copy {
  margin: 2px 0 0;
  color: var(--tommy-text-secondary);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
}

.spark-library {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-top: 7px;
  max-width: 124px;
  width: 100%;
}

.spark-dot {
  display: block;
  height: 5px;
  border-radius: 999px;
  background: #dbe3eb;
}

.spark-dot-lit {
  background: linear-gradient(90deg, #fbbf24, #fb7185);
  box-shadow: 0 0 10px rgb(251 191 36 / 45%);
}

.mini-day {
  display: block;
  min-width: 24px;
  height: 20px;
  object-fit: contain;
  object-position: center;
}

.mini-day-run {
  transform: scale(1.36);
  transform-origin: center;
  filter: invert(55%) sepia(90%) saturate(807%) hue-rotate(140deg) brightness(92%) contrast(93%);
}

.mini-day-rest {
  filter: invert(86%) sepia(10%) saturate(280%) hue-rotate(172deg) brightness(94%) contrast(88%);
  opacity: 0.9;
}
</style>
