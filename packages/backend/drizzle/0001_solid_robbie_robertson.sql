CREATE TABLE "custom_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"category" varchar(32) NOT NULL,
	"target_value" numeric(8, 2) NOT NULL,
	"current_value" numeric(8, 2) DEFAULT '0' NOT NULL,
	"unit" varchar(24) NOT NULL,
	"importance" varchar(32) NOT NULL,
	"source" varchar(32) NOT NULL,
	"include_in_progress" boolean DEFAULT true NOT NULL,
	"show_on_home" boolean DEFAULT true NOT NULL,
	"deadline" varchar(10),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_requirements" ADD CONSTRAINT "custom_requirements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;