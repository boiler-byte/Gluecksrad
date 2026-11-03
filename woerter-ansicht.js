/* Lesbare, filterbare Rätselübersicht. Die Spielstände werden nie verändert. */
(() => {
  'use strict';
  const engine = window.GluecksradBrett;
  const entries = (Array.isArray(window.GLUECKSRAD_WOERTER) ? window.GLUECKSRAD_WOERTER : [])
    .filter(x => x && typeof x.text === 'string' && x.text.trim().length >= 4)
    .map((x, index) => {
      const text = x.text.trim();
      const phrase = engine.normalizePuzzle(text);
      const category = String(x.kategorie || 'Begriff').trim() || 'Begriff';
      const splitWords = (phrase.match(/\S+/g) || []).filter(x => [...x].length > engine.MAX_TILES_PER_LINE);
      return { index:index + 1, text, phrase, category, splitWords,
        search:(phrase + ' ' + category + ' ' + text).toLocaleLowerCase('de-DE') };
    });
  const $ = id => document.getElementById(id);
  const search = $('wordSearch'), categoryFilter = $('categoryFilter'), splitOnly = $('splitOnly');
  const grid = $('archiveGrid'), empty = $('archiveEmpty'), count = $('archiveCount');
  const dialog = $('archivePreview');
  const source = $('previewSource'), category = $('previewCategory');
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((records) => {
    for (const record of records) {
      if (!record.isIntersecting) continue;
      observer.unobserve(record.target);
      const item = entries[Number(record.target.dataset.index)];
      drawBoard(record.target, item);
    }
  }, { rootMargin:'550px 0px' }) : null;

  function drawBoard(board, item) {
    engine.buildBoard(board, item.phrase, true);
    engine.sizeBoardTiles(board);
    board.dataset.ready = 'true';
  }
  function makeCard(item) {
    const article = document.createElement('article');
    article.className = 'archive-entry';
    const top = document.createElement('div');
    top.className = 'archive-entry-top';
    const number = document.createElement('span');
    number.className = 'archive-index';
    number.textContent = '#' + String(item.index).padStart(3,'0');
    const kind = document.createElement('span');
    kind.className = 'archive-category';
    kind.textContent = item.category.toLocaleUpperCase('de-DE');
    top.append(number,kind);
    if (item.splitWords.length) {
      const warning = document.createElement('span');
      warning.className = 'archive-warning';
      warning.title = 'Überlange Wörter: ' + item.splitWords.join(', ');
      warning.textContent = 'TRENNUNG PRÜFEN';
      top.appendChild(warning);
    }
    const board = document.createElement('div');
    board.className = 'puzzle-board archive-board';
    board.dataset.index = String(item.index - 1);
    board.setAttribute('role','img');
    board.setAttribute('aria-label', item.phrase + '; Spielbrett mit maximal zwölf Kacheln je Zeile');
    const bottom = document.createElement('div');
    bottom.className = 'archive-entry-bottom';
    const raw = document.createElement('span');
    raw.className = 'archive-source';
    raw.textContent = item.text;
    const zoom = document.createElement('button');
    zoom.className = 'archive-open';
    zoom.type = 'button';
    zoom.textContent = 'GROSSANSICHT ↗';
    zoom.setAttribute('aria-label', item.text + ' auf der großen Rätselwand ansehen');
    zoom.addEventListener('click', () => showPreview(item));
    bottom.append(raw,zoom);
    article.append(top,board,bottom);
    if (observer) observer.observe(board);
    else requestAnimationFrame(() => drawBoard(board,item));
    return article;
  }
  function update() {
    if (observer) grid.querySelectorAll('.archive-board').forEach(board => observer.unobserve(board));
    const needle = search.value.trim().toLocaleLowerCase('de-DE');
    const selected = categoryFilter.value;
    const visible = entries.filter(item => (!needle || item.search.includes(needle)) &&
      (!selected || item.category === selected) && (!splitOnly.checked || item.splitWords.length));
    grid.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const item of visible) fragment.appendChild(makeCard(item));
    grid.appendChild(fragment);
    count.textContent = visible.length + ' von ' + entries.length + ' Rätseln';
    empty.hidden = visible.length !== 0;
  }
  function showPreview(item) {
    $('previewTitle').textContent = 'RÄTSEL #' + String(item.index).padStart(3,'0');
    category.textContent = item.category.toLocaleUpperCase('de-DE');
    source.textContent = item.text;
    dialog.showModal();
    requestAnimationFrame(() => drawBoard($('previewBoard'), item));
  }
  $('previewClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  let delayed = null;
  search.addEventListener('input', () => {
    clearTimeout(delayed);
    delayed = setTimeout(update, 120);
  });
  categoryFilter.addEventListener('change', update);
  splitOnly.addEventListener('change', update);
  let queued = false;
  window.addEventListener('resize', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      grid.querySelectorAll('.archive-board[data-ready="true"]').forEach(engine.sizeBoardTiles);
      if (dialog.open) engine.sizeBoardTiles($('previewBoard'));
    });
  });
  const categories = [...new Set(entries.map(item => item.category))];
  for (const title of categories) {
    const option = document.createElement('option');
    option.value = title;
    option.textContent = title;
    categoryFilter.appendChild(option);
  }
  update();
})();
