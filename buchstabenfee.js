/* Buchstabenfee v11: 18 am Koerpermittelpunkt stabilisierte Frames (6 x 3).
   Auch beim Klatschen bleibt der Torso mittig; auf angeschnittenen Waenden
   verlaesst die Fee weiterhin vollstaendig den sichtbaren Bereich. */
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
  let resizeFrame = null;

  function stage() { return $('puzzleBoard'); }
  function fairy() { return $('feeCharacter'); }
  function sprite() { return $('feeSprite'); }
  // Eine neue Fee wird ausschliesslich ueber window.GLUECKSRAD_FEEN registriert.
  // Alle Varianten verwenden denselben 6x3-Atlas und dieselben 18 Posen.
  function variants() {
    const registry = window.GLUECKSRAD_FEEN;
    if (!registry || typeof registry !== 'object') return [];
    return Object.entries(registry)
      .filter(([id, info]) => id && info && typeof info.name === 'string' && info.name.trim() &&
        typeof info.atlas === 'string' && info.atlas.trim())
      .map(([id, info]) => ({ id, name: info.name, atlas: info.atlas }));
  }
  function defaultVariant() {
    const options = variants();
    return options.some(item => item.id === 'sonya') ? 'sonya' : (options[0]?.id || null);
  }
  function resolveVariant(id) {
    const options = variants();
    return options.find(item => item.id === id) ||
      options.find(item => item.id === defaultVariant()) || null;
  }
  function setVariant(id) {
    const chosen = resolveVariant(id);
    if (!chosen) return null;
    if (sprite()) {
      sprite().style.backgroundImage = 'url(' + JSON.stringify(chosen.atlas) + ')';
      sprite().dataset.fairyId = chosen.id;
    }
    return chosen.id;
  }
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
    const visibleLeft = Math.max(0, clipRect.left - boardRect.left);
    const visibleRight = Math.min(boardRect.width, clipRect.right - boardRect.left);
    // Auf breiten Wänden steht die Körperachse etwa 90 px vom Bühnenrand
    // entfernt. Die alte halbe Spritebreite ergab rund 159 px und verdeckte
    // dadurch die äußeren Buchstaben. Die Ausgänge mobil bleiben unverändert.
    const cropped = boardRect.left < clipRect.left - 2 || boardRect.right > clipRect.right + 2;
    const inset = cropped ? width * .5 : Math.min(90, width * .5);
    const left = visibleLeft + inset;
    const right = visibleRight - inset;
    // Die mobile Buchstabenwand ist breiter als die abschneidende board-card.
    // Nicht nach viewport-Breite raten, sondern die tatsächliche Beschneidung prüfen.
    return {
      left, right: Math.max(left + 1, right), width, cropped,
      // Die gesamte Figur inklusive Schatten verschwindet hinter dem Kartenrand.
      exitLeft: visibleLeft - width * .5 - 16,
      exitRight: visibleRight + width * .5 + 16
    };
  }
  function clampX(value) {
    const lim = limits();
    return Math.min(lim.right, Math.max(lim.left, value));
  }
  function setX(value, ms = 0, allowOutside = false) {
    if (!fairy()) return;
    x = allowOutside ? value : clampX(value);
    fairy().style.transition = ms ? 'left ' + ms + 'ms linear' : 'none';
    fairy().style.left = x + 'px';
  }
  function home(side = 'left') {
    cancel();
    if (!fairy()) return;
    const edges = limits();
    const target = edges.cropped
      ? (side === 'right' ? edges.exitRight : edges.exitLeft)
      : (side === 'right' ? edges.right : edges.left);
    setX(target, 0, edges.cropped);
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
  function walkTo(destination, callback, allowOutside = false) {
    if (!fairy()) { callback(); return; }
    const start = currentX();
    const end = allowOutside ? destination : clampX(destination);
    const delta = end - start;
    const direction = delta >= 0 ? 'right' : 'left';
    facing = direction;
    const duration = reduced ? 40 : Math.min(1250, Math.max(160, Math.abs(delta) * 3.2));
    action = 'walk';
    fairy().dataset.action = 'walk';
    const own = serial;
    animateFrames(ACTIONS[direction === 'right' ? 'walkRight' : 'walkLeft'], 145, own);
    // Framewechsel und Positionswechsel in getrennten Ticks starten.
    delay(() => setX(end, duration, allowOutside), 20, own);
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
    // V13: Beim Aufdecken 20 px naeher an die jeweilige Kachel herantreten.
    // Ruheposition und Ausgaenge der Fee bleiben unveraendert.
    const gap = Math.max(0, lim.width * .46 - 20);
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
      // Die Handspitzen der Atlas-Posen liegen (vom Sprite-Oberrand aus)
      // bei ca. 20 %, 33 % und 48 %. V8 wählte Hoch schon bei 40 %
      // Tilehöhe und griff dadurch sichtbar über das Feld. Die zwei
      // Schwellen sind die Mittelpunkte zwischen den tatsächlichen Höhen.
      const level = relative < .265 ? 'high' : relative < .405 ? 'mid' : 'low';
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
    // Hand nur einmal ausstrecken und bis zum abgeschlossenen Umdrehen halten.
    // Kein Zwischenwechsel zur Ruhepose: der verursachte den doppelten Griff.
    delay(() => {
      tile.classList.add('tile-turning');
    }, reduced ? 45 : 380, own);
    delay(() => {
      onTurned();
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
    const toLeft = Math.abs(currentX() - edge.left) <= Math.abs(currentX() - edge.right);
    if (edge.cropped) {
      // Auf Mobilgeräten steht die doppelt große Fee sonst vor den Buchstaben.
      // Sie läuft vollständig aus dem beschnittenen Bühnenbild, statt dort zu warten.
      walkTo(toLeft ? edge.exitLeft : edge.exitRight, () => {
        action = 'rest';
        fairy().dataset.action = 'rest';
        frame(0);
        done();
      }, true);
      return;
    }
    const target = toLeft ? edge.left : edge.right;
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
    const edge = limits();
    const side = Math.abs(currentX() - edge.left) <= Math.abs(currentX() - edge.right) ? 'left' : 'right';
    const applaud = () => {
      action = 'celebrate';
      fairy().dataset.action = 'celebrate';
      fairy().classList.add('fee-celebrating');
      const own = serial;
      animateFrames(ACTIONS.clap, 150, own);
      delay(() => {
        fairy().classList.remove('fee-celebrating');
        frame(0);
        if (limits().cropped) {
          const exit = limits();
          walkTo(side === 'left' ? exit.exitLeft : exit.exitRight, () => {
            action = 'rest';
            fairy().dataset.action = 'rest';
            frame(0);
            done();
          }, true);
        } else {
          action = 'rest';
          fairy().dataset.action = 'rest';
          done();
        }
      }, reduced ? 500 : 3100, own);
    };
    // Zur Siegesanimation kurz hereinkommen, danach auch hier wieder abgehen.
    if (edge.cropped) walkTo(side === 'left' ? edge.left : edge.right, applaud);
    else applaud();
  }
  function handleResize() {
    if (!fairy()) return;
    // Erst nach dem neuen CSS-Layout bestimmen, ob die Wand beschnitten ist.
    // Beim Wechsel zwischen Mobil- und Desktop-Breakpoint liefert das
    // unmittelbare resize-Ereignis sonst noch die vorigen Begrenzungen.
    if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      if (!fairy() || action !== 'rest') return;
      const edge = limits();
      const position = currentX();
      home(Math.abs(position - edge.left) <= Math.abs(position - edge.right) ? 'left' : 'right');
    });
  }
  window.GluecksradFee = {
    home, cancel, walkToTile, turnTile, returnAndClap, celebrate, handleResize,
    variants, defaultVariant, setVariant,
    getState: () => ({ action, frame: Number(sprite()?.dataset.frame || 0), x,
      fairyId: sprite()?.dataset.fairyId || defaultVariant() })
  };
  // Auch verzögert übernommene Media-Query-Layouts nach einem Resize erfassen.
  // Eine absolute Fee verändert die Größe der beobachteten Bühne selbst nicht.
  if (window.ResizeObserver && stage()) {
    const observer = new ResizeObserver(handleResize);
    observer.observe(stage());
  }
})();
