CREATE TABLE "training_plan_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"target_sets" smallint DEFAULT 3 NOT NULL,
	"target_reps_min" smallint DEFAULT 8 NOT NULL,
	"target_reps_max" smallint DEFAULT 12 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_plan_exercises_position_nonnegative" CHECK ("training_plan_exercises"."position" >= 0),
	CONSTRAINT "training_plan_exercises_sets_range" CHECK ("training_plan_exercises"."target_sets" between 1 and 20),
	CONSTRAINT "training_plan_exercises_reps_range" CHECK ("training_plan_exercises"."target_reps_min" between 1 and 1000
        and "training_plan_exercises"."target_reps_max" between "training_plan_exercises"."target_reps_min" and 1000)
);
--> statement-breakpoint
CREATE TABLE "training_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"weekday" smallint,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_plans_name_not_blank" CHECK (char_length(trim("training_plans"."name")) > 0),
	CONSTRAINT "training_plans_weekday_range" CHECK ("training_plans"."weekday" is null or "training_plans"."weekday" between 0 and 6)
);
--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "training_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "training_plan_exercises" ADD CONSTRAINT "training_plan_exercises_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_exercises" ADD CONSTRAINT "training_plan_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "training_plan_exercises_position_unique" ON "training_plan_exercises" USING btree ("plan_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "training_plan_exercises_exercise_unique" ON "training_plan_exercises" USING btree ("plan_id","exercise_id");--> statement-breakpoint
CREATE INDEX "training_plan_exercises_exercise_idx" ON "training_plan_exercises" USING btree ("exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_plans_user_name_unique" ON "training_plans" USING btree ("user_id",lower("name")) WHERE "training_plans"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "training_plans_user_weekday_idx" ON "training_plans" USING btree ("user_id","weekday");--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_training_plan_id_training_plans_id_fk" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workouts_training_plan_idx" ON "workouts" USING btree ("training_plan_id");