"use client";

import { WifiOffIcon } from "lucide-react";
import { useOffline } from "next/offline";

/**
 * Aviso fijo mientras no hay conexión. Con experimental.useOffline activo,
 * Next mantiene pendientes las navegaciones y las server actions y las
 * reintenta al volver la señal, así que el mensaje explica esa espera en vez
 * de pedirle al usuario que reintente.
 */
export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-foreground px-4 py-2 text-xs font-semibold text-background"
    >
      <WifiOffIcon className="size-3.5" />
      Sin conexión · se guardará al volver la señal
    </div>
  );
}
