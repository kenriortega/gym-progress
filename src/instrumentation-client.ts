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
    // `host` es la ruta del proxy inverso (/ingest), así que el SDK no puede
    // deducir a qué dominio de PostHog enlazar: se lo decimos a mano.
    api_host: host,
    ui_host: "https://us.posthog.com",
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

    // Ruido para una app de un solo usuario: las métricas de rendimiento
    // mandaban varios $web_vitals por pantalla (y se bajaban su script
    // aparte), y los mapas de calor y los clics muertos no
    // dicen nada cuando solo hay una persona usando la app.
    // `capture_performance` además manda sobre lo que esté activado en los
    // ajustes del proyecto.
    capture_performance: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,

    // Errores no controlados y promesas rechazadas. Se activa aquí y no en
    // los ajustes del proyecto, para que no cambie sin pasar por el repo.
    // `capture_console_errors` se queda en false, su valor por defecto: las
    // pantallas de error ya hacen console.error y llegaría todo dos veces.
    capture_exceptions: true,

    before_send: (event: CaptureResult): CaptureResult => {
      redactProperties(event.properties);
      if (event.$set) redactProperties(event.$set);
      if (event.$set_once) redactProperties(event.$set_once);
      return event;
    },
  });
}
