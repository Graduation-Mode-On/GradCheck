<script setup lang="ts">
import { computed, ref } from "vue";

export interface ScheduleCourse {
  courseName: string;
  courseCode?: string;
  classroom?: string;
  teacher?: string;
  schedule: Array<{
    dayOfWeek: number;
    startPeriod: number;
    endPeriod: number;
    startWeek?: number;
    endWeek?: number;
    weekLabel?: string;
  }>;
}

const props = defineProps<{
  courses: ScheduleCourse[];
}>();

const DAYS = [
  { label: "周一", value: 1 },
  { label: "周二", value: 2 },
  { label: "周三", value: 3 },
  { label: "周四", value: 4 },
  { label: "周五", value: 5 },
  { label: "周六", value: 6 },
  { label: "周日", value: 7 }
];

const PERIODS = Array.from({ length: 13 }, (_, i) => i + 1);

const COURSE_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-green-100 text-green-800 border-green-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-purple-100 text-purple-800 border-purple-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-pink-100 text-pink-800 border-pink-200"
];

const DAY_MAP = ["", "一", "二", "三", "四", "五", "六", "日"];

/** 按课程名聚合所有时间段 */
const courseSlotMap = computed(() => {
  const map = new Map<string, Array<{ dayOfWeek: number; startPeriod: number; endPeriod: number; weekLabel?: string }>>();
  for (const course of props.courses) {
    const existing = map.get(course.courseName) ?? [];
    map.set(course.courseName, [...existing, ...course.schedule]);
  }
  return map;
});

/** 将某课程的所有时间段格式化为紧凑字符串，如 "周二3-4 · 周四5-6" */
function formatCourseAllSlots(
  courseName: string,
  currentSlot?: { dayOfWeek: number; startPeriod: number; endPeriod: number }
): string {
  const slots = courseSlotMap.value.get(courseName) ?? [];
  if (slots.length <= 1) return "";

  const sorted = [...slots].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startPeriod - b.startPeriod;
  });

  return sorted
    .map((s) => {
      const day = DAY_MAP[s.dayOfWeek] ?? String(s.dayOfWeek);
      const isCurrent =
        currentSlot &&
        s.dayOfWeek === currentSlot.dayOfWeek &&
        s.startPeriod === currentSlot.startPeriod &&
        s.endPeriod === currentSlot.endPeriod;
      const text = `周${day}${s.startPeriod}-${s.endPeriod}`;
      return isCurrent ? text : text;
    })
    .join(" · ");
}

const courseColorMap = computed(() => {
  const map = new Map<string, string>();
  props.courses.forEach((course, index) => {
    const key = course.courseName;
    if (!map.has(key)) {
      map.set(key, COURSE_COLORS[index % COURSE_COLORS.length]);
    }
  });
  return map;
});

/** 检测时间重叠的课程 key（同一门课程的不同时间段不算冲突） */
const conflictingKeys = computed(() => {
  const conflicts = new Set<string>();
  const items = layoutItems.value;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      if (a.course.courseName === b.course.courseName) continue;
      if (a.startPeriod <= b.endPeriod && b.startPeriod <= a.endPeriod) {
        conflicts.add(a.key);
        conflicts.add(b.key);
      }
    }
  }
  return conflicts;
});

interface CellItem {
  course: ScheduleCourse;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  weekLabel?: string;
  span: number;
  lane: number;
  laneCount: number;
  key: string;
}

const layoutItems = computed(() => {
  const byDay = new Map<number, CellItem[]>();

  props.courses.forEach((course, courseIndex) => {
    course.schedule.forEach((slot, slotIndex) => {
      if (slot.dayOfWeek < 1 || slot.dayOfWeek > 7) return;
      if (slot.startPeriod < 1 || slot.startPeriod > PERIODS.length) return;

      const endPeriod = Math.min(slot.endPeriod, PERIODS.length);
      const item: CellItem = {
        course,
        dayOfWeek: slot.dayOfWeek,
        startPeriod: slot.startPeriod,
        endPeriod,
        weekLabel: slot.weekLabel,
        span: Math.max(1, endPeriod - slot.startPeriod + 1),
        lane: 0,
        laneCount: 1,
        key: `${course.courseName}-${courseIndex}-${slot.dayOfWeek}-${slot.startPeriod}-${endPeriod}-${slot.weekLabel ?? ""}-${slotIndex}`
      };

      const items = byDay.get(slot.dayOfWeek) ?? [];
      items.push(item);
      byDay.set(slot.dayOfWeek, items);
    });
  });

  const arranged: CellItem[] = [];
  for (const dayItems of Array.from(byDay.values())) {
    const laneEndPeriods: number[] = [];
    const sorted = dayItems.sort((left, right) => {
      if (left.startPeriod !== right.startPeriod) return left.startPeriod - right.startPeriod;
      if (left.endPeriod !== right.endPeriod) return right.endPeriod - left.endPeriod;
      return left.course.courseName.localeCompare(right.course.courseName, "zh-Hans-CN");
    });

    for (const item of sorted) {
      const lane = laneEndPeriods.findIndex((endPeriod) => endPeriod < item.startPeriod);
      item.lane = lane >= 0 ? lane : laneEndPeriods.length;
      laneEndPeriods[item.lane] = item.endPeriod;
      arranged.push(item);
    }

    const laneCount = Math.max(1, laneEndPeriods.length);
    for (const item of sorted) {
      item.laneCount = laneCount;
    }
  }

  return arranged;
});

function getCellItems(dayOfWeek: number, period: number): CellItem[] {
  return layoutItems.value.filter((item) => item.dayOfWeek === dayOfWeek && item.startPeriod === period);
}

function hasCourseStarting(dayOfWeek: number, period: number): boolean {
  return getCellItems(dayOfWeek, period).length > 0;
}

function getItemStyle(item: CellItem): Record<string, string> {
  // 找到所有在 item 开始时间段活跃的课程（包括从更早时间延伸过来的）
  const activeAtStart = layoutItems.value.filter(
    (other) =>
      other.dayOfWeek === item.dayOfWeek &&
      other.startPeriod <= item.startPeriod &&
      item.startPeriod <= other.endPeriod
  );
  const lanes = [...new Set(activeAtStart.map((a) => a.lane))].sort((a, b) => a - b);
  const laneCount = Math.max(1, lanes.length);
  const lane = Math.max(0, lanes.indexOf(item.lane));

  return {
    top: "2px",
    left: `calc(${lane} * 100% / ${laneCount} + 2px)`,
    width: `calc(100% / ${laneCount} - 4px)`,
    height: `calc(${item.span * 100}% + ${(item.span - 1) * 1}px - 4px)`
  };
}

// Click to show detail
const selectedCourse = ref<ScheduleCourse | null>(null);

function handleCourseClick(course: ScheduleCourse) {
  selectedCourse.value = course;
}

function closeDetail() {
  selectedCourse.value = null;
}


</script>

<template>
  <div class="isolate overflow-x-auto pb-1">
    <div class="w-max min-w-full rounded-2xl border border-slate-200 bg-white">
      <!-- Header -->
      <div class="grid grid-cols-[42px_repeat(7,68px)] border-b border-slate-200 sm:grid-cols-[48px_repeat(7,78px)]">
        <div class="border-r border-slate-100 px-1 py-2 text-center text-xs font-medium text-slate-400">
          节次
        </div>
        <div
          v-for="day in DAYS"
          :key="day.value"
          class="border-r border-slate-100 px-1 py-2 text-center text-sm font-semibold text-slate-700 last:border-r-0"
        >
          {{ day.label }}
        </div>
      </div>

      <!-- Body -->
      <div class="grid grid-cols-[42px_repeat(7,68px)] sm:grid-cols-[48px_repeat(7,78px)]">
        <template v-for="period in PERIODS" :key="period">
          <!-- Period label -->
          <div
            class="flex min-h-[46px] items-center justify-center border-b border-r border-slate-100 py-1 text-sm font-semibold text-slate-500"
            :class="{ 'bg-slate-50': period % 2 === 0 }"
          >
            {{ period }}
          </div>

          <!-- Day cells -->
          <template v-for="day in DAYS" :key="day.value">
            <div
              class="relative min-h-[46px] border-b border-r border-slate-100 p-0.5 last:border-r-0"
              :class="{ 'bg-slate-50': period % 2 === 0 }"
            >
              <!-- Course blocks that start at this cell -->
              <template v-if="hasCourseStarting(day.value, period)">
                <div
                  v-for="item in getCellItems(day.value, period)"
                  :key="item.key"
                  class="absolute z-10 flex cursor-pointer flex-col overflow-hidden rounded-md border px-0.5 py-0.5 text-[10px] leading-tight shadow-sm transition hover:brightness-95 hover:shadow-md active:scale-[0.98] sm:px-1 sm:text-[11px]"
                  :class="[courseColorMap.get(item.course.courseName), conflictingKeys.has(item.key) ? 'ring-2 ring-red-400' : '']"
                  :style="getItemStyle(item)"
                  @click="handleCourseClick(item.course)"
                >
                  <span class="truncate font-semibold">{{ item.course.courseName }}</span>
                  <span v-if="item.course.classroom" class="truncate opacity-80">
                    {{ item.course.classroom }}
                  </span>
                  <span v-if="item.weekLabel" class="truncate opacity-70">
                    {{ item.weekLabel }}
                  </span>
                  <span v-if="item.course.teacher" class="truncate opacity-70">
                    {{ item.course.teacher }}
                  </span>
                  <span
                    v-if="courseSlotMap.get(item.course.courseName)?.length ?? 0 > 1"
                    class="mt-0.5 truncate border-t border-current/20 pt-0.5 text-[9px] opacity-60 sm:text-[10px]"
                  >
                    {{ formatCourseAllSlots(item.course.courseName, { dayOfWeek: item.dayOfWeek, startPeriod: item.startPeriod, endPeriod: item.endPeriod }) }}
                  </span>
                </div>
              </template>
            </div>
          </template>
        </template>
      </div>
    </div>

    <!-- Course detail popup -->
    <div
      v-if="selectedCourse"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      @click.self="closeDetail"
    >
      <div class="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-xl">
        <div class="mb-4 flex items-start justify-between">
          <div class="flex-1">
            <h3 class="text-lg font-bold text-slate-800">{{ selectedCourse.courseName }}</h3>
            <p v-if="selectedCourse.courseCode" class="mt-0.5 text-sm text-slate-400">
              {{ selectedCourse.courseCode }}
            </p>
          </div>
          <button
            type="button"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            @click="closeDetail"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="space-y-3">
          <!-- Schedule -->
          <div class="rounded-xl bg-slate-50 p-3">
            <p class="mb-1.5 text-xs font-medium text-slate-400">上课时间</p>
            <div class="space-y-1">
              <div
                v-for="(slot, idx) in selectedCourse.schedule"
                :key="idx"
                class="flex items-center gap-2 text-sm text-slate-700"
              >
                <span class="inline-block h-2 w-2 rounded-full bg-[var(--tommy-primary)]" />
                <span>
                  {{ DAYS.find(d => d.value === slot.dayOfWeek)?.label ?? `周${slot.dayOfWeek}` }}
                  {{ slot.startPeriod }}-{{ slot.endPeriod }}节
                  <span v-if="slot.weekLabel" class="text-slate-400">({{ slot.weekLabel }})</span>
                </span>
              </div>
            </div>
          </div>

          <!-- Info grid -->
          <div class="grid grid-cols-2 gap-2">
            <div v-if="selectedCourse.teacher" class="rounded-xl bg-slate-50 p-3">
              <p class="text-xs text-slate-400">教师</p>
              <p class="mt-0.5 text-sm font-medium text-slate-700">{{ selectedCourse.teacher }}</p>
            </div>
            <div v-if="selectedCourse.classroom" class="rounded-xl bg-slate-50 p-3">
              <p class="text-xs text-slate-400">教室</p>
              <p class="mt-0.5 text-sm font-medium text-slate-700">{{ selectedCourse.classroom }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
