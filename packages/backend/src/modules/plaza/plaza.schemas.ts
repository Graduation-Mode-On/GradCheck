import { z } from "zod";

export const plazaPostTypeSchema = z.enum(["course_exchange", "team_recruit"]);
export const plazaPostStatusSchema = z.enum(["open", "closed"]);

const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(8).default([]);

const basePostSchema = z.object({
  title: z.string().trim().min(1).max(120),
  college: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  tags: tagsSchema
});

export const createPlazaPostSchema = z.discriminatedUnion("type", [
  basePostSchema.extend({
    type: z.literal("course_exchange"),
    offeredCourse: z.string().trim().min(1).max(160),
    wantedCourse: z.string().trim().min(1).max(160),
    courseTime: z.string().trim().min(1).max(160)
  }),
  basePostSchema
    .extend({
      type: z.literal("team_recruit"),
      teamPurpose: z.string().trim().min(1).max(160),
      projectType: z.string().trim().min(1).max(120),
      teammateRequirements: z.string().trim().min(1).max(2000),
      currentMembers: z.coerce.number().int().min(1).max(99),
      targetMembers: z.coerce.number().int().min(1).max(99),
      activityTime: z.string().trim().min(1).max(160)
    })
    .refine((input) => input.currentMembers <= input.targetMembers, {
      message: "Current members cannot exceed target members",
      path: ["currentMembers"]
    })
]);

export const updatePlazaPostSchema = createPlazaPostSchema;

export const updatePlazaPostStatusSchema = z.object({
  status: plazaPostStatusSchema
});

export const plazaListQuerySchema = z.object({
  type: plazaPostTypeSchema.optional(),
  status: plazaPostStatusSchema.default("open"),
  course: z.string().trim().min(1).max(160).optional(),
  college: z.string().trim().min(1).max(120).optional(),
  time: z.string().trim().min(1).max(160).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  keyword: z.string().trim().min(1).max(160).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export type CreatePlazaPostInput = z.infer<typeof createPlazaPostSchema>;
export type UpdatePlazaPostInput = z.infer<typeof updatePlazaPostSchema>;
export type PlazaListQuery = z.infer<typeof plazaListQuerySchema>;
export type UpdatePlazaPostStatusInput = z.infer<typeof updatePlazaPostStatusSchema>;
