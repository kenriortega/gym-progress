"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { refrescarSesion, sincronizar } from "@/lib/offline-queue";
import { subscribeWorkoutChange } from "@/lib/offline/events";
import { subscribeOfflinePlans } from "@/lib/offline/plans";
import { readSyncView, type SyncView } from "@/lib/offline/sync-state";

export function OfflineSyncStatus({ userId }: { userId?: string }) {
  const [checkedAt, setCheckedAt] = useState(0);
  const [view, setView] = useState<SyncView | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const reads = useRef(0);
  const cancelReads = useCallback(() => { ++reads.current; }, []);
  const load = useCallback(() => {
    const read = ++reads.current;
    return readSyncView().then((next) => {
      if (reads.current === read) { setView(next); setCheckedAt(Date.now()); setFailure(null); }
    }).catch(() => {
      if (reads.current === read) { setView(null); setFailure("No se puede comprobar el guardado local. Vuelve a intentarlo."); }
    });
  }, []);
  useEffect(() => {
    const unsubscribe = subscribeWorkoutChange(() => { void load(); });
    const unsubscribePlans = subscribeOfflinePlans(() => { void load(); });
    void load();
    return () => { cancelReads(); unsubscribe(); unsubscribePlans(); };
  }, [load, cancelReads]);
  useEffect(() => {
    if (view?.status?.state !== "syncing") return;
    const remaining = 30_000 - (Date.now() - view.status.updatedAt);
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => { void load(); }, remaining + 100);
    return () => window.clearTimeout(timer);
  }, [view, load]);
  const visible = view && (!userId || view.userId === userId || (view.userId === null && view.needsAuth)) ? view : null;
  if (!failure && !visible?.userId && !visible?.needsAuth) return null;
  const status = visible?.status;
  const pending = visible?.pending ?? 0;
  return <section aria-label="Estado de sincronización" className="mt-5 space-y-2 rounded-xl border border-border px-4 py-3">
    <p role="status" className="text-sm font-semibold">
      {failure ? "No se puede verificar el almacenamiento"
        : visible?.needsAuth ? "Inicia sesión para recuperar tus datos guardados"
        : pending > 0 && status?.state === "syncing" && checkedAt - status.updatedAt < 30_000 ? `Enviando ${pending} ${pending === 1 ? "cambio" : "cambios"}…`
        : pending > 0 ? `${pending} ${pending === 1 ? "cambio guardado" : "cambios guardados"} en este dispositivo, pendientes de enviar`
        : status?.lastSyncedAt ? "Cambios sincronizados" : "No hay cambios pendientes en este dispositivo"}
    </p>
    {!pending && status?.lastSyncedAt && <p className="text-xs text-muted-foreground">
      Último envío confirmado: {new Date(status.lastSyncedAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}.
    </p>}
    {pending > 0 && <p className="text-sm leading-6 text-muted-foreground">
      {status?.error ?? "Se reintentará al recuperar la conexión o volver a abrir la app."}
    </p>}
    {failure && <p role="alert" className="text-sm text-muted-foreground">{failure}</p>}
    {(visible?.needsAuth || (pending > 0 && status?.state === "needs-auth")) && <a href="/login" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Iniciar sesión para enviar</a>}
    {pending > 0 && status?.remoteWorkoutId && <a href={`/workout/${status.remoteWorkoutId}`} className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Revisar la sesión del servidor</a>}
    {(pending > 0 || failure) && <Button type="button" variant="outline" disabled={busy} className="min-h-11" onClick={async () => {
      setBusy(true);
      try {
        const result = await sincronizar();
        if (result.quedan === 0) await refrescarSesion();
      } catch { setFailure("No se pudo comprobar el envío. Los cambios guardados se conservan."); }
      finally { await load(); setBusy(false); }
    }}>{busy ? "Sincronizando…" : "Reintentar sincronización"}</Button>}
  </section>;
}
