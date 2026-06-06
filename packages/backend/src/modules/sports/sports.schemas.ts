import { z } from "zod";

const dateTextSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const sportsProgressSchema = z.object({
  currentRuns: z.coerce.number().int().min(0),
  targetRuns: z.coerce.number().int().min(45).max(65),
  lastRunDate: dateTextSchema.optional().nullable(),
  runDates: z.array(dateTextSchema).default([])
});

export type SportsProgressInput = z.infer<typeof sportsProgressSchema>;

export interface SportsProgress extends SportsProgressInput {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export function defaultSportsProgress(userId: string): SportsProgress {
  const now = new Date(0);
  return {
    userId,
    currentRuns: 0,
    targetRuns: 45,
    lastRunDate: null,
    runDates: [],
    createdAt: now,
    updatedAt: now
  };
}
