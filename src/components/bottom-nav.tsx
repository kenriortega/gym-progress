"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDaysIcon, DumbbellIcon, HouseIcon, TrendingUpIcon } from "lucide-react";
import { cn } from "cn";
import { navActive, navHidden } from "@/lib/nav";

/**
 * Barra de destinos fijos.
 *
 * El menú de la cabecera ya llevaba a todas partes, pero a dos toques: abrirlo
 * y elegir. Estos cuatro son los que se repiten dentro de una misma visita, y
 * aquí están a uno. El resto sigue en el menú.
 *
 * No consulta nada del servidor a propósito. Vive en el layout raíz, así que
 * una consulta aquí volvería dinámicas las rutas que hoy se prerenderizan
 * —`/entreno`, `/offline`, las legales— y la pantalla sin conexión dejaría de
 * servirse desde la caché. «Entrenar» no necesita saber si hay un entreno
 * abierto: `/entreno` lo retoma solo desde el almacenamiento local.
 *
 * Las pantallas que no son la aplicación no la llevan: ahí no hay a dónde ir.
 *
 * Solo en pantalla estrecha. En escritorio los cuatro destinos se reparten a lo
 * ancho de la ventana y quedan lejos unos de otros y del contenido; además el
 * menú de la cabecera está ahí al lado, sin el coste de alcanzarlo con el
 * pulgar. El atajo resuelve un problema del móvil.
 */
const ITEMS = [
  { href: "/", label: "Inicio", Icon: HouseIcon },
  { href: "/entreno", label: "Entrenar", Icon: DumbbellIcon },
  { href: "/plans", label: "Planes", Icon: CalendarDaysIcon },
  { href: "/progress", label: "Progreso", Icon: TrendingUpIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  if (navHidden(pathname)) return null;

  return (
    <>
      {/* Deja sitio al final del documento: la barra flota y taparía el último bloque. */}
      <div aria-hidden className="h-[4.5rem] md:hidden" />

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden [padding-bottom:env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex w-full max-w-md items-stretch">
          {ITEMS.map(({ href, label, Icon }) => {
            const activo = navActive(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold transition",
                    activo ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-5", activo ? "text-primary" : null)} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
