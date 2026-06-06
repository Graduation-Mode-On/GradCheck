import type { SmsAdapter, SmsSendInput, SmsSendResult } from "./sms-adapter.js";

export interface PushPlusAdapterOptions {
  endpoint?: string;
  publicBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface PushPlusResponse {
  code: number;
  msg: string;
  data?: string;
}

const DEFAULT_ENDPOINT = "https://www.pushplus.plus/send";

function formatScheduledAt(date: Date): string {
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildTitle(reminder: SmsSendInput["reminder"]): string {
  const tag = (() => {
    switch (reminder.category) {
      case "exam":
        return "考试提醒";
      case "lab":
        return "实验提醒";
      case "volunteer":
        return "志愿活动";
      case "labor":
        return "劳动课";
      case "sports":
        return "体育锻炼";
      default:
        return "GradCheck 提醒";
    }
  })();
  return `[${tag}] ${reminder.title}`;
}

function buildContent(input: SmsSendInput, publicBaseUrl?: string): string {
  const { reminder, scheduledAt } = input;
  const parts: string[] = [];
  parts.push(`你设置的事项 "${reminder.title}" 即将到期。`);
  parts.push(`截止时间：${formatScheduledAt(reminder.dueAt)}`);
  if (reminder.location) {
    parts.push(`地点：${reminder.location}`);
  }
  if (reminder.notes) {
    parts.push(`备注：${reminder.notes}`);
  }
  parts.push(`本提醒触发于：${formatScheduledAt(scheduledAt)}`);
  if (publicBaseUrl) {
    const trimmed = publicBaseUrl.replace(/\/+$/, "");
    parts.push(`查看详情：${trimmed}/reminders`);
  }
  return parts.join("\n");
}

export class PushPlusAdapter implements SmsAdapter {
  private readonly endpoint: string;
  private readonly publicBaseUrl?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PushPlusAdapterOptions = {}) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.publicBaseUrl = options.publicBaseUrl;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sendReminder(input: SmsSendInput): Promise<SmsSendResult> {
    const payload = {
      token: input.pushplusToken,
      title: buildTitle(input.reminder),
      content: buildContent(input, this.publicBaseUrl),
      template: "txt",
      channel: "wechat"
    };

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new Error(`PushPlus 请求失败：${cause}`);
    }

    if (!response.ok) {
      throw new Error(`PushPlus HTTP ${response.status}`);
    }

    let body: PushPlusResponse;
    try {
      body = (await response.json()) as PushPlusResponse;
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new Error(`PushPlus 响应不是合法 JSON：${cause}`);
    }

    if (body.code !== 200) {
      throw new Error(`PushPlus 拒绝请求：code=${body.code}, msg=${body.msg}`);
    }

    const providerMessageId = body.data ?? `pushplus-${input.reminder.id}-${input.scheduledAt.getTime()}`;
    return { providerMessageId };
  }
}
