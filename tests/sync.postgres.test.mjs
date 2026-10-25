import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

// Crea su propio clúster y módulos de auth/db. No importa .env ni @/db reales.
await test("API de sincronización con PostgreSQL temporal real", { timeout: 90_000 }, async (t) => {
  const directory = await mkdtemp("/private/tmp/gym-sync-pg-");
  const modules = await mkdtemp(join(root, ".offline-sync-test-"));
  const data = join(directory, "data");
  const reserve = createServer();
  await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
  const port = reserve.address().port;
  await new Promise((resolve) => reserve.close(resolve));
  let started = false;
  let pool;
  const binary = (name) => process.env.PG_TEST_BIN ? join(process.env.PG_TEST_BIN, name) : name;
  try {
    await exec(binary("initdb"), ["-D", data, "-U", "gym_test", "-A", "trust", "--locale=C", "--encoding=UTF8"]);
    await exec(binary("pg_ctl"), ["-D", data, "-l", join(directory, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${directory}`, "-w", "start"]);
    started = true;
    const url = `postgresql://gym_test@127.0.0.1:${port}/postgres`;
    await writeFile(join(modules, "auth.mjs"), 'let current; export const setUser = (id) => { current = id; }; export const auth = async () => current ? { user: { id: current } } : null;');
    await writeFile(join(modules, "db.mjs"), `import pg from "pg"; import { drizzle } from "drizzle-orm/node-postgres"; export const pool = new pg.Pool({connectionString:${JSON.stringify(url)}}); export const db = drizzle(pool);`);
    const compile = async (file, destination) => {
      const source = await readFile(join(root, file), "utf8");
      const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
        .replaceAll('"next/server"', '"next/server.js"').replaceAll('"@/auth"', '"./auth.mjs"').replaceAll('"@/db"', '"./db.mjs"').replaceAll('"@/db/schema"', '"./schema.mjs"');
      await writeFile(join(modules, destination), js);
      return import(pathToFileURL(join(modules, destination)).href);
    };
    await compile("src/db/schema.ts", "schema.mjs");
    ({ pool } = await import(pathToFileURL(join(modules, "db.mjs")).href));
    for (const file of (await readdir(join(root, "drizzle"))).filter((name) => name.endsWith(".sql")).sort()) {
      await pool.query(await readFile(join(root, "drizzle", file), "utf8"));
    }
    const { POST } = await compile("src/app/api/sync/route.ts", "sync.mjs");
    const { GET: snapshot } = await compile("src/app/api/snapshot/route.ts", "snapshot.mjs");
    const { POST: ownership } = await compile("src/app/api/offline/workout-ownership/route.ts", "ownership.mjs");
    const { setUser } = await import(pathToFileURL(join(modules, "auth.mjs")).href);
    const userA = randomUUID(), userB = randomUUID(), planA = randomUUID(), planB = randomUUID();
    const exerciseA = randomUUID(), exerciseB = randomUUID();
    await pool.query("insert into users(id,email) values ($1,'a@test.invalid'),($2,'b@test.invalid')", [userA, userB]);
    await pool.query("insert into training_plans(id,user_id,name) values ($1,$2,'Plan A'),($3,$4,'Plan B')", [planA, userA, planB, userB]);
    await pool.query("insert into exercises(id,user_id,name,muscle_group) values ($1,$2,'Ejercicio A','Piernas'),($3,$4,'Ejercicio B','Torso')", [exerciseA, userA, exerciseB, userB]);
    const make = (extra = {}) => ({
      id: randomUUID(), userId: userA, kind: "startWorkout", workoutId: randomUUID(), planId: planA,
      weightUnit: "kg", createdAt: Date.parse("2026-10-20T08:00:00Z"), performedAt: "2026-10-20T08:00:00.000Z",
      exercises: [{ workoutExerciseId: randomUUID(), exerciseId: exerciseA, position: 0, targetSets: 4, targetRepsMin: 6, targetRepsMax: 8, notes: "Copia del plan al empezar" }],
      ...extra,
    });
    const send = (operation) => POST(new Request("http://test.invalid/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation) }));
    const operation = (workout, kind, extra = {}) => ({ id: randomUUID(), userId: workout.userId, kind, workoutId: workout.workoutId, createdAt: Date.parse(workout.performedAt) + 60_000, ...extra });
    const series = (workout, extra = {}) => operation(workout, "addSet", { workoutExerciseId: workout.exercises[0].workoutExerciseId, setId: randomUUID(), weight: 55, reps: 8, rpe: 7.5, ...extra });
    const scenario = (name, fn) => t.test(name, async () => {
      setUser(userA);
      await pool.query("truncate workouts cascade");
      await fn();
    });

    await scenario("dos entrenamientos y reenvíos conservan fechas, IDs, objetivos y RPE", async () => {
      for (let index = 0; index < 2; index++) {
        const workout = make({ performedAt: `2026-10-${20 + index}T08:00:00.000Z` });
        const add = series(workout);
        const finish = operation(workout, "finishWorkout", { createdAt: Date.parse(workout.performedAt) + 3_600_000 });
        for (const mutation of [workout, workout, add, add, finish, finish, workout, add]) assert.equal((await send(mutation)).status, 200);
        const { rows: [saved] } = await pool.query("select * from workouts where id=$1", [workout.workoutId]);
        assert.equal(saved.performed_at.toISOString(), workout.performedAt);
        assert.equal(saved.completed_at.getTime(), finish.createdAt);
        const { rows } = await pool.query("select * from workout_sets where id=$1", [add.setId]);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].completed_at.getTime(), add.createdAt);
        assert.equal(Number(rows[0].rpe), 7.5);
        const { rows: [exercise] } = await pool.query("select * from workout_exercises where id=$1", [workout.exercises[0].workoutExerciseId]);
        assert.equal(exercise.target_sets, 4);
        assert.equal(exercise.notes, "Copia del plan al empezar");
      }
      assert.equal(Number((await pool.query("select count(*) from workouts")).rows[0].count), 2);
    });

    await scenario("dos inicios concurrentes crean una sesión y devuelven el conflicto", async () => {
      const [one, two] = await Promise.all([send(make()), send(make())]);
      assert.deepEqual([one.status, two.status].sort(), [200, 409]);
      const conflict = await (one.status === 409 ? one : two).json();
      assert.equal(conflict.code, "ACTIVE_WORKOUT");
      assert.equal(conflict.workoutId, (await pool.query("select id from workouts where status='active'")).rows[0].id);
    });

    await scenario("una cookie de otra cuenta no puede recibir esta cola", async () => {
      setUser(userB);
      assert.equal((await send(make())).status, 403);
      assert.equal(Number((await pool.query("select count(*) from workouts")).rows[0].count), 0);
      setUser(null);
      assert.equal((await send(make())).status, 401);
    });

    await scenario("planes y ejercicios ajenos se rechazan antes de crear filas", async () => {
      assert.equal((await send(make({ planId: planB }))).status, 409);
      const workout = make();
      workout.exercises[0].exerciseId = exerciseB;
      assert.equal((await send(workout)).status, 409);
      assert.equal(Number((await pool.query("select count(*) from workouts")).rows[0].count), 0);
    });

    await scenario("una rutina archivada después de entrenar conserva su copia", async () => {
      await pool.query("update training_plans set archived_at=now() where id=$1", [planA]);
      assert.equal((await send(make())).status, 200);
      await pool.query("update training_plans set archived_at=null where id=$1", [planA]);
    });

    await scenario("el borrado se puede reenviar después de finalizar", async () => {
      const workout = make();
      const add = series(workout);
      const remove = operation(workout, "deleteSet", { setId: add.setId });
      for (const mutation of [workout, add, remove, operation(workout, "finishWorkout"), remove]) assert.equal((await send(mutation)).status, 200);
      assert.equal(Number((await pool.query("select count(*) from workout_sets")).rows[0].count), 0);
    });

    await scenario("una serie reutilizada con otro contenido no se confirma", async () => {
      const workout = make();
      const add = series(workout);
      await send(workout);
      await send(add);
      assert.equal((await send({ ...add, reps: 9 })).status, 409);
      assert.equal((await pool.query("select reps from workout_sets where id=$1", [add.setId])).rows[0].reps, 8);
    });

    await scenario("un cuerpo inválido no deja un entrenamiento parcial", async () => {
      const workout = make();
      workout.exercises[0].notes = "x".repeat(1001);
      assert.equal((await send(workout)).status, 400);
      assert.equal(Number((await pool.query("select count(*) from workouts")).rows[0].count), 0);
    });

    await scenario("un fallo SQL al crear ejercicios revierte también la sesión", async () => {
      await pool.query(`create function offline_test_fail() returns trigger language plpgsql as $$ begin raise exception 'fallo de prueba'; end $$;
        create trigger offline_test_fail before insert on workout_exercises for each row execute function offline_test_fail()`);
      const original = console.error;
      try {
        console.error = () => {};
        assert.equal((await send(make())).status, 500);
        assert.equal(Number((await pool.query("select count(*) from workouts")).rows[0].count), 0);
      } finally {
        console.error = original;
        await pool.query("drop trigger offline_test_fail on workout_exercises; drop function offline_test_fail()");
      }
    });

    await scenario("un UUID de ejercicio reutilizado no deja una sesión parcial", async () => {
      const first = make();
      await send(first);
      await send(operation(first, "finishWorkout"));
      const second = make({ exercises: first.exercises });
      assert.equal((await send(second)).status, 409);
      assert.equal(Number((await pool.query("select count(*) from workouts")).rows[0].count), 1);
    });

    await scenario("el snapshot conserva la unidad original de la marca anterior", async () => {
      const previous = make({ weightUnit: "lb" });
      await send(previous);
      await send(series(previous, { weight: 110 }));
      await send(operation(previous, "finishWorkout"));
      await send(make());
      const data = await (await snapshot()).json();
      assert.equal(data.workout.weightUnit, "kg");
      assert.equal(data.workout.exercises[0].previousWeightUnit, "lb");
      assert.equal(data.workout.exercises[0].previous[0].weight, 110);
    });

    await scenario("snapshot y recuperación antigua solo entregan la cuenta autenticada", async () => {
      const a = make();
      const b = make({ userId: userB, planId: planB, exercises: [{ ...a.exercises[0], workoutExerciseId: randomUUID(), exerciseId: exerciseB }] });
      await send(a);
      setUser(userB);
      await send(b);
      setUser(userA);
      const data = await (await snapshot()).json();
      assert.equal(data.userId, userA);
      assert.equal(data.workout.workoutId, a.workoutId);
      assert.equal(data.workout.trainingPlanId, planA);
      const verified = await ownership(new Request("http://test.invalid/api/offline/workout-ownership", { method: "POST", body: JSON.stringify({ workoutIds: [a.workoutId, b.workoutId] }) }));
      assert.deepEqual((await verified.json()).workoutIds, [a.workoutId]);
    });
  } finally {
    await pool?.end();
    if (started) await exec(binary("pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"]);
    await rm(modules, { recursive: true, force: true });
    await rm(directory, { recursive: true, force: true });
  }
});
