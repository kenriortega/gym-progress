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
    id: "2026-10-22",
    date: "22 de octubre de 2026",
    title: "Tu peso, tu constancia y una salida",
    items: [
      "Puedes apuntar tu peso corporal desde Inicio, una vez al día, y ponerte un objetivo en Ajustes. La gráfica te enseña cómo va y dónde está la meta.",
      "En Inicio hay un mapa del último año: un cuadro por día, más encendido cuanto más moviste. De un vistazo ves las rachas y los parones. Aparece en cuanto tengas algún entreno registrado.",
      "Y en Progreso, un cuerpo de frente y de espalda que se tiñe por donde fue tu volumen del último mes, y te dice qué llevas sin tocar. En la página de cada ejercicio también está, marcando lo que mueve.",
      "Si dejabas una sesión abierta y no la terminabas, la app se quedaba atascada ahí: no podías empezar ningún otro plan. Ahora puedes descartarla, y no cuenta como entreno ni aparece en tu historial.",
      "Y cuando la sesión abierta es de otro día, Inicio te lo dice y te ofrece descartarla y empezar la de hoy de una vez.",
      "Si un día no puedes entrenar, mueve esa sesión a otro día desde Planes. Tu rutina semanal no cambia: es solo por esta vez, y si no la haces se olvida sola. Inicio te ofrece el plan movido el día que toque, y te avisa de que viene de otro día.",
    ],
  },
  {
    id: "2026-10-18",
    date: "18 de octubre de 2026",
    title: "Mira cómo funciona el aparato",
    items: [
      "Los ejercicios de máquina traen ahora un dibujo del aparato que puedes mover con el dedo. Tiras de la barra y ves subir los discos que marca el pin; tocas otro disco y cambia el peso. Están el jalón con barra, la columna de poleas, la prensa de piernas y la extensión de cuádriceps.",
      "Cada dibujo cuenta lo que no se ve a simple vista: por qué los rodillos te sujetan los muslos en el jalón, hasta dónde te deja bajar la prensa con los pestillos puestos, o por qué la extensión pesa casi el doble con la rodilla doblada que estirada.",
      "Nueva sección Ejercicios en el menú, con el catálogo entero por grupo muscular. Antes solo veías los que ya habías entrenado, así que no había forma de mirar una máquina antes de usarla por primera vez.",
      "Cada ejercicio lleva ahora el dibujo de un cuerpo con el músculo que trabaja marcado en verde, en el catálogo y en su propia página. Son diez: pecho, espalda, piernas, glúteos, hombros, bíceps, tríceps, abdomen, cardio y el resto. Los de espalda, tríceps y glúteos se ven por detrás, que es donde está el músculo.",
      "En la página de un ejercicio, «Mejor volumen» explica mejor qué mide: los kilos que moviste en una sesión, sumando peso por repeticiones de todas las series.",
      "La gráfica de evolución se lee mejor: ahora se nota el cambio de una sesión a la siguiente, y si todavía tienes menos de tres te dice directamente cuánto has subido desde la anterior.",
    ],
  },
  {
    id: "2026-10-04",
    date: "4 de octubre de 2026",
    title: "Ves cuánto llevas de la sesión",
    items: [
      "La pantalla de entrenamiento muestra arriba cuánto llevas hecho: cuántas series de las que te propusiste y cuántos ejercicios has terminado.",
      "Cada ejercicio lleva su propia barra, para ver de un vistazo cuáles te faltan.",
    ],
  },
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
