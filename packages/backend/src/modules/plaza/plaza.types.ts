export type PlazaPostType = "course_exchange" | "team_recruit";
export type PlazaPostStatus = "open" | "closed";

export interface PlazaPostRecord {
  id: string;
  authorUserId: string;
  type: PlazaPostType;
  title: string;
  college: string;
  contact: string;
  description: string;
  tags: string[];
  status: PlazaPostStatus;
  offeredCourse: string | null;
  wantedCourse: string | null;
  courseTime: string | null;
  teamPurpose: string | null;
  projectType: string | null;
  teammateRequirements: string | null;
  currentMembers: number | null;
  targetMembers: number | null;
  activityTime: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PlazaPostResponse extends Omit<PlazaPostRecord, "authorUserId"> {
  authorDisplayName: string;
  isOwner: boolean;
}

export interface PlazaListResult {
  posts: PlazaPostRecord[];
  nextCursor: string | null;
}
