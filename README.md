# Glücksrad – Retro Edition v14

Ein eigenständiges, offline spielbares HTML-Buchstabenspiel im Stil einer 90er-TV-Show. Drei frei konfigurierbare Spielerplätze, Computergegner in drei Schwierigkeitsstufen, animierte Buchstabenwand, Sounds, eigenes Rätselarchiv und automatische Spielstand-Speicherung. Keine offizielle Ausgabe der Fernsehsendung.

## Starten

1. `gluecksrad-v14.zip` entpacken.
2. Alle enthaltenen Dateien im Ordner `gluecksrad-v14` zusammen belassen.
3. `index.html` im Browser öffnen. Es sind keine Installation und keine Internetverbindung erforderlich.
4. Spieler 1 ist standardmäßig **Spieler**, Spieler 2 und 3 sind standardmäßig **Computer Leicht**. Die Spielertypen und Namen können angepasst werden. Die Felder enthalten keine zusätzlichen sichtbaren Labels, bleiben aber für Screenreader beschriftet.
5. Die gewünschte **Buchstabenfee** auswählen (Standard: Sonya Kraus; zusätzlich Marin Gilzer). **SHOW STARTEN** beginnt die Partie; **SHOW FORTSETZEN** lädt eine gespeicherte Partie mit ihrer eigenen Fee.

## Neu in v14

- **Mobil kleinere Buchstabenfeen:** Unterhalb von 761 px Viewport-Breite skaliert die Fee mit `width: clamp(92px, 27vw, 175px)` statt wie bisher mit 42–45 vw und höheren Mindestwerten. Damit beträgt die Figur auf 375 px breiten Smartphones nur noch ca. **118 px Höhe** (bisher ca. 197 px); auf 600 px breiten Tablets ca. **189 px** (bisher ca. 263 px). Das gilt für Sonya Kraus, Marin Gilzer und über `feen.js` hinzugefügte Varianten.
- **Desktop unverändert:** Auf breiten Bildschirmen bleibt die maximale Feenhöhe ca. **320 px**. Standhöhe `bottom: 10%`, Bewegungsabläufe, Greifdistanz und Offscreen-Verhalten bleiben unverändert. Die Positionsberechnung berücksichtigt automatisch die tatsächliche Sprite-Breite.
- **Spielstände:** v14 speichert unter Version 14, v13- und ältere Spielstände bleiben lesbar.

## Bisherige Änderungen (v13)

- **Buchstabenfee nähert sich den Kacheln:** Beim Herangehen zum Aufdecken eines Buchstabens liegt die Zielposition rund **20 px näher** an der Kachel als in v12. Die Anpassung gilt für Sonya Kraus und Marin Gilzer auf allen Bildschirmgrößen. Die Ruheposition auf der Treppe, die Greifposen und das Offscreen-Verhalten bleiben unverändert.
- **Spielstände:** v13 speichert unter Version 13 und kann vorhandene Spielstände einschließlich v12 laden.

## Bisherige Änderungen (v12)

- **Kleinere Buchstabenfee:** Auf großen Bildschirmen beträgt die maximale Höhe jetzt ca. **320 px** statt 370 px. Die Körpermitte, Posen und Greifanimationen gelten unverändert für beide Feen. Auf Smartphones bleiben die kompakteren Größen und das Offscreen-Verhalten erhalten.
- **Höherer Stand:** Die Fee steht auf allen Bildschirmgrößen mit **`bottom: 10%`** statt `5%` innerhalb der Buchstabenwand, also etwa eine Treppenstufe höher.
- **Spielertyp-Auswahl mit Kontrast:** Die geschlossene Auswahl hat weiterhin eine dunkle Oberfläche mit heller Schrift. Die aufklappbaren Optionen verwenden explizit **dunkle Schrift auf hellem Hintergrund** – auch bei einem hellen Betriebssystem-Theme.
- **Startwerte:** **Spieler 1 = Spieler**, **Spieler 2 = Computer Leicht**, **Spieler 3 = Computer Leicht**; die dazu passenden Startnamen sind `Spieler 1`, `CPU 2`, `CPU 3`. Bereits gespeicherte Konfigurationen werden beim Laden weiterhin übernommen.
- **Spielstände:** v12 speichert unter Version 12; alle bisherigen Spielstände bis einschließlich v11 bleiben lesbar.

## Bisherige Änderungen (v11)

- **Zwei Buchstabenfeen:** Sonya Kraus trägt das bisherige hellblaue Kleid, Marin Gilzer das neue rote Kleid. Das Marin-Spritesheet wurde in denselben 18 Posen auf einen körpermittig ausgerichteten 6 × 3-Atlas gebracht. Beide benutzen dieselben Geh-, Greif-, Klatsch- und Siegesanimationen.
- **Auswahl im Startmenü:** Unter den drei Spielerplätzen steht die Buchstabenfee-Auswahl mit Vorschau. Standardwert ist **Sonya Kraus**. Die Wörter `TYP` und `NAME` über den Eingabefeldern wurden entfernt; die Steuerelemente behalten ihre barrierefreien Namen.
- **Erweiterbare Feen:** In der neuen Datei `feen.js` werden Name und Atlas-Datei für jede Fee als einfaches JavaScript-Objekt registriert. Zusätzliche Einträge erscheinen automatisch im Auswahlmenü; Spiel- und Animationscode brauchen dafür nicht geändert zu werden.
- **Spielstände:** v11 speichert die gewählte Fee in `fairyId`. Beim Fortsetzen wird sie wiederhergestellt. Spielstände von **v2 bis v10** bleiben lesbar und verwenden standardmäßig Sonya Kraus. Auch wenn eine eigene Fee später entfernt wird, kann die gespeicherte Show mit der Standardfee fortgesetzt werden.

## Weitere Feen selbst hinzufügen

1. Ein transparentes Sprite-Sheet mit **6 Spalten und 3 Reihen** vorbereiten. Die 18 Posen und ihre Reihenfolge müssen dem vorhandenen Atlas entsprechen. Empfohlen sind **1800 × 1050 px**, also **300 × 350 px pro Pose**, mit einheitlicher Körpermitte und transparenten Rändern. Die Dateien `buchstabenfee-atlas.webp` und `buchstabenfee-marin-atlas.webp` können als Vorlage dienen.
2. Das Sprite-Sheet als z. B. `meine-fee.webp` in den Spielordner legen.
3. In **`feen.js`** innerhalb von `window.GLUECKSRAD_FEEN` folgenden Eintrag ergänzen:

```javascript
meineFee: {
  name: 'Meine Buchstabenfee',
  atlas: 'meine-fee.webp'
},
```

Nach dem Neuladen erscheint die neue Fee automatisch im Startmenü. Eine registrierte Fee bleibt während einer laufenden Show aktiv, auch wenn das Menü geöffnet wird. Ein Wechsel gilt für eine **neue Show**, nicht rückwirkend für die gespeicherte Partie.

## Bisherige Änderungen (v10)

- **Rundenspezifische Sonderfelder:** Die 18 Felder des Rades werden bei Beginn jeder Runde neu belegt. **Aussetzen** erscheint in jeder Runde genau einmal. **Bankrott** und **Extradreh** variieren entsprechend der folgenden Tabelle. Wo eine Spanne angegeben ist, wird ihre konkrete Anzahl zufällig ausgelost.

  | Runde | Bankrott | Aussetzen | Extradreh |
  |---|---:|---:|---:|
  | 1 | 0 | 1 | 0 |
  | 2 | 0 | 1 | 1 |
  | 3 | 0–1 | 1 | 0–1 |
  | 4 | 1 | 1 | 1 |
  | 5 | 1–2 | 1 | 1–2 |

- **Vorstellung der Sonderfelder:** Beim Rundenstart scrollt das Rad bei Bedarf in den sichtbaren Bereich. Jedes vorhandene Sonderfeld wird anschließend einzeln goldgelb zum Leuchten gebracht und etwa 30 % vergrößert. Solange die Vorstellung läuft, kann nicht gedreht werden. Unter dem Rad stehen Anzahl und Art der Sonderfelder dauerhaft als Legende. Bei aktivierter Einstellung **Bewegung reduzieren** ist die Animation verkürzt.
- **Extradreh:** Ein Treffer auf **EXTRADREH** gibt demselben Spieler sofort einen weiteren Dreh. Er erhält dabei keine Punkte und muss keinen Buchstaben wählen. Das gilt auch für Computergegner.
- **Spielstände:** Die zufällig bestimmte Sonderfeldverteilung ist Teil des v10-Spielstands und bleibt nach dem Fortsetzen erhalten. v9 und ältere Spielstände werden auf eine passende Verteilung für die aktuelle Runde umgestellt. Ein beim Versionswechsel noch laufender alter Dreh wird aus Fairnessgründen zurückgesetzt.
- **Buchstabenfee:** Die nach v9 bereitgestellte Korrektur der Greifanimation wurde übernommen: zum Aufdecken wird die Hand pro Buchstabe nur einmal ausgestreckt.

## Bisherige Änderungen (v9)

- **Maximal zwölf Tiles pro Zeile:** Die Buchstabenwand ordnet Treffer, Leerzeichen und Satzzeichen in höchstens zwölf Positionen nebeneinander an. Ganze Wörter werden, wenn möglich, gemeinsam umgebrochen; Wörter mit mehr als zwölf Zeichen laufen über mehrere Zeilen weiter. Bei vielen Zeilen werden die Felder auf schmalen Ansichten etwas niedriger, damit sie im Display bleiben. Auf großen Monitoren bleiben rechts und links mehr freie Flächen.
- **Linke Ruheposition 90 px:** Die Fee ruht auf nicht beschnittenen Bühnen etwa 90 px vom linken Rand (statt ca. 159 px). Die Position rechts ist entsprechend symmetrisch. Auf beschnittenen Mobilansichten bleibt die Offscreen-Ruheposition bestehen.
- **Greifhöhe korrigiert:** Die Handhöhen der drei Sprite-Posen werden nun passend zur tatsächlichen Tile-Mitte ausgewählt; die Fee steht zudem ein wenig tiefer auf der Bühne, damit sie nicht über die Buchstaben greift.
- **Fee im Vordergrund:** Auf Smartphones wird sie beim Laufen und Aufdecken immer vor den Tiles dargestellt. Die Sprite-Elemente lassen weiterhin alle Maus- und Touch-Interaktionen durch.
- **Bisherige Funktionen erhalten:** 370 px maximale Feenhöhe, zentrierte 6×3-Sprites, zeitlich gestaffeltes Aufleuchten und Aufdecken in Lesereihenfolge, Offscreen-Abgang und Speicherung bleiben erhalten.

## Animation der Buchstabenfee

Der 6×3-Atlas umfasst weiterhin 18 Posen. Die Nummerierung beginnt bei 0 und erfolgt erst von links nach rechts, dann von oben nach unten.

- Frame 0: Grundhaltung
- Frames 0–4: Klatschen
- Frames 6–8: nach links gehen
- Frames 12–14: nach rechts gehen
- Frames 9–11: nach links greifen (Mitte, Hoch, Tief)
- Frames 15–17: nach rechts greifen (Mitte, Hoch, Tief)

Bei einem richtigen Tipp leuchten die betreffenden Kacheln in Leserichtung nacheinander goldgelb auf. Nach der ersten Kachel geht die Fee los, während die übrigen Kacheln nach und nach aufleuchten. Jede Kachel klingelt beim Aufleuchten einmal. Die Fee deckt die Treffer danach in der gleichen Leserichtung einzeln auf. Währenddessen bleiben Eingaben gesperrt, auch Computergegner warten. Bei einer korrekt gelösten Runde feiert die Fee vor der Ergebnisanzeige.

Die Browser-Einstellung **Bewegung reduzieren** verkürzt Animationen stark.

## Speichern und fortsetzen

Der Spielstand wird unter `localStorage.gluecksradGame` als JSON gespeichert. Eine aufgedeckte Buchstabenserie wird mit `phase: "revealing"`, `revealLetter` und `revealIndex` fortsetzbar gespeichert. Wird die Show während des Aufdeckens unterbrochen, setzt v14 bei der nächsten noch geschlossenen Kachel fort. Spieler, gewählte Buchstabenfee, Punkte, Radwinkel, Rätselreihenfolge, Sonderfeldverteilung und der Computerzug bleiben erhalten.

Die Speicherdaten hängen vom jeweiligen Browser und von der Website-Adresse ab. Bei `file://` kann die Verfügbarkeit von `localStorage` je nach Browser unterschiedlich sein. Für zuverlässige dauerhafte Spielstände kann das Spiel über eine konstante lokale oder gehostete Webadresse geöffnet werden.

Spielstand prüfen:

```javascript
console.log(JSON.parse(localStorage.gluecksradGame));
```

Spielstand löschen:

```javascript
localStorage.removeItem('gluecksradGame');
```

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Spieloberfläche und Feenauswahl im Startmenü |
| `styles.css` | Bühnendesign, Kacheln, mobile Darstellung, Sprites |
| `spiel.js` | Spielregeln, CPU, Runden, Sounds, Speicherstände |
| `buchstabenfee.js` | Geh-, Greif-, Klatsch- und Sprungabläufe, Offscreen-Ausgang, Wechsel zwischen Sprite-Varianten |
| `feen.js` | **Erweiterbare JS-Objekte für Namen und Atlas-Dateien der Feen** |
| `buchstabenfee-atlas.webp` | Sonya Kraus (hellblau): 1800 × 1050, 6×3 Frames à 300 × 350 |
| `buchstabenfee-marin-atlas.webp` | Marin Gilzer (rot): ausgerichteter 1800 × 1050-Atlas, 6×3 Frames à 300 × 350 |
| `buchstabenfee-marin-quelle.png` | Vom Nutzer bereitgestelltes Original-Spritesheet von Marin Gilzer |
| `buchstabenfee-quelle.webp` | Unverändertes neues 18-Posen-Spritesheet zur Bearbeitung |
| `buchstabenwand.webp` | Neue goldene Buchstabenwand |
| `woerter.js` | Frei bearbeitbare Wörter und Kategorien |
| `README.md` | Diese Anleitung |

## Eigene Rätsel hinzufügen

In `woerter.js` weitere Einträge zu `window.GLUECKSRAD_WOERTER` hinzufügen:

```javascript
{ kategorie: "Sprichwort", text: "Aller Anfang ist schwer" },
{ kategorie: "Mein Thema", text: "Mein eigener Begriff" },
```

Mindestens fünf Rätsel werden benötigt. Umlaute werden unterstützt, `ß` wird zu `SS` normalisiert. Leerzeichen bleiben transparente Kacheln, Sonderzeichen sind direkt aufgedeckt. Pro Partie werden fünf Runden gespielt.

## Sounds

Rad, Trefferglocke, Bankrott und Gewinnfanfare werden ohne externe Audiodateien über die Web-Audio-API erzeugt. Der Ton lässt sich über das Show-Menü neben dem Scoreboard ausschalten. Auf Smartphones kann Audio erst nach der ersten Berührung starten.
