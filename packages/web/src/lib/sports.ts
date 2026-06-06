export const SPORTS_DEADLINE = "2026-06-19";
export const MIN_SPORTS_RUNS = 45;
export const MAX_SPORTS_RUNS = 65;

export interface AmapForecastCast {
  date: string;
  week?: string;
  dayweather?: string;
  nightweather?: string;
  daytemp?: string;
  nighttemp?: string;
}

export interface SportsDayPlan {
  date: string;
  week?: string;
  dayweather: string;
  nightweather: string;
  runnable: boolean;
  reason: string;
}

const UNSAFE_WEATHER_KEYWORDS = [
  "雨",
  "雪",
  "雷",
  "冰雹",
  "冻雨",
  "沙尘",
  "扬沙",
  "浮尘",
  "雾",
  "霾",
  "台风",
  "大风",
  "风暴"
];

export function normalizeDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isWeatherRunnable(dayweather = "", nightweather = ""): boolean {
  const text = `${dayweather}${nightweather}`;
  return !UNSAFE_WEATHER_KEYWORDS.some((keyword) => text.includes(keyword));
}

export function buildSportsPlan(casts: AmapForecastCast[], today = new Date()): SportsDayPlan[] {
  const todayText = normalizeDate(today);

  return casts
    .filter((cast) => cast.date >= todayText && cast.date <= SPORTS_DEADLINE)
    .map((cast) => {
      const runnable = isWeatherRunnable(cast.dayweather, cast.nightweather);
      return {
        date: cast.date,
        week: cast.week,
        dayweather: cast.dayweather ?? "未知",
        nightweather: cast.nightweather ?? "未知",
        runnable,
        reason: runnable ? "天气适合安排跑操" : "存在降水或极端天气，建议避开"
      };
    });
}

export function clampTargetRuns(value: number): number {
  if (!Number.isFinite(value)) return MIN_SPORTS_RUNS;
  return Math.min(MAX_SPORTS_RUNS, Math.max(MIN_SPORTS_RUNS, Math.trunc(value)));
}

