"use client";

import NextError from "next/error";
import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * Último recinto: `error.tsx` no cubre al layout raíz, así que si revienta el
 * layout no se entera nadie. Este archivo sí, y por eso sustituye al documento
 * entero: trae sus propios <html> y <body>, y no hereda ni globals.css ni el
 * tema, así que la pantalla es la genérica de Next, no la de la app.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
    posthog.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
