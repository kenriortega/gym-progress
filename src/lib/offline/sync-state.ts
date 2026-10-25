import { transaction } from "./database";
import { identity } from "./plan-storage";

export type SyncState = {
  userId: string;
  state: "syncing" | "synced" | "pending" | "needs-auth" | "conflict" | "error";
  updatedAt: number;
  lastSyncedAt?: number;
  error?: string;
  retryable?: boolean;
  remoteWorkoutId?: string;
};
export type SyncView = { userId: string | null; pending: number; status: SyncState | null; needsAuth?: boolean };

export function readSyncView(): Promise<SyncView> {
  return transaction(["mutaciones", "offline-meta"], "readonly", (tx, result) => identity(tx, (account) => {
    if (!account.userId) { result({ userId: null, pending: 0, status: null, needsAuth: account.authRequired }); return; }
    const status = tx.objectStore("offline-meta").get(`sync:${account.userId}`);
    const count = tx.objectStore("mutaciones").index("userId").count(account.userId);
    let remaining = 2;
    const ready = () => { if (--remaining === 0) result({ userId: account.userId, pending: count.result, status: status.result ?? null }); };
    status.onsuccess = ready;
    count.onsuccess = ready;
  }));
}

export function countPendingForUser(userId: string): Promise<number> {
  return transaction(["mutaciones"], "readonly", (tx, result) => {
    const count = tx.objectStore("mutaciones").index("userId").count(userId);
    count.onsuccess = () => result(count.result);
  });
}

export function writeSyncState(userId: string, next: Omit<SyncState, "userId" | "updatedAt" | "lastSyncedAt">): Promise<void> {
  return transaction(["offline-meta"], "readwrite", (tx, result) => {
    const store = tx.objectStore("offline-meta");
    const previous = store.get(`sync:${userId}`);
    previous.onsuccess = () => {
      store.put({ ...next, userId, updatedAt: Date.now(),
        lastSyncedAt: next.state === "synced" ? Date.now() : previous.result?.lastSyncedAt,
      } satisfies SyncState, `sync:${userId}`);
      result();
    };
  });
}
