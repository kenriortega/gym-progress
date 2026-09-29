import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { TriangleAlertIcon } from "lucide-react";

import { PendingButton } from "@/components/pending-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  const googleConfigured =
    Boolean(process.env.AUTH_GOOGLE_ID) &&
    Boolean(process.env.AUTH_GOOGLE_SECRET) &&
    !process.env.AUTH_GOOGLE_ID?.startsWith("replace-") &&
    !process.env.AUTH_GOOGLE_SECRET?.startsWith("replace-");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-5 pb-10 pt-8">
      <div>
        <div className="grid size-14 place-items-center rounded-2xl bg-primary text-xl font-black text-primary-foreground">
          GP
        </div>

        <div className="mt-12">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">
            Gym Progress
          </p>
          <h1 className="mt-3 text-5xl font-black leading-[0.94] tracking-[-0.055em] text-foreground">
            Cada serie cuenta.
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-muted-foreground">
            Registra tu entrenamiento, recupera lo que hiciste la última vez y
            llega a tu siguiente sesión con un objetivo claro.
          </p>
        </div>
      </div>

      <div className="mt-16">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <PendingButton
            type="submit"
            size="lg"
            disabled={!googleConfigured}
            pendingLabel="Conectando…"
            className="h-14 w-full rounded-2xl text-base font-semibold"
          >
            <span aria-hidden="true" className="text-lg font-bold">
              G
            </span>
            Continuar con Google
          </PendingButton>
        </form>

        {!googleConfigured && (
          <Alert className="mt-4">
            <TriangleAlertIcon />
            <AlertTitle>Falta configurar Google</AlertTitle>
            <AlertDescription>
              Añade las credenciales de Google a <code>.env.local</code> para
              habilitar el inicio de sesión.
            </AlertDescription>
          </Alert>
        )}

        <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
          Tus entrenamientos permanecen asociados únicamente a tu cuenta.
        </p>
      </div>
    </main>
  );
}
