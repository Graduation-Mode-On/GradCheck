import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import { createApp, type AppDependencies } from "../../app.js";

process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-key-1234567890-abcdef";

function makeToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET as string, { expiresIn: "1h" });
}

function baseDeps(): AppDependencies {
  const authRepository = {
    findUserById: async (id: string) => ({
      id,
      email: "a@b.c",
      passwordHash: "",
      createdAt: new Date(),
      updatedAt: new Date()
    }),
    getProfile: async () => null
  } as unknown as AppDependencies["authRepository"];
  return {
    authRepository,
    labExamEvents: {
      db: {},
      createLabExamEventRepository: () => ({}),
      createReminderRepository: () => ({})
    },
    mcp: { authRepository, rateLimitPerMinute: 60 } as unknown as AppDependencies["mcp"]
  } as unknown as AppDependencies;
}

async function initialize(app: ReturnType<typeof createApp>, token?: string) {
  const req = request(app)
    .post("/mcp")
    .set("Accept", "application/json, text/event-stream")
    .set("Content-Type", "application/json");
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req.send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" }
    }
  });
}

describe("/mcp", () => {
  let app: ReturnType<typeof createApp>;
  beforeAll(() => {
    app = createApp(baseDeps());
  });

  it("rejects initialize without bearer token (-32001)", async () => {
    const res = await initialize(app);
    expect(res.text).toContain("-32001");
  });

  it("completes initialize with a valid token", async () => {
    const res = await initialize(app, makeToken("user-1"));
    expect(res.status).toBe(200);
    expect(res.headers["mcp-session-id"]).toBeTruthy();
  });

  it("returns 429 once over the per-minute limit", async () => {
    const limitedDeps = baseDeps();
    (limitedDeps.mcp as { rateLimitPerMinute: number }).rateLimitPerMinute = 1;
    const limitedApp = createApp(limitedDeps);
    const token = makeToken("user-1");
    await initialize(limitedApp, token);
    const res = await initialize(limitedApp, token);
    expect(res.status).toBe(429);
  });
});
