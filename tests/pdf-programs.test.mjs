import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url), ts = require("typescript");
async function moduleUrl(file, replacements = {}) {
  let source = ts.transpileModule(await readFile(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(JSON.stringify(from), JSON.stringify(to));
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const data = JSON.parse(await readFile(new URL("../src/lib/pdf-programs.json", import.meta.url), "utf8"));
const dataUrl = `data:text/javascript;base64,${Buffer.from(`export default ${JSON.stringify(data)}`).toString("base64")}`;
const prescriptionUrl = await moduleUrl("src/lib/set-prescription.ts");
const { parsePdfCell, validPrescription, formatPrescribedSet, nextSetPosition, prescriptionTargets, completedTargetSets } = await import(prescriptionUrl);
const { pdfProgram, hasPdfProgram } = await import(await moduleUrl("src/lib/pdf-programs.ts", { "./set-prescription": prescriptionUrl, "./pdf-programs.json": dataUrl }));
const { PROGRAM_TEMPLATES } = await import(await moduleUrl("src/lib/program-templates.ts"));
const { validMetrics, formatTarget } = await import(await moduleUrl("src/lib/training-metrics.ts", { "./set-prescription": prescriptionUrl }));

test("20 páginas y 1264 celdas: cinco programas completos en los ocho microciclos", () => {
  assert.equal(data.sha256, "2e4921f552deaed11f7ff81efde3e8672a04f3189ea0a26b1b6e31513283dc21");
  assert.equal(new Set(data.programs.flatMap((program) => program.sessions.map((session) => session.page))).size, 20);
  let cells = 0;
  for (const original of data.programs) {
    const template = PROGRAM_TEMPLATES.find((program) => program.id === original.id);
    assert.ok(template && hasPdfProgram(template.id));
    for (let microcycle = 1; microcycle <= 8; microcycle++) {
      const program = pdfProgram(template, microcycle);
      assert.equal(program.sessions.length, 4);
      for (const [s, session] of program.sessions.entries()) {
        assert.equal(session.weekday, template.sessions[s].weekday);
        assert.equal(new Set(session.exercises.map((exercise) => exercise.name)).size, session.exercises.length);
        for (const [e, exercise] of session.exercises.entries()) {
          const p = exercise.prescription;
          assert.ok(validPrescription(p));
          assert.equal(p.raw, original.sessions[s].exercises[e].microcycles[microcycle - 1]);
          assert.equal(p.page, original.sessions[s].page);
          assert.equal(p.microcycle, microcycle);
          assert.ok(validMetrics({ ...exercise, ...prescriptionTargets(p) }));
          assert.ok(exercise.notes.length <= 1000);
          assert.ok(`${program.name} 999 · ${session.name}`.length <= 100);
          cells++;
        }
      }
    }
  }
  assert.equal(cells, 1264);
});

test("series diferenciadas, RIR en rango y datos ausentes se conservan sin inventarlos", () => {
  const sets = parsePdfCell("1x6-8 RIR1\n3x10-12 RIR0\n+ 1 DS");
  assert.equal(sets.length, 5);
  assert.deepEqual(sets[0], { kind: "work", repsMin: 6, repsMax: 8, rirMin: 1, rirMax: 1 });
  assert.deepEqual(sets[3], { kind: "work", repsMin: 10, repsMax: 12, rirMin: 0, rirMax: 0 });
  assert.deepEqual(sets[4], { kind: "drop", repsMin: null, repsMax: null, rirMin: null, rirMax: null });
  assert.match(formatPrescribedSet(sets[4]), /sin especificar/);
  assert.equal(parsePdfCell("2x8-10 RIR 1-\n2")[1].rirMax, 2);
  const abdominal = parsePdfCell("3x RIR 3");
  assert.equal(abdominal[0].repsMin, null);
  assert.match(formatPrescribedSet(abdominal[0]), /sin fijar/);
  for (const raw of ["", "3x12 RIR9", "3x12 RIR1 texto", "0x8 RIR1", "999999999x8 RIR1", "1x8-6 RIR2"]) assert.throws(() => parsePdfCell(raw));
  assert.throws(() => pdfProgram(PROGRAM_TEMPLATES[0], 1));
  assert.throws(() => pdfProgram(PROGRAM_TEMPLATES[1], 9));
});

test("validación de prescripciones y reposición de huecos mantienen contrato y posición", () => {
  const p = pdfProgram(PROGRAM_TEMPLATES[1], 3).sessions[0].exercises[0].prescription;
  const metrics = { ...prescriptionTargets(p), measurement: "reps" };
  assert.ok(validMetrics(metrics));
  assert.equal(validMetrics({ ...metrics, targetSets: 1 }), false);
  assert.equal(validMetrics({ ...metrics, measurement: "time", targetSeconds: 30 }), false);
  assert.equal(validPrescription({ ...p, microcycle: 9 }), false);
  assert.equal(validPrescription({ ...p, sets: [{ kind: "drop", repsMin: 8, repsMax: 12, rirMin: 0, rirMax: 0 }] }), false);
  assert.match(formatTarget(metrics), /Microciclo 3/);
  assert.equal(nextSetPosition([{ position: 1 }], true), 0);
  assert.equal(nextSetPosition([{ position: 0 }, { position: 2 }], true), 1);
  assert.equal(nextSetPosition([{ position: 1 }]), 2);
  assert.equal(completedTargetSets({ prescription: p, sets: [{ position: 0 }, { position: 1 }, { position: 2 }, { position: 4 }] }), 3, "una serie extra no sustituye un objetivo pendiente");
});
