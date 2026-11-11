/* GLÜCKSRAD – eigenständiges Offline-Spiel. Keine Bibliotheken nötig. */
(() => {
  'use strict';

  const ROUNDS = 5;
  const SAVE_KEY = 'gluecksradGame';
  const SAVE_VERSION = 21;
  const VOWEL_COST = 250;
  const SOLVE_BONUS = 500;
  const VOWELS = 'AEIOUÄÖÜ';
  const KEY_ROWS = ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', 'YXCVBNM'];
  const ALL_KEYS = KEY_ROWS.join('').split('');
  // V16: Deutsche Buchstabierwörter für die Ansage am Scoreboard.
  // Die Wörter sind bewusst selbst gepflegt und funktionieren vollständig offline.
  const SPELLING_WORDS = {
    A: 'Anton', B: 'Berta', C: 'Cäsar', D: 'Dora', E: 'Emil',
    F: 'Friedrich', G: 'Gustav', H: 'Heinrich', I: 'Ida', J: 'Julius',
    K: 'Kaufmann', L: 'Ludwig', M: 'Martha', N: 'Nordpol', O: 'Otto',
    P: 'Paula', Q: 'Quelle', R: 'Richard', S: 'Samuel', T: 'Theodor',
    U: 'Ulrich', V: 'Viktor', W: 'Wilhelm', X: 'Xanthippe', Y: 'Ypsilon',
    Z: 'Zacharias', Ä: 'Ärger', Ö: 'Ökonom', Ü: 'Übermut'
  };
  // 18 feste Zahlenpositionen, in jeder Runde mit neu gelosten Sonderfeldern belegt.
  const BASE_SECTORS = [
    { label: '100', points: 100, color: '#f7ca6b' },
    { label: '400', points: 400, color: '#5bd3dd' },
    { label: '250', points: 250, color: '#f79ab8' },
    { label: '600', points: 600, color: '#c4a7f4' },
    { label: '150', points: 150, color: '#f9df89' },
    { label: '800', points: 800, color: '#91dfb0' },
    { label: '200', points: 200, color: '#f9a776' },
    { label: '450', points: 450, color: '#c0abd7' },
    { label: '500', points: 500, color: '#57d4de' },
    { label: '300', points: 300, color: '#fedb73' },
    { label: '900', points: 900, color: '#f4a0ba' },
    { label: '100', points: 100, color: '#aedcbd' },
    { label: '700', points: 700, color: '#e3b3f0' },
    { label: '600', points: 600, color: '#d6b5a1' },
    { label: '350', points: 350, color: '#f3b68f' },
    { label: '1200', points: 1200, color: '#ffe783' },
    { label: '200', points: 200, color: '#7fcfde' },
    { label: '500', points: 500, color: '#efa7e2' }
  ];
  const SPECIAL_SECTORS = {
    bankrupt: { label: 'BANKROTT', effect: 'bankrupt', color: '#35223e', light: true },
    skip: { label: 'AUSSETZEN', effect: 'skip', color: '#b14e73', light: true },
    extra: { label: 'EXTRADREH', effect: 'extra', color: '#116d8a', light: true }
  };
  // [min, max] pro Runde: die Spannen werden einmal am Rundenanfang ausgelost.
  const ROUND_SPECIAL_COUNTS = [
    { bankrupt: [0, 0], skip: [1, 1], extra: [0, 0] },
    { bankrupt: [0, 0], skip: [1, 1], extra: [1, 1] },
    { bankrupt: [0, 1], skip: [1, 1], extra: [0, 1] },
    { bankrupt: [1, 1], skip: [1, 1], extra: [1, 1] },
    { bankrupt: [1, 2], skip: [1, 1], extra: [1, 2] }
  ];
  let wheelSectors = BASE_SECTORS.slice();
  const STEP = 360 / BASE_SECTORS.length;
  const DIFFICULTIES = {
    easy: { accuracy: .47, solveFrom: .85, solveChance: .22, solveAccuracy: .60, vowelChance: .08, think: 900 },
    medium: { accuracy: .72, solveFrom: .70, solveChance: .38, solveAccuracy: .83, vowelChance: .17, think: 760 },
    hard: { accuracy: .90, solveFrom: .54, solveChance: .68, solveAccuracy: .97, vowelChance: .26, think: 570 }
  };

  const $ = id => document.getElementById(id);
  let game = null;
  let storageWarningShown = false;
  let soundOn = true;
  let audioContext = null;
  let wheelAngle = 0;
  let spinFrame = null;
  let wheelIntroFrame = null;
  let runToken = 0;
  let toastTimer = null;
  let letterCalloutSpeaker = null;
  let letterCalloutToken = 0;
  const timers = new Set();
  const fairy = window.GluecksradFee;
  const puzzleHistory = window.GluecksradVerlauf;
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function later(callback, ms) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      callback();
    }, ms);
    timers.add(id);
    return id;
  }
  function stopPending() {
    clearLetterCallout();
    for (const id of timers) clearTimeout(id);
    timers.clear();
    if (spinFrame !== null) cancelAnimationFrame(spinFrame);
    spinFrame = null;
    if (wheelIntroFrame !== null) cancelAnimationFrame(wheelIntroFrame);
    wheelIntroFrame = null;
    drawWheel();
    runToken += 1;
    $('confettiLayer').replaceChildren();
    fairy.cancel();
  }
  function upper(text) {
    return String(text).toLocaleUpperCase('de-DE');
  }
  function normalizePuzzle(text) {
    return window.GluecksradBrett.normalizePuzzle(text);
  }
  function simplifiedAnswer(text) {
    return upper(text).replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ẞ/g, 'SS').replace(/[^A-Z0-9]/g, '');
  }
  function isLetter(char) {
    return window.GluecksradBrett.isLetter(char);
  }
  function isVowel(char) {
    return VOWELS.includes(char);
  }
  function number(value) {
    return Math.round(value).toLocaleString('de-DE');
  }
  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }
  function shuffled(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function player() {
    return game.players[game.current];
  }
  function cpuActive() {
    return game && player().type === 'cpu';
  }
  function overlayVisible(id) {
    return !$(id).classList.contains('is-hidden');
  }
  function setOverlay(id, isOpen) {
    $(id).classList.toggle('is-hidden', !isOpen);
  }
  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // V16: Ein eigenständiger, nicht gespeicherter Ansage-Effekt. Dadurch bleiben
  // laufende Spiele und Spielstände aus älteren Versionen kompatibel.
  function clearLetterCallout() {
    letterCalloutToken++;
    letterCalloutSpeaker = null;
    const bubble = $('letterCallout');
    if (!bubble) return;
    bubble.classList.remove('is-visible', 'is-hit', 'is-miss');
    bubble.setAttribute('aria-hidden', 'true');
    bubble.style.removeProperty('left');
    bubble.style.removeProperty('--callout-tip');
    bubble.style.removeProperty('--speaker-color');
    $('letterCalloutText').textContent = '';
    $('letterCalloutParticles').replaceChildren();
  }

  function positionLetterCallout() {
    if (letterCalloutSpeaker === null) return;
    const bubble = $('letterCallout');
    const bar = $('scoreboardBar');
    const speaker = $('playerCard' + letterCalloutSpeaker);
    if (!bubble.classList.contains('is-visible') || !speaker) return;
    const barRect = bar.getBoundingClientRect();
    const speakerRect = speaker.getBoundingClientRect();
    const width = bubble.offsetWidth; // ohne Enter-Skalierung messen
    const center = speakerRect.left + speakerRect.width / 2 - barRect.left;
    // Auch am linken/rechten Rand liegt die ganze Ansage im Viewport.
    const left = Math.max(4, Math.min(center - width / 2, barRect.width - width - 4));
    const tip = Math.max(18, Math.min(width - 18, center - left));
    bubble.style.left = Math.round(left) + 'px';
    bubble.style.setProperty('--callout-tip', Math.round(tip) + 'px');
  }

  function scatterCalloutParticles(isHit) {
    if (prefersReducedMotion) return;
    const layer = $('letterCalloutParticles');
    layer.replaceChildren();
    const count = isHit ? 12 : 14;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (isHit ? .2 : 0);
      const distance = (isHit ? 52 : 65) + (i % 4) * 13;
      const shard = document.createElement('i');
      shard.className = 'letter-callout-particle';
      shard.style.setProperty('--dx', Math.round(Math.cos(angle) * distance) + 'px');
      shard.style.setProperty('--dy', Math.round(Math.sin(angle) * distance - (isHit ? 17 : 0)) + 'px');
      shard.style.setProperty('--particle-delay', ((i % 4) * 22) + 'ms');
      layer.appendChild(shard);
    }
  }

  function showLetterCallout(letter, speakerIndex, isHit) {
    clearLetterCallout();
    const bubble = $('letterCallout');
    letterCalloutSpeaker = speakerIndex;
    const speaker = $('playerCard' + speakerIndex);
    bubble.style.setProperty('--speaker-color', getComputedStyle(speaker).getPropertyValue('--accent').trim());
    $('letterCalloutText').textContent = "Ein '" + letter + "', wie '" + SPELLING_WORDS[letter] + "'.";
    bubble.setAttribute('aria-hidden', 'false');
    bubble.classList.add('is-visible');
    positionLetterCallout();
    const token = letterCalloutToken;
    const hold = prefersReducedMotion ? 210 : 820;
    const finale = prefersReducedMotion ? 160 : 730;
    later(() => {
      if (token !== letterCalloutToken) return;
      scatterCalloutParticles(isHit);
      bubble.classList.add(isHit ? 'is-hit' : 'is-miss');
    }, hold);
    later(() => {
      if (token === letterCalloutToken) clearLetterCallout();
    }, hold + finale);
  }

  // Klänge werden direkt im Browser synthetisiert: keine Sound-Dateien nötig.
  function audio() {
    if (!soundOn) return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    try {
      if (!audioContext) audioContext = new AudioCtor();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      return audioContext;
    } catch (_) {
      return null;
    }
  }
  function tone(freq, duration = .1, type = 'triangle', volume = .045, delay = 0, endFreq = null) {
    const ctx = audio();
    if (!ctx) return;
    try {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, start);
      if (endFreq) oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), start + duration);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(.00011, volume), start + Math.min(.012, duration / 3));
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + .01);
    } catch (_) { /* Manche Browser erlauben vor einem Tippen keinen Ton. */ }
  }
  function sound(name) {
    if (!soundOn) return;
    switch (name) {
      case 'tick': tone(980, .024, 'square', .012); break;
      case 'spin': tone(410, .13, 'triangle', .035, 0, 640); break;
      case 'hit': tone(660, .10, 'triangle', .055); tone(990, .15, 'sine', .048, .085); break;
      case 'bing': tone(910, .24, 'sine', .07); tone(1365, .18, 'sine', .021, .022); break;
      case 'miss': tone(320, .14, 'sawtooth', .029, 0, 215); tone(215, .22, 'triangle', .03, .12, 150); break;
      case 'bankrupt': tone(480, .32, 'sawtooth', .038, 0, 90); tone(160, .31, 'square', .02, .25, 70); break;
      case 'vowel': tone(600, .09, 'sine', .035); tone(450, .13, 'sine', .028, .10); break;
      case 'start': [520, 660, 790].forEach((n, i) => tone(n, .13, 'triangle', .04, i * .10)); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((n, i) => tone(n, i === 4 ? .4 : .16, 'triangle', .05, i * .15)); break;
      default: break;
    }
  }

  function createRoundSectorEffects(round) {
    const config = ROUND_SPECIAL_COUNTS[round - 1];
    const effects = Array(BASE_SECTORS.length).fill(null);
    const freePositions = shuffled(BASE_SECTORS.map((_, i) => i));
    for (const effect of ['bankrupt', 'skip', 'extra']) {
      const [min, max] = config[effect];
      const count = min + Math.floor(Math.random() * (max - min + 1));
      for (let i = 0; i < count; i++) effects[freePositions.pop()] = effect;
    }
    return effects;
  }
  function validSectorEffects(effects, round) {
    const config = ROUND_SPECIAL_COUNTS[round - 1];
    if (!config || !Array.isArray(effects) || effects.length !== BASE_SECTORS.length ||
        !effects.every(effect => effect === null || Object.hasOwn(SPECIAL_SECTORS, effect))) return false;
    return Object.entries(config).every(([effect, [min, max]]) => {
      const count = effects.filter(value => value === effect).length;
      return count >= min && count <= max;
    });
  }
  function applyRoundSectors() {
    wheelSectors = BASE_SECTORS.map((sector, i) =>
      game.sectorEffects[i] === null ? sector : SPECIAL_SECTORS[game.sectorEffects[i]]);
    drawWheel();
    const legend = $('wheelSpecials');
    legend.replaceChildren();
    const labels = [];
    for (const effect of ['bankrupt', 'skip', 'extra']) {
      const count = game.sectorEffects.filter(value => value === effect).length;
      if (!count) continue;
      const pill = document.createElement('span');
      pill.className = 'wheel-special-pill effect-' + effect;
      pill.textContent = count + '× ' + SPECIAL_SECTORS[effect].label;
      legend.appendChild(pill);
      labels.push(count + '-mal ' + SPECIAL_SECTORS[effect].label);
    }
    legend.setAttribute('aria-label', 'Sonderfelder in Runde ' + game.round + ': ' + labels.join(', '));
    $('wheelCanvas').setAttribute('aria-label', 'Glücksrad, Runde ' + game.round + '. ' + labels.join(', ') + '. Weitere Felder enthalten Punkte.');
  }

  // Beim Rundenstart wird jedes vorhandene Sonderfeld einzeln leuchtend
  // hervorgehoben und gut sichtbar um ca. 30 % vergroessert.
  function drawWheel(highlight = null) {
    const canvas = $('wheelCanvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const r = 293, center = 300;
    const step = Math.PI * 2 / wheelSectors.length;
    ctx.clearRect(0, 0, 600, 600);
    function paintSector(sector, i, pulse = 0) {
      const a = -Math.PI / 2 + i * step;
      const start = a - step / 2;
      const end = a + step / 2;
      ctx.save();
      if (pulse > 0) {
        // Anker nahe der Beschriftung: das Feld springt dem Betrachter entgegen.
        const x = center + Math.cos(a) * 205;
        const y = center + Math.sin(a) * 205;
        ctx.translate(x, y);
        ctx.scale(1 + .30 * pulse, 1 + .30 * pulse);
        ctx.translate(-x, -y);
        ctx.shadowColor = '#ffe86b';
        ctx.shadowBlur = 45 * pulse;
      }
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, r, start, end);
      ctx.closePath();
      ctx.fillStyle = sector.color;
      ctx.fill();
      if (pulse > 0) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = 'rgba(255,250,174,' + (.34 * pulse) + ')';
        ctx.fillRect(0, 0, 600, 600);
        ctx.restore();
      }
      ctx.lineWidth = pulse > 0 ? 2.4 + 6 * pulse : 2.4;
      ctx.strokeStyle = pulse > 0 ? '#fff1a3' : '#4a2c53';
      ctx.stroke();
      ctx.translate(center, center);
      ctx.rotate(i * step);
      ctx.translate(0, -205);
      ctx.fillStyle = sector.light ? '#fff3df' : '#33223c';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (sector.effect === 'bankrupt') {
        ctx.font = '900 17px system-ui, sans-serif';
        ctx.fillText('BANK', 0, -9);
        ctx.fillText('ROTT', 0, 10);
      } else if (sector.effect === 'skip') {
        ctx.font = '900 17px system-ui, sans-serif';
        ctx.fillText('AUS', 0, -9);
        ctx.fillText('SETZEN', 0, 10);
      } else if (sector.effect === 'extra') {
        ctx.font = '900 16px system-ui, sans-serif';
        ctx.fillText('EXTRA', 0, -9);
        ctx.fillText('DREH', 0, 10);
      } else {
        ctx.font = '900 25px system-ui, sans-serif';
        ctx.fillText(sector.label, 0, 0);
      }
      ctx.restore();
    }
    wheelSectors.forEach((sector, i) => paintSector(sector, i));
    ctx.save();
    ctx.translate(center, center);
    ctx.beginPath();
    ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#fff1b6';
    ctx.stroke();
    for (let i = 0; i < wheelSectors.length; i++) {
      const a = -Math.PI / 2 + (i + .5) * step;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (r - 15), Math.sin(a) * (r - 15), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff7e4';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 57, 0, Math.PI * 2);
    ctx.fillStyle = '#5f3f68';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 55, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#f2cd71';
    ctx.stroke();
    ctx.restore();
    if (highlight && wheelSectors[highlight.index]?.effect) {
      paintSector(wheelSectors[highlight.index], highlight.index, highlight.pulse);
    }
  }

  function beginWheelIntroduction() {
    if (!game || game.phase !== 'intro') return;
    const token = runToken;
    const highlighted = game.sectorEffects.map((effect, i) => effect === null ? -1 : i).filter(i => i >= 0);
    const slotDuration = prefersReducedMotion ? 300 : 780;
    const stage = document.querySelector('.wheel-stage');
    // Das Rad steht auf Smartphones unterhalb der Buchstabenwand.
    // Zum Vorstellen der Felder in den sichtbaren Bereich scrollen.
    if (stage && (window.innerWidth <= 760 || stage.getBoundingClientRect().bottom > window.innerHeight - 30)) {
      stage.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
    }
    let lastIndex = -1;
    function animate(time) {
      if (token !== runToken || !game || game.phase !== 'intro') return;
      if (startTime === null) startTime = time;
      const elapsed = time - startTime;
      const slot = Math.floor(elapsed / slotDuration);
      if (slot >= highlighted.length) {
        wheelIntroFrame = null;
        drawWheel();
        game.phase = 'idle';
        game.status = player().name + ' ist dran. Drehe das Rad und sammle Punkte!';
        render();
        maybeComputerTurn();
        return;
      }
      if (slot !== lastIndex) {
        const effect = wheelSectors[highlighted[slot]].effect;
        $('wheelText').textContent = 'SONDERFELD: ' + SPECIAL_SECTORS[effect].label;
        tone(750 + slot * 110, .17, 'sine', .05);
        lastIndex = slot;
      }
      const p = (elapsed % slotDuration) / slotDuration;
      const pulse = prefersReducedMotion ? 0.25 : Math.pow(Math.sin(Math.PI * p), .65);
      drawWheel({ index: highlighted[slot], pulse });
      wheelIntroFrame = requestAnimationFrame(animate);
    }
    let startTime = null;
    // Erst scrollen, dann sichtbar aufleuchten lassen.
    later(() => {
      if (token === runToken && game?.phase === 'intro') wheelIntroFrame = requestAnimationFrame(animate);
    }, prefersReducedMotion ? 100 : 560);
  }

  function buildKeyboard() {
    const container = $('keyboard');
    container.replaceChildren();
    for (const rowText of KEY_ROWS) {
      const row = document.createElement('div');
      row.className = 'keyboard-row';
      for (const letter of rowText) {
        const key = document.createElement('button');
        key.type = 'button';
        key.className = 'key' + (isVowel(letter) ? ' vowel' : '');
        key.textContent = letter;
        key.dataset.letter = letter;
        key.setAttribute('aria-label', 'Buchstabe ' + letter);
        key.disabled = true;
        key.addEventListener('click', () => guessLetter(letter, false));
        row.appendChild(key);
      }
      container.appendChild(row);
    }
  }

  function setConfigFromPlayers(players) {
    players.forEach((p, i) => {
      const select = $('type' + i);
      select.value = p.type === 'cpu' ? (p.difficulty || 'medium') : 'human';
      $('name' + i).value = p.name;
    });
  }
  // V20: Die Kategorien kommen ausschließlich aus woerter.js. So tauchen
  // selbst ergänzte Kategorien beim nächsten Laden automatisch in der Auswahl auf.
  function availablePuzzles() {
    return (Array.isArray(window.GLUECKSRAD_WOERTER) ? window.GLUECKSRAD_WOERTER : [])
      .filter(item => item && typeof item.text === 'string' && item.text.trim().length >= 4)
      .map(item => ({ text: normalizePuzzle(item.text.trim()), category: String(item.kategorie || 'Begriff').trim() || 'Begriff' }));
  }
  // Nur noch nicht im 50er-Verlauf enthaltene und eindeutig unterscheidbare
  // Rätsel werden verwendet (auch bei gleichem Text in zwei Kategorien).
  function freshPuzzles() {
    const seen = new Set();
    return availablePuzzles().filter(puzzle => {
      const key = puzzleHistory.key(puzzle.text);
      if (!key || seen.has(key) || puzzleHistory.contains(puzzle.text)) return false;
      seen.add(key);
      return true;
    });
  }
  function updateHistoryInfo() {
    const usedCount = puzzleHistory.list().length;
    const category = $('categorySelect').value;
    const availableCount = freshPuzzles().filter(p => !category || p.category === category).length;
    $('historyHint').textContent = usedCount + ' von 50 Rätseln vorgemerkt · ' +
      availableCount + ' neue Rätsel ' + (category ? 'in dieser Kategorie' : 'insgesamt') +
      '. Für eine Show werden 5 benötigt.';
    $('resetHistoryBtn').disabled = usedCount === 0;
  }
  function setupCategoryOptions() {
    const select = $('categorySelect');
    const previous = select.value;
    const puzzles = freshPuzzles();
    const counts = new Map();
    for (const puzzle of availablePuzzles()) {
      if (!counts.has(puzzle.category)) counts.set(puzzle.category, 0);
    }
    puzzles.forEach(puzzle => counts.set(puzzle.category, (counts.get(puzzle.category) || 0) + 1));
    select.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'Alle Kategorien (' + puzzles.length + ' verfügbar)';
    all.disabled = puzzles.length < ROUNDS;
    select.appendChild(all);
    const categoryNames = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'de'));
    for (const category of categoryNames) {
      const count = counts.get(category);
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category + ' (' + count + ' verfügbar)' + (count < ROUNDS ? ' – zu wenige für 5 Runden' : '');
      option.disabled = count < ROUNDS;
      select.appendChild(option);
    }
    setCategorySelection(previous);
    updateHistoryInfo();
  }
  function setCategorySelection(category) {
    const select = $('categorySelect');
    const value = typeof category === 'string' ? category : '';
    select.value = [...select.options].some(option => option.value === value && !option.disabled) ? value : '';
    updateHistoryInfo();
  }
  function setupFairyOptions() {
    const select = $('fairySelect');
    select.replaceChildren();
    for (const option of fairy.variants()) {
      const el = document.createElement('option');
      el.value = option.id;
      el.textContent = option.name;
      select.appendChild(el);
    }
    setFairySelection(fairy.defaultVariant());
  }
  function setFairySelection(id) {
    const selected = fairy.variants().find(option => option.id === id) ||
      fairy.variants().find(option => option.id === fairy.defaultVariant());
    if (!selected) return;
    $('fairySelect').value = selected.id;
    $('fairyPreview').style.backgroundImage = 'url(' + JSON.stringify(selected.atlas) + ')';
  }
  function playerTypeChanged(index) {
    const field = $('name' + index);
    const defaultHuman = 'Spieler ' + (index + 1);
    const defaultCpu = 'CPU ' + (index + 1);
    if ($('type' + index).value === 'human' && field.value === defaultCpu) field.value = defaultHuman;
    if ($('type' + index).value !== 'human' && field.value === defaultHuman) field.value = defaultCpu;
  }
  function configuredPlayers() {
    return [0, 1, 2].map(i => {
      const selection = $('type' + i).value;
      const isCpu = selection !== 'human';
      const defaultName = isCpu ? 'CPU ' + (i + 1) : 'Spieler ' + (i + 1);
      return {
        name: $('name' + i).value.trim().slice(0, 14) || defaultName,
        type: isCpu ? 'cpu' : 'human',
        difficulty: isCpu ? selection : null,
        total: 0,
        bank: 0
      };
    });
  }
  function isValidSave(snapshot) {
    const finitePoints = n => Number.isSafeInteger(n) && n >= 0;
    const validPlayer = p => p && typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 40 &&
      (p.type === 'human' || (p.type === 'cpu' && !!DIFFICULTIES[p.difficulty])) &&
      finitePoints(p.total) && finitePoints(p.bank);
    return !!snapshot && [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, SAVE_VERSION].includes(snapshot.version) &&
      (snapshot.phase !== 'revealing' || (
        ALL_KEYS.includes(snapshot.revealLetter) &&
        Number.isInteger(snapshot.revealIndex) && snapshot.revealIndex >= 0 &&
        snapshot.revealIndex <= [...snapshot.phrase].filter(c => c === snapshot.revealLetter).length)) &&
      Array.isArray(snapshot.players) && snapshot.players.length === 3 && snapshot.players.every(validPlayer) &&
      Number.isInteger(snapshot.round) && snapshot.round >= 1 && snapshot.round <= ROUNDS &&
      Number.isInteger(snapshot.current) && snapshot.current >= 0 && snapshot.current < 3 &&
      Array.isArray(snapshot.deck) && snapshot.deck.every(p => p && typeof p.text === 'string' && typeof p.category === 'string') &&
      typeof snapshot.phrase === 'string' && snapshot.phrase.length >= 4 &&
      typeof snapshot.category === 'string' &&
      (snapshot.version < 20 || (typeof snapshot.categoryFilter === 'string' && snapshot.categoryFilter.length <= 120)) &&
      Array.isArray(snapshot.used) &&
      snapshot.used.every(isLetter) && typeof snapshot.outcomes === 'object' && snapshot.outcomes !== null &&
      ['idle', 'intro', 'spinning', 'consonant', 'vowel', 'handover', 'solved', 'revealing'].includes(snapshot.phase) &&
      Number.isFinite(snapshot.wheelAngle) &&
      (snapshot.version < 10 || validSectorEffects(snapshot.sectorEffects, snapshot.round)) &&
      (snapshot.phase !== 'spinning' ||
        (Number.isInteger(snapshot.pendingSpinSector) && snapshot.pendingSpinSector >= 0 &&
         snapshot.pendingSpinSector < BASE_SECTORS.length && Number.isFinite(snapshot.pendingSpinAngle))) &&
      (snapshot.phase !== 'handover' || ['finish', 'next-player'].includes(snapshot.pendingTransition)) &&
      (snapshot.phase !== 'solved' ||
        (Number.isInteger(snapshot.endRoundWinner) && snapshot.endRoundWinner >= 0 && snapshot.endRoundWinner < 3 && finitePoints(snapshot.endRoundPrize)));
  }
  function readSavedGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const snapshot = JSON.parse(raw);
      return isValidSave(snapshot) ? snapshot : null;
    } catch (_) { return null; }
  }
  function refreshResumePanel() {
    const snapshot = readSavedGame();
    $('resumePanel').hidden = !snapshot;
    if (!snapshot) return;
    const currentPlayer = snapshot.players[snapshot.current];
    const currentLabel = snapshot.phase === 'solved'
      ? (snapshot.round === ROUNDS ? 'Alle 5 Runden abgeschlossen' : 'Runde ' + snapshot.round + ' gelöst')
      : currentPlayer.name + ' ist am Zug';
    const categoryLabel = snapshot.categoryFilter || 'Alle Kategorien';
    $('resumeSummary').textContent = 'Runde ' + snapshot.round + ' / ' + ROUNDS + ' · ' + currentLabel +
      ' · Kategorie: ' + categoryLabel + ' · ' + snapshot.players.map(p => p.name + ': ' + number(p.total)).join(' / ');
  }
  function persistGame() {
    if (!game) return;
    try {
      // localStorage.gluecksradGame enthaelt ein JSON-Objekt als String.
      // Saemtliche Runden- und Uebergangsdaten werden gespeichert.
      const snapshot = {
        version: SAVE_VERSION,
        savedAt: new Date().toISOString(),
        soundOn,
        fairyId: game.fairyId,
        players: game.players.map(p => ({ ...p })),
        round: game.round,
        sectorEffects: game.sectorEffects.slice(),
        deck: game.deck.map(p => ({ ...p })),
        previousCategory: game.previousCategory,
        current: game.current,
        phrase: game.phrase,
        category: game.category,
        categoryFilter: game.categoryFilter,
        used: [...game.used],
        outcomes: { ...game.outcomes },
        phase: game.phase,
        value: game.value,
        landed: game.landed,
        status: game.status,
        endRoundWinner: game.endRoundWinner,
        endRoundPrize: game.endRoundPrize,
        wheelAngle,
        pendingSpinSector: game.pendingSpinSector,
        pendingSpinAngle: game.pendingSpinAngle,
        pendingTransition: game.pendingTransition,
        revealLetter: game.revealLetter,
        revealIndex: game.revealIndex
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
      $('saveStatus').textContent = 'SPIELSTAND AUTOMATISCH GESPEICHERT';
      if (overlayVisible('setupOverlay')) refreshResumePanel();
    } catch (_) {
      $('saveStatus').textContent = 'SPEICHERN IM BROWSER NICHT VERFÜGBAR';
      if (!storageWarningShown) {
        storageWarningShown = true;
        toast('Browser blockiert localStorage. Die Partie kann nicht gespeichert werden.');
      }
    }
  }
  function menuIsOpen() {
    return !$('showMenuPanel').hidden;
  }
  function closeScoreMenu(restoreFocus = false) {
    if (!menuIsOpen()) return;
    $('showMenuPanel').hidden = true;
    $('scoreMenuBtn').setAttribute('aria-expanded', 'false');
    $('scoreMenuBtn').setAttribute('aria-label', 'Spielmenü öffnen');
    if (restoreFocus) $('scoreMenuBtn').focus();
  }
  function toggleScoreMenu() {
    const opening = !menuIsOpen();
    $('showMenuPanel').hidden = !opening;
    $('scoreMenuBtn').setAttribute('aria-expanded', String(opening));
    $('scoreMenuBtn').setAttribute('aria-label', opening ? 'Spielmenü schließen' : 'Spielmenü öffnen');
    if (opening) $('soundBtn').focus();
  }
  function refreshSoundButton() {
    $('soundBtn').setAttribute('aria-pressed', String(soundOn));
    $('soundBtn').setAttribute('aria-label', soundOn ? 'Ton ausschalten' : 'Ton einschalten');
    $('soundBtn').title = soundOn ? 'Ton ausschalten' : 'Ton einschalten';
    $('soundMenuText').textContent = soundOn ? 'TON AN' : 'TON AUS';
  }
  function openSetup() {
    closeScoreMenu();
    setupCategoryOptions();
    if (game) {
      // Das Show-Menue pausiert Timer, Computerzuege und Radanimation.
      stopPending();
      setConfigFromPlayers(game.players);
      setFairySelection(game.fairyId);
      setCategorySelection(game.categoryFilter);
    }
    $('setupClose').hidden = !game;
    refreshResumePanel();
    setOverlay('setupOverlay', true);
  }
  function closeSetup() {
    if (!game) return;
    if (!readSavedGame()) {
      // Falls localStorage gesperrt ist, kann eine laufende Show
      // trotzdem aus dem Menue wieder betreten werden.
      setOverlay('setupOverlay', false);
      restorePendingAction();
      return;
    }
    resumeGame();
  }

  function resetPuzzleHistory() {
    if (!puzzleHistory.list().length) return;
    if (!window.confirm('Den Verlauf der letzten 50 Rätsel löschen? Danach können bereits gespielte Wörter und Sätze wieder erscheinen.')) return;
    const selected = $('categorySelect').value;
    puzzleHistory.clear();
    setupCategoryOptions();
    setCategorySelection(selected);
    toast('Der Rätselverlauf wurde zurückgesetzt.');
  }

  function newGame() {
    const oldSave = readSavedGame();
    const last = oldSave || game;
    if (last && !(last.phase === 'solved' && last.round === ROUNDS) &&
        !window.confirm('Die gespeicherte Show wird ersetzt. Eine neue Show starten?')) return;
    const categoryFilter = $('categorySelect').value;
    const words = freshPuzzles().filter(puzzle => !categoryFilter || puzzle.category === categoryFilter);
    if (words.length < ROUNDS) {
      toast('Nur ' + words.length + ' unverbrauchte Rätsel verfügbar. Bitte Kategorie wechseln oder Verlauf löschen.');
      return;
    }
    stopPending();
    wheelAngle = 0;
    $('wheelDisc').style.transform = 'rotate(0deg)';
    game = {
      players: configuredPlayers(),
      fairyId: fairy.setVariant($('fairySelect').value),
      round: 0,
      sectorEffects: Array(BASE_SECTORS.length).fill(null),
      deck: shuffled(words),
      categoryFilter,
      previousCategory: '',
      current: 0,
      phrase: '',
      category: '',
      used: new Set(),
      outcomes: {},
      phase: 'idle',
      value: null,
      landed: null,
      status: '',
      endRoundWinner: null,
      endRoundPrize: 0,
      pendingSpinSector: null,
      pendingSpinAngle: null,
      pendingTransition: null,
      revealLetter: null,
      revealIndex: 0
    };
    setOverlay('setupOverlay', false);
    setOverlay('roundOverlay', false);
    setOverlay('solveOverlay', false);
    startRound();
    sound('start');
  }

  function resumeGame() {
    const snapshot = readSavedGame();
    if (!snapshot) {
      toast('Kein lesbarer Spielstand vorhanden. Bitte neue Show starten.');
      refreshResumePanel();
      return;
    }
    stopPending();
    game = {
      ...snapshot,
      players: snapshot.players.map(p => ({ ...p })),
      deck: snapshot.deck.map(p => ({ ...p })),
      categoryFilter: typeof snapshot.categoryFilter === 'string' ? snapshot.categoryFilter : '',
      used: new Set(snapshot.used),
      outcomes: { ...snapshot.outcomes }
    };
    // Alte v10- und fruehere Spielstaende benutzen die bisherige Sonya-Fee.
    // Nicht mehr registrierte Feen werden ebenfalls sicher auf Sonya gesetzt.
    game.fairyId = fairy.setVariant(snapshot.fairyId || fairy.defaultVariant());
    setFairySelection(game.fairyId);
    setCategorySelection(game.categoryFilter);
    if (snapshot.version < 10) {
      // Alte feste Bankrott-/Aussetzen-Positionen werden beim Fortsetzen
      // durch die neue Verteilung dieser Runde ersetzt.
      game.sectorEffects = createRoundSectorEffects(game.round);
      if (game.phase === 'spinning') {
        // Ein alter noch laufender Dreh kann nicht auf einem geaenderten Rad landen.
        game.phase = 'idle';
        game.pendingSpinSector = null;
        game.pendingSpinAngle = null;
        game.status = 'Neues Rad für Runde ' + game.round + ': Bitte erneut drehen.';
      }
    }
    applyRoundSectors();
    wheelAngle = snapshot.wheelAngle;
    soundOn = snapshot.soundOn !== false;
    refreshSoundButton();
    $('wheelDisc').style.transform = 'rotate(' + wheelAngle + 'deg)';
    setOverlay('setupOverlay', false);
    setOverlay('solveOverlay', false);
    setOverlay('roundOverlay', false);
    buildBoard();
    sizeBoardTiles();
    updateBoard();
    fairy.home();
    render();
    restorePendingAction();
  }

  function restorePendingAction() {
    if (!game) return;
    if (game.phase === 'intro') {
      beginWheelIntroduction();
    } else if (game.phase === 'spinning') {
      // Ein bereits ausgeloster Dreh wird nicht noch einmal ausgewuerfelt.
      const sector = wheelSectors[game.pendingSpinSector];
      wheelAngle = game.pendingSpinAngle;
      $('wheelDisc').style.transform = 'rotate(' + wheelAngle + 'deg)';
      handleSpinResult(sector);
    } else if (game.phase === 'revealing') {
      startRevealSequence();
    } else if (game.phase === 'handover') {
      if (game.pendingTransition === 'finish') finishRound(game.current);
      else advanceTurn();
    } else if (game.phase === 'solved') {
      fillResult();
      setOverlay('roundOverlay', true);
    } else if (cpuActive()) {
      if (game.phase === 'idle') maybeComputerTurn();
      if (game.phase === 'consonant' || game.phase === 'vowel') {
        later(() => computerGuess(game.phase === 'vowel'), cpuConfig().think);
      }
    }
  }

  function choosePuzzle() {
    // Falls parallel ein zweiter Tab gespielt wurde, den Verlauf erneut lesen.
    puzzleHistory.reload();
    let index = game.deck.findIndex(entry =>
      !puzzleHistory.contains(entry.text) && entry.category !== game.previousCategory);
    if (index < 0) index = game.deck.findIndex(entry => !puzzleHistory.contains(entry.text));
    if (index < 0) return null;
    const [entry] = game.deck.splice(index, 1);
    game.previousCategory = entry.category;
    return entry;
  }
  function startRound() {
    if (!game || game.round >= ROUNDS) return;
    const puzzle = choosePuzzle();
    if (!puzzle) {
      openSetup();
      toast('Keine unverbrauchten Rätsel übrig. Bitte Kategorie wechseln oder Verlauf löschen.');
      return;
    }
    // Bereits beim Rundenbeginn vormerken: Auch Abbruch oder Neuladen darf
    // das aktuelle Rätsel nicht erneut für eine andere Partie freigeben.
    puzzleHistory.record(puzzle.text);
    clearLetterCallout();
    game.round++;
    game.sectorEffects = createRoundSectorEffects(game.round);
    applyRoundSectors();
    game.phrase = puzzle.text;
    game.category = puzzle.category;
    game.used = new Set();
    game.outcomes = {};
    game.current = (game.round - 1) % 3;
    game.phase = 'intro';
    game.value = null;
    game.landed = null;
    game.pendingSpinSector = null;
    game.pendingSpinAngle = null;
    game.pendingTransition = null;
    game.revealLetter = null;
    game.revealIndex = 0;
    game.players.forEach(p => { p.bank = 0; });
    game.status = 'Runde ' + game.round + ': Die Sonderfelder auf dem Rad werden vorgestellt!';
    buildBoard();
    sizeBoardTiles();
    updateBoard();
    fairy.home();
    render();
    beginWheelIntroduction();
  }

  // V17: Die Rätselwand wird vom selben Renderer wie woerter.html gezeichnet.
  // Der Sprite bleibt ausschließlich in der Spielansicht.
  function buildBoard() {
    const board = $('puzzleBoard');
    const fee = $('feeCharacter');
    window.GluecksradBrett.buildBoard(board, game.phrase, false);
    board.appendChild(fee);
  }
  function sizeBoardTiles() {
    if (game) window.GluecksradBrett.sizeBoardTiles($('puzzleBoard'));
  }
  function hiddenCount() {
    return [...game.phrase].filter(char => isLetter(char) && !game.used.has(char)).length;
  }
  function letterCoverage() {
    const all = [...game.phrase].filter(isLetter);
    return all.length ? 1 - hiddenCount() / all.length : 1;
  }
  function updateBoard() {
    if (!game) return;
    let visited = 0;
    $('puzzleBoard').querySelectorAll('[data-letter]').forEach(tile => {
      const currentLetter = game.phase === 'revealing' && tile.dataset.letter === game.revealLetter;
      const visible = game.used.has(tile.dataset.letter) &&
        (!currentLetter || visited < game.revealIndex);
      if (currentLetter) visited++;
      if (visible && !tile.classList.contains('revealed')) {
        tile.classList.add('revealed');
        tile.setAttribute('aria-label', 'Buchstabe ' + tile.dataset.letter);
        if (game.phase !== 'revealing' && !tile.classList.contains('tile-turning')) {
          tile.classList.add('just-revealed');
          tile.addEventListener('animationend', () => tile.classList.remove('just-revealed'), { once: true });
        }
      }
    });
  }

  // Beim richtigen Tipp beginnt eine leuchtende Kettenreaktion in Leserichtung.
  // Sobald die erste Kachel sichtbar leuchtet, laeuft die Fee zu ihr; die
  // uebrigen Treffer leuchten waehrenddessen in derselben Reihenfolge auf.
  // Nach einem Reload beginnt die Beleuchtung bei der naechsten offenen Kachel.
  function startRevealSequence() {
    if (!game || game.phase !== 'revealing') return;
    const letter = game.revealLetter;
    const first = game.revealIndex;
    const matches = [...$('puzzleBoard').querySelectorAll('[data-letter]')]
      .filter(tile => tile.dataset.letter === letter);
    if (first >= matches.length) { runRevealSequence(); return; }
    const interval = prefersReducedMotion ? 70 : 225;
    matches.slice(first).forEach((tile, relativeIndex) => {
      later(() => {
        if (!game || game.phase !== 'revealing' || game.revealLetter !== letter ||
            !tile.isConnected || tile.classList.contains('revealed')) return;
        tile.classList.add('tile-lit');
        // Genau ein Bing pro Treffer, passend zum Aufleuchten (nicht erneut beim Umdrehen).
        sound('bing');
      }, relativeIndex * interval);
    });
    // Die erste Kachel leuchtet vor dem ersten Gehschritt auf. Waehrend die
    // Fee unterwegs ist, leuchten die weiteren Kacheln automatisch auf.
    later(() => {
      if (game && game.phase === 'revealing' && game.revealLetter === letter) runRevealSequence();
    }, prefersReducedMotion ? 45 : 120);
  }

  function runRevealSequence() {
    if (!game || game.phase !== 'revealing') return;
    const letter = game.revealLetter;
    // querySelectorAll liefert die Tiles in Leserichtung: Wort fuer Wort von links nach rechts.
    const matches = [...$('puzzleBoard').querySelectorAll('[data-letter]')]
      .filter(tile => tile.dataset.letter === letter);
    const current = game.revealIndex;
    if (current >= matches.length) {
      fairy.returnAndClap(() => {
        if (!game || game.phase !== 'revealing' || game.revealLetter !== letter) return;
        game.revealLetter = null;
        game.revealIndex = 0;
        game.phase = 'idle';
        render();
        if (hiddenCount() === 0) finishRound(game.current);
        else maybeComputerTurn();
      });
      return;
    }
    const tile = matches[current];
    fairy.walkToTile(tile, pose => {
      if (!game || game.phase !== 'revealing' || game.revealLetter !== letter) return;
      // Die Kachel leuchtet bereits seit der vorgelagerten Trefferanzeige.
      fairy.turnTile(tile, pose, () => {
        if (!game || game.phase !== 'revealing' || game.revealLetter !== letter) return;
        game.revealIndex = current + 1;
        updateBoard();
        persistGame();
      }, () => {
        if (game && game.phase === 'revealing' && game.revealLetter === letter) runRevealSequence();
      });
    });
  }

  // V15: Die mobile Steuerkarte folgt nur dem Spielzustand.
  // Auf Desktop bleibt die zweispaltige Ansicht aus v14 unveraendert.
  const mobileControlsQuery = window.matchMedia('(max-width: 760px)');
  function updateMobileControls() {
    const columns = $('gameColumns');
    const controls = columns.querySelector('.controls-card');
    const human = game && player().type === 'human';
    const mode = !human ? 'hidden'
      : game.phase === 'idle' ? 'actions'
      : game.phase === 'consonant' || game.phase === 'vowel' ? 'keyboard'
      : 'hidden';
    columns.dataset.mobileControls = mode;
    // Nur eine ausgefahrene mobile Karte soll im Fokus erreichbar sein.
    // Desktop-Tastatur und -Buttons duerfen weiterhin normal benutzt werden.
    controls.inert = mobileControlsQuery.matches && mode === 'hidden';
  }

  function render() {
    if (!game) return;
    $('roundLabel').textContent = 'RUNDE ' + game.round + ' / ' + ROUNDS;
    $('boardHeading').textContent = upper(game.category);
    const active = player();
    game.players.forEach((p, i) => {
      $('playerName' + i).textContent = upper(p.name);
      $('playerName' + i).title = p.name;
      $('playerScore' + i).textContent = number(p.total);
      $('playerBank' + i).textContent = number(p.bank);
      $('playerCard' + i).classList.toggle('active', i === game.current && game.phase !== 'solved');
      $('playerCard' + i).classList.toggle('is-cpu', p.type === 'cpu');
      const who = p.type === 'cpu' ? 'Computer ' + (({ easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' })[p.difficulty] || 'Mittel') : 'Mensch';
      $('playerCard' + i).title = p.name + ' · ' + who;
      $('playerCard' + i).setAttribute('aria-label', p.name + ', ' + who + ': ' + number(p.total) + ' Gesamtpunkte, ' + number(p.bank) + ' Punkte im Rundentopf');
    });
    $('currentPlayerHeading').textContent = upper(active.name);
    $('turnBadge').textContent = game.phase === 'solved' ? 'GELÖST' : game.phase === 'revealing' ? 'FEE AKTIV' : active.type === 'cpu' ? 'CPU DENKT' : 'AM ZUG';
    $('turnBadge').classList.toggle('cpu', active.type === 'cpu');
    $('turnEyebrow').textContent = game.phase === 'solved' ? 'RUNDE VORBEI' : 'JETZT AM ZUG';
    $('statusLine').textContent = game.status;
    const canAct = active.type === 'human';
    $('spinBtn').disabled = !canAct || game.phase !== 'idle';
    $('vowelBtn').disabled = !canAct || !(game.phase === 'vowel' || (game.phase === 'idle' && canBuyVowel()));
    $('vowelBtn').innerHTML = game.phase === 'vowel' ? 'ABBRECHEN <span>↶</span>' : 'VOKAL <span>−250</span>';
    $('solveBtn').disabled = !canAct || game.phase !== 'idle';
    $('passBtn').disabled = !canAct || game.phase !== 'idle';
    $('mobilePassBtn').disabled = !canAct || game.phase !== 'idle';
    if (game.phase === 'consonant') {
      $('keyboardPrompt').textContent = 'KONSONANT WÄHLEN · ' + number(game.value) + ' PKT/TREFFER';
    } else if (game.phase === 'vowel') {
      $('keyboardPrompt').textContent = 'VOKAL WÄHLEN · KOSTET 250 PKT';
    } else if (game.phase === 'spinning') {
      $('keyboardPrompt').textContent = 'DAS RAD DREHT SICH ...';
    } else if (game.phase === 'revealing') {
      $('keyboardPrompt').textContent = 'BUCHSTABENFEE DECKT ' + game.revealLetter + ' AUF ...';
    } else {
      $('keyboardPrompt').textContent = 'BUCHSTABEN WÄHLEN';
    }
    $('wheelText').textContent = game.phase === 'intro'
      ? 'RUNDE ' + game.round + ': SONDERFELDER LEUCHTEN AUF ...'
      : game.phase === 'spinning' ? 'DAS GLÜCKSRAD DREHT SICH ...'
      : game.landed ? 'LETZTER DREH: ' + game.landed : 'DEIN NÄCHSTER DREH WARTET';
    document.querySelector('.wheel-card').classList.toggle('spinning', game.phase === 'spinning');
    const expected = game.phase === 'consonant' ? 'consonant' : game.phase === 'vowel' ? 'vowel' : 'none';
    $('keyboard').querySelectorAll('button[data-letter]').forEach(key => {
      const letter = key.dataset.letter;
      const used = game.used.has(letter);
      const correctType = expected === 'consonant' ? !isVowel(letter) : expected === 'vowel' && isVowel(letter);
      const selectable = canAct && !used && correctType;
      key.disabled = !selectable;
      key.classList.toggle('used', used);
      key.classList.toggle('hit', used && game.outcomes[letter] === true);
      key.classList.toggle('miss', used && game.outcomes[letter] === false);
      key.classList.toggle('selectable', selectable);
      key.title = used ? 'Bereits verwendet' : (selectable ? 'Buchstabe ' + letter + ' wählen' : 'Zurzeit nicht wählbar');
    });
    updateMobileControls();
    persistGame();
  }
  function canBuyVowel() {
    return game && player().bank >= VOWEL_COST && [...VOWELS].some(v => !game.used.has(v));
  }

  function spinWheel() {
    if (!game || game.phase !== 'idle') return;
    const sectorIndex = Math.floor(Math.random() * wheelSectors.length);
    const sector = wheelSectors[sectorIndex];
    const token = runToken;
    const wobble = (Math.random() - .5) * STEP * .60;
    const desired = ((360 - sectorIndex * STEP + wobble) % 360 + 360) % 360;
    const current = ((wheelAngle % 360) + 360) % 360;
    const extra = (desired - current + 360) % 360;
    const turns = cpuActive() ? 4 : 5;
    const distance = turns * 360 + extra;
    const duration = prefersReducedMotion ? 650 : cpuActive() ? 2950 : 4000;
    const start = performance.now();
    const from = wheelAngle;
    game.phase = 'spinning';
    game.pendingSpinSector = sectorIndex;
    game.pendingSpinAngle = from + distance;
    game.status = player().name + ' dreht am Rad ...';
    render();
    sound('spin');
    let lastSectorBoundary = Math.floor((from + STEP / 2) / STEP);
    let lastTickAt = 0;
    function animate(time) {
      if (token !== runToken || !game) return;
      const progress = Math.min(1, (time - start) / duration);
      const ease = 1 - Math.pow(1 - progress, 4);
      const angle = from + distance * ease;
      $('wheelDisc').style.transform = 'rotate(' + angle.toFixed(2) + 'deg)';
      const boundary = Math.floor((angle + STEP / 2) / STEP);
      if (boundary !== lastSectorBoundary && time - lastTickAt > 43) {
        sound('tick');
        lastTickAt = time;
        lastSectorBoundary = boundary;
      }
      if (progress < 1) {
        spinFrame = requestAnimationFrame(animate);
      } else {
        spinFrame = null;
        wheelAngle = from + distance;
        $('wheelDisc').style.transform = 'rotate(' + wheelAngle + 'deg)';
        handleSpinResult(sector);
      }
    }
    spinFrame = requestAnimationFrame(animate);
  }
  function handleSpinResult(sector) {
    if (!game) return;
    game.pendingSpinSector = null;
    game.pendingSpinAngle = null;
    game.landed = sector.effect === 'bankrupt' ? 'BANKROTT' : sector.effect === 'skip' ? 'AUSSETZEN' : sector.effect === 'extra' ? 'EXTRADREH' : number(sector.points) + ' PUNKTE';
    if (sector.effect === 'bankrupt') {
      player().bank = 0;
      sound('bankrupt');
      passTurn('BANKROTT! Der gesamte Rundentopf ist weg.');
      return;
    }
    if (sector.effect === 'skip') {
      sound('miss');
      passTurn('AUSSETZEN! Der nächste Spieler ist dran.');
      return;
    }
    if (sector.effect === 'extra') {
      game.value = null;
      game.phase = 'idle';
      game.status = 'EXTRADREH! ' + player().name + ' darf direkt noch einmal drehen.';
      sound('hit');
      render();
      maybeComputerTurn();
      return;
    }
    game.value = sector.points;
    game.phase = 'consonant';
    game.status = number(sector.points) + ' Punkte pro Treffer. Wähle einen Konsonanten!';
    tone(660, .11, 'triangle', .038);
    render();
    if (cpuActive()) later(() => computerGuess(false), cpuConfig().think);
  }
  function chooseVowel() {
    if (!game || player().type !== 'human') return;
    if (game.phase === 'vowel') {
      game.phase = 'idle';
      game.status = 'Vokalkauf abgebrochen. Du bist weiter am Zug.';
      render();
      return;
    }
    if (game.phase !== 'idle' || !canBuyVowel()) return;
    game.phase = 'vowel';
    game.status = 'Wähle einen Vokal. 250 Punkte werden beim Raten abgezogen.';
    render();
  }
  function guessLetter(letter, isCpu) {
    if (!game || !ALL_KEYS.includes(letter) || game.used.has(letter)) return;
    if (player().type === 'cpu' !== !!isCpu) return;
    if (game.phase !== 'consonant' && game.phase !== 'vowel') return;
    const vowel = game.phase === 'vowel';
    if (isVowel(letter) !== vowel) return;
    if (vowel) {
      if (player().bank < VOWEL_COST) return;
      player().bank -= VOWEL_COST;
    }
    game.used.add(letter);
    const hits = [...game.phrase].filter(c => c === letter).length;
    game.outcomes[letter] = hits > 0;
    showLetterCallout(letter, game.current, hits > 0);
    if (hits > 0) {
      if (!vowel) player().bank += hits * game.value;
      game.status = hits + ' Treffer für ' + letter + '! Die Buchstabenfee deckt sie nacheinander auf.';
      // Der Buchstabe ist geraten, aber die Tiles werden erst beim Umdrehen sichtbar.
      // Der Index erlaubt das Fortsetzen einer unterbrochenen Animation.
      game.revealLetter = letter;
      game.revealIndex = 0;
      game.phase = 'revealing';
      render();
      startRevealSequence();
    } else {
      sound('miss');
      updateBoard();
      passTurn('Leider kein ' + letter + ' im Rätsel. Zugwechsel!', prefersReducedMotion ? 400 : 1600);
    }
  }
  function advanceTurn() {
    if (!game || game.phase !== 'handover') return;
    game.current = (game.current + 1) % 3;
    game.phase = 'idle';
    game.pendingTransition = null;
    game.status = player().type === 'cpu'
      ? player().name + ' überlegt den nächsten Zug ...'
      : player().name + ' ist dran. Rad drehen, Vokal kaufen oder lösen!';
    render();
    maybeComputerTurn();
  }
  function passTurn(message, delay = prefersReducedMotion ? 300 : 1050) {
    if (!game || game.phase === 'solved') return;
    game.phase = 'handover';
    game.pendingTransition = 'next-player';
    game.value = null;
    game.status = message;
    render();
    later(advanceTurn, delay);
  }
  function passByUser() {
    if (!game || player().type !== 'human' || game.phase !== 'idle') return;
    sound('miss');
    passTurn(player().name + ' gibt den Zug freiwillig ab.');
  }
  function openSolve() {
    if (!game || game.phase !== 'idle' || player().type !== 'human') return;
    $('answerInput').value = '';
    setOverlay('solveOverlay', true);
    later(() => $('answerInput').focus({ preventScroll: true }), 45);
  }
  function submitSolution(event) {
    event.preventDefault();
    if (!game || !overlayVisible('solveOverlay')) return;
    const answer = $('answerInput').value.trim();
    if (!answer) return;
    setOverlay('solveOverlay', false);
    if (simplifiedAnswer(answer) === simplifiedAnswer(game.phrase)) {
      finishRound(game.current);
    } else {
      sound('miss');
      passTurn('Falscher Lösungsversuch! Der nächste Spieler ist dran.');
    }
  }
  function allNotUsed(vowel) {
    return ALL_KEYS.filter(c => isVowel(c) === vowel && !game.used.has(c));
  }
  function chooseComputerLetter(vowel, config) {
    const options = allNotUsed(vowel);
    const correct = options.filter(c => game.phrase.includes(c));
    const incorrect = options.filter(c => !game.phrase.includes(c));
    const pickCorrect = Math.random() < config.accuracy;
    const selection = pickCorrect && correct.length ? correct : incorrect.length ? incorrect : correct;
    if (!selection.length) return null;
    if (selection === correct) {
      // Häufige Buchstaben werden etwas bevorzugt, ungewöhnliche bleiben möglich.
      const frequency = 'ENRISTADHULGOMBCFWKPVÄÖÜQXJYZ';
      const weighted = selection.map(c => ({ c, weight: Math.max(1, 18 - Math.floor(frequency.indexOf(c) / 2)) }));
      const sum = weighted.reduce((n, p) => n + p.weight, 0);
      let target = Math.random() * sum;
      for (const option of weighted) {
        target -= option.weight;
        if (target <= 0) return option.c;
      }
    }
    return randomItem(selection);
  }
  function cpuConfig() {
    return DIFFICULTIES[player().difficulty] || DIFFICULTIES.medium;
  }
  function maybeComputerTurn() {
    if (!game || !cpuActive() || game.phase !== 'idle') return;
    const token = runToken;
    const config = cpuConfig();
    later(() => {
      if (token !== runToken || !game || !cpuActive() || game.phase !== 'idle') return;
      const coverage = letterCoverage();
      const consonantsLeft = allNotUsed(false);
      const vowelsLeft = allNotUsed(true);
      const noConsonants = !consonantsLeft.some(letter => game.phrase.includes(letter));
      const forcedSolve = noConsonants && (player().bank < VOWEL_COST || vowelsLeft.length === 0);
      if (forcedSolve || (coverage >= config.solveFrom && Math.random() < config.solveChance)) {
        game.status = player().name + ' versucht, das Rätsel zu lösen ...';
        render();
        later(() => {
          if (!game || !cpuActive() || game.phase !== 'idle') return;
          if (Math.random() < config.solveAccuracy || coverage >= .96) {
            finishRound(game.current);
          } else {
            sound('miss');
            passTurn(player().name + ' konnte das Rätsel noch nicht lösen!');
          }
        }, config.think);
      } else if (player().bank >= VOWEL_COST && vowelsLeft.length && Math.random() < config.vowelChance) {
        game.phase = 'vowel';
        game.status = player().name + ' kauft einen Vokal für 250 Punkte ...';
        render();
        later(() => computerGuess(true), config.think);
      } else if (noConsonants && vowelsLeft.length && player().bank >= VOWEL_COST) {
        game.phase = 'vowel';
        game.status = player().name + ' kauft einen Vokal ...';
        render();
        later(() => computerGuess(true), config.think);
      } else {
        spinWheel();
      }
    }, config.think);
  }
  function computerGuess(vowel) {
    if (!game || !cpuActive() || game.phase !== (vowel ? 'vowel' : 'consonant')) return;
    const letter = chooseComputerLetter(vowel, cpuConfig());
    if (!letter) {
      if (vowel) {
        game.phase = 'idle';
        maybeComputerTurn();
      } else {
        passTurn('Keine Konsonanten mehr übrig. Der Zug geht weiter.');
      }
      return;
    }
    game.status = player().name + ' tippt auf ' + letter + ' ...';
    render();
    later(() => guessLetter(letter, true), 330);
  }

  function revealEntirePuzzle() {
    for (const char of game.phrase) if (isLetter(char)) game.used.add(char);
    updateBoard();
  }
  function confetti() {
    if (prefersReducedMotion) return;
    const layer = $('confettiLayer');
    layer.replaceChildren();
    const colors = ['#ffe05d', '#55e6e5', '#fa74ad', '#ffffff', '#9c84e8'];
    for (let i = 0; i < 65; i++) {
      const bit = document.createElement('span');
      bit.className = 'confetti-bit';
      bit.style.left = Math.random() * 100 + '%';
      bit.style.background = randomItem(colors);
      bit.style.setProperty('--dur', (2.2 + Math.random() * 2.0) + 's');
      bit.style.setProperty('--drift', (Math.random() * 180 - 90) + 'px');
      bit.style.setProperty('--turn', (Math.random() * 1200 - 600) + 'deg');
      bit.style.animationDelay = Math.random() * .65 + 's';
      layer.appendChild(bit);
    }
    later(() => layer.replaceChildren(), 5000);
  }
  function finishRound(winnerIndex) {
    if (!game || game.phase === 'solved') return;
    clearLetterCallout();
    const winner = game.players[winnerIndex];
    const amount = winner.bank + SOLVE_BONUS;
    winner.total += amount;
    game.endRoundWinner = winnerIndex;
    game.endRoundPrize = amount;
    game.players.forEach(p => { p.bank = 0; });
    game.phase = 'solved';
    game.pendingTransition = null;
    game.status = winner.name + ' löst das Rätsel und gewinnt ' + number(amount) + ' Punkte!';
    revealEntirePuzzle();
    render();
    sound('win');
    confetti();
    fillResult();
    // Die Fee klatscht und huepft sichtbar, bevor die Ergebnistafel erscheint.
    fairy.celebrate(() => {
      if (game && game.phase === 'solved' && !overlayVisible('setupOverlay')) setOverlay('roundOverlay', true);
    });
  }
  function fillResult() {
    if (!game) return;
    const lastRound = game.round === ROUNDS;
    $('resultAnswer').textContent = game.phrase;
    $('resultPoints').textContent = '+' + number(game.endRoundPrize) + ' PUNKTE IN RUNDE ' + game.round;
    $('roundResultTopline').textContent = lastRound ? '✦ DIE LETZTE RUNDE IST VORBEI ✦' : '✦ RUNDE ' + game.round + ' GESCHAFFT ✦';
    $('nextRoundBtn').innerHTML = lastRound ? 'NEUE PARTIE <span aria-hidden="true">↻</span>' : 'NÄCHSTE RUNDE <span aria-hidden="true">→</span>';
    $('finalStandings').hidden = !lastRound;
    if (lastRound) {
      const ranked = game.players.map((p, i) => ({ ...p, index: i })).sort((a, b) => b.total - a.total);
      const leaders = ranked.filter(p => p.total === ranked[0].total);
      $('roundResultTitle').textContent = leaders.length > 1 ? 'GLEICHSTAND!' : 'SPIELSIEG!';
      $('resultWinner').textContent = leaders.length > 1 ? 'GEMEINSAMER SIEG: ' + leaders.map(p => upper(p.name)).join(' & ') : upper(leaders[0].name) + ' GEWINNT DIE SHOW!';
      $('finalStandings').replaceChildren();
      ranked.forEach((p, idx) => {
        const placement = idx && p.total === ranked[idx - 1].total
          ? ranked.findIndex(other => other.total === p.total) + 1 : idx + 1;
        const row = document.createElement('div');
        row.className = 'standing-row';
        const left = document.createElement('span');
        left.textContent = placement + '. ' + p.name;
        const right = document.createElement('strong');
        right.textContent = number(p.total) + ' PKT';
        row.append(left, right);
        $('finalStandings').appendChild(row);
      });
    } else {
      $('roundResultTitle').textContent = 'GELÖST!';
      $('resultWinner').textContent = upper(game.players[game.endRoundWinner].name) + ' GEWINNT DIE RUNDE!';
    }
  }
  function nextRound() {
    if (!game || game.phase !== 'solved') return;
    setOverlay('roundOverlay', false);
    if (game.round >= ROUNDS) {
      openSetup();
    } else {
      startRound();
    }
  }

  function handleKeyboard(event) {
    if (event.key === 'Escape') {
      if (menuIsOpen()) { event.preventDefault(); closeScoreMenu(true); return; }
      if (overlayVisible('helpOverlay')) setOverlay('helpOverlay', false);
      else if (overlayVisible('solveOverlay')) setOverlay('solveOverlay', false);
      else if (overlayVisible('setupOverlay') && game) closeSetup();
      return;
    }
    if (!game || menuIsOpen() || overlayVisible('setupOverlay') || overlayVisible('helpOverlay') || overlayVisible('solveOverlay') || overlayVisible('roundOverlay')) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'Space' && game.phase === 'idle' && !cpuActive()) {
      event.preventDefault();
      spinWheel();
      return;
    }
    const letter = upper(event.key);
    if (ALL_KEYS.includes(letter) && player().type === 'human') guessLetter(letter, false);
  }
  function bindEvents() {
    for (let i = 0; i < 3; i++) {
      $('type' + i).addEventListener('change', () => playerTypeChanged(i));
    }
    $('fairySelect').addEventListener('change', () => setFairySelection($('fairySelect').value));
    $('startBtn').addEventListener('click', newGame);
    $('categorySelect').addEventListener('change', updateHistoryInfo);
    $('resetHistoryBtn').addEventListener('click', resetPuzzleHistory);
    $('resumeBtn').addEventListener('click', resumeGame);
    $('scoreMenuBtn').addEventListener('click', toggleScoreMenu);
    document.addEventListener('pointerdown', event => {
      if (menuIsOpen() && !$('scoreMenu').contains(event.target)) closeScoreMenu();
    });
    $('newGameBtn').addEventListener('click', () => { closeScoreMenu(); openSetup(); });
    $('setupClose').addEventListener('click', closeSetup);
    $('helpBtn').addEventListener('click', () => { closeScoreMenu(); setOverlay('helpOverlay', true); });
    $('helpClose').addEventListener('click', () => setOverlay('helpOverlay', false));
    $('helpDoneBtn').addEventListener('click', () => setOverlay('helpOverlay', false));
    $('soundBtn').addEventListener('click', () => { soundOn = !soundOn; refreshSoundButton(); persistGame(); if (soundOn) sound('hit'); closeScoreMenu(true); });
    $('spinBtn').addEventListener('click', () => { if (game && player().type === 'human' && game.phase === 'idle') spinWheel(); });
    $('vowelBtn').addEventListener('click', chooseVowel);
    $('solveBtn').addEventListener('click', openSolve);
    $('passBtn').addEventListener('click', passByUser);
    $('mobilePassBtn').addEventListener('click', passByUser);
    $('solveClose').addEventListener('click', () => setOverlay('solveOverlay', false));
    $('solveForm').addEventListener('submit', submitSolution);
    $('nextRoundBtn').addEventListener('click', nextRound);
    document.addEventListener('keydown', handleKeyboard);
    window.addEventListener('resize', () => { sizeBoardTiles(); fairy.handleResize(); updateMobileControls(); positionLetterCallout(); });
    window.addEventListener('storage', event => {
      if (event.key === puzzleHistory.STORAGE_KEY || event.key === null) setupCategoryOptions();
    });
  }
  function init() {
    drawWheel();
    buildKeyboard();
    setupFairyOptions();
    setupCategoryOptions();
    fairy.setVariant(fairy.defaultVariant());
    bindEvents();
    refreshSoundButton();
    const saved = readSavedGame();
    if (saved) {
      // Alte Speicherstände enthielten noch keinen separaten Rätselverlauf.
      // Das aktuelle Rätsel lässt sich beim Upgrade nachtragen.
      if (saved.version < SAVE_VERSION) puzzleHistory.record(saved.phrase);
      setupCategoryOptions();
      setConfigFromPlayers(saved.players);
      setFairySelection(saved.fairyId || fairy.defaultVariant());
      setCategorySelection(saved.categoryFilter);
      soundOn = saved.soundOn !== false;
      refreshSoundButton();
    }
    refreshResumePanel();
    if (!Array.isArray(window.GLUECKSRAD_WOERTER)) {
      $('setupTitle').textContent = 'WÖRTER FEHLEN';
      $('startBtn').disabled = true;
      $('setupOverlay').querySelector('.modal-description').textContent =
        'Bitte woerter.js im selben Ordner wie index.html ablegen. Gespeicherte Shows können trotzdem fortgesetzt werden.';
    }
  }
  init();
})();
