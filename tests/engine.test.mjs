import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from './harness.mjs';

const T = loadEngine();
const { COLS, ROWS, HIDDEN_ROWS, LOCK_DELAY, MAX_LOCK_RESETS } = T;
const TOTAL = ROWS + HIDDEN_ROWS;
const BOTTOM = TOTAL - 1;

function newGame(seed = 42) {
  const events = [];
  const game = T.createGame({ rng: T.mulberry32(seed), onEvent: (e) => events.push(e) });
  game.start();
  return { game, events };
}

// Fill a board row with garbage, leaving the given columns empty.
function fillRow(game, y, exceptCols = []) {
  for (let x = 0; x < COLS; x++) game.board[y][x] = exceptCols.includes(x) ? null : 'X';
}

// Put a piece on the board so its leftmost cell sits in `leftCol`.
function placeAtColumn(game, type, rot, leftCol, y = 5) {
  game.piece = { type, rot, x: 0, y };
  const minX = Math.min(...game.cells().map(([x]) => x));
  game.piece = { type, rot, x: leftCol - minX, y };
}

const key = (cells) => cells.map(([x, y]) => `${x},${y}`).sort();
const locks = (events) => events.filter((e) => e.type === 'lock');

describe('randomness', () => {
  test('mulberry32 is deterministic and returns values in [0, 1)', () => {
    const a = T.mulberry32(7);
    const b = T.mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = a();
      assert.equal(v, b());
      assert.ok(v >= 0 && v < 1);
    }
  });

  test('piece bag deals every tetromino once per 7 pieces', () => {
    const bag = T.createShuffleBag(T.PIECE_TYPES, T.mulberry32(1));
    for (let round = 0; round < 20; round++) {
      const seven = Array.from({ length: 7 }, () => bag.next());
      assert.deepEqual([...seven].sort(), [...T.PIECE_TYPES].sort());
    }
  });

  test('shuffle bag never repeats an item back-to-back, even across refills', () => {
    const bag = T.createShuffleBag(['a', 'b', 'c', 'd', 'e'], T.mulberry32(3));
    let prev = null;
    for (let i = 0; i < 1000; i++) {
      const v = bag.next();
      assert.notEqual(v, prev);
      prev = v;
    }
  });

  test('shuffle bag rejects an empty list', () => {
    assert.throws(() => T.createShuffleBag([]));
  });

  test('games with the same seed deal the same pieces', () => {
    const a = newGame(99).game;
    const b = newGame(99).game;
    for (let i = 0; i < 30; i++) {
      assert.equal(a.piece.type, b.piece.type);
      a.hardDrop();
      b.hardDrop();
      if (a.over) break;
    }
  });
});

describe('setup', () => {
  test('start() produces an empty board, a piece, and a preview queue', () => {
    const { game, events } = newGame();
    assert.equal(game.board.length, TOTAL);
    assert.ok(game.board.every((row) => row.length === COLS && row.every((c) => c === null)));
    assert.ok(T.PIECE_TYPES.includes(game.piece.type));
    assert.ok(game.queue.length >= 5);
    assert.equal(game.score, 0);
    assert.equal(game.level, 1);
    assert.equal(game.over, false);
    assert.equal(events[0].type, 'start');
  });

  test('pieces spawn centered, just above the visible well', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { game } = newGame(seed);
      const cells = game.cells();
      assert.equal(Math.max(...cells.map(([, y]) => y)), HIDDEN_ROWS);
      assert.ok(cells.every(([x]) => x >= 3 && x <= 6), `${game.piece.type} off-center`);
    }
  });
});

describe('movement', () => {
  test('pieces stop at the walls', () => {
    const { game } = newGame();
    while (game.move(-1));
    assert.equal(Math.min(...game.cells().map(([x]) => x)), 0);
    while (game.move(1));
    assert.equal(Math.max(...game.cells().map(([x]) => x)), COLS - 1);
  });

  test('pieces are blocked by locked cells', () => {
    const { game } = newGame();
    placeAtColumn(game, 'O', 0, 4);
    for (let y = 0; y < TOTAL; y++) game.board[y][3] = 'X';
    assert.equal(game.move(-1), false);
    assert.equal(Math.min(...game.cells().map(([x]) => x)), 4);
  });

  test('soft drop moves down one row and scores 1 point', () => {
    const { game } = newGame();
    const y = game.piece.y;
    assert.equal(game.softDrop(), true);
    assert.equal(game.piece.y, y + 1);
    assert.equal(game.score, 1);
  });

  test('hard drop lands on the floor, locks, and scores 2 points per row', () => {
    const { game, events } = newGame();
    const distance = game.ghostY() - game.piece.y;
    assert.ok(distance > 10);
    assert.equal(game.hardDrop(), distance);
    assert.equal(game.score, distance * 2);
    assert.equal(game.piecesPlaced, 1);
    assert.ok(game.board[BOTTOM].some((c) => c !== null));
    assert.equal(locks(events).length, 1);
  });

  test('the lock event reports the cells where the piece came to rest', () => {
    const { game, events } = newGame();
    placeAtColumn(game, 'T', 0, 4, 2);
    const landed = key(game.cells({ ...game.piece, y: game.ghostY() }));
    game.hardDrop();
    const lock = locks(events).at(-1);
    assert.deepEqual(key(lock.cells), landed);
    assert.ok(lock.cells.every(([x, y]) => game.board[y][x] === 'T'));
  });

  test('ghostY matches where a hard drop lands', () => {
    const { game } = newGame();
    fillRow(game, BOTTOM, [0]);
    placeAtColumn(game, 'T', 0, 4, 2);
    const ghost = game.ghostY();
    const expected = key(game.cells({ ...game.piece, y: ghost }));
    game.hardDrop();
    assert.ok(expected.every((k) => {
      const [x, y] = k.split(',').map(Number);
      return game.board[y][x] === 'T';
    }));
  });
});

describe('rotation', () => {
  test('four clockwise turns return a T piece to where it started', () => {
    const { game } = newGame();
    placeAtColumn(game, 'T', 0, 4, 8);
    const start = key(game.cells());
    for (let i = 0; i < 4; i++) assert.equal(game.rotate(1), true);
    assert.deepEqual(key(game.cells()), start);
  });

  test('clockwise then counter-clockwise is a no-op in open space', () => {
    const { game } = newGame();
    for (const type of ['I', 'T', 'S', 'Z', 'J', 'L']) {
      placeAtColumn(game, type, 0, 3, 8);
      const start = key(game.cells());
      game.rotate(1);
      game.rotate(-1);
      assert.deepEqual(key(game.cells()), start, type);
    }
  });

  test('the O piece does not wobble when rotated', () => {
    const { game } = newGame();
    placeAtColumn(game, 'O', 0, 4, 8);
    const start = key(game.cells());
    game.rotate(1);
    assert.deepEqual(key(game.cells()), start);
  });

  test('an I piece against the left wall kicks out when rotated flat', () => {
    const { game } = newGame();
    placeAtColumn(game, 'I', 1, 0, 8);
    assert.equal(game.rotate(1), true);
    assert.equal(game.piece.rot, 2);
    assert.ok(game.cells().every(([x]) => x >= 0 && x < COLS));
  });

  test('rotation fails (and changes nothing) when every kick is blocked', () => {
    const { game } = newGame();
    placeAtColumn(game, 'T', 0, 4, 8);
    const occupied = new Set(key(game.cells()));
    for (let y = 0; y < TOTAL; y++) {
      for (let x = 0; x < COLS; x++) if (!occupied.has(`${x},${y}`)) game.board[y][x] = 'X';
    }
    const before = { ...game.piece };
    assert.equal(game.rotate(1), false);
    assert.deepEqual(game.piece, before);
  });
});

describe('line clears and scoring', () => {
  test('a single clear pays 100 × level and emits cleared=1', () => {
    const { game, events } = newGame();
    fillRow(game, BOTTOM, [3, 4, 5, 6]);
    placeAtColumn(game, 'I', 0, 3);
    const distance = game.ghostY() - game.piece.y;
    game.hardDrop();
    assert.equal(game.lines, 1);
    assert.equal(game.score, 100 + distance * 2);
    assert.equal(locks(events).at(-1).cleared, 1);
    assert.ok(game.board[BOTTOM].every((c) => c === null));
  });

  for (const [n, points] of [[2, 300], [3, 500], [4, 800]]) {
    test(`clearing ${n} lines at once pays ${points}`, () => {
      const { game, events } = newGame();
      for (let i = 0; i < n; i++) fillRow(game, BOTTOM - i, [0]);
      placeAtColumn(game, 'I', 1, 0);
      const distance = game.ghostY() - game.piece.y;
      game.hardDrop();
      assert.equal(game.lines, n);
      assert.equal(game.score, points + distance * 2);
      assert.equal(locks(events).at(-1).cleared, n);
    });
  }

  test('rows above a cleared line shift down', () => {
    const { game } = newGame();
    fillRow(game, BOTTOM, [3, 4, 5, 6]);
    game.board[BOTTOM - 1][9] = 'X';
    placeAtColumn(game, 'I', 0, 3);
    game.hardDrop();
    assert.equal(game.board[BOTTOM][9], 'X');
    assert.equal(game.board[BOTTOM - 1][9], null);
  });

  test('placing a piece without clearing counts as debt taken', () => {
    const { game, events } = newGame();
    game.hardDrop();
    game.hardDrop();
    assert.equal(game.debtTaken, 2);
    assert.deepEqual(locks(events).map((e) => e.cleared), [0, 0]);
  });

  test('a piece landing flat on the floor covers no gaps', () => {
    const { game, events } = newGame();
    placeAtColumn(game, 'T', 0, 4);
    game.hardDrop();
    placeAtColumn(game, 'O', 0, 0);
    game.hardDrop();
    assert.deepEqual(locks(events).map((e) => e.gapsCovered), [0, 0]);
  });

  test('a piece that overhangs empty cells reports each column it covers', () => {
    const { game, events } = newGame();
    placeAtColumn(game, 'T', 2, 4); // pointing down: both arms hang over empty floor
    game.hardDrop();
    assert.equal(locks(events).at(-1).gapsCovered, 2);
  });

  test('bridging an open well covers it; filling the well does not', () => {
    const { game, events } = newGame();
    fillRow(game, BOTTOM, [0, 4, 5]);
    placeAtColumn(game, 'I', 1, 0); // vertical I drops into the well at column 0
    game.hardDrop();
    placeAtColumn(game, 'I', 0, 3); // flat I spans the two-wide gap at columns 4-5
    game.hardDrop();
    assert.deepEqual(locks(events).map((e) => e.gapsCovered), [0, 2]);
  });

  test('every 10 lines raises the level, which multiplies line scores', () => {
    const { game, events } = newGame();
    game.lines = 9;
    fillRow(game, BOTTOM, [3, 4, 5, 6]);
    placeAtColumn(game, 'I', 0, 3);
    let distance = game.ghostY() - game.piece.y;
    game.hardDrop();
    assert.equal(game.level, 2);
    assert.equal(game.score, 100 + distance * 2, 'the clear that levels up scores at the old level');
    assert.deepEqual(events.filter((e) => e.type === 'levelUp').map((e) => e.level), [2]);

    const before = game.score;
    fillRow(game, BOTTOM, [3, 4, 5, 6]);
    placeAtColumn(game, 'I', 0, 3);
    distance = game.ghostY() - game.piece.y;
    game.hardDrop();
    assert.equal(game.score - before, 200 + distance * 2);
  });
});

describe('hold (the backlog)', () => {
  test('first hold stashes the piece and deals the next one; only once per piece', () => {
    const { game } = newGame();
    const current = game.piece.type;
    const next = game.queue[0];
    assert.equal(game.hold(), true);
    assert.equal(game.holdType, current);
    assert.equal(game.piece.type, next);
    assert.equal(game.hold(), false);
  });

  test('after a lock, hold swaps the current piece with the held one', () => {
    const { game } = newGame();
    const first = game.piece.type;
    game.hold();
    game.hardDrop();
    const third = game.piece.type;
    assert.equal(game.hold(), true);
    assert.equal(game.piece.type, first);
    assert.equal(game.holdType, third);
    assert.equal(game.piece.rot, 0);
  });
});

describe('gravity and lock delay', () => {
  test('gravity starts at 1s per row and speeds up every level', () => {
    assert.equal(T.gravityInterval(1), 1000);
    for (let level = 2; level <= 30; level++) {
      assert.ok(T.gravityInterval(level) <= T.gravityInterval(level - 1));
      assert.ok(T.gravityInterval(level) >= 16);
    }
  });

  test('a tick of one gravity interval drops the piece one row', () => {
    const { game } = newGame();
    const y = game.piece.y;
    game.tick(999);
    assert.equal(game.piece.y, y);
    game.tick(1);
    assert.equal(game.piece.y, y + 1);
  });

  test('a grounded piece locks after the lock delay', () => {
    const { game } = newGame();
    while (game.softDrop());
    game.tick(LOCK_DELAY - 1);
    assert.equal(game.piecesPlaced, 0);
    game.tick(1);
    assert.equal(game.piecesPlaced, 1);
  });

  test('moving on the ground resets the lock timer, but only so many times', () => {
    const { game } = newGame();
    while (game.softDrop());
    const wiggle = (i) => game.move(i % 2 ? -1 : 1);
    for (let i = 0; i < MAX_LOCK_RESETS; i++) {
      game.tick(LOCK_DELAY - 100);
      assert.equal(game.piecesPlaced, 0, `locked early after ${i} resets`);
      assert.equal(wiggle(i), true);
    }
    game.tick(LOCK_DELAY - 100);
    assert.equal(game.piecesPlaced, 0);
    wiggle(MAX_LOCK_RESETS);
    game.tick(100);
    assert.equal(game.piecesPlaced, 1, 'resets are exhausted, so the timer keeps running');
  });

  test('pausing freezes time and input', () => {
    const { game } = newGame();
    const before = { ...game.piece };
    game.pause();
    game.tick(10_000);
    assert.equal(game.move(1), false);
    assert.equal(game.hardDrop(), 0);
    assert.deepEqual(game.piece, before);
    game.togglePause();
    assert.equal(game.paused, false);
    game.tick(1000);
    assert.equal(game.piece.y, before.y + 1);
  });
});

describe('game over', () => {
  test('topping out ends the game and ignores further input', () => {
    const { game, events } = newGame();
    for (let y = HIDDEN_ROWS + 1; y < TOTAL; y++) fillRow(game, y, [9]);
    game.hardDrop();
    assert.equal(game.over, true);
    const placed = game.piecesPlaced;
    assert.equal(game.move(1), false);
    assert.equal(game.rotate(1), false);
    assert.equal(game.hold(), false);
    assert.equal(game.hardDrop(), 0);
    game.tick(5000);
    assert.equal(game.piecesPlaced, placed);
    assert.equal(events.filter((e) => e.type === 'gameOver').length, 1);
  });

  test('locking a piece entirely above the visible well ends the game', () => {
    const { game } = newGame();
    game.piece = { type: 'I', rot: 0, x: 3, y: 0 };
    for (let y = HIDDEN_ROWS; y < TOTAL; y++) fillRow(game, y, [9]);
    game.hardDrop();
    assert.equal(game.over, true);
  });

  test('start() after game over begins a fresh game', () => {
    const { game } = newGame();
    for (let y = HIDDEN_ROWS + 1; y < TOTAL; y++) fillRow(game, y, [9]);
    game.hardDrop();
    game.start();
    assert.equal(game.over, false);
    assert.equal(game.score, 0);
    assert.ok(game.board.every((row) => row.every((c) => c === null)));
  });
});

describe('findFreeSlot (placing pop-ups away from the action)', () => {
  // A 0..600px playfield with a 100px-tall card to place.
  const slot = (blocked) => T.findFreeSlot(0, 600, 100, blocked);

  test('centers the card when nothing is in the way', () => {
    assert.deepEqual(slot([]), { top: 250, below: true });
  });

  test('prefers the space below every blocked zone (under the landing shadow)', () => {
    // Piece near the top, shadow in the middle: the gap between them is bigger,
    // but the space under the shadow is out of the piece's path entirely.
    assert.deepEqual(slot([[0, 60], [300, 380]]), { top: 440, below: true });
  });

  test('otherwise uses the biggest gap between blocked zones', () => {
    // Shadow near the floor leaves no room below; there are two gaps above it.
    assert.deepEqual(slot([[0, 60], [200, 230], [520, 600]]), { top: 325, below: false });
  });

  test('returns null when no gap is tall enough', () => {
    assert.equal(slot([[0, 60], [150, 250], [340, 440], [530, 600]]), null);
  });

  test('merges overlapping zones and ignores anything outside the playfield', () => {
    assert.deepEqual(slot([[-200, 40], [20, 100], [90, 150], [650, 900]]), { top: 325, below: true });
  });
});

describe('debt ratio', () => {
  test('is the stack height as a fraction of the well', () => {
    const { game } = newGame();
    assert.equal(game.debtRatio(), 0);
    game.board[BOTTOM][0] = 'X';
    assert.equal(game.debtRatio(), 1 / ROWS);
    game.board[HIDDEN_ROWS][0] = 'X';
    assert.equal(game.debtRatio(), 1);
  });
});
