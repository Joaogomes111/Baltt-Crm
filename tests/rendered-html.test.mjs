import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function readBuiltScript() {
  const assetsDir = new URL("../dist/assets/", import.meta.url);
  const files = await readdir(assetsDir);
  const jsFile = files.find((file) => file.endsWith(".js"));

  assert.ok(jsFile, "Expected a built JavaScript asset");

  return readFile(new URL(`../dist/assets/${jsFile}`, import.meta.url), "utf8");
}

test("builds the Baltt CRM shell for Vercel", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const script = await readBuiltScript();

  assert.match(html, /<title>Baltt CRM Comercial<\/title>/i);
  assert.match(html, /\/assets\/.*\.js/);
  assert.match(script, /CRM Comercial/);
  assert.match(script, /Entrar no CRM Baltt/);
  assert.match(script, /Funil por empresa/);
  assert.match(script, /Novo WhatsApp/);
  assert.match(script, /Investimento/);
  assert.match(script, /Baltt@/);
});
