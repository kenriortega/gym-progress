"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * Flecha de volver que respeta de dónde vienes.
 *
 * Cada pantalla declaraba un destino fijo, y el detalle de ejercicio se
 * alcanza desde ocho sitios: el entreno en curso, el historial, un plan, el
 * listado… Volver a un destino fijo sacaba del entreno a quien solo iba a
 * mirar el peso de la última sesión.
 *
 * Con historial dentro de la aplicación se retrocede de verdad; sin él —enlace
 * compartido, reapertura de la PWA, primera pantalla de la sesión— se navega al
 * destino declarado, que sigue siendo el `href` del enlace. Así funciona
 * también sin JavaScript y el worker conserva su documento de respaldo.
 */
export function BackLink({ onClick, ...props }: ComponentProps<"a">) {
  const router = useRouter();
  return (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        // history.length cuenta también la entrada actual: con 1 no hay a dónde volver.
        if (typeof window === "undefined" || window.history.length <= 1) return;
        event.preventDefault();
        router.back();
      }}
    />
  );
}
