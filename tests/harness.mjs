// Loads pieces of the single-file game (techdebtris.html) so they can be tested in Node.
// The HTML keeps its pure game engine and its message pools in separate <script> blocks
// with stable ids, which is what makes this possible without a bundler.
import { readFileSync } from 'node:fs';

export const HTML_PATH = new URL('../techdebtris.html', import.meta.url);
export const html = readFileSync(HTML_PATH, 'utf8');

export function scriptById(id) {
  const re = new RegExp(`<script\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</script>`);
  const match = html.match(re);
  if (!match) throw new Error(`No <script id="${id}"> found in techdebtris.html`);
  return match[1];
}

// Every inline <script> that the browser will execute (i.e. not type="text/plain").
export function executableScripts() {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  const scripts = [];
  for (const [, attrs, code] of html.matchAll(re)) {
    if (/type="text\/plain"/.test(attrs)) continue;
    scripts.push({ attrs: attrs.trim(), code });
  }
  return scripts;
}

// The engine attaches itself to `window.Techdebtris`; hand it a sandbox object instead.
// Running it via Function (not vm) keeps it in this realm, so deepStrictEqual works on its arrays.
export function loadEngine() {
  const sandbox = {};
  new Function('window', scriptById('techdebtris-engine'))(sandbox);
  if (!sandbox.Techdebtris) throw new Error('Engine script did not define window.Techdebtris');
  return sandbox.Techdebtris;
}

export function loadMessages() {
  return loadEngine().parseMessages(scriptById('techdebtris-messages'));
}
