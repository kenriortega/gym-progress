"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * Ata los eventos a la cuenta en vez de al navegador. Sin esto, entrar desde
 * el móvil y desde el portátil son dos personas distintas para la analítica.
 *
 * Se manda solo el identificador, nunca el nombre ni el correo: PostHog no
 * necesita saber quién eres para contar que alguien volvió.
 *
 * No pinta nada; está aquí porque `identify` solo existe en el navegador y la
 * sesión solo se conoce en el servidor.
 */
export function AnalyticsIdentity({ userId }: { userId: string }) {
  useEffect(() => {
    posthog.identify(userId);
  }, [userId]);

  return null;
}
