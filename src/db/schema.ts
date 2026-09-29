import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const weightUnit = pgEnum("weight_unit", ["kg", "lb"]);
export const workoutStatus = pgEnum("workout_status", [
  "active",
  "completed",
  "abandoned",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 100 }),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  preferredWeightUnit: weightUnit("preferred_weight_unit").notNull().default("kg"),
  ...timestamps,
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    muscleGroup: varchar("muscle_group", { length: 60 }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("exercises_system_name_unique")
      .on(sql`lower(${table.name})`)
      .where(sql`${table.userId} is null`),
    uniqueIndex("exercises_user_name_unique")
      .on(table.userId, sql`lower(${table.name})`)
      .where(sql`${table.archivedAt} is null`),
    check("exercises_name_not_blank", sql`char_length(trim(${table.name})) > 0`),
    check(
      "exercises_muscle_group_not_blank",
      sql`char_length(trim(${table.muscleGroup})) > 0`,
    ),
  ],
);

export const trainingPlans = pgTable(
  "training_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    weekday: smallint("weekday"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("training_plans_user_name_unique")
      .on(table.userId, sql`lower(${table.name})`)
      .where(sql`${table.archivedAt} is null`),
    index("training_plans_user_weekday_idx").on(table.userId, table.weekday),
    check("training_plans_name_not_blank", sql`char_length(trim(${table.name})) > 0`),
    check(
      "training_plans_weekday_range",
      sql`${table.weekday} is null or ${table.weekday} between 0 and 6`,
    ),
  ],
);

export const trainingPlanExercises = pgTable(
  "training_plan_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => trainingPlans.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    position: smallint("position").notNull(),
    targetSets: smallint("target_sets").notNull().default(3),
    targetRepsMin: smallint("target_reps_min").notNull().default(8),
    targetRepsMax: smallint("target_reps_max").notNull().default(12),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("training_plan_exercises_position_unique").on(
      table.planId,
      table.position,
    ),
    uniqueIndex("training_plan_exercises_exercise_unique").on(
      table.planId,
      table.exerciseId,
    ),
    index("training_plan_exercises_exercise_idx").on(table.exerciseId),
    check("training_plan_exercises_position_nonnegative", sql`${table.position} >= 0`),
    check(
      "training_plan_exercises_sets_range",
      sql`${table.targetSets} between 1 and 20`,
    ),
    check(
      "training_plan_exercises_reps_range",
      sql`${table.targetRepsMin} between 1 and 1000
        and ${table.targetRepsMax} between ${table.targetRepsMin} and 1000`,
    ),
  ],
);

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trainingPlanId: uuid("training_plan_id").references(() => trainingPlans.id, {
      onDelete: "set null",
    }),
    performedAt: timestamp("performed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: workoutStatus("status").notNull().default("active"),
    weightUnit: weightUnit("weight_unit").notNull().default("kg"),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workouts_one_active_per_user")
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
    index("workouts_user_performed_at_idx").on(table.userId, table.performedAt),
    index("workouts_training_plan_idx").on(table.trainingPlanId),
    check(
      "workouts_completion_state",
      sql`(${table.status} = 'completed' and ${table.completedAt} is not null)
        or (${table.status} <> 'completed' and ${table.completedAt} is null)`,
    ),
    check(
      "workouts_notes_length",
      sql`${table.notes} is null or char_length(${table.notes}) <= 2000`,
    ),
  ],
);

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    position: smallint("position").notNull(),
    targetSets: smallint("target_sets"),
    targetRepsMin: smallint("target_reps_min"),
    targetRepsMax: smallint("target_reps_max"),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workout_exercises_position_unique").on(
      table.workoutId,
      table.position,
    ),
    index("workout_exercises_exercise_idx").on(table.exerciseId, table.workoutId),
    check("workout_exercises_position_nonnegative", sql`${table.position} >= 0`),
    check(
      "workout_exercises_notes_length",
      sql`${table.notes} is null or char_length(${table.notes}) <= 1000`,
    ),
    check(
      "workout_exercises_target_sets_range",
      sql`${table.targetSets} is null or ${table.targetSets} between 1 and 20`,
    ),
    check(
      "workout_exercises_target_reps_range",
      sql`(${table.targetRepsMin} is null and ${table.targetRepsMax} is null)
        or (${table.targetRepsMin} between 1 and 1000
          and ${table.targetRepsMax} between ${table.targetRepsMin} and 1000)`,
    ),
  ],
);

export const workoutSets = pgTable(
  "workout_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutExerciseId: uuid("workout_exercise_id")
      .notNull()
      .references(() => workoutExercises.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    reps: smallint("reps").notNull(),
    weight: numeric("weight", { precision: 7, scale: 2 }).notNull(),
    rpe: numeric("rpe", { precision: 3, scale: 1 }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("workout_sets_position_unique").on(
      table.workoutExerciseId,
      table.position,
    ),
    index("workout_sets_workout_exercise_idx").on(
      table.workoutExerciseId,
      table.position,
    ),
    check("workout_sets_position_nonnegative", sql`${table.position} >= 0`),
    check("workout_sets_reps_range", sql`${table.reps} between 1 and 1000`),
    check("workout_sets_weight_nonnegative", sql`${table.weight} >= 0`),
    check("workout_sets_rpe_range", sql`${table.rpe} is null or ${table.rpe} between 1 and 10`),
  ],
);

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type TrainingPlan = typeof trainingPlans.$inferSelect;
export type TrainingPlanExercise = typeof trainingPlanExercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
