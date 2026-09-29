import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gym Progress",
    short_name: "Gym Progress",
    description: "Registra tus entrenamientos y supera tu última sesión.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait",
    icons: [
      {
        src: "/gym-progress-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
