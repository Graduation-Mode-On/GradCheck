ALTER TABLE "course_recommendations" ADD COLUMN "conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint