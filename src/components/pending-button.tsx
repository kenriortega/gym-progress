"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type PendingButtonProps = React.ComponentProps<typeof Button> & {
  pendingLabel?: string;
};

export function PendingButton({
  children,
  pendingLabel = "Guardando…",
  disabled,
  ...props
}: PendingButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button {...props} disabled={disabled || pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
