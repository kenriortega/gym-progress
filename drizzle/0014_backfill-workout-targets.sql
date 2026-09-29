UPDATE "workout_exercises" we
SET "target_sets" = tpe."target_sets",
    "target_reps_min" = tpe."target_reps_min",
    "target_reps_max" = tpe."target_reps_max"
FROM "workouts" w
JOIN "training_plan_exercises" tpe ON tpe."plan_id" = w."training_plan_id"
WHERE we."workout_id" = w."id"
  AND tpe."exercise_id" = we."exercise_id"
  AND we."target_sets" IS NULL;
