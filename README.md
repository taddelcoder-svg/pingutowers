# Pingu Towers – Pinguine gegen Fische

3D-Tower-Defense im Browser (three.js), angelehnt an Bloons TD 6: Statt Affen verteidigen Pinguine
einen Eiskanal, statt Ballons schwimmen Fische hindurch. Getroffene Fische werden zum nächstkleineren
Fisch – vom Rotbarsch bis zur Riesenkrake, zu Krakus und Kaiser Orka. Allein oder bis zu viert im Koop.

## Spiel

- **8 Karten:** Eisscholle und Pinguinbucht (Anfänger, die Bucht endet in einem Eisloch und hat
  Wasserlöcher), Eiskreuz (Mittel, der Kanal kreuzt sich selbst, mit Fischerhafen), Gletscherspalte
  und Erebus-Krater (Mittel, mit Vulkan und Lavaspalten), Polarnacht, Doppelstrom (Profi, zwei Kanäle)
  und Treibeis-Inseln (Profi, kurzer Kanal, viele Wasserlöcher).
- **4 Stufen:** Leicht (30 Runden, 200 Leben, Preise −15 %), Mittel (40 Runden, 150 Leben),
  Schwer (60 Runden, 100 Leben, +8 %), Extrem (80 Runden, 1 Leben, +20 %). Nach dem Sieg geht es endlos weiter.
- **8 Spielmodi:** Standard, Nur Grundpinguine, Umgekehrt, Halbes Geld, Fischflut (keine Pausen),
  Boss-Jagd (Krakus in Runde 20 und 40), Orka-Angriff (Kaiser Orka in Runde 25 und 50, seine
  Flutwellen betäuben Pinguine am Ufer) und Sandkasten (unendlich Geld, Fische selbst losschicken).
- **15 Pinguine** in vier Gruppen, je 3 Upgrade-Pfade mit 5 Stufen (höchstens 5-2-0, und jede
  Stufe 5 nur einmal pro Pinguinart und Pfad):
  - Primär: Zapfen-, Stachel-, Schneeball- und Frost-Pingu
  - Militär: Harpunen-Pingu, Boot-Pingu (nur in Wasserlöchern), Albatros-Pilot (fliegt Acht, Oval
    oder Kreis), Schneemörser (Zielpunkt frei wählbar)
  - Magie: Polarlicht-Pingu, Ninja-Pingu, Laser-Pingu (Laserstrahlen, Roboarm, Orbitalschlag)
  - Unterstützung: Fischmarkt, Häuptlings-Pingu, Disco-Pingu (Schallwellen bremsen, Party-Buffs, Geld),
    Eisstachel-Fabrik (legt Stachelhaufen und Minen)
- **3 Helden** (Kapitän Kiel, Prinzessin Aurora, Professor Frosti): steigen am Ende jeder Runde auf,
  Stufe 1–10, Stufen lassen sich auch kaufen; Fähigkeiten auf Stufe 3 und 7. Mit dem Pingu-Pass kommt
  je eine Meisterkraft ab Stufe 5 dazu (Ankerwurf, Sternschnuppen, Eiszeit).
- **17 Fähigkeiten** (Turbo, Walhai-Rakete, Schneesturm, Geldregen, Schlachtruf, Sabotage,
  Bombenteppich, Stachelsturm, Großer Knall, Walfang-Haken, Himmelsblitz und die Heldenfähigkeiten)
  mit Abklingzeit, unten links auf der Karte bzw. Tasten 1–9.
- **16 Fische:** Rotbarsch, Blaubarsch, Grünling, Goldfisch, Lachs, Anglerfisch (immun gegen
  Explosionen), Eisfisch (immun gegen Kälte), Panzerwels (immun gegen Spitzes), Zebrafisch,
  Regenbogenforelle, Kofferfisch (10), Walhai (200), Schattenrochen (400, immer getarnt), Megalodon (700),
  Riesenkrake (4000), Krakus der Boss und Kaiser Orka. Dazu die Zusätze getarnt, nachwachsend (grüne Algen) und
  gepanzert (Helm, doppelt so zäh).
- **Koop:** bis zu 4 Spieler in einem Raum (4-stelliger Code). Der Gastgeber wählt Karte, Stufe,
  Modus und Geld: geteilt (eine Kasse, jeder darf alles) oder getrennt (jeder hat seine Kasse und
  rüstet nur eigene Pinguine auf). Jeder hat seinen eigenen Helden; Pause, Tempo und Auto gelten für alle.
  Der Server rechnet das Spiel mit und gibt den Takt vor, die Browser rechnen Takt für Takt nach und
  bekommen bei Abweichung den Spielstand neu. Wer die Verbindung verliert, kommt nach dem Neuladen zurück.
- **Pingu-Pass:** Erfahrung für Runden, Bosse und Siege, Stufe 1–30. Schaltet 9 Looks für die
  eigenen Pinguine frei (Kaiserpinguin, Sonnenbrille, Schoko, Zuckerwatte, Eiskristall, Pirat, Galaxie,
  Gold, Diamant) und die Meisterkräfte der Helden. Im Browser gespeichert.
- Medaillen pro Karte, Stufe und Modus, Kamera-Zoom (Mausrad, zwei Finger, Knöpfe), Tempo 1×/2×/3×,
  automatischer Rundenstart, Spielstand nach jeder Runde im Browser gespeichert.

Tasten: Buchstaben am Pinguin im Laden (`Q W E R T S P O Z N L U I D A`), Held `H`, Fähigkeiten `1`–`9`,
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

Dann http://localhost:10700 öffnen (vorher einmal `npm install`, einzige Abhängigkeit: `ws` für den Koop). Node ≥ 18.

- `npm test` – Stresstest der Logik (jeder Pinguin in vielen Upgrade-Kombinationen, alle Helden,
  Fähigkeiten, Modi und Karten, Meisterkräfte, Orka, Speichern/Laden, Nachwachsen), der Koop-Test
  (zwei Browser ohne Netz gegen den Raum-Server) und der Balance-Bot.
- `node test/sim.js [karte] [stufe] [modus] [bis]` – Balance-Test ohne Grafik: ein Bot baut nach Plan.
- `node test/browser.js` – Rauchtest im Browser mit Screenshots, auch Koop mit zwei Seiten (Playwright, Server muss laufen;
  die Seite mit `?test` öffnet lokal einen Testzugang).

## Deployment (Render)

`render.yaml` bzw. `Dockerfile` (Docker-Webdienst, `/healthz`). Umgebungsvariable `ZUGANG_PASSWORT`:
das gemeinsame Passwort für Familie und Freunde – dasselbe wie bei den anderen Spielen und der
Olympiade, denn daraus wird auch der Schlüssel für die Olympia-Tickets abgeleitet.
`zugang.js` und `olymp.js` sind die Vorlagen aus `olympiade/geteilt/`; bei Änderungen dort hierher kopieren.

## Aufbau

```
server.js          liefert das Spiel aus, /api/olymp für die Olympiade, WebSocket /ws für den Koop
raeume.js          Koop-Räume: Lobby, Befehle im Takt, Prüfsummen, Wiederverbinden
zugang.js          Passwortschutz (Vorlage aus olympiade/geteilt/)
olymp.js           Olympia-Anbindung (Vorlage aus olympiade/geteilt/)
index.html         Oberfläche und Styles (mit Zoomschutz für iPad/iPhone)
datenschutz.html   Datenschutzerklärung
js/
  daten.js         Fische, Karten, Stufen, Spielmodi, Runden (auch im Server genutzt)
  pinguine.js      Pinguine mit allen Upgrades, Fähigkeiten, Helden
  logik.js         Spiellogik ohne Grafik (Kanäle, Ziele, Schaden, Fähigkeiten, Bosse, Befehle, Koop-Kassen, Speichern)
  pass.js          Pingu-Pass: Stufen, Looks, Meisterkräfte
  modelle.js       3D-Modelle: Fische, Pinguine, Helden, Albatros, Geschosse
  welt3d.js        Szene: Scholle, Kanäle, Wasserlöcher, Themen, Kamera mit Zoom, Effekte
  ton.js           Geräusche (Web Audio, keine Dateien)
  oberflaeche.js   Menü, Seitenleiste, Fähigkeiten, Eingabe, Hauptschleife, Medaillen, Olympiade, Pass, Koop
vendor/            three.js r128 (MIT) – selbst ausgeliefert
fonts/             Bricolage Grotesque (SIL OFL)
test/              Logik-Stresstest, Koop-Test, Balance-Bot, Browser-Rauchtest
```
