import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const exec = promisify(execFile);
const root = new URL("../", import.meta.url);
async function moduleUrl(file, replacements = {}) {
  let source = ts.transpileModule(await readFile(new URL(file, root), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(`"${from}"`, JSON.stringify(to));
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const unitsUrl = await moduleUrl("src/lib/weight-units.ts");
const { convertWeight, formatWeight, weightLabel, bodyWeightUnit } = await import(unitsUrl);
const { suggestProgression } = await import(await moduleUrl("src/lib/progression.ts", { "./weight-units": unitsUrl }));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≈ ${expected}`);

test("100 lb no supera un registro de 60 kg; se conserva la precisión de conversión", () => {
  near(convertWeight(100, "lb", "kg"), 45.359237);
  assert.ok(convertWeight(100, "lb", "kg") < 60);
  near(convertWeight(20, "kg", "lb"), 44.09245243697551);
  assert.equal(formatWeight(convertWeight(20, "kg", "lb")), "44,09");
  assert.equal(formatWeight(20), "20");
  assert.equal(convertWeight(0, "lb", "kg"), 0);
});

test("ambas unidades explicitan la equivalencia y respetan el orden preferido", () => {
  assert.equal(weightLabel(20, "kg", "both"), "20 kg · 44,09 lb");
  assert.equal(weightLabel(20, "kg", "both", "lb"), "44,09 lb · 20 kg");
  assert.equal(bodyWeightUnit("metric"), "kg");
  assert.equal(bodyWeightUnit("imperial"), "lb");
});

test("consultar repetidamente ambas unidades no modifica el registro original", () => {
  const original = Object.freeze({ weight: 123.45, unit: "lb" });
  for (let i = 0; i < 100; i++) {
    formatWeight(convertWeight(original.weight, original.unit, "kg"));
    assert.equal(convertWeight(original.weight, original.unit, "lb"), 123.45);
  }
  assert.deepEqual(original, { weight: 123.45, unit: "lb" });
});

const session = (date, weight, weightUnit) => ({
  performedAt: new Date(date), targetSets: 2, targetRepsMax: 10, weightUnit,
  sets: [{ weight, reps: 10 }, { weight, reps: 10 }],
});

test("la progresión normaliza sesiones mixtas y presenta el salto en la unidad actual", () => {
  const sessions = [session("2026-10-26", 40, "lb"), session("2026-10-19", 20, "kg")];
  const kg = suggestProgression(sessions);
  // 40 lb son 18,14… kg: corresponde el salto menor de 1,25 kg, no 2,5.
  near(kg.fromWeight, 18.1436948);
  near(kg.increment, 1.25);
  near(kg.toWeight, 19.3936948);
  const lb = suggestProgression(sessions, "lb");
  near(lb.fromWeight, 40);
  near(lb.toWeight, convertWeight(19.3936948, "kg", "lb"));
  assert.equal(lb.sessions, 2);
  assert.equal(lb.days, 7);
});

test("la progresión mantiene sus requisitos de series, repeticiones y días", () => {
  assert.equal(suggestProgression([session("2026-10-26", 60, "kg")]), null);
  assert.equal(suggestProgression([session("2026-10-26", 60, "kg"), session("2026-10-25", 60, "kg")]), null);
  const incomplete = session("2026-10-26", 60, "lb");
  incomplete.sets[1].reps = 9;
  assert.equal(suggestProgression([incomplete, session("2026-10-19", 60, "kg")]), null);
  assert.equal(suggestProgression([session("2026-10-26", 60), session("2026-10-19", 60)]).toWeight, 62.5);
});

test("PostgreSQL calcula máximos y volúmenes mixtos antes de redondear, sin cambiar registros", { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "gym-weight-pg-"));
  const data = join(directory, "data");
  const binary = (name) => process.env.PG_TEST_BIN ? join(process.env.PG_TEST_BIN, name) : name;
  let started = false;
  let pool;
  try {
    await exec(binary("initdb"), ["-D", data, "-U", "gym_test", "-A", "trust", "--locale=C", "--encoding=UTF8"]);
    // Solo socket privado: no abre un puerto TCP ni usa la base del proyecto.
    await exec(binary("pg_ctl"), ["-D", data, "-l", join(directory, "postgres.log"), "-o", `-h '' -k ${directory}`, "-w", "start"]);
    started = true;
    const { Pool } = require("pg");
    pool = new Pool({ host: directory, user: "gym_test", database: "postgres" });
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { sql } = await import("drizzle-orm");
    const { weightInKgSql } = await import(await moduleUrl("src/db/weight.ts", {
      "../lib/weight-units": unitsUrl,
      "drizzle-orm": import.meta.resolve("drizzle-orm"),
    }));
    const db = drizzle(pool);
    await pool.query("create table sets (weight numeric(7,2), unit text, reps integer)");
    await pool.query("insert into sets values (100, 'lb', 10), (60, 'kg', 5), (0.01, 'lb', 1000)");
    const before = (await pool.query("select * from sets order by weight")).rows;
    const kg = weightInKgSql(sql`weight`, sql`unit`);
    const { rows: [result] } = await db.execute(sql`select max(${kg}) as best, sum(${kg} * reps) as volume from sets`);
    assert.equal(Number(result.best), 60);
    near(Number(result.volume), 758.1282937);
    const { rows: [lbOnly] } = await db.execute(sql`select ${kg} as weight from sets where weight = 100`);
    near(Number(lbOnly.weight), 45.359237);
    assert.deepEqual((await pool.query("select * from sets order by weight")).rows, before);
  } finally {
    if (pool) await pool.end();
    if (started) await exec(binary("pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"]);
    await rm(directory, { recursive: true, force: true });
  }
});
