import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

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
        <div className="grid size-14 place-items-center rounded-2xl bg-lime-300 text-xl font-black text-zinc-950">
          GP
        </div>

        <div className="mt-12">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-lime-300">
            Gym Progress
          </p>
          <h1 className="mt-3 text-5xl font-black leading-[0.94] tracking-[-0.055em] text-white">
            Cada serie cuenta.
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-zinc-400">
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
          <button
            type="submit"
            disabled={!googleConfigured}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 text-base font-bold text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            <span aria-hidden="true" className="text-lg">
              G
            </span>
            Continuar con Google
          </button>
        </form>

        {!googleConfigured && (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/8 p-4 text-sm leading-6 text-amber-100">
            Añade las credenciales de Google a <code>.env.local</code> para
            habilitar el inicio de sesión.
          </div>
        )}

        <p className="mt-6 text-center text-xs leading-5 text-zinc-600">
          Tus entrenamientos permanecen asociados únicamente a tu cuenta.
        </p>
      </div>
    </main>
  );
}
