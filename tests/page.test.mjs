import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { html, executableScripts } from './harness.mjs';

test('every inline script compiles', () => {
  const scripts = executableScripts();
  assert.ok(scripts.length >= 2);
  for (const { attrs, code } of scripts) {
    assert.doesNotThrow(() => new vm.Script(code), `script ${attrs} has a syntax error`);
  }
});

test('the page is fully standalone: no external scripts, styles, fonts, or images', () => {
  const external = html.match(/\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+/gi) ?? [];
  assert.deepEqual(external, []);
  assert.doesNotMatch(html, /@import|url\(\s*["']?(?:https?:)?\/\//i);
});

test('every element the UI looks up by id exists in the markup', () => {
  const ui = executableScripts().map((s) => s.code).join('\n');
  const ids = [...ui.matchAll(/\bbyId\('([\w-]+)'\)/g)].map((m) => m[1]);
  assert.ok(ids.length > 10, 'expected the UI to use byId() for element lookups');
  const missing = [...new Set(ids)].filter((id) => !html.includes(`id="${id}"`));
  assert.deepEqual(missing, []);
});

test('has a title and a mobile viewport', () => {
  assert.match(html, /<title>Techdebtris<\/title>/);
  assert.match(html, /<meta name="viewport"[^>]*width=device-width/);
});
