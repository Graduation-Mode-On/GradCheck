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
