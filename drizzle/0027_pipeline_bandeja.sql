ALTER TABLE "conversation" ADD COLUMN IF NOT EXISTS "inbox_stage" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN IF NOT EXISTS "inbox_stage_at" timestamp;
