ALTER TABLE "training_plan_exercises" ADD COLUMN "variation" varchar(120);--> statement-breakpoint
ALTER TABLE "training_plan_exercises" ADD COLUMN "progression_steps" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "training_plan_exercises" ADD COLUMN "progression_step" smallint;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "variation" varchar(120);--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "progression_steps" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "progression_step" smallint;