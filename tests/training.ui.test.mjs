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
async function freePort() { const s = createServer(); await new Promise((r) => s.listen(0, "127.0.0.1", r)); const port = s.address().port; await new Promise((r) => s.close(r)); return port; }
async function until(check, label) { const end = Date.now() + 30000; while (Date.now() < end) { if (await check()) return; await new Promise((r) => setTimeout(r, 100)); } throw new Error(label); }

// Next, autenticación de sesión y endpoints reales con una base desechable.
await test("planes, bloques y WOD en la app real con PostgreSQL aislado", { timeout: 120000 }, async () => {
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
    await page.goto(`${origin}/plans/${planId}`);
    await page.getByRole("heading", { name: "Plan de prueba", exact: true }).waitFor();
    // Crear un ejercicio por tiempo mediante el formulario real.
    const add = page.locator('form').filter({ has: page.getByRole("button", { name: "Añadir al plan", exact: true }) });
    await add.getByRole("combobox", { name: "Ejercicio", exact: true }).fill("Plancha abdominal");
    await page.getByRole("option", { name: "Plancha abdominal", exact: true }).click();
    await add.getByLabel("Registrar por", { exact: true }).selectOption("time");
    await add.getByLabel("Tipo de carga", { exact: true }).selectOption("bodyweight");
    await add.getByLabel("Segundos por serie", { exact: true }).fill("30");
    await add.getByRole("button", { name: "Añadir al plan", exact: true }).click();
    await until(async () => Number((await pool.query("select count(*) from training_plan_exercises where plan_id=$1", [planId])).rows[0].count) === 1, "No se creó el ejercicio");
    await page.reload();
    await page.locator("summary:visible").filter({ hasText: "Añadir bloque" }).click();
    const blockForm = page.locator('form').filter({ has: page.getByRole("button", { name: "Añadir bloque", exact: true }) });
    await blockForm.getByLabel("Nombre del bloque", { exact: true }).fill("Circuito de prueba");
    await blockForm.getByLabel("Rondas", { exact: true }).fill("2");
    await blockForm.getByRole("checkbox", { name: "Plancha abdominal", exact: true }).check();
    await blockForm.getByRole("button", { name: "Añadir bloque", exact: true }).click();
    await until(async () => (await pool.query("select blocks from training_plans where id=$1", [planId])).rows[0].blocks.length === 1, "No se creó el bloque");
    await page.reload();
    await page.screenshot({ path: "/tmp/gym-plan-blocks-mobile.png", fullPage: true });
    const scenarios = ["circuit", "amrap", "for-time", "emom"];
    for (const format of scenarios) {
      const row = (await pool.query("select blocks from training_plans where id=$1", [planId])).rows[0].blocks[0];
      const block = { ...row, name: `Prueba ${format}`, format, rounds: ["circuit", "for-time"].includes(format) ? 2 : null, durationSeconds: ["amrap", "emom"].includes(format) ? 600 : null, intervalSeconds: format === "emom" ? 60 : null, timeCapSeconds: format === "for-time" ? 900 : null };
      await pool.query("update training_plans set blocks=$2 where id=$1", [planId, JSON.stringify([block])]);
      await page.goto(`${origin}/planes-guardados`);
      await page.getByRole("button", { name: "Actualizar planes", exact: true }).click();
      await page.locator('summary:visible').filter({ hasText: "Plan de prueba" }).click();
      await page.getByText(block.name, { exact: false }).first().waitFor();
      await context.setOffline(true);
      await page.getByRole("button", { name: "Empezar Plan de prueba", exact: true }).click();
      const region = page.getByRole("region", { name: `Bloque ${block.name}`, exact: true });
      await region.waitFor();
      await region.getByRole("button", { name: "Iniciar cronómetro", exact: true }).click();
      if (format === "circuit" || format === "amrap") {
        await region.getByRole("button", { name: "Completar ronda", exact: true }).click();
        await region.getByRole("button", { name: "Completar ronda", exact: true }).click();
        await region.getByLabel("Rondas completadas", { exact: true }).fill("2");
      }
      if (format === "for-time") await region.getByLabel("Tiempo final (segundos)", { exact: true }).fill("120");
      if (format === "emom") await region.getByLabel("Intervalos completados", { exact: true }).fill("10");
      await region.getByRole("button", { name: "Guardar resultado", exact: true }).click();
      await region.getByText("Guardado:", { exact: false }).waitFor();
      await page.close(); page = await context.newPage(); page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/abrir`);
      await page.getByRole("region", { name: `Bloque ${block.name}`, exact: true }).getByText("Guardado:", { exact: false }).waitFor();
      if (format === "emom") {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: "/tmp/gym-emom-mobile.png", fullPage: true, animations: "disabled" });
        await page.setViewportSize({ width: 1440, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.evaluate(() => new Promise((resolve) => { window.scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
        assert.equal(await page.getByRole("main").count(), 1);
        await page.screenshot({ path: "/tmp/gym-emom-desktop.png", fullPage: true, animations: "disabled" });
      }
      await page.getByRole("button", { name: "Finalizar sesión", exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Sí, continuar", exact: true }).click();
      await context.setOffline(false);
      await until(async () => Number((await pool.query("select count(*) from workouts where user_id=$1 and status='completed'", [userId])).rows[0].count) === scenarios.indexOf(format) + 1, "No se sincronizó el bloque");
      await page.getByText("Cambios sincronizados", { exact: true }).waitFor();
    }
    const completed = (await pool.query("select id from workouts where user_id=$1 order by performed_at desc limit 1", [userId])).rows[0].id;
    await page.goto(`${origin}/history/${completed}`);
    await page.getByText("10 intervalos · Según plan", { exact: true }).waitFor();
    await page.goto(`${origin}/progress`);
    await page.getByRole("region", { name: "Progreso de circuitos y WOD", exact: true }).waitFor();
    await page.screenshot({ path: "/tmp/gym-wod-progress-desktop.png", fullPage: true });
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
