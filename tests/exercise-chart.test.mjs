import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = new URL("../", import.meta.url);
async function moduleUrl(file, replacements = {}) {
  let source = ts.transpileModule(await readFile(new URL(file, root), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(`"${from}"`, JSON.stringify(to));
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const { chartGeometry } = await import(await moduleUrl("src/lib/exercise-chart.ts"));
const prescriptionUrl = await moduleUrl("src/lib/set-prescription.ts");
const { estimatedOneRepMax, ONE_REP_MAX_REPS } = await import(
  await moduleUrl("src/lib/training-metrics.ts", { "./set-prescription": prescriptionUrl })
);

const day = 24 * 60 * 60 * 1000;
const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

test("una pausa ocupa en el eje lo que duró, no una posición más", () => {
  // Tres sesiones: dos seguidas y la tercera tres semanas después.
  const { points } = chartGeometry([
    { time: 0, value: 100 },
    { time: day, value: 100 },
    { time: 22 * day, value: 100 },
  ]);
  near(points[0].x, 0);
  near(points[1].x, (1 / 22) * 100);
  near(points[2].x, 100);
  // Lo que hacían las barras equidistantes: la segunda a mitad de camino.
  assert.ok(points[1].x < 5, "la sesión del día siguiente no puede caer en el centro");
});

test("sesiones a intervalos iguales sí se reparten por igual", () => {
  const { points } = chartGeometry([
    { time: 0, value: 1 },
    { time: day, value: 2 },
    { time: 2 * day, value: 3 },
  ]);
  near(points[0].x, 0);
  near(points[1].x, 50);
  near(points[2].x, 100);
});

test("el eje vertical deja holgura: ningún punto toca el borde", () => {
  const { points } = chartGeometry([
    { time: 0, value: 50 },
    { time: day, value: 60 },
  ]);
  for (const point of points) {
    assert.ok(point.y > 0 && point.y < 100, `${point.y} dentro del lienzo`);
  }
  // Más valor, más arriba: el eje y crece hacia abajo.
  assert.ok(points[1].y < points[0].y);
});

test("sin recorrido de valores la línea queda a media altura, no arriba del todo", () => {
  const { points } = chartGeometry([
    { time: 0, value: 80 },
    { time: day, value: 80 },
    { time: 2 * day, value: 80 },
  ]);
  for (const point of points) near(point.y, 50);
});

test("una sola sesión se centra y no declara recorrido de fechas", () => {
  const geometry = chartGeometry([{ time: 1700000000000, value: 42 }]);
  near(geometry.points[0].x, 50);
  near(geometry.points[0].y, 50);
  assert.equal(geometry.single, true);
  assert.equal(geometry.first, 1700000000000);
});

test("dos sesiones del mismo día no parten por cero el eje horizontal", () => {
  const { points, single } = chartGeometry([
    { time: 5 * day, value: 10 },
    { time: 5 * day, value: 20 },
  ]);
  assert.equal(single, true);
  for (const point of points) assert.ok(Number.isFinite(point.x) && point.x === 50);
});

test("sin sesiones no hay geometría ni errores", () => {
  const geometry = chartGeometry([]);
  assert.deepEqual(geometry.points, []);
  assert.equal(geometry.single, true);
});

test("el 1RM estimado ordena por fuerza, no por peso en la barra", () => {
  const pesada = estimatedOneRepMax({ weight: 175, reps: 3 });
  const larga = estimatedOneRepMax({ weight: 160, reps: 10 });
  near(pesada, 175 * (1 + 3 / 30));
  near(larga, 160 * (1 + 10 / 30));
  // El récord de peso diría 175; la serie de 10 es más fuerza.
  assert.ok(larga > pesada);
});

test("una repetición es su propio máximo", () => {
  near(estimatedOneRepMax({ weight: 100, reps: 1 }), 100 * (1 + 1 / 30));
});

test("las series largas no estiman: ahí la fórmula mide resistencia", () => {
  assert.equal(estimatedOneRepMax({ weight: 40, reps: ONE_REP_MAX_REPS + 1 }), null);
  assert.equal(estimatedOneRepMax({ weight: 40, reps: 20 }), null);
  assert.notEqual(estimatedOneRepMax({ weight: 40, reps: ONE_REP_MAX_REPS }), null);
});

test("el peso corporal sin lastre no estima un máximo", () => {
  assert.equal(estimatedOneRepMax({ weight: 0, reps: 8 }), null);
  assert.equal(estimatedOneRepMax({ weight: 60, reps: 0 }), null);
  assert.equal(estimatedOneRepMax({ weight: Number.NaN, reps: 5 }), null);
});
