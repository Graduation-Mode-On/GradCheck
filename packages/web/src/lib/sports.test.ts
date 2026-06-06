import { describe, expect, it } from "vitest";

import { buildSportsPlan, clampTargetRuns, isWeatherRunnable } from "./sports";

describe("sports run planning", () => {
  it("treats rain and extreme weather as not runnable", () => {
    expect(isWeatherRunnable("晴", "多云")).toBe(true);
    expect(isWeatherRunnable("小雨", "阴")).toBe(false);
    expect(isWeatherRunnable("多云", "雷阵雨")).toBe(false);
    expect(isWeatherRunnable("雾", "晴")).toBe(false);
  });

  it("builds a weather plan between today and the sports deadline", () => {
    const plan = buildSportsPlan(
      [
        { date: "2026-06-09", dayweather: "晴", nightweather: "晴" },
        { date: "2026-06-10", dayweather: "多云", nightweather: "晴" },
        { date: "2026-06-11", dayweather: "小雨", nightweather: "阴" },
        { date: "2026-06-20", dayweather: "晴", nightweather: "晴" }
      ],
      new Date("2026-06-10T08:00:00")
    );

    expect(plan).toHaveLength(2);
    expect(plan.map((day) => day.date)).toEqual(["2026-06-10", "2026-06-11"]);
    expect(plan.map((day) => day.runnable)).toEqual([true, false]);
  });

  it("clamps target runs to the valid graduation-safe range", () => {
    expect(clampTargetRuns(30)).toBe(45);
    expect(clampTargetRuns(45)).toBe(45);
    expect(clampTargetRuns(60)).toBe(60);
    expect(clampTargetRuns(80)).toBe(65);
  });
});

