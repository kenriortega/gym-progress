"use client";

import { useFormStatus } from "react-dom";

type PendingButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
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
    <button {...props} disabled={disabled || pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
