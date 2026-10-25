import { aceptarSnapshot, guardarMutacion, iniciarSesionLocal, leerEstado } from "./offline/storage";
import type { LocalWorkout, QueuedMutation, WorkoutSnapshot } from "./offline/types";
import { notifyWorkoutChange } from "./offline/events";
import { requestBackgroundSync } from "./offline/background-sync";

export { sincronizar } from "./offline/sync-engine";
export type { SyncResult } from "./offline/sync-engine";
export type { QueuedMutation } from "./offline/types";
export { subscribeWorkoutChange as suscribirCambios } from "./offline/events";

export async function encolar(mutacion: QueuedMutation): Promise<void> {
  await guardarMutacion(mutacion);
  notifyWorkoutChange();
  void requestBackgroundSync();
}

export async function pendientes(): Promise<QueuedMutation[]> {
  return (await leerEstado()).queue;
}

export async function contar(): Promise<number> { return (await pendientes()).length; }
export async function leerSesion(): Promise<LocalWorkout | null> { return (await leerEstado()).workout; }

export async function iniciarEntreno(userId: string, planId: string): Promise<LocalWorkout> {
  const workout = await iniciarSesionLocal(userId, planId);
  notifyWorkoutChange();
  void requestBackgroundSync();
  return workout;
}

/** La petición puede fallar; la copia local nunca se elimina por ese motivo. */
export async function refrescarSesion(): Promise<void> {
  const before = await leerEstado();
  if (!before.userId || before.queue.length > 0 || !navigator.onLine) return;
  const respuesta = await fetch("/api/snapshot", {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!respuesta.ok) throw new Error("No se pudo actualizar la sesión.");
  const datos = await respuesta.json() as { userId: string; workout: WorkoutSnapshot | null };
  if (!datos || datos.userId !== before.userId || !("workout" in datos) ||
      (datos.workout !== null && (!datos.workout?.workoutId || !Array.isArray(datos.workout.exercises)))) {
    throw new Error("El servidor devolvió una sesión inválida.");
  }
  if (await aceptarSnapshot(datos.workout, before.revision, before)) notifyWorkoutChange();
}
