/**
 * Geometría de la gráfica de evolución de un ejercicio, en porcentajes sobre
 * un lienzo de 100 × 100.
 *
 * Vive fuera del componente para poder comprobarla sin navegador: lo que la
 * gráfica dice depende entera de estos dos ejes, y equivocarse aquí no rompe
 * nada, solo cuenta otra historia.
 */
export type ChartPoint = { time: number; value: number };
export type ChartPlot = { x: number; y: number };

export type ChartGeometry = {
  points: ChartPlot[];
  /** Extremos del eje horizontal, para rotular las fechas. */
  first: number;
  last: number;
  /** Verdadero cuando todas las sesiones caen el mismo día. */
  single: boolean;
};

/** Holgura vertical cuando hay recorrido, como fracción de ese recorrido. */
const MARGIN = 0.35;
/** Holgura cuando todas las sesiones valen lo mismo, como fracción del valor. */
const FLAT_MARGIN = 0.08;

export function chartGeometry(points: ChartPoint[]): ChartGeometry {
  if (!points.length) return { points: [], first: 0, last: 0, single: true };

  const times = points.map((point) => point.time);
  const values = points.map((point) => point.value);
  const first = Math.min(...times);
  const last = Math.max(...times);
  const span = last - first;

  // El eje vertical no arranca en cero a propósito: el rango útil de una serie
  // de fuerza es estrecho y desde cero una subida de 2,5 kg son dos píxeles,
  // justo la señal que la gráfica existe para mostrar.
  const high = Math.max(...values);
  const low = Math.min(...values);
  const margin = (high - low) * MARGIN || Math.abs(high) * FLAT_MARGIN || 1;
  const ceiling = high + margin;
  const floor = low - margin;
  const height = ceiling - floor;

  return {
    // El eje horizontal sí respeta las fechas: repartidas por igual, una pausa
    // de tres semanas se leía como una bajada entre dos días seguidos.
    points: points.map((point) => ({
      x: span > 0 ? ((point.time - first) / span) * 100 : 50,
      y: height > 0 ? ((ceiling - point.value) / height) * 100 : 50,
    })),
    first,
    last,
    single: span === 0,
  };
}
