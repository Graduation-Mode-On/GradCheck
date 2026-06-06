export interface UserProfileInput {
  displayName: string;
  college: string;
  major: string;
  grade: number;
  gpaGoal: string;
}

export interface UserProfile extends UserProfileInput {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
