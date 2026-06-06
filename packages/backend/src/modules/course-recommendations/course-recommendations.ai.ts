import {
  aiRecommendationResponseSchema,
  type AiRecommendationResponse,
  type RecommendationPreferences
} from "./course-recommendations.schemas.js";

const IMAGE_PARSE_SYSTEM_PROMPT = [
  "你是一个教务系统选课信息提取助手。",
  "从用户提供的选课截图中提取所有课程信息，返回严格JSON格式。",
  "不要编造课程信息，只提取截图中可见的内容。"
].join(" ");

const RECOMMENDATION_SYSTEM_PROMPT = [
  "你是一个大学选课排课助手。根据用户提供的候选课程、本学期可选课程时间安排、以及用户偏好，生成最优选课方案。",
  "约束条件：",
  "1. 同一时间段的课程不能同时选（冲突检测）",
  "2. 必修课程必须全部选上",
  "3. 尊重用户避开某些天的偏好",
  "4. 控制单日课程数量不超过用户设定",
  "5. 考虑培养方案中建议的修读学期",
  "返回严格JSON格式。"
].join(" ");

interface DeepSeekMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface DeepSeekResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error("DEEPSEEK_API_KEY is required for course recommendation AI features");
  }
  return key;
}

function getBaseUrl(): string {
  return (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
}

function getModel(): string {
  return process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro";
}

function parseJsonObject(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("AI response was not valid JSON");
  }
}

async function callDeepSeek(messages: DeepSeekMessage[]): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${getBaseUrl()}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${getApiKey()}`
      },
      body: JSON.stringify({
        model: getModel(),
        messages,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        temperature: 0,
        stream: false,
        max_tokens: 8192
      })
    });

    const payload = (await response.json().catch(() => ({}))) as DeepSeekResponse;
    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status} ${payload.error?.message ?? response.statusText}`);
    }

    const choice = payload.choices?.[0];
    if (choice?.finish_reason === "length") {
      throw new Error("AI response was truncated; reduce prompt size or increase maxTokens");
    }

    const content = choice?.message?.content;
    if (!content) {
      throw new Error("AI returned an empty message");
    }

    return parseJsonObject(content);
  } finally {
    clearTimeout(timeout);
  }
}

export async function parseCourseImage(imageBase64: string): Promise<unknown> {
  const prompt = [
    "请提取截图中的所有课程信息。",
    "返回JSON格式：",
    '{"courses": [{"courseName": "课程名称", "courseCode": "课程代码（如有）", "credits": 3.0, "teacher": "教师", "classroom": "教室", "schedule": [{"dayOfWeek": 1, "startPeriod": 1, "endPeriod": 2, "startWeek": 1, "endWeek": 16, "weekLabel": "1-16周"}]}]}',
    "说明：dayOfWeek 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六, 7=周日；startPeriod/endPeriod 表示第几节课；startWeek/endWeek 表示起止周。",
    "如果某门课有多段时间，schedule 数组中会有多个对象。"
  ].join("\n");

  const messages: DeepSeekMessage[] = [
    { role: "system", content: IMAGE_PARSE_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
        }
      ]
    }
  ];

  return callDeepSeek(messages);
}

export interface CandidateCourse {
  code: string;
  name: string;
  credits: number;
  category: string | null;
  subcategory: string | null;
  term?: { year?: string | null; semester?: string | null };
}

export interface SemesterCourseForAi {
  courseName: string;
  courseCode: string | null;
  credits: number;
  teacher: string | null;
  classroom: string | null;
  schedule: Array<{
    dayOfWeek: number;
    startPeriod: number;
    endPeriod: number;
    startWeek?: number;
    endWeek?: number;
    weekLabel?: string;
  }>;
}

export async function generateRecommendation(
  candidates: CandidateCourse[],
  semesterCourses: SemesterCourseForAi[],
  preferences: RecommendationPreferences
): Promise<AiRecommendationResponse> {
  const prompt = [
    "候选课程（来自培养方案，用户还未修读）：",
    JSON.stringify(candidates, null, 2),
    "",
    "本学期可选课程（含具体时间安排）：",
    JSON.stringify(semesterCourses, null, 2),
    "",
    "用户偏好：",
    JSON.stringify(preferences, null, 2),
    "",
    "请从本学期可选课程中选择最优组合，返回JSON：",
    '{"recommendedCourses": [{"courseCode": "...", "courseName": "...", "credits": 3.0, "teacher": "...", "classroom": "...", "schedule": [{"dayOfWeek": 1, "startPeriod": 1, "endPeriod": 2}], "reason": "推荐理由"}], "totalCredits": 22.5, "courseCount": 6, "summary": "方案概述", "warnings": ["可选警告"]}'
  ].join("\n");

  const messages: DeepSeekMessage[] = [
    { role: "system", content: RECOMMENDATION_SYSTEM_PROMPT },
    { role: "user", content: prompt }
  ];

  const result = await callDeepSeek(messages);
  return aiRecommendationResponseSchema.parse(result);
}
