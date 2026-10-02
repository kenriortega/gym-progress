"use client";

import {
  Analytics as VercelAnalytics,
  type BeforeSendEvent,
} from "@vercel/analytics/next";

/**
 * Vercel guarda la URL completa de cada visita, no solo el patrón de ruta.
 * Las nuestras llevan identificadores dentro —/workout/<uuid>, /plans/<uuid>—
 * así que se sustituyen antes de salir del navegador. Queda "/workout/[id]",
 * que es lo que de verdad interesa saber, sin mandar a qué entrenamiento
 * concreto entró nadie.
 */
const UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.pathname = url.pathname.replace(UUID, "[id]");
    // Ninguna pantalla necesita parámetros de consulta para su analítica.
    url.search = "";
    return url.toString();
  } catch {
    return raw;
  }
}

export function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(event: BeforeSendEvent) => ({
        ...event,
        url: redactUrl(event.url),
      })}
    />
  );
}
