import { z } from "zod";

export const plazaPostTypeSchema = z.enum(["course_exchange", "team_recruit"]);
export const plazaPostStatusSchema = z.enum(["open", "closed"]);

export const plazaTagsFromText = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);

const basePostSchema = z.object({
  title: z.string().trim().min(1, "请输入标题").max(120),
  college: z.string().trim().min(1, "请输入学院").max(120),
  contact: z.string().trim().min(1, "请输入联系方式").max(200),
  description: z.string().trim().min(1, "请输入说明").max(2000),
  tags: z.array(z.string().min(1).max(40)).max(8)
});

export const plazaPostInputSchema = z.discriminatedUnion("type", [
  basePostSchema.extend({
    type: z.literal("course_exchange"),
    offeredCourse: z.string().trim().min(1, "请输入换出课程").max(160),
    wantedCourse: z.string().trim().min(1, "请输入期望换入课程").max(160),
    courseTime: z.string().trim().min(1, "请输入课程时间").max(160)
  }),
  basePostSchema
    .extend({
      type: z.literal("team_recruit"),
      teamPurpose: z.string().trim().min(1, "请输入组队目的").max(160),
      projectType: z.string().trim().min(1, "请输入项目类型").max(120),
      teammateRequirements: z.string().trim().min(1, "请输入队友要求").max(2000),
      currentMembers: z.coerce.number().int().min(1, "当前人数至少为 1").max(99),
      targetMembers: z.coerce.number().int().min(1, "目标人数至少为 1").max(99),
      activityTime: z.string().trim().min(1, "请输入时间信息").max(160)
    })
    .refine((input) => input.currentMembers <= input.targetMembers, {
      message: "当前人数不能超过目标人数",
      path: ["currentMembers"]
    })
]);

export type PlazaPostInput = z.infer<typeof plazaPostInputSchema>;
export type PlazaPostType = z.infer<typeof plazaPostTypeSchema>;
export type PlazaPostStatus = z.infer<typeof plazaPostStatusSchema>;

export type PlazaPost = PlazaPostInput & {
  id: string;
  authorDisplayName: string;
  isOwner: boolean;
  status: PlazaPostStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export interface PlazaPostFilters {
  type?: PlazaPostType;
  status?: PlazaPostStatus;
  keyword?: string;
}
