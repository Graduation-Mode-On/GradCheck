import { describe, expect, it } from "vitest";

import { calculateCustomRequirementProgress, deriveCustomRequirementStatus } from "./custom-requirement.status.js";

const baseDate = new Date("2026-06-06T00:00:00.000Z");

describe("custom requirement status", () => {
  it("marks pending-confirmation sources as pending before any other status", () => {
    expect(
      deriveCustomRequirementStatus({
        source: "pending_confirmation",
        currentValue: 10,
        targetValue: 1,
        deadline: "2026-06-07",
        now: baseDate
      })
    ).toBe("pending_confirmation");
  });

  it("marks requirements completed when current value reaches target value", () => {
    expect(
      deriveCustomRequirementStatus({
        source: "user_custom",
        currentValue: 5,
        targetValue: 4,
        deadline: null,
        now: baseDate
      })
    ).toBe("completed");
  });

  it("keeps partial requirements due within 14 days in progress", () => {
    expect(
      deriveCustomRequirementStatus({
        source: "college_requirement",
        currentValue: 1,
        targetValue: 4,
        deadline: "2026-06-15",
        now: baseDate
      })
    ).toBe("in_progress");
  });

  it("keeps not-started requirements due on the 14th calendar day not started", () => {
    expect(
      deriveCustomRequirementStatus({
        source: "college_requirement",
        currentValue: 0,
        targetValue: 4,
        deadline: "2026-06-20",
        now: baseDate
      })
    ).toBe("not_started");
  });

  it("marks partial progress outside the risk window as in progress", () => {
    expect(
      deriveCustomRequirementStatus({
        source: "user_custom",
        currentValue: 1,
        targetValue: 4,
        deadline: "2026-07-30",
        now: baseDate
      })
    ).toBe("in_progress");
  });

  it("marks zero progress outside the risk window as not started", () => {
    expect(
      deriveCustomRequirementStatus({
        source: "user_custom",
        currentValue: 0,
        targetValue: 4,
        deadline: null,
        now: baseDate
      })
    ).toBe("not_started");
  });

  it("caps display progress at 100 percent while preserving over-completion values", () => {
    expect(calculateCustomRequirementProgress({ currentValue: 5, targetValue: 4 })).toEqual({
      ratio: 1,
      percent: 100
    });
  });
});
