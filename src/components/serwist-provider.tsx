"use client";

import { SerwistProvider as Provider } from "@serwist/next/react";
import { useEffect } from "react";
import { requestBackgroundSync } from "@/lib/offline/background-sync";
import { leerEstado } from "@/lib/offline/storage";

/**
 * Registra el service worker que guarda la carcasa de la app, para que abra
 * aunque el móvil no tenga cobertura. En desarrollo va desactivado: cachearía
 * versiones viejas mientras se edita.
 */
export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    // El entry de Next puede haber construido window.serwist sin registrarlo.
    // Registrar aquí evita depender de esa construcción o duplicar parches de history.
    void window.serwist?.register().then(async (registration) => {
      if (!registration) return;
      await navigator.serviceWorker.ready;
      if ((await leerEstado()).queue.length > 0) await requestBackgroundSync();
    }).catch(() => {
      // El estado de disponibilidad no promete acceso offline sin una caché lista.
    });
  }, []);
  return (
    <Provider
      swUrl="/sw.js"
      register={false}
      disable={process.env.NODE_ENV === "development"}
      reloadOnOnline={false}
      cacheOnNavigation={false}
    >
      {children}
    </Provider>
  );
}
