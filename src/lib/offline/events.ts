const EVENT = "gym-progress:local-change";
const CHANNEL = "gym-progress:offline";

function channel(): BroadcastChannel | null {
  try { return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL); }
  catch { return null; }
}

/** Se puede llamar desde la página y desde el service worker. */
export function notifyWorkoutChange() {
  // Next sustituye `typeof window` por una constante en compilaciones cliente,
  // también al empaquetar este módulo en el worker. Consultar la propiedad real.
  const browserWindow = (globalThis as { window?: Window }).window;
  browserWindow?.dispatchEvent(new Event(EVENT));
  const bus = channel();
  try { bus?.postMessage("changed"); }
  catch { /* La escritura ya está confirmada, aunque falle el aviso. */ }
  finally { bus?.close(); }
}

export function subscribeWorkoutChange(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  const bus = channel();
  if (bus) bus.onmessage = callback;
  return () => { window.removeEventListener(EVENT, callback); bus?.close(); };
}
