CREATE TABLE "program_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_filename" varchar(240) NOT NULL,
	"school" varchar(120) NOT NULL,
	"college" varchar(120),
	"major" varchar(120) NOT NULL,
	"grade" varchar(40),
	"total_credits" numeric(6, 2),
	"course_count" integer NOT NULL,
	"requirement_count" integer NOT NULL,
	"warning_count" integer NOT NULL,
	"plan_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_program_bindings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"program_plan_id" uuid NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_program_bindings" ADD CONSTRAINT "user_program_bindings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_program_bindings" ADD CONSTRAINT "user_program_bindings_program_plan_id_program_plans_id_fk" FOREIGN KEY ("program_plan_id") REFERENCES "public"."program_plans"("id") ON DELETE cascade ON UPDATE no action;