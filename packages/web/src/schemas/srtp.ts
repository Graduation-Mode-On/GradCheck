import { z } from "zod";

export const srtpRecordTypeSchema = z.enum(["competition", "project", "lecture", "other"]);

export const srtpRecordInputSchema = z.object({
  title: z.string().trim().min(1, "请输入名称").max(160),
  type: srtpRecordTypeSchema,
  credits: z.string().regex(/^\d+(\.\d{1,2})?$/, "请输入非负学分，最多两位小数"),
  description: z.string().trim().max(2000).default("")
});

export type SrtpRecordInput = z.infer<typeof srtpRecordInputSchema>;
export type SrtpRecordType = z.infer<typeof srtpRecordTypeSchema>;

export interface SrtpRecord extends SrtpRecordInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface SrtpSummary {
  totalCredits: string;
  passingRequiredCredits: "2.00";
  excellentRequiredCredits: "6.00";
  status: "not_passing" | "passing" | "excellent";
  missingForPassing: string;
  missingForExcellent: string;
}

export interface SrtpOverview {
  records: SrtpRecord[];
  summary: SrtpSummary;
}

export function srtpTypeLabel(type: SrtpRecordType): string {
  return {
    competition: "竞赛",
    project: "SRTP项目",
    lecture: "SRTP讲座",
    other: "其他"
  }[type];
}

export function fixedCredit(value: string | number): string {
  return Number(value || 0).toFixed(2);
}
