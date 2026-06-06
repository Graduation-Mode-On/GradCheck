CREATE TABLE "user_ignored_program_plan_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"program_plan_course_group_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_ignored_program_plan_groups" ADD CONSTRAINT "user_ignored_program_plan_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ignored_program_plan_groups" ADD CONSTRAINT "user_ignored_program_plan_groups_program_plan_course_group_id_program_plan_course_groups_id_fk" FOREIGN KEY ("program_plan_course_group_id") REFERENCES "public"."program_plan_course_groups"("id") ON DELETE cascade ON UPDATE no action;