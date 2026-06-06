import type { NewsDataQuality, NewsStatus, NewsType } from "./news.schemas.js";

export interface NewsItemRecord {
  id: string;
  title: string;
  type: NewsType;
  organizer: string | null;
  location: string | null;
  startTime: Date | null;
  endTime: Date | null;
  registrationUrl: string | null;
  targetAudience: string | null;
  creditCategory: string | null;
  description: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  dataQuality: NewsDataQuality;
  status: NewsStatus;
  scrapedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewsListResult {
  items: NewsItemRecord[];
  nextCursor: string | null;
}
