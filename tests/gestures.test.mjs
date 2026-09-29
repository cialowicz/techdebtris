import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from './harness.mjs';

const T = loadEngine();
const CELL = 24;

// Play a single-finger gesture: a list of [x, y, t] points, from touchdown to lift-off.
function gesture(points, cell = CELL) {
  const actions = [];
  const tracker = T.createGestureTracker((a) => actions.push(a));
  const [first, ...rest] = points;
  tracker.start(...first, cell);
  rest.slice(0, -1).forEach((p) => tracker.move(...p));
  tracker.end(...(rest.at(-1) ?? first));
  return actions;
}

// Evenly spaced points from (x0, y0) to (x1, y1) over `ms` milliseconds.
function path(x0, y0, x1, y1, ms, steps = 20) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = i / steps;
    return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 1000 + ms * f];
  });
}

describe('touch gestures', () => {
  test('a quick tap rotates', () => {
    assert.deepEqual(gesture([[100, 100, 0], [102, 101, 120]]), ['cw']);
  });

  test('a long press without moving does nothing', () => {
    assert.deepEqual(gesture([[100, 100, 0], [101, 100, 900]]), []);
  });

  test('dragging sideways moves the piece one column per cell of travel', () => {
    assert.deepEqual(gesture(path(100, 100, 100 + CELL * 3.2, 100, 400)), ['right', 'right', 'right']);
    assert.deepEqual(gesture(path(100, 100, 100 - CELL * 2.1, 100, 400)), ['left', 'left']);
  });

  test('the piece follows the finger back and forth', () => {
    const there = path(100, 100, 100 - CELL * 2, 100, 300);
    const back = path(100 - CELL * 2, 100, 100 - CELL, 100, 300).map(([x, y, t]) => [x, y, t + 300]);
    assert.deepEqual(gesture([...there, ...back.slice(1)]), ['left', 'left', 'right']);
  });

  test('a sideways drag ignores vertical wobble', () => {
    assert.deepEqual(gesture(path(100, 100, 100 + CELL * 2, 100 + CELL * 1.2, 500)), ['right', 'right']);
  });

  test('dragging down slowly soft-drops one row per cell, without a hard drop', () => {
    assert.deepEqual(gesture(path(100, 100, 100, 100 + CELL * 3, 900)), ['soft', 'soft', 'soft']);
  });

  test('flicking down hard-drops', () => {
    const actions = gesture(path(100, 100, 100, 100 + CELL * 4, 90));
    assert.equal(actions.at(-1), 'hard');
    assert.ok(actions.slice(0, -1).every((a) => a === 'soft'));
  });

  test('a flick that stops before lifting does not hard-drop', () => {
    const flick = path(100, 100, 100, 100 + CELL * 4, 90);
    const [x, y, t] = flick.at(-1);
    assert.equal(gesture([...flick, [x, y, t + 300]]).includes('hard'), false);
  });

  test('swiping up rotates once, as soon as the finger has travelled a cell', () => {
    const actions = [];
    const tracker = T.createGestureTracker((a) => actions.push(a));
    tracker.start(100, 200, 0, CELL);
    tracker.move(100, 200 - CELL * 1.1, 60);
    assert.deepEqual(actions, ['cw']);
    tracker.move(100, 200 - CELL * 3, 120);
    tracker.end(100, 200 - CELL * 3, 150);
    assert.deepEqual(actions, ['cw']);
  });

  test('a short upward twitch is neither a swipe nor a tap', () => {
    assert.deepEqual(gesture([[100, 100, 0], [100, 100 - CELL * 0.7, 80]]), []);
  });

  test('cancel() drops the gesture', () => {
    const actions = [];
    const tracker = T.createGestureTracker((a) => actions.push(a));
    tracker.start(100, 100, 0, CELL);
    tracker.cancel();
    tracker.move(100 + CELL * 3, 100, 100);
    tracker.end(100 + CELL * 3, 100, 120);
    assert.deepEqual(actions, []);
  });
});
