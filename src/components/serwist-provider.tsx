"use client";

import { SerwistProvider as Provider } from "@serwist/next/react";

/**
 * Registra el service worker que guarda la carcasa de la app, para que abra
 * aunque el móvil no tenga cobertura. En desarrollo va desactivado: cachearía
 * versiones viejas mientras se edita.
 */
export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV === "development"}
      reloadOnOnline={false}
    >
      {children}
    </Provider>
  );
}
