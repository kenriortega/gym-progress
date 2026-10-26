import type { TrainingBlock, BlockProgressMap, Discipline } from "../lib/training-blocks";
import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
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
export const bodyMeasurementSystem = pgEnum("body_measurement_system", ["metric", "imperial"]);
export const muscleRole = pgEnum("muscle_role", ["primary", "secondary"]);
export const workoutStatus = pgEnum("workout_status", [
  "active",
  "completed",
  "abandoned",
]);

export const measurement = pgEnum("measurement", ["reps", "time"]);
export const loadType = pgEnum("load_type", ["external", "bodyweight", "weighted", "assisted"]);
const metrics = { variation: varchar("variation", { length: 120 }), progressionSteps: jsonb("progression_steps").$type<string[]>().notNull().default([]), progressionStep: smallint("progression_step"), measurement: measurement("measurement").notNull().default("reps"), loadType: loadType("load_type").notNull().default("external"), targetSeconds: integer("target_seconds") };

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
  preferredBodySystem: bodyMeasurementSystem("preferred_body_system").notNull().default("metric"),
  /** Peso al que apuntas, en kg. Null mientras no te marques ninguno. */
  goalWeight: numeric("goal_weight", { precision: 5, scale: 2 }),
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
    /**
     * Stable key for the apparatus this exercise uses, so renaming the exercise
     * does not silently drop its interactive figure. Nullable: most exercises
     * have no figure, and the ones a user creates never get one assigned.
     * Values live in the figure registry (`src/lib/exercise-figures.ts`), not in
     * the database, so adding a figure needs no migration.
     */
    equipmentKey: varchar("equipment_key", { length: 60 }),
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
    discipline: varchar("discipline", { length: 20 }).$type<Discipline>().notNull().default("strength"),
    blocks: jsonb("blocks").$type<TrainingBlock[]>().notNull().default([]),
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
    ...metrics,
    targetSets: smallint("target_sets").notNull().default(3),
    targetRepsMin: smallint("target_reps_min").default(8),
    targetRepsMax: smallint("target_reps_max").default(12),
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
      sql`(${table.measurement} = 'time' and ${table.targetRepsMin} is null and ${table.targetRepsMax} is null and ${table.targetSeconds} is not null and ${table.targetSeconds} between 1 and 86400) or (${table.measurement} = 'reps' and ${table.targetSeconds} is null and ${table.targetRepsMin} is not null and ${table.targetRepsMax} is not null and ${table.targetRepsMin} between 1 and 1000 and ${table.targetRepsMax} between ${table.targetRepsMin} and 1000)`,
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
    discipline: varchar("discipline", { length: 20 }).$type<Discipline>().notNull().default("strength"),
    blocks: jsonb("blocks").$type<TrainingBlock[]>().notNull().default([]),
    blockProgress: jsonb("block_progress").$type<BlockProgressMap>().notNull().default({}),
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
    ...metrics,
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
      sql`(${table.measurement} = 'time' and ${table.targetRepsMin} is null and ${table.targetRepsMax} is null and ${table.targetSeconds} is not null and ${table.targetSeconds} between 1 and 86400) or (${table.measurement} = 'reps' and ${table.targetSeconds} is null and ((${table.targetRepsMin} is null and ${table.targetRepsMax} is null) or (${table.targetRepsMin} is not null and ${table.targetRepsMax} is not null and ${table.targetRepsMin} between 1 and 1000 and ${table.targetRepsMax} between ${table.targetRepsMin} and 1000)))`,
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
    durationSeconds: integer("duration_seconds"),
    loadType: loadType("load_type").notNull().default("external"),
    assistanceNote: varchar("assistance_note", { length: 120 }),
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
    check("workout_sets_reps_range", sql`(${table.durationSeconds} is null and ${table.reps} between 1 and 1000) or (${table.durationSeconds} is not null and ${table.durationSeconds} between 1 and 86400 and ${table.reps} = 0)`),
    check("workout_sets_load_valid", sql`(${table.loadType} <> 'bodyweight' or ${table.weight} = 0) and (${table.loadType} = 'assisted' or ${table.assistanceNote} is null) and (${table.assistanceNote} is null or char_length(trim(${table.assistanceNote})) > 0) and (${table.loadType} <> 'assisted' or ${table.weight} > 0 or ${table.assistanceNote} is not null)`),
    check("workout_sets_weight_nonnegative", sql`${table.weight} >= 0`),
    check("workout_sets_rpe_range", sql`${table.rpe} is null or ${table.rpe} between 1 and 10`),
  ],
);

/**
 * Una pesada al día y como mucho una: el peso corporal oscila cerca de un kilo
 * entre la mañana y la noche, así que guardar varias el mismo día añade ruido
 * sin información. Registrar otra vez sustituye la del día.
 */
export const bodyWeights = pgTable(
  "body_weights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Siempre en kg, a diferencia de `workouts.weightUnit`, que congela la
     * unidad de cada entreno. Un entreno es un hecho aislado y se lee con la
     * unidad con la que se anotó; el peso corporal es una única serie continua,
     * y mezclar 78 kg con 172 lb en la misma línea no dibuja nada.
     */
    weight: numeric("weight", { precision: 5, scale: 2 }).notNull(),
    measuredOn: date("measured_on").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("body_weights_user_day_unique").on(table.userId, table.measuredOn),
    index("body_weights_user_day_idx").on(table.userId, table.measuredOn),
    check("body_weights_weight_range", sql`${table.weight} between 20 and 500`),
  ],
);

/**
 * Qué músculos trabaja cada ejercicio, para teñir el mapa corporal. Tabla
 * aparte y no dos columnas de array en `exercises` porque enriquecer esto es
 * añadir filas, no reescribir listas, y sumar volumen por músculo es un join
 * en vez de un unnest.
 *
 * `muscle` es una de las regiones de `src/lib/muscles.ts`. No es un enum de
 * Postgres: la lista va a crecer durante semanas y no quiero una migración
 * cada vez que añadamos una región.
 */
export const exerciseMuscles = pgTable(
  "exercise_muscles",
  {
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    muscle: varchar("muscle", { length: 40 }).notNull(),
    role: muscleRole("role").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.exerciseId, table.muscle] }),
    index("exercise_muscles_muscle_idx").on(table.muscle),
  ],
);

/**
 * Mover una sesión a otro día sin tocar la rutina semanal.
 *
 * Es una excepción con fecha, no un cambio al plan: `training_plans.weekday`
 * sigue siendo la verdad de tu semana, y esto es una nota al margen para una
 * semana concreta. Por eso no es una columna en `training_plans`, donde valdría
 * para todas.
 *
 * Caduca sola: nadie borra estas filas, simplemente dejan de consultarse cuando
 * su `to_date` queda atrás.
 */
export const planReschedules = pgTable(
  "plan_reschedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => trainingPlans.id, { onDelete: "cascade" }),
    /** El día que el plan tocaba y del que se va. */
    fromDate: date("from_date").notNull(),
    /** El día al que se mueve. */
    toDate: date("to_date").notNull(),
    ...timestamps,
  },
  (table) => [
    // Un plan solo se mueve una vez desde un día dado: moverlo otra vez
    // sustituye al anterior en vez de acumular.
    uniqueIndex("plan_reschedules_plan_from_unique").on(table.planId, table.fromDate),
    index("plan_reschedules_user_to_idx").on(table.userId, table.toDate),
    check("plan_reschedules_forward", sql`${table.toDate} <> ${table.fromDate}`),
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
export type BodyWeight = typeof bodyWeights.$inferSelect;
export type ExerciseMuscle = typeof exerciseMuscles.$inferSelect;
export type PlanReschedule = typeof planReschedules.$inferSelect;
