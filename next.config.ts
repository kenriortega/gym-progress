import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Se evalúan al compilar, así que quedan fijadas en el despliegue.
    // VERCEL_GIT_COMMIT_SHA lo inyecta Vercel; en local no existe.
    APP_BUILD_TIME: new Date().toISOString(),
    APP_COMMIT: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
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
