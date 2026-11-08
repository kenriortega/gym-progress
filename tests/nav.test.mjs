import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = new URL("../", import.meta.url);
const source = ts.transpileModule(await readFile(new URL("src/lib/nav.ts", root), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { navActive, navHidden, NAV_EXCLUDED } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

test("cada sección se marca en sus propias pantallas y en las que cuelgan de ella", () => {
  assert.equal(navActive("/plans", "/plans"), true);
  assert.equal(navActive("/plans/a9950f60", "/plans"), true);
  assert.equal(navActive("/plans/programs/brazos", "/plans"), true);
  assert.equal(navActive("/progress", "/progress"), true);
  assert.equal(navActive("/entreno", "/entreno"), true);
});

test("inicio no se marca en todas las rutas por empezar con barra", () => {
  assert.equal(navActive("/", "/"), true);
  assert.equal(navActive("/plans", "/"), false);
  assert.equal(navActive("/progress", "/"), false);
  assert.equal(navActive("/exercises/abc", "/"), false);
});

test("un prefijo compartido no marca la sección vecina", () => {
  // "/planes-guardados" empieza por "/plan", pero no cuelga de "/plans".
  assert.equal(navActive("/planes-guardados", "/plans"), false);
  assert.equal(navActive("/progressivo", "/progress"), false);
});

test("las pantallas sin a dónde ir no llevan barra", () => {
  for (const pathname of NAV_EXCLUDED) assert.equal(navHidden(pathname), true);
  assert.equal(navHidden("/login"), true);
  assert.equal(navHidden("/offline"), true);
});

test("las pantallas de la aplicación sí la llevan", () => {
  for (const pathname of ["/", "/plans", "/progress", "/entreno", "/history", "/exercises/abc", "/ajustes"]) {
    assert.equal(navHidden(pathname), false, pathname);
  }
});

test("ninguna sección de la barra está en la lista de excluidas", () => {
  for (const href of ["/", "/entreno", "/plans", "/progress"]) {
    assert.equal(navHidden(href), false, `${href} no puede ocultar su propia barra`);
  }
});
