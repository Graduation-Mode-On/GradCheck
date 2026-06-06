import { describe, expect, it, vi } from "vitest";

import type { AuthRepository } from "../auth/auth.repository.js";
import { resolveUserId } from "./mcp.auth.js";

vi.mock("../auth/auth.service.js", () => ({
  verifyToken: (token: string) => {
    if (token === "good") return "user-1";
    throw new Error("bad token");
  },
  getCurrentUser: async (_repo: unknown, userId: string) => ({ id: userId })
}));

const repo = {} as AuthRepository;

describe("resolveUserId", () => {
  it("returns userId for valid bearer", async () => {
    expect(await resolveUserId(repo, "Bearer good")).toBe("user-1");
  });

  it("throws -32001 when header missing", async () => {
    await expect(resolveUserId(repo, undefined)).rejects.toMatchObject({ code: -32001 });
  });

  it("throws -32001 when token invalid", async () => {
    await expect(resolveUserId(repo, "Bearer bad")).rejects.toMatchObject({ code: -32001 });
  });
});
