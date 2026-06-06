CREATE TABLE "lecture_practice_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"human_lecture_count" integer DEFAULT 0 NOT NULL,
	"book_report_count" integer DEFAULT 0 NOT NULL,
	"social_practice_credits" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"social_practice_course_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteer_labor_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"volunteer_hours" numeric(6, 2) DEFAULT '0.00' NOT NULL,
	"ordinary_labor_count" integer DEFAULT 0 NOT NULL,
	"special_labor_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lecture_practice_progress" ADD CONSTRAINT "lecture_practice_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_labor_progress" ADD CONSTRAINT "volunteer_labor_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;