CREATE TYPE "public"."weight_unit" AS ENUM('kg', 'lb');--> statement-breakpoint
CREATE TYPE "public"."workout_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" varchar(100) NOT NULL,
	"muscle_group" varchar(60) NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercises_name_not_blank" CHECK (char_length(trim("exercises"."name")) > 0),
	CONSTRAINT "exercises_muscle_group_not_blank" CHECK (char_length(trim("exercises"."muscle_group")) > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(100),
	"preferred_weight_unit" "weight_unit" DEFAULT 'kg' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_exercises_position_nonnegative" CHECK ("workout_exercises"."position" >= 0),
	CONSTRAINT "workout_exercises_notes_length" CHECK ("workout_exercises"."notes" is null or char_length("workout_exercises"."notes") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_exercise_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"reps" smallint NOT NULL,
	"weight" numeric(7, 2) NOT NULL,
	"rpe" numeric(3, 1),
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_sets_position_nonnegative" CHECK ("workout_sets"."position" >= 0),
	CONSTRAINT "workout_sets_reps_range" CHECK ("workout_sets"."reps" between 1 and 1000),
	CONSTRAINT "workout_sets_weight_nonnegative" CHECK ("workout_sets"."weight" >= 0),
	CONSTRAINT "workout_sets_rpe_range" CHECK ("workout_sets"."rpe" is null or "workout_sets"."rpe" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "workout_status" DEFAULT 'active' NOT NULL,
	"weight_unit" "weight_unit" DEFAULT 'kg' NOT NULL,
	"notes" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workouts_completion_state" CHECK (("workouts"."status" = 'completed' and "workouts"."completed_at" is not null)
        or ("workouts"."status" <> 'completed' and "workouts"."completed_at" is null)),
	CONSTRAINT "workouts_notes_length" CHECK ("workouts"."notes" is null or char_length("workouts"."notes") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_exercise_id_workout_exercises_id_fk" FOREIGN KEY ("workout_exercise_id") REFERENCES "public"."workout_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_system_name_unique" ON "exercises" USING btree (lower("name")) WHERE "exercises"."user_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_user_name_unique" ON "exercises" USING btree ("user_id",lower("name")) WHERE "exercises"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "workout_exercises_position_unique" ON "workout_exercises" USING btree ("workout_id","position");--> statement-breakpoint
CREATE INDEX "workout_exercises_exercise_idx" ON "workout_exercises" USING btree ("exercise_id","workout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_sets_position_unique" ON "workout_sets" USING btree ("workout_exercise_id","position");--> statement-breakpoint
CREATE INDEX "workout_sets_workout_exercise_idx" ON "workout_sets" USING btree ("workout_exercise_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "workouts_one_active_per_user" ON "workouts" USING btree ("user_id") WHERE "workouts"."status" = 'active';--> statement-breakpoint
CREATE INDEX "workouts_user_performed_at_idx" ON "workouts" USING btree ("user_id","performed_at");