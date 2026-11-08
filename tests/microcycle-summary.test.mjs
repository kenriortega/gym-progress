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
const prescriptionUrl = await moduleUrl("src/lib/set-prescription.ts");
const jsonUrl = `data:text/javascript;base64,${Buffer.from(
  `export default ${await readFile(new URL("src/lib/pdf-programs.json", root), "utf8")};`,
).toString("base64")}`;
const { microcycleSummaries, microcycleDiff, rirLabel, MICROCYCLES } = await import(
  await moduleUrl("src/lib/microcycle-summary.ts", {
    "./set-prescription": prescriptionUrl,
    "./pdf-programs.json": jsonUrl,
  })
);
const { parsePdfCell } = await import(prescriptionUrl);

const BRAZOS = "especializacion-brazos-4-dias";

test("un programa desconocido no inventa resumen", () => {
  assert.equal(microcycleSummaries("no-existe"), null);
});

test("cada programa del PDF resume sus ocho microciclos", () => {
  const summaries = microcycleSummaries(BRAZOS);
  assert.equal(summaries.length, MICROCYCLES);
  assert.deepEqual(summaries.map((item) => item.microcycle), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("una celda de dos líneas cuenta sus series, no trece", () => {
  // El fallo que motivó reutilizar parsePdfCell: al quitar los espacios,
  // "RIR1" y "3x10-12" se pegaban en "RIR13x" y una expresión regular propia
  // leía trece series donde hay cuatro.
  const sets = parsePdfCell("1x6-8 RIR1\n3x10-12 RIR0");
  assert.equal(sets.length, 4);
  assert.equal(sets.filter((set) => set.kind === "work").length, 4);
});

test("los drop sets no se cuentan como series de trabajo", () => {
  const sets = parsePdfCell("4x10-12 RIR0\n+ 1 DS");
  assert.equal(sets.filter((set) => set.kind === "work").length, 4);
  assert.equal(sets.filter((set) => set.kind === "drop").length, 1);
});

test("el programa sube el volumen y aprieta el esfuerzo a medida que avanza", () => {
  const [primero, , , , quinto, , , octavo] = microcycleSummaries(BRAZOS);
  assert.ok(primero.sets < octavo.sets, "el octavo pide más series que el primero");
  assert.ok(octavo.rirAverage < primero.rirAverage, "y se trabaja más cerca del fallo");
  assert.equal(primero.dropSets, 0, "el primero no lleva drop sets");
  assert.ok(quinto.dropSets > 0, "a mitad de programa ya aparecen");
});

test("el rango de esfuerzo se lee entero cuando la semana no es uniforme", () => {
  assert.equal(rirLabel({ rirMin: 3, rirMax: 3 }), "RIR 3");
  assert.equal(rirLabel({ rirMin: 0, rirMax: 2 }), "RIR 0–2");
});

test("pasar al siguiente dice las series, el esfuerzo y los drop sets", () => {
  const summaries = microcycleSummaries(BRAZOS);
  const lineas = microcycleDiff(summaries[0], summaries[1]).join(" ");
  assert.match(lineas, /series en la semana/);
  assert.match(lineas, /reserva/);
});

test("el salto que estrena los drop sets lo dice con esas palabras", () => {
  const summaries = microcycleSummaries(BRAZOS);
  const sinDrops = summaries.find((item) => item.dropSets === 0);
  const conDrops = summaries.find((item) => item.dropSets > 0);
  const lineas = microcycleDiff(sinDrops, conDrops).join(" ");
  assert.match(lineas, /Aparecen los drop sets/);
});

test("quedarse donde estás no anuncia ningún cambio", () => {
  const summaries = microcycleSummaries(BRAZOS);
  assert.deepEqual(microcycleDiff(summaries[3], summaries[3]), []);
});

test("bajar de microciclo se cuenta como lo que es, no como una subida", () => {
  const summaries = microcycleSummaries(BRAZOS);
  const lineas = microcycleDiff(summaries[5], summaries[0]).join(" ");
  assert.match(lineas, /−/, "menos series se dice con signo menos");
  assert.match(lineas, /Más margen/);
  assert.match(lineas, /Sin drop sets/);
});

test("mismo rango de esfuerzo pero más series al fallo se dice con series, no con rangos", () => {
  const summaries = microcycleSummaries(BRAZOS);
  const cuarto = summaries[3];
  const quinto = summaries[4];
  assert.equal(rirLabel(cuarto), rirLabel(quinto), "el rango no cambia entre esos dos");
  assert.ok(quinto.failureSets > cuarto.failureSets, "pero sí cuántas series llegan al fallo");
  const lineas = microcycleDiff(cuarto, quinto).join(" ");
  assert.match(lineas, new RegExp(`${quinto.failureSets} series al fallo, frente a ${cuarto.failureSets}`));
  assert.doesNotMatch(lineas, /0–2 repeticiones en reserva, frente a 0–2/);
});

test("dos microciclos idénticos en números no se quedan sin explicación", () => {
  const igual = { microcycle: 7, sets: 100, dropSets: 2, failureSets: 40, rirMin: 0, rirMax: 1, rirAverage: 0.5 };
  const otro = { ...igual, microcycle: 8 };
  assert.deepEqual(microcycleDiff(igual, otro), [
    "Mismo volumen y mismo esfuerzo: cambia el reparto dentro de las sesiones.",
  ]);
});
