import posthog from "posthog-js";
import type { CaptureResult } from "posthog-js";

import { redactProperties } from "@/lib/analytics";

/**
 * Analítica de la app. Next ejecuta este archivo en el navegador antes de
 * hidratar, así que no hace falta ningún componente ni provider en el layout.
 *
 * Sin token no se arranca nada: así el `npm run build` y quien clone el repo
 * sin configurar PostHog siguen funcionando, solo que sin analítica.
 */
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (token && host) {
  posthog.init(token, {
    api_host: host,
    defaults: "2026-05-30",

    // Lo que sigue son los valores que trae `defaults`, puestos a mano para
    // que una subida de versión no cambie en silencio lo que recogemos.
    //
    // Las navegaciones del App Router no recargan la página, así que los
    // pageviews se cuentan al cambiar el historial.
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: true,

    // La grabación de sesión queda fuera a propósito: esto es una app
    // personal de entrenamiento y no hace falta ver la pantalla de nadie.
    disable_session_recording: true,

    // No usamos encuestas, y si no se desactivan PostHog se baja su script
    // desde su CDN en cada carga para nada.
    disable_surveys: true,

    before_send: (event: CaptureResult): CaptureResult => {
      redactProperties(event.properties);
      if (event.$set) redactProperties(event.$set);
      if (event.$set_once) redactProperties(event.$set_once);
      return event;
    },
  });
}
