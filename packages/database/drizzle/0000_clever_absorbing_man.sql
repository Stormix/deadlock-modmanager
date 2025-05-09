CREATE TABLE "custom_setting" (
	"id" text PRIMARY KEY DEFAULT concat('custom_setting_', gen_random_uuid()) NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_download" (
	"id" text PRIMARY KEY DEFAULT concat('mod_download_', gen_random_uuid()) NOT NULL,
	"mod_id" text NOT NULL,
	"remote_id" text NOT NULL,
	"file" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"size" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod" (
	"id" text PRIMARY KEY DEFAULT concat('mod_', gen_random_uuid()) NOT NULL,
	"remote_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"remote_url" text NOT NULL,
	"category" text NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"author" text NOT NULL,
	"downloadable" boolean DEFAULT false NOT NULL,
	"remote_added_at" timestamp NOT NULL,
	"remote_updated_at" timestamp NOT NULL,
	"tags" text[] NOT NULL,
	"images" text[] NOT NULL,
	"hero" text,
	"download_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "mod_remote_id_unique" UNIQUE("remote_id")
);
--> statement-breakpoint
ALTER TABLE "mod_download" ADD CONSTRAINT "mod_download_mod_id_mod_id_fk" FOREIGN KEY ("mod_id") REFERENCES "public"."mod"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mod_download_mod_id_remote_id_idx" ON "mod_download" USING btree ("mod_id","remote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mod_download_mod_id_idx" ON "mod_download" USING btree ("mod_id");