export type NewsType = "lecture" | "competition" | "project" | "practice";
export type NewsStatus = "active" | "expired" | "cancelled";
export type NewsDataQuality = "complete" | "partial" | "unverified";

export interface NewsItem {
  id: string;
  title: string;
  type: NewsType;
  organizer: string | null;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  registrationUrl: string | null;
  targetAudience: string | null;
  creditCategory: string | null;
  description: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  dataQuality: NewsDataQuality;
  status: NewsStatus;
  scrapedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewsItemFilters {
  type?: NewsType;
  keyword?: string;
}

export const newsTypeLabel: Record<NewsType, string> = {
  lecture: "讲座",
  competition: "竞赛",
  project: "项目",
  practice: "实践"
};

export const newsTypeColor: Record<NewsType, string> = {
  lecture: "bg-blue-100 text-blue-700",
  competition: "bg-orange-100 text-orange-700",
  project: "bg-purple-100 text-purple-700",
  practice: "bg-green-100 text-green-700"
};
