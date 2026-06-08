<div align="center">
  <img src="packages/web/public/logo.png" alt="GradCheck" width="120" />
  <h1>GradCheck · 东南大学毕业进度管家</h1>
  <p>
    <strong>移动优先 · 全链路毕业进度跟踪 · 课表 / GPA / 实验考试 / 提醒推送 / 毕业指南</strong>
  </p>
  <p>
    <a href="https://gc.myseu.cn">线上预览：https://gc.myseu.cn</a>
  </p>
</div>

---

GradCheck 是一个面向东南大学本科生的全栈毕业进度管家：导入培养方案、对照成绩单计算进度，跟踪体育跑操 / 讲座实践 / 志愿劳育 / SRTP / 自定义要求等各类毕业卡点，并通过实验考试和提醒事项将"DDL"提前推送到微信。

## 目录

- [功能特性](#功能特性)
- [路演材料](#路演材料)
- [技术栈](#技术栈)
- [代码结构](#代码结构)
- [环境准备](#环境准备)
- [本地开发](#本地开发)
- [验证 · 构建 · 测试](#验证--构建--测试)
- [数据库与迁移](#数据库与迁移)
- [提醒推送（PushPlus）](#提醒推送pushplus)
- [培养方案 PDF 解析](#培养方案-pdf-解析)
- [API 速查](#api-速查)
- [前端页面与路由](#前端页面与路由)
- [部署](#部署)
- [MCP 接入](#mcp-接入)
- [开发约定与贡献指南](#开发约定与贡献指南)
- [常见问题](#常见问题)

## 功能特性

| 模块 | 描述 |
| ---- | ---- |
| **培养方案 / 课程进度** | 上传专业培养方案 PDF → 解析为可视化要求 + 学期课表；导入历年成绩单后逐条对照通过、风险与缺学分 |
| **GPA 计算与课程匹配** | 解析成绩单、与培养方案课程自动匹配，支持手动修正映射；按学期/类别聚合 GPA |
| **选课推荐** | 基于剩余培养方案要求与已修课程，生成下学期选课建议并支持历史回溯 |
| **体育跑操** | 记录体测、跑操次数与连续打卡火花；近期跑操与待跑同步到首页卡片 |
| **讲座实践 / 志愿劳育 / SRTP** | 录入活动、记录学分/学时，自动汇总毕业卡点进度 |
| **自定义要求** | 学院差异化或个人补充要求，自由添加并参与毕业进度计算 |
| **实验考试登记** | 登记实验/考试时间地点，自动生成提醒事项并同步至 PushPlus |
| **提醒事项** | Apple 风格清单：完成 / 延后 / 复制 / 编辑；首页"小组件"卡片可一键勾选 |
| **后台调度** | 进程内 `setInterval` 调度，每分钟扫描到期提醒并通过 PushPlus 推送 |
| **校园资讯 / 广场** | 拉取校园资讯，发布/互动校园广场帖子 |
| **天气** | 接入高德天气，首页展示南京九龙湖实时天气 |
| **毕业指南** | "缓缓拉开的幕布"风格落幕页，完整呈现本科生离校全流程 |

## 路演材料

- [“我要毕业”路演 PPT](docs/roadshow.pptx)

## 技术栈

| 层 | 技术 |
| ---- | ---- |
| **前端** | Vue 3 (`<script setup>`) · Vite 7 · Vue Router 4 · TanStack Query · Varlet UI · TailwindCSS 4 · Zod |
| **后端** | Node.js · TypeScript (strict ESM) · Express 5 · Drizzle ORM · PostgreSQL 16 · JWT · Zod · Multer |
| **PDF / OCR** | pdfjs-dist · 可选 DeepSeek 增强 · 可选 Python pdfplumber 备用通道 |
| **推送** | PushPlus（微信公众号通道） |
| **测试** | Vitest（前端 jsdom / 后端 node）· `@vue/test-utils` · Supertest |
| **构建 / 部署** | pnpm 10 monorepo · Docker Compose · Caddy 反代 · GitHub Actions |

## 代码结构

```
GradCheck/
├── packages/
│   ├── web/                         # Vue 3 前端
│   │   ├── public/logo.png          # favicon / 品牌 logo
│   │   ├── src/
│   │   │   ├── components/          # AppShell、卡片、提醒条等
│   │   │   ├── pages/               # 路由级页面（Home / Profile / GraduationGuide 等）
│   │   │   ├── lib/api.ts           # fetch 封装 + JWT (gradcheck.token)
│   │   │   ├── router.ts            # createWebHistory 路由表
│   │   │   └── main.ts
│   │   └── vite.config.ts           # /api 与 /health 代理到 :3000
│   └── backend/                     # Express API
│       ├── src/
│       │   ├── index.ts             # 启动入口 + 调度器 + 优雅退出
│       │   ├── app.ts               # createApp(deps) 工厂，便于测试
│       │   ├── lib/config.ts        # zod 校验的环境变量
│       │   ├── db/                  # Drizzle schema 与连接
│       │   ├── modules/             # 按领域分包，详见下方
│       │   └── scripts/             # 一次性数据脚本
│       ├── drizzle/                 # 迁移 SQL（18 份）
│       └── drizzle.config.ts
├── deploy/Caddyfile                 # 生产 Caddy 反代配置
├── scripts/
│   ├── setup-production-server.sh   # 服务器一次性安装脚本
│   └── deploy-production.sh         # 拉取 + 构建 + 重启
├── docker-compose.yml               # 本地 postgres
├── docker-compose.prod.yml          # 生产 backend + web + migrate
└── docs/                            # 设计稿、参考资料、毕业指南.md
```

### 后端领域模块

`packages/backend/src/modules/` 下按领域分包，每个模块通常包含 `*.routes.ts` / `*.repository.ts` / `*.schemas.ts` / `*.types.ts`：

| 模块目录 | 挂载路径 |
| ---- | ---- |
| `auth` | `/api/auth` (register / login / me) |
| `users` | `/api/users` (profile CRUD) |
| `gpa` | `/api/gpa` (成绩单导入 / 课程匹配 / GPA 计算) |
| `courses-progress` | `/api/courses` (课程进度) |
| `program-plans` | `/api/program-plans` (培养方案 + 毕业进度) |
| `program-rules` | `/api/program-rules` (PDF 解析 / 草稿编辑) |
| `course-recommendations` | `/api/course-recommendations` |
| `sports` | `/api/sports` (跑操与体测) |
| `lecture-practice` | `/api/lecture-practice` |
| `volunteer-labor` | `/api/volunteer-labor` |
| `srtp` | `/api/srtp` |
| `custom-requirements` | `/api/custom-requirements` |
| `lab-exam-events` | `/api/lab-exam-events` |
| `reminders` | `/api/reminders`（含调度器 + PushPlus 适配器） |
| `home-summary` | `/api/home` (首页聚合卡片) |
| `news` | `/api/news` (校园资讯) |
| `plaza` | `/api/plaza/posts` (广场) |
| `weather` | `/api/weather` (高德实况) |

## 环境准备

- **Node.js** ≥ 20
- **pnpm** 10.x（项目已锁定 `packageManager: pnpm@10.12.1`）
- **PostgreSQL** 16（或使用 `docker compose up -d postgres`）
- 可选：Docker / Docker Compose 用于本地数据库或生产部署

```bash
pnpm install
cp .env.example .env
```

### 环境变量

根目录 `.env`（被 `packages/backend/src/lib/config.ts` 与 `drizzle.config.ts` 共同读取）：

| 变量 | 必填 | 默认值 / 示例 | 说明 |
| ---- | :--: | ---- | ---- |
| `DATABASE_URL` | ✅ | `postgres://postgres:postgres@localhost:5432/gradcheck` | PostgreSQL 连接串，云端建议加 `?sslmode=require` |
| `JWT_SECRET` | ✅ | 至少 24 个字符 | JWT 签名密钥 |
| `AMAP_WEATHER_KEY` | ✅ | — | 高德开放平台 Web 服务 Key（首页天气） |
| `PORT` | ➖ | `3000` | 后端监听端口 |
| `CORS_ORIGIN` | ➖ | `http://localhost:5173` | 允许的前端 Origin |
| `REMINDER_SCHEDULER_ENABLED` | ➖ | `true` | 是否启动提醒调度器（开发/测试可设为 `false`） |
| `REMINDER_SCHEDULER_INTERVAL_MS` | ➖ | `60000` | 调度器扫描间隔（毫秒，下限 1000） |
| `REMINDER_PUBLIC_BASE_URL` | ➖ | — | 推送消息中"查看详情"链接的前缀（生产建议设置） |
| `VITE_API_BASE_URL` | ➖ | 留空使用 vite 代理 | 前端构建期 API 基地址 |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` | ➖ | — | 培养方案 PDF 解析的 LLM 增强通道 |

## 本地开发

```bash
# 启动本地 PostgreSQL（如未自建）
docker compose up -d postgres

# 第一次执行迁移
pnpm db:migrate

# 同时启动前端 (5173) 和后端 (3000)
pnpm dev
```

- 前端：http://localhost:5173 （Vite 已将 `/api` 与 `/health` 反代到 `:3000`）
- 后端：http://localhost:3000
- 健康检查：http://localhost:3000/health

JWT token 由前端写入 `localStorage` 的 `gradcheck.token`；登出会清空。

## 验证 · 构建 · 测试

| 目的 | 命令 |
| ---- | ---- |
| 类型检查（前后端） | `pnpm typecheck` |
| 跑所有测试 | `pnpm test` |
| 仅后端测试 | `pnpm --filter @gradcheck/backend test` |
| 仅前端测试 | `pnpm --filter @gradcheck/web test` |
| 单文件测试（后端） | `pnpm --filter @gradcheck/backend exec vitest run src/path/to/file.test.ts` |
| 单文件测试（前端） | `pnpm --filter @gradcheck/web test -- src/path/to/file.test.ts` |
| 生产构建 | `pnpm build` |

> 后端使用 ESM，TypeScript 源码内 import 必须带 `.js` 后缀（即使指向 `.ts` 文件）。

## 数据库与迁移

| 命令 | 说明 |
| ---- | ---- |
| `pnpm db:generate` | 由 `packages/backend/src/db/schema.ts` 生成新的迁移 SQL |
| `pnpm db:migrate` | 应用待执行迁移（生产用 `docker compose --profile tools run --rm migrate`） |
| `pnpm db:studio` | 启动 Drizzle Studio 图形化浏览数据 |

**Schema 约定**：
- 主键统一为 UUID (`defaultRandom()`)
- 软删除：`deletedAt` 字段，所有查询必须 `isNull(table.deletedAt)`
- 多数表带 `createdAt` / `updatedAt` 时间戳
- 灵活数组字段使用 JSONB（如 `tags`）

数据脚本：

```bash
pnpm --filter @gradcheck/backend exec tsx src/scripts/backfill-program-plan-courses.ts
pnpm --filter @gradcheck/backend exec tsx src/scripts/backfill-gpa-course-plan-matches.ts
pnpm --filter @gradcheck/backend exec tsx src/scripts/seed-news.ts
```

## 提醒推送（PushPlus）

GradCheck 通过 [PushPlus](https://www.pushplus.plus/) 将提醒事项推送到微信。

1. 用户在「我的」中绑定 PushPlus token（写入 `user_profiles.pushplus_token`）。
2. 创建提醒事项或登记实验/考试时，自动派生 `reminder` 行 + 计划触发时间。
3. 后端启动时 `startReminderScheduler` 注册 `setInterval`：每 `REMINDER_SCHEDULER_INTERVAL_MS` 毫秒扫描一次到期但未发送的提醒，调用 `PushPlusAdapter` 发送，并把结果写入 `reminder_delivery_logs`。
4. SIGTERM / SIGINT 时调度器优雅停止，10 秒后强制退出兜底。

调试技巧：
- 临时关闭调度：`REMINDER_SCHEDULER_ENABLED=false pnpm dev`
- 加快扫描：`REMINDER_SCHEDULER_INTERVAL_MS=5000`
- 推送消息中的「查看详情」链接由 `REMINDER_PUBLIC_BASE_URL` 决定，本地可留空

## 培养方案 PDF 解析

后端内置一套培养方案解析管线（`packages/backend/src/modules/program-rules`）。输出拆分为两部分：

- **毕业要求**：分组规则与非课程类要求，用于进度计算
- **课程目录**：结构化课程清单（课号 / 课名 / 学分 / 学年 / 学期）

文件落盘位置：

```text
data/program_rules/<draft_id>.json                    # 完整可编辑解析草稿
data/program_rules/requirements/<draft_id>.json       # 仅毕业要求
data/program_rules/course_catalogs/<draft_id>.json    # 仅课程目录
```

CLI 用例：

```bash
pnpm parse:program -- "./2022级软件工程专业培养方案.pdf" \
  --save \
  --storage-dir data/program_rules \
  --school 东南大学 \
  --college 计算机科学与工程学院 \
  --major 软件工程 \
  --grade 2022 \
  --version 2022级
```

启用 DeepSeek 增强：

```bash
export DEEPSEEK_API_KEY="sk-..."
pnpm parse:program -- "./2022级软件工程专业培养方案.pdf" --llm deepseek --save
```

REST API：

- `POST /api/program-rules/uploads`
- `GET  /api/program-rules/:draftId`
- `GET  /api/program-rules/:draftId/requirements`
- `GET  /api/program-rules/:draftId/course-catalog`
- `PATCH /api/program-rules/:draftId`

## API 速查

健康检查不需鉴权，其余 `/api/*` 均要求 `Authorization: Bearer <jwt>`：

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
GET    /api/users/me
PUT    /api/users/me
GET    /api/home                       首页聚合卡片
GET    /api/program-plans/...          培养方案与毕业进度
GET    /api/courses/...                课程进度
POST   /api/gpa/transcript/preview     成绩单 OCR 预览
POST   /api/gpa/transcript/import      成绩单导入
GET    /api/gpa/course-matches         GPA <-> 培养方案匹配
GET    /api/course-recommendations/... 选课推荐
GET    /api/sports/...                 体育跑操
GET    /api/lecture-practice/...       讲座实践
GET    /api/volunteer-labor/...        志愿劳育
GET    /api/srtp/...                   SRTP
GET    /api/custom-requirements/...    自定义要求
GET    /api/lab-exam-events/...        实验考试登记
GET    /api/reminders/...              提醒事项 CRUD
PATCH  /api/reminders/:id/complete
PATCH  /api/reminders/:id/snooze
POST   /api/reminders/:id/duplicate
GET    /api/news                       校园资讯
GET    /api/plaza/posts                广场帖子
GET    /api/weather                    高德实况天气
```

完整路由见 `packages/backend/src/app.ts` 与各模块 `*.routes.ts`。

## 前端页面与路由

| 路径 | 名称 | 说明 |
| ---- | ---- | ---- |
| `/` | `home` | 首页：天气、毕业进度卡、提醒小组件、功能矩阵 |
| `/login` | `login` | 登录 / 注册（含一卡通字段） |
| `/profile` | `profile` | 个人信息 + 跳转「毕业指南」入口 |
| `/plans` | `plans` | 培养方案上传与查看 |
| `/courses` | `courses` | 课程进度 |
| `/gpa` | `gpa` | GPA 总览 |
| `/gpa/course-matches` | `gpa-course-matches` | GPA ↔ 培养方案匹配 |
| `/course-recommendations` | `course-recommendations` | 选课推荐 |
| `/sports` | `sports` | 跑操与体测 |
| `/lecture-practice` | `lecture-practice` | 讲座实践 |
| `/volunteer` | `volunteer` | 志愿劳育 |
| `/srtp` | `srtp` | SRTP |
| `/custom-requirements` | `custom-requirements` | 自定义要求 |
| `/exams` | `exams` | 实验考试登记 |
| `/reminders` | `reminders` | 提醒事项清单 |
| `/news` | `news` | 校园资讯 |
| `/plaza` | `plaza` | 校园广场 |
| `/graduation-guide` | `graduation-guide` | 毕业指南（带幕布展开 + 章节淡入动画） |

## 部署

生产环境部署到 `https://gc.myseu.cn`，由 GitHub Actions 推送到目标服务器后 `docker compose up -d` 重启。

### 一次性服务器初始化

```bash
ssh ubuntu@<host> 'bash -s' < scripts/setup-production-server.sh
```

### 必需的 GitHub Secrets

| Secret | 说明 |
| ---- | ---- |
| `PROD_SSH_HOST` | 生产服务器地址（当前：`119.29.196.62`） |
| `PROD_SSH_USER` | SSH 用户（当前：`ubuntu`） |
| `PROD_SSH_KEY` | GitHub Actions 使用的私钥 |
| `PROD_DATABASE_URL` | 生产 PostgreSQL 连接串 |
| `PROD_JWT_SECRET` | 生产 JWT 密钥 |
| `PROD_AMAP_WEATHER_KEY` | 生产高德 Key |
| `PROD_CORS_ORIGIN` | 当前：`https://gc.myseu.cn` |

> 生产 `.env` 在部署期间由 Actions 写入服务器，**严禁提交进仓库**。

### 手动部署

```bash
ssh ubuntu@<host>
cd /opt/gradcheck/app
PUBLIC_HEALTH_URL=https://gc.myseu.cn/health scripts/deploy-production.sh
```

`docker-compose.prod.yml` 提供三类服务：

- `backend` —— 后端 API（暴露给同 compose network 内的 caddy）
- `web` —— Caddy + 静态前端 + 反代到 `backend:3000`
- `migrate` —— 单次任务 (`profiles: tools`)，`docker compose --profile tools run --rm migrate` 触发

## MCP 接入

后端内嵌了一个 MCP（Model Context Protocol）服务，让 LLM 客户端（Copilot CLI / Claude 等）能用自然语言操作 GradCheck。

- **端点**：`https://gc.myseu.cn/mcp`（Streamable HTTP）；本地为 `http://localhost:3000/mcp`。
- **鉴权**：复用 GradCheck JWT，请求头 `Authorization: Bearer <jwt>`。token 即浏览器 `localStorage` 里的 `gradcheck.token`。
- **限流**：每个 token 默认 60 次/分钟，由环境变量 `MCP_RATE_LIMIT_PER_MINUTE` 调整。

**能力概览（30 tools / 4 resources / 3 prompts）：**

| 领域 | 工具 |
| ---- | ---- |
| reminders (8) | list / get / create / update / complete / snooze / duplicate / delete |
| lab_exam_events (5) | list / create / update / update_status / delete（创建时派生提醒） |
| courses (3) | progress / ignore_group / unignore_group |
| gpa (4) | dashboard / list_matches / fix_match / rematch |
| program_plans (3) | bound / reusable / bind |
| custom_requirements (4) | list / create / update / delete |
| home (1) / profile (2) | home.summary / profile.get / profile.update |

- **Resources**：`gradcheck://home/summary`、`gradcheck://reminders/today`、`gradcheck://courses/risk`、`gradcheck://program/progress`
- **Prompts**：`daily_briefing(date?)`、`add_exam`、`weekly_review(week_start?)`

**配套 Skill**：`~/.copilot/skills/gradcheck/`，封装 4 个工作流（daily-briefing / add-exam / weekly-review / graduation-check），并附取 token、工具速查与排错文档。在 MCP 客户端配置里把 `gradcheck.token` 填入 `Authorization` 头即可使用。

## 开发约定与贡献指南

- **TypeScript strict**：`noUnusedLocals` + `noUnusedParameters`，构建会因未使用变量失败
- **后端 import 必须带 `.js` 后缀**（Node ESM 解析）
- **软删除**：所有列表查询都要过滤 `isNull(table.deletedAt)`
- **API 校验**：所有 body / query 用 Zod schema (`*.schemas.ts`) 校验
- **测试驱动**：新功能前先写 Vitest 用例，组件用 `@vue/test-utils`，HTTP 用 `supertest`
- **样式**：移动优先 (Varlet + TailwindCSS 4)，主题变量 `--tommy-*` 已在 `src/theme.css` 定义
- **状态管理**：服务器状态走 TanStack Query，不引入全局客户端 store
- **commit 信息**：建议 `feat|fix|chore|docs(scope): ...`，提交时附 Co-authored-by

## 常见问题

**Q：后端启动报 `JWT_SECRET must be at least 24 characters`？**
A：`.env` 里给 `JWT_SECRET` 设置 ≥ 24 字符的随机字符串。

**Q：提醒到时间没推送？**
1. 确认用户档案里 `pushplus_token` 已绑定
2. 确认 `REMINDER_SCHEDULER_ENABLED=true`（或未显式设置）
3. 查后端日志 `reminder scheduler: scanned=N sent=M` 行
4. 查 `reminder_delivery_logs` 表 `status` / `error`

**Q：前端 `/api/...` 404？**
A：前端 dev 模式靠 `vite.config.ts` 中的代理转发到 `:3000`；生产模式由 Caddy 反代。请确认后端在跑。

**Q：跑 `pnpm db:migrate` 提示连不上数据库？**
A：检查 `.env` 中的 `DATABASE_URL`，本地默认值与 `docker-compose.yml` 的 `postgres` 服务一致。

---

<div align="center">
  <sub>Built with ❤️ by Graduation-Mode-On · 祝你前程似锦，山海可期。</sub>
</div>
