/* Gemeinsamer 12-Kachel-Renderer für Spiel und Archiv. Keine Bibliotheken / kein Server. */
(() => {
  'use strict';
  function normalizePuzzle(text) {
    return String(text).toLocaleUpperCase('de-DE').replace(/ẞ/g, 'SS')
      .replace(/[ÉÈÊË]/g, 'E').replace(/[ÁÀÂ]/g, 'A')
      .replace(/[ÍÌÎÏ]/g, 'I').replace(/[ÓÒÔ]/g, 'O')
      .replace(/[ÚÙÛ]/g, 'U').replace(/Ç/g, 'C');
  }
  function isLetter(char) { return /^[A-ZÄÖÜ]$/.test(char); }
  const MAX_TILES_PER_LINE = 12;
  // Lange Bindestrichwörter bevorzugt NACH dem Bindestrich trennen.
  // Beispiel: VOGEL- | GEZWITSCHER (6 + 11 Kacheln). Der Bindestrich
  // bleibt bei einem Zeilenwechsel am Ende des vorherigen Wortteils.
  function hyphenPieces(characters) {
    const pieces = [];
    let from = 0;
    for (let i = 1; i + 1 < characters.length; i++) {
      if (characters[i] === '-' && isLetter(characters[i - 1]) && isLetter(characters[i + 1])) {
        pieces.push(characters.slice(from, i + 1));
        from = i + 1;
      }
    }
    pieces.push(characters.slice(from));
    return pieces;
  }
  // Fallback für Teilstücke, die selbst ohne weitere zulässige Trennstelle
  // länger als zwölf Kacheln sind: möglichst gleichmäßig aufteilen.
  function balancedPieces(characters) {
    const result = [];
    const parts = characters.slice();
    while (parts.length) {
      const segments = Math.ceil(parts.length / MAX_TILES_PER_LINE);
      const amount = Math.ceil(parts.length / segments);
      result.push(parts.splice(0, amount));
    }
    return result;
  }
  function needsManualSplit(phrase) {
    return (normalizePuzzle(phrase).match(/\S+/g) || []).some(token => {
      const chars = [...token];
      return chars.length > MAX_TILES_PER_LINE &&
        hyphenPieces(chars).some(part => part.length > MAX_TILES_PER_LINE);
    });
  }
  function buildBoard(board, phrase, revealAll = false) {
    board.replaceChildren();
    const lines = document.createElement('div');
    lines.className = 'puzzle-lines';
    board.appendChild(lines);
    let line = null;
    let occupied = 0;
    const newLine = () => {
      line = document.createElement('div');
      line.className = 'puzzle-line';
      lines.appendChild(line);
      occupied = 0;
    };
    const addWord = (characters, continuation = false) => {
      // Mehrere Teile desselben Bindestrichworts auf derselben Zeile sind
      // EIN Wort: keine optisch falschen Zwischenabstände einfügen.
      let word = continuation ? line.lastElementChild : null;
      if (!word || !word.classList.contains('word') || word.classList.contains('space-group')) {
        word = document.createElement('div');
        word.className = 'word';
        line.appendChild(word);
      }
      for (const character of characters) {
        const tile = document.createElement('span');
        if (isLetter(character)) {
          tile.className = revealAll ? 'tile revealed' : 'tile';
          tile.dataset.letter = character;
          tile.setAttribute('aria-label', (revealAll ? 'Buchstabe ' + character : 'Verdeckter Buchstabe'));
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
      occupied += characters.length;
    };
    const addSpace = count => {
      const group = document.createElement('div');
      group.className = 'word space-group';
      for (let i = 0; i < count; i++) {
        const tile = document.createElement('span');
        tile.className = 'tile space-tile';
        tile.setAttribute('aria-hidden', 'true');
        group.appendChild(tile);
      }
      line.appendChild(group);
      occupied += count;
    };
    newLine();
    let pendingSpaces = 0;
    for (const token of phrase.match(/\S+|\s+/g) || []) {
      if (/^\s+$/.test(token)) { pendingSpaces += [...token].length; continue; }
      const letters = [...token];
      // Ganze Wörter bis zwölf Zeichen zusammenhalten. Überlange Wörter
      // beginnen wie bisher auf einer neuen Zeile.
      if (occupied && occupied + pendingSpaces + letters.length > MAX_TILES_PER_LINE) {
        newLine();
        pendingSpaces = 0;
      }
      // V19: Vorrang für explizite Bindestriche bei überlangen Wörtern.
      // Der Bindestrich zählt zum ENDE des vorherigen Wortteils.
      // Bei Wörtern, die ganz in eine Reihe passen, bleibt alles unverändert.
      const hyphenParts = letters.length > MAX_TILES_PER_LINE ? hyphenPieces(letters) : [letters];
      if (hyphenParts.length > 1) {
        let continuation = false;
        for (const part of hyphenParts) {
          for (const chunk of balancedPieces(part)) {
            if (occupied && occupied + chunk.length > MAX_TILES_PER_LINE) newLine();
            addWord(chunk, continuation);
            continuation = true;
          }
        }
        continue;
      }
      while (letters.length) {
        const spaces = occupied ? Math.min(pendingSpaces, MAX_TILES_PER_LINE - occupied) : 0;
        if (occupied && occupied + spaces >= MAX_TILES_PER_LINE) {
          newLine();
          pendingSpaces = 0;
          continue;
        }
        if (spaces) addSpace(spaces);
        pendingSpaces = 0;
        // Überlange Einzelwörter gleichmäßig verteilen, statt einen
        // einzelnen Buchstaben in der letzten Zeile stehen zu lassen.
        const minSegments = Math.ceil(letters.length / MAX_TILES_PER_LINE);
        const balanced = occupied === 0 && minSegments > 1
          ? Math.ceil(letters.length / minSegments) : letters.length;
        const amount = Math.min(balanced, MAX_TILES_PER_LINE - occupied);
        addWord(letters.splice(0, amount));
        if (letters.length) newLine();
      }
    }
    // Viele Zeilen erhalten auf kleinen Bildschirmen kompaktere Feldhöhen,
    // damit alle Buchstaben innerhalb des Hintergrund-Displays bleiben.
    board.classList.toggle('many-lines', lines.children.length >= 4);
    board.classList.toggle('dense-lines', lines.children.length >= 5);
    board.classList.toggle('very-dense-lines', lines.children.length >= 6);
    return lines.children.length;
  }
  function sizeBoardTiles(board) {
    const lines = [...board.querySelectorAll('.puzzle-line')];
    if (!lines.length) return;
    const viewport = window.innerWidth;
    const natural = viewport <= 440 ? Math.min(27, Math.max(19, viewport * .064))
      : viewport <= 760 ? Math.min(34, viewport * .052) : Math.min(38, viewport * .032);
    const style = getComputedStyle(board);
    const innerWidth = Math.max(60, board.clientWidth - parseFloat(style.paddingLeft || 0)
      - parseFloat(style.paddingRight || 0) - 4);
    // Tile-Breiten sind proportional zur Sprite-Größe. Die Abstände bleiben
    // in Pixeln konstant. Rechnen statt wiederholt messen: Browser liefern
    // unmittelbar nach einer Änderung der CSS-Variablen teils alte Rects.
    let target = natural;
    for (const line of lines) {
      const groups = [...line.children];
      const lineGap = parseFloat(getComputedStyle(line).columnGap) || 0;
      let fixed = Math.max(0, groups.length - 1) * lineGap;
      let proportional = 0;
      for (const group of groups) {
        const tiles = [...group.querySelectorAll('.tile')];
        const gap = parseFloat(getComputedStyle(group).columnGap) || 0;
        fixed += Math.max(0, tiles.length - 1) * gap;
        for (const tile of tiles) proportional += tile.classList.contains('space-tile') ? .72 : 1;
      }
      if (proportional > 0) target = Math.min(target, (innerWidth - fixed) / proportional);
    }
    board.style.setProperty('--tile-size', Math.max(12, target).toFixed(2) + 'px');
  }

  window.GluecksradBrett = Object.freeze({ normalizePuzzle, isLetter, buildBoard, sizeBoardTiles, needsManualSplit, MAX_TILES_PER_LINE });
})();
