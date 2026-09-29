import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Mantiene pendientes las navegaciones y server actions que fallan por red
    // y las reintenta al volver la conexión, en vez de lanzar un error.
    useOffline: true,
  },
};

export default nextConfig;
