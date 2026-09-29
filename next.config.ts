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

export default nextConfig;
