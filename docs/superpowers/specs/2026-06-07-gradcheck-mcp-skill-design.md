# GradCheck MCP 接口 + Skill 设计

- 日期：2026-06-07
- 状态：设计阶段（待实施）
- 范围：Phase 1（30 个 tool / 4 个 resource / 3 个 prompt / 4 个 workflow）

## 1. 背景与目标

GradCheck 已是一个完整的本科毕业进度管家（REST API + Vue 前端 + 提醒推送 + 调度器）。
现在希望在不引入第二份后端的前提下，把它的能力开放给 LLM 客户端（Copilot CLI / Claude
Code 等），并配套一个 superpowers skill，让用户能用自然语言完成日常的"看进度、登记
实验考试、复盘"等工作。

目标：

- 在现有 Express 5 后端**内嵌** MCP（Model Context Protocol）服务，复用 JWT、Drizzle、
  现有 repository，不新增独立部署单元。
- 通过 Streamable HTTP transport 暴露 `https://gc.myseu.cn/mcp`，鉴权直接复用 GradCheck
  JWT。
- 编写 user-level skill `gradcheck`，包含 4 个工作流（早报、登记实验考试、周复盘、毕业
  风险检查），让 Copilot CLI 直接可用。

**非目标**（Phase 1 不做）：

- OAuth 2.1 / 设备码授权流程
- 独立 MCP 包发布到 npm
- stdio transport（仅 HTTP）
- 数据库 schema 变更
- 培养方案 PDF 解析、广场、资讯、天气等 MCP 化（待 Phase 2 视使用度再加）

## 2. 总体架构

```
┌──────────────────────────┐    HTTPS Streamable HTTP        ┌──────────────────────────────────┐
│  Copilot CLI / Claude    │  POST /mcp + Bearer <jwt>  ───▶│  Express 5  (packages/backend)   │
│  + gradcheck skill       │  ◀── SSE/JSON-RPC ───────────  │  ├ /api/...   (现有 REST)        │
│   ├ daily-briefing       │                                 │  └ /mcp        (新)              │
│   ├ add-exam             │                                 │       └ McpServer                │
│   ├ weekly-review        │                                 │            ├ tools/* (~30)       │
│   └ graduation-check     │                                 │            ├ resources/* (4)     │
└──────────────────────────┘                                 │            └ prompts/* (3)       │
                                                              └────────────┬─────────────────────┘
                                                                           │ Drizzle ORM
                                                                           ▼
                                                                    PostgreSQL 16
```


### 2.1 组件清单

| 组件 | 位置 | 职责 |
| ---- | ---- | ---- |
| MCP 路由 | `packages/backend/src/modules/mcp/mcp.routes.ts` | 挂载 `POST/GET/DELETE /mcp`，处理 JSON-RPC 与 SSE，按 session 管理 transport |
| MCP Server 工厂 | `packages/backend/src/modules/mcp/server.ts` | 创建 `McpServer`，注册全部 tools/resources/prompts，注入依赖 |
| 鉴权适配 | `packages/backend/src/modules/mcp/auth.ts` | 从 `Authorization: Bearer` 解析 JWT，复用 `authenticate(authRepository)` 得到 `ctx.userId` |
| 工具实现 | `packages/backend/src/modules/mcp/tools/*.ts` | 每个领域一个文件，调用现有 repository，做 Zod 入参校验与错误映射 |
| 资源实现 | `packages/backend/src/modules/mcp/resources/*.ts` | 只读聚合视图，复用首页/提醒/课程查询 |
| 提示实现 | `packages/backend/src/modules/mcp/prompts/*.ts` | 把多步操作打包成 prompt 模板 |
| 限流器 | `packages/backend/src/modules/mcp/rate-limit.ts` | 内存 `Map<token,{count,resetAt}>`，60 req/min/token |
| skill | `~/.copilot/skills/gradcheck/` | user-level skill：`SKILL.md` + `references/*` + `scripts/check-connection.sh` |

### 2.2 关键设计决策

| 决策 | 选择 | 理由 |
| ---- | ---- | ---- |
| 部署形态 | 内嵌现有 Express 后端 | 复用 JWT/Drizzle/repository，零新增部署单元 |
| Transport | 仅 Streamable HTTP | 远程可用，匹配 `gc.myseu.cn` 部署；不做 stdio |
| 鉴权 | 复用 GradCheck JWT，静态 Bearer | Phase 1 不引入 OAuth；UX：用户从浏览器 localStorage 复制 `gradcheck.token` |
| SDK | `@modelcontextprotocol/sdk` (锁 `^1`) | 官方 SDK，规避协议演进 |
| Schema | Phase 1 不改 | 降低风险，可随时回滚 |
| skill 形态 | 工作流封装（Q1=B） | 4 个高频工作流，降低用户认知负担 |

## 3. MCP API 契约

### 3.1 HTTP 入口

| 方法 | 路径 | 用途 |
| ---- | ---- | ---- |
| POST | `/mcp` | JSON-RPC 请求（initialize / tools.list / tools.call / resources.* / prompts.*） |
| GET | `/mcp` | 建立 SSE 流，接收服务端推送（需带 `Mcp-Session-Id`） |
| DELETE | `/mcp` | 关闭并清理 session |

- 鉴权：所有方法要求 `Authorization: Bearer <jwt>`；缺失或失效返回 JSON-RPC error `-32001`。
- Session：`initialize` 后由服务端生成 `Mcp-Session-Id`，客户端后续请求需回带。
- 内容类型：`application/json`（请求）与 `text/event-stream`（SSE 响应）。

### 3.2 Tools（30 个，按领域）

| 领域 | 工具 | 说明 |
| ---- | ---- | ---- |
| reminders (8) | `reminders.list` / `.get` / `.create` / `.update` / `.complete` / `.snooze` / `.duplicate` / `.delete` | 提醒事项 CRUD 与完成/延后/复制 |
| lab_exam_events (4) | `lab_exam_events.list` / `.create` / `.update` / `.delete` | 实验/考试登记，创建时派生对应提醒 |
| courses (3) | `courses.list` / `.mark_complete` / `.mark_risk` | 课程列表与状态标记 |
| gpa (4) | `gpa.summary` / `.list_courses` / `.list_matches` / `.fix_match` | 绩点汇总、课程匹配修正 |
| program_plans (3) | `program_plans.summary` / `.requirements` / `.progress` | 培养方案进度 |
| custom_requirements (5) | `custom_requirements.list` / `.create` / `.update` / `.delete` / `.toggle` | 自定义毕业要求 |
| home (1) | `home.summary` | 首页聚合 |
| profile (2) | `profile.get` / `.update` | 个人资料读写 |

- 每个 tool 入参用 Zod 定义并暴露 JSON Schema；写操作需要明确的资源 id 或完整字段。
- `lab_exam_events.create/update/delete` 会同步维护派生的 reminder（与现有 service 行为一致）。

### 3.3 Resources（4 个）

| URI | 内容 |
| ---- | ---- |
| `gradcheck://home/summary` | 首页聚合：今日提醒、风险课程、进度概览 |
| `gradcheck://reminders/today` | 今日（及逾期）提醒列表 |
| `gradcheck://courses/risk` | 风险/挂科预警课程 |
| `gradcheck://program/progress` | 培养方案完成度 |

### 3.4 Prompts（3 个）

| 名称 | 参数 | 用途 |
| ---- | ---- | ---- |
| `daily_briefing` | `date?` | 生成当日早报（提醒 + 风险 + 进度） |
| `add_exam` | — | 引导用户登记一场实验/考试并确认派生提醒 |
| `weekly_review` | `week_start?` | 周复盘：已完成、未完成、下周待办 |

### 3.5 错误码映射

| JSON-RPC code | 场景 |
| ---- | ---- |
| `-32001` | 未鉴权 / JWT 失效 |
| `-32602` | 入参校验失败（Zod） |
| `-32000` | 业务错误（资源不存在、状态非法等） |

### 3.6 限流

- 内存 `Map<token, {count, resetAt}>`，窗口 60 秒，上限 60 次/分钟/token。
- 超限返回 `-32000`，message 含重置时间。
- M4 落地；进程级即可，未来多实例再换共享存储。

## 4. 里程碑

| 里程碑 | 交付物 | 验收标准 |
| ---- | ---- | ---- |
| M1 骨架 | `/mcp` 路由 + `McpServer` + `initialize`/`tools.list` + `ping` 工具 + `@modelcontextprotocol/sdk` | MCP Inspector 能连接、列出 `ping`、调用成功；JWT 校验生效 |
| M2 读工具 + 资源 | reminders/courses/gpa/program_plans/home/profile 的只读 tool + 4 个 resource | 读路径返回与 REST 一致的数据；未鉴权返回 `-32001` |
| M3 写工具 | 全部写 tool（含 lab_exam_events 派生 reminder） | 创建实验考试后 reminder 同步生成；CRUD 往返一致 |
| M4 提示 + 限流 + 部署 | 3 个 prompt + 限流器 + Caddy `/mcp` 反向代理 + staging 验证 | 远程 `https://gc.myseu.cn/mcp` 可连；超限触发限流 |
| M5 skill | 发布 `gradcheck` skill + README「MCP 接入」章节 | 在 Copilot CLI 中跑通 4 个工作流；文档可照做 |

## 5. 测试、风险与回滚

### 5.1 测试策略

- 后端：沿用 Vitest + supertest。对 `/mcp` 做 JSON-RPC 级别集成测试（initialize → tools.list → tools.call）。
- 工具单测：每个写 tool 校验入参 Zod、鉴权、错误映射、与 repository 的交互。
- 派生逻辑：lab_exam_events 创建/更新/删除对 reminder 的联动单独覆盖。
- skill：`scripts/check-connection.sh` 做连通性自检；workflows 走手动验收清单。

### 5.2 风险

| 风险 | 影响 | 缓解 |
| ---- | ---- | ---- |
| MCP 协议/SDK 演进 | 接口破坏 | 锁 `@modelcontextprotocol/sdk ^1`，集成测试兜底 |
| 静态 JWT 过期 | 工作流中断 | skill troubleshooting 指引重新复制 token；错误信息明确 `-32001` |
| 内存限流不跨实例 | 多实例下不准 | Phase 1 单实例；文档标注，未来换共享存储 |
| 写工具误操作数据 | 数据错误 | Zod 严格校验 + 业务错误码；删除走软删除（复用现有 `deletedAt`） |

### 5.3 回滚

- Phase 1 无 schema 变更，回滚即移除 `/mcp` 路由挂载与 Caddy 规则，REST/前端不受影响。
- skill 为 user-level，独立于后端，可单独下线。
