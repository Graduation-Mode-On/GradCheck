import { describe, expect, it } from "vitest";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompts } from "./index.js";

describe("prompts", () => {
  it("registers 3 prompts", () => {
    const names: string[] = [];
    const server = {
      registerPrompt(name: string) {
        names.push(name);
      }
    } as unknown as McpServer;
    registerPrompts(server);
    expect(names.sort()).toEqual(["add_exam", "daily_briefing", "weekly_review"]);
  });
});
