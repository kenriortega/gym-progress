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

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const pg = require("pg");
const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function until(check, label) {
  const end = Date.now() + 30_000;
  while (Date.now() < end) { if (await check()) return; await new Promise((resolve) => setTimeout(resolve, 100)); }
  throw new Error(label);
}

test("preferencias independientes, detalle sin copiar y consulta kg/lb sin alterar series", { timeout: 150_000 }, async () => {
  const directory = await mkdtemp("/private/tmp/gym-units-ui-");
  const data = join(directory, "data"), dbPort = await freePort(), appPort = await freePort();
  const bin = (name) => process.env.PG_TEST_BIN ? join(process.env.PG_TEST_BIN, name) : name;
  const origin = `http://127.0.0.1:${appPort}`;
  let started = false, pool, app, browser, page;
  let logs = "";
  try {
    await exec(bin("initdb"), ["-D", data, "-U", "gym_test", "-A", "trust", "--locale=C", "--encoding=UTF8"]);
    await exec(bin("pg_ctl"), ["-D", data, "-l", join(directory, "pg.log"), "-o", `-h 127.0.0.1 -p ${dbPort} -k ${directory}`, "-w", "start"]); started = true;
    const connectionString = `postgresql://gym_test@127.0.0.1:${dbPort}/postgres`;
    pool = new pg.Pool({ connectionString });
    for (const name of (await readdir(join(root, "drizzle"))).filter((name) => name.endsWith(".sql")).sort()) await pool.query(await readFile(join(root, "drizzle", name), "utf8"));
    const userId = randomUUID(), workoutId = randomUUID(), exerciseInstance = randomUUID(), sessionToken = randomUUID();
    await pool.query("insert into users(id,email,name,goal_weight) values ($1,'units@test.invalid','Prueba',75)", [userId]);
    assert.deepEqual((await pool.query("select preferred_body_system, preferred_weight_unit from users where id=$1", [userId])).rows[0], { preferred_body_system: "metric", preferred_weight_unit: "kg" });
    await pool.query("insert into sessions(session_token,user_id,expires) values ($1,$2,now()+interval '1 day')", [sessionToken, userId]);
    await pool.query("insert into body_weights(user_id,measured_on,weight) values ($1,current_date,80)", [userId]);
    const exerciseId = (await pool.query("select id from exercises where user_id is null order by name limit 1")).rows[0].id;
    await pool.query("insert into workouts(id,user_id,weight_unit) values ($1,$2,'kg')", [workoutId, userId]);
    await pool.query("insert into workout_exercises(id,workout_id,exercise_id,position,target_sets,target_reps_min,target_reps_max) values ($1,$2,$3,0,3,8,12)", [exerciseInstance, workoutId, exerciseId]);
    await pool.query("insert into workout_sets(workout_exercise_id,position,reps,weight) values ($1,0,10,20)", [exerciseInstance]);
    const completedIds = [];
    for (const [unit, weight] of [["kg", 20], ["lb", 100], ["kg", 60]]) {
      const id = randomUUID(), instance = randomUUID();
      completedIds.push(id);
      await pool.query("insert into workouts(id,user_id,weight_unit,status,completed_at) values ($1,$2,$3,'completed',now())", [id, userId, unit]);
      await pool.query("insert into workout_exercises(id,workout_id,exercise_id,position) values ($1,$2,$3,0)", [instance, id, exerciseId]);
      await pool.query("insert into workout_sets(workout_exercise_id,position,reps,weight) values ($1,0,10,$2)", [instance, weight]);
    }
    const originals = (await pool.query("select id,weight from workout_sets order by id")).rows;
    app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
      cwd: root, env: { ...process.env, DATABASE_URL: connectionString, AUTH_SECRET: "isolated-units-ui-test-secret", AUTH_TRUST_HOST: "true", AUTH_URL: origin, NEXT_PUBLIC_POSTHOG_KEY: "" }, stdio: ["ignore", "pipe", "pipe"],
    });
    app.stdout.on("data", (value) => { logs = (logs + value).slice(-6000); });
    app.stderr.on("data", (value) => { logs = (logs + value).slice(-6000); });
    await until(async () => { if (app.exitCode !== null) throw new Error(logs); try { return (await fetch(`${origin}/abrir`)).ok; } catch { return false; } }, "Next no arrancó");
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
    await context.addCookies([{ name: "authjs.session-token", value: sessionToken, url: origin }]);
    await context.addInitScript(() => localStorage.setItem("gym-progress:novedades-vistas", "2026-10-26-unidades-y-detalles"));
    await context.route("**/ingest/**", (route) => route.fulfill({ status: 200, json: {} }));
    page = await context.newPage(); const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/plans`);
    await page.getByRole("link", { name: "Ver detalle", exact: true }).first().click();
    await page.getByRole("heading", { name: "Ejercicios y objetivos", exact: true }).waitFor();
    assert.equal(Number((await pool.query("select count(*) from training_plans where user_id=$1", [userId])).rows[0].count), 0);
    await page.screenshot({ path: "/tmp/gym-units-template-mobile.png", fullPage: true, animations: "disabled" });
    await page.goto(`${origin}/ajustes`);
    async function select(name, option) {
      await page.getByRole("combobox", { name, exact: true }).click();
      await page.getByRole("option", { name: option, exact: true }).click();
    }
    async function savePreferences(body, training) {
      await select("Medidas corporales", body);
      await select("Pesos de entrenamiento", training);
      await page.locator("form").filter({ has: page.getByRole("combobox", { name: "Medidas corporales", exact: true }) }).getByRole("button", { name: "Guardar", exact: true }).click();
    }
    await savePreferences("Métrico (kg)", "Libras (lb)");
    await until(async () => (await pool.query("select preferred_weight_unit from users where id=$1", [userId])).rows[0].preferred_weight_unit === "lb", "No se guardó lb");
    await page.goto(origin);
    await page.getByText("80 kg", { exact: true }).waitFor();
    await page.goto(`${origin}/entreno`);
    await until(async () => await page.getByRole("button", { name: "lb", exact: true }).getAttribute("aria-pressed") === "true", "La sesión no usa la preferencia lb para consulta");
    assert.equal(await page.getByRole("spinbutton", { name: "PESO KG", exact: true }).inputValue(), "20");
    await page.goto(`${origin}/exercises/${exerciseId}`);
    await page.getByRole("button", { name: "lb", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "lb", exact: true }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Ambas", exact: true }).click();
    await page.getByText("132,28 lb · 60 kg", { exact: true }).first().waitFor();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise((resolve) => { window.scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
      assert.equal(await page.getByRole("main").count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Sin desbordamiento en ${width}`);
      await page.screenshot({ path: `/tmp/gym-units-detail-${width}.png`, fullPage: true, animations: "disabled" });
    }
    await page.goto(`${origin}/history/${completedIds[0]}`);
    await page.getByText("44,09 lb × 10", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Ambas", exact: true }).click();
    await page.getByText("44,09 lb · 20 kg × 10", { exact: true }).waitFor();
    await page.screenshot({ path: "/tmp/gym-units-history.png", fullPage: true, animations: "disabled" });
    await page.goto(`${origin}/workout/${workoutId}`);
    await page.getByText("44,09 lb × 10", { exact: true }).first().waitFor();
    assert.equal(await page.getByRole("button", { name: "lb", exact: true }).getAttribute("aria-pressed"), "true");
    await page.goto(`${origin}/progress`);
    await page.getByText("132,28 lb", { exact: true }).first().waitFor();
    await page.goto(`${origin}/ajustes`);
    await savePreferences("Imperial (lb)", "Kilos (kg)");
    await until(async () => (await pool.query("select preferred_body_system from users where id=$1", [userId])).rows[0].preferred_body_system === "imperial", "No se guardó imperial");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("spinbutton", { name: "Objetivo de peso en lb", exact: true }).waitFor();
    for (const name of ["Medidas corporales", "Pesos de entrenamiento"]) {
      const bounds = await page.getByRole("combobox", { name, exact: true }).boundingBox();
      assert.ok(bounds.height >= 44, `${name}: objetivo táctil suficiente`);
    }
    const goalForm = page.locator("form").filter({ has: page.getByRole("spinbutton", { name: "Objetivo de peso en lb", exact: true }) });
    // El límite inferior convertido no debe impedir guardar una meta existente.
    await goalForm.getByRole("spinbutton").fill("44.09");
    await goalForm.getByRole("button", { name: "Guardar", exact: true }).click();
    await until(async () => Number((await pool.query("select goal_weight from users where id=$1", [userId])).rows[0].goal_weight) === 20, "Meta límite en lb incorrecta");
    await goalForm.getByRole("spinbutton").fill("165.35");
    await goalForm.getByRole("button", { name: "Guardar", exact: true }).click();
    await until(async () => Number((await pool.query("select goal_weight from users where id=$1", [userId])).rows[0].goal_weight) === 75, "Meta en lb incorrecta");
    await page.screenshot({ path: "/tmp/gym-units-settings.png", fullPage: true, animations: "disabled" });
    await page.goto(origin);
    await page.getByText("176,37 lb", { exact: true }).first().waitFor();
    await page.getByRole("spinbutton", { name: "Peso de hoy en lb", exact: true }).fill("176.37");
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await until(async () => Number((await pool.query("select weight from body_weights where user_id=$1 and measured_on=current_date", [userId])).rows[0].weight) === 80, "Peso corporal incorrecto");
    await page.goto(`${origin}/entreno`);
    await page.getByRole("button", { name: "Ambas", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "kg", exact: true }).getAttribute("aria-pressed"), "true");
    for (let i = 0; i < 6; i++) {
      await page.getByRole("button", { name: "lb", exact: true }).click();
      await page.getByRole("button", { name: "kg", exact: true }).click();
    }
    await page.getByRole("button", { name: "Ambas", exact: true }).click();
    await page.getByText("20 kg · 44,09 lb × 10", { exact: true }).waitFor();
    assert.equal(await page.getByRole("spinbutton", { name: "PESO KG", exact: true }).inputValue(), "20");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await until(async () => page.evaluate(() => !!navigator.serviceWorker.controller), "Service worker no controla la página");
    await context.setOffline(true);
    await page.reload();
    await page.getByText("20 kg · 44,09 lb × 10", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Ambas", exact: true }).getAttribute("aria-pressed"), "true");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "/tmp/gym-units-training-offline.png", fullPage: true, animations: "disabled" });
    assert.deepEqual((await pool.query("select id,weight from workout_sets order by id")).rows, originals);
    assert.deepEqual((await pool.query("select preferred_body_system, preferred_weight_unit from users where id=$1", [userId])).rows[0], { preferred_body_system: "imperial", preferred_weight_unit: "kg" });
    assert.deepEqual(errors, []);
  } catch (error) {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: "/tmp/gym-units-ui-failure.png", fullPage: true, animations: "disabled" }).catch(() => {});
      console.error(await page.locator("body").innerText().catch(() => "Sin página"));
    }
    console.error(logs); throw error;
  } finally {
    await browser?.close();
    if (app && app.exitCode === null) { app.kill("SIGTERM"); await new Promise((resolve) => app.once("exit", resolve)); }
    await pool?.end();
    if (started) await exec(bin("pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"]);
    await rm(directory, { recursive: true, force: true });
  }
});
