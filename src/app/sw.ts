/// <reference lib="webworker" />
/// <reference types="@serwist/next/typings" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import { sincronizar } from "@/lib/offline/sync-engine";
import { WORKOUT_SYNC_TAG } from "@/lib/offline/background-sync";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  // Se añaden al manifest automático para conservar también iconos y assets
  // públicos. additionalPrecacheEntries de Next sustituye su lista de public/.
  precacheEntries: [
    ...(self.__SW_MANIFEST ?? []),
    ...["/abrir", "/planes-guardados", "/entreno", "/offline"].map((url) => ({
      url,
      revision: process.env.APP_BUILD_TIME,
    })),
  ],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    // Las páginas privadas y sus datos RSC nunca se recuperan de otra cuenta
    // desde caché. Si falla una navegación de documento, se abre el inicio offline.
    {
      matcher: ({ sameOrigin, request }) => sameOrigin &&
        (request.mode === "navigate" || request.headers.get("RSC") === "1"),
      handler: new NetworkOnly({ networkTimeoutSeconds: 4, plugins: [{
        fetchDidSucceed: async ({ response }) => {
          if (response.status >= 500) throw new Error("La pantalla no está disponible");
          return response;
        },
      }] }),
    },
    {
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    // La analítica pasa por /ingest, que al ser del mismo origen el service
    // worker ve como tráfico propio: sin esto, `defaultCache` guardaría en
    // caché el JS del SDK y la configuración remota de PostHog durante 24h.
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && url.pathname.startsWith("/ingest"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  // Si una navegación falla por red, se sirve esta página desde la caché.
  // Es lo que permite abrir la app ya sin cobertura.
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Retira únicamente respuestas HTTP privadas de versiones anteriores. Las
// sesiones, planes y operaciones de IndexedDB permanecen intactos.
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.includes("precache")) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const url = new URL(request.url);
        if (url.origin === self.location.origin && (url.pathname === "/" ||
            url.pathname.startsWith("/api/") || /^\/(plans|workout|history|progress|exercises|ejercicios|ajustes|ayuda)(\/|$)/.test(url.pathname))) {
          await cache.delete(request);
        }
      }
    }
  })());
});

self.addEventListener("sync", (event) => {
  const sync = event as ExtendableEvent & { tag: string };
  if (sync.tag !== WORKOUT_SYNC_TAG) return;
  sync.waitUntil((async () => {
    const result = await sincronizar();
    if (result.quedan > 0 && result.retryable) {
      // Rechazar permite que el navegador reintente un fallo temporal. Los
      // problemas de autenticación/validación/conflicto esperan al usuario.
      throw new Error("Quedan cambios pendientes de enviar");
    }
  })());
});
