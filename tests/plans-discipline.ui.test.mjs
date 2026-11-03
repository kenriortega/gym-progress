import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import { LATEST_CHANGELOG_ID } from "./fixtures/changelog.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const pg = require("pg");
const ts = require("typescript");
const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
async function freePort() { const s = createServer(); await new Promise((r) => s.listen(0, "127.0.0.1", r)); const port = s.address().port; await new Promise((r) => s.close(r)); return port; }
async function until(check, label) { const end = Date.now() + 30000; while (Date.now() < end) { if (await check()) return; await new Promise((r) => setTimeout(r, 100)); } throw new Error(label); }

// Next, autenticación de sesión y endpoints reales con una base desechable.
await test("plantillas y programas: copia íntegra, transacción, aislamiento y consulta offline", { timeout: 180000 }, async () => {
  const directory = await mkdtemp("/private/tmp/gym-training-ui-");
  const data = join(directory, "data"), dbPort = await freePort(), appPort = await freePort();
  const bin = (name) => process.env.PG_TEST_BIN ? join(process.env.PG_TEST_BIN, name) : name;
  const origin = `http://127.0.0.1:${appPort}`;
  let started = false, pool, app, browser;
  let logs = "";
  try {
    await exec(bin("initdb"), ["-D", data, "-U", "gym_test", "-A", "trust", "--locale=C", "--encoding=UTF8"]);
    await exec(bin("pg_ctl"), ["-D", data, "-l", join(directory, "pg.log"), "-o", `-h 127.0.0.1 -p ${dbPort} -k ${directory}`, "-w", "start"]); started = true;
    const connectionString = `postgresql://gym_test@127.0.0.1:${dbPort}/postgres`;
    pool = new pg.Pool({ connectionString });
    for (const name of (await readdir(join(root, "drizzle"))).filter((name) => name.endsWith(".sql")).sort()) await pool.query(await readFile(join(root, "drizzle", name), "utf8"));
    const userId = randomUUID(), planId = randomUUID(), sessionToken = randomUUID();
    await pool.query("insert into users(id,email,name) values ($1,'ui@test.invalid','Prueba')", [userId]);
    await pool.query("insert into sessions(session_token,user_id,expires) values ($1,$2,now()+interval '1 day')", [sessionToken, userId]);
    await pool.query("insert into training_plans(id,user_id,name) values ($1,$2,'Plan de prueba')", [planId, userId]);
    app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
      cwd: root, env: { ...process.env, DATABASE_URL: connectionString, AUTH_SECRET: "isolated-training-ui-test-secret", AUTH_TRUST_HOST: "true", AUTH_URL: origin, NEXT_PUBLIC_POSTHOG_KEY: "" }, stdio: ["ignore", "pipe", "pipe"],
    });
    app.stdout.on("data", (v) => { logs = (logs + v).slice(-6000); }); app.stderr.on("data", (v) => { logs = (logs + v).slice(-6000); });
    await until(async () => { if (app.exitCode !== null) throw new Error(logs); try { return (await fetch(`${origin}/abrir`)).ok; } catch { return false; } }, "Next no arrancó");
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: "authjs.session-token", value: sessionToken, url: origin }]);
    await context.route("**/ingest/**", (route) => route.fulfill({ status: 200, json: {} }));
    let page = await context.newPage(); const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((id) => localStorage.setItem("gym-progress:novedades-vistas", id), LATEST_CHANGELOG_ID);
    await pool.query("insert into training_plans(user_id,name,discipline) values ($1,'A Calistenia','calisthenics'),($1,'B CrossFit','crossfit'),($1,'C Mixto','mixed')", [userId]);
    await page.goto(`${origin}/plans`);
    const selector = page.getByRole("combobox", { name: "Disciplina", exact: true });
    const ownPlans = page.locator("section").filter({ has: page.getByRole("heading", { name: "Tus planes", exact: true }) });
    const templates = page.locator("section").filter({ has: page.getByRole("heading", { name: "Más planes listos para copiar", exact: true }) });
    const allTemplates = await templates.locator('[data-slot="card-title"]').allTextContents();
    for (const [label, firstPlan, firstTemplate] of [
      ["Calistenia", "A Calistenia", "Calistenia · Iniciación"],
      ["CrossFit", "B CrossFit", "CrossFit · AMRAP de iniciación"],
      ["Mixto", "C Mixto", "Calistenia · Iniciación"],
      ["Musculación", "Plan de prueba", "Cuerpo completo"],
    ]) {
      await selector.click();
      await page.getByRole("option", { name: label, exact: true }).click();
      assert.equal(await ownPlans.locator("h3").first().textContent(), firstPlan);
      assert.equal(await templates.locator('[data-slot="card-title"]').first().textContent(), firstTemplate);
      assert.equal(await ownPlans.locator("h3").count(), 4);
      assert.equal(await templates.locator('[data-slot="card-title"]').count(), allTemplates.length);
      const headings = await page.locator("h2").allTextContents();
      assert.equal(headings.indexOf("Elige un programa completo") < headings.indexOf("Más planes listos para copiar"), label === "Musculación");
      assert.equal(await page.locator('input[name="discipline"]').inputValue(), { Calistenia: "calisthenics", CrossFit: "crossfit", Mixto: "mixed", Musculación: "strength" }[label]);
    }
    assert.deepEqual(await ownPlans.locator("h3").allTextContents(), ["Plan de prueba", "A Calistenia", "B CrossFit", "C Mixto"]);
    await selector.click();
    await page.getByRole("option", { name: "CrossFit", exact: true }).click();
    assert.deepEqual(await ownPlans.locator("h3").allTextContents(), ["B CrossFit", "A Calistenia", "C Mixto", "Plan de prueba"]);
    assert.deepEqual((await templates.locator('[data-slot="card-title"]').allTextContents()).slice(0, 4), ["CrossFit · AMRAP de iniciación", "CrossFit · EMOM en gimnasio", "CrossFit · Circuito por tiempo", "AMRAP editable"]);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await templates.locator("h2").evaluate((element) => element.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: `/tmp/gym-plans-discipline-${width}-viewport.png` });
      await page.screenshot({ path: `/tmp/gym-plans-discipline-${width}.png`, fullPage: true });
    }
    for (const [name, discipline, exerciseCount, format] of [
      ["Calistenia · Iniciación", "calisthenics", 4, null],
      ["Calistenia · Torso y control", "calisthenics", 4, null],
      ["Calistenia · Piernas y core", "calisthenics", 4, null],
      ["CrossFit · AMRAP de iniciación", "crossfit", 3, "amrap"],
      ["CrossFit · EMOM en gimnasio", "crossfit", 2, "emom"],
      ["CrossFit · Circuito por tiempo", "crossfit", 3, "for-time"],
    ]) {
      await page.goto(`${origin}/plans`);
      const card = page.locator('[data-slot="card"]').filter({ has: page.getByText(name, { exact: true }) });
      await card.getByRole("button", { name: "Usar este plan", exact: true }).click();
      await page.waitForURL(/\/plans\/[^/]+$/);
      const plan = (await pool.query("select * from training_plans where user_id=$1 and name=$2", [userId, name])).rows[0];
      assert.equal(plan.discipline, discipline);
      assert.equal(Number((await pool.query("select count(*) from training_plan_exercises where plan_id=$1", [plan.id])).rows[0].count), exerciseCount);
      if (format) {
        assert.equal(plan.blocks[0].format, format);
        assert.equal(plan.blocks[0].exerciseIds.length, exerciseCount);
        assert.ok(plan.blocks[0].prescription.includes("Calienta"));
      } else assert.ok(plan.description.includes("Descansa"));
      if (name.endsWith("Iniciación")) {
        const metric = (await pool.query("select measurement,target_seconds from training_plan_exercises where plan_id=$1 and measurement='time'", [plan.id])).rows[0];
        assert.equal(metric.target_seconds, 20);
      }
    }
    const programSource = ts.transpileModule(await readFile(join(root, "src/lib/program-templates.ts"), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const { PROGRAM_TEMPLATES } = await import(`data:text/javascript;base64,${Buffer.from(programSource).toString("base64")}`);
    const baseProgram = PROGRAM_TEMPLATES[0];
    const programSessionCount = PROGRAM_TEMPLATES.reduce((total, program) => total + program.sessions.length, 0);
    const countPlans = async () => Number((await pool.query("select count(*) from training_plans where user_id=$1", [userId])).rows[0].count);
    const before = await countPlans();
    await page.goto(`${origin}/plans/programs/${baseProgram.id}`);
    assert.equal(await countPlans(), before, "consultar no incorpora sesiones");
    await page.getByRole("main").locator('input[name="programId"]').evaluate((input) => { input.value = "no-existe"; });
    await page.getByRole("button", { name: "Añadir programa completo", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Ese programa no existe" }).waitFor();
    assert.equal(await countPlans(), before);

    const privateCount = async () => Number((await pool.query("select count(*) from exercises where user_id=$1", [userId])).rows[0].count);
    const beforeExercises = await privateCount();
    await pool.query(`create function reject_program_session() returns trigger language plpgsql as $$ begin
      if new.name like 'Base ·%' and new.weekday=5 then raise exception 'fallo de prueba en última sesión'; end if;
      return new; end $$;
      create trigger reject_program_session before insert on training_plans for each row execute function reject_program_session();`);
    await page.goto(`${origin}/plans/programs/${baseProgram.id}`);
    await page.getByRole("button", { name: "Añadir programa completo", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "No se guardó ninguna sesión" }).waitFor();
    assert.equal(await countPlans(), before, "fallo final revierte todas las sesiones");
    assert.equal(await privateCount(), beforeExercises, "también revierte los ejercicios nuevos");
    await pool.query("drop trigger reject_program_session on training_plans; drop function reject_program_session()");

    const otherUser = randomUUID(), otherToken = randomUUID();
    await pool.query("insert into users(id,email) values ($1,'other@test.invalid')", [otherUser]);
    await pool.query("insert into sessions(session_token,user_id,expires) values ($1,$2,now()+interval '1 day')", [otherToken, otherUser]);
    const foreignExercise = (await pool.query("insert into exercises(user_id,name,muscle_group) values ($1,'Step up','Glúteos') returning id", [otherUser])).rows[0].id;
    const privateHip = (await pool.query("insert into exercises(user_id,name,muscle_group) values ($1,'Hip thrust','Otros') returning id", [userId])).rows[0].id;

    for (const program of PROGRAM_TEMPLATES) {
      await page.goto(`${origin}/plans/programs/${program.id}`);
      await page.getByRole("heading", { name: program.name, exact: true }).waitFor();
      assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
      await page.getByText(program.audience === "Para mujeres" ? "Mujeres" : "General", { exact: true }).filter({ visible: true }).waitFor();
      assert.doesNotMatch(await page.locator("main").filter({ visible: true }).innerText(), /fit\s?generation|\bPDF\b/i);
      assert.equal(await page.getByRole("link", { name: program.source.title, exact: true }).count(), 0);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: `/tmp/gym-program-${program.id}-${width}.png`, fullPage: true });
      }
      await page.getByRole("button", { name: "Añadir programa completo", exact: true }).click();
      await page.waitForURL(`${origin}/plans`);
      const offline = await (await context.request.get(`${origin}/api/offline/plans`)).json();
      for (const session of program.sessions) {
        const plan = offline.plans.find((item) => item.name === `${program.name} · ${session.name}`);
        assert.ok(plan, session.name);
        assert.equal(plan.weekday, session.weekday);
        assert.match(plan.description, /Calienta/);
        assert.match(plan.description, /dos sesiones/);
        assert.doesNotMatch(plan.description, /fit\s?generation|\bPDF\b/i);
        assert.equal(plan.exercises.length, session.exercises.length);
        for (const [index, exercise] of session.exercises.entries()) {
          const copied = plan.exercises[index];
          assert.equal(copied.name, exercise.name);
          assert.equal(copied.position, index);
          assert.equal(copied.targetSets, exercise.sets);
          assert.equal(copied.targetRepsMin, exercise.measurement === "time" ? null : exercise.repsMin);
          assert.equal(copied.targetRepsMax, exercise.measurement === "time" ? null : exercise.repsMax);
          assert.equal(copied.measurement, exercise.measurement ?? "reps");
          assert.equal(copied.targetSeconds, exercise.targetSeconds ?? null);
          assert.equal(copied.notes, exercise.notes);
          assert.notEqual(copied.exerciseId, foreignExercise);
          if (exercise.name === "Hip thrust") assert.notEqual(copied.exerciseId, privateHip);
        }
      }
    }
    assert.equal(await countPlans(), before + programSessionCount);
    await page.goto(`${origin}/plans`);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("heading", { name: "Elige un programa completo", exact: true }).evaluate((element) => element.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: `/tmp/gym-programs-list-${width}.png` });
    }
    const copiedPlan = (await pool.query("select id from training_plans where user_id=$1 and name=$2", [userId, `${baseProgram.name} · Completo A`])).rows[0];
    await page.goto(`${origin}/plans/${copiedPlan.id}`);
    await page.getByText(baseProgram.sessions[0].exercises[0].notes, { exact: true }).filter({ visible: true }).waitFor();
    await page.getByRole("button", { name: "Editar nombre y día", exact: true }).click();
    const description = page.getByRole("textbox", { name: "Nota", exact: true });
    const originalDescription = await description.inputValue();
    assert.ok(originalDescription.length > 500);
    await description.fill(`${originalDescription}\nNota personal de prueba.`);
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await until(async () => (await pool.query("select description from training_plans where id=$1", [copiedPlan.id])).rows[0].description.endsWith("Nota personal de prueba."), "editar sin recortar las indicaciones");
    await page.goto(`${origin}/plans/programs/${baseProgram.id}`);
    await page.getByRole("button", { name: "Añadir programa completo", exact: true }).click();
    await page.waitForURL(`${origin}/plans`);
    assert.equal(await countPlans(), before + programSessionCount + baseProgram.sessions.length, "una segunda copia conserva las anteriores");
    const repeated = (await pool.query("select name from training_plans where user_id=$1 and name like 'Base · Glúteos y cuerpo completo 2 ·%'", [userId])).rows;
    assert.equal(repeated.length, 3);
    await until(async () => page.evaluate(({ userId, expected }) => new Promise((resolve, reject) => {
      const request = indexedDB.open("gym-progress");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("planes")) { db.close(); resolve(false); return; }
        const tx = db.transaction("planes", "readonly");
        const saved = tx.objectStore("planes").get(userId);
        saved.onsuccess = () => resolve(saved.result?.data.plans.length === expected);
        saved.onerror = () => reject(saved.error);
        tx.oncomplete = () => db.close();
      };
    }), { userId, expected: before + programSessionCount + baseProgram.sessions.length }), "descarga automática de todas las sesiones");
    await page.goto(`${origin}/planes-guardados`);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    const savedSession = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: `${baseProgram.name} · Completo A` }) });
    if (!await savedSession.evaluate((element) => element.open)) await savedSession.locator("summary").click();
    await savedSession.getByText(baseProgram.sessions[0].exercises[0].notes, { exact: true }).waitFor();
    assert.equal(await savedSession.locator("h3").count(), baseProgram.sessions[0].exercises.length);
    await context.setOffline(false);

    // Programación PDF: consultar no copia; el microciclo se congela al empezar.
    const pdfTemplate = PROGRAM_TEMPLATES.find((program) => program.id === "equilibrio-torso-pierna-4-dias");
    const beforePdf = await countPlans();
    await page.goto(`${origin}/plans/programs/${pdfTemplate.id}?version=pdf&microcycle=3`);
    await page.getByText("Programa de 8 microciclos · Microciclo 3 de 8", { exact: true }).filter({ visible: true }).waitFor();
    assert.doesNotMatch(await page.locator("main").filter({ visible: true }).innerText(), /fit\s?generation|\bPDF\b/i);
    assert.equal(await countPlans(), beforePdf);
    const prescribed = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: "Microciclo 3 · Objetivos por serie" }) }).filter({ visible: true }).first();
    await prescribed.locator("summary").click();
    await prescribed.getByText("6–8 reps · RIR 2", { exact: false }).waitFor();
    await prescribed.screenshot({ path: "/tmp/gym-pdf-prescribed-sets.png" });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `/tmp/gym-pdf-preview-${width}.png`, fullPage: true });
    }
    await page.getByRole("button", { name: "Añadir programa completo", exact: true }).click();
    await page.waitForURL(`${origin}/plans`);
    assert.equal(await countPlans(), beforePdf + 4);
    const pdfPlans = (await pool.query("select * from training_plans where user_id=$1 and program_cycle is not null order by (program_cycle->>'sessionIndex')::int", [userId])).rows;
    assert.equal(pdfPlans.length, 4);
    for (const plan of pdfPlans) assert.doesNotMatch(plan.description, /fit\s?generation|\bPDF\b/i);
    await page.goto(`${origin}/plans/${pdfPlans[0].id}`);
    await page.getByRole("button", { name: "Empezar este entrenamiento", exact: true }).click();
    await page.waitForURL(`${origin}/entreno`);
    await until(async () => (await pool.query("select id from workouts where user_id=$1 and status='active'", [userId])).rowCount === 1, "sincronizar inicio PDF");
    const workoutId = (await pool.query("select id from workouts where user_id=$1 and status='active'", [userId])).rows[0].id;
    const editor = await context.newPage();
    editor.on("pageerror", (error) => errors.push(error.message));
    await editor.goto(`${origin}/plans/${pdfPlans[0].id}`);
    const cycleForm = editor.getByRole("region", { name: "Programa de 8 microciclos", exact: true });
    await cycleForm.locator('select[name="microcycle"]').selectOption("6");
    await cycleForm.getByRole("button", { name: "Aplicar a esta copia", exact: true }).click();
    await until(async () => Number((await pool.query("select count(*) from training_plans where user_id=$1 and program_cycle->>'microcycle'='6'", [userId])).rows[0].count) === 4, "cambiar el ciclo de las cuatro sesiones");
    await editor.waitForFunction(({ userId, planId }) => new Promise((resolve) => {
      const request = indexedDB.open("gym-progress");
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction("planes", "readonly").objectStore("planes").get(userId);
        read.onsuccess = () => {
          const plan = read.result?.data.plans.find((item) => item.id === planId);
          resolve(!!plan?.exercises.length && plan.exercises.every((exercise) => exercise.prescription?.microcycle === 6));
          db.close();
        };
      };
    }), { userId, planId: pdfPlans[0].id });
    await editor.screenshot({ path: "/tmp/gym-pdf-cycle-editor.png", fullPage: true });
    await editor.close();
    await context.setOffline(true);
    await page.reload();
    const firstPdf = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: "Press w/ mancuernas, banco a 15º", exact: true }) });
    await firstPdf.getByText("Siguiente · Serie 1: 6–8 reps · RIR 2", { exact: true }).waitFor();
    await firstPdf.getByLabel("PESO KG", { exact: true }).fill("50");
    await firstPdf.getByLabel("REPS", { exact: true }).fill("6");
    await firstPdf.getByRole("button", { name: "Registrar serie", exact: true }).click();
    await firstPdf.getByText("Siguiente · Serie 2: 10–12 reps · RIR 2", { exact: true }).waitFor();
    await firstPdf.screenshot({ path: "/tmp/gym-pdf-first-exercise.png" });
    await page.screenshot({ path: "/tmp/gym-pdf-training-offline.png", fullPage: true });
    await page.getByRole("button", { name: "Finalizar sesión", exact: true }).click();
    await page.getByRole("button", { name: "Sí, continuar", exact: true }).click();
    await page.getByText("Entrenamiento finalizado en este dispositivo", { exact: true }).waitFor();
    await context.setOffline(false);
    await until(async () => (await pool.query("select status from workouts where id=$1", [workoutId])).rows[0].status === "completed", "sincronizar el entrenamiento PDF finalizado");
    assert.equal((await pool.query("select prescription from workout_exercises where workout_id=$1 order by position", [workoutId])).rows[0].prescription.microcycle, 3);
    await page.goto(`${origin}/history/${workoutId}`);
    await page.getByText("Microciclo 3 · Objetivos por serie", { exact: true }).filter({ visible: true }).first().waitFor();

    const otherContext = await browser.newContext();
    await otherContext.addCookies([{ name: "authjs.session-token", value: otherToken, url: origin }]);
    const isolated = await (await otherContext.request.get(`${origin}/api/offline/plans`)).json();
    assert.deepEqual(isolated.plans, []);
    await otherContext.close();
    const anonymous = await browser.newContext();
    assert.equal((await anonymous.request.get(`${origin}/api/offline/plans`)).status(), 401);
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto(`${origin}/plans/programs/${baseProgram.id}`);
    assert.equal(new URL(anonymousPage.url()).pathname, "/login");
    await anonymous.close();
    assert.deepEqual(errors, []);
  } catch (error) {
    const page = browser?.contexts()[0]?.pages().at(-1);
    if (page && !page.isClosed()) {
      await page.screenshot({ path: "/tmp/gym-training-ui-failure.png", fullPage: true }).catch(() => {});
      console.error(await page.locator("body").innerText().catch(() => "Sin página"));
    }
    console.error(logs); throw error;
  }
  finally {
    await browser?.close();
    if (app && app.exitCode === null) { app.kill("SIGTERM"); await new Promise((r) => app.once("exit", r)); }
    await pool?.end(); if (started) await exec(bin("pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"]);
    await rm(directory, { recursive: true, force: true });
  }
});
