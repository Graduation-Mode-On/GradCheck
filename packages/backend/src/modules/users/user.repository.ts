export interface UserProfileInput {
  displayName: string;
  college: string;
  major: string;
  grade: number;
  gpaGoal: string;
  studentId: string;
  pushplusToken: string | null;
}

export interface UserProfile extends Omit<UserProfileInput, "studentId" | "pushplusToken"> {
  userId: string;
  studentId: string | null;
  pushplusToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}
