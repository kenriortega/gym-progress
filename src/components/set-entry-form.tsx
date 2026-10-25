import { ButtonLink } from "@/components/button-link";

/** Registrar series tiene un único recorrido: IndexedDB y cola, con o sin red. */
export function SetEntryForm() {
  return <div className="border-t border-border p-5">
    <ButtonLink href="/entreno" className="min-h-12 w-full">Registrar series en Entrenar</ButtonLink>
  </div>;
}
