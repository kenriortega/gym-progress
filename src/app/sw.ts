/// <reference lib="webworker" />
/// <reference types="@serwist/next/typings" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
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
