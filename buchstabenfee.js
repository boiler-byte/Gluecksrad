/* Buchstabenfee: 18 Animationsphasen aus der mitgelieferten Sprite-Demo.
   Alle Ablaeufe bleiben lokal und sind ohne Bibliotheken spielbar. */
(() => {
  'use strict';

  const ACTIONS = {
    walkLeft: [6, 7, 6, 8, 7, 8],
    walkRight: [12, 13, 12, 14, 13, 14],
    clap: [0, 1, 4, 1, 2, 4, 1]
  };
  const POSES = {
    left: { high: 10, mid: 9, low: 11, rest: 8 },
    right: { high: 16, mid: 15, low: 17, rest: 14 }
  };
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);
  let x = null;
  let facing = 'right';
  let action = 'rest';
  let serial = 0;
  let timers = new Set();

  function stage() { return $('puzzleBoard'); }
  function fairy() { return $('feeCharacter'); }
  function sprite() { return $('feeSprite'); }
  function frame(number) {
    if (!sprite()) return;
    sprite().style.backgroundPosition = (number % 6) * 20 + '% ' + Math.floor(number / 6) * 50 + '%';
    sprite().dataset.frame = String(number);
  }
  function delay(fn, ms, own = serial) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (own === serial) fn();
    }, ms);
    timers.add(id);
  }
  function cancel() {
    ++serial;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    if (!fairy()) return;
    // Eine laufende CSS-Wanderung an der momentanen Position einfrieren.
    if (x !== null && action === 'walk') {
      const boardRect = stage().getBoundingClientRect();
      const rect = fairy().getBoundingClientRect();
      x = rect.left + rect.width / 2 - boardRect.left;
    }
    fairy().style.transition = 'none';
    fairy().classList.remove('fee-celebrating');
    fairy().dataset.action = 'rest';
    action = 'rest';
    frame(0);
  }
  function limits() {
    const board = stage();
    const boardRect = board.getBoundingClientRect();
    const clipRect = board.closest('.board-card').getBoundingClientRect();
    const width = fairy().getBoundingClientRect().width || 90;
    const left = Math.max(0, clipRect.left - boardRect.left) + width * .50;
    const right = Math.min(boardRect.width, clipRect.right - boardRect.left) - width * .50;
    return { left, right: Math.max(left + 1, right), width };
  }
  function clampX(value) {
    const lim = limits();
    return Math.min(lim.right, Math.max(lim.left, value));
  }
  function setX(value, ms = 0) {
    if (!fairy()) return;
    x = clampX(value);
    fairy().style.transition = ms ? 'left ' + ms + 'ms linear' : 'none';
    fairy().style.left = x + 'px';
  }
  function home(side = 'left') {
    cancel();
    if (!fairy()) return;
    const edges = limits();
    setX(side === 'right' ? edges.right : edges.left, 0);
    frame(0);
    fairy().dataset.action = 'rest';
  }
  function currentX() {
    if (x === null) home('left');
    return x;
  }
  function animateFrames(sequence, interval, own) {
    let step = 0;
    const expected = action;
    const tick = () => {
      if (serial !== own || action !== expected) return;
      frame(sequence[step++ % sequence.length]);
      delay(tick, interval, own);
    };
    tick();
  }
  function walkTo(destination, callback) {
    if (!fairy()) { callback(); return; }
    const start = currentX();
    const end = clampX(destination);
    const delta = end - start;
    const direction = delta >= 0 ? 'right' : 'left';
    facing = direction;
    const duration = reduced ? 40 : Math.min(1250, Math.max(160, Math.abs(delta) * 3.2));
    action = 'walk';
    fairy().dataset.action = 'walk';
    const own = serial;
    animateFrames(ACTIONS[direction === 'right' ? 'walkRight' : 'walkLeft'], 145, own);
    // Framewechsel und Positionswechsel in getrennten Ticks starten.
    delay(() => setX(end, duration), 20, own);
    delay(() => {
      action = 'pose';
      fairy().dataset.action = 'pose';
      frame(POSES[direction].rest);
      callback();
    }, duration + 40, own);
  }
  function tileLocation(tile) {
    const boardRect = stage().getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    return {
      x: tileRect.left + tileRect.width / 2 - boardRect.left,
      y: tileRect.top + tileRect.height / 2 - boardRect.top
    };
  }
  function walkToTile(tile, done) {
    if (!tile || !fairy()) { done({side:'right', level:'mid'}); return; }
    const point = tileLocation(tile);
    const start = currentX();
    const lim = limits();
    const gap = lim.width * .46;
    const fromLeft = clampX(point.x - gap);
    const fromRight = clampX(point.x + gap);
    let destination = Math.abs(fromLeft - start) <= Math.abs(fromRight - start) ? fromLeft : fromRight;
    // Befindet sich das Ziel zu nah an einem Rand, von der freien Seite greifen.
    if (point.x - lim.left < gap * .58) destination = fromRight;
    if (lim.right - point.x < gap * .58) destination = fromLeft;
    const side = destination <= point.x ? 'right' : 'left';
    walkTo(destination, () => {
      facing = side;
      const fairyRect = fairy().getBoundingClientRect();
      const boardRect = stage().getBoundingClientRect();
      const relative = (point.y - (fairyRect.top - boardRect.top)) / Math.max(1, fairyRect.height);
      const level = relative < .44 ? 'high' : relative < .69 ? 'mid' : 'low';
      done({ side, level });
    });
  }
  function turnTile(tile, pose, onTurned, onDone) {
    if (!tile) { onTurned(); onDone(); return; }
    action = 'turn';
    fairy().dataset.action = 'turn';
    frame(POSES[pose.side][pose.level]);
    tile.classList.add('tile-lit');
    const own = serial;
    delay(() => {
      tile.classList.add('tile-turning');
      frame(POSES[pose.side].rest);
    }, reduced ? 45 : 380, own);
    delay(() => {
      onTurned();
      frame(POSES[pose.side][pose.level]);
    }, reduced ? 100 : 600, own);
    delay(() => {
      tile.classList.remove('tile-lit', 'tile-turning');
      action = 'pose';
      fairy().dataset.action = 'pose';
      frame(POSES[pose.side].rest);
      onDone();
    }, reduced ? 170 : 970, own);
  }
  function returnAndClap(done) {
    if (!fairy()) { done(); return; }
    const edge = limits();
    const target = Math.abs(currentX() - edge.left) <= Math.abs(currentX() - edge.right) ? edge.left : edge.right;
    walkTo(target, () => {
      action = 'clap';
      fairy().dataset.action = 'clap';
      const own = serial;
      animateFrames(ACTIONS.clap, 150, own);
      delay(() => {
        action = 'rest';
        fairy().dataset.action = 'rest';
        frame(0);
        done();
      }, reduced ? 350 : 2350, own);
    });
  }
  function celebrate(done) {
    cancel();
    if (!fairy()) { done(); return; }
    action = 'celebrate';
    fairy().dataset.action = 'celebrate';
    fairy().classList.add('fee-celebrating');
    const own = serial;
    animateFrames(ACTIONS.clap, 150, own);
    delay(() => {
      action = 'rest';
      fairy().dataset.action = 'rest';
      fairy().classList.remove('fee-celebrating');
      frame(0);
      done();
    }, reduced ? 500 : 3100, own);
  }
  function handleResize() {
    if (!fairy()) return;
    if (action === 'rest') home(Math.abs(currentX() - limits().left) < Math.abs(currentX() - limits().right) ? 'left' : 'right');
  }
  window.GluecksradFee = {
    home, cancel, walkToTile, turnTile, returnAndClap, celebrate, handleResize,
    getState: () => ({ action, frame: Number(sprite()?.dataset.frame || 0), x })
  };
})();
