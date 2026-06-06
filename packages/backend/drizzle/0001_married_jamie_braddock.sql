CREATE TABLE "plaza_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"title" varchar(120) NOT NULL,
	"college" varchar(120) NOT NULL,
	"contact" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"offered_course" varchar(160),
	"wanted_course" varchar(160),
	"course_time" varchar(160),
	"team_purpose" varchar(160),
	"project_type" varchar(120),
	"teammate_requirements" text,
	"current_members" integer,
	"target_members" integer,
	"activity_time" varchar(160),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plaza_posts" ADD CONSTRAINT "plaza_posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;