import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const [file, modulePath] of [
  ["index.html", "./assets/js/survey-app.js"],
  ["admin.html", "./assets/js/admin-app.js"],
]) {
  test(`${file} is a static module entry point`, async () => {
    const html = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");

    assert.match(html, /<!doctype html>/i);
    assert.match(html, new RegExp(`type=["']module["'][^>]+${modulePath.replaceAll(".", "\\.")}`));
  });
}
