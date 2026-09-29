import Link from "next/link";

import { Card, CardContent, CardTitle } from "@/components/ui/card";

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

/**
 * Carcasa de las páginas legales. Son públicas a propósito: Google las
 * consulta sin sesión al revisar la pantalla de consentimiento.
 */
export function LegalPage({
  eyebrow,
  title,
  updatedAt,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 pb-16 pt-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última actualización: {updatedAt}
        </p>
      </header>

      <p className="mt-6 text-base leading-7 text-foreground">{intro}</p>

      <div className="mt-8 space-y-4">
        {sections.map((section) => (
          <Card key={section.title} className="p-5">
            <CardTitle className="text-lg">{section.title}</CardTitle>
            <CardContent className="space-y-3 p-0">
              {section.paragraphs.map((text, index) => (
                <p key={index} className="text-sm leading-6 text-muted-foreground">
                  {text}
                </p>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <footer className="mt-10 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <Link href="/" className="font-semibold hover:text-foreground">
          Inicio
        </Link>
        <Link href="/privacidad" className="hover:text-foreground">
          Política de privacidad
        </Link>
        <Link href="/terminos" className="hover:text-foreground">
          Condiciones del servicio
        </Link>
      </footer>
    </main>
  );
}
