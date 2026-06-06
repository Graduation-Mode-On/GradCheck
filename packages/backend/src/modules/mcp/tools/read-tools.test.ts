import { describe, expect, it, vi } from "vitest";

import type { McpDependencies } from "../mcp.context.js";
import { createToolRecorder, textOf } from "../mcp.test-helpers.js";
import { registerCoursesTools } from "./courses.tools.js";
import { registerGpaTools } from "./gpa.tools.js";
import { registerHomeTools } from "./home.tools.js";
import { registerProfileTools } from "./profile.tools.js";

describe("read tools", () => {
  it("home.summary is registered", () => {
    const rec = createToolRecorder();
    const homeSummaryDependencies = { tag: "deps" } as unknown as McpDependencies["homeSummaryDependencies"];
    registerHomeTools(rec.server, { userId: "u1" }, { homeSummaryDependencies } as McpDependencies);
    expect(rec.has("home.summary")).toBe(true);
  });

  it("profile.get returns the profile", async () => {
    const getProfile = vi.fn(async () => ({ id: "u1", nickname: "Riv" }));
    const rec = createToolRecorder();
    registerProfileTools(rec.server, { userId: "u1" }, {
      authRepository: { getProfile }
    } as unknown as McpDependencies);
    const out = await rec.call("profile.get");
    expect(getProfile).toHaveBeenCalledWith("u1");
    expect(textOf(out)).toContain("Riv");
  });

  it("gpa and courses tools are registered", () => {
    const rec = createToolRecorder();
    registerGpaTools(rec.server, { userId: "u1" }, { gpaRepository: {} } as unknown as McpDependencies);
    registerCoursesTools(rec.server, { userId: "u1" }, { coursesProgressRepository: {} } as unknown as McpDependencies);
    expect(rec.names().sort()).toEqual(
      [
        "courses.ignore_group",
        "courses.progress",
        "courses.unignore_group",
        "gpa.dashboard",
        "gpa.fix_match",
        "gpa.list_matches",
        "gpa.rematch"
      ].sort()
    );
  });
});
