CREATE TABLE "gpa_calculation_results" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"required_first_attempt" jsonb NOT NULL,
	"overall" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gpa_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"term" varchar(20) NOT NULL,
	"name" varchar(160) NOT NULL,
	"credit" numeric(5, 2) NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_first_attempt" boolean DEFAULT true NOT NULL,
	"is_gpa_eligible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gpa_calculation_results" ADD CONSTRAINT "gpa_calculation_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gpa_courses" ADD CONSTRAINT "gpa_courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;