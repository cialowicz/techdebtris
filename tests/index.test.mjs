import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// index.html exists only so the bare GitHub Pages URL lands on the game.
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('index.html redirects to the game, with and without JavaScript', () => {
  assert.match(index, /<meta http-equiv="refresh" content="0; url=techdebtris\.html">/);
  assert.match(index, /<link rel="canonical" href="techdebtris\.html">/);
  assert.match(index, /<a href="techdebtris\.html">/);
});

test('index.html redirect preserves query and hash, and stays standalone', () => {
  assert.match(index, /location\.replace\('techdebtris\.html' \+ location\.search \+ location\.hash\)/);
  const external = index.match(/\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+/gi) ?? [];
  assert.deepEqual(external, []);
});
