import { beginPlanDownload, rejectPlanSession, saveOfflinePlans, setPlanAccount } from "./plan-storage";
import { isOfflinePlans } from "./plan-types";

const EVENT = "gym-progress:plans-change";
const CHANNEL = "gym-progress:plans";

function channel(): BroadcastChannel | null {
  try { return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL); }
  catch { return null; }
}

function notify() {
  window.dispatchEvent(new Event(EVENT));
  const bus = channel();
  try { bus?.postMessage("changed"); }
  catch { /* La copia ya está guardada, aunque falle el aviso. */ }
  finally { bus?.close(); }
}

export function subscribeOfflinePlans(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  const bus = channel();
  if (bus) bus.onmessage = callback;
  return () => { window.removeEventListener(EVENT, callback); bus?.close(); };
}

export async function identifyPlanAccount(userId: string | null): Promise<boolean> {
  const changed = await setPlanAccount(userId);
  if (changed) notify();
  return changed;
}

export async function downloadOfflinePlans(): Promise<void> {
  const token = await beginPlanDownload();
  let response: Response;
  try {
    response = await fetch("/api/offline/plans", {
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("No hay conexión con el servidor. La copia guardada se conserva; puedes reintentarlo al recuperar la conexión.");
  }
  if (response.status === 401) {
    if (!await rejectPlanSession(token)) return;
    notify();
    throw new Error("Inicia sesión para actualizar los planes de esta cuenta.");
  }
  if (!response.ok || response.redirected) throw new Error("No se pudieron descargar los planes. Puedes reintentarlo cuando tengas conexión.");
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new Error("La descarga de planes está incompleta. La copia anterior se conserva; vuelve a intentarlo."); }
  if (!isOfflinePlans(data)) throw new Error("La descarga de planes está incompleta. La copia anterior se conserva; vuelve a intentarlo.");
  if (await saveOfflinePlans(data, token)) notify();
}
