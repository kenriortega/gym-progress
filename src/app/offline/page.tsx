import type { Metadata } from "next";
import { WifiOffIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Sin conexión · Gym Progress",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Alert>
        <WifiOffIcon />
        <AlertTitle>Sin conexión</AlertTitle>
        <AlertDescription>
          Esta pantalla necesita red y ahora mismo no hay. En cuanto vuelva la
          señal, vuelve atrás y seguirá donde lo dejaste.
        </AlertDescription>
      </Alert>

      <p className="mt-6 text-center text-sm leading-6 text-muted-foreground">
        Las series que hayas registrado con la app abierta se envían solas
        cuando se recupera la conexión.
      </p>
    </main>
  );
}
