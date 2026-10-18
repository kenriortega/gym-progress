import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo al construir la imagen de Docker: empaqueta un servidor mínimo.
  // En Vercel no hace falta y se deja fuera.
  ...(process.env.DOCKER_BUILD === "1"
    ? { output: "standalone" as const }
    : {}),
  env: {
    // Se evalúan al compilar, así que quedan fijadas en el despliegue.
    // VERCEL_GIT_COMMIT_SHA lo inyecta Vercel; en local no existe.
    APP_BUILD_TIME: new Date().toISOString(),
    APP_COMMIT: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
  // Proxy inverso de PostHog: la analítica sale por nuestro propio dominio,
  // así los bloqueadores de rastreo no la cortan. El orden importa, las dos
  // reglas concretas van antes del comodín. Si cambias de región, aquí van
  // eu-assets.i.posthog.com y eu.i.posthog.com, y en
  // src/instrumentation-client.ts el `ui_host`.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // PostHog captura en rutas con barra final (/ingest/e/) y por defecto Next
  // las redirige a la versión sin barra, lo que rompería el envío.
  skipTrailingSlashRedirect: true,
  experimental: {
    // Mantiene pendientes las navegaciones y server actions que fallan por red
    // y las reintenta al volver la conexión, en vez de lanzar un error.
    useOffline: true,
  },
};

const esDesarrollo = process.env.NODE_ENV === "development";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});

// Serwist configura webpack, y `next dev` usa Turbopack por defecto en Next 16.
// En desarrollo no queremos el service worker de todas formas: cachearía
// versiones viejas mientras se edita.
export default esDesarrollo ? nextConfig : withSerwist(nextConfig);
