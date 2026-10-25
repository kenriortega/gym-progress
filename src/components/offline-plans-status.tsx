"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflinePlans } from "@/components/offline-plans-provider";

export function OfflinePlansStatus({ userId, showLink = true }: { userId?: string; showLink?: boolean }) {
  const { catalog, loading, refreshing, offlineReady, error, refresh } = useOfflinePlans();
  const saved = catalog && (!userId || catalog.userId === userId) ? catalog : null;
  const count = saved?.data.plans.length ?? 0;
  return (
    <section aria-label="Disponibilidad de planes sin conexión" className="mt-6 border-b border-border pb-5">
      <p role="status" className="text-sm font-semibold">
        {loading ? "Comprobando planes guardados…"
          : saved ? count > 0
            ? offlineReady
              ? `${count} ${count === 1 ? "plan disponible" : "planes disponibles"} para consultar sin conexión`
              : `${count} ${count === 1 ? "plan guardado" : "planes guardados"} · preparando acceso sin conexión`
            : "No tienes planes activos para descargar"
          : refreshing ? "Descargando tus planes…" : "Todavía no hay una copia de tus planes en este dispositivo"}
      </p>
      {saved && <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Actualizados el {new Date(saved.savedAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}.
      </p>}
      {error && <p role="alert" className="mt-2 max-w-prose text-sm text-muted-foreground">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {showLink && <a href="/planes-guardados" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <DownloadIcon aria-hidden className="size-4" />Ver planes guardados
        </a>}
        <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={refreshing} onClick={() => void refresh()}>
          {refreshing ? "Actualizando…" : "Actualizar planes"}
        </Button>
      </div>
    </section>
  );
}
