export interface UserProfileInput {
  displayName: string;
  college: string;
  major: string;
  grade: number;
  gpaGoal: string;
  studentId: string;
}

export interface UserProfile extends Omit<UserProfileInput, "studentId"> {
  userId: string;
  studentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
