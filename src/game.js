// Pure Cricket game logic — no DOM, no Three.js.
// Import this in index.html and in tests.

export const DART_NUMBERS  = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
export const CRICKET_TARGETS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25];
export const CRICKET_ORDER   = [20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,25];
export const BULL_IDX        = 20;

export function makeWedgeState(n, i) {
  return {
    number: n, index: i,
    isCricket: CRICKET_TARGETS.includes(n),
    p1marks: 0, p2marks: 0,
    closed: false,
    lockedBy: 0,
    dropY: 1, targetDropY: 1,
    flameIntensity: 0, flameHeight: 0, flameBurst: 0,
    flamePlayer: 0,
  };
}

// Parse a label string → { number, multiplier }
// Formats: "T20" "D5" "S15" "OB" "IB" "—" "Miss"
export function parseLabel(lbl) {
  if (!lbl || lbl === '—' || lbl === 'Miss') return { number: null, multiplier: 0 };
  if (lbl === 'OB' || lbl === 'Bull' || lbl === 'OBull') return { number: 25, multiplier: 1 };
  if (lbl === 'IB' || lbl === 'IBull' || lbl === 'DBull') return { number: 25, multiplier: 2 };
  const m = lbl.match(/^([SDT]?)(\d+)$/i);
  if (!m) return { number: null, multiplier: 0 };
  const mult = { S:1, D:2, T:3, '':1 }[m[1].toUpperCase()] ?? 1;
  return { number: parseInt(m[2]), multiplier: mult };
}

// Compute target scaleY (1=full, 0=gone) — both players must share a pip before block shrinks.
export function syncDropTarget(ws) {
  if (ws.closed) { ws.targetDropY = 0; return; }
  const shared = Math.min(ws.p1marks, ws.p2marks);
  ws.targetDropY = 1 - shared / 3;
}

// Compute flame/glow state from current mark counts.
export function recomputeFlame(ws) {
  if (!ws.isCricket || ws.closed) {
    ws.flameIntensity = 0; ws.flameHeight = 0; ws.flamePlayer = 0; return;
  }
  const p1 = ws.p1marks, p2 = ws.p2marks;
  const p1canScore = p1 >= 3 && p2 < 3;
  const p2canScore = p2 >= 3 && p1 < 3;

  if (p1canScore || p2canScore) {
    ws.flamePlayer    = p1canScore ? 1 : 2;
    ws.flameIntensity = 1.0;
    ws.flameHeight    = 1.0;
  } else {
    const lead = p1 - p2;
    if (lead === 0 && p1 === 0) {
      ws.flameIntensity = 0; ws.flameHeight = 0; ws.flamePlayer = 0;
    } else {
      ws.flamePlayer    = lead >= 0 ? 1 : 2;
      const sharedLevel = Math.min(p1, p2);
      const leadBonus   = Math.abs(lead) / 6;
      ws.flameIntensity = Math.min(0.72, sharedLevel / 3 * 0.55 + leadBonus);
      ws.flameHeight    = 0;
    }
  }
}

// createGame() returns a fully self-contained game instance.
// All mutable state lives inside; call methods on the returned object.
export function createGame() {
  const wedgeStates = DART_NUMBERS.map((n, i) => makeWedgeState(n, i));
  const bullState   = makeWedgeState(25, BULL_IDX);

  let p1Name      = 'Player 1';
  let p2Name      = 'Player 2';
  let currentPlayer = 1;
  let dartsLeft     = 3;
  let p1Points      = 0;
  let p2Points      = 0;
  let gameOver      = false;
  let winnerPlayer  = 0;
  let winnerActive  = false;
  let winnerTimer   = 0;
  let turnNum       = 1;

  const historyStack = [];
  const turnTotals   = {};

  // Callbacks — set these to hook into UI updates
  const listeners = { scoreUI: [], turnUI: [], cricketBoard: [], history: [], lastHitUI: [] };
  function emit(event) { listeners[event]?.forEach(fn => fn(getState())); }

  function findWedge(number) {
    if (number === 25) return null;
    return wedgeStates.find(ws => ws.number === number) ?? null;
  }

  function getWs(number) {
    return number === 25 ? bullState : findWedge(number);
  }

  function scoreCricketHit(ws, multiplier) {
    if (!ws.isCricket || ws.closed || gameOver) return 0;
    const pKey   = currentPlayer === 1 ? 'p1marks' : 'p2marks';
    const oppKey = currentPlayer === 1 ? 'p2marks' : 'p1marks';
    const before = ws[pKey];
    ws[pKey] = Math.min(3, ws[pKey] + multiplier);

    if (ws[pKey] === 3 && ws.lockedBy === 0) ws.lockedBy = currentPlayer;

    const overflow = (before + multiplier) - 3;
    let pts = 0;
    if (overflow > 0 && ws[oppKey] < 3) {
      pts = overflow * ws.number;
      if (currentPlayer === 1) p1Points += pts;
      else                      p2Points += pts;
    }
    if (ws.p1marks === 3 && ws.p2marks === 3) ws.closed = true;

    syncDropTarget(ws);
    recomputeFlame(ws);
    return pts;
  }

  function checkWin() {
    const allClosed = CRICKET_TARGETS.every(n => {
      const ws = n === 25 ? bullState : findWedge(n);
      return ws && ws.closed;
    });
    if (!allClosed) return;
    if (p1Points >= p2Points || p2Points >= p1Points) {
      gameOver     = true;
      winnerPlayer = p1Points >= p2Points ? 1 : 2;
      winnerActive = true;
      winnerTimer  = 0;
      emit('turnUI');
    }
  }

  function advanceDart() {
    dartsLeft--;
    if (dartsLeft === 0) endTurn();
    emit('turnUI');
  }

  function endTurn() {
    turnTotals[turnNum] = { p1: p1Points, p2: p2Points };
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    dartsLeft     = 3;
    turnNum++;
  }

  function pushHistory(label, number, multiplier, player) {
    const dart = 4 - dartsLeft;
    historyStack.push({ label, number, multiplier, player, turn: turnNum, dart });
    emit('history');
  }

  function registerHit(number, multiplier, label) {
    if (gameOver || dartsLeft === 0) return;
    const player = currentPlayer;
    const lbl    = label ?? (number === 25
      ? (multiplier === 2 ? 'IB' : 'OB')
      : (['','S','D','T'][multiplier] ?? 'S') + number);
    pushHistory(lbl, number, multiplier, player);
    const ws = getWs(number);
    if (!ws || ws.closed) { advanceDart(); return; }
    const pts = scoreCricketHit(ws, multiplier);
    if (pts > 0 && !ws.closed) ws.flameBurst = 1.0;
    advanceDart();
    checkWin();
    emit('scoreUI');
    emit('cricketBoard');
  }

  function registerMiss() {
    if (gameOver || dartsLeft === 0) return;
    pushHistory('—', null, 0, currentPlayer);
    advanceDart();
  }

  function registerPass() {
    if (gameOver) return;
    const count = dartsLeft; // snapshot — endTurn resets dartsLeft to 3
    for (let i = 0; i < count; i++) registerMiss();
    emit('lastHitUI');
  }

  function resetState() {
    const blank = { p1marks:0, p2marks:0, closed:false, lockedBy:0,
                    dropY:1, targetDropY:1, flameIntensity:0, flameHeight:0,
                    flameBurst:0, flamePlayer:0 };
    wedgeStates.forEach(ws => Object.assign(ws, blank));
    Object.assign(bullState, blank);
    currentPlayer = 1; dartsLeft = 3; turnNum = 1;
    p1Points = 0; p2Points = 0;
    gameOver = false; winnerPlayer = 0; winnerActive = false; winnerTimer = 0;
    historyStack.length = 0;
    Object.keys(turnTotals).forEach(k => delete turnTotals[k]);
  }

  function resetAll() {
    resetState();
    emit('scoreUI'); emit('turnUI'); emit('cricketBoard'); emit('history'); emit('lastHitUI');
  }

  function replayAll() {
    const snapshot = historyStack.slice(); // save before resetState clears it
    resetState();
    historyStack.push(...snapshot);       // restore entries (resetState cleared them)
    // Re-run every throw in recorded order
    for (const entry of historyStack) {
      const { number, multiplier, player } = entry;
      if (currentPlayer !== player) currentPlayer = player;
      if (number !== null && multiplier > 0) {
        const ws = getWs(number);
        if (ws && !ws.closed) scoreCricketHit(ws, multiplier);
      }
      dartsLeft--;
      if (dartsLeft === 0) endTurn();
    }
    turnTotals[turnNum] = { p1: p1Points, p2: p2Points };
    checkWin();
    emit('scoreUI'); emit('turnUI'); emit('cricketBoard'); emit('history'); emit('lastHitUI');
  }

  function applyDemoState(state) {
    resetAll();
    const setCricket = (n, p1m, p2m) => {
      const ws = getWs(n);
      if (!ws) return;
      ws.p1marks = p1m; ws.p2marks = p2m;
      if (p1m === 3 && ws.lockedBy === 0) ws.lockedBy = 1;
      if (p2m === 3 && ws.lockedBy === 0) ws.lockedBy = 2;
      if (p1m === 3 && p2m === 3) ws.closed = true;
      syncDropTarget(ws);
      ws.dropY = ws.targetDropY;
      recomputeFlame(ws);
    };
    switch (state) {
      case 'start': break;
      case 'firsthit':
        setCricket(20, 1, 0); setCricket(5, 1, 0); break;
      case 'combined':
        setCricket(20, 1, 1); setCricket(19, 2, 1); setCricket(18, 1, 0);
        setCricket(7,  1, 0); setCricket(3,  0, 1); break;
      case 'takingcontrol':
        setCricket(20, 3, 1); setCricket(19, 2, 0); setCricket(18, 3, 2);
        setCricket(17, 1, 0); setCricket(10, 3, 0); setCricket(5,  2, 0);
        p1Points = 40; break;
      case 'multipoints':
        setCricket(20, 3, 0); setCricket(19, 3, 1); setCricket(18, 3, 2);
        setCricket(17, 2, 0); setCricket(16, 1, 0); setCricket(9,  3, 0);
        setCricket(4,  2, 1); setCricket(1,  1, 0);
        p1Points = 120; break;
      case 'mellow':
        DART_NUMBERS.forEach(n => setCricket(n, 1, 1));
        setCricket(25, 1, 1); break;
      case 'closing':
        setCricket(20, 3, 3); setCricket(19, 3, 2); setCricket(18, 3, 3);
        setCricket(17, 2, 3); setCricket(16, 3, 1); setCricket(15, 1, 2);
        setCricket(10, 3, 3); setCricket(5,  3, 3); setCricket(1,  3, 3);
        p1Points = 80; p2Points = 40; break;
      case 'stonedrop':
        DART_NUMBERS.slice(0, 12).forEach(n => setCricket(n, 3, 3));
        setCricket(25, 3, 3);
        setCricket(DART_NUMBERS[12], 2, 1); setCricket(DART_NUMBERS[13], 1, 0);
        p1Points = 180; p2Points = 60; break;
      case 'winner':
        DART_NUMBERS.forEach(n => setCricket(n, 3, 3));
        setCricket(25, 3, 3);
        p1Points = 260; p2Points = 140;
        winnerActive = true; winnerTimer = 0; gameOver = true; winnerPlayer = 1; break;
    }
    emit('scoreUI'); emit('turnUI'); emit('cricketBoard');
  }

  function getState() {
    return {
      wedgeStates, bullState, historyStack, turnTotals,
      currentPlayer, dartsLeft, p1Points, p2Points,
      gameOver, winnerPlayer, winnerActive, winnerTimer,
      turnNum, p1Name, p2Name,
    };
  }

  function setName(player, name) {
    if (player === 1) p1Name = name;
    else              p2Name = name;
    emit('turnUI'); emit('history');
  }

  function on(event, fn) { listeners[event]?.push(fn); }

  return {
    on,
    getState,
    setName,
    registerHit,
    registerMiss,
    registerPass,
    resetAll,
    replayAll,
    applyDemoState,
    // expose for history editing
    get historyStack() { return historyStack; },
    get turnTotals()   { return turnTotals; },
    findWedge,
    getWs,
    // expose internals for tests
    _scoreCricketHit: scoreCricketHit,
    _checkWin: checkWin,
    _advanceDart: advanceDart,
  };
}
