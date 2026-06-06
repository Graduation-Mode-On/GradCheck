import { describe, expect, it } from "vitest";

import { router } from "./router";

describe("router placeholders for mobile tabs", () => {
  it("registers news and plaza routes used by the mobile bottom navigation", () => {
    expect(router.hasRoute("news")).toBe(true);
    expect(router.hasRoute("plaza")).toBe(true);
    expect(router.resolve({ name: "news" }).path).toBe("/news");
    expect(router.resolve({ name: "plaza" }).path).toBe("/plaza");
  });
});
