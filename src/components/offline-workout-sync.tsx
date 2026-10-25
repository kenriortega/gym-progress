"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { refrescarSesion, sincronizar } from "@/lib/offline-queue";
import { subscribeOfflinePlans } from "@/lib/offline/plans";
import { readSyncView } from "@/lib/offline/sync-state";
import { requestBackgroundSync } from "@/lib/offline/background-sync";
import { subscribeWorkoutChange } from "@/lib/offline/events";

/** Reintentos con la app abierta, incluso sin soporte de Background Sync. */
export function OfflineWorkoutSync() {
  const pathname = usePathname();
  useEffect(() => {
    let alive = true;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const update = async () => {
      if (!alive || pathname === "/login" || !navigator.onLine || document.visibilityState === "hidden" || running) return;
      if (timer) { clearTimeout(timer); timer = undefined; }
      running = true;
      try {
        const result = await sincronizar();
        if (result.quedan === 0) { attempt = 0; await refrescarSesion(); }
        else if (result.retryable && alive) {
          const delays = [2000, 5000, 15_000, 30_000];
          timer = setTimeout(() => { timer = undefined; void update(); }, delays[Math.min(attempt++, delays.length - 1)]);
        }
      } catch { /* El estado visible conserva el error de almacenamiento o envío. */ }
      finally { running = false; }
    };
    const retry = () => {
      attempt = 0;
      void readSyncView().then((view) => {
        if (!alive) return;
        if (view.pending > 0) void requestBackgroundSync();
        void update();
      }).catch(() => {});
    };
    const changed = () => {
      if (running || timer) return;
      void readSyncView().then((view) => {
        if (!alive || running || timer || view.pending === 0 ||
            view.status?.state === "needs-auth" || view.status?.state === "conflict" ||
            (view.status?.state === "error" && !view.status.retryable)) return;
        void update();
      }).catch(() => {});
    };
    const unsubscribe = subscribeOfflinePlans(retry);
    const unsubscribeWorkouts = subscribeWorkoutChange(changed);
    retry();
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      unsubscribe();
      unsubscribeWorkouts();
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [pathname]);
  return null;
}
