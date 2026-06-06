import { describe, expect, it, vi } from "vitest";

import type { McpDependencies } from "../mcp.context.js";
import { createToolRecorder, textOf } from "../mcp.test-helpers.js";
import { registerProgramPlanTools } from "./program-plans.tools.js";
import { registerCustomRequirementTools } from "./custom-requirements.tools.js";

describe("program + custom tools", () => {
  it("program_plans.bound returns the bound plan", async () => {
    const getBoundPlan = vi.fn(async () => ({ id: "p1", major: "CS" }));
    const rec = createToolRecorder();
    registerProgramPlanTools(rec.server, { userId: "u1" }, {
      programPlanRepository: { getBoundPlan }
    } as unknown as McpDependencies);
    const out = await rec.call("program_plans.bound");
    expect(getBoundPlan).toHaveBeenCalledWith("u1");
    expect(textOf(out)).toContain("CS");
  });

  it("custom_requirements.create is registered", () => {
    const create = vi.fn(async (_u: string, input: Record<string, unknown>) => ({ id: "c1", ...input }));
    const rec = createToolRecorder();
    registerCustomRequirementTools(rec.server, { userId: "u1" }, {
      customRequirementRepository: { create }
    } as unknown as McpDependencies);
    expect(rec.has("custom_requirements.create")).toBe(true);
  });

  it("registers expected tool names", () => {
    const rec = createToolRecorder();
    registerProgramPlanTools(rec.server, { userId: "u1" }, { programPlanRepository: {} } as unknown as McpDependencies);
    registerCustomRequirementTools(rec.server, { userId: "u1" }, {
      customRequirementRepository: {}
    } as unknown as McpDependencies);
    expect(rec.names().sort()).toEqual(
      [
        "custom_requirements.create",
        "custom_requirements.delete",
        "custom_requirements.list",
        "custom_requirements.update",
        "program_plans.bind",
        "program_plans.bound",
        "program_plans.reusable"
      ].sort()
    );
  });
});
