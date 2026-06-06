ALTER TABLE "user_profiles" ADD COLUMN "student_id" varchar(9);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_student_id_unique" UNIQUE("student_id");