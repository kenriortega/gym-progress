export type QueuedMutation = (
  | {
      id: string;
      kind: "addSet";
      workoutId: string;
      workoutExerciseId: string;
      setId: string;
      weight: number;
      reps: number;
      /** Esfuerzo percibido, de 1 a 10. Opcional. */
      rpe?: number | null;
      createdAt: number;
    }
  | {
      id: string;
      kind: "deleteSet";
      workoutId: string;
      setId: string;
      createdAt: number;
    }
  | {
      id: string;
      kind: "finishWorkout";
      workoutId: string;
      createdAt: number;
    }

  | {
      id: string;
      kind: "startWorkout";
      workoutId: string;
      planId: string;
      weightUnit: "kg" | "lb";
      performedAt: string;
      exercises: Array<{
        workoutExerciseId: string;
        exerciseId: string;
        position: number;
        targetSets: number | null;
        targetRepsMin: number | null;
        targetRepsMax: number | null;
        notes: string | null;
      }>;
      createdAt: number;
    }
) & { userId: string };

export type SnapshotSet = {
  id: string;
  position: number;
  reps: number;
  weight: number;
  rpe?: number | null;
};

export type SnapshotExercise = {
  workoutExerciseId: string;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  position: number;
  targetSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  completed: boolean;
  notes?: string | null;
  previousWeightUnit?: string;
  sets: SnapshotSet[];
  /** Series de la última sesión completada con este ejercicio. */
  previous: Array<{ reps: number; weight: number }>;
};

export type WorkoutSnapshot = {
  userId: string;
  trainingPlanId: string | null;
  workoutId: string;
  planName: string | null;
  weightUnit: string;
  performedAt: string;
  exercises: SnapshotExercise[];
  /** Momento en que se descargó, para avisar de datos viejos. */
  fetchedAt: number;
};

/** Se conserva hasta que el servidor confirme la finalización. */
export type LocalWorkout = WorkoutSnapshot & {
  localCompletedAt?: number;
  serverCreated: boolean;
  locallyCreated?: boolean;
};
