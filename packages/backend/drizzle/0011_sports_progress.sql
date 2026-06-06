CREATE TABLE "sports_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_runs" integer DEFAULT 0 NOT NULL,
	"target_runs" integer DEFAULT 45 NOT NULL,
	"last_run_date" varchar(10),
	"run_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sports_progress" ADD CONSTRAINT "sports_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
