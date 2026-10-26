import type { TrainingBlock, BlockProgress, BlockProgressMap, Discipline } from "../training-blocks";
import type { ExerciseMetrics, SetMetrics } from "../training-metrics";
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
      durationSeconds?: number | null;
      loadType?: SetMetrics["loadType"];
      assistanceNote?: string | null;
      createdAt: number;
    }
  | { id: string; kind: "blockProgress"; workoutId: string; blockId: string; progress: BlockProgress; createdAt: number }
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
  | { id: string; kind: "discardWorkout"; workoutId: string; createdAt: number }

  | {
      id: string;
      kind: "startWorkout";
      workoutId: string;
      planId: string;
      weightUnit: "kg" | "lb";
      performedAt: string;
      discipline?: Discipline;
      blocks?: TrainingBlock[];
      exercises: Array<ExerciseMetrics & {
        workoutExerciseId: string;
        exerciseId: string;
        position: number;
        targetSets: number | null;
        targetRepsMin: number | null;
        targetRepsMax: number | null;
        notes: string | null;
        measurement?: ExerciseMetrics["measurement"];
        loadType?: ExerciseMetrics["loadType"];
        targetSeconds?: number | null;
      }>;
      createdAt: number;
    }
) & { userId: string };

export type SnapshotSet = SetMetrics & {
  id: string;
  position: number;
  reps: number;
  weight: number;
  rpe?: number | null;
};

export type SnapshotExercise = ExerciseMetrics & {
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
  previous: SetMetrics[];
};

export type WorkoutSnapshot = {
  discipline?: Discipline;
  blocks?: TrainingBlock[];
  blockProgress?: BlockProgressMap;
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
  localDiscardedAt?: number;
  serverCreated: boolean;
  locallyCreated?: boolean;
};
