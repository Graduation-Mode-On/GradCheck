import { z } from "zod";

export const newsTypeSchema = z.enum(["lecture", "competition", "project", "practice"]);
export const newsStatusSchema = z.enum(["active", "expired", "cancelled"]);
export const newsDataQualitySchema = z.enum(["complete", "partial", "unverified"]);

export const newsListQuerySchema = z.object({
  type: newsTypeSchema.optional(),
  keyword: z.string().trim().min(1).max(160).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export type NewsType = z.infer<typeof newsTypeSchema>;
export type NewsStatus = z.infer<typeof newsStatusSchema>;
export type NewsDataQuality = z.infer<typeof newsDataQualitySchema>;
export type NewsListQuery = z.infer<typeof newsListQuerySchema>;
