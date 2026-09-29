import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { html, executableScripts, scriptById } from './harness.mjs';

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

test('messages live in the ticker and never cover the board', () => {
  assert.doesNotMatch(html, /class="toast"|\.flyer\b/);
  const ui = scriptById('techdebtris-ui');
  assert.doesNotMatch(ui, /\b(?:boardCol|boardWrap)\.(?:append|prepend|appendChild)\(/);
  assert.match(html, /\.ticker\.highlight\b/);
});

test('iOS double-tap on the play area cannot zoom, and a stray zoom can be pinched back', () => {
  const ui = scriptById('techdebtris-ui');
  // Safari still double-tap-zooms through touch-action: none; a non-passive touchend that
  // calls preventDefault is what actually stops it.
  assert.match(ui, /els\.layout\.addEventListener\('touchend',[\s\S]*?preventDefault\(\)[\s\S]*?\{ passive: false \}\)/);
  // Between games the play area allows pinch, so the page is never stuck zoomed in.
  assert.match(ui, /els\.layout\.classList\.toggle\('idle'/);
  assert.match(html, /\.layout\.idle\s*\{[^}]*touch-action:\s*pan-y pinch-zoom/);
});
