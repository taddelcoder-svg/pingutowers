# Pingu Towers – Pinguine gegen Fische

3D-Tower-Defense im Browser (three.js), angelehnt an Bloons TD 6: Statt Affen verteidigen Pinguine
einen Eiskanal, statt Ballons schwimmen Fische hindurch. Getroffene Fische werden zum nächstkleineren
Fisch – vom Rotbarsch bis zur Riesenkrake und zu Krakus dem Boss.

## Spiel

- **6 Karten:** Eisscholle und Pinguinbucht (Anfänger, die Bucht endet in einem Eisloch und hat
  Wasserlöcher), Gletscherspalte und Erebus-Krater (Mittel, mit Vulkan und Lavaspalten),
  Polarnacht und Doppelstrom (Profi, Doppelstrom hat zwei Kanäle).
- **4 Stufen:** Leicht (30 Runden, 200 Leben, Preise −15 %), Mittel (40 Runden, 150 Leben),
  Schwer (60 Runden, 100 Leben, +8 %), Extrem (80 Runden, 1 Leben, +20 %). Nach dem Sieg geht es endlos weiter.
- **7 Spielmodi:** Standard, Nur Grundpinguine, Umgekehrt, Halbes Geld, Fischflut (keine Pausen),
  Boss-Jagd (Krakus in Runde 20 und 40) und Sandkasten (unendlich Geld, Fische selbst losschicken).
- **13 Pinguine** in vier Gruppen, je 3 Upgrade-Pfade mit 5 Stufen (höchstens 5-2-0, und jede
  Stufe 5 nur einmal pro Pinguinart und Pfad):
  - Primär: Zapfen-, Stachel-, Schneeball- und Frost-Pingu
  - Militär: Harpunen-Pingu, Boot-Pingu (nur in Wasserlöchern), Albatros-Pilot (fliegt Acht, Oval
    oder Kreis), Schneemörser (Zielpunkt frei wählbar)
  - Magie: Polarlicht-Pingu, Ninja-Pingu
  - Unterstützung: Fischmarkt, Häuptlings-Pingu, Eisstachel-Fabrik (legt Stachelhaufen und Minen)
- **3 Helden** (Kapitän Kiel, Prinzessin Aurora, Professor Frosti): steigen am Ende jeder Runde auf,
  Stufe 1–10, Stufen lassen sich auch kaufen; Fähigkeiten auf Stufe 3 und 7.
- **17 Fähigkeiten** (Turbo, Walhai-Rakete, Schneesturm, Geldregen, Schlachtruf, Sabotage,
  Bombenteppich, Stachelsturm, Großer Knall, Walfang-Haken, Himmelsblitz und die Heldenfähigkeiten)
  mit Abklingzeit, unten links auf der Karte bzw. Tasten 1–9.
- **16 Fische:** Rotbarsch, Blaubarsch, Grünling, Goldfisch, Lachs, Anglerfisch (immun gegen
  Explosionen), Eisfisch (immun gegen Kälte), Panzerwels (immun gegen Spitzes), Zebrafisch,
  Regenbogenforelle, Kofferfisch (10), Walhai (200), Schattenrochen (400, immer getarnt), Megalodon (700),
  Riesenkrake (4000) und Krakus der Boss. Dazu die Zusätze getarnt, nachwachsend (grüne Algen) und
  gepanzert (Helm, doppelt so zäh).
- Medaillen pro Karte, Stufe und Modus, Kamera-Zoom (Mausrad, zwei Finger, Knöpfe), Tempo 1×/2×/3×,
  automatischer Rundenstart, Spielstand nach jeder Runde im Browser gespeichert.

Tasten: Buchstaben am Pinguin im Laden (`Q W E R T S P O Z N U I A`), Held `H`, Fähigkeiten `1`–`9`,
`Leertaste` Runde/Tempo, `,` `.` `-` Upgrades, `Entf` verkaufen, `Tab` Ziel bzw. Flugbahn wechseln,
`Esc` abbrechen/Pause. Mit gedrückter Umschalttaste mehrere gleiche Pinguine setzen.

## Olympiade

Disziplin der Swimming-Lions-Olympiade (Schlüssel `tuerme`, Spielkennung `pingutowers`). Mit dem
Ticket-Link (`?olymp=…`) spielt jeder allein dieselbe Karte mit derselben Schwierigkeit und denselben
Runden (Einstellungen: Karte, Stufe, 20/30/40 Runden), Standardmodus, Held frei wählbar, ein Versuch.
Der Server meldet `Runden × 1000 + übrige Leben` (Leben zählen nur, wenn alle Runden geschafft sind)
als Wert an die Olympiade. Nach jeder Runde liegt der Stand im `sessionStorage`, ein Neuladen setzt dort fort.

## Lokal starten

```bash
npm start
```

Dann http://localhost:10700 öffnen. Keine Abhängigkeiten, Node ≥ 18.

- `npm test` – Stresstest der Logik (jeder Pinguin in vielen Upgrade-Kombinationen, alle Helden,
  Fähigkeiten, Modi und Karten, Speichern/Laden, Nachwachsen) und der Balance-Bot.
- `node test/sim.js [karte] [stufe] [modus] [bis]` – Balance-Test ohne Grafik: ein Bot baut nach Plan.
- `node test/browser.js` – Rauchtest im Browser mit Screenshots (Playwright, Server muss laufen;
  die Seite mit `?test` öffnet lokal einen Testzugang).

## Deployment (Render)

`render.yaml` bzw. `Dockerfile` (Docker-Webdienst, `/healthz`). Umgebungsvariable `ZUGANG_PASSWORT`:
das gemeinsame Passwort für Familie und Freunde – dasselbe wie bei den anderen Spielen und der
Olympiade, denn daraus wird auch der Schlüssel für die Olympia-Tickets abgeleitet.
`zugang.js` und `olymp.js` sind die Vorlagen aus `olympiade/geteilt/`; bei Änderungen dort hierher kopieren.

## Aufbau

```
server.js          liefert das Spiel aus, /api/olymp für die Olympiade
zugang.js          Passwortschutz (Vorlage aus olympiade/geteilt/)
olymp.js           Olympia-Anbindung (Vorlage aus olympiade/geteilt/)
index.html         Oberfläche und Styles (mit Zoomschutz für iPad/iPhone)
datenschutz.html   Datenschutzerklärung
js/
  daten.js         Fische, Karten, Stufen, Spielmodi, Runden (auch im Server genutzt)
  pinguine.js      Pinguine mit allen Upgrades, Fähigkeiten, Helden
  logik.js         Spiellogik ohne Grafik (Kanäle, Ziele, Schaden, Fähigkeiten, Boss, Speichern)
  modelle.js       3D-Modelle: Fische, Pinguine, Helden, Albatros, Geschosse
  welt3d.js        Szene: Scholle, Kanäle, Wasserlöcher, Themen, Kamera mit Zoom, Effekte
  ton.js           Geräusche (Web Audio, keine Dateien)
  oberflaeche.js   Menü, Seitenleiste, Fähigkeiten, Eingabe, Hauptschleife, Medaillen, Olympiade
vendor/            three.js r128 (MIT) – selbst ausgeliefert
fonts/             Bricolage Grotesque (SIL OFL)
test/              Logik-Stresstest, Balance-Bot, Browser-Rauchtest
```
