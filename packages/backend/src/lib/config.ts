import { config } from "dotenv";
import { z } from "zod";

config({ path: "../../.env" });
config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(24),
  AMAP_WEATHER_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  REMINDER_SCHEDULER_ENABLED: z
    .preprocess((v) => (typeof v === "string" ? v.toLowerCase() : v), z.enum(["true", "false"]))
    .default("true")
    .transform((v) => v === "true"),
  REMINDER_SCHEDULER_INTERVAL_MS: z.coerce.number().int().positive().min(1000).default(60_000),
  REMINDER_PUBLIC_BASE_URL: z.string().url().optional(),
  MCP_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60)
});

export function loadConfig() {
  return envSchema.parse(process.env);
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("JWT_SECRET must be at least 24 characters");
  }

  return secret;
}
