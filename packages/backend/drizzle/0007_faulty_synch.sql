CREATE TABLE "program_plan_course_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_plan_id" uuid NOT NULL,
	"source_requirement_id" varchar(160) NOT NULL,
	"name" varchar(200) NOT NULL,
	"requirement_type" varchar(40) NOT NULL,
	"min_courses" numeric(6, 2),
	"min_credits" numeric(6, 2),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_plan_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_plan_id" uuid NOT NULL,
	"group_id" uuid,
	"source_requirement_id" varchar(160),
	"code" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"credits" numeric(5, 2) NOT NULL,
	"category" varchar(120),
	"subcategory" varchar(120),
	"suggested_term" varchar(40),
	"requirement_type" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "program_plan_course_groups" ADD CONSTRAINT "program_plan_course_groups_program_plan_id_program_plans_id_fk" FOREIGN KEY ("program_plan_id") REFERENCES "public"."program_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_plan_courses" ADD CONSTRAINT "program_plan_courses_program_plan_id_program_plans_id_fk" FOREIGN KEY ("program_plan_id") REFERENCES "public"."program_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_plan_courses" ADD CONSTRAINT "program_plan_courses_group_id_program_plan_course_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."program_plan_course_groups"("id") ON DELETE set null ON UPDATE no action;