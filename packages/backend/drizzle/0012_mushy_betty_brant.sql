CREATE TABLE "lab_exam_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reminder_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"course_name" varchar(160),
	"event_type" varchar(32) NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"location" varchar(200),
	"teacher" varchar(120),
	"seat_or_group" varchar(120),
	"notes" text,
	"status" varchar(32) DEFAULT 'scheduled' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_delivery_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reminder_id" uuid NOT NULL,
	"channel" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"provider_message_id" varchar(160),
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"category" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"priority" varchar(32) DEFAULT 'normal' NOT NULL,
	"start_at" timestamp with time zone,
	"due_at" timestamp with time zone NOT NULL,
	"location" varchar(200),
	"notes" text,
	"source_type" varchar(32) DEFAULT 'custom' NOT NULL,
	"source_id" uuid,
	"reminder_offsets" jsonb DEFAULT '[1440,60]'::jsonb NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"show_on_home" boolean DEFAULT true NOT NULL,
	"completed_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
ALTER TABLE "lab_exam_events" ADD CONSTRAINT "lab_exam_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_exam_events" ADD CONSTRAINT "lab_exam_events_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_delivery_logs" ADD CONSTRAINT "reminder_delivery_logs_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports_progress" ADD CONSTRAINT "sports_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;