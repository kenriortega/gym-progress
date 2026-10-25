"use client";

import { useCallback, useEffect, useState } from "react";
import { useOfflinePlans } from "@/components/offline-plans-provider";
import { OfflinePlansStatus } from "@/components/offline-plans-status";
import { OfflineSyncStatus } from "@/components/offline-sync-status";
import { DocumentLink } from "@/components/document-link";
import { leerEstado } from "@/lib/offline/storage";
import { subscribeWorkoutChange } from "@/lib/offline/events";
import { subscribeOfflinePlans } from "@/lib/offline/plans";

export function OfflineHome() {
  const { catalog } = useOfflinePlans();
  const [hasActive, setHasActive] = useState(false);
  const load = useCallback(() => leerEstado()
    .then((data) => setHasActive(data.workouts.some((workout) => !workout.localCompletedAt)))
    .catch(() => setHasActive(false)), []);
  useEffect(() => {
    const unsubscribe = subscribeWorkoutChange(() => { void load(); });
    const unsubscribePlans = subscribeOfflinePlans(() => { void load(); });
    void load();
    return () => { unsubscribe(); unsubscribePlans(); };
  }, [load]);
  return <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-12 pt-16 md:max-w-3xl">
    <h1 className="text-3xl font-black tracking-tight">Tu gimnasio sin conexión</h1>
    <p className="mt-4 max-w-prose text-sm leading-6 text-muted-foreground">
      Esta pantalla necesita conexión, pero puedes continuar tu entrenamiento o empezar uno desde los planes guardados. Los cambios se guardan en este dispositivo.
    </p>
    <nav aria-label="Entrenar sin conexión" className="mt-6 grid gap-3">
      {hasActive && <DocumentLink href="/entreno" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Continuar entrenamiento</DocumentLink>}
      <DocumentLink href="/planes-guardados" className={`inline-flex min-h-12 items-center justify-center rounded-lg border px-4 text-sm font-semibold ${hasActive ? "border-border" : "border-transparent bg-primary text-primary-foreground"}`}>Elegir un plan guardado</DocumentLink>
    </nav>
    <OfflineSyncStatus />
    <OfflinePlansStatus showLink={false} />
    {!catalog && <p className="mt-6 max-w-prose text-sm leading-6 text-muted-foreground">Para la primera descarga, abre la app con conexión e inicia sesión. Las copias de otras cuentas permanecen separadas.</p>}
  </main>;
}
