import { transaction } from "./database";
import type { OfflinePlans, SavedOfflinePlans } from "./plan-types";
import { isOfflinePlans } from "./plan-types";

const STORES = ["planes", "offline-meta"];
export type Identity = { userId: string | null; generation: number; request: number; authRequired?: boolean };
export type DownloadToken = Identity;
const initial: Identity = { userId: null, generation: 0, request: 0 };

export function identity(tx: IDBTransaction, callback: (state: Identity) => void) {
  const request = tx.objectStore("offline-meta").get("identity");
  request.onsuccess = () => {
    try { callback(request.result ?? initial); }
    catch { tx.abort(); }
  };
}

/** Cambiar o cerrar cuenta no elimina sus planes ni la cola de entrenamientos. */
export function setPlanAccount(userId: string | null): Promise<boolean> {
  return transaction(STORES, "readwrite", (tx, result) => identity(tx, (state) => {
    if (state.userId === userId && userId !== null) { result(false); return; }
    tx.objectStore("offline-meta").put({ ...state, userId, authRequired: false, generation: state.generation + 1 }, "identity");
    result(true);
  }));
}

export function beginPlanDownload(): Promise<DownloadToken> {
  return transaction(STORES, "readwrite", (tx, result) => identity(tx, (state) => {
    const token = { ...state, request: state.request + 1 };
    tx.objectStore("offline-meta").put(token, "identity");
    result(token);
  }));
}

const current = (state: Identity, token: DownloadToken) =>
  state.generation === token.generation && state.request === token.request;

/** Un 401 antiguo tampoco puede cerrar una cuenta que se acaba de abrir. */
export function rejectPlanSession(token: DownloadToken): Promise<boolean> {
  return transaction(STORES, "readwrite", (tx, result) => identity(tx, (state) => {
    if (!current(state, token)) { result(false); return; }
    tx.objectStore("offline-meta").put({ ...state, userId: null, authRequired: true, generation: state.generation + 1 }, "identity");
    result(true);
  }));
}

export function saveOfflinePlans(data: OfflinePlans, token: DownloadToken): Promise<boolean> {
  return transaction(STORES, "readwrite", (tx, result) => identity(tx, (state) => {
    if (!current(state, token)) { result(false); return; }
    const saved: SavedOfflinePlans = { userId: data.userId, data, savedAt: Date.now() };
    tx.objectStore("planes").put(saved);
    tx.objectStore("offline-meta").put({
      ...state,
      userId: data.userId,
      authRequired: false,
      generation: state.generation + (state.userId !== data.userId ? 1 : 0),
    }, "identity");
    result(true);
  }));
}

export function readOfflinePlans(expectedUserId?: string): Promise<SavedOfflinePlans | null> {
  return transaction(STORES, "readonly", (tx, result) => identity(tx, (state) => {
    if (!state.userId || (expectedUserId && expectedUserId !== state.userId)) { result(null); return; }
    const request = tx.objectStore("planes").get(state.userId);
    request.onsuccess = () => {
      const saved = request.result as SavedOfflinePlans | undefined;
      if (!saved) { result(null); return; }
      if (saved.userId !== state.userId || !isOfflinePlans(saved.data) ||
          saved.data.userId !== state.userId || !Number.isFinite(saved.savedAt)) {
        tx.abort();
        return;
      }
      result(saved);
    };
  }));
}
