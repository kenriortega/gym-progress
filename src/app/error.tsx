"use client";

import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Alert>
        <TriangleAlertIcon />
        <AlertTitle>Algo no ha cargado</AlertTitle>
        <AlertDescription>
          Puede ser la conexión. Tus entrenamientos están guardados: vuelve a
          intentarlo y debería aparecer todo.
        </AlertDescription>
      </Alert>

      <div className="mt-6 grid gap-3">
        <Button onClick={reset} size="lg" className="h-12">
          <RefreshCwIcon className="size-4" />
          Reintentar
        </Button>
        <ButtonLink href="/" variant="outline" size="lg" className="h-12">
          Volver al inicio
        </ButtonLink>
      </div>

      {error.digest ? (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Referencia: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
