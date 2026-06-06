import type { AiRuleExtractor } from "./ruleExtractor.js";

export interface DeepSeekRuleExtractorOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  maxTokens?: number;
}

interface DeepSeekResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
    };
  }>;
  usage?: unknown;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

export class DeepSeekRuleExtractor implements AiRuleExtractor {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;

  constructor(options: DeepSeekRuleExtractorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY is required when DeepSeek extraction is enabled");
    }

    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
    this.model = options.model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro";
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.maxTokens = options.maxTokens ?? 8192;
  }

  async extract(input: { systemPrompt: string; userPrompt: string }): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userPrompt }
          ],
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          temperature: 0,
          stream: false,
          max_tokens: this.maxTokens
        })
      });

      const payload = (await response.json().catch(() => ({}))) as DeepSeekResponse;
      if (!response.ok) {
        throw new Error(`DeepSeek request failed: ${response.status} ${redact(payload.error?.message ?? response.statusText)}`);
      }

      const choice = payload.choices?.[0];
      if (choice?.finish_reason === "length") {
        throw new Error("DeepSeek response was truncated; reduce PDF prompt size or increase maxTokens");
      }

      const content = choice?.message?.content;
      if (!content) {
        throw new Error("DeepSeek returned an empty message");
      }

      return parseJsonObject(content);
    } finally {
      clearTimeout(timeout);
    }
  }
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
    throw new Error("DeepSeek response was not valid JSON");
  }
}

function redact(value: string): string {
  return value.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***");
}

