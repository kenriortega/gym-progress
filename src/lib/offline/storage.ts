import type { LocalWorkout, QueuedMutation, WorkoutSnapshot } from "./types";
import type { SavedOfflinePlans } from "./plan-types";
import { abortTransaction, transaction } from "./database";
import { identity, type Identity } from "./plan-storage";

const STORES = ["entrenamientos", "mutaciones", "offline-meta", "planes", "cola", "sesion"];
type StoredMutation = QueuedMutation & { localSequence: number };
export type LocalData = {
  userId: string | null;
  generation: number;
  workout: LocalWorkout | null;
  workouts: LocalWorkout[];
  queue: StoredMutation[];
  revision: number;
  legacyPending: number;
};

function apply(workout: LocalWorkout, mutation: QueuedMutation): LocalWorkout {
  if (workout.workoutId !== mutation.workoutId || mutation.kind === "startWorkout") return workout;
  if (mutation.kind === "finishWorkout") return { ...workout, localCompletedAt: mutation.createdAt };
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => {
      if (mutation.kind === "deleteSet") return { ...exercise, sets: exercise.sets.filter((set) => set.id !== mutation.setId) };
      if (exercise.workoutExerciseId !== mutation.workoutExerciseId || exercise.sets.some((set) => set.id === mutation.setId)) return exercise;
      return { ...exercise, sets: [...exercise.sets, {
        id: mutation.setId, position: Math.max(-1, ...exercise.sets.map((set) => set.position)) + 1,
        reps: mutation.reps, weight: mutation.weight, rpe: mutation.rpe,
      }] };
    }),
  };
}

/** Todas las lecturas de una vista comparten identidad y transacción. */
function read(tx: IDBTransaction, done: (data: LocalData) => void) {
  identity(tx, (account) => {
    const queue = account.userId ? tx.objectStore("mutaciones").index("userId").getAll(account.userId) : null;
    const workouts = account.userId ? tx.objectStore("entrenamientos").index("userId").getAll(account.userId) : null;
    const revision = tx.objectStore("offline-meta").get(`workout-revision:${account.userId}`);
    const legacy = tx.objectStore("cola").count();
    const legacyWorkout = tx.objectStore("sesion").get("activa");
    let remaining = 3 + (queue ? 2 : 0);
    const ready = () => {
      if (--remaining !== 0) return;
      try {
        const operations = (queue?.result ?? []) as StoredMutation[];
        operations.sort((a, b) => a.localSequence - b.localSequence);
        const sessions = ((workouts?.result ?? []) as LocalWorkout[])
          .map((workout) => operations.reduce(apply, workout))
          .sort((a, b) => Number(!!b.locallyCreated) - Number(!!a.locallyCreated) || Date.parse(b.performedAt) - Date.parse(a.performedAt));
        done({
          userId: account.userId, generation: account.generation, queue: operations,
          workouts: sessions, workout: sessions.find((workout) => !workout.localCompletedAt) ?? sessions[0] ?? null,
          revision: revision.result ?? 0, legacyPending: legacy.result + Number(!!legacyWorkout.result),
        });
      } catch (error) { abortTransaction(tx, error); }
    };
    if (queue) queue.onsuccess = ready;
    if (workouts) workouts.onsuccess = ready;
    revision.onsuccess = ready;
    legacy.onsuccess = ready;
    legacyWorkout.onsuccess = ready;
  });
}

function bump(tx: IDBTransaction, userId: string, revision: number) {
  tx.objectStore("offline-meta").put(revision + 1, `workout-revision:${userId}`);
}

export function leerEstado(): Promise<LocalData> {
  return transaction(STORES, "readonly", (tx, result) => read(tx, result));
}

export function iniciarSesionLocal(userId: string, planId: string): Promise<LocalWorkout> {
  return transaction(STORES, "readwrite", (tx, result) => read(tx, (data) => {
    if (data.userId !== userId) throw new Error("La cuenta ha cambiado. Vuelve a abrir la pantalla antes de empezar.");
    const active = data.workouts.find((workout) => !workout.localCompletedAt);
    if (active) {
      if (active.trainingPlanId === planId) { result(active); return; }
      throw new Error("Ya hay un entrenamiento abierto en este dispositivo. Continúalo o finalízalo antes de empezar otro.");
    }
    const request = tx.objectStore("planes").get(userId);
    request.onsuccess = () => {
      try {
        const catalog = request.result as SavedOfflinePlans | undefined;
        const plan = catalog?.data.plans.find((item) => item.id === planId);
        if (!catalog || !plan || plan.exercises.length === 0) throw new Error("Este plan no está disponible para entrenar. Actualiza tus planes con conexión.");
        const now = Date.now();
        const workout: LocalWorkout = {
          userId, workoutId: crypto.randomUUID(), trainingPlanId: plan.id, planName: plan.name,
          weightUnit: catalog.data.weightUnit, performedAt: new Date(now).toISOString(), fetchedAt: now,
          serverCreated: false, locallyCreated: true,
          exercises: plan.exercises.map((exercise, position) => {
            const localPrevious = data.workouts.filter((item) => item.localCompletedAt &&
              item.exercises.some((candidate) => candidate.exerciseId === exercise.exerciseId && candidate.sets.length > 0))
              .sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt))[0];
            const previous = localPrevious && (!exercise.previous || Date.parse(localPrevious.performedAt) >= Date.parse(exercise.previous.performedAt))
              ? { sets: localPrevious.exercises.find((item) => item.exerciseId === exercise.exerciseId)!.sets, weightUnit: localPrevious.weightUnit }
              : exercise.previous;
            return {
              workoutExerciseId: crypto.randomUUID(), exerciseId: exercise.exerciseId,
              name: exercise.name, muscleGroup: exercise.muscleGroup, position,
              targetSets: exercise.targetSets, targetRepsMin: exercise.targetRepsMin,
              targetRepsMax: exercise.targetRepsMax, notes: exercise.notes, completed: false, sets: [],
              previous: previous?.sets ?? [], previousWeightUnit: previous?.weightUnit,
            };
          }),
        };
        const mutation: StoredMutation = {
          id: crypto.randomUUID(), userId, kind: "startWorkout", workoutId: workout.workoutId,
          planId: plan.id, weightUnit: catalog.data.weightUnit, performedAt: workout.performedAt,
          createdAt: now, localSequence: data.revision + 1,
          exercises: workout.exercises.map((exercise) => ({
            workoutExerciseId: exercise.workoutExerciseId, exerciseId: exercise.exerciseId,
            position: exercise.position, targetSets: exercise.targetSets,
            targetRepsMin: exercise.targetRepsMin, targetRepsMax: exercise.targetRepsMax, notes: exercise.notes ?? null,
          })),
        };
        tx.objectStore("entrenamientos").put(workout);
        tx.objectStore("mutaciones").put(mutation);
        bump(tx, userId, data.revision);
        result(workout);
      } catch (error) {
        // Las excepciones de callbacks IDB no atraviesan el Promise exterior.
        abortTransaction(tx, error);
      }
    };
  }));
}

export function guardarMutacion(mutation: QueuedMutation): Promise<void> {
  return transaction(STORES, "readwrite", (tx, result) => read(tx, (data) => {
    if (data.userId !== mutation.userId) throw new Error("La cuenta ha cambiado. Vuelve a abrir el entrenamiento.");
    if (data.queue.some((item) => item.id === mutation.id)) { result(); return; }
    const workout = data.workouts.find((item) => item.workoutId === mutation.workoutId);
    if (!workout || workout.localCompletedAt || mutation.kind === "startWorkout") throw new Error("Este entrenamiento ya no acepta cambios.");
    if (mutation.kind === "addSet" && !workout.exercises.some((exercise) => exercise.workoutExerciseId === mutation.workoutExerciseId)) throw new Error("El ejercicio no pertenece a la sesión.");
    tx.objectStore("entrenamientos").put(apply(workout, mutation));
    tx.objectStore("mutaciones").put({ ...mutation, localSequence: data.revision + 1 });
    bump(tx, mutation.userId, data.revision);
    result();
  }));
}

/** Confirmar opera sobre el propietario de la operación, aunque se cierre sesión. */
export function confirmarMutacion(mutation: QueuedMutation): Promise<void> {
  return transaction(STORES, "readwrite", (tx, result) => {
    const request = tx.objectStore("entrenamientos").get([mutation.userId, mutation.workoutId]);
    request.onsuccess = () => {
      const workout = request.result as LocalWorkout | undefined;
      if (mutation.kind === "finishWorkout") tx.objectStore("entrenamientos").delete([mutation.userId, mutation.workoutId]);
      else if (mutation.kind === "startWorkout" && workout) tx.objectStore("entrenamientos").put({ ...workout, serverCreated: true });
      tx.objectStore("mutaciones").delete([mutation.userId, mutation.id]);
      const revision = tx.objectStore("offline-meta").get(`workout-revision:${mutation.userId}`);
      revision.onsuccess = () => { bump(tx, mutation.userId, revision.result ?? 0); result(); };
    };
  });
}

export function aceptarSnapshot(workout: WorkoutSnapshot | null, revision: number, account: Pick<Identity, "userId" | "generation">): Promise<boolean> {
  return transaction(STORES, "readwrite", (tx, result) => read(tx, (data) => {
    if (!account.userId || data.userId !== account.userId || data.generation !== account.generation ||
        (workout && workout.userId !== data.userId) || data.queue.length > 0 || data.revision !== revision) { result(false); return; }
    for (const local of data.workouts) {
      if (local.serverCreated && !local.localCompletedAt) tx.objectStore("entrenamientos").delete([local.userId, local.workoutId]);
    }
    if (workout) tx.objectStore("entrenamientos").put({ ...workout, serverCreated: true });
    bump(tx, account.userId, data.revision);
    result(true);
  }));
}

export function legacyWorkoutIds(): Promise<string[]> {
  return transaction(["cola", "sesion"], "readonly", (tx, result) => {
    const queue = tx.objectStore("cola").getAll();
    const workout = tx.objectStore("sesion").get("activa");
    let remaining = 2;
    const ready = () => {
      if (--remaining === 0) result([...new Set([
        ...(queue.result as Array<{ workoutId: string }>).map((item) => item.workoutId),
        ...(workout.result ? [workout.result.workoutId] : []),
      ])]);
    };
    queue.onsuccess = ready;
    workout.onsuccess = ready;
  });
}

/** Solo el servidor puede asignar las filas antiguas sin propietario. */
export function migrarLegacy(userId: string, ids: string[], generation: number): Promise<void> {
  return transaction(STORES, "readwrite", (tx, result) => read(tx, (data) => {
    if (data.userId !== userId || data.generation !== generation) { result(); return; }
    const queue = tx.objectStore("cola").getAll();
    const workout = tx.objectStore("sesion").get("activa");
    let remaining = 2;
    const ready = () => {
      if (--remaining !== 0) return;
      try {
        const allowed = new Set(ids);
        const operations = (queue.result as Array<QueuedMutation & { localSequence?: number }>)
          .filter((item) => allowed.has(item.workoutId)).sort((a, b) => (a.localSequence ?? a.createdAt) - (b.localSequence ?? b.createdAt));
        const start = Math.min(0, ...data.queue.map((item) => item.localSequence)) - operations.length;
        operations.forEach((item, index) => {
          tx.objectStore("mutaciones").put({ ...item, userId, localSequence: start + index });
          tx.objectStore("cola").delete(item.id);
        });
        for (const existing of data.workouts) {
          tx.objectStore("entrenamientos").put(operations.reduce(apply, existing));
        }
        if (workout.result && allowed.has(workout.result.workoutId)) {
          const legacy = workout.result as LocalWorkout;
          const existing = data.workouts.find((item) => item.workoutId === legacy.workoutId);
          const imported = operations.reduce(apply, existing ?? { ...legacy, userId, trainingPlanId: legacy.trainingPlanId ?? null, serverCreated: true });
          tx.objectStore("entrenamientos").put(imported);
          tx.objectStore("sesion").delete("activa");
        }
        bump(tx, userId, data.revision);
        result();
      } catch { tx.abort(); }
    };
    queue.onsuccess = ready;
    workout.onsuccess = ready;
  }));
}
