ALTER TABLE "training_plan_exercises" ADD COLUMN "prescription" jsonb;--> statement-breakpoint
ALTER TABLE "training_plans" ADD COLUMN "program_cycle" jsonb;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "prescription" jsonb;