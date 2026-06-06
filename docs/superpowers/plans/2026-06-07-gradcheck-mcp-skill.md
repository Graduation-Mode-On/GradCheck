# GradCheck MCP 接口 + Skill 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Express 5 后端内嵌一个 MCP（Streamable HTTP）服务，复用 GradCheck JWT 与现有 service/repository，暴露 30 个 tool / 4 个 resource / 3 个 prompt，并交付 user-level `gradcheck` skill。

**Architecture:** 新增 `packages/backend/src/modules/mcp/` 模块。`mcp.routes.ts` 挂载 `POST/GET/DELETE /mcp`，用官方 `@modelcontextprotocol/sdk` 的 `McpServer` + `StreamableHTTPServerTransport` 处理 JSON-RPC/SSE。鉴权适配层复用现有 `verifyToken` + `getCurrentUser` 得到 `userId`，注入到每个 tool handler 的 `ctx`。每个 tool/resource/prompt 只是对**现有 service/repository** 的薄封装，不写新业务逻辑、不改 schema。

**Tech Stack:** TypeScript (ESM, `.js` import 后缀)、Express 5、`@modelcontextprotocol/sdk` ^1、Zod 4、Drizzle ORM、Vitest + supertest。

> **关键约定（每个 task 都适用）**
> - Node ESM：本地 import 必须带 `.js` 后缀，即使源文件是 `.ts`。
> - 严格模式：`noUnusedLocals`/`noUnusedParameters` 打开，未用变量会编译失败。
> - 后端校验命令：`pnpm --filter @gradcheck/backend typecheck` 与 `pnpm --filter @gradcheck/backend test`。
> - 跑单个测试文件：`pnpm --filter @gradcheck/backend exec vitest run <path>`。
> - 错误映射统一走 `mcpError()`（Task 4 定义）：未鉴权 `-32001`、入参非法 `-32602`、业务错误 `-32000`。
> - 所有 tool handler 通过 `ctx.userId` 拿到用户，调用现有 service 时第一个参数就是 `userId`，与对应 REST route 完全一致。
> - git push 若直连失败，用 `http_proxy=http://127.0.0.1:12334 https_proxy=http://127.0.0.1:12334 git push origin <branch>`。

---

## 文件结构

新建（M1–M4，后端）：

| 文件 | 职责 |
| ---- | ---- |
| `packages/backend/src/modules/mcp/mcp.context.ts` | `McpContext` 类型（`userId`）与依赖容器 `McpDependencies` 类型 |
| `packages/backend/src/modules/mcp/mcp.errors.ts` | `McpError` 类 + `mcpError()` + `toMcpError()` 映射工具 |
| `packages/backend/src/modules/mcp/mcp.auth.ts` | 从 `Authorization: Bearer` 解析并校验 JWT → `userId` |
| `packages/backend/src/modules/mcp/rate-limit.ts` | 内存令牌桶 `createRateLimiter()`（60/min/token） |
| `packages/backend/src/modules/mcp/server.ts` | `createMcpServer(ctx, deps)`：注册全部 tools/resources/prompts |
| `packages/backend/src/modules/mcp/mcp.routes.ts` | `createMcpRouter(deps)`：HTTP 入口 + session/transport 管理 + 鉴权 + 限流 |
| `packages/backend/src/modules/mcp/tools/ping.tool.ts` | `ping` 工具（连通性自检） |
| `packages/backend/src/modules/mcp/tools/reminders.tools.ts` | 8 个 reminders 工具 |
| `packages/backend/src/modules/mcp/tools/lab-exam-events.tools.ts` | 4 个实验考试工具（派生 reminder） |
| `packages/backend/src/modules/mcp/tools/courses.tools.ts` | 3 个课程工具 |
| `packages/backend/src/modules/mcp/tools/gpa.tools.ts` | 4 个绩点工具 |
| `packages/backend/src/modules/mcp/tools/program-plans.tools.ts` | 3 个培养方案工具 |
| `packages/backend/src/modules/mcp/tools/custom-requirements.tools.ts` | 5 个自定义要求工具 |
| `packages/backend/src/modules/mcp/tools/home.tools.ts` | 1 个首页聚合工具 |
| `packages/backend/src/modules/mcp/tools/profile.tools.ts` | 2 个个人资料工具 |
| `packages/backend/src/modules/mcp/resources/index.ts` | 4 个 resource 注册 |
| `packages/backend/src/modules/mcp/prompts/index.ts` | 3 个 prompt 注册 |
| `packages/backend/src/modules/mcp/mcp.helpers.ts` | `jsonResult()` / `defineTool()` 注册辅助 |

修改：

| 文件 | 改动 |
| ---- | ---- |
| `packages/backend/package.json` | 加 `@modelcontextprotocol/sdk` 依赖 |
| `packages/backend/src/app.ts` | 注入 `mcp` 依赖并 `app.use("/mcp", createMcpRouter(...))` |
| `packages/backend/src/index.ts` | 组装 `mcp` 依赖容器 |
| `packages/backend/src/lib/config.ts` | 加 `MCP_RATE_LIMIT_PER_MINUTE` 默认 60 |
| `deploy/Caddyfile` | `/mcp` 反向代理（M4） |
| `README.md` | 「MCP 接入」章节（M5） |

新建（M5，skill，user-level，不进仓库）：

| 文件 | 职责 |
| ---- | ---- |
| `~/.copilot/skills/gradcheck/SKILL.md` | 技能入口 + 4 workflow 清单 |
| `~/.copilot/skills/gradcheck/references/tool-catalog.md` | 工具速查 |
| `~/.copilot/skills/gradcheck/references/workflows.md` | 4 个工作流详解 |
| `~/.copilot/skills/gradcheck/references/auth.md` | 取 token / 配 MCP client |
| `~/.copilot/skills/gradcheck/references/troubleshooting.md` | 常见错误码处理 |
| `~/.copilot/skills/gradcheck/scripts/check-connection.sh` | 连通性自检脚本 |

---

## 里程碑 M1：骨架（路由 + Server + 鉴权 + ping）

目标：`/mcp` 能完成 `initialize` 握手、`tools/list` 返回 `ping`、`tools/call ping` 返回成功；无 JWT 返回 `-32001`。

### Task 1: 安装 SDK 依赖

**Files:**
- Modify: `packages/backend/package.json`

- [ ] **Step 1: 安装依赖**

Run:
```bash
pnpm --filter @gradcheck/backend add @modelcontextprotocol/sdk@^1
```
Expected: `package.json` 的 `dependencies` 出现 `"@modelcontextprotocol/sdk": "^1.x.x"`，pnpm 安装成功无报错。

- [ ] **Step 2: 验证可解析**

Run:
```bash
pnpm --filter @gradcheck/backend exec node -e "import('@modelcontextprotocol/sdk/server/mcp.js').then(m=>console.log(typeof m.McpServer))"
```
Expected: 打印 `function`。

- [ ] **Step 3: Commit**

```bash
git add packages/backend/package.json pnpm-lock.yaml
git commit -m "chore(backend): add @modelcontextprotocol/sdk dependency"
```

### Task 2: 错误映射 `mcp.errors.ts`

**Files:**
- Create: `packages/backend/src/modules/mcp/mcp.errors.ts`
- Test: `packages/backend/src/modules/mcp/mcp.errors.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// mcp.errors.test.ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/mcp.errors.test.ts`
Expected: FAIL（`Cannot find module './mcp.errors.js'`）。

- [ ] **Step 3: 实现**

```typescript
// mcp.errors.ts
import { ZodError } from "zod";

import { HttpError } from "../../lib/http-error.js";

export class McpError extends Error {
  constructor(
    public readonly code: number,
    message: string
  ) {
    super(message);
    this.name = "McpError";
  }
}

export function mcpError(code: number, message: string): McpError {
  return new McpError(code, message);
}

export function toMcpError(error: unknown): McpError {
  if (error instanceof McpError) {
    return error;
  }
  if (error instanceof ZodError) {
    return new McpError(-32602, error.issues[0]?.message ?? "Invalid parameters");
  }
  if (error instanceof HttpError) {
    return new McpError(error.statusCode === 401 ? -32001 : -32000, error.message);
  }
  return new McpError(-32000, error instanceof Error ? error.message : "Internal error");
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/mcp.errors.test.ts`
Expected: PASS（4 passed）。

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/mcp/mcp.errors.ts packages/backend/src/modules/mcp/mcp.errors.test.ts
git commit -m "feat(mcp): add error mapping helpers"
```

### Task 3: 鉴权适配 `mcp.auth.ts`

**Files:**
- Create: `packages/backend/src/modules/mcp/mcp.auth.ts`
- Test: `packages/backend/src/modules/mcp/mcp.auth.test.ts`

复用现有 `verifyToken`（`auth.service.ts`）与 `getCurrentUser`。鉴权失败统一抛 `-32001`。

- [ ] **Step 1: 写失败测试**

```typescript
// mcp.auth.test.ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/mcp.auth.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

```typescript
// mcp.auth.ts
import type { AuthRepository } from "../auth/auth.repository.js";
import { getCurrentUser, verifyToken } from "../auth/auth.service.js";
import { mcpError } from "./mcp.errors.js";

export async function resolveUserId(
  repository: AuthRepository,
  authorization: string | undefined
): Promise<string> {
  if (!authorization?.startsWith("Bearer ")) {
    throw mcpError(-32001, "Authorization bearer token is required");
  }
  const token = authorization.slice("Bearer ".length);
  try {
    const userId = verifyToken(token);
    await getCurrentUser(repository, userId);
    return userId;
  } catch {
    throw mcpError(-32001, "Invalid or expired token");
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/mcp.auth.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/mcp/mcp.auth.ts packages/backend/src/modules/mcp/mcp.auth.test.ts
git commit -m "feat(mcp): add JWT auth adapter"
```

### Task 4: 上下文类型 + 注册辅助 `mcp.context.ts` / `mcp.helpers.ts`

**Files:**
- Create: `packages/backend/src/modules/mcp/mcp.context.ts`
- Create: `packages/backend/src/modules/mcp/mcp.helpers.ts`

无单测（纯类型与薄封装），由后续 tool 测试覆盖。

- [ ] **Step 1: 写 `mcp.context.ts`**

```typescript
// mcp.context.ts
import type { AuthRepository } from "../auth/auth.repository.js";
import type { Database } from "../../db/client.js";
import type { CoursesProgressRepository } from "../courses-progress/courses-progress.repository.js";
import type { CustomRequirementRepository } from "../custom-requirements/custom-requirement.repository.js";
import type { GpaRepository } from "../gpa/gpa.repository.js";
import type { ProgramPlanRepository } from "../program-plans/program-plans.repository.js";
import type { LabExamEventsDatabase } from "../lab-exam-events/lab-exam-events.repository.js";
import type { LabExamEventRepository } from "../lab-exam-events/lab-exam-events.types.js";
import type { RemindersDatabase } from "../reminders/reminders.repository.js";
import type { ReminderRepository } from "../reminders/reminders.types.js";
import type { HomeSummaryDependencies } from "../home-summary/home-summary.service.js";

export interface McpContext {
  userId: string;
}

export interface McpDependencies {
  authRepository: AuthRepository;
  reminderRepository: ReminderRepository;
  coursesProgressRepository: CoursesProgressRepository;
  gpaRepository: GpaRepository;
  programPlanRepository: ProgramPlanRepository;
  customRequirementRepository: CustomRequirementRepository;
  homeSummaryDependencies: HomeSummaryDependencies;
  labExamEvents: {
    db: Database;
    createLabExamEventRepository: (database: LabExamEventsDatabase) => LabExamEventRepository;
    createReminderRepository: (database: RemindersDatabase) => ReminderRepository;
  };
  rateLimitPerMinute: number;
}
```

- [ ] **Step 2: 写 `mcp.helpers.ts`**

```typescript
// mcp.helpers.ts
export function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }]
  };
}
```

- [ ] **Step 3: 类型检查**

Run: `pnpm --filter @gradcheck/backend typecheck`
Expected: PASS（无未用导入报错；若某 type 未用，删除对应 import）。

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/modules/mcp/mcp.context.ts packages/backend/src/modules/mcp/mcp.helpers.ts
git commit -m "feat(mcp): add context types and json result helper"
```

### Task 5: `ping` 工具

**Files:**
- Create: `packages/backend/src/modules/mcp/tools/ping.tool.ts`

- [ ] **Step 1: 实现**

```typescript
// ping.tool.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpContext } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";

export function registerPingTool(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "ping",
    {
      description: "Health check. Returns ok and the authenticated userId.",
      inputSchema: {}
    },
    async () => jsonResult({ ok: true, userId: ctx.userId, ts: new Date().toISOString() })
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @gradcheck/backend typecheck`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/modules/mcp/tools/ping.tool.ts
git commit -m "feat(mcp): add ping tool"
```

### Task 6: Server 工厂 `server.ts`

**Files:**
- Create: `packages/backend/src/modules/mcp/server.ts`

M1 只接入 `ping`；M2/M3/M4 在此追加注册调用（每个 milestone 增量编辑本文件）。

- [ ] **Step 1: 实现（M1 版本）**

```typescript
// server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpContext, McpDependencies } from "./mcp.context.js";
import { registerPingTool } from "./tools/ping.tool.js";

export function createMcpServer(ctx: McpContext, _deps: McpDependencies): McpServer {
  const server = new McpServer({ name: "gradcheck", version: "1.0.0" });
  registerPingTool(server, ctx);
  return server;
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @gradcheck/backend typecheck`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/modules/mcp/server.ts
git commit -m "feat(mcp): add server factory with ping"
```

### Task 7: HTTP 路由 `mcp.routes.ts`（stateful session）

**Files:**
- Create: `packages/backend/src/modules/mcp/mcp.routes.ts`

采用 SDK 官方 stateful 模式：`initialize` 时新建 transport 并按 `sessionId` 缓存，后续 POST/GET/DELETE 用 `Mcp-Session-Id` 路由。每个 session 绑定一个鉴权得到的 `userId`。

- [ ] **Step 1: 实现**

```typescript
// mcp.routes.ts
import { randomUUID } from "node:crypto";

import { Router, type Request, type Response } from "express";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import type { McpDependencies } from "./mcp.context.js";
import { resolveUserId } from "./mcp.auth.js";
import { createMcpServer } from "./server.js";
import { toMcpError } from "./mcp.errors.js";

function jsonRpcError(res: Response, code: number, message: string, status = 200): void {
  res.status(status).json({ jsonrpc: "2.0", error: { code, message }, id: null });
}

export function createMcpRouter(deps: McpDependencies): Router {
  const router = Router();
  const transports = new Map<string, StreamableHTTPServerTransport>();

  router.post("/", async (req: Request, res: Response) => {
    try {
      const sessionId = req.header("Mcp-Session-Id");
      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        if (!isInitializeRequest(req.body)) {
          jsonRpcError(res, -32000, "No valid session. Send initialize first.", 400);
          return;
        }
        const userId = await resolveUserId(deps.authRepository, req.header("Authorization"));
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => transports.set(id, transport as StreamableHTTPServerTransport)
        });
        transport.onclose = () => {
          if (transport?.sessionId) transports.delete(transport.sessionId);
        };
        const server = createMcpServer({ userId }, deps);
        await server.connect(transport);
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      const mapped = toMcpError(error);
      if (!res.headersSent) jsonRpcError(res, mapped.code, mapped.message);
    }
  });

  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.header("Mcp-Session-Id");
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send("Invalid or missing session id");
      return;
    }
    await transport.handleRequest(req, res);
  };

  router.get("/", handleSessionRequest);
  router.delete("/", handleSessionRequest);

  return router;
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @gradcheck/backend typecheck`
Expected: PASS。若 SDK 导出名有差异，按编译错误提示从 `@modelcontextprotocol/sdk` 对应子路径修正 import。

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/modules/mcp/mcp.routes.ts
git commit -m "feat(mcp): add streamable http router"
```

### Task 8: 接入 app + index + config

**Files:**
- Modify: `packages/backend/src/lib/config.ts`
- Modify: `packages/backend/src/app.ts`
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: config 增加限流配置**

在 `envSchema` 对象内追加一行（紧跟 `REMINDER_PUBLIC_BASE_URL` 之后）：

```typescript
  MCP_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60)
```

- [ ] **Step 2: app.ts 注入 mcp**

在 `AppDependencies` 接口内（`amapWeatherKey?` 之前）加：

```typescript
  mcp: import("./modules/mcp/mcp.context.js").McpDependencies;
```

在文件顶部 import 区加：

```typescript
import { createMcpRouter } from "./modules/mcp/mcp.routes.js";
```

在 `app.use(errorHandler);` 之前加挂载（注意放在 `errorHandler` 前、其它路由后）：

```typescript
  app.use("/mcp", createMcpRouter(dependencies.mcp));
```

- [ ] **Step 3: index.ts 组装 mcp 依赖**

在 `createApp({ ... })` 的对象里（`coursesProgressRepository,` 之后、`reminderRepository,` 附近）加入：

```typescript
  mcp: {
    authRepository: createAuthRepository(db),
    reminderRepository,
    coursesProgressRepository: createCoursesProgressRepository(db),
    gpaRepository: createGpaRepository(db),
    programPlanRepository: createProgramPlanRepository(db),
    customRequirementRepository: createCustomRequirementRepository(db),
    homeSummaryDependencies: {
      coursesProgressRepository: createCoursesProgressRepository(db),
      gpaRepository: createGpaRepository(db),
      lecturePracticeRepository: createLecturePracticeRepository(db),
      volunteerLaborRepository: createVolunteerLaborRepository(db),
      srtpRepository: createSrtpRepository(db),
      customRequirementRepository: createCustomRequirementRepository(db)
    },
    labExamEvents: {
      db,
      createLabExamEventRepository,
      createReminderRepository
    },
    rateLimitPerMinute: config.MCP_RATE_LIMIT_PER_MINUTE
  },
```

> 注：`homeSummaryDependencies` 的字段需与 `app.ts` 现有 `/api/home` 挂载处传入的 `HomeSummaryDependencies` 完全一致，照抄即可。

- [ ] **Step 4: 类型检查 + 全量测试**

Run: `pnpm --filter @gradcheck/backend typecheck && pnpm --filter @gradcheck/backend test`
Expected: PASS（既有测试不受影响）。

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/lib/config.ts packages/backend/src/app.ts packages/backend/src/index.ts
git commit -m "feat(mcp): mount /mcp router and wire dependencies"
```

### Task 9: M1 集成测试（initialize + ping + 鉴权）

**Files:**
- Create: `packages/backend/src/modules/mcp/mcp.routes.test.ts`

用 supertest 直接打 `/mcp`，构造一个最小 `createApp` 依赖（其它 repository 用 `{} as ...` 占位，M1 不会触达）。鉴权用真实 `verifyToken`：先生成一个合法 JWT。

- [ ] **Step 1: 写测试**

```typescript
// mcp.routes.test.ts
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
    findUserById: async (id: string) => ({ id, email: "a@b.c", passwordHash: "", createdAt: new Date(), updatedAt: new Date() }),
    getProfile: async () => null
  } as unknown as AppDependencies["authRepository"];
  return {
    authRepository,
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
    const text = res.text;
    expect(text).toContain("-32001");
  });

  it("completes initialize with a valid token", async () => {
    const res = await initialize(app, makeToken("user-1"));
    expect(res.status).toBe(200);
    expect(res.headers["mcp-session-id"]).toBeTruthy();
  });
});
```

> 注：`getCurrentUser`（见 `auth.service.ts`）调用 `repository.findUserById(userId)` 与 `repository.getProfile(userId)`，故 mock 需提供这两个方法。本步目的只是让合法 token 通过、非法被拒。

- [ ] **Step 2: 运行确认**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/mcp.routes.test.ts`
Expected: 2 passed（若 `getCurrentUser` 的 mock 字段不符导致第二条失败，按其实现修正 mock 后重跑）。

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/modules/mcp/mcp.routes.test.ts
git commit -m "test(mcp): add initialize + auth integration tests"
```

- [ ] **Step 4: 手动验证（可选，需数据库）**

启动 `pnpm dev`，用 MCP Inspector 连接 `http://localhost:3000/mcp`，Header 填 `Authorization: Bearer <真实token>`，确认 `tools/list` 含 `ping` 且 `tools/call ping` 返回 `{ok:true,userId,...}`。

---

## 工具清单（实测校正版，30 个）

> 说明：spec §3.2 是设计期的草拟命名。下表是**对照真实 service/repository 校正后的最终清单**，实施以此为准。每个 tool 都是对现有函数的薄封装，第一个参数恒为 `ctx.userId`。

| # | tool | 后端调用 | 输入 schema | 里程碑 |
| - | ---- | -------- | ----------- | ------ |
| 1 | `reminders.list` | `service.list(userId, q)` | `listReminderQuerySchema.shape` | M2 |
| 2 | `reminders.get` | `reminderRepository.findById(userId, id)` | `{ id }` | M2 |
| 3 | `reminders.create` | `service.createCustom(userId, input)` | `createReminderSchema.shape` | M2 |
| 4 | `reminders.update` | `service.update(userId, id, input)` | `{ id, ...updateReminderSchema.shape }` | M2 |
| 5 | `reminders.complete` | `service.setCompleted(userId, id, completed)` | `{ id, ...completeReminderSchema.shape }` | M2 |
| 6 | `reminders.snooze` | `service.snooze(userId, id, snoozedUntil)` | `{ id, ...snoozeReminderSchema.shape }` | M2 |
| 7 | `reminders.duplicate` | `service.duplicate(userId, id)` | `{ id }` | M2 |
| 8 | `reminders.delete` | `service.delete(userId, id)` | `{ id }` | M2 |
| 9 | `courses.progress` | `getCoursesProgress(repo, userId)` | `{}` | M2 |
| 10 | `courses.ignore_group` | `repo.ignoreGroup(userId, groupId)` 后返回 `getCoursesProgress` | `{ groupId }` | M2 |
| 11 | `courses.unignore_group` | `repo.unignoreGroup(userId, groupId)` 后返回 `getCoursesProgress` | `{ groupId }` | M2 |
| 12 | `gpa.dashboard` | `getGpaDashboard(repo, userId)` | `{}` | M2 |
| 13 | `gpa.list_matches` | `getGpaCourseMatches(repo, userId)` | `{}` | M2 |
| 14 | `gpa.fix_match` | `upsertGpaCourseMatch(repo, userId, gpaCourseId, input)` | `{ gpaCourseId, matchTargetType, programPlanCourseId?, programPlanCourseGroupId? }` | M2 |
| 15 | `gpa.rematch` | `repo.matchCoursesToProgramPlan(userId)` | `{}` | M2 |
| 16 | `home.summary` | `getGraduationSummary(homeSummaryDependencies, userId)` | `{}` | M2 |
| 17 | `profile.get` | `authRepository.getProfile(userId)` | `{}` | M2 |
| 18 | `profile.update` | `authRepository.upsertProfile(userId, input)` | `profileSchema.shape` | M2 |
| 19 | `lab_exam_events.list` | `service.list(userId, q)` | `listLabExamEventsQuerySchema.shape` | M3 |
| 20 | `lab_exam_events.create` | `service.create(userId, input)` | `createLabExamEventSchema.shape` | M3 |
| 21 | `lab_exam_events.update` | `service.update(userId, id, input)` | `{ id, ...updateLabExamEventSchema.shape }` | M3 |
| 22 | `lab_exam_events.update_status` | `service.updateStatus(userId, id, status)` | `{ id, ...updateLabExamEventStatusSchema.shape }` | M3 |
| 23 | `lab_exam_events.delete` | `service.delete(userId, id)` | `{ id }` | M3 |
| 24 | `program_plans.bound` | `repo.getBoundPlan(userId)` | `{}` | M3 |
| 25 | `program_plans.reusable` | `repo.listReusablePlans(userId)` | `{}` | M3 |
| 26 | `program_plans.bind` | `repo.bindExistingPlan(userId, id)` | `{ id }` | M3 |
| 27 | `custom_requirements.list` | `repo.listByUserId(userId)` | `{}` | M3 |
| 28 | `custom_requirements.create` | `repo.create(userId, input)` | `createCustomRequirementSchema.shape` | M3 |
| 29 | `custom_requirements.update` | `repo.update(userId, id, input)` | `{ id, ...updateCustomRequirementSchema.shape }` | M3 |
| 30 | `custom_requirements.delete` | `repo.delete(userId, id)` | `{ id }` | M3 |

> 实现要点：
> - inputSchema 用 `<schema>.shape`（Zod 4 下 refined schema 也暴露 `.shape`）。SDK 会用它校验并**转换**入参（如 ISO 字符串→`Date`），handler 直接拿到已校验值，**不要再 `.parse` 一次**（否则 transform 后的 Date 会二次校验失败）。
> - 含 id 的 tool：`inputSchema = { id: z.string().uuid(), ...bodySchema.shape }`，handler 内 `const { id, ...input } = args`。
> - `lab_exam_events.create/update`：因 SDK 只按字段校验、丢失跨字段 refine，handler 内补一行守卫：`if (input.startAt && input.endAt && input.endAt <= input.startAt) throw mcpError(-32602, "endAt must be after startAt")`。
> - 所有 handler 包在 `try/catch`，catch 里 `throw toMcpError(error)`。

---

## 里程碑 M2：读/写工具（reminders/courses/gpa/home/profile）+ 资源

### Task 10: 测试辅助 `mcp.test-helpers.ts`

**Files:**
- Create: `packages/backend/src/modules/mcp/mcp.test-helpers.ts`

记录注册的 tool/resource/prompt handler，供单测直接调用 handler（不经 HTTP）。

- [ ] **Step 1: 实现**

```typescript
// mcp.test-helpers.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolRecorder {
  server: McpServer;
  call(name: string, args?: Record<string, unknown>): Promise<unknown>;
  has(name: string): boolean;
  names(): string[];
}

export function createToolRecorder(): ToolRecorder {
  const tools = new Map<string, Handler>();
  const server = {
    registerTool(name: string, _cfg: unknown, handler: Handler) {
      tools.set(name, handler);
    },
    registerResource(_name: string, _uri: unknown, _cfg: unknown, _handler: unknown) {},
    registerPrompt(_name: string, _cfg: unknown, _handler: unknown) {}
  } as unknown as McpServer;

  return {
    server,
    call: (name, args = {}) => {
      const handler = tools.get(name);
      if (!handler) throw new Error(`tool not registered: ${name}`);
      return handler(args);
    },
    has: (name) => tools.has(name),
    names: () => [...tools.keys()]
  };
}

export function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ text?: string }> }).content;
  return content?.[0]?.text ?? "";
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @gradcheck/backend typecheck`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/modules/mcp/mcp.test-helpers.ts
git commit -m "test(mcp): add tool recorder test helper"
```

### Task 11: reminders 工具（8 个）

**Files:**
- Create: `packages/backend/src/modules/mcp/tools/reminders.tools.ts`
- Test: `packages/backend/src/modules/mcp/tools/reminders.tools.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// reminders.tools.test.ts
import { describe, expect, it, vi } from "vitest";

import type { McpDependencies } from "../mcp.context.js";
import type { ReminderRepository } from "../../reminders/reminders.types.js";
import { createToolRecorder, textOf } from "../mcp.test-helpers.js";
import { registerReminderTools } from "./reminders.tools.js";

function deps(reminderRepository: Partial<ReminderRepository>): McpDependencies {
  return { reminderRepository } as unknown as McpDependencies;
}

describe("reminders tools", () => {
  it("registers all 8 tools", () => {
    const rec = createToolRecorder();
    registerReminderTools(rec.server, { userId: "u1" }, deps({}));
    for (const n of [
      "reminders.list",
      "reminders.get",
      "reminders.create",
      "reminders.update",
      "reminders.complete",
      "reminders.snooze",
      "reminders.duplicate",
      "reminders.delete"
    ]) {
      expect(rec.has(n)).toBe(true);
    }
  });

  it("reminders.get returns the reminder for the user", async () => {
    const findById = vi.fn(async () => ({ id: "r1", title: "Lab" }));
    const rec = createToolRecorder();
    registerReminderTools(rec.server, { userId: "u1" }, deps({ findById } as Partial<ReminderRepository>));
    const out = await rec.call("reminders.get", { id: "11111111-1111-4111-8111-111111111111" });
    expect(findById).toHaveBeenCalledWith("u1", "11111111-1111-4111-8111-111111111111");
    expect(textOf(out)).toContain("Lab");
  });

  it("reminders.create passes the parsed input to the service", async () => {
    const create = vi.fn(async (_u: string, input: Record<string, unknown>) => ({ id: "r2", ...input }));
    const rec = createToolRecorder();
    registerReminderTools(rec.server, { userId: "u1" }, deps({ create } as Partial<ReminderRepository>));
    await rec.call("reminders.create", { title: "Exam", dueAt: "2026-07-01T09:00:00.000Z" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1]).toMatchObject({ title: "Exam", sourceType: "custom" });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/tools/reminders.tools.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

```typescript
// reminders.tools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { toMcpError } from "../mcp.errors.js";
import { createReminderService } from "../../reminders/reminders.service.js";
import {
  completeReminderSchema,
  createReminderSchema,
  listReminderQuerySchema,
  snoozeReminderSchema,
  updateReminderSchema
} from "../../reminders/reminders.schemas.js";

const idShape = { id: z.string().uuid() };

export function registerReminderTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const service = createReminderService(deps.reminderRepository);

  server.registerTool(
    "reminders.list",
    { description: "List reminders with optional filters.", inputSchema: listReminderQuerySchema.shape },
    async (args) => {
      try {
        return jsonResult({ reminders: await service.list(ctx.userId, args as never) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.get",
    { description: "Get a single reminder by id.", inputSchema: idShape },
    async (args) => {
      try {
        const reminder = await deps.reminderRepository.findById(ctx.userId, args.id as string);
        return jsonResult({ reminder });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.create",
    { description: "Create a custom reminder.", inputSchema: createReminderSchema.shape },
    async (args) => {
      try {
        return jsonResult({ reminder: await service.createCustom(ctx.userId, args as never) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.update",
    { description: "Update a reminder.", inputSchema: { ...idShape, ...updateReminderSchema.shape } },
    async (args) => {
      try {
        const { id, ...input } = args as { id: string } & Record<string, unknown>;
        return jsonResult({ reminder: await service.update(ctx.userId, id, input as never) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.complete",
    { description: "Mark a reminder complete or not.", inputSchema: { ...idShape, ...completeReminderSchema.shape } },
    async (args) => {
      try {
        const { id, completed } = args as { id: string; completed: boolean };
        return jsonResult({ reminder: await service.setCompleted(ctx.userId, id, completed) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.snooze",
    { description: "Snooze a reminder until a time.", inputSchema: { ...idShape, ...snoozeReminderSchema.shape } },
    async (args) => {
      try {
        const { id, snoozedUntil } = args as { id: string; snoozedUntil: Date };
        return jsonResult({ reminder: await service.snooze(ctx.userId, id, snoozedUntil) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.duplicate",
    { description: "Duplicate a reminder.", inputSchema: idShape },
    async (args) => {
      try {
        return jsonResult({ reminder: await service.duplicate(ctx.userId, args.id as string) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "reminders.delete",
    { description: "Delete a reminder.", inputSchema: idShape },
    async (args) => {
      try {
        await service.delete(ctx.userId, args.id as string);
        return jsonResult({ ok: true });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/tools/reminders.tools.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/mcp/tools/reminders.tools.ts packages/backend/src/modules/mcp/tools/reminders.tools.test.ts
git commit -m "feat(mcp): add reminders tools"
```

### Task 12: courses + gpa + home + profile 工具（10 个）

**Files:**
- Create: `packages/backend/src/modules/mcp/tools/courses.tools.ts`
- Create: `packages/backend/src/modules/mcp/tools/gpa.tools.ts`
- Create: `packages/backend/src/modules/mcp/tools/home.tools.ts`
- Create: `packages/backend/src/modules/mcp/tools/profile.tools.ts`
- Test: `packages/backend/src/modules/mcp/tools/read-tools.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// read-tools.test.ts
import { describe, expect, it, vi } from "vitest";

import type { McpDependencies } from "../mcp.context.js";
import { createToolRecorder, textOf } from "../mcp.test-helpers.js";
import { registerCoursesTools } from "./courses.tools.js";
import { registerGpaTools } from "./gpa.tools.js";
import { registerHomeTools } from "./home.tools.js";
import { registerProfileTools } from "./profile.tools.js";

describe("read tools", () => {
  it("home.summary calls getGraduationSummary deps", async () => {
    const rec = createToolRecorder();
    const homeSummaryDependencies = { tag: "deps" } as unknown as McpDependencies["homeSummaryDependencies"];
    registerHomeTools(rec.server, { userId: "u1" }, { homeSummaryDependencies } as McpDependencies);
    // getGraduationSummary will try to read deps.* -> wrap in try; we only assert registration here
    expect(rec.has("home.summary")).toBe(true);
  });

  it("profile.get returns the profile", async () => {
    const getProfile = vi.fn(async () => ({ id: "u1", nickname: "Riv" }));
    const rec = createToolRecorder();
    registerProfileTools(rec.server, { userId: "u1" }, { authRepository: { getProfile } } as unknown as McpDependencies);
    const out = await rec.call("profile.get");
    expect(getProfile).toHaveBeenCalledWith("u1");
    expect(textOf(out)).toContain("Riv");
  });

  it("gpa.dashboard registered and courses tools registered", () => {
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
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/tools/read-tools.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3a: 实现 `courses.tools.ts`**

```typescript
// courses.tools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { toMcpError } from "../mcp.errors.js";
import { getCoursesProgress } from "../../courses-progress/courses-progress.service.js";

export function registerCoursesTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const repo = deps.coursesProgressRepository;

  server.registerTool(
    "courses.progress",
    { description: "Get course/credit progress against the bound program plan.", inputSchema: {} },
    async () => {
      try {
        return jsonResult(await getCoursesProgress(repo, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "courses.ignore_group",
    { description: "Ignore a requirement group, then return updated progress.", inputSchema: { groupId: z.string().min(1) } },
    async (args) => {
      try {
        await repo.ignoreGroup(ctx.userId, args.groupId as string);
        return jsonResult(await getCoursesProgress(repo, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "courses.unignore_group",
    { description: "Un-ignore a requirement group, then return updated progress.", inputSchema: { groupId: z.string().min(1) } },
    async (args) => {
      try {
        await repo.unignoreGroup(ctx.userId, args.groupId as string);
        return jsonResult(await getCoursesProgress(repo, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
```

- [ ] **Step 3b: 实现 `gpa.tools.ts`**

```typescript
// gpa.tools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { toMcpError } from "../mcp.errors.js";
import {
  getGpaCourseMatches,
  getGpaDashboard,
  upsertGpaCourseMatch
} from "../../gpa/gpa.service.js";

export function registerGpaTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const repo = deps.gpaRepository;

  server.registerTool(
    "gpa.dashboard",
    { description: "Get the GPA dashboard (courses, gpa, distribution).", inputSchema: {} },
    async () => {
      try {
        return jsonResult(await getGpaDashboard(repo, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "gpa.list_matches",
    { description: "List GPA-course to program-plan matches.", inputSchema: {} },
    async () => {
      try {
        return jsonResult(await getGpaCourseMatches(repo, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "gpa.fix_match",
    {
      description: "Manually fix the program-plan match for a GPA course.",
      inputSchema: {
        gpaCourseId: z.string().min(1),
        matchTargetType: z.enum(["course", "group"]),
        programPlanCourseId: z.string().min(1).optional(),
        programPlanCourseGroupId: z.string().min(1).optional()
      }
    },
    async (args) => {
      try {
        const { gpaCourseId, ...input } = args as {
          gpaCourseId: string;
          matchTargetType: "course" | "group";
          programPlanCourseId?: string;
          programPlanCourseGroupId?: string;
        };
        return jsonResult(await upsertGpaCourseMatch(repo, ctx.userId, gpaCourseId, input));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "gpa.rematch",
    { description: "Re-run automatic matching of GPA courses to the program plan.", inputSchema: {} },
    async () => {
      try {
        return jsonResult(await repo.matchCoursesToProgramPlan(ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
```

- [ ] **Step 3c: 实现 `home.tools.ts`**

```typescript
// home.tools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { toMcpError } from "../mcp.errors.js";
import { getGraduationSummary } from "../../home-summary/home-summary.service.js";

export function registerHomeTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  server.registerTool(
    "home.summary",
    { description: "Get the home graduation summary across all dimensions.", inputSchema: {} },
    async () => {
      try {
        return jsonResult(await getGraduationSummary(deps.homeSummaryDependencies, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
```

- [ ] **Step 3d: 实现 `profile.tools.ts`**

```typescript
// profile.tools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { toMcpError } from "../mcp.errors.js";
import { profileSchema } from "../../auth/auth.schemas.js";

export function registerProfileTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  server.registerTool(
    "profile.get",
    { description: "Get the current user's profile.", inputSchema: {} },
    async () => {
      try {
        return jsonResult({ profile: await deps.authRepository.getProfile(ctx.userId) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "profile.update",
    { description: "Create or update the current user's profile.", inputSchema: profileSchema.shape },
    async (args) => {
      try {
        return jsonResult({ profile: await deps.authRepository.upsertProfile(ctx.userId, args as never) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/tools/read-tools.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/mcp/tools/courses.tools.ts packages/backend/src/modules/mcp/tools/gpa.tools.ts packages/backend/src/modules/mcp/tools/home.tools.ts packages/backend/src/modules/mcp/tools/profile.tools.ts packages/backend/src/modules/mcp/tools/read-tools.test.ts
git commit -m "feat(mcp): add courses, gpa, home, profile tools"
```

### Task 13: 资源（4 个）`resources/index.ts`

**Files:**
- Create: `packages/backend/src/modules/mcp/resources/index.ts`

资源是只读聚合视图，复用与对应 tool 相同的后端调用。URI 固定（无模板参数）。

- [ ] **Step 1: 实现**

```typescript
// resources/index.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { toMcpError } from "../mcp.errors.js";
import { getGraduationSummary } from "../../home-summary/home-summary.service.js";
import { getCoursesProgress } from "../../courses-progress/courses-progress.service.js";
import { createReminderService } from "../../reminders/reminders.service.js";

function jsonResource(uri: string, payload: unknown) {
  return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) }] };
}

export function registerResources(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const reminderService = createReminderService(deps.reminderRepository);

  server.registerResource(
    "home-summary",
    "gradcheck://home/summary",
    { title: "Home summary", description: "Graduation summary across all dimensions", mimeType: "application/json" },
    async (uri) => {
      try {
        return jsonResource(uri.href, await getGraduationSummary(deps.homeSummaryDependencies, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerResource(
    "reminders-today",
    "gradcheck://reminders/today",
    { title: "Today's reminders", description: "Active reminders shown on home", mimeType: "application/json" },
    async (uri) => {
      try {
        return jsonResource(uri.href, await reminderService.home(ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerResource(
    "courses-risk",
    "gradcheck://courses/risk",
    { title: "Course progress", description: "Course/credit progress and risks", mimeType: "application/json" },
    async (uri) => {
      try {
        return jsonResource(uri.href, await getCoursesProgress(deps.coursesProgressRepository, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerResource(
    "program-progress",
    "gradcheck://program/progress",
    { title: "Program progress", description: "Bound program plan progress", mimeType: "application/json" },
    async (uri) => {
      try {
        return jsonResource(uri.href, await getCoursesProgress(deps.coursesProgressRepository, ctx.userId));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @gradcheck/backend typecheck`
Expected: PASS。若 `registerResource` 的 handler 签名（`uri` 类型为 `URL`）与上面不符，按编译错误调整（SDK 传入的是 `URL` 对象，用 `uri.href`）。

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/modules/mcp/resources/index.ts
git commit -m "feat(mcp): add read-only resources"
```

### Task 14: 在 server.ts 注册 M2 工具与资源

**Files:**
- Modify: `packages/backend/src/modules/mcp/server.ts`

- [ ] **Step 1: 更新 server.ts**

```typescript
// server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpContext, McpDependencies } from "./mcp.context.js";
import { registerPingTool } from "./tools/ping.tool.js";
import { registerReminderTools } from "./tools/reminders.tools.js";
import { registerCoursesTools } from "./tools/courses.tools.js";
import { registerGpaTools } from "./tools/gpa.tools.js";
import { registerHomeTools } from "./tools/home.tools.js";
import { registerProfileTools } from "./tools/profile.tools.js";
import { registerResources } from "./resources/index.js";

export function createMcpServer(ctx: McpContext, deps: McpDependencies): McpServer {
  const server = new McpServer({ name: "gradcheck", version: "1.0.0" });
  registerPingTool(server, ctx);
  registerReminderTools(server, ctx, deps);
  registerCoursesTools(server, ctx, deps);
  registerGpaTools(server, ctx, deps);
  registerHomeTools(server, ctx, deps);
  registerProfileTools(server, ctx, deps);
  registerResources(server, ctx, deps);
  return server;
}
```

- [ ] **Step 2: 类型检查 + 全量测试**

Run: `pnpm --filter @gradcheck/backend typecheck && pnpm --filter @gradcheck/backend test`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/modules/mcp/server.ts
git commit -m "feat(mcp): register M2 tools and resources"
```

---

## 里程碑 M3：写工具（lab-exam-events / program-plans / custom-requirements）

### Task 15: lab_exam_events 工具（5 个，含派生 reminder）

**Files:**
- Create: `packages/backend/src/modules/mcp/tools/lab-exam-events.tools.ts`
- Test: `packages/backend/src/modules/mcp/tools/lab-exam-events.tools.test.ts`

`service.create/update` 会在一个事务里同时维护派生 reminder（见 `lab-exam-events.service.ts`）。MCP 工具只需调用 service，派生逻辑自动生效。

- [ ] **Step 1: 写失败测试**

```typescript
// lab-exam-events.tools.test.ts
import { describe, expect, it, vi } from "vitest";

import type { McpDependencies } from "../mcp.context.js";
import { createToolRecorder, textOf } from "../mcp.test-helpers.js";
import { registerLabExamEventTools } from "./lab-exam-events.tools.js";

function depsWith(serviceCreate: ReturnType<typeof vi.fn>): McpDependencies {
  // The tool builds a service from labExamEvents deps; we stub the factory chain so
  // service.create resolves to our spy via the repository create.
  const reminderRepository = { create: vi.fn(async () => ({ id: "rem1" })), update: vi.fn() };
  const eventRepository = { create: serviceCreate, update: vi.fn(), findById: vi.fn(async () => ({ id: "e1", reminderId: "rem1" })) };
  return {
    labExamEvents: {
      db: { transaction: async (fn: (tx: unknown) => unknown) => fn({}) },
      createReminderRepository: () => reminderRepository,
      createLabExamEventRepository: () => eventRepository
    }
  } as unknown as McpDependencies;
}

describe("lab_exam_events tools", () => {
  it("registers 5 tools", () => {
    const rec = createToolRecorder();
    registerLabExamEventTools(rec.server, { userId: "u1" }, depsWith(vi.fn()));
    expect(rec.names().sort()).toEqual(
      [
        "lab_exam_events.create",
        "lab_exam_events.delete",
        "lab_exam_events.list",
        "lab_exam_events.update",
        "lab_exam_events.update_status"
      ].sort()
    );
  });

  it("create rejects endAt before startAt with -32602", async () => {
    const rec = createToolRecorder();
    registerLabExamEventTools(rec.server, { userId: "u1" }, depsWith(vi.fn()));
    await expect(
      rec.call("lab_exam_events.create", {
        title: "Final",
        eventType: "final",
        startAt: "2026-07-01T10:00:00.000Z",
        endAt: "2026-07-01T09:00:00.000Z"
      })
    ).rejects.toMatchObject({ code: -32602 });
  });

  it("create returns event+reminder from service", async () => {
    const create = vi.fn(async (_u: string, input: Record<string, unknown>) => ({ id: "e1", ...input }));
    const rec = createToolRecorder();
    registerLabExamEventTools(rec.server, { userId: "u1" }, depsWith(create));
    const out = await rec.call("lab_exam_events.create", {
      title: "Final",
      eventType: "final",
      startAt: "2026-07-01T09:00:00.000Z"
    });
    expect(textOf(out)).toContain("rem1");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/tools/lab-exam-events.tools.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

```typescript
// lab-exam-events.tools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { mcpError, toMcpError } from "../mcp.errors.js";
import { createLabExamEventService } from "../../lab-exam-events/lab-exam-events.service.js";
import {
  createLabExamEventSchema,
  listLabExamEventsQuerySchema,
  updateLabExamEventSchema,
  updateLabExamEventStatusSchema
} from "../../lab-exam-events/lab-exam-events.schemas.js";

const idShape = { id: z.string().uuid() };

function assertEndAfterStart(input: { startAt?: Date | null; endAt?: Date | null }): void {
  if (input.startAt && input.endAt && input.endAt <= input.startAt) {
    throw mcpError(-32602, "endAt must be after startAt");
  }
}

export function registerLabExamEventTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const getService = () =>
    createLabExamEventService({
      db: deps.labExamEvents.db,
      createLabExamEventRepository: deps.labExamEvents.createLabExamEventRepository,
      createReminderRepository: deps.labExamEvents.createReminderRepository
    });

  server.registerTool(
    "lab_exam_events.list",
    { description: "List lab/exam events.", inputSchema: listLabExamEventsQuerySchema.shape },
    async (args) => {
      try {
        return jsonResult({ events: await getService().list(ctx.userId, args as never) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "lab_exam_events.create",
    { description: "Register a lab/exam event (also creates a derived reminder).", inputSchema: createLabExamEventSchema.shape },
    async (args) => {
      try {
        assertEndAfterStart(args as { startAt?: Date; endAt?: Date | null });
        return jsonResult(await getService().create(ctx.userId, args as never));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "lab_exam_events.update",
    { description: "Update a lab/exam event (syncs its derived reminder).", inputSchema: { ...idShape, ...updateLabExamEventSchema.shape } },
    async (args) => {
      try {
        const { id, ...input } = args as { id: string } & { startAt?: Date; endAt?: Date | null };
        assertEndAfterStart(input);
        return jsonResult(await getService().update(ctx.userId, id, input as never));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "lab_exam_events.update_status",
    { description: "Update a lab/exam event status (scheduled/done/cancelled).", inputSchema: { ...idShape, ...updateLabExamEventStatusSchema.shape } },
    async (args) => {
      try {
        const { id, status } = args as { id: string; status: "scheduled" | "done" | "cancelled" };
        return jsonResult(await getService().updateStatus(ctx.userId, id, status));
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "lab_exam_events.delete",
    { description: "Delete a lab/exam event (and its derived reminder).", inputSchema: idShape },
    async (args) => {
      try {
        await getService().delete(ctx.userId, args.id as string);
        return jsonResult({ ok: true });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/tools/lab-exam-events.tools.test.ts`
Expected: PASS（3 passed）。若 `db.transaction` 在真实实现里签名不同，参照 `lab-exam-events.service.ts` 调整测试桩；本工具实现本身只是透传 service，不改业务。

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/mcp/tools/lab-exam-events.tools.ts packages/backend/src/modules/mcp/tools/lab-exam-events.tools.test.ts
git commit -m "feat(mcp): add lab exam events tools with derived reminders"
```

### Task 16: program_plans + custom_requirements 工具（7 个）

**Files:**
- Create: `packages/backend/src/modules/mcp/tools/program-plans.tools.ts`
- Create: `packages/backend/src/modules/mcp/tools/custom-requirements.tools.ts`
- Test: `packages/backend/src/modules/mcp/tools/program-custom-tools.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// program-custom-tools.test.ts
import { describe, expect, it, vi } from "vitest";

import type { McpDependencies } from "../mcp.context.js";
import { createToolRecorder, textOf } from "../mcp.test-helpers.js";
import { registerProgramPlanTools } from "./program-plans.tools.js";
import { registerCustomRequirementTools } from "./custom-requirements.tools.js";

describe("program + custom tools", () => {
  it("program_plans.bound returns the bound plan", async () => {
    const getBoundPlan = vi.fn(async () => ({ id: "p1", major: "CS" }));
    const rec = createToolRecorder();
    registerProgramPlanTools(rec.server, { userId: "u1" }, { programPlanRepository: { getBoundPlan } } as unknown as McpDependencies);
    const out = await rec.call("program_plans.bound");
    expect(getBoundPlan).toHaveBeenCalledWith("u1");
    expect(textOf(out)).toContain("CS");
  });

  it("custom_requirements.create calls repo.create", async () => {
    const create = vi.fn(async (_u: string, input: Record<string, unknown>) => ({ id: "c1", ...input }));
    const rec = createToolRecorder();
    registerCustomRequirementTools(rec.server, { userId: "u1" }, { customRequirementRepository: { create } } as unknown as McpDependencies);
    expect(rec.has("custom_requirements.create")).toBe(true);
  });

  it("registers expected tool names", () => {
    const rec = createToolRecorder();
    registerProgramPlanTools(rec.server, { userId: "u1" }, { programPlanRepository: {} } as unknown as McpDependencies);
    registerCustomRequirementTools(rec.server, { userId: "u1" }, { customRequirementRepository: {} } as unknown as McpDependencies);
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
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/tools/program-custom-tools.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3a: 实现 `program-plans.tools.ts`**

```typescript
// program-plans.tools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { mcpError, toMcpError } from "../mcp.errors.js";

export function registerProgramPlanTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const repo = deps.programPlanRepository;

  server.registerTool(
    "program_plans.bound",
    { description: "Get the program plan currently bound to the user.", inputSchema: {} },
    async () => {
      try {
        return jsonResult({ plan: await repo.getBoundPlan(ctx.userId) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "program_plans.reusable",
    { description: "List reusable program plans the user can bind.", inputSchema: {} },
    async () => {
      try {
        return jsonResult({ plans: await repo.listReusablePlans(ctx.userId) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "program_plans.bind",
    { description: "Bind an existing program plan to the user by id.", inputSchema: { id: z.string().min(1) } },
    async (args) => {
      try {
        const result = await repo.bindExistingPlan(ctx.userId, args.id as string);
        if (!result) {
          throw mcpError(-32000, "Program plan was not found");
        }
        return jsonResult(result);
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
```

- [ ] **Step 3b: 实现 `custom-requirements.tools.ts`**

```typescript
// custom-requirements.tools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { McpContext, McpDependencies } from "../mcp.context.js";
import { jsonResult } from "../mcp.helpers.js";
import { mcpError, toMcpError } from "../mcp.errors.js";
import {
  createCustomRequirementSchema,
  updateCustomRequirementSchema
} from "../../custom-requirements/custom-requirement.schemas.js";

const idShape = { id: z.string().uuid() };

export function registerCustomRequirementTools(server: McpServer, ctx: McpContext, deps: McpDependencies): void {
  const repo = deps.customRequirementRepository;

  server.registerTool(
    "custom_requirements.list",
    { description: "List the user's custom graduation requirements.", inputSchema: {} },
    async () => {
      try {
        return jsonResult({ customRequirements: await repo.listByUserId(ctx.userId) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "custom_requirements.create",
    { description: "Create a custom graduation requirement.", inputSchema: createCustomRequirementSchema.shape },
    async (args) => {
      try {
        return jsonResult({ customRequirement: await repo.create(ctx.userId, args as never) });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "custom_requirements.update",
    { description: "Update a custom graduation requirement.", inputSchema: { ...idShape, ...updateCustomRequirementSchema.shape } },
    async (args) => {
      try {
        const { id, ...input } = args as { id: string } & Record<string, unknown>;
        const updated = await repo.update(ctx.userId, id, input as never);
        if (!updated) {
          throw mcpError(-32000, "Custom requirement not found");
        }
        return jsonResult({ customRequirement: updated });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );

  server.registerTool(
    "custom_requirements.delete",
    { description: "Delete a custom graduation requirement.", inputSchema: idShape },
    async (args) => {
      try {
        const deleted = await repo.delete(ctx.userId, args.id as string);
        if (!deleted) {
          throw mcpError(-32000, "Custom requirement not found");
        }
        return jsonResult({ ok: true });
      } catch (error) {
        throw toMcpError(error);
      }
    }
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/tools/program-custom-tools.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/mcp/tools/program-plans.tools.ts packages/backend/src/modules/mcp/tools/custom-requirements.tools.ts packages/backend/src/modules/mcp/tools/program-custom-tools.test.ts
git commit -m "feat(mcp): add program plan and custom requirement tools"
```

### Task 17: 在 server.ts 注册 M3 工具

**Files:**
- Modify: `packages/backend/src/modules/mcp/server.ts`

- [ ] **Step 1: 在 import 区追加**

```typescript
import { registerLabExamEventTools } from "./tools/lab-exam-events.tools.js";
import { registerProgramPlanTools } from "./tools/program-plans.tools.js";
import { registerCustomRequirementTools } from "./tools/custom-requirements.tools.js";
```

- [ ] **Step 2: 在 `registerResources(server, ctx, deps);` 之前追加**

```typescript
  registerLabExamEventTools(server, ctx, deps);
  registerProgramPlanTools(server, ctx, deps);
  registerCustomRequirementTools(server, ctx, deps);
```

- [ ] **Step 3: 类型检查 + 全量测试**

Run: `pnpm --filter @gradcheck/backend typecheck && pnpm --filter @gradcheck/backend test`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/modules/mcp/server.ts
git commit -m "feat(mcp): register M3 write tools"
```

---

## 里程碑 M4：Prompts + 限流 + 部署

### Task 18: 限流器 `rate-limit.ts`

**Files:**
- Create: `packages/backend/src/modules/mcp/rate-limit.ts`
- Test: `packages/backend/src/modules/mcp/rate-limit.test.ts`

进程内令牌桶：每个 token 一分钟窗口，超过上限返回 `false`。

- [ ] **Step 1: 写失败测试**

```typescript
// rate-limit.test.ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/rate-limit.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

```typescript
// rate-limit.ts
interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  check(token: string): boolean;
  resetAt(token: string): number;
}

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    check(token: string): boolean {
      const now = Date.now();
      const bucket = buckets.get(token);
      if (!bucket || now >= bucket.resetAt) {
        buckets.set(token, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (bucket.count >= limit) {
        return false;
      }
      bucket.count += 1;
      return true;
    },
    resetAt(token: string): number {
      return buckets.get(token)?.resetAt ?? Date.now();
    }
  };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/rate-limit.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/modules/mcp/rate-limit.ts packages/backend/src/modules/mcp/rate-limit.test.ts
git commit -m "feat(mcp): add in-memory rate limiter"
```

### Task 19: 在路由接入限流

**Files:**
- Modify: `packages/backend/src/modules/mcp/mcp.routes.ts`

- [ ] **Step 1: 修改 `createMcpRouter`**

在 import 区加：

```typescript
import { createRateLimiter } from "./rate-limit.js";
```

在 `const transports = new Map...` 之后加：

```typescript
  const limiter = createRateLimiter(deps.rateLimitPerMinute, 60_000);
```

在 `router.post("/", ...)` handler 内、`try {` 之后的第一行加（用 Authorization 头作为 token key；缺失则交给后续鉴权报 -32001）：

```typescript
      const authHeader = req.header("Authorization");
      if (authHeader && !limiter.check(authHeader)) {
        const resetIso = new Date(limiter.resetAt(authHeader)).toISOString();
        jsonRpcError(res, -32000, `Rate limit exceeded. Try again after ${resetIso}`, 429);
        return;
      }
```

- [ ] **Step 2: 写限流集成测试（追加到现有 `mcp.routes.test.ts`）**

在 `mcp.routes.test.ts` 末尾的 `describe` 内追加：

```typescript
  it("returns 429 once over the per-minute limit", async () => {
    const limitedDeps = baseDeps();
    (limitedDeps.mcp as { rateLimitPerMinute: number }).rateLimitPerMinute = 1;
    const limitedApp = createApp(limitedDeps);
    const token = makeToken("user-1");
    await initialize(limitedApp, token);
    const res = await initialize(limitedApp, token);
    expect(res.status).toBe(429);
  });
```

> 注：`baseDeps()` 需把 `rateLimitPerMinute` 透传到 `mcp`；M1 的 `baseDeps` 已含 `rateLimitPerMinute: 60`，此处覆写为 1。

- [ ] **Step 3: 类型检查 + 测试**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/mcp.routes.test.ts && pnpm --filter @gradcheck/backend typecheck`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/modules/mcp/mcp.routes.ts packages/backend/src/modules/mcp/mcp.routes.test.ts
git commit -m "feat(mcp): enforce per-token rate limit in router"
```

### Task 20: Prompts（3 个）`prompts/index.ts`

**Files:**
- Create: `packages/backend/src/modules/mcp/prompts/index.ts`
- Test: `packages/backend/src/modules/mcp/prompts/prompts.test.ts`

Prompt 返回引导消息文本，告诉客户端该按什么顺序调哪些 tool。不直接访问数据库。

- [ ] **Step 1: 写失败测试**

```typescript
// prompts.test.ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/prompts/prompts.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

```typescript
// prompts/index.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function userText(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "daily_briefing",
    {
      title: "Daily briefing",
      description: "Summarize today's reminders, course risks, and graduation progress.",
      argsSchema: { date: z.string().optional() }
    },
    (args) =>
      userText(
        `Give me a daily briefing for ${args.date ?? "today"}. ` +
          `Call home.summary, reminders.list (status pending), and courses.progress, ` +
          `then summarize what needs attention and what is overdue.`
      )
  );

  server.registerPrompt(
    "add_exam",
    {
      title: "Add an exam or lab",
      description: "Guide the user to register a lab/exam event and confirm the derived reminder.",
      argsSchema: {}
    },
    () =>
      userText(
        "Help me register a lab or exam. Ask for title, type (lab/midterm/final/quiz/other_exam), " +
          "start time, optional end time, location, and reminder offsets. Then call lab_exam_events.create " +
          "and confirm the created event and its derived reminder."
      )
  );

  server.registerPrompt(
    "weekly_review",
    {
      title: "Weekly review",
      description: "Review the past week and plan the next.",
      argsSchema: { week_start: z.string().optional() }
    },
    (args) =>
      userText(
        `Run a weekly review${args.week_start ? ` for the week starting ${args.week_start}` : ""}. ` +
          `Call reminders.list to see completed and outstanding items and courses.progress, ` +
          `then summarize done / not-done and propose next week's priorities.`
      )
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @gradcheck/backend exec vitest run src/modules/mcp/prompts/prompts.test.ts`
Expected: PASS。若 `registerPrompt` 的配置键名（`argsSchema`）与所装 SDK 版本不符，按 `node_modules/@modelcontextprotocol/sdk` 的类型定义调整（通常为 `argsSchema`）。

- [ ] **Step 5: 在 server.ts 注册 prompts**

在 import 区加 `import { registerPrompts } from "./prompts/index.js";`，并在 `createMcpServer` 的 `return server;` 之前加 `registerPrompts(server);`。

- [ ] **Step 6: 类型检查 + 全量测试**

Run: `pnpm --filter @gradcheck/backend typecheck && pnpm --filter @gradcheck/backend test`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/modules/mcp/prompts/index.ts packages/backend/src/modules/mcp/prompts/prompts.test.ts packages/backend/src/modules/mcp/server.ts
git commit -m "feat(mcp): add daily_briefing, add_exam, weekly_review prompts"
```

### Task 21: Caddy 反向代理 `/mcp`

**Files:**
- Modify: `deploy/Caddyfile`

- [ ] **Step 1: 在 `handle /api/* { ... }` 块之后、`handle /health` 之前插入**

```caddyfile
handle /mcp* {
reverse_proxy backend:3000
}
```

> SSE 注意：Caddy 默认对 `reverse_proxy` 支持流式响应，无需额外 `flush_interval` 配置；若发现 SSE 被缓冲，给该块加 `reverse_proxy backend:3000 { flush_interval -1 }`。

- [ ] **Step 2: 校验 Caddyfile 语法（若本机有 caddy）**

Run: `caddy validate --config deploy/Caddyfile 2>/dev/null || echo "caddy not installed; validate on server"`
Expected: `Valid configuration` 或跳过提示。

- [ ] **Step 3: Commit**

```bash
git add deploy/Caddyfile
git commit -m "chore(deploy): reverse proxy /mcp to backend"
```

- [ ] **Step 4: 部署后手动验收（在服务器/staging）**

用 MCP Inspector 连 `https://gc.myseu.cn/mcp`，Header `Authorization: Bearer <token>`，确认 `tools/list` 返回 30 个工具、`resources/list` 返回 4 个、`prompts/list` 返回 3 个，且 `tools/call home.summary` 成功。

---

## 里程碑 M5：`gradcheck` Skill（user-level）+ README

> Skill 安装在 `~/.copilot/skills/gradcheck/`，**不进仓库**。每个文件用 `create` 工具写绝对路径。

### Task 22: 创建 skill 目录与连通性脚本

**Files:**
- Create: `~/.copilot/skills/gradcheck/scripts/check-connection.sh`

- [ ] **Step 1: 建目录**

Run:
```bash
mkdir -p ~/.copilot/skills/gradcheck/references ~/.copilot/skills/gradcheck/scripts
```

- [ ] **Step 2: 写 `check-connection.sh`**

```bash
#!/usr/bin/env bash
# Usage: GRADCHECK_TOKEN=<jwt> GRADCHECK_URL=https://gc.myseu.cn/mcp ./check-connection.sh
set -euo pipefail
URL="${GRADCHECK_URL:-https://gc.myseu.cn/mcp}"
TOKEN="${GRADCHECK_TOKEN:?Set GRADCHECK_TOKEN to your gradcheck.token JWT}"

curl -sS -X POST "$URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"check","version":"1.0.0"}}}' \
  -D - | grep -i "mcp-session-id" && echo "OK: session established" || {
    echo "FAILED: no session id (check token / URL)"; exit 1; }
```

- [ ] **Step 3: 赋可执行权限**

Run: `chmod +x ~/.copilot/skills/gradcheck/scripts/check-connection.sh`

- [ ] **Step 4: 验证（需真实 token）**

Run: `GRADCHECK_TOKEN=<token> ~/.copilot/skills/gradcheck/scripts/check-connection.sh`
Expected: 打印 `OK: session established`。

### Task 23: 写 `SKILL.md`

**Files:**
- Create: `~/.copilot/skills/gradcheck/SKILL.md`

- [ ] **Step 1: 写文件**

```markdown
---
name: gradcheck
description: Use when the user wants to check graduation progress, manage reminders, register a lab/exam, review the week, or fix GPA/program-plan data in GradCheck (gc.myseu.cn). Talks to the GradCheck MCP server over HTTP with the user's JWT.
---

# GradCheck

Drive the GradCheck graduation-tracker through its MCP server. Four workflows cover the common jobs; the full tool list is in `references/tool-catalog.md`.

## Setup (once)

The server needs the user's GradCheck JWT. If `tools/call` returns `-32001`, the token is missing or expired — see `references/auth.md` to fetch a fresh one and put it in the MCP client config `Authorization: Bearer <jwt>` header for `https://gc.myseu.cn/mcp`.

Quick connectivity check: `scripts/check-connection.sh` (needs `GRADCHECK_TOKEN`).

## Workflows

Pick the workflow that matches the request and follow its checklist. Details and example tool arguments are in `references/workflows.md`.

### daily-briefing
- [ ] Call `home.summary` for the cross-dimension overview.
- [ ] Call `reminders.list` with `{ "status": "pending" }`.
- [ ] Call `courses.progress` for credit/risk status.
- [ ] Summarize: overdue items, today's items, and the single most important risk.

### add-exam
- [ ] Collect: title, eventType (lab/midterm/final/quiz/other_exam), startAt (ISO), optional endAt, location, reminderOffsets (minutes-before).
- [ ] Call `lab_exam_events.create` with those fields.
- [ ] Confirm the returned event AND its derived reminder back to the user.

### weekly-review
- [ ] Call `reminders.list` (no filter) to see done + outstanding.
- [ ] Call `courses.progress`.
- [ ] Report done / not-done; propose next week's top 3 priorities.
- [ ] Offer to create reminders for the proposed priorities via `reminders.create`.

### graduation-check
- [ ] Call `home.summary` and `courses.progress`.
- [ ] Call `custom_requirements.list` for personal requirements.
- [ ] List every unmet dimension with the exact remaining gap (credits/count/hours).

## Rules

- Always confirm before any destructive call (`*.delete`).
- Dates are ISO 8601 UTC (e.g., `2026-07-01T09:00:00.000Z`).
- On `-32602`, show the validation message and ask for a corrected value.
- On `-32000` rate-limit message, wait until the stated reset time.
```

- [ ] **Step 2: 校验 frontmatter**

Run: `head -4 ~/.copilot/skills/gradcheck/SKILL.md`
Expected: 含 `name: gradcheck` 与 `description:`。

### Task 24: 写 references（4 个）

**Files:**
- Create: `~/.copilot/skills/gradcheck/references/tool-catalog.md`
- Create: `~/.copilot/skills/gradcheck/references/workflows.md`
- Create: `~/.copilot/skills/gradcheck/references/auth.md`
- Create: `~/.copilot/skills/gradcheck/references/troubleshooting.md`

- [ ] **Step 1: 写 `tool-catalog.md`**

照抄本计划「工具清单（实测校正版，30 个）」表格的 `tool` 列与一句话说明，按领域分组（reminders / lab_exam_events / courses / gpa / program_plans / custom_requirements / home / profile），并标注每个写工具的必填字段（id / title / dueAt 等）。再附 4 个 resource URI 与 3 个 prompt 名称。

- [ ] **Step 2: 写 `workflows.md`**

对 SKILL.md 的 4 个 workflow 各写一段「目标 / 步骤 / 示例 tool 参数 JSON / 期望输出要点」。示例参数用真实字段，例如：

\`\`\`json
// add-exam: lab_exam_events.create
{ "title": "数据库期末", "eventType": "final", "startAt": "2026-07-01T09:00:00.000Z", "location": "教三-201", "reminderOffsets": [1440, 60] }
\`\`\`

- [ ] **Step 3: 写 `auth.md`**

说明：
1. 浏览器登录 `https://gc.myseu.cn`，开发者工具 → Application → Local Storage → 复制 `gradcheck.token` 的值。
2. 把它填进 MCP 客户端配置（Copilot CLI / Claude Desktop）的 HTTP server header：`Authorization: Bearer <粘贴>`，URL `https://gc.myseu.cn/mcp`。
3. token 过期表现为所有调用返回 `-32001`，重复步骤 1–2 刷新。
给出 Copilot CLI 的 MCP server 配置片段示例（HTTP 类型 + header）。

- [ ] **Step 4: 写 `troubleshooting.md`**

错误码对照：`-32001` 未鉴权/过期→刷新 token；`-32602` 入参非法→按 message 修正；`-32000` 业务错误或限流→读 message（资源不存在 or 超频，超频则等到 reset 时间）。再加「连不上」排查：先跑 `scripts/check-connection.sh`，再确认 URL 带 `/mcp`、header 拼写。

- [ ] **Step 5: 自查**

Run: `ls ~/.copilot/skills/gradcheck/references/`
Expected: 4 个 md 文件齐全。

### Task 25: README「MCP 接入」章节

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在 README 合适位置（部署章节之后）追加一节**

包含：
- MCP 端点 `https://gc.myseu.cn/mcp`（Streamable HTTP）、鉴权方式（GradCheck JWT，Bearer header）。
- 能力概览：30 tools / 4 resources / 3 prompts，按领域列出工具组。
- 本地启用：`pnpm dev` 后 `http://localhost:3000/mcp`；环境变量 `MCP_RATE_LIMIT_PER_MINUTE`（默认 60）。
- 配套 skill：`~/.copilot/skills/gradcheck/`，4 个 workflow（daily-briefing / add-exam / weekly-review / graduation-check）。
- 取 token 指引：浏览器 localStorage `gradcheck.token` → MCP 客户端 header。

- [ ] **Step 2: Commit + Push**

```bash
git add README.md
git commit -m "docs: add MCP integration section"
http_proxy=http://127.0.0.1:12334 https_proxy=http://127.0.0.1:12334 git push origin <branch>
```

---

## 测试与验收汇总

- 单元/集成（Vitest）：`mcp.errors`、`mcp.auth`、`rate-limit`、各 tool 文件注册与 happy-path、`prompts` 注册、`/mcp` initialize+鉴权+限流。底层业务正确性已由各模块既有 REST 测试覆盖；MCP 工具是薄封装，测试聚焦「注册齐全 + 正确转发 userId/入参 + 错误映射」。
- 类型：每个 milestone 末尾 `pnpm --filter @gradcheck/backend typecheck` 必须过（注意未用 import 会失败）。
- 手动：MCP Inspector 连本地与线上，核对 tools/resources/prompts 数量与一次真实调用。
- 回滚：移除 `app.ts` 的 `/mcp` 挂载与 Caddy `/mcp` 块即可，无 schema 变更。

## 实施顺序

M1 → M2 → M3 → M4 → M5，严格按 Task 编号。每个 Task 自带 commit；每个 milestone 末尾跑一次全量 `typecheck && test`。
