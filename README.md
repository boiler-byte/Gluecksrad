# Glücksrad – Retro Edition v6

Ein eigenständiges, mobilfreundliches HTML-Buchstabenspiel im Stil einer 90er-TV-Show. Drei frei konfigurierbare Spielerplätze, Computergegner in drei Schwierigkeitsstufen, animierte Buchstabenwand, Sounds, eigenes Rätselarchiv und automatische Spielstand-Speicherung. Die Umsetzung ist keine offizielle Ausgabe der Fernsehsendung.

## Starten

1. `gluecksrad-v6.zip` entpacken.
2. Alle enthaltenen Dateien zusammen in einem Ordner belassen.
3. `index.html` im Browser öffnen. Keine Internetverbindung und keine Installation nötig.
4. Für jeden der drei Plätze den Typ (**Spieler**, **Computer Leicht/Mittel/Schwer**) und einen Namen festlegen.
5. **SHOW STARTEN** beginnt eine Partie, **SHOW FORTSETZEN** lädt eine gespeicherte Partie.

## Neu in v6: die Buchstabenfee

Aus dem mitgelieferten 18-Frame-Spritesheet und der HTML-Demo wurde ein optimierter, transparenter Animationsatlas erzeugt.

- **Grundhaltung:** Die Buchstabenfee steht zunächst am linken Rand der Buchstabenwand.
- **Treffer:** Die Fee geht zur nächsten getroffenen Buchstaben-Kachel, orientiert sich passend zum Ziel und greift mit einer oberen, mittleren oder unteren Handbewegung.
- **Bing & Licht:** Sobald sie bei der Kachel ankommt, leuchtet genau diese Kachel goldgelb auf. Gleichzeitig erklingt **ein Bing**. Erst dann dreht die Fee die Kachel um, sodass der Buchstabe erscheint.
- **Lesereihenfolge:** Bei mehrfach vorhandenen Buchstaben geht die Fee die Fundstellen von links nach rechts und von Wort zu Wort durch. Jede Kachel bekommt ihren eigenen Bing und ihre eigene Umdrehung.
- **Rückkehr:** Nach dem letzten Treffer geht die Fee zum **näheren sichtbaren Rand**, klatscht etwa 2,4 Sekunden und kehrt in ihre Grundhaltung zurück.
- **Richtig gelöst:** Bei einer korrekt gelösten Runde klatscht und hüpft die Fee etwa drei Sekunden lang. Die Ergebnisanzeige erscheint danach.
- **Spielablauf:** Während der Trefferanimation sind weitere Eingaben gesperrt. Auch Computergegner warten, bis die Fee ihre Vorführung beendet hat.

Die Einzelbilder stammen aus der vom Benutzer bereitgestellten Originalgrafik. Der Animationsatlas nutzt die 18 einzeln zugeschnittenen Posen aus der mitgelieferten Demo:

- Frame 0: Grundhaltung
- Frames 0–4: Klatschbewegungen
- Frames 6–8: nach links gehen
- Frames 12–14: nach rechts gehen
- Frames 9–11: nach links greifen (Mitte, Hoch, Tief)
- Frames 15–17: nach rechts greifen (Mitte, Hoch, Tief)

Bei aktivierter Browser-Einstellung **Bewegung reduzieren** werden die zeitintensiven Übergänge stark verkürzt.

## Speichern und fortsetzen

Der Spielstand wird als JSON-String unter `localStorage.gluecksradGame` gespeichert. Version 6 speichert zusätzlich:

```json
{
  "version": 6,
  "phase": "revealing",
  "revealLetter": "N",
  "revealIndex": 1
}
```

`revealIndex` zählt die bereits umgedrehten Kacheln des gerade bearbeiteten Buchstabens. Wird das Menü während der Bewegung geöffnet oder der Browser unterbrochen, geht die Animation nach **SHOW FORTSETZEN** bei der nächsten noch offenen Fundstelle weiter. Bereits aufgedeckte Kacheln werden nicht erneut gewertet. Die restlichen Daten (Spieler, Punkte, Radwinkel, Rätselreihenfolge, Computerzug usw.) bleiben wie in v5 gespeichert.

**Spielstände aus v2 bis v5 werden weiterhin unterstützt.** Der Spielstand ist an den jeweiligen Browser und die Website-Adresse gebunden. Besonders beim Öffnen über `file://` kann die Verfügbarkeit von `localStorage` je nach Browser abweichen. Für verlässliche Speicherstände kann das Spiel über eine feste lokale oder gehostete Webadresse geöffnet werden.

Zum Überprüfen:

```javascript
const spielstand = JSON.parse(localStorage.gluecksradGame);
console.log(spielstand.phase, spielstand.revealLetter, spielstand.revealIndex);
```

Zum Löschen:

```javascript
localStorage.removeItem('gluecksradGame');
```

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Mobilfreundliche Spieloberfläche |
| `styles.css` | TV-Bühnendesign, Kachelglanz, Umdrehungen, Fee-Sprünge |
| `spiel.js` | Spielregeln, CPU, Runden, Sounds, Speichern, Treffer-Reihenfolge |
| `buchstabenfee.js` | Geh-, Greif-, Klatsch- und Sprungabläufe, Positionierung, Abbruch |
| `buchstabenfee-atlas.webp` | 18 transparante Sprites als kompaktes 6×3-Atlasbild |
| `buchstabenfee-original.png` | Original-Spritesheet aus dem Anhang zur eigenen Bearbeitung |
| `buchstabenwand.png` | Goldene TV-Show-Bühne als Hintergrund |
| `woerter.js` | Externe, frei bearbeitbare Wörter- und Kategorienliste |
| `README.md` | Diese Anleitung |

## Eigene Rätsel hinzufügen

In `woerter.js` können weitere Einträge in `window.GLUECKSRAD_WOERTER` stehen:

```javascript
{ kategorie: "Sprichwort", text: "Aller Anfang ist schwer" },
{ kategorie: "Mein Thema", text: "Mein eigener Begriff" },
```

Mindestens fünf Rätsel werden benötigt. Umlaute sind möglich; `ß` wird zu `SS` normalisiert. Leerzeichen werden als transparente Kacheln, Sonderzeichen bereits aufgedeckt dargestellt. Fünf Runden werden pro Partie gespielt.

## Sounds

Das Rad, die Trefferglocke, Bankrott und die Gewinnfanfare werden ohne externe Audiodateien über die Web-Audio-API erzeugt. Der Ton lässt sich über das Dropdown-Menü neben dem Scoreboard ausschalten. Auf Smartphones beginnt die Audiowiedergabe gegebenenfalls erst nach einer Touch-Interaktion.
