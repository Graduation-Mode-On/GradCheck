CREATE TABLE "news_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"type" varchar(32) NOT NULL,
	"organizer" varchar(200),
	"location" varchar(200),
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"registration_url" text,
	"target_audience" varchar(200),
	"credit_category" varchar(100),
	"description" text,
	"source_url" text,
	"source_name" varchar(100),
	"data_quality" varchar(20) DEFAULT 'complete' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"scraped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srtp_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"type" varchar(32) NOT NULL,
	"credits" numeric(5, 2) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "srtp_records" ADD CONSTRAINT "srtp_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;