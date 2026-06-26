import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  parseLabel,
  makeWedgeState,
  syncDropTarget,
  recomputeFlame,
  DART_NUMBERS,
} from '../src/game.js';

// ── parseLabel ────────────────────────────────────────────────────────────────
describe('parseLabel', () => {
  test('miss variants', () => {
    assert.deepEqual(parseLabel('—'),    { number: null, multiplier: 0 });
    assert.deepEqual(parseLabel('Miss'), { number: null, multiplier: 0 });
    assert.deepEqual(parseLabel(null),   { number: null, multiplier: 0 });
  });

  test('bull variants', () => {
    assert.deepEqual(parseLabel('OB'),    { number: 25, multiplier: 1 });
    assert.deepEqual(parseLabel('IB'),    { number: 25, multiplier: 2 });
    assert.deepEqual(parseLabel('Bull'),  { number: 25, multiplier: 1 });
    assert.deepEqual(parseLabel('OBull'), { number: 25, multiplier: 1 });
    assert.deepEqual(parseLabel('IBull'), { number: 25, multiplier: 2 });
    assert.deepEqual(parseLabel('DBull'), { number: 25, multiplier: 2 });
  });

  test('numbered dart labels', () => {
    assert.deepEqual(parseLabel('S20'), { number: 20, multiplier: 1 });
    assert.deepEqual(parseLabel('D20'), { number: 20, multiplier: 2 });
    assert.deepEqual(parseLabel('T20'), { number: 20, multiplier: 3 });
    assert.deepEqual(parseLabel('5'),   { number: 5,  multiplier: 1 });
    assert.deepEqual(parseLabel('T1'),  { number: 1,  multiplier: 3 });
  });

  test('unknown label', () => {
    assert.deepEqual(parseLabel('???'), { number: null, multiplier: 0 });
  });
});

// ── syncDropTarget ────────────────────────────────────────────────────────────
describe('syncDropTarget', () => {
  test('no marks → full height', () => {
    const ws = makeWedgeState(20, 0);
    syncDropTarget(ws);
    assert.equal(ws.targetDropY, 1);
  });

  test('one shared pip → 2/3 height', () => {
    const ws = makeWedgeState(20, 0);
    ws.p1marks = 1; ws.p2marks = 1;
    syncDropTarget(ws);
    assert.ok(Math.abs(ws.targetDropY - 2/3) < 0.001);
  });

  test('two shared pips → 1/3 height', () => {
    const ws = makeWedgeState(20, 0);
    ws.p1marks = 2; ws.p2marks = 2;
    syncDropTarget(ws);
    assert.ok(Math.abs(ws.targetDropY - 1/3) < 0.001);
  });

  test('asymmetric: shared = min', () => {
    const ws = makeWedgeState(20, 0);
    ws.p1marks = 3; ws.p2marks = 1;
    syncDropTarget(ws);
    assert.ok(Math.abs(ws.targetDropY - 2/3) < 0.001);
  });

  test('closed → 0', () => {
    const ws = makeWedgeState(20, 0);
    ws.closed = true;
    syncDropTarget(ws);
    assert.equal(ws.targetDropY, 0);
  });
});

// ── recomputeFlame ────────────────────────────────────────────────────────────
describe('recomputeFlame', () => {
  test('no marks → no flame', () => {
    const ws = makeWedgeState(20, 0);
    recomputeFlame(ws);
    assert.equal(ws.flameIntensity, 0);
    assert.equal(ws.flameHeight,    0);
    assert.equal(ws.flamePlayer,    0);
  });

  test('closed → no flame', () => {
    const ws = makeWedgeState(20, 0);
    ws.p1marks = 3; ws.p2marks = 3; ws.closed = true;
    recomputeFlame(ws);
    assert.equal(ws.flameIntensity, 0);
  });

  test('p1 at 3 opp at 0 → p1 fire', () => {
    const ws = makeWedgeState(20, 0);
    ws.p1marks = 3; ws.p2marks = 0;
    recomputeFlame(ws);
    assert.equal(ws.flamePlayer,    1);
    assert.equal(ws.flameIntensity, 1.0);
    assert.equal(ws.flameHeight,    1.0);
  });

  test('p2 at 3 opp at 1 → p2 fire', () => {
    const ws = makeWedgeState(20, 0);
    ws.p1marks = 1; ws.p2marks = 3;
    recomputeFlame(ws);
    assert.equal(ws.flamePlayer,    2);
    assert.equal(ws.flameIntensity, 1.0);
    assert.equal(ws.flameHeight,    1.0);
  });

  test('both at 2 → glow only (height 0), intensity > 0', () => {
    const ws = makeWedgeState(20, 0);
    ws.p1marks = 2; ws.p2marks = 2;
    recomputeFlame(ws);
    assert.equal(ws.flameHeight, 0);
    assert.ok(ws.flameIntensity > 0);
    assert.ok(ws.flameIntensity < 1.0);
  });

  test('p1 leads 1–0 → p1 glow, no fire', () => {
    const ws = makeWedgeState(20, 0);
    ws.p1marks = 1; ws.p2marks = 0;
    recomputeFlame(ws);
    assert.equal(ws.flamePlayer, 1);
    assert.equal(ws.flameHeight, 0);
    assert.ok(ws.flameIntensity > 0);
  });

  test('non-cricket target → no flame', () => {
    const ws = makeWedgeState(11, 0); // 11 is not in CRICKET_TARGETS?
    // Actually all numbers ARE cricket targets now, so let's force isCricket=false
    ws.isCricket = false;
    recomputeFlame(ws);
    assert.equal(ws.flameIntensity, 0);
  });
});

// ── createGame — scoreCricketHit via registerHit ──────────────────────────────
describe('createGame — scoring', () => {
  test('single hit adds 1 mark', () => {
    const g = createGame();
    g.registerHit(20, 1); // S20
    const ws = g.findWedge(20);
    assert.equal(ws.p1marks, 1);
    assert.equal(ws.p2marks, 0);
  });

  test('triple hit adds 3 marks, closes on opponent hit', () => {
    const g = createGame();
    // P1 gets 3 marks on 20 in one dart
    g.registerHit(20, 3); // T20 — P1 closes their side
    const ws = g.findWedge(20);
    assert.equal(ws.p1marks, 3);
    assert.equal(ws.lockedBy, 1);
  });

  test('overflow scores points when opponent has not closed', () => {
    const g = createGame();
    // P1 T20 → 3 marks (no overflow yet)
    g.registerHit(20, 3);
    // End P1 turn (3 darts used after 2 more misses)
    g.registerMiss(); g.registerMiss();
    // P2 turn — pass
    g.registerPass();
    // P1 turn again: T20 = 3 marks already, overflow = 3, pts = 3*20 = 60
    const before = g.getState().p1Points;
    g.registerHit(20, 3);
    assert.equal(g.getState().p1Points, before + 60);
  });

  test('no overflow if opponent has closed', () => {
    const g = createGame();
    // P1 T20
    g.registerHit(20, 3); g.registerMiss(); g.registerMiss();
    // P2 T20
    g.registerHit(20, 3); g.registerMiss(); g.registerMiss();
    // Now both at 3 → closed. P1 T20 again → no points
    const before = g.getState().p1Points;
    g.registerHit(20, 3);
    assert.equal(g.getState().p1Points, before);
  });

  test('bull has 3 pip capacity', () => {
    const g = createGame();
    // OB = multiplier 1, IB = multiplier 2
    g.registerHit(25, 2); // IB = 2 marks
    assert.equal(g.getState().bullState.p1marks, 2);
  });
});

// ── replayAll consistency ─────────────────────────────────────────────────────
describe('replayAll', () => {
  test('replaying same throws produces identical state', () => {
    const g = createGame();
    g.registerHit(20, 3);
    g.registerHit(19, 2);
    g.registerMiss();
    // Snapshot direct state
    const before = {
      p1marks20: g.findWedge(20).p1marks,
      p1marks19: g.findWedge(19).p1marks,
      p1Points:  g.getState().p1Points,
    };
    // Force replay
    g.replayAll();
    assert.equal(g.findWedge(20).p1marks, before.p1marks20);
    assert.equal(g.findWedge(19).p1marks, before.p1marks19);
    assert.equal(g.getState().p1Points,   before.p1Points);
  });

  test('undo removes last entry and recalculates', () => {
    const g = createGame();
    g.registerHit(20, 3); // 3 marks
    const stackLenBefore = g.historyStack.length;
    // Manually pop and replay (mimics undoLast)
    g.historyStack.pop();
    g.replayAll();
    assert.equal(g.historyStack.length, stackLenBefore - 1);
    assert.equal(g.findWedge(20).p1marks, 0);
  });
});

// ── player rename ─────────────────────────────────────────────────────────────
describe('setName', () => {
  test('name change reflects in getState', () => {
    const g = createGame();
    g.setName(1, 'Dave');
    assert.equal(g.getState().p1Name, 'Dave');
    g.setName(2, 'Garth');
    assert.equal(g.getState().p2Name, 'Garth');
  });

  test('resetAll does not clear names', () => {
    const g = createGame();
    g.setName(1, 'Dave'); g.setName(2, 'Garth');
    g.resetAll();
    assert.equal(g.getState().p1Name, 'Dave');
    assert.equal(g.getState().p2Name, 'Garth');
  });
});
