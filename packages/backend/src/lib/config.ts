import { config } from "dotenv";
import { z } from "zod";

config({ path: "../../.env" });
config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(24),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173")
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
