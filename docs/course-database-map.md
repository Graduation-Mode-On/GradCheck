# 课程相关数据库表梳理

本文梳理当前项目中与课程、成绩、培养方案、毕业进度联动有关的数据库表。重点区分两类表：

1. **当前 Drizzle schema 已建模、代码正在使用的表**：以 `packages/backend/src/db/schema.ts` 为准，后续开发优先参考。
2. **当前数据库中存在、但代码暂未建模的历史/遗留表**：可作为后续正规化设计参考，但不要在没有接入代码前直接依赖。

## 模块总览

| 模块/领域 | 主要表 | 当前作用 |
|---|---|---|
| GPA 计算器 | `gpa_courses`, `gpa_calculation_results` | 存储用户手动录入或成绩单导入的课程成绩，以及最新 GPA/加权均分结果。 |
| 培养方案导入 | `program_plans`, `program_plan_course_groups`, `program_plan_courses`, `user_program_plan_bindings` | 存储解析后的培养方案 JSON、结构化课程要求/课程组，以及用户当前绑定的培养方案。 |
| 旧版结构化培养方案模型 | `program_schemas`, `schema_courses`, `elective_groups`, `user_program_bindings`, `user_courses`, `user_requirement_progress` | 当前数据库中存在，但未在当前 Drizzle schema 中建模；可作为后续正规化培养方案/课程进度设计参考。 |
| 非课程毕业进度 | `lecture_practice_progress`, `volunteer_labor_progress`, `srtp_records`, `custom_requirements` | 存储讲座实践、志愿劳育、SRTP、自定义要求等非普通课程类毕业要求。 |
| 机会推荐与社区 | `news_items`, `scraped_opportunities`, `recommendations`, `user_opportunity_actions`, `plaza_posts` | 与课程/毕业缺口相关的资讯、机会、推荐、广场帖子等。 |

## 当前代码中已建模的表

这些表定义在 `packages/backend/src/db/schema.ts` 中，是当前后端代码的主要数据来源。

### `gpa_courses`

GPA 模块的核心课程成绩表。每条记录属于一个用户，表示一门用户实际录入或从成绩单导入的课程成绩。它目前和培养方案课程没有直接外键关系。

| 字段 | 类型 | 含义 |
|---|---|---|
| `id` | `uuid` | 主键。 |
| `user_id` | `uuid` | 所属用户，关联 `users.id`，用户删除时级联删除。 |
| `term` | `varchar(20)` | 学期，例如 `2025-2026 春`。 |
| `name` | `varchar(160)` | 课程名称。 |
| `credit` | `numeric(5,2)` | 学分，用于加权计算。 |
| `score` | `numeric(5,2)` | 百分制成绩。等级成绩会在导入预览阶段换算为数字。 |
| `is_required` | `boolean` | 是否作为“必修课程”参与首修必修 GPA 范围。 |
| `is_first_attempt` | `boolean` | 是否首修。 |
| `is_gpa_eligible` | `boolean` | 是否计入 GPA/加权均分。 |
| `created_at`, `updated_at` | `timestamp with time zone` | 创建/更新时间。 |

当前数据来源：

- GPA 页面手动录入。
- 电子成绩单确认导入接口：`POST /api/gpa/transcript/import`。

关键规则：

- `is_gpa_eligible=false` 时，该课程不进入任何 GPA/均分计算范围。
- “首修必修课程”范围筛选条件是：`is_gpa_eligible && is_required && is_first_attempt`。
- 成绩单导入时默认 `is_required=false`，因为成绩单本身无法判断课程是否是培养方案必修课。
- 成绩单重复导入按 `term + name + credit + score` 跳过重复课程。

### `gpa_calculation_results`

GPA 最新计算结果缓存表。每个用户一行，保存该用户最新的 GPA/均分汇总。

| 字段 | 类型 | 含义 |
|---|---|---|
| `user_id` | `uuid` | 主键，关联 `users.id`，用户删除时级联删除。 |
| `required_first_attempt` | `jsonb` | 首修必修课程范围的最新计算结果。 |
| `overall` | `jsonb` | 总课程范围的最新计算结果。 |
| `created_at`, `updated_at` | `timestamp with time zone` | 创建/更新时间。 |

两个 JSON 字段的结构一致：

```ts
{
  weightedGpa: number | null;
  weightedAverageScore: number | null;
  totalCredits: number;
  courseCount: number;
}
```

注意：这是从 `gpa_courses` 计算出来的派生数据。后续如果其他模块要修改 GPA 课程，应该通过 GPA service/repository 写入，确保同步重算该表。

### `program_plans`

培养方案导入模块的主表。它保存的是解析后的完整培养方案 JSON，而不是把课程拆成单独的 course row。

| 字段 | 类型 | 含义 |
|---|---|---|
| `id` | `uuid` | 主键。 |
| `source_filename` | `varchar(240)` | 来源文件名。 |
| `school` | `varchar(120)` | 学校。 |
| `college` | `varchar(120)` | 学院，可为空。 |
| `major` | `varchar(120)` | 专业。 |
| `grade` | `varchar(40)` | 年级/培养方案届别，可为空。 |
| `total_credits` | `numeric(6,2)` | 培养方案总学分，可为空。 |
| `course_count` | `integer` | `plan_json.courses` 中的课程数量。 |
| `requirement_count` | `integer` | `plan_json.requirements` 中的要求数量。 |
| `warning_count` | `integer` | 解析警告数量。 |
| `plan_json` | `jsonb` | 完整结构化培养方案。 |
| `created_at`, `updated_at` | `timestamp with time zone` | 创建/更新时间。 |

当前 `plan_json.courses` 的主要结构：

```ts
{
  code: string;
  name: string;
  credits: number;
  category?: string | null;
  subcategory?: string | null;
  term?: {
    year?: string | null;
    semester?: string | null;
  };
}
```

联动意义：它是当前“培养方案要求了哪些课程”的主要数据来源。但由于课程存在 JSON 里，和 `gpa_courses` 联动时需要做课程名称/课程代码/学分匹配。

### `program_plan_course_groups`

培养方案课程组/要求组表。它从 `program_plans.plan_json.requirements` 派生，用来表达“必修课集合”“选修组”“几选几”“最低学分”等组级规则。

| 字段 | 类型 | 含义 |
|---|---|---|
| `id` | `uuid` | 主键。 |
| `program_plan_id` | `uuid` | 所属培养方案，关联 `program_plans.id`。 |
| `source_requirement_id` | `varchar(160)` | 来源 requirement 的 ID，例如 `major_electives`。 |
| `name` | `varchar(200)` | 组名/要求标题。 |
| `requirement_type` | `varchar(40)` | 要求类型，例如 `required`、`min_credits`、`choose_one_of`。 |
| `min_courses` | `numeric(6,2)` | 最低课程门数，可为空。 |
| `min_credits` | `numeric(6,2)` | 最低学分，可为空。 |
| `description` | `text` | 描述，可为空。 |
| `created_at`, `updated_at` | `timestamp with time zone` | 创建/更新时间。 |

联动意义：不要把选修组里的每门课都当作“必须修”。毕业判断时应先看该组的 `min_courses` / `min_credits`，再统计用户已完成的组内课程。

### `program_plan_courses`

培养方案结构化课程表。它从 `program_plans.plan_json.courses` 派生，为后续和 GPA/成绩单课程匹配提供关系型入口。

| 字段 | 类型 | 含义 |
|---|---|---|
| `id` | `uuid` | 主键。 |
| `program_plan_id` | `uuid` | 所属培养方案，关联 `program_plans.id`。 |
| `group_id` | `uuid` | 所属课程组，关联 `program_plan_course_groups.id`，可为空。 |
| `source_requirement_id` | `varchar(160)` | 来源 requirement ID，可为空。 |
| `code` | `varchar(80)` | 课程代码。 |
| `name` | `varchar(200)` | 课程名称。 |
| `credits` | `numeric(5,2)` | 学分。 |
| `category` | `varchar(120)` | 课程类别，可为空。 |
| `subcategory` | `varchar(120)` | 子类别，可为空。 |
| `suggested_term` | `varchar(40)` | 建议修读学期，例如 `一-1`。 |
| `requirement_type` | `varchar(40)` | 课程归属的要求类型。 |
| `created_at`, `updated_at` | `timestamp with time zone` | 创建/更新时间。 |

联动意义：后续将 `gpa_courses` 和培养方案关联时，应优先匹配到此表，而不是直接扫 `program_plans.plan_json`。

### `user_program_plan_bindings`

用户当前绑定的培养方案表。

| 字段 | 类型 | 含义 |
|---|---|---|
| `user_id` | `uuid` | 主键，关联 `users.id`。 |
| `program_plan_id` | `uuid` | 关联 `program_plans.id`。 |
| `confirmed_at` | `timestamp with time zone` | 用户确认/绑定该方案的时间。 |
| `created_at`, `updated_at` | `timestamp with time zone` | 创建/更新时间。 |

联动意义：做“用户毕业进度”时，先通过该表找到用户当前培养方案，再读取 `program_plans.plan_json.courses` 和用户成绩进行比对。

### `srtp_records`

SRTP 学分记录表。它不是普通课程表，但属于毕业要求中的学分型数据。

| 字段 | 类型 | 含义 |
|---|---|---|
| `id` | `uuid` | 主键。 |
| `user_id` | `uuid` | 所属用户。 |
| `title` | `varchar(160)` | 项目/竞赛/讲座名称。 |
| `type` | `varchar(32)` | 类型，例如 project、competition、lecture。 |
| `credits` | `numeric(5,2)` | 获得学分。 |
| `description` | `text` | 描述/备注。 |
| `created_at`, `updated_at` | `timestamp with time zone` | 创建/更新时间。 |

### `lecture_practice_progress`

讲座与社会实践进度表。

| 字段 | 类型 | 含义 |
|---|---|---|
| `user_id` | `uuid` | 主键，关联用户。 |
| `human_lecture_count` | `integer` | 人文讲座次数。 |
| `book_report_count` | `integer` | 读书报告次数。 |
| `social_practice_credits` | `numeric(5,2)` | 社会实践学分。 |
| `social_practice_course_count` | `integer` | 社会实践课程/项目数量。 |

### `volunteer_labor_progress`

志愿劳育进度表。

| 字段 | 类型 | 含义 |
|---|---|---|
| `user_id` | `uuid` | 主键，关联用户。 |
| `volunteer_hours` | `numeric(6,2)` | 志愿服务时长。 |
| `ordinary_labor_count` | `integer` | 普通劳育次数。 |
| `special_labor_count` | `integer` | 专项劳育次数。 |

### `custom_requirements`

用户自定义/学院特色要求表，可表达课程型、学分型、次数型、时长型等自定义毕业要求。

关键字段：

- `user_id`
- `name`
- `kind`
- `category`
- `target_value`
- `current_value`
- `unit`
- `include_in_progress`
- `show_on_home`

联动意义：适合作为暂未建模的学院特色要求兜底表。

### `plaza_posts`

广场帖子表。只有“换课/组队”等场景会涉及课程信息。

课程相关字段：

- `offered_course`
- `wanted_course`
- `course_time`

注意：该表不是权威课程进度数据，只是社区交流数据。

### `news_items`

资讯/机会表。某些机会可能用于补齐毕业缺口。

课程/毕业要求相关字段：

- `type`
- `credit_category`
- `target_audience`
- `start_time`
- `end_time`
- `registration_url`

## 当前数据库中存在但代码未建模的表

这些表当前存在于数据库中，但没有定义在 `packages/backend/src/db/schema.ts`。短期内不建议直接在新代码中依赖它们，除非先把它们纳入 Drizzle schema 并明确模块边界。

### `program_schemas`

旧版/正规化培养方案主表。

| 字段 | 含义 |
|---|---|
| `id` | 培养方案 schema ID。 |
| `college`, `major`, `grade` | 学院、专业、年级。 |
| `version` | 版本号。 |
| `source_url` | 来源链接。 |
| `status` | 状态枚举，例如 draft/confirmed。 |
| `confirmed_by` | 确认人。 |

### `schema_courses`

旧版/正规化培养方案课程表。

| 字段 | 含义 |
|---|---|
| `id` | 课程记录 ID。 |
| `schema_id` | 所属 `program_schemas.id`。 |
| `code` | 课程代码。 |
| `name` | 课程名称。 |
| `credits` | 学分。 |
| `category` | 课程类别枚举。 |
| `elective_group_id` | 所属选修组，可为空。 |
| `semester` | 建议修读学期。 |
| `is_required` | 是否必修。 |

联动意义：这个结构比 `program_plans.plan_json` 更适合课程匹配和毕业判断，但当前后端模块没有维护它。

### `elective_groups`

旧版选修组约束表。

| 字段 | 含义 |
|---|---|
| `schema_id` | 所属培养方案 schema。 |
| `name` | 选修组名称。 |
| `min_courses` | 最低门数。 |
| `min_credits` | 最低学分。 |
| `description` | 描述。 |

### `user_program_bindings`

旧版用户-培养方案绑定表。

| 字段 | 含义 |
|---|---|
| `user_id` | 用户。 |
| `schema_id` | 对应 `program_schemas.id`。 |
| `bound_at` | 绑定时间。 |

它与当前 `user_program_plan_bindings` 概念相似，但指向的是 `program_schemas`，不是 `program_plans`。

### `user_courses`

旧版/正规化用户课程进度表。

| 字段 | 含义 |
|---|---|
| `user_id` | 用户。 |
| `schema_course_id` | 对应培养方案课程 `schema_courses.id`。 |
| `status` | 课程状态枚举，例如 unstarted/completed。 |
| `grade` | 成绩，可为空。 |
| `semester` | 实际修读学期。 |
| `notes` | 备注。 |

联动意义：它很接近理想中的“用户课程进度表”，但当前 GPA 模块使用的是 `gpa_courses`。后续如果要做统一毕业进度，可以考虑把 `gpa_courses` 的数据迁移/映射到类似模型。

### `user_requirement_progress`

旧版通用毕业要求进度表。

| 字段 | 含义 |
|---|---|
| `user_id` | 用户。 |
| `requirement_type` | 要求类型枚举。 |
| `current_value` | 当前进度值。 |
| `target_value` | 目标值。 |
| `unit` | 单位。 |
| `status` | 进度状态。 |
| `details` | JSON 详情。 |

## 后续模块联动建议

### 短期建议

优先使用当前代码正在维护的表：

1. 用 `user_program_plan_bindings` 找到用户当前培养方案。
2. 用 `program_plan_courses` 和 `program_plan_course_groups` 读取结构化课程要求。
3. 用 `gpa_courses` 读取用户实际已修/有成绩的课程。
4. 用 `gpa_calculation_results` 展示 GPA 汇总。
5. 用 `custom_requirements`、`lecture_practice_progress`、`volunteer_labor_progress`、`srtp_records` 补充非课程类毕业要求。

这样可以避免依赖当前代码不维护的历史表，也避免每次联动都重新解析 `plan_json`。

### 课程匹配策略

后续把成绩单/GPA 课程和培养方案课程联动时，建议：

1. 如果两边都有课程代码，优先用课程代码精确匹配。
2. 当前 `gpa_courses` 没有课程代码，所以成绩单导入课程只能先用“标准化课程名 + 学分”匹配。
3. 课程名标准化应去掉 `▲` 等标记、空格差异、全角/半角符号差异，以及可安全处理的语言后缀。
4. 学分作为辅助校验。
5. 多个候选或低置信度匹配时，不要自动确认，应展示给用户选择。

### 中期 schema 整理建议

如果后续要让 GPA、培养方案、毕业判断、推荐系统稳定联动，建议新增一套统一课程身份模型，例如：

- `courses` 或 `catalog_courses`：标准课程代码、名称、学分。
- `program_plan_courses`：从 `program_plans.plan_json.courses` 拆出的培养方案课程行。
- `user_course_records`：用户实际修读/成绩单记录。
- `user_course_matches`：用户成绩记录和培养方案课程之间的匹配关系，带置信度和用户确认状态。

这样可以减少 `gpa_courses`、`program_plans.plan_json`、历史 `user_courses` 之间的数据重复和匹配歧义。

## 当前重要限制

`gpa_courses` 目前不保存课程代码、成绩单原始成绩、来源文件名、导入批次、匹配状态。成绩单解析预览阶段有 `rawName`、`rawGrade`、warnings，但确认导入后只保存 GPA 计算所需字段。

如果未来要把成绩单导入结果用于严格毕业判断，建议先补充追溯字段或新增导入审计表，避免无法解释某条课程记录来自哪里、如何换算、是否经过用户确认。
