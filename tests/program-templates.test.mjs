import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = ts.transpileModule(await readFile(new URL("../src/lib/program-templates.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { PROGRAM_TEMPLATES, findProgramTemplate } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("los ocho programas tienen semanas completas y prescripciones válidas", () => {
  assert.deepEqual(PROGRAM_TEMPLATES.map((program) => program.sessions.length), [3, 4, 4, 5, 4, 4, 4, 4]);
  assert.equal(new Set(PROGRAM_TEMPLATES.map((program) => program.id)).size, 8);
  assert.equal(PROGRAM_TEMPLATES.filter((program) => program.audience === "Para mujeres").length, 3);
  assert.equal(PROGRAM_TEMPLATES.filter((program) => program.source.url.includes("mujeres-niveles")).length, 3);
  assert.equal(PROGRAM_TEMPLATES.filter((program) => program.source.url.includes("4-dias-frecuencia-2")).length, 5);
  for (const program of PROGRAM_TEMPLATES) {
    assert.equal(findProgramTemplate(program.id), program);
    assert.equal(new Set(program.sessions.map((session) => session.weekday)).size, program.sessions.length);
    for (const session of program.sessions) {
      assert.ok(session.weekday >= 0 && session.weekday <= 6);
      assert.ok(`${program.name} 999 · ${session.name}`.length <= 100);
      assert.equal(new Set(session.exercises.map((exercise) => exercise.name.toLowerCase())).size, session.exercises.length);
      for (const exercise of session.exercises) {
        assert.ok(exercise.muscleGroup && exercise.name.length <= 100);
        assert.ok(Number.isInteger(exercise.sets) && exercise.sets >= 1 && exercise.sets <= 20);
        assert.match(exercise.notes, /Descansa/);
        assert.match(exercise.notes, /Alternativa:/);
        assert.ok(exercise.notes.length <= 1000);
        if (exercise.measurement === "time") {
          assert.ok(exercise.targetSeconds > 0);
          assert.equal(exercise.loadType, "bodyweight");
        } else {
          assert.ok(exercise.repsMin >= 1 && exercise.repsMin <= exercise.repsMax);
          assert.match(exercise.notes, /RIR/);
        }
      }
    }
  }
  assert.equal(findProgramTemplate("desconocido"), undefined);
});

test("las especializaciones priorizan su objetivo y los días completos incluyen piernas", () => {
  const byId = (id) => { const program = findProgramTemplate(id); assert.ok(program); return program; };
  const setsFor = (program, group) => program.sessions.flatMap((session) => session.exercises)
    .filter((exercise) => exercise.muscleGroup === group).reduce((total, exercise) => total + exercise.sets, 0);
  const balanced = byId("equilibrio-torso-pierna-4-dias");
  const arms = byId("especializacion-brazos-4-dias");
  assert.ok(setsFor(arms, "Bíceps") > setsFor(balanced, "Bíceps"));
  assert.ok(setsFor(arms, "Tríceps") > setsFor(balanced, "Tríceps"));
  assert.equal(arms.sessions[0].exercises[0].muscleGroup, "Bíceps");
  assert.equal(arms.sessions[2].exercises[0].muscleGroup, "Tríceps");
  const shoulders = byId("especializacion-hombros-4-dias");
  assert.ok(setsFor(shoulders, "Hombros") > setsFor(balanced, "Hombros"));
  for (const session of shoulders.sessions) assert.equal(session.exercises[0].muscleGroup, "Hombros");
  const complete = byId("fuerza-musculo-4-dias");
  for (const session of complete.sessions.slice(2)) {
    assert.ok(session.exercises.some((exercise) => exercise.muscleGroup === "Piernas"));
    assert.ok(session.exercises.some((exercise) => ["Pecho", "Espalda"].includes(exercise.muscleGroup)));
    assert.ok(session.exercises.some((exercise) => exercise.repsMax <= 8));
  }
  const flexible = byId("agenda-flexible-4-dias");
  assert.ok(flexible.sessions[2].exercises.some((exercise) => exercise.muscleGroup === "Piernas"));
  assert.ok(flexible.sessions[2].exercises.some((exercise) => exercise.muscleGroup === "Pecho"));
  const advanced = byId("especializacion-gluteos-hombros-5-dias");
  assert.equal(advanced.sessions[4].weekday, 6);
  assert.ok(advanced.sessions[4].exercises.some((exercise) => exercise.muscleGroup === "Glúteos"));
  assert.ok(advanced.sessions[4].exercises.some((exercise) => exercise.muscleGroup === "Hombros"));
  assert.deepEqual(PROGRAM_TEMPLATES.slice(0, 3).map((program) => program.sessions.flatMap((session) => session.exercises)
    .reduce((total, exercise) => total + exercise.sets, 0)), [36, 55, 51]);
});

test("iniciación contiene 36 series repartidas en días no consecutivos", () => {
  const base = PROGRAM_TEMPLATES[0];
  assert.deepEqual(base.sessions.map((session) => session.weekday), [1, 3, 5]);
  assert.equal(base.sessions.flatMap((session) => session.exercises).reduce((total, exercise) => total + exercise.sets, 0), 36);
});
