/* Die 50 zuletzt begonnenen Rätsel bleiben auch zwischen Partien gespeichert.
   Das Archiv ist bewusst vom gespeicherten Spielstand getrennt. */
(() => {
  'use strict';

  const STORAGE_KEY = 'gluecksradRecentPuzzles';
  const LIMIT = 50;

  // Identische Texte werden trotz Groß-/Kleinschreibung, Leerzeichen,
  // Satzzeichen und Umlautschreibweisen (Ä = AE etc.) erkannt.
  function key(text) {
    return String(text ?? '').toLocaleUpperCase('de-DE')
      .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE')
      .replace(/ẞ/g, 'SS').replace(/[^A-Z0-9]/g, '');
  }

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(value)) return [];
      const result = [];
      for (const item of value.slice(-LIMIT)) {
        if (typeof item !== 'string' || !/^[A-Z0-9]{1,300}$/.test(item)) continue;
        // Letzte Erwähnung hat Vorrang, falls gespeicherte Daten Duplikate enthalten.
        const index = result.indexOf(item);
        if (index !== -1) result.splice(index, 1);
        result.push(item);
      }
      return result;
    } catch (_) {
      return null; // Bei gesperrtem Speicher den Verlauf im RAM beibehalten.
    }
  }

  let recent = read() || [];
  function write() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recent)); }
    catch (_) { /* Das Spiel bleibt trotzdem nutzbar. */ }
  }
  function contains(text) {
    return recent.includes(key(text));
  }
  function record(text) {
    const value = key(text);
    if (!value || recent.includes(value)) return false;
    recent.push(value);
    if (recent.length > LIMIT) recent.shift();
    write();
    return true;
  }
  function clear() {
    recent = [];
    try { localStorage.removeItem(STORAGE_KEY); }
    catch (_) { /* Auch bei gesperrtem Speicher lokal zurücksetzen. */ }
  }
  function list() {
    return recent.slice();
  }
  function reload() {
    const saved = read();
    if (saved !== null) recent = saved;
  }
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) reload();
  });

  window.GluecksradVerlauf = Object.freeze({ key, contains, record, clear, list, reload, STORAGE_KEY, LIMIT });
})();
