/* GLÜCKSRAD – eigenständiges Offline-Spiel. Keine Bibliotheken nötig. */
(() => {
  'use strict';

  const ROUNDS = 5;
  const SAVE_KEY = 'gluecksradGame';
  const SAVE_VERSION = 6;
  const VOWEL_COST = 250;
  const SOLVE_BONUS = 500;
  const VOWELS = 'AEIOUÄÖÜ';
  const KEY_ROWS = ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', 'YXCVBNM'];
  const ALL_KEYS = KEY_ROWS.join('').split('');
  const SECTORS = [
    { label: '100', points: 100, color: '#f7ca6b' },
    { label: '400', points: 400, color: '#5bd3dd' },
    { label: '250', points: 250, color: '#f79ab8' },
    { label: '600', points: 600, color: '#c4a7f4' },
    { label: '150', points: 150, color: '#f9df89' },
    { label: '800', points: 800, color: '#91dfb0' },
    { label: '200', points: 200, color: '#f9a776' },
    { label: 'BANKROTT', effect: 'bankrupt', color: '#35223e', light: true },
    { label: '500', points: 500, color: '#57d4de' },
    { label: '300', points: 300, color: '#fedb73' },
    { label: '900', points: 900, color: '#f4a0ba' },
    { label: '100', points: 100, color: '#aedcbd' },
    { label: '700', points: 700, color: '#e3b3f0' },
    { label: 'AUSSETZEN', effect: 'skip', color: '#b14e73', light: true },
    { label: '350', points: 350, color: '#f3b68f' },
    { label: '1200', points: 1200, color: '#ffe783' },
    { label: '200', points: 200, color: '#7fcfde' },
    { label: '500', points: 500, color: '#efa7e2' }
  ];
  const STEP = 360 / SECTORS.length;
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
  let runToken = 0;
  let toastTimer = null;
  const timers = new Set();
  const fairy = window.GluecksradFee;
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
    for (const id of timers) clearTimeout(id);
    timers.clear();
    if (spinFrame !== null) cancelAnimationFrame(spinFrame);
    spinFrame = null;
    runToken += 1;
    $('confettiLayer').replaceChildren();
    fairy.cancel();
  }
  function upper(text) {
    return String(text).toLocaleUpperCase('de-DE');
  }
  function normalizePuzzle(text) {
    // Fremdsprachige Akzente auf Grundbuchstaben abbilden; Umlaute bleiben eigenständig.
    return upper(text).replace(/ẞ/g, 'SS').replace(/[ÉÈÊË]/g, 'E').replace(/[ÁÀÂ]/g, 'A')
      .replace(/[ÍÌÎÏ]/g, 'I').replace(/[ÓÒÔ]/g, 'O').replace(/[ÚÙÛ]/g, 'U').replace(/Ç/g, 'C');
  }
  function simplifiedAnswer(text) {
    return upper(text).replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ẞ/g, 'SS').replace(/[^A-Z0-9]/g, '');
  }
  function isLetter(char) {
    return /^[A-ZÄÖÜ]$/.test(char);
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

  function drawWheel() {
    const canvas = $('wheelCanvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const r = 293, center = 300;
    const step = Math.PI * 2 / SECTORS.length;
    ctx.clearRect(0, 0, 600, 600);
    SECTORS.forEach((sector, i) => {
      const a = -Math.PI / 2 + i * step;
      const start = a - step / 2;
      const end = a + step / 2;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, r, start, end);
      ctx.closePath();
      ctx.fillStyle = sector.color;
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#4a2c53';
      ctx.stroke();
      ctx.save();
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
      } else {
        ctx.font = '900 25px system-ui, sans-serif';
        ctx.fillText(sector.label, 0, 0);
      }
      ctx.restore();
    });
    ctx.save();
    ctx.translate(center, center);
    ctx.beginPath();
    ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#fff1b6';
    ctx.stroke();
    for (let i = 0; i < SECTORS.length; i++) {
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
    return !!snapshot && [2, 3, 4, 5, SAVE_VERSION].includes(snapshot.version) &&
      (snapshot.phase !== 'revealing' || (
        ALL_KEYS.includes(snapshot.revealLetter) &&
        Number.isInteger(snapshot.revealIndex) && snapshot.revealIndex >= 0 &&
        snapshot.revealIndex <= [...snapshot.phrase].filter(c => c === snapshot.revealLetter).length)) &&
      Array.isArray(snapshot.players) && snapshot.players.length === 3 && snapshot.players.every(validPlayer) &&
      Number.isInteger(snapshot.round) && snapshot.round >= 1 && snapshot.round <= ROUNDS &&
      Number.isInteger(snapshot.current) && snapshot.current >= 0 && snapshot.current < 3 &&
      Array.isArray(snapshot.deck) && snapshot.deck.every(p => p && typeof p.text === 'string' && typeof p.category === 'string') &&
      typeof snapshot.phrase === 'string' && snapshot.phrase.length >= 4 &&
      typeof snapshot.category === 'string' && Array.isArray(snapshot.used) &&
      snapshot.used.every(isLetter) && typeof snapshot.outcomes === 'object' && snapshot.outcomes !== null &&
      ['idle', 'spinning', 'consonant', 'vowel', 'handover', 'solved', 'revealing'].includes(snapshot.phase) &&
      Number.isFinite(snapshot.wheelAngle) &&
      (snapshot.phase !== 'spinning' ||
        (Number.isInteger(snapshot.pendingSpinSector) && snapshot.pendingSpinSector >= 0 &&
         snapshot.pendingSpinSector < SECTORS.length && Number.isFinite(snapshot.pendingSpinAngle))) &&
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
    $('resumeSummary').textContent = 'Runde ' + snapshot.round + ' / ' + ROUNDS + ' · ' + currentLabel +
      ' · ' + snapshot.players.map(p => p.name + ': ' + number(p.total)).join(' / ');
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
        players: game.players.map(p => ({ ...p })),
        round: game.round,
        deck: game.deck.map(p => ({ ...p })),
        previousCategory: game.previousCategory,
        current: game.current,
        phrase: game.phrase,
        category: game.category,
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
    if (game) {
      // Das Show-Menue pausiert Timer, Computerzuege und Radanimation.
      stopPending();
      setConfigFromPlayers(game.players);
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

  function newGame() {
    const oldSave = readSavedGame();
    const last = oldSave || game;
    if (last && !(last.phase === 'solved' && last.round === ROUNDS) &&
        !window.confirm('Die gespeicherte Show wird ersetzt. Eine neue Show starten?')) return;
    const words = (Array.isArray(window.GLUECKSRAD_WOERTER) ? window.GLUECKSRAD_WOERTER : [])
      .filter(item => item && typeof item.text === 'string' && item.text.trim().length >= 4)
      .map(item => ({ text: normalizePuzzle(item.text.trim()), category: String(item.kategorie || 'Begriff').trim() || 'Begriff' }));
    if (words.length < ROUNDS) {
      toast('Bitte mindestens fünf Rätsel in woerter.js eintragen.');
      return;
    }
    stopPending();
    wheelAngle = 0;
    $('wheelDisc').style.transform = 'rotate(0deg)';
    game = {
      players: configuredPlayers(),
      round: 0,
      deck: shuffled(words),
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
      used: new Set(snapshot.used),
      outcomes: { ...snapshot.outcomes }
    };
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
    if (game.phase === 'spinning') {
      // Ein bereits ausgeloster Dreh wird nicht noch einmal ausgewuerfelt.
      const sector = SECTORS[game.pendingSpinSector];
      wheelAngle = game.pendingSpinAngle;
      $('wheelDisc').style.transform = 'rotate(' + wheelAngle + 'deg)';
      handleSpinResult(sector);
    } else if (game.phase === 'revealing') {
      runRevealSequence();
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
    let index = game.deck.findIndex(entry => entry.category !== game.previousCategory);
    if (index < 0) index = 0;
    const [entry] = game.deck.splice(index, 1);
    game.previousCategory = entry.category;
    return entry;
  }
  function startRound() {
    if (!game || game.round >= ROUNDS) return;
    game.round++;
    const puzzle = choosePuzzle();
    game.phrase = puzzle.text;
    game.category = puzzle.category;
    game.used = new Set();
    game.outcomes = {};
    game.current = (game.round - 1) % 3;
    game.phase = 'idle';
    game.value = null;
    game.landed = null;
    game.pendingSpinSector = null;
    game.pendingSpinAngle = null;
    game.pendingTransition = null;
    game.revealLetter = null;
    game.revealIndex = 0;
    game.players.forEach(p => { p.bank = 0; });
    game.status = 'Drehe das Rad und sammle Punkte!';
    buildBoard();
    sizeBoardTiles();
    updateBoard();
    fairy.home();
    render();
    maybeComputerTurn();
  }

  function buildBoard() {
    const board = $('puzzleBoard');
    const fee = $('feeCharacter');
    board.replaceChildren();
    const tokens = game.phrase.match(/\S+|\s+/g) || [];
    for (const token of tokens) {
      const word = document.createElement('div');
      word.className = 'word';
      if (/^\s+$/.test(token)) {
        word.classList.add('space-group');
        for (let i = 0; i < token.length; i++) {
          const spaceTile = document.createElement('span');
          spaceTile.className = 'tile space-tile';
          spaceTile.setAttribute('aria-hidden', 'true');
          word.appendChild(spaceTile);
        }
      } else {
        for (const character of token) {
          const tile = document.createElement('span');
          if (isLetter(character)) {
            tile.className = 'tile';
            tile.dataset.letter = character;
            tile.setAttribute('aria-label', 'Verdeckter Buchstabe');
            const inner = document.createElement('span');
            inner.className = 'tile-letter';
            inner.textContent = character;
            inner.setAttribute('aria-hidden', 'true');
            tile.appendChild(inner);
          } else {
            tile.className = 'tile revealed static-tile';
            tile.textContent = character;
            tile.setAttribute('aria-label', 'Sonderzeichen ' + character);
          }
          word.appendChild(tile);
        }
      }
      board.appendChild(word);
    }
    // Die Fee ist absolut positioniert, nimmt keinen Platz im Flex-Tile-Raster ein.
    board.appendChild(fee);
  }
  function sizeBoardTiles() {
    if (!game) return;
    const board = $('puzzleBoard');
    const longest = Math.max(1, ...game.phrase.split(/\s+/).map(word => word.length));
    const viewport = window.innerWidth;
    const gap = viewport <= 440 ? 3 : 4;
    const natural = viewport <= 440 ? Math.min(27, Math.max(19, viewport * .064))
      : viewport <= 760 ? Math.min(34, viewport * .052) : Math.min(38, viewport * .032);
    const style = getComputedStyle(board);
    const innerWidth = board.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
    const fit = (innerWidth - 10 - (longest - 1) * gap) / longest;
    board.style.setProperty('--tile-size', Math.max(12, Math.min(natural, fit)).toFixed(2) + 'px');
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
      // Pro Treffer genau ein Bing; der Buchstabe leuchtet bis zur Umdrehung.
      sound('bing');
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
    $('wheelText').textContent = game.phase === 'spinning'
      ? 'DAS GLÜCKSRAD DREHT SICH ...'
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
    persistGame();
  }
  function canBuyVowel() {
    return game && player().bank >= VOWEL_COST && [...VOWELS].some(v => !game.used.has(v));
  }

  function spinWheel() {
    if (!game || game.phase !== 'idle') return;
    const sectorIndex = Math.floor(Math.random() * SECTORS.length);
    const sector = SECTORS[sectorIndex];
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
    game.landed = sector.effect === 'bankrupt' ? 'BANKROTT' : sector.effect === 'skip' ? 'AUSSETZEN' : number(sector.points) + ' PUNKTE';
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
    if (hits > 0) {
      if (!vowel) player().bank += hits * game.value;
      game.status = hits + ' Treffer für ' + letter + '! Die Buchstabenfee deckt sie nacheinander auf.';
      // Der Buchstabe ist geraten, aber die Tiles werden erst beim Umdrehen sichtbar.
      // Der Index erlaubt das Fortsetzen einer unterbrochenen Animation.
      game.revealLetter = letter;
      game.revealIndex = 0;
      game.phase = 'revealing';
      render();
      runRevealSequence();
    } else {
      sound('miss');
      updateBoard();
      passTurn('Leider kein ' + letter + ' im Rätsel. Zugwechsel!');
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
  function passTurn(message) {
    if (!game || game.phase === 'solved') return;
    game.phase = 'handover';
    game.pendingTransition = 'next-player';
    game.value = null;
    game.status = message;
    render();
    later(advanceTurn, prefersReducedMotion ? 300 : 1050);
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
    $('startBtn').addEventListener('click', newGame);
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
    $('solveClose').addEventListener('click', () => setOverlay('solveOverlay', false));
    $('solveForm').addEventListener('submit', submitSolution);
    $('nextRoundBtn').addEventListener('click', nextRound);
    document.addEventListener('keydown', handleKeyboard);
    window.addEventListener('resize', () => { sizeBoardTiles(); fairy.handleResize(); });
  }
  function init() {
    drawWheel();
    buildKeyboard();
    bindEvents();
    refreshSoundButton();
    const saved = readSavedGame();
    if (saved) {
      setConfigFromPlayers(saved.players);
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
