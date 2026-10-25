"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOfflinePlans } from "@/components/offline-plans-provider";
import { readOfflinePlans } from "@/lib/offline/plan-storage";
import { iniciarEntreno } from "@/lib/offline-queue";

function openTraining() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- El documento está precacheado; una navegación RSC puede quedar pendiente sin red.
  window.location.assign("/entreno");
}

type Props = Omit<React.ComponentProps<typeof Button>, "onClick"> & { userId: string; planId: string };
export function StartWorkoutButton({ userId, planId, children, disabled, ...props }: Props) {
  const [starting, setStarting] = useState(false);
  const { refresh } = useOfflinePlans();
  return <Button {...props} type="button" disabled={disabled || starting} onClick={async () => {
    if (starting) return;
    setStarting(true);
    try {
      const catalog = await readOfflinePlans(userId);
      if (!catalog?.data.plans.some((plan) => plan.id === planId) && navigator.onLine) await refresh();
      await iniciarEntreno(userId, planId);
      // Navegación de documento: no depende de una petición RSC con conexión.
      openTraining();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "No se pudo guardar el inicio del entrenamiento.", {
        id: "offline-start", action: { label: "Abrir entreno", onClick: openTraining },
      });
      setStarting(false);
    }
  }}>{starting ? "Preparando…" : children}</Button>;
}
