CREATE TABLE "user_course_plan_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"gpa_course_id" uuid NOT NULL,
	"program_plan_course_id" uuid NOT NULL,
	"match_method" varchar(40) NOT NULL,
	"confidence" numeric(4, 2) NOT NULL,
	"confirmed_by_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_course_plan_matches" ADD CONSTRAINT "user_course_plan_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_plan_matches" ADD CONSTRAINT "user_course_plan_matches_gpa_course_id_gpa_courses_id_fk" FOREIGN KEY ("gpa_course_id") REFERENCES "public"."gpa_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_plan_matches" ADD CONSTRAINT "user_course_plan_matches_program_plan_course_id_program_plan_courses_id_fk" FOREIGN KEY ("program_plan_course_id") REFERENCES "public"."program_plan_courses"("id") ON DELETE cascade ON UPDATE no action;