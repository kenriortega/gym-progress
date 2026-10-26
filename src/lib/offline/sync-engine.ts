import { confirmarMutacion, leerEstado, legacyWorkoutIds, migrarLegacy, mutacionPendiente } from "./storage";
import { notifyWorkoutChange } from "./events";
import { countPendingForUser, writeSyncState } from "./sync-state";

export type SyncResult = { enviadas: number; quedan: number; error?: string; remoteWorkoutId?: string; retryable?: boolean };

async function recuperarLegacy() {
  const before = await leerEstado();
  if (!before.userId || !before.legacyPending) return;
  const ids = await legacyWorkoutIds();
  for (let index = 0; index < ids.length; index += 200) {
    const response = await fetch("/api/offline/workout-ownership", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workoutIds: ids.slice(index, index + 200) }),
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok || response.redirected) throw Object.assign(new Error(response.status === 401 || response.status === 403
      ? "Conéctate con la cuenta original para recuperar los cambios anteriores."
      : "No se pudieron recuperar los cambios anteriores. Siguen guardados y puedes reintentar."), { status: response.status });
    const data = await response.json() as { userId: string; workoutIds: string[] };
    if (data.userId !== before.userId || !Array.isArray(data.workoutIds) ||
        !data.workoutIds.every((id) => ids.slice(index, index + 200).includes(id))) throw Object.assign(new Error("La cuenta ha cambiado durante la recuperación."), { status: 409 });
    await migrarLegacy(before.userId, data.workoutIds, before.generation);
    notifyWorkoutChange();
  }
}

async function enviarCola(): Promise<SyncResult> {
  let enviadas = 0;
  let error: string | undefined;
  let remoteWorkoutId: string | undefined;
  let retryable = false;
  let state: "needs-auth" | "conflict" | "error" = "error";
  const initial = await leerEstado();
  if (!initial.userId) return { enviadas, quedan: 0 };
  if (!navigator.onLine) return { enviadas, quedan: initial.queue.length, retryable: initial.queue.length > 0 };
  try { await recuperarLegacy(); } catch (cause) {
    const status = (cause as { status?: number })?.status;
    const error = status === undefined ? "No hay conexión con el servidor. Los cambios siguen guardados." : cause instanceof Error ? cause.message : "No se pudo recuperar la cola anterior.";
    await writeSyncState(initial.userId, { state: status === 401 || status === 403 ? "needs-auth" : "error", error, retryable: status === undefined || status >= 500 || status === 429 });
    notifyWorkoutChange();
    return { enviadas, quedan: await countPendingForUser(initial.userId), error, retryable: status === undefined || status >= 500 || status === 429 };
  }
  const before = await leerEstado();
  if (!before.userId || before.userId !== initial.userId || before.generation !== initial.generation) return { enviadas, quedan: before.queue.length };
  if (before.queue.length === 0) return { enviadas, quedan: 0 };
  await writeSyncState(before.userId, { state: "syncing" });
  notifyWorkoutChange();
  for (const mutacion of before.queue) {
    const current = await leerEstado();
    if (current.userId !== before.userId || current.generation !== before.generation) break;
    if (!current.queue.some((item) => item.id === mutacion.id)) continue;
    try {
      const respuesta = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutacion),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!(await mutacionPendiente(mutacion))) continue;
      if (respuesta.ok && !respuesta.redirected) {
        const confirmacion = await respuesta.json() as { ok?: boolean };
        if (confirmacion?.ok === true) {
          await confirmarMutacion(mutacion);
          enviadas += 1;
          await writeSyncState(before.userId, { state: "syncing" });
          notifyWorkoutChange();
          continue;
        }
      }
      if (!respuesta.ok) {
        retryable = respuesta.status >= 500 || respuesta.status === 429;
        state = respuesta.status === 401 || respuesta.status === 403 ? "needs-auth" : respuesta.status === 409 ? "conflict" : "error";
        if (respuesta.status === 409) {
          try {
            const conflict = await respuesta.json() as { code?: string; workoutId?: string };
            if (conflict.code === "ACTIVE_WORKOUT" && typeof conflict.workoutId === "string" && /^[0-9a-f-]{36}$/i.test(conflict.workoutId)) remoteWorkoutId = conflict.workoutId;
          } catch { /* Se conserva igualmente como conflicto. */ }
        }
        error = respuesta.status === 401 || respuesta.status === 403
          ? "Vuelve a iniciar sesión para enviar los cambios. Siguen guardados en este dispositivo."
          : respuesta.status === 429
            ? "El servidor está ocupado. Se reintentará el envío automáticamente."
          : respuesta.status === 409
            ? "Hay un conflicto con el entrenamiento del servidor. Tus cambios siguen guardados."
            : respuesta.status >= 400 && respuesta.status < 500
              ? "El servidor no pudo aceptar un cambio. Se conserva en el dispositivo para revisarlo."
              : "No se pudo sincronizar. Los cambios siguen guardados y se reintentará.";
        break;
      }
      error = "El servidor no confirmó el cambio. Se conserva en este dispositivo.";
      break;
    } catch {
      if (!(await mutacionPendiente(mutacion))) continue;
      retryable = true;
      error = "Sin conexión con el servidor. Los cambios siguen guardados en este dispositivo.";
      break;
    }
  }
  const quedan = await countPendingForUser(before.userId);
  const current = await leerEstado();
  const sameAccount = current.userId === before.userId && current.generation === before.generation;
  await writeSyncState(before.userId, error ? { state, error, remoteWorkoutId, retryable } :
    { state: quedan === 0 ? "synced" : "pending" });
  notifyWorkoutChange();
  return { enviadas, quedan, error, remoteWorkoutId, retryable: sameAccount && (retryable || (!error && quedan > 0)) };
}

/** Un solo emisor por origen, incluso con varias pestañas abiertas. */
export async function sincronizar(): Promise<SyncResult> {
  if (!navigator.locks) {
    const current = await leerEstado();
    const quedan = current.queue.length;
    if (current.userId && quedan > 0) {
      await writeSyncState(current.userId, { state: "error", error: "Este navegador no permite sincronizar con seguridad. Actualiza el navegador para enviar los cambios." });
      notifyWorkoutChange();
    }
    return {
      enviadas: 0,
      quedan,
      ...(quedan > 0 ? { error: "Este navegador no permite sincronizar con seguridad. Los cambios siguen guardados; actualiza el navegador." } : {}),
    };
  }
  return navigator.locks.request("gym-progress:sync", enviarCola);
}
