# Pinguin Türmchen – Pinguine gegen Fische

3D-Tower-Defense im Browser (three.js), angelehnt an Bloons TD 6: Statt Affen verteidigen Pinguine
einen Eiskanal, statt Ballons schwimmen Fische hindurch. Getroffene Fische werden zum nächstkleineren
Fisch – vom Rotbarsch bis zur Riesenkrake, zu Krakus und Kaiser Orka. Allein oder bis zu viert im Koop.

## Spiel

- **11 Karten:** Eisscholle und Pinguinbucht (Anfänger, die Bucht endet in einem Eisloch und hat
  Wasserlöcher), Eiskreuz (Mittel, der Kanal kreuzt sich selbst, mit Fischerhafen), Gletscherspalte,
  Eistunnel (Mittel, zwei Tunnel – darunter sieht nur der Taucher-Pinguin die Fische), Schmelzscholle
  (Mittel, Eisflächen schmelzen in Runde 10, 15, 20, 25 und 30 zu Wasser; wer dort steht, bekommt sein
  Geld zurück, danach dürfen Boote hin), Erebus-Krater (Mittel, mit Vulkan und Lavaspalten), Polarnacht,
  Doppelstrom (Profi, zwei Kanäle), Treibeis-Inseln (Profi, viele Wasserlöcher) und Dreizack (Profi, drei
  Schlangen-Kanäle). Weil sich die Fische auf mehrere Kanäle aufteilen, gibt es dort mehr Geld (Startgeld und
  alle Einnahmen × 1,3 bei zwei, × 1,5 bei drei Kanälen; gilt auch für eigene Karten). Eisberge zwischen den
  Kanälen verhindern, dass ein einziger Platz in der Mitte alles abdeckt.
- **Karten-Editor:** Kanäle (bis zu drei) zeichnen, Eisberge, Wasserlöcher und Tunnel setzen, Thema wählen,
  speichern, spielen und als Link teilen (`?karte=…`). Eigene Karten gehen auch im Koop (der Gastgeber wählt sie).
- **4 Stufen:** Leicht (30 Runden, 200 Leben, Preise −15 %), Mittel (40 Runden, 150 Leben),
  Schwer (60 Runden, 100 Leben, +8 %), Extrem (80 Runden, 1 Leben, +20 %). Nach dem Sieg geht es endlos weiter.
- **10 Spielmodi:** Standard, Nur Grundpinguine, Umgekehrt, Halbes Geld, Fischflut (keine Pausen),
  Boss-Jagd (Krakus in Runde 20 und 40), Orka-Angriff (Kaiser Orka in Runde 25 und 50, seine
  Flutwellen betäuben Pinguine am Ufer), Hai-König (Runde 20 und 40, ruft ständig Fische herbei),
  Leviathan-Erwachen (Eis-Leviathan in Runde 30 und 60, sein Eisatem friert Pinguine ein) und
  Sandkasten (unendlich Geld, Fische selbst losschicken).
- **19 Pinguine** in vier Gruppen, je 3 Upgrade-Pfade mit 5 Stufen (höchstens 5-2-0, und jede
  Stufe 5 nur einmal pro Pinguinart und Pfad):
  - Primär: Zapfen-, Stachel-, Schneeball- und Frost-Pinguin
  - Militär: Harpunen-Pinguin, Boot-Pinguin (nur in Wasserlöchern), Albatros-Pilot (fliegt Acht, Oval
    oder Kreis), Schneemörser (Zielpunkt frei wählbar), Taucher-Pinguin (Dreizack, sieht Getarnte und
    trifft im Tunnel; Strudel, Torpedos, Perlen und Fähigkeit Tsunami), Eisbär-Söldner (Prankenhiebe gegen
    Riesen, Gebrüll, Panzerknacker, dickes Fell gegen Flutwelle/Eisatem/Tinte, Kopfgeld, Fähigkeit Bärenstampfer),
    Mecha-Pingu (ein Pinguin im Kampfroboter: Arm-Kanonen bis zur Hyper-Gatling, Schulterraketen bis zum
    Raketenhagel, Stampfer mit Magnet-Greifer und Mecha-Beben)
  - Magie: Polarlicht-Pinguin, Ninja-Pinguin, Laser-Pinguin (Laserstrahlen, Roboarm, Orbitalschlag)
  - Unterstützung: Fischmarkt, Häuptlings-Pinguin, Disco-Pinguin (Schallwellen bremsen, Party-Buffs, Geld),
    Koch-Pinguin (Fische, die in seiner Nähe platzen, bringen Extra-Geld; Restaurants, Suppen-Buffs,
    Fähigkeit Festmahl), Eisstachel-Fabrik (legt Stachelhaufen und Minen)
- **3 Helden** (Kapitän Kiel, Prinzessin Aurora, Professor Frosti): steigen am Ende jeder Runde auf,
  Stufe 1–10, Stufen lassen sich auch kaufen; Fähigkeiten auf Stufe 3 und 7. Mit dem Pinguin-Pass kommt
  je eine Meisterkraft ab Stufe 5 dazu (Ankerwurf, Sternschnuppen, Eiszeit).
- **17 Fähigkeiten** (Turbo, Walhai-Rakete, Schneesturm, Geldregen, Schlachtruf, Sabotage,
  Bombenteppich, Stachelsturm, Großer Knall, Walfang-Haken, Himmelsblitz und die Heldenfähigkeiten)
  mit Abklingzeit, unten links auf der Karte bzw. Tasten 1–9.
- **22 Fische:** Rotbarsch, Blaubarsch, Grünling, Goldfisch, Lachs, Fliegender Fisch (springt, in der
  Luft treffen ihn nur Flieger), Anglerfisch (immun gegen Explosionen), Eisfisch (immun gegen Kälte),
  Tintenfisch (blendet beim Platzen Pinguine in der Nähe), Panzerwels (immun gegen Spitzes), Zebrafisch,
  Regenbogenforelle, Kugelfisch (bläht sich nach einem Treffer auf, dann prallt kurz alles ab), Kofferfisch (10),
  Walhai (200), Schattenrochen (320, getarnt, taucht alle 5 s kurz auf, immun gegen Explosionen), Megalodon (700), Riesenkrake (4000) und die Bosse
  Krakus, Kaiser Orka, Hai-König und Eis-Leviathan. Dazu die Zusätze getarnt, nachwachsend (grüne Algen) und
  gepanzert (Helm, doppelt so zäh).
- **Ziele:** Erster, Letzter, Stärkster, Nächster, Riesen zuerst, Getarnte zuerst.
- **Koop:** bis zu 4 Spieler in einem Raum (4-stelliger Code). Der Gastgeber wählt Karte, Stufe,
  Modus und Geld: geteilt (eine Kasse, jeder darf alles) oder getrennt (jeder hat seine Kasse und
  rüstet nur eigene Pinguine auf). Jeder hat seinen eigenen Helden; Pause, Tempo und Auto gelten für alle.
  Der Server rechnet das Spiel mit und gibt den Takt vor, die Browser rechnen Takt für Takt nach und
  bekommen bei Abweichung den Spielstand neu. Wer die Verbindung verliert, kommt nach dem Neuladen zurück.
- **Pinguin-Pass:** Erfahrung für Runden, Bosse, Siege, Tagesaufträge und die Tages-Herausforderung,
  Stufe 1–50. Schaltet 19 Looks frei (u. a. Kaiserpinguin, Weihnachtsmütze, Zombie, Ritter, Roboter,
  Astronaut, Lava, Schatten, Nordlicht, Eisvogel und „Kaiser der Kaiser“ auf Stufe 50), 7 Sockel (Treibholz,
  Kristall, Lava, Nordlicht, Gold, Regenbogen, Diamant), Fischmünzen und die Meisterkräfte der Helden.
  Jeden Tag gibt es drei **Tagesaufträge** (z. B. Fische erwischen, Fähigkeiten einsetzen, Stufe 5 kaufen).
  Looks und Sockel sieht man auch im Koop. Im Browser gespeichert.
- **Tägliche Herausforderung:** jeden Tag dieselbe feste Aufgabe für alle (Karte, Stufe, Held und ein oder
  zwei Regeln wie „Nur Militär“, „Höchstens 6 Pinguine“, „Kein Verkaufen“, „Upgrades bis Stufe 3“).
- **Fischmünzen und Pinguin-Wissen:** Münzen für Runden, Siege, Erfolge, Aufträge und Pass-Stufen; damit
  lernen die Pinguine dauerhaft dazu (Startgeld, Leben, Rabatt, Rundenbonus, Helden-Erfahrung, Fähigkeiten).
  Gilt im Einzelspiel, nicht in Olympiade, Koop und Tages-Herausforderung; lässt sich abschalten.
- **26 Erfolge** mit Fischmünzen als Belohnung (Bosse besiegen, Extrem gewinnen, ohne Verkaufen gewinnen …).
- **Rundenvorschau** (welche Fische als Nächstes kommen), **Statistik** im Ergebnisbild (beste Pinguine,
  Spielzeit, Geld, Belohnungen) und **Einstellungen** (Lautstärke, Grafik, Menü-Design hell/dunkel,
  Vorschau, Lebensbalken, schwebende Texte, Kamerawackeln, Auto-Start).
- **Medaillen:** pro Karte eine je Schwierigkeit (Standardmodus) und eine je Spielmodus; die Modus-Medaille
  hat die Farbe der schwersten geschafften Stufe (Bronze, Silber, Gold, Diamant). Dazu Kamera-Zoom (Mausrad, zwei Finger,
  Knöpfe), Tempo 1×/2×/3×, automatischer Rundenstart, Spielstand nach jeder Runde im Browser gespeichert.

Tasten: Buchstaben am Pinguin im Laden (`Q W E R F T S P O V B M Z N L X G U I D K A`), Held `H`, Fähigkeiten `1`–`9`,
`Leertaste` Runde/Tempo, `,` `.` `-` Upgrades, `Entf` verkaufen, `Tab` Ziel bzw. Flugbahn wechseln,
`Esc` abbrechen/Pause. Mit gedrückter Umschalttaste mehrere gleiche Pinguine setzen.

## Großes Update: Abenteuer, Wetter, Kisten

- **Abenteuer (Kampagne):** „Die Reise nach Pinguinhausen“ – 4 Kapitel mit je 6 Levels und kleiner Geschichte
  (Opa Pingo erzählt). Jedes Level hat feste Karte, Stufe und Regeln (Startrunde, Startgeld, festes Wetter,
  erlaubte Pinguine, Bosse) und drei Sterne: Sieg plus zwei Aufgaben (keine Leben verlieren, höchstens N Pinguine,
  nicht verkaufen, keine Fähigkeit …). Drei Sterne bringen eine Kiste, jedes Kapitel einen Look. Endgegner: Abyssos.
- **Neue Pinguine:** Feuerwerks-Pinguin (`F`, bunte Raketen mit Sternen, Finale), Hexen-Pinguin (`X`, Gift, das
  nachwirkt, Krötentrank verwandelt kleine Fische in Rotbarsche, Riesen-Fluch, Hexenkatze, Großer Fluch) und
  Sturm-Pinguin (`G`, Tornados wehen Fische zurück, Gewitterblitze, Gegenwind, Orkan).
- **Neue Helden:** Sternenkapitänin Nova (Plasmablaster, Meteoritenhagel, Schwarzes Loch, Meisterkraft Supernova)
  und Walter Walross (Stoßzahn-Hiebe, Bauchklatscher, Walross-Ruf, Meisterkraft Walross-Lawine).
- **Neuer Boss Abyssos, der Tiefseekönig** mit Modus „Tiefsee-Finsternis“ (Runde 35 und 70): löscht immer
  wieder das Licht, dann sehen nur Pinguine mit Nachtsicht die Fische.
- **Neue Karten:** Leuchtturm-Bucht (Anfänger), Pinguin-Labyrinth (Mittel, zwei Tunnel, Kreuzungen) und
  Eisbergring (Profi, rund um einen riesigen Eisberg, hier zieht oft Wetter auf).
- **Wetter-Ereignisse** ab Runde 6 (im Menü abschaltbar, im Koop stellt es der Gastgeber ein): Schneesturm
  (Fische langsamer, Pinguine sehen weniger weit), Polarlicht (schneller, getarnte sichtbar), Eisregen
  (kleine Fische frieren kurz ein), Tauwetter (Fische flinker, mehr Geld), Nebel (weniger Reichweite).
- **Kisten** (Holz, Silber, Gold) mit Fischmünzen, Erfahrung und Kisten-Looks/-Sockeln; **Händler** mit
  täglich wechselndem Angebot; **Wochen-Quests** (5 pro Woche, Belohnung Kisten); **Saison** pro Monat mit
  eigener Leiste (10 Stufen) und Monats-Look; **Doppel-Erfahrung** als Booster.

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
  pass.js          Pinguin-Pass: Stufen, Looks, Sockel, Münzen, Meisterkräfte
  fortschritt.js   Erfolge, Pinguin-Wissen, Tagesaufträge, Tages-Herausforderung, Kisten, Händler, Wochen-Quests
  kampagne.js      Abenteuer: Kapitel, Levels, Sterne-Aufgaben
  editor.js        Karten-Editor
  modelle.js       3D-Modelle: Fische, Pinguine, Helden, Albatros, Geschosse
  welt3d.js        Szene: Scholle, Kanäle, Wasserlöcher, Themen, Kamera mit Zoom, Effekte
  ton.js           Geräusche (Web Audio, keine Dateien)
  oberflaeche.js   Menü, Seitenleiste, Fähigkeiten, Eingabe, Hauptschleife, Medaillen, Olympiade, Pass, Koop,
                   Rundenvorschau, Statistik, Einstellungen, eigene Karten
vendor/            three.js r128 (MIT) – selbst ausgeliefert
fonts/             Bricolage Grotesque (SIL OFL)
test/              Logik-Stresstest, Koop-Test, Balance-Bot, Browser-Rauchtest
```
