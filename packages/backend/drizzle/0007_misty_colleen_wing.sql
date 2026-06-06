CREATE TABLE "course_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"term" varchar(20) NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recommended_courses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_credits" numeric(6, 2),
	"summary" text,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semester_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"term" varchar(20) NOT NULL,
	"course_code" varchar(20),
	"course_name" varchar(160) NOT NULL,
	"credits" numeric(5, 2) NOT NULL,
	"teacher" varchar(80),
	"classroom" varchar(80),
	"schedule" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" varchar(32),
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_recommendations" ADD CONSTRAINT "course_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semester_courses" ADD CONSTRAINT "semester_courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;