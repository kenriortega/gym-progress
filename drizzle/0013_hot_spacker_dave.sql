ALTER TABLE "workout_exercises" ADD COLUMN "target_sets" smallint;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "target_reps_min" smallint;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "target_reps_max" smallint;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_target_sets_range" CHECK ("workout_exercises"."target_sets" is null or "workout_exercises"."target_sets" between 1 and 20);--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_target_reps_range" CHECK (("workout_exercises"."target_reps_min" is null and "workout_exercises"."target_reps_max" is null)
        or ("workout_exercises"."target_reps_min" between 1 and 1000
          and "workout_exercises"."target_reps_max" between "workout_exercises"."target_reps_min" and 1000));