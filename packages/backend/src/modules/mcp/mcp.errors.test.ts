import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";

import { HttpError } from "../../lib/http-error.js";
import { McpError, mcpError, toMcpError } from "./mcp.errors.js";

describe("mcp.errors", () => {
  it("mcpError builds a coded error", () => {
    const err = mcpError(-32001, "no auth");
    expect(err).toBeInstanceOf(McpError);
    expect(err.code).toBe(-32001);
    expect(err.message).toBe("no auth");
  });

  it("maps ZodError to -32602", () => {
    const zErr = z.object({ a: z.string() }).safeParse({});
    const err = toMcpError((zErr as { error: ZodError }).error);
    expect(err.code).toBe(-32602);
  });

  it("maps 401 HttpError to -32001 and others to -32000", () => {
    expect(toMcpError(new HttpError(401, "x")).code).toBe(-32001);
    expect(toMcpError(new HttpError(404, "y")).code).toBe(-32000);
  });

  it("passes through existing McpError", () => {
    const original = mcpError(-32000, "biz");
    expect(toMcpError(original)).toBe(original);
  });
});
