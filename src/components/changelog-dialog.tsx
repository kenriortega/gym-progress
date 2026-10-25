"use client";

import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CHANGELOG,
  hayNovedades,
  marcarVistas,
  subscribirNovedades,
} from "@/lib/changelog";

/**
 * Resumen de la última actualización, una sola vez.
 *
 * Va solo en el inicio a propósito: una ventana que tapa la pantalla cuando
 * estás a punto de entrenar es justo lo que no quieres. Al cerrarla se marca
 * como leída y no vuelve hasta la siguiente versión.
 */
export function ChangelogDialog() {
  const abierto = useSyncExternalStore(
    subscribirNovedades,
    hayNovedades,
    () => false,
  );

  const ultima = CHANGELOG[0];
  if (!ultima) return null;

  return (
    <Dialog
      open={abierto}
      onOpenChange={(open: boolean) => {
        if (!open) marcarVistas();
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4 shrink-0 text-primary" />
            {ultima.title}
          </DialogTitle>
          <DialogDescription>
            Un vistazo a la última actualización.
          </DialogDescription>
        </DialogHeader>

        <div
          role="region"
          aria-label="Novedades de la actualización"
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-ring"
        >
        <ul className="space-y-2">
          {ultima.items.map((item) => (
            <li
              key={item}
              className="flex gap-2 text-sm leading-6 text-muted-foreground"
            >
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>
        </div>

        <DialogFooter className="shrink-0">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            nativeButton={false}
            render={<Link href="/novedades" />}
            onClick={() => marcarVistas()}
          >
            Ver todas
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => marcarVistas()}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
