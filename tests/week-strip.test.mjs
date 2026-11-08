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
const datesUrl = await moduleUrl("src/lib/dates.ts");
const scheduleUrl = await moduleUrl("src/lib/schedule.ts", { "@/lib/dates": datesUrl });
const { weekStripOf, weekTally, shortPlanName, mondayOf } = await import(
  await moduleUrl("src/lib/week-strip.ts", { "@/lib/dates": datesUrl, "@/lib/schedule": scheduleUrl })
);

// Semana del lunes 2 al domingo 8 de noviembre de 2026.
const LUNES = new Date(2026, 10, 2, 9, 0);
const JUEVES = new Date(2026, 10, 5, 9, 0);
const DOMINGO = new Date(2026, 10, 8, 9, 0);

const PLANES = [
  { id: "p1", name: "Especialización · Brazos · 8 microciclos · PIERNA 1", weekday: 1 },
  { id: "t1", name: "Especialización · Brazos · 8 microciclos · TORSO 1", weekday: 2 },
  { id: "su", name: "Día suave · Barras, core y carrera", weekday: 3 },
  { id: "p2", name: "Especialización · Brazos · 8 microciclos · PIERNA 2", weekday: 4 },
  { id: "t2", name: "Especialización · Brazos · 8 microciclos · TORSO 2", weekday: 5 },
];

const estados = (days) => days.map((item) => item.state);

test("la semana empieza en lunes y trae siete días", () => {
  const days = weekStripOf({ plans: PLANES, reschedules: [], trainedDays: [], today: JUEVES });
  assert.equal(days.length, 7);
  assert.deepEqual(days.map((item) => item.label), ["L", "M", "X", "J", "V", "S", "D"]);
  assert.equal(days[0].day, "2026-11-02");
  assert.equal(days[6].day, "2026-11-08");
  assert.equal(mondayOf(DOMINGO).getDate(), 2, "el domingo pertenece a la semana que empezó el lunes");
});

test("el jueves por la mañana: lo anterior hecho, hoy pendiente de hacer, el viernes por venir", () => {
  const days = weekStripOf({
    plans: PLANES,
    reschedules: [],
    trainedDays: ["2026-11-02", "2026-11-03", "2026-11-04"],
    today: JUEVES,
  });
  assert.deepEqual(estados(days), ["hecho", "hecho", "hecho", "hoy", "pendiente", "libre", "libre"]);
});

test("un día que tocaba y pasó sin entrenar queda perdido, no pendiente", () => {
  const days = weekStripOf({ plans: PLANES, reschedules: [], trainedDays: ["2026-11-02"], today: JUEVES });
  assert.deepEqual(estados(days), ["hecho", "perdido", "perdido", "hoy", "pendiente", "libre", "libre"]);
});

test("hoy no se da por perdido aunque aún no hayas ido", () => {
  const days = weekStripOf({ plans: PLANES, reschedules: [], trainedDays: [], today: LUNES });
  assert.equal(days[0].state, "hoy");
});

test("un día de peso corporal cuenta: la tira mira si entrenaste, no cuántos kilos", () => {
  // El miércoles es dominadas, fondos y carrera: cero kilos de carga externa.
  const days = weekStripOf({ plans: PLANES, reschedules: [], trainedDays: ["2026-11-04"], today: JUEVES });
  assert.equal(days[2].state, "hecho");
});

test("entrenar un día libre se marca aparte y no cuenta como sesión prevista", () => {
  const days = weekStripOf({ plans: PLANES, reschedules: [], trainedDays: ["2026-11-07"], today: DOMINGO });
  assert.equal(days[5].state, "extra");
  const { hechos, previstos, extras } = weekTally(days);
  assert.equal(extras, 1);
  assert.equal(previstos, 5, "el sábado extra no infla lo que la semana pedía");
  assert.equal(hechos, 0);
});

test("un plan movido aparece en su destino y no en su día de siempre", () => {
  const days = weekStripOf({
    plans: PLANES,
    reschedules: [{ planId: "t1", fromDate: "2026-11-03", toDate: "2026-11-07" }],
    trainedDays: [],
    today: LUNES,
  });
  assert.equal(days[1].plans.length, 0, "el martes se queda sin su plan");
  assert.equal(days[1].state, "libre");
  assert.deepEqual(days[5].plans, ["Torso 1"], "el sábado lo recibe");
  assert.equal(days[5].state, "pendiente");
});

test("el recuento cuenta lo hecho sobre lo previsto", () => {
  const days = weekStripOf({
    plans: PLANES,
    reschedules: [],
    trainedDays: ["2026-11-02", "2026-11-03", "2026-11-04"],
    today: JUEVES,
  });
  const { hechos, previstos } = weekTally(days);
  assert.equal(hechos, 3);
  assert.equal(previstos, 5);
});

test("sin planes la semana entera queda libre y sin nada que reclamar", () => {
  const days = weekStripOf({ plans: [], reschedules: [], trainedDays: [], today: JUEVES });
  assert.deepEqual(estados(days), Array(7).fill("libre"));
  assert.deepEqual(weekTally(days), { hechos: 0, previstos: 0, extras: 0 });
});

test("el nombre corto se queda con el último tramo, que es el que distingue la sesión", () => {
  assert.equal(shortPlanName("Especialización · Brazos · 8 microciclos · PIERNA 1"), "Pierna 1");
  // El último tramo es la lista de lo que hay dentro; el primero es el nombre.
  assert.equal(shortPlanName("Día suave · Barras, core y carrera"), "Día suave");
  // Sin ningún tramo corto, se recorta el último.
  assert.equal(shortPlanName("Acondicionamiento general · Circuito metabólico largo"), "Circuito me…");
  assert.equal(shortPlanName("Pierna"), "Pierna");
  assert.equal(shortPlanName("  ·  Torso 2  "), "Torso 2");
});
