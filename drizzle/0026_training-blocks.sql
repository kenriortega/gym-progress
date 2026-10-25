ALTER TABLE "training_plans" ADD COLUMN "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "block_progress" jsonb DEFAULT '{}'::jsonb NOT NULL;