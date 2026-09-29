"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmSubmitButtonProps = React.ComponentProps<typeof Button> & {
  confirmation: string;
  title?: string;
  confirmLabel?: string;
  pendingLabel?: string;
};

export function ConfirmSubmitButton({
  confirmation,
  title = "¿Seguro?",
  confirmLabel = "Sí, continuar",
  children,
  pendingLabel = "Procesando…",
  disabled,
  ...props
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        {...props}
        type="button"
        disabled={disabled || pending}
        onClick={() => setOpen(true)}
      >
        {pending ? pendingLabel : children}
      </Button>

      {/* Dispara el envío real del formulario que envuelve a este botón. */}
      <button ref={submitRef} type="submit" className="hidden" tabIndex={-1} aria-hidden />

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpen(false);
                submitRef.current?.click();
              }}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
