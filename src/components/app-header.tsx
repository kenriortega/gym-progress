import Link from "next/link";

import { auth, signOut } from "@/auth";
import { UserMenu } from "@/components/user-menu";

type AppHeaderProps = {
  /** Texto pequeño sobre el título. */
  eyebrow?: string;
  title: string;
  /** Si se indica, muestra la flecha de volver a esa ruta. */
  backHref?: string;
  /** Contenido opcional a la izquierda del menú (contadores, insignias…). */
  action?: React.ReactNode;
};

export async function AppHeader({ eyebrow, title, backHref, action }: AppHeaderProps) {
  const session = await auth();
  const user = session?.user;
  const displayName = user?.name ?? user?.email ?? "Atleta";

  return (
    <header className="flex items-center gap-3">
      {backHref ? (
        <Link
          href={backHref}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-border text-xl text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
          aria-label="Volver"
        >
          ←
        </Link>
      ) : null}

      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-foreground">
          {title}
        </h1>
      </div>

      {action}

      <UserMenu
        name={displayName}
        email={user?.email ?? null}
        image={user?.image ?? null}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      />
    </header>
  );
}
