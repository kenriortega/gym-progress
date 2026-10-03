/**
 * Novedades que se le cuentan a quien usa la app.
 *
 * Está escrito para el usuario, no para quien programa: nada de nombres de
 * componentes ni de detalles internos. Si un cambio no se nota al usarla, no
 * entra aquí.
 *
 * Para añadir una entrada: ponla la primera, con un id nuevo. El aviso del
 * menú se activa solo cuando cambia el id de la primera entrada.
 */

export type ChangelogEntry = {
  /** Identificador estable; no se reutiliza. */
  id: string;
  date: string;
  title: string;
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-10-03",
    date: "3 de octubre de 2026",
    title: "Ejercicios propios y más planes",
    items: [
      "Ahora puedes escribir el nombre de un ejercicio que no esté en la lista y crearlo. El buscador filtra mientras escribes, así que ya no hay que desplazarse por todo el catálogo.",
      "Nuevo grupo de abdomen con diez ejercicios: planchas, elevaciones de piernas, rueda abdominal, crunch en polea y más.",
      "Tres planes de ejemplo con más volumen de glúteo y tren inferior. Cada plantilla indica si es mixta o de enfoque femenino.",
    ],
  },
  {
    id: "2026-10-01",
    date: "1 de octubre de 2026",
    title: "Planes listos, RPE y ajustes",
    items: [
      "Cinco planes de ejemplo que puedes copiar y editar, para no empezar desde una pantalla en blanco.",
      "Puedes anotar el RPE de cada serie, del 1 al 10, y dejar una nota en la sesión.",
      "Nueva pantalla de ajustes para cambiar entre kilos y libras. Tus entrenamientos antiguos conservan la unidad con la que los guardaste.",
      "La app se adapta a tablet y ordenador: en pantalla grande verás tus ejercicios en dos columnas.",
    ],
  },
  {
    id: "2026-09-29",
    date: "29 de septiembre de 2026",
    title: "Entrena sin cobertura",
    items: [
      "La pantalla de entrenamiento funciona sin conexión. Las series que anotes se guardan en el móvil y se envían solas cuando vuelve la señal, aunque cierres la app.",
      "Puedes instalar la app en la pantalla de inicio y abrirla aunque no haya red.",
      "Tema claro, oscuro o el del sistema, desde el menú de tu foto.",
      "Los planes archivados ya se pueden ver y restaurar.",
      "Nueva sección «Cómo usarla» con la guía rápida.",
    ],
  },
];

export const LATEST_CHANGELOG_ID = CHANGELOG[0]?.id ?? "";

const CLAVE = "gym-progress:novedades-vistas";

/** Última entrada que esta persona marcó como leída en este dispositivo. */
export function leerUltimaVista(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    // Ventana privada o almacenamiento bloqueado: se comporta como no leído.
    return null;
  }
}

export function marcarVistas(): void {
  try {
    localStorage.setItem(CLAVE, LATEST_CHANGELOG_ID);
    // `storage` no se dispara en la pestaña que escribe, así que se avisa a mano.
    window.dispatchEvent(new Event("novedades-vistas"));
  } catch {
    // Si no se puede guardar, el aviso volverá a salir. Es el fallo correcto.
  }
}

export function hayNovedades(): boolean {
  return leerUltimaVista() !== LATEST_CHANGELOG_ID;
}

/**
 * Suscripción para useSyncExternalStore, que es la forma correcta de leer un
 * almacén externo como localStorage sin tocar estado dentro de un efecto.
 * Escucha también el evento `storage` para que marcar las novedades en una
 * pestaña apague el aviso en las demás.
 */
export function subscribirNovedades(alCambiar: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("storage", alCambiar);
  window.addEventListener("novedades-vistas", alCambiar);
  return () => {
    window.removeEventListener("storage", alCambiar);
    window.removeEventListener("novedades-vistas", alCambiar);
  };
}
