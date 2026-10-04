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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-primary" />
            {ultima.title}
          </DialogTitle>
          <DialogDescription>
            Esto es lo que ha cambiado desde la última vez que entraste.
          </DialogDescription>
        </DialogHeader>

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

        <DialogFooter>
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
