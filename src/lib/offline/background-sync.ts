export const WORKOUT_SYNC_TAG = "gym-progress:outbox";
type SyncRegistration = ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } };

/** Mejora opcional: el guardado y los reintentos de la página no dependen de esto. */
export async function requestBackgroundSync(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration() as SyncRegistration | undefined;
    if (!registration?.active || !registration.sync) return false;
    await registration.sync.register(WORKOUT_SYNC_TAG);
    return true;
  } catch { return false; }
}
