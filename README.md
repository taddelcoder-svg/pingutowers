# Pingu Towers – Pinguine gegen Fische

3D-Tower-Defense im Browser (three.js), angelehnt an Bloons TD 6: Statt Affen verteidigen Pinguine
einen Eiskanal, statt Ballons schwimmen Fische hindurch. Getroffene Fische werden zum nächstkleineren
Fisch – vom Rotbarsch bis zum Megalodon.

## Spiel

- **3 Karten:** Eisscholle (Anfänger), Gletscherspalte (Mittel), Polarnacht (Profi, mit Polarlicht).
- **3 Stufen:** Leicht (30 Runden, 200 Leben, Preise −15 %), Mittel (40 Runden, 150 Leben),
  Schwer (60 Runden, 100 Leben, Preise +8 %). Nach dem Sieg geht es endlos weiter.
- **8 Pinguine** mit je 3 Upgrade-Pfaden à 4 Stufen (höchstens zwei Pfade, nur einer über Stufe 2):
  Zapfen-Pingu, Stachel-Pingu, Schneeball-Pingu, Frost-Pingu, Harpunen-Pingu, Polarlicht-Pingu,
  Fischmarkt (Geld) und Häuptlings-Pingu (stärkt Pinguine in der Nähe).
- **13 Fische:** Rotbarsch, Blaubarsch, Grünling, Goldfisch, Lachs, Anglerfisch (immun gegen
  Explosionen), Eisfisch (immun gegen Kälte), Panzerwels (immun gegen Spitzes), Zebrafisch,
  Regenbogenforelle, Kofferfisch (10 Treffer), Walhai (200) und Megalodon (700). Dazu getarnte Fische.
- Tempo 1×/2×/3×, automatischer Rundenstart, Spielstand nach jeder Runde im Browser gespeichert.

Steuerung: Maus oder Touch (Pinguin wählen, aufs Eis tippen bzw. ziehen und loslassen).
Tasten: `1`–`8` Pinguin, `Leertaste` Runde/Tempo, `,` `.` `-` Upgrades, `Entf` verkaufen,
`Tab` Ziel wechseln, `Esc` abbrechen/Pause. Mit gedrückter Umschalttaste mehrere gleiche setzen.

## Olympiade

Disziplin der Swimming-Lions-Olympiade (Schlüssel `tuerme`, Spielkennung `pingutowers`). Mit dem
Ticket-Link (`?olymp=…`) spielt jeder allein dieselbe Karte mit derselben Schwierigkeit und denselben
Runden (Einstellungen: Karte, Stufe, 20/30/40 Runden), ein Versuch. Der Server meldet
`Runden × 1000 + übrige Leben` (Leben zählen nur, wenn alle Runden geschafft sind) als Wert an die
Olympiade. Nach jeder Runde liegt der Stand im `sessionStorage`, ein Neuladen setzt dort fort.

## Lokal starten

```bash
npm start
```

Dann http://localhost:10700 öffnen. Keine Abhängigkeiten, Node ≥ 18.

- `node test/sim.js [karte] [stufe]` – Balance-Test ohne Grafik: ein Bot baut nach Plan und spielt.
- `node test/browser.js`, `node test/karten.js`, `node test/fische.js` – Rauchtests mit Screenshots
  (Playwright, Server muss laufen; Seite mit `?test` öffnet einen Testzugang).

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
index.html         Oberfläche und Styles
datenschutz.html   Datenschutzerklärung
js/
  daten.js         Fische, Pinguine mit Upgrades, Karten, Stufen, Runden (auch im Server genutzt)
  logik.js         Spiellogik ohne Grafik (Bewegung, Ziele, Schaden, Runden, Speichern)
  welt3d.js        3D-Darstellung: Scholle, Kanal, Pinguin-Modelle, Fische als Instanzen, Effekte
  ton.js           Geräusche (Web Audio, keine Dateien)
  oberflaeche.js   Menü, Seitenleiste, Eingabe, Hauptschleife, Olympiade
vendor/            three.js r128 (MIT) – selbst ausgeliefert
fonts/             Bricolage Grotesque (SIL OFL)
```
