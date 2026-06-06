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

describe("router for lecture practice and volunteer labor", () => {
  it("registers lecture practice and volunteer routes", () => {
    expect(router.hasRoute("lecture-practice")).toBe(true);
    expect(router.hasRoute("volunteer")).toBe(true);
    expect(router.resolve({ name: "lecture-practice" }).path).toBe("/lecture-practice");
    expect(router.resolve({ name: "volunteer" }).path).toBe("/volunteer");
  });
});

describe("router placeholders for homepage feature entries", () => {
  it("registers placeholder routes for all homepage feature entry targets", () => {
    const expectedRoutes = [
      ["plans", "/plans"],
      ["courses", "/courses"],
      ["gpa", "/gpa"],
      ["course-recommendations", "/course-recommendations"],
      ["sports", "/sports"],
      ["volunteer", "/volunteer"],
      ["exams", "/exams"],
      ["custom-requirements", "/custom-requirements"],
      ["graduation-gift", "/graduation-gift"]
    ] as const;

    for (const [name, path] of expectedRoutes) {
      expect(router.hasRoute(name)).toBe(true);
      expect(router.resolve({ name }).path).toBe(path);
    }
  });
});
