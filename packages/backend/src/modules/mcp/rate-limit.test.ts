import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRateLimiter } from "./rate-limit.js";

describe("createRateLimiter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows up to the limit then blocks", () => {
    const limiter = createRateLimiter(2, 60_000);
    expect(limiter.check("t")).toBe(true);
    expect(limiter.check("t")).toBe(true);
    expect(limiter.check("t")).toBe(false);
  });

  it("resets after the window", () => {
    const limiter = createRateLimiter(1, 60_000);
    expect(limiter.check("t")).toBe(true);
    expect(limiter.check("t")).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(limiter.check("t")).toBe(true);
  });

  it("tracks tokens independently", () => {
    const limiter = createRateLimiter(1, 60_000);
    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("b")).toBe(true);
    expect(limiter.check("a")).toBe(false);
  });
});
