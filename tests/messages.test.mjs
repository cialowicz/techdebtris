import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine, loadMessages } from './harness.mjs';

const T = loadEngine();
const pools = loadMessages();

// Minimum sizes keep repeats rare. Pieces are placed ~3x as often as lines are cleared,
// so the "placed" pool needs to be the deepest.
const MINIMUMS = {
  start: 8,
  placed: 200,
  hold: 15,
  single: 80,
  double: 30,
  triple: 25,
  tetris: 25,
  levelUp: 20,
  pause: 8,
  gameOver: 15,
};
const MAX_LENGTH = 140;

const all = Object.entries(pools).flatMap(([pool, list]) => list.map((text) => ({ pool, text })));

describe('message pools', () => {
  test('contain exactly the pools the game uses', () => {
    assert.deepEqual(Object.keys(pools).sort(), Object.keys(MINIMUMS).sort());
  });

  for (const [pool, min] of Object.entries(MINIMUMS)) {
    test(`[${pool}] has at least ${min} messages`, () => {
      assert.ok((pools[pool] ?? []).length >= min, `[${pool}] has ${pools[pool]?.length ?? 0}`);
    });
  }

  test('hold hundreds of messages in total', () => {
    assert.ok(all.length >= 450, `only ${all.length} messages`);
  });

  test('have no duplicates, even across pools', () => {
    const seen = new Map();
    const dupes = [];
    for (const { pool, text } of all) {
      const norm = text.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(norm)) dupes.push(`[${seen.get(norm)}] / [${pool}] ${text}`);
      else seen.set(norm, pool);
    }
    assert.deepEqual(dupes, []);
  });

  test(`are at most ${MAX_LENGTH} characters so they fit the ticker`, () => {
    const long = all.filter(({ text }) => text.length > MAX_LENGTH).map(({ text }) => text);
    assert.deepEqual(long, []);
  });

  test('have balanced `code` backticks', () => {
    const bad = all.filter(({ text }) => (text.match(/`/g) ?? []).length % 2).map(({ text }) => text);
    assert.deepEqual(bad, []);
  });

  test('contain no "<", which could end the <script> block they live in', () => {
    assert.deepEqual(all.filter(({ text }) => text.includes('<')).map(({ text }) => text), []);
  });
});

describe('parseMessages', () => {
  test('reads [sections], skips blank lines and # comments, trims whitespace', () => {
    const parsed = T.parseMessages(`
      # a comment
      [one]
        First message.

      Second message.
      [two]
      Third.
    `);
    assert.deepEqual(parsed, { one: ['First message.', 'Second message.'], two: ['Third.'] });
  });

  test('rejects a message that comes before any section header', () => {
    assert.throws(() => T.parseMessages('Orphan message.\n[pool]\nOk.'), /line 1/);
  });
});

describe('messenger', () => {
  test('goes through a whole pool before repeating anything', () => {
    const messenger = T.createMessenger(pools, T.mulberry32(5));
    const n = pools.single.length;
    const firstCycle = new Set(Array.from({ length: n }, () => messenger.next('single')));
    assert.equal(firstCycle.size, n);
  });

  test('keeps pools independent', () => {
    const messenger = T.createMessenger(pools, T.mulberry32(5));
    assert.ok(pools.placed.includes(messenger.next('placed')));
    assert.ok(pools.tetris.includes(messenger.next('tetris')));
  });

  test('throws on an unknown pool', () => {
    const messenger = T.createMessenger(pools);
    assert.throws(() => messenger.next('nope'), /nope/);
  });
});
