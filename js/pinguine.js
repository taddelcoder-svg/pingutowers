'use strict';
// Pingu Towers – alle Pinguine mit ihren Upgrade-Pfaden, die Fähigkeiten und die Helden.
// Regel wie im Vorbild: höchstens zwei Pfade, nur einer über Stufe 2 (also z. B. 5-2-0),
// und jede Stufe 5 gibt es pro Pinguinart und Pfad nur einmal auf der Karte.
(function (wurzel) {
  const PT = wurzel.PT || require('./daten.js');

  /* ---------- Angriffe ----------
     wurf     – Geschoss auf ein Ziel (anzahl/streuung für mehrere), splash = explodiert beim Treffer
     rundum   – Geschosse in alle Richtungen
     ring     – trifft alles in Reichweite auf einmal
     frost    – wie ring, friert dabei ein
     sofort   – trifft sofort, egal wie weit (Harpune)
     blitz    – springt von Fisch zu Fisch
     moerser  – Granate auf einen Zielpunkt
     stacheln – legt Stachelhaufen in den Kanal
     abwurf   – Bombe direkt unter dem Flieger */
  function angriff(werte) {
    return Object.assign({
      id:'haupt', art:'wurf', intervall:1, schaden:1, durchschlag:1, typ:'spitz', tempo:500, flug:300, groesse:5,
      bild:'zapfen', anzahl:1, streuung:0, splash:0, splashDurchschlag:0, riesen:0, frost:0,
      verlangsam:0, verlangsamDauer:0, betaeuben:0, riesenBetaeuben:0, riesenLangsam:0, zielsuchend:false, kette:0,
      kettenWeite:80, reichweite:0, splitter:0, nurRiesen:false, ablenken:0, panzerBrecher:false,
      flugzeit:0.9, ungenau:0, haufen:null, mine:null
    }, werte);
  }
  PT.angriff = angriff;
  const A = (s, id = 'haupt') => s.angriffe.find(a => a.id === id);
  // Fähigkeit hinzufügen oder ersetzen (gleiche id)
  function F(s, f) {
    s.faehigkeiten = (s.faehigkeiten || []).filter(x => x.id !== f.id);
    s.faehigkeiten.push(f);
  }
  PT.A = A;

  /* ---------- Fähigkeiten (Texte; die Wirkung steht in logik.js) ---------- */
  PT.FAEHIGKEITEN = {
    turbo:        { name:'Turbo', symbol:'⚡', text:'Dieser Pinguin greift kurz dreimal so schnell an.' },
    rakete:       { name:'Walhai-Rakete', symbol:'🚀', text:'Trifft den stärksten Riesen schwer.' },
    schneesturm:  { name:'Schneesturm', symbol:'❄️', text:'Friert alle Fische ein, Riesen werden langsam.' },
    geldregen:    { name:'Geldregen', symbol:'💰', text:'Sofort Geld.' },
    schlachtruf:  { name:'Schlachtruf', symbol:'📯', text:'Pinguine in der Nähe greifen kurz doppelt so schnell an.' },
    sabotage:     { name:'Sabotage', symbol:'🥷', text:'Alle Fische schwimmen eine Weile nur halb so schnell.' },
    bombenteppich:{ name:'Bombenteppich', symbol:'💣', text:'Trifft jeden Fisch auf der Karte.' },
    stachelsturm: { name:'Stachelsturm', symbol:'🌵', text:'Stachelhaufen überall im Kanal.' },
    knall:        { name:'Großer Knall', symbol:'💥', text:'Explosionen überall, betäubt alle Fische.' },
    haken:        { name:'Walfang-Haken', symbol:'🪝', text:'Zieht den stärksten Riesen heran und verletzt ihn schwer.' },
    himmelsblitz: { name:'Himmelsblitz', symbol:'🌌', text:'Polarlicht-Blitze treffen jeden Fisch.' },
    netz:         { name:'Fischernetz', symbol:'🕸️', text:'Betäubt alle Fische in der Nähe.' },
    torpedos:     { name:'Torpedo-Salve', symbol:'🎯', text:'Zwölf Torpedos auf die stärksten Fische.' },
    schleier:     { name:'Polarlichtschleier', symbol:'✨', text:'Pinguine in der Nähe greifen doppelt so schnell an.' },
    himmelsfeuer: { name:'Himmelsfeuer', symbol:'🔥', text:'Trifft jeden Fisch auf der Karte.' },
    eisfalle:     { name:'Eisfalle', symbol:'🧊', text:'Eine riesige Stachelfalle am Kanaleingang.' },
    kaelteschock: { name:'Kälteschock', symbol:'🥶', text:'Friert die ganze Karte ein, sogar Eisfische.' },
    orbital:      { name:'Orbital-Laser', symbol:'🛰️', text:'Ein Laser aus dem All trifft die stärksten Fische.' },
    nordlicht:    { name:'Nordlicht-Sturm', symbol:'🌠', text:'Trifft jeden Fisch, friert die kleinen ein und bremst die Riesen.' },
    tanz:         { name:'Tanzfieber', symbol:'🕺', text:'Alle Fische tanzen kurz statt zu schwimmen.' },
    party:        { name:'Party-Zeit', symbol:'🎉', text:'Pinguine in der Nähe greifen kurz doppelt so schnell an.' },
    anker:        { name:'Ankerwurf', symbol:'⚓', text:'Trifft die stärksten Riesen schwer und hält sie kurz fest.' },
    sternschnuppe:{ name:'Sternschnuppen', symbol:'💫', text:'Trifft jeden Fisch und enttarnt alle.' },
    eiszeit:      { name:'Eiszeit', symbol:'🧊', text:'Alle Fische schwimmen eine Weile halb so schnell, Pinguine in der Nähe werden schneller.' }
  };

  /* ---------- Pinguine ---------- */
  const PINGUINE = {
    /* ===== Primär ===== */
    zapfen: {
      name:'Zapfen-Pingu', preis:200, gruppe:'Primär', taste:'q', kurz:'Wirft spitze Eiszapfen. Günstig und vielseitig.',
      basis:() => ({ reichweite:125, camo:false, angriffe:[angriff({ intervall:0.95, schaden:1, durchschlag:2, tempo:560, flug:330, bild:'zapfen' })] }),
      pfade:[
        [
          { name:'Spitzere Zapfen', preis:140, text:'Durchschlag +1', fx:s => { A(s).durchschlag += 1; } },
          { name:'Eisspeere', preis:220, text:'Durchschlag +2', fx:s => { A(s).durchschlag += 2; } },
          { name:'Eiskugel-Schleuder', preis:550, text:'Rollt eine riesige Eiskugel, die 18 Fische zerquetscht – auch Panzerwelse.', fx:s => {
            const a = A(s); Object.assign(a, { durchschlag:18 + (a.durchschlag - 5), typ:'normal', tempo:300, flug:520, groesse:13, bild:'kugel', intervall:a.intervall * 1.2 }); } },
          { name:'Lawinen-Pingu', preis:1900, text:'Riesige Lawinenkugeln: 3 Schaden, 50 Durchschlag.', fx:s => {
            const a = A(s); Object.assign(a, { durchschlag:a.durchschlag + 32, schaden:3, groesse:20, bild:'lawine', flug:650, riesen:4 }); } },
          { name:'Gletscher-Walze', preis:14000, text:'Ein rollender Gletscher: 8 Schaden, 200 Durchschlag, zerfällt in sechs Lawinen.', fx:s => {
            const a = A(s); Object.assign(a, { durchschlag:a.durchschlag + 150, schaden:8, groesse:28, bild:'gletscher', flug:780, riesen:16, splitter:6, splitterArt:'lawine' }); } }
        ],
        [
          { name:'Schnelle Flossen', preis:100, text:'Wirft 15 % schneller.', fx:s => { A(s).intervall *= 0.85; } },
          { name:'Turbo-Flossen', preis:190, text:'Wirft noch 33 % schneller.', fx:s => { A(s).intervall *= 0.75; } },
          { name:'Dreifachwurf', preis:400, text:'Wirft drei Zapfen auf einmal.', fx:s => { const a = A(s); a.anzahl = 3; a.streuung = 0.22; } },
          { name:'Zapfen-Gewitter', preis:4200, text:'Wirft dreimal so schnell, +1 Schaden und +2 Durchschlag.', fx:s => {
            const a = A(s); a.intervall *= 0.33; a.schaden += 1; a.durchschlag += 2; a.bild = 'zapfenGold'; } },
          { name:'Zapfen-Orkan', preis:21000, text:'Doppelt so schnell, +3 Schaden. Fähigkeit Turbo: kurz dreifaches Tempo.', fx:s => {
            const a = A(s); a.intervall *= 0.5; a.schaden += 3; a.durchschlag += 3; a.riesen += 4; a.bild = 'zapfenPlasma';
            F(s, { id:'turbo', cd:40, dauer:8, faktor:3 }); } }
        ],
        [
          { name:'Fernglas', preis:90, text:'Reichweite +25.', fx:s => { s.reichweite += 25; } },
          { name:'Nachtsicht-Brille', preis:200, text:'Sieht getarnte Fische, Reichweite +20.', fx:s => { s.reichweite += 20; s.camo = true; } },
          { name:'Kristallzapfen', preis:650, text:'+2 Schaden, fliegen schneller und weiter.', fx:s => { const a = A(s); a.schaden += 2; a.tempo *= 1.3; a.flug *= 1.4; } },
          { name:'Eisauge', preis:2400, text:'Zielsuchende Zapfen, +3 Schaden, +3 Durchschlag, riesige Reichweite.', fx:s => {
            const a = A(s); a.schaden += 3; a.durchschlag += 3; a.zielsuchend = true; a.flug *= 1.5; s.reichweite += 90; a.bild = 'zapfenBlau'; } },
          { name:'Meisterschütze', preis:24000, text:'+12 Schaden, +10 gegen Riesen, doppelt so schnell.', fx:s => {
            const a = A(s); a.schaden += 12; a.riesen += 10; a.durchschlag += 4; a.intervall *= 0.5; s.reichweite += 40; a.bild = 'zapfenPlasma'; } }
        ]
      ]
    },

    rundum: {
      name:'Stachel-Pingu', preis:280, gruppe:'Primär', taste:'w', kurz:'Schießt Eissplitter in alle Richtungen. Stark an Kurven.',
      basis:() => ({ reichweite:80, camo:false, angriffe:[angriff({ art:'rundum', intervall:1.3, schaden:1, durchschlag:1, anzahl:8, tempo:420, flug:88, groesse:4, bild:'splitter' })] }),
      pfade:[
        [
          { name:'Schnelleres Drehen', preis:150, text:'Schießt 20 % schneller.', fx:s => { A(s).intervall *= 0.8; } },
          { name:'Wirbelwind', preis:300, text:'Schießt noch 33 % schneller.', fx:s => { A(s).intervall *= 0.75; } },
          { name:'Splitter-Regen', preis:650, text:'16 Splitter pro Salve.', fx:s => { A(s).anzahl = 16; } },
          { name:'Eis-Mahlstrom', preis:3600, text:'Ein Dauerfeuer aus Splittern, +1 Schaden.', fx:s => { const a = A(s); a.intervall *= 0.3; a.schaden += 1; a.bild = 'splitterGold'; } },
          { name:'Eis-Tornado', preis:20000, text:'24 Splitter im Dauerfeuer, +3 Schaden, +6 gegen Riesen.', fx:s => {
            const a = A(s); a.anzahl = 24; a.intervall *= 0.5; a.schaden += 3; a.riesen += 6; a.durchschlag += 2; s.reichweite += 15; a.flug += 15; } }
        ],
        [
          { name:'Längere Splitter', preis:110, text:'Reichweite +12, Durchschlag +1.', fx:s => { s.reichweite += 12; A(s).flug += 12; A(s).durchschlag += 1; } },
          { name:'Weitschuss', preis:230, text:'Reichweite +15.', fx:s => { s.reichweite += 15; A(s).flug += 15; } },
          { name:'Eisring', preis:750, text:'Statt Splittern trifft ein Ring alle Fische in Reichweite – auch Panzerwelse.', fx:s => {
            Object.assign(A(s), { art:'ring', typ:'normal', intervall:0.55, durchschlag:40, bild:'ring' }); } },
          { name:'Polar-Inferno', preis:3200, text:'Ring mit 3 Schaden, schneller und größer, +5 gegen Riesen.', fx:s => {
            const a = A(s); a.schaden = 3; a.intervall *= 0.65; a.riesen += 5; s.reichweite += 20; a.durchschlag = 80; a.bild = 'ringLila'; } },
          { name:'Polarsonne', preis:36000, text:'Eine kleine Sonne: 12 Schaden im Ring, +40 gegen Riesen.', fx:s => {
            const a = A(s); a.schaden = 12; a.intervall *= 0.6; a.riesen += 40; s.reichweite += 25; a.durchschlag = 200; a.bild = 'sonne'; } }
        ],
        [
          { name:'Scharfe Splitter', preis:150, text:'Durchschlag +1.', fx:s => { A(s).durchschlag += 1; } },
          { name:'Rasiersplitter', preis:420, text:'+1 Schaden, Durchschlag +1.', fx:s => { A(s).schaden += 1; A(s).durchschlag += 1; } },
          { name:'Stachelsturm', preis:1000, text:'10 Splitter mit Durchschlag +3.', fx:s => { const a = A(s); if (a.art === 'rundum') a.anzahl = Math.max(a.anzahl, 10); a.durchschlag += 3; } },
          { name:'Klingen-Wirbel', preis:2800, text:'Doppelt so schnell, +2 Schaden, sieht getarnte Fische.', fx:s => { const a = A(s); a.intervall *= 0.5; a.schaden += 2; s.camo = true; a.bild = 'klinge'; } },
          { name:'Klingen-Mahlstrom', preis:16000, text:'16 Klingen, +5 Schaden, +10 Durchschlag.', fx:s => {
            const a = A(s); if (a.art === 'rundum') a.anzahl = Math.max(a.anzahl, 16); a.schaden += 5; a.durchschlag += 10; a.riesen += 4; a.intervall *= 0.7; } }
        ]
      ]
    },

    schneeball: {
      name:'Schneeball-Pingu', preis:525, gruppe:'Primär', taste:'e', kurz:'Wirft explodierende Schneebälle. Nichts gegen Anglerfische!',
      basis:() => ({ reichweite:140, camo:false, angriffe:[angriff({ intervall:1.5, schaden:1, typ:'explosion', tempo:400, flug:300, groesse:8, bild:'schneeball', splash:38, splashDurchschlag:14 })] }),
      pfade:[
        [
          { name:'Größere Schneebälle', preis:250, text:'Größere Explosion, trifft mehr Fische.', fx:s => { const a = A(s); a.splash += 14; a.splashDurchschlag += 10; } },
          { name:'Riesenschneeball', preis:650, text:'Noch größere Explosion, 40 Fische.', fx:s => { const a = A(s); a.splash += 16; a.splashDurchschlag = 40; a.groesse = 11; } },
          { name:'Streu-Schneeball', preis:1500, text:'Zerfällt in 8 kleine Schneebälle, die noch einmal explodieren.', fx:s => { A(s).splitter = 8; } },
          { name:'Lawinen-Kanone', preis:5000, text:'+3 Schaden, riesige Explosion, +6 gegen Riesen.', fx:s => { const a = A(s); a.schaden += 3; a.splash += 25; a.splashDurchschlag = 70; a.riesen += 6; a.bild = 'schneeballGross'; } },
          { name:'Lawinen-Inferno', preis:42000, text:'+12 Schaden, gewaltige Explosionen, betäubt kurz.', fx:s => {
            const a = A(s); a.schaden += 12; a.splash += 30; a.splashDurchschlag = 120; a.riesen += 25; a.betaeuben = 0.5; a.splitter = 12; a.intervall *= 0.7; } }
        ],
        [
          { name:'Schneller Wurf', preis:250, text:'Wirft 25 % schneller.', fx:s => { A(s).intervall *= 0.75; } },
          { name:'Schneeball-Salve', preis:650, text:'Wirft 33 % schneller.', fx:s => { A(s).intervall *= 0.66; } },
          { name:'Walhai-Schreck', preis:1100, text:'+15 Schaden gegen Walhaie und andere Riesen.', fx:s => { A(s).riesen += 15; } },
          { name:'Walhai-Zerstörer', preis:3400, text:'+45 gegen Riesen, +2 Schaden. Fähigkeit: Walhai-Rakete (750 Schaden).', fx:s => {
            const a = A(s); a.riesen += 30; a.schaden += 2; a.bild = 'rakete'; F(s, { id:'rakete', cd:30, schaden:750, anzahl:1 }); } },
          { name:'Riesen-Vernichter', preis:26000, text:'+150 gegen Riesen. Rakete: 3 × 2500 Schaden, öfter.', fx:s => {
            const a = A(s); a.riesen += 150; a.intervall *= 0.8; F(s, { id:'rakete', cd:20, schaden:2500, anzahl:3 }); } }
        ],
        [
          { name:'Weitwurf', preis:200, text:'Reichweite +30.', fx:s => { s.reichweite += 30; A(s).flug += 30; } },
          { name:'Matschbälle', preis:400, text:'Getroffene Fische schwimmen 2 s lang halb so schnell.', fx:s => { const a = A(s); a.verlangsam = 0.5; a.verlangsamDauer = 2; } },
          { name:'Betäubungsbombe', preis:1100, text:'Betäubt getroffene Fische kurz.', fx:s => { A(s).betaeuben = 0.7; } },
          { name:'Schockwelle', preis:3000, text:'Betäubt sogar Riesen, +3 Schaden, größere Explosion.', fx:s => { const a = A(s); a.riesenBetaeuben = 0.5; a.schaden += 3; a.splash += 20; a.splashDurchschlag += 20; a.bild = 'schneeballBlau'; } },
          { name:'Schneebeben', preis:24000, text:'Betäubt Riesen eine Sekunde, +8 Schaden, gewaltige Druckwelle.', fx:s => {
            const a = A(s); a.riesenBetaeuben = 1; a.betaeuben = 1.2; a.schaden += 8; a.splash += 40; a.splashDurchschlag += 60; a.riesen += 10; } }
        ]
      ]
    },

    frost: {
      name:'Frost-Pingu', preis:500, gruppe:'Primär', taste:'r', kurz:'Friert alle Fische um sich herum ein. Eisfische lachen darüber.',
      basis:() => ({ reichweite:70, camo:false, angriffe:[angriff({ art:'frost', intervall:2.2, schaden:1, durchschlag:40, typ:'kaelte', frost:1.0, bild:'frost' })] }),
      pfade:[
        [
          { name:'Dauerfrost', preis:200, text:'Friert länger ein.', fx:s => { A(s).frost += 0.6; } },
          { name:'Permafrost', preis:350, text:'Aufgetaute Fische bleiben lange langsam.', fx:s => { const a = A(s); a.verlangsam = 0.55; a.verlangsamDauer = 6; } },
          { name:'Eiszapfen-Rüstung', preis:1500, text:'+2 Schaden beim Einfrieren, trifft auch Panzerwelse.', fx:s => { const a = A(s); a.schaden += 2; a.panzerBrecher = true; } },
          { name:'Absoluter Nullpunkt', preis:3200, text:'Friert noch länger ein und bremst sogar Riesen stark.', fx:s => { const a = A(s); a.frost += 0.8; a.riesenLangsam = 0.4; s.reichweite += 25; a.bild = 'frostStark'; } },
          { name:'Ewiges Eis', preis:28000, text:'+6 Schaden, friert ewig ein. Fähigkeit Schneesturm: die ganze Karte friert.', fx:s => {
            const a = A(s); a.schaden += 6; a.frost += 1.5; a.riesen += 10; s.reichweite += 20; F(s, { id:'schneesturm', cd:40, dauer:4 }); } }
        ],
        [
          { name:'Weiter Frost', preis:150, text:'Reichweite +15.', fx:s => { s.reichweite += 15; } },
          { name:'Arktischer Wind', preis:400, text:'Alle Fische in Reichweite sind dauerhaft langsamer.', fx:s => { s.wind = 0.6; s.reichweite += 10; } },
          { name:'Frostsplitter', preis:900, text:'Schießt zusätzlich Eissplitter auf Fische in der Nähe.', fx:s => {
            s.angriffe.push(angriff({ id:'splitter', art:'rundum', intervall:0.9, schaden:1, durchschlag:2, anzahl:8, tempo:420, flug:s.reichweite + 10, groesse:4, bild:'splitterBlau' })); } },
          { name:'Eiszeit', preis:4000, text:'Doppelt so oft, +2 Schaden, bremst Riesen.', fx:s => { const a = A(s); a.intervall *= 0.5; a.schaden += 2; a.riesenLangsam = Math.min(a.riesenLangsam || 1, 0.6); s.wind = 0.45; a.bild = 'frostStark'; } },
          { name:'Eiszeitalter', preis:30000, text:'Riesiger Kältebereich: Fische schwimmen dort im Schneckentempo, +6 Schaden.', fx:s => {
            const a = A(s); s.wind = 0.3; s.windRiesen = 0.5; s.reichweite += 45; a.schaden += 6; a.riesen += 10; const b = A(s, 'splitter'); if (b) { b.schaden += 4; b.flug = s.reichweite + 10; } } }
        ],
        [
          { name:'Schnellfrost', preis:200, text:'Friert 25 % öfter ein.', fx:s => { A(s).intervall *= 0.75; } },
          { name:'Kältesinn', preis:350, text:'Friert auch getarnte Fische ein.', fx:s => { s.camo = true; } },
          { name:'Eisstrahl', preis:1200, text:'Schießt zusätzlich gezielte Eisstrahlen, die einzelne Fische einfrieren.', fx:s => {
            s.angriffe.push(angriff({ id:'strahl', art:'wurf', intervall:0.8, schaden:2, durchschlag:3, typ:'kaelte', tempo:620, flug:s.reichweite + 70, frost:0.8, groesse:5, bild:'eisstrahl', reichweite:s.reichweite + 60 })); } },
          { name:'Blizzard', preis:3000, text:'Reichweite +45, friert schneller und länger ein.', fx:s => { const a = A(s); s.reichweite += 45; a.intervall *= 0.6; a.frost += 0.5; for (const b of s.angriffe) if (b.reichweite) b.reichweite += 45; a.bild = 'frostStark'; } },
          { name:'Eiskristall-Kanone', preis:25000, text:'Eisstrahlen mit +15 Schaden und +30 gegen Riesen, dreimal so schnell.', fx:s => {
            const b = A(s, 'strahl'); if (b) { b.schaden += 15; b.riesen += 30; b.intervall *= 0.33; b.durchschlag += 5; b.typ = 'normal'; b.bild = 'eisstrahlGross'; } } }
        ]
      ]
    },

    /* ===== Militär ===== */
    harpune: {
      name:'Harpunen-Pingu', preis:350, gruppe:'Militär', taste:'t', kurz:'Trifft jeden Fisch auf der ganzen Karte sofort.',
      basis:() => ({ reichweite:9999, camo:false, angriffe:[angriff({ art:'sofort', intervall:1.6, schaden:2, durchschlag:1, typ:'spitz', bild:'harpune' })] }),
      pfade:[
        [
          { name:'Große Harpune', preis:350, text:'4 Schaden pro Treffer.', fx:s => { A(s).schaden = 4; } },
          { name:'Walfänger-Harpune', preis:1300, text:'7 Schaden, durchbohrt auch Panzerwelse.', fx:s => { const a = A(s); a.schaden = 7; a.typ = 'normal'; } },
          { name:'Tiefsee-Harpune', preis:3000, text:'18 Schaden pro Treffer.', fx:s => { A(s).schaden = 18; } },
          { name:'Kapitän Pingu', preis:6500, text:'30 Schaden, +30 gegen Riesen.', fx:s => { const a = A(s); a.schaden = 30; a.riesen += 30; a.bild = 'harpuneGold'; } },
          { name:'Ahabs Rache', preis:30000, text:'100 Schaden, +200 gegen Riesen.', fx:s => { const a = A(s); a.schaden = 100; a.riesen += 170; a.bild = 'harpuneGold'; } }
        ],
        [
          { name:'Nachtsicht', preis:300, text:'Trifft getarnte Fische.', fx:s => { s.camo = true; } },
          { name:'Splitterharpune', preis:450, text:'Beim Treffer fliegen Splitter auf Fische dahinter.', fx:s => { const a = A(s); a.splash = 40; a.splashDurchschlag = 5; } },
          { name:'Netzharpune', preis:2000, text:'Betäubt den getroffenen Fisch – bei Riesen kurz.', fx:s => { const a = A(s); a.betaeuben = 1; a.riesenBetaeuben = 0.4; } },
          { name:'Fischkutter', preis:5500, text:'Bringt jede Runde 1000 extra Geld und schießt schneller.', fx:s => { s.geld = { flat:1000, kisten:0, wert:0 }; A(s).intervall *= 0.7; } },
          { name:'Hafen-Imperium', preis:18000, text:'+3000 Geld pro Runde. Fähigkeit Geldregen: sofort 2500.', fx:s => { s.geld.flat = 3000; A(s).intervall *= 0.7; F(s, { id:'geldregen', cd:60, betrag:2500 }); } }
        ],
        [
          { name:'Schneller Nachladen', preis:400, text:'Schießt 30 % schneller.', fx:s => { A(s).intervall *= 0.7; } },
          { name:'Halbautomatik', preis:1500, text:'Schießt dreimal so schnell.', fx:s => { A(s).intervall *= 0.33; } },
          { name:'Vollautomatik', preis:3500, text:'Schießt doppelt so schnell, +2 Schaden.', fx:s => { const a = A(s); a.intervall *= 0.5; a.schaden += 2; } },
          { name:'Harpunen-Hagel', preis:9000, text:'Unglaublich schnelles Dauerfeuer.', fx:s => { const a = A(s); a.intervall *= 0.4; a.schaden += 2; a.bild = 'harpuneGold'; } },
          { name:'Harpunen-Gewitter', preis:32000, text:'Noch doppelt so schnell, +8 Schaden, jede Harpune explodiert.', fx:s => {
            const a = A(s); a.intervall *= 0.5; a.schaden += 8; a.riesen += 8; a.splash = Math.max(a.splash, 35); a.splashDurchschlag = Math.max(a.splashDurchschlag, 8); } }
        ]
      ]
    },

    boot: {
      name:'Boot-Pingu', preis:500, gruppe:'Militär', taste:'s', wasser:true, kurz:'Fährt nur in Wasserlöchern. Harpunen nach vorn und hinten.',
      basis:() => ({ reichweite:150, camo:false, angriffe:[
        angriff({ intervall:1.0, schaden:1, durchschlag:4, tempo:600, flug:300, bild:'harpuneKlein' }),
        angriff({ id:'hinten', intervall:1.0, schaden:1, durchschlag:4, tempo:600, flug:300, bild:'harpuneKlein', hinten:true })
      ] }),
      pfade:[
        [
          { name:'Schnellere Ruder', preis:300, text:'Schießt 25 % schneller.', fx:s => { for (const a of s.angriffe) a.intervall *= 0.75; } },
          { name:'Bordkanone', preis:500, text:'Feuert zusätzlich explodierende Kanonenkugeln.', fx:s => {
            s.angriffe.push(angriff({ id:'kanone', intervall:1.4, schaden:1, typ:'explosion', tempo:450, flug:320, groesse:7, bild:'kanonenkugel', splash:32, splashDurchschlag:12 })); } },
          { name:'Zerstörer', preis:2900, text:'Alles schießt viermal so schnell.', fx:s => { for (const a of s.angriffe) a.intervall *= 0.25; } },
          { name:'Eisbrecher-Flaggschiff', preis:8500, text:'+2 Schaden für alles, Kanonen +6 gegen Riesen.', fx:s => { for (const a of s.angriffe) { a.schaden += 2; a.durchschlag += 2; } const k = A(s, 'kanone'); if (k) k.riesen += 6; } },
          { name:'Polar-Armada', preis:30000, text:'Doppelt so schnell, +4 Schaden, riesige Kanonenexplosionen.', fx:s => {
            for (const a of s.angriffe) { a.intervall *= 0.5; a.schaden += 4; a.riesen += 4; } const k = A(s, 'kanone'); if (k) { k.splash += 30; k.splashDurchschlag += 20; } } }
        ],
        [
          { name:'Fischernetz', preis:350, text:'Durchschlag +3.', fx:s => { for (const a of s.angriffe) a.durchschlag += 3; } },
          { name:'Handelsschiff', preis:950, text:'+200 Geld am Ende jeder Runde.', fx:s => { s.geld = { flat:200, kisten:0, wert:0 }; } },
          { name:'Handelsflotte', preis:3000, text:'+600 Geld pro Runde.', fx:s => { s.geld.flat = 600; } },
          { name:'Hafenmeister', preis:7000, text:'+1500 Geld pro Runde, Boote in der Nähe schießen schneller.', fx:s => { s.geld.flat = 1500; s.buff = { reichweite:0, camo:false, tempo:0.85, schaden:0, durchschlag:1, rabatt:0, nurWasser:true }; } },
          { name:'Reederei', preis:25000, text:'+4500 Geld pro Runde.', fx:s => { s.geld.flat = 4500; } }
        ],
        [
          { name:'Fernrohr', preis:180, text:'Reichweite +30.', fx:s => { s.reichweite += 30; for (const a of s.angriffe) a.flug += 30; } },
          { name:'Ausguck', preis:400, text:'Sieht getarnte Fische.', fx:s => { s.camo = true; } },
          { name:'Walfang-Haken', preis:2500, text:'Fähigkeit: Ein Haken zieht den stärksten Riesen heran (1000 Schaden).', fx:s => { F(s, { id:'haken', cd:30, schaden:1000, anzahl:1 }); } },
          { name:'Piratenkapitän', preis:6000, text:'Zwei Haken mit je 2500 Schaden, +5 gegen Riesen für alles.', fx:s => { F(s, { id:'haken', cd:22, schaden:2500, anzahl:2 }); for (const a of s.angriffe) a.riesen += 5; } },
          { name:'Piratenlord', preis:25000, text:'Vier Haken mit je 6000 Schaden, viel öfter.', fx:s => { F(s, { id:'haken', cd:15, schaden:6000, anzahl:4 }); for (const a of s.angriffe) { a.riesen += 10; a.schaden += 2; } } }
        ]
      ]
    },

    flieger: {
      name:'Albatros-Pilot', preis:800, gruppe:'Militär', taste:'p', kurz:'Fliegt auf einem Albatros über die Karte und schießt Pfeile nach allen Seiten.',
      basis:() => ({ reichweite:9999, camo:false, flieger:{ tempo:150, muster:'acht' }, angriffe:[
        angriff({ art:'rundum', intervall:1.4, schaden:1, durchschlag:5, anzahl:8, tempo:480, flug:160, groesse:5, bild:'pfeil', reichweite:150 })
      ] }),
      pfade:[
        [
          { name:'Schnellere Flügel', preis:650, text:'Fliegt schneller und schießt 20 % öfter.', fx:s => { s.flieger.tempo += 60; A(s).intervall *= 0.8; } },
          { name:'Lenkpfeile', preis:900, text:'Die Pfeile suchen sich ihr Ziel selbst.', fx:s => { A(s).zielsuchend = true; } },
          { name:'Pfeil-Geschwader', preis:3000, text:'16 Pfeile pro Salve, 30 % schneller.', fx:s => { const a = A(s); a.anzahl = 16; a.intervall *= 0.7; } },
          { name:'Polar-Phantom', preis:16000, text:'32 Pfeile, +2 Schaden, noch schneller.', fx:s => { const a = A(s); a.anzahl = 32; a.schaden += 2; a.intervall *= 0.6; a.durchschlag += 3; a.bild = 'pfeilGold'; } },
          { name:'Nordlicht-Jet', preis:40000, text:'+5 Schaden, +10 gegen Riesen, doppelt so schnell.', fx:s => { const a = A(s); a.schaden += 5; a.riesen += 10; a.intervall *= 0.5; s.flieger.tempo += 80; } }
        ],
        [
          { name:'Schneebomben', preis:500, text:'Wirft Schneebomben direkt unter sich ab.', fx:s => {
            s.angriffe.push(angriff({ id:'bombe', art:'abwurf', intervall:1.2, schaden:2, typ:'explosion', splash:45, splashDurchschlag:20, bild:'schneeball', reichweite:60 })); } },
          { name:'Eisregen', preis:900, text:'Größere Bomben, öfter.', fx:s => { const b = A(s, 'bombe'); if (b) { b.splash += 20; b.splashDurchschlag += 15; b.intervall *= 0.75; } } },
          { name:'Bombenteppich', preis:2500, text:'Fähigkeit: 25 Schaden für jeden Fisch auf der Karte.', fx:s => { F(s, { id:'bombenteppich', cd:50, schaden:25, riesen:0 }); } },
          { name:'Lawinenbomber', preis:9000, text:'Bombenteppich mit 150 Schaden, Bomben +3 Schaden.', fx:s => { F(s, { id:'bombenteppich', cd:40, schaden:150, riesen:300 }); const b = A(s, 'bombe'); if (b) { b.schaden += 3; b.riesen += 5; } } },
          { name:'Schwarzer Schwan', preis:35000, text:'Bombenteppich mit 700 Schaden, Bomben +10 Schaden.', fx:s => { F(s, { id:'bombenteppich', cd:30, schaden:700, riesen:2000 }); const b = A(s, 'bombe'); if (b) { b.schaden += 10; b.riesen += 20; b.intervall *= 0.5; } } }
        ],
        [
          { name:'Leichter Sattel', preis:200, text:'Fliegt schneller.', fx:s => { s.flieger.tempo += 50; } },
          { name:'Nachtsicht-Brille', preis:400, text:'Sieht getarnte Fische.', fx:s => { s.camo = true; } },
          { name:'Bordschütze', preis:1800, text:'Ein zweiter Pingu schießt Dauerfeuer nach vorn.', fx:s => {
            s.angriffe.push(angriff({ id:'mg', intervall:0.12, schaden:2, durchschlag:2, tempo:700, flug:200, groesse:4, bild:'eisstrahl', reichweite:180 })); } },
          { name:'Riesenjäger', preis:7000, text:'Bordschütze +2 Schaden, +6 gegen Riesen.', fx:s => { const b = A(s, 'mg'); if (b) { b.schaden += 2; b.riesen += 6; } } },
          { name:'Himmelswächter', preis:30000, text:'Bordschütze +8 Schaden, +20 gegen Riesen, doppelt so schnell.', fx:s => { const b = A(s, 'mg'); if (b) { b.schaden += 8; b.riesen += 20; b.intervall *= 0.5; b.durchschlag += 3; } } }
        ]
      ]
    },

    moerser: {
      name:'Schneemörser', preis:750, gruppe:'Militär', taste:'o', kurz:'Schießt Schnee-Granaten auf einen Zielpunkt, den du selbst festlegst.',
      basis:() => ({ reichweite:9999, camo:false, angriffe:[angriff({ art:'moerser', intervall:2.0, schaden:1, typ:'explosion', splash:42, splashDurchschlag:40, ungenau:30, flugzeit:0.9, bild:'granate' })] }),
      pfade:[
        [
          { name:'Größere Ladung', preis:500, text:'Größere Explosion.', fx:s => { const a = A(s); a.splash += 15; a.splashDurchschlag += 15; } },
          { name:'Volltreffer', preis:550, text:'Trifft viel genauer.', fx:s => { A(s).ungenau = 8; } },
          { name:'Lawinenschuss', preis:1800, text:'+2 Schaden, trifft jetzt auch Anglerfische.', fx:s => { const a = A(s); a.schaden += 2; a.splash += 15; a.splashDurchschlag = 80; a.typ = 'normal'; } },
          { name:'Wucht-Granate', preis:7500, text:'+5 Schaden, +15 gegen Riesen, betäubt.', fx:s => { const a = A(s); a.schaden += 5; a.riesen += 15; a.betaeuben = 0.6; a.bild = 'granateGross'; } },
          { name:'Polarvulkan', preis:32000, text:'+15 Schaden, gewaltige Einschläge, +60 gegen Riesen.', fx:s => { const a = A(s); a.schaden += 15; a.splash = 140; a.splashDurchschlag = 200; a.riesen += 60; } }
        ],
        [
          { name:'Schnelles Nachladen', preis:300, text:'Schießt 25 % schneller.', fx:s => { A(s).intervall *= 0.75; } },
          { name:'Dauerfeuer', preis:500, text:'Schießt 33 % schneller.', fx:s => { A(s).intervall *= 0.66; } },
          { name:'Mörserbatterie', preis:2000, text:'Drei Granaten auf einmal.', fx:s => { const a = A(s); a.anzahl = 3; a.ungenau = Math.max(a.ungenau, 35); } },
          { name:'Großer Knall', preis:6000, text:'Fähigkeit: Explosionen auf dem ganzen Kanal (40 Schaden), alle betäubt.', fx:s => { F(s, { id:'knall', cd:45, schaden:40, betaeuben:2 }); } },
          { name:'Weltuntergang', preis:28000, text:'Großer Knall mit 400 Schaden, Mörser doppelt so schnell.', fx:s => { F(s, { id:'knall', cd:35, schaden:400, betaeuben:3 }); A(s).intervall *= 0.5; } }
        ],
        [
          { name:'Kälteladung', preis:500, text:'Getroffene Fische werden 2 s langsamer.', fx:s => { const a = A(s); a.verlangsam = 0.5; a.verlangsamDauer = 2; } },
          { name:'Splitterladung', preis:600, text:'Jede Granate verstreut Eissplitter.', fx:s => { A(s).splitterNadeln = 6; } },
          { name:'Schockladung', preis:1500, text:'Betäubt getroffene Fische kurz.', fx:s => { A(s).betaeuben = Math.max(A(s).betaeuben, 0.5); } },
          { name:'Gefrierbombe', preis:6500, text:'Friert getroffene Fische ein, +4 Schaden.', fx:s => { const a = A(s); a.frost = 1; a.schaden += 4; a.riesenLangsam = 0.6; } },
          { name:'Absolute Kälte', preis:26000, text:'Friert lange ein, Riesen werden stark gebremst, +10 Schaden.', fx:s => { const a = A(s); a.frost = 2; a.schaden += 10; a.riesenLangsam = 0.35; a.riesen += 20; } }
        ]
      ]
    },

    /* ===== Magie ===== */
    polar: {
      name:'Polarlicht-Pingu', preis:375, gruppe:'Magie', taste:'z', kurz:'Zaubert Polarlicht-Blitze. Trifft alle Fischarten.',
      basis:() => ({ reichweite:130, camo:false, angriffe:[angriff({ intervall:1.1, schaden:1, durchschlag:3, typ:'normal', tempo:460, flug:260, groesse:6, bild:'magie' })] }),
      pfade:[
        [
          { name:'Starke Magie', preis:150, text:'+1 Schaden, Durchschlag +2.', fx:s => { const a = A(s); a.schaden += 1; a.durchschlag += 2; } },
          { name:'Nordlicht-Blitz', preis:650, text:'Ein Blitz, der zwischen 8 Fischen hin- und herspringt.', fx:s => {
            s.angriffe.push(angriff({ id:'blitz', art:'blitz', intervall:2.2, schaden:1, kette:8, typ:'normal', bild:'blitz' })); } },
          { name:'Polarsturm', preis:2300, text:'Blitze springen zu 16 Fischen, +1 Schaden, öfter.', fx:s => { const b = A(s, 'blitz'); b.kette = 16; b.schaden += 1; b.intervall *= 0.6; } },
          { name:'Aurora-Beschwörer', preis:5200, text:'Gewaltige Blitze: 30 Sprünge, +2 Schaden, doppelt so oft.', fx:s => { const b = A(s, 'blitz'); b.kette = 30; b.schaden += 2; b.intervall *= 0.5; b.bild = 'blitzGross'; } },
          { name:'Aurora-Gott', preis:32000, text:'Blitze mit 60 Sprüngen und +6 Schaden. Fähigkeit Himmelsblitz.', fx:s => {
            const b = A(s, 'blitz'); b.kette = 60; b.schaden += 6; b.riesen += 10; b.intervall *= 0.6; F(s, { id:'himmelsblitz', cd:45, schaden:60, riesen:600 }); } }
        ],
        [
          { name:'Weite Magie', preis:200, text:'Reichweite +25.', fx:s => { s.reichweite += 25; A(s).flug += 25; } },
          { name:'Wissende Augen', preis:300, text:'Sieht getarnte Fische.', fx:s => { s.camo = true; } },
          { name:'Eissäulen', preis:900, text:'Zaubert Eissäulen, die alles in der Nähe treffen.', fx:s => {
            s.angriffe.push(angriff({ id:'saeule', art:'ring', intervall:0.4, schaden:1, durchschlag:12, typ:'normal', bild:'saeule', reichweite:s.reichweite * 0.55 })); } },
          { name:'Schnee-Eule', preis:4200, text:'Eine magische Eule fliegt mit und schießt Dauerfeuer.', fx:s => {
            s.angriffe.push(angriff({ id:'eule', intervall:0.12, schaden:2, durchschlag:3, typ:'normal', tempo:620, flug:380, groesse:5, bild:'eule', reichweite:s.reichweite + 120, zielsuchend:true })); s.eule = 1; } },
          { name:'Eulenkönigin', preis:28000, text:'Zwei Eulen, beide mit +6 Schaden und +10 gegen Riesen.', fx:s => {
            const e = A(s, 'eule'); e.schaden += 6; e.riesen += 10; e.anzahl = 2; e.streuung = 0.2; s.eule = 2; const p = A(s, 'saeule'); if (p) p.schaden += 3; } }
        ],
        [
          { name:'Schnellzauber', preis:150, text:'Zaubert 20 % schneller.', fx:s => { A(s).intervall *= 0.8; } },
          { name:'Doppelzauber', preis:700, text:'Zwei Blitze auf einmal.', fx:s => { const a = A(s); a.anzahl = 2; a.streuung = 0.18; } },
          { name:'Zaubersalve', preis:1500, text:'Drei Blitze, 25 % schneller.', fx:s => { const a = A(s); a.anzahl = 3; a.intervall *= 0.75; } },
          { name:'Erzmagier', preis:5000, text:'Vier zielsuchende Blitze mit +3 Schaden.', fx:s => { const a = A(s); a.anzahl = 4; a.schaden += 3; a.zielsuchend = true; a.durchschlag += 3; a.bild = 'magieGross'; } },
          { name:'Großmeister der Magie', preis:30000, text:'Sechs Blitze mit +8 Schaden, +10 gegen Riesen.', fx:s => { const a = A(s); a.anzahl = 6; a.schaden += 8; a.riesen += 10; a.durchschlag += 6; a.intervall *= 0.7; } }
        ]
      ]
    },

    ninja: {
      name:'Ninja-Pingu', preis:400, gruppe:'Magie', taste:'n', kurz:'Wirft schnell Wurfsterne und sieht von Anfang an getarnte Fische.',
      basis:() => ({ reichweite:120, camo:true, angriffe:[angriff({ intervall:0.62, schaden:1, durchschlag:2, tempo:720, flug:260, groesse:5, bild:'stern' })] }),
      pfade:[
        [
          { name:'Ninja-Disziplin', preis:300, text:'Reichweite +20, wirft 25 % schneller.', fx:s => { s.reichweite += 20; A(s).intervall *= 0.75; } },
          { name:'Scharfe Sterne', preis:350, text:'Durchschlag +4.', fx:s => { A(s).durchschlag += 4; } },
          { name:'Doppelwurf', preis:850, text:'Zwei Sterne auf einmal, 20 % schneller.', fx:s => { const a = A(s); a.anzahl = 2; a.streuung = 0.12; a.intervall *= 0.8; } },
          { name:'Stern-Meister', preis:2750, text:'Fünf zielsuchende Sterne, +4 Schaden.', fx:s => { const a = A(s); a.anzahl = 5; a.schaden += 4; a.zielsuchend = true; a.streuung = 0.15; a.bild = 'sternGold'; } },
          { name:'Großmeister der Schatten', preis:35000, text:'Acht Sterne, +6 Schaden, +10 gegen Riesen, doppelt so schnell.', fx:s => { const a = A(s); a.anzahl = 8; a.schaden += 6; a.riesen += 10; a.intervall *= 0.5; a.durchschlag += 4; } }
        ],
        [
          { name:'Schattenschritt', preis:250, text:'Reichweite +15.', fx:s => { s.reichweite += 15; } },
          { name:'Verwirrung', preis:350, text:'Getroffene Fische werden manchmal ein Stück zurückgeworfen.', fx:s => { A(s).ablenken = 0.15; } },
          { name:'Rauchbombe', preis:1200, text:'Wirft zusätzlich Rauchbomben, die Fische betäuben.', fx:s => {
            s.angriffe.push(angriff({ id:'rauch', intervall:2.4, schaden:1, typ:'normal', tempo:450, flug:260, groesse:7, bild:'rauch', splash:45, splashDurchschlag:30, betaeuben:1 })); } },
          { name:'Sabotage', preis:3200, text:'Fähigkeit: Alle Fische 15 s nur halb so schnell.', fx:s => { F(s, { id:'sabotage', cd:60, dauer:15, faktor:0.5 }); } },
          { name:'Großsaboteur', preis:22000, text:'Sabotage bremst stärker und Riesen kommen nur mit 75 % Leben an.', fx:s => { F(s, { id:'sabotage', cd:50, dauer:15, faktor:0.4, riesen:0.75 }); A(s).schaden += 4; } }
        ],
        [
          { name:'Spitze Sterne', preis:200, text:'+1 Schaden.', fx:s => { A(s).schaden += 1; } },
          { name:'Schnelle Hände', preis:350, text:'Wirft 20 % schneller.', fx:s => { A(s).intervall *= 0.8; } },
          { name:'Blitzbombe', preis:1300, text:'Wirft zusätzlich Blitzbomben: Explosion, die betäubt.', fx:s => {
            s.angriffe.push(angriff({ id:'blitzbombe', intervall:1.8, schaden:2, typ:'normal', tempo:500, flug:300, groesse:7, bild:'blitzbombe', splash:40, splashDurchschlag:25, betaeuben:0.8 })); } },
          { name:'Haftbombe', preis:2700, text:'Klebt eine Bombe an Riesen: 500 Schaden.', fx:s => {
            s.angriffe.push(angriff({ id:'haft', art:'sofort', intervall:3, schaden:0, riesen:500, typ:'normal', nurRiesen:true, bild:'haft' })); } },
          { name:'Meister-Bomber', preis:40000, text:'Haftbomben mit 3500 Schaden, viel öfter.', fx:s => { const b = A(s, 'haft'); if (b) { b.riesen = 3500; b.intervall = 1.6; } const c = A(s, 'blitzbombe'); if (c) { c.schaden += 6; c.riesen += 20; } } }
        ]
      ]
    },


    laser: {
      name:'Laser-Pingu', preis:2500, gruppe:'Magie', taste:'l', kurz:'Ein Super-Pinguin mit Laserblick. Teuer, aber schießt ohne Pause.',
      basis:() => ({ reichweite:165, camo:false, angriffe:[angriff({ intervall:0.11, schaden:1, durchschlag:1, typ:'normal', tempo:900, flug:300, groesse:4, bild:'laser' })] }),
      pfade:[
        [
          { name:'Laserstrahlen', preis:900, text:'Durchschlag +2.', fx:s => { A(s).durchschlag += 2; } },
          { name:'Plasmasalven', preis:2600, text:'Doppelt so schnell, +1 Schaden.', fx:s => { const a = A(s); a.intervall *= 0.5; a.schaden += 1; a.bild = 'plasma'; } },
          { name:'Polarstrahl', preis:9500, text:'Mächtige Strahlen: +3 Schaden, Durchschlag +6, +6 gegen Riesen.', fx:s => {
            const a = A(s); a.schaden += 3; a.durchschlag += 6; a.riesen += 6; a.groesse = 7; a.bild = 'laserGross'; } },
          { name:'Sonnenstrahl-Pingu', preis:26000, text:'Zwei Strahlen, +6 Schaden, +25 gegen Riesen.', fx:s => {
            const a = A(s); a.anzahl = 2; a.streuung = 0.08; a.schaden += 6; a.riesen += 25; a.durchschlag += 6; } },
          { name:'Nordstern-Pingu', preis:72000, text:'Ein Stern auf zwei Flossen: drei Strahlen, +20 Schaden, +120 gegen Riesen, riesige Reichweite.', fx:s => {
            const a = A(s); a.anzahl = 3; a.schaden += 20; a.riesen += 120; a.durchschlag += 10; s.reichweite += 60; a.flug += 80; a.bild = 'sonnenstrahl'; } }
        ],
        [
          { name:'Roboarm', preis:1500, text:'Ein zweiter Arm schießt nach hinten.', fx:s => {
            s.angriffe.push(angriff({ ...A(s), id:'arm', hinten:true })); } },
          { name:'Turbo-Prozessor', preis:1800, text:'Beide Arme schießen 25 % schneller.', fx:s => { for (const a of s.angriffe) a.intervall *= 0.75; } },
          { name:'Robo-Pingu', preis:7500, text:'+2 Schaden auf beiden Armen, sieht getarnte Fische.', fx:s => { s.camo = true; for (const a of s.angriffe) { a.schaden += 2; a.bild = 'plasma'; } } },
          { name:'Mecha-Pingu', preis:28000, text:'+5 Schaden, +15 gegen Riesen. Fähigkeit Orbital-Laser.', fx:s => {
            for (const a of s.angriffe) { a.schaden += 5; a.riesen += 15; a.durchschlag += 3; }
            F(s, { id:'orbital', cd:45, schaden:3000, anzahl:3 }); } },
          { name:'Giga-Mecha', preis:85000, text:'Vier Arme, +15 Schaden, Orbital-Laser viel stärker.', fx:s => {
            for (const a of s.angriffe) { a.schaden += 15; a.riesen += 40; a.anzahl = Math.max(a.anzahl, 2); a.streuung = 0.1; }
            F(s, { id:'orbital', cd:35, schaden:14000, anzahl:4 }); } }
        ],
        [
          { name:'Fernsicht', preis:500, text:'Reichweite +30.', fx:s => { s.reichweite += 30; A(s).flug += 30; } },
          { name:'Nachtsensor', preis:900, text:'Sieht getarnte Fische.', fx:s => { s.camo = true; } },
          { name:'Kältelaser', preis:5000, text:'+1 Schaden, getroffene Fische werden langsamer.', fx:s => {
            for (const a of s.angriffe) { a.schaden += 1; a.verlangsam = 0.6; a.verlangsamDauer = 1; a.riesenLangsam = 0.85; a.bild = a.bild === 'laser' ? 'laserBlau' : a.bild; } } },
          { name:'Nordlicht-Ritter', preis:16000, text:'+4 Schaden, +10 gegen Riesen, viel mehr Reichweite.', fx:s => {
            for (const a of s.angriffe) { a.schaden += 4; a.riesen += 10; a.flug += 60; } s.reichweite += 50; } },
          { name:'Herr des Nordlichts', preis:60000, text:'+10 Schaden. Fähigkeit Nordlicht-Sturm.', fx:s => {
            for (const a of s.angriffe) { a.schaden += 10; a.riesen += 30; } F(s, { id:'nordlicht', cd:50, schaden:80, riesen:1500, dauer:3 }); } }
        ]
      ]
    },

    /* ===== Unterstützung ===== */
    markt: {
      name:'Fischmarkt', preis:1000, gruppe:'Unterstützung', taste:'u', kurz:'Kämpft nicht, bringt aber jede Runde Geld.', greift:false,
      basis:() => ({ reichweite:0, camo:false, angriffe:[], geld:{ kisten:4, wert:20, flat:0 } }),
      pfade:[
        [
          { name:'Mehr Kisten', preis:500, text:'6 Kisten pro Runde.', fx:s => { s.geld.kisten = 6; } },
          { name:'Großer Stand', preis:700, text:'8 Kisten pro Runde.', fx:s => { s.geld.kisten = 8; } },
          { name:'Fischfabrik', preis:2600, text:'16 Kisten pro Runde.', fx:s => { s.geld.kisten = 16; } },
          { name:'Fisch-Konzern', preis:12000, text:'30 Kisten pro Runde, jede 50 % mehr wert.', fx:s => { s.geld.kisten = 30; s.geld.wert *= 1.5; } },
          { name:'Fisch-Weltkonzern', preis:32000, text:'60 Kisten pro Runde.', fx:s => { s.geld.kisten = 60; } }
        ],
        [
          { name:'Frischer Fisch', preis:300, text:'Kisten 25 statt 20 wert.', fx:s => { s.geld.wert = 25; } },
          { name:'Räucherfisch', preis:800, text:'Kisten 35 wert.', fx:s => { s.geld.wert = 35; } },
          { name:'Kaviar', preis:2800, text:'Kisten doppelt so viel wert.', fx:s => { s.geld.wert *= 2; } },
          { name:'Fisch-Börse', preis:9000, text:'Kisten 250 wert.', fx:s => { s.geld.wert = 250; } },
          { name:'Goldfisch-Börse', preis:26000, text:'Kisten 700 wert.', fx:s => { s.geld.wert = 700; } }
        ],
        [
          { name:'Stammkunden', preis:400, text:'+40 Geld am Ende jeder Runde.', fx:s => { s.geld.flat += 40; } },
          { name:'Großhandel', preis:1200, text:'+120 Geld am Ende jeder Runde.', fx:s => { s.geld.flat += 80; } },
          { name:'Fischauktion', preis:4200, text:'+500 Geld am Ende jeder Runde.', fx:s => { s.geld.flat += 380; } },
          { name:'Pingu-Bank', preis:9500, text:'+1800 Geld am Ende jeder Runde.', fx:s => { s.geld.flat += 1300; } },
          { name:'Pingu-Zentralbank', preis:26000, text:'+6500 Geld am Ende jeder Runde.', fx:s => { s.geld.flat += 4700; } }
        ]
      ]
    },

    haeuptling: {
      name:'Häuptlings-Pingu', preis:1100, gruppe:'Unterstützung', taste:'i', kurz:'Stärkt alle Pinguine in seiner Nähe: mehr Reichweite.', greift:false,
      basis:() => ({ reichweite:115, camo:false, angriffe:[], buff:{ reichweite:0.1, camo:false, tempo:1, schaden:0, durchschlag:0, rabatt:0 } }),
      pfade:[
        [
          { name:'Große Trommel', preis:400, text:'Größerer Wirkungskreis.', fx:s => { s.reichweite += 35; } },
          { name:'Kriegstrommel', preis:1500, text:'Pinguine in der Nähe greifen 15 % schneller an.', fx:s => { s.buff.tempo = 0.85; } },
          { name:'Jubelchor', preis:3200, text:'Pinguine in der Nähe: +1 Durchschlag.', fx:s => { s.buff.durchschlag += 1; } },
          { name:'Pingu-König', preis:8000, text:'+1 Schaden, +2 Durchschlag, noch schneller. Fähigkeit Schlachtruf.', fx:s => {
            s.buff.schaden += 1; s.buff.durchschlag += 1; s.buff.tempo = 0.75; s.reichweite += 20; F(s, { id:'schlachtruf', cd:45, dauer:10, faktor:2 }); } },
          { name:'Ewiger Herrscher', preis:26000, text:'Pinguine in der Nähe: +2 Schaden, +3 Durchschlag, viel schneller.', fx:s => {
            s.buff.schaden += 1; s.buff.durchschlag += 1; s.buff.tempo = 0.62; s.reichweite += 30; F(s, { id:'schlachtruf', cd:35, dauer:12, faktor:2 }); } }
        ],
        [
          { name:'Späher', preis:350, text:'Pinguine in der Nähe: noch mehr Reichweite.', fx:s => { s.buff.reichweite = 0.18; } },
          { name:'Radar', preis:1400, text:'Alle Pinguine in der Nähe sehen getarnte Fische.', fx:s => { s.buff.camo = true; } },
          { name:'Leuchtfeuer', preis:2500, text:'Enttarnt Fische in seiner Nähe dauerhaft.', fx:s => { s.enttarnen = true; } },
          { name:'Nordstern', preis:6000, text:'Enttarnt Fische auf der ganzen Karte und stoppt das Nachwachsen.', fx:s => { s.enttarnen = true; s.enttarnenUeberall = true; s.entwachsen = true; } },
          { name:'Polarstern', preis:15000, text:'Nimmt allen Fischen die Panzerung, Pinguine in der Nähe: +30 % Reichweite.', fx:s => { s.entpanzern = true; s.buff.reichweite = 0.3; s.buff.schaden += 1; } }
        ],
        [
          { name:'Fischsuppe', preis:300, text:'Pinguine und Upgrades in der Nähe 10 % günstiger.', fx:s => { s.buff.rabatt = 0.1; } },
          { name:'Handelsposten', preis:800, text:'15 % günstiger in der Nähe.', fx:s => { s.buff.rabatt = 0.15; } },
          { name:'Stammesgold', preis:2600, text:'+300 Geld am Ende jeder Runde.', fx:s => { s.geld = { kisten:0, wert:0, flat:300 }; } },
          { name:'Goldenes Iglu', preis:6500, text:'20 % Rabatt in der Nähe und +900 Geld pro Runde.', fx:s => { s.buff.rabatt = 0.2; s.geld.flat = 900; } },
          { name:'Goldener Palast', preis:22000, text:'30 % Rabatt in der Nähe und +3000 Geld pro Runde.', fx:s => { s.buff.rabatt = 0.3; s.geld.flat = 3000; } }
        ]
      ]
    },

    disco: {
      name:'Disco-Pingu', preis:650, gruppe:'Unterstützung', taste:'d', kurz:'Seine Musik bremst die Fische, und Pinguine in der Nähe feiern mit.', greift:false,
      basis:() => ({ reichweite:110, camo:false, angriffe:[angriff({ art:'ring', intervall:1.6, schaden:0, durchschlag:25, typ:'normal', bild:'schall', verlangsam:0.7, verlangsamDauer:1.2 })] }),
      pfade:[
        [
          { name:'Bassbox', preis:350, text:'Die Schallwellen lassen Fische platzen (1 Schaden).', fx:s => { A(s).schaden = 1; } },
          { name:'Subwoofer', preis:750, text:'+1 Schaden, Durchschlag +20.', fx:s => { const a = A(s); a.schaden += 1; a.durchschlag += 20; } },
          { name:'Schallkanone', preis:2400, text:'Doppelt so oft, betäubt auch Riesen kurz, +3 gegen Riesen.', fx:s => { const a = A(s); a.intervall *= 0.5; a.riesenBetaeuben = 0.35; a.riesen += 3; } },
          { name:'Mega-Bass', preis:7500, text:'+3 Schaden, betäubt kleine Fische, Durchschlag +40.', fx:s => { const a = A(s); a.schaden += 3; a.betaeuben = 0.3; a.durchschlag += 40; a.bild = 'schallGross'; } },
          { name:'Disco-Inferno', preis:30000, text:'+10 Schaden, +30 gegen Riesen. Fähigkeit Tanzfieber.', fx:s => {
            const a = A(s); a.schaden += 10; a.riesen += 30; a.durchschlag += 60; s.reichweite += 30; F(s, { id:'tanz', cd:50, dauer:4 }); } }
        ],
        [
          { name:'Discokugel', preis:500, text:'Pinguine in der Nähe greifen 10 % schneller an.', fx:s => { s.buff = { reichweite:0, camo:false, tempo:0.9, schaden:0, durchschlag:0, rabatt:0 }; } },
          { name:'Lichtorgel', preis:900, text:'Pinguine in der Nähe: +10 % Reichweite, größerer Wirkungskreis.', fx:s => { s.buff.reichweite = 0.1; s.reichweite += 25; } },
          { name:'Partystimmung', preis:2600, text:'Pinguine in der Nähe: 20 % schneller und sie sehen getarnte Fische.', fx:s => { s.buff.tempo = 0.8; s.buff.camo = true; } },
          { name:'Superstar', preis:6000, text:'Pinguine in der Nähe: +1 Schaden. Fähigkeit Party-Zeit.', fx:s => { s.buff.schaden += 1; F(s, { id:'party', cd:45, dauer:10, faktor:2 }); } },
          { name:'Weltstar', preis:24000, text:'Pinguine in der Nähe: 35 % schneller, +2 Schaden, +2 Durchschlag.', fx:s => {
            s.buff.tempo = 0.65; s.buff.schaden += 1; s.buff.durchschlag += 2; s.reichweite += 30; F(s, { id:'party', cd:35, dauer:12, faktor:2 }); } }
        ],
        [
          { name:'Eintritt', preis:600, text:'+60 Geld am Ende jeder Runde.', fx:s => { s.geld = { kisten:0, wert:0, flat:60 }; } },
          { name:'Fanshop', preis:1300, text:'+180 Geld am Ende jeder Runde.', fx:s => { s.geld.flat = 180; } },
          { name:'Konzert', preis:3200, text:'Zusätzlich 3 Kisten pro Runde mit je 150 Geld.', fx:s => { s.geld.kisten = 3; s.geld.wert = 150; } },
          { name:'Tournee', preis:8500, text:'+700 Geld pro Runde, Kisten 300 wert.', fx:s => { s.geld.flat = 700; s.geld.wert = 300; } },
          { name:'Welttournee', preis:38000, text:'8 Kisten zu 500 und +2000 pro Runde. Fähigkeit Geldregen.', fx:s => {
            s.geld.kisten = 8; s.geld.wert = 500; s.geld.flat = 2000; F(s, { id:'geldregen', cd:60, betrag:3000 }); } }
        ]
      ]
    },

    fabrik: {
      name:'Eisstachel-Fabrik', preis:1000, gruppe:'Unterstützung', taste:'a', kurz:'Legt Eisstachel-Haufen in den Kanal. Fängt durchgerutschte Fische ab.',
      ziele:[['smart', 'Klug'], ['nah', 'Nah'], ['anfang', 'Anfang'], ['ende', 'Ende']],
      basis:() => ({ reichweite:105, camo:false, angriffe:[angriff({ art:'stacheln', intervall:1.75, schaden:1, typ:'spitz', bild:'stacheln',
        haufen:{ durchschlag:5, leben:40, radius:12, bleibt:false } })] }),
      pfade:[
        [
          { name:'Größere Haufen', preis:800, text:'Jeder Haufen hält 5 Fische mehr aus.', fx:s => { A(s).haufen.durchschlag += 5; } },
          { name:'Schwere Stacheln', preis:600, text:'+1 Schaden, trifft auch Panzerwelse.', fx:s => { const a = A(s); a.schaden += 1; a.typ = 'normal'; } },
          { name:'Stachelminen', preis:2300, text:'Verbrauchte Haufen explodieren.', fx:s => { A(s).mine = { schaden:3, splash:50, durchschlag:30, riesen:0 }; } },
          { name:'Gletscherminen', preis:9000, text:'Minen mit 20 Schaden, +30 gegen Riesen.', fx:s => { const a = A(s); a.mine = { schaden:20, splash:60, durchschlag:50, riesen:30 }; a.riesen += 3; } },
          { name:'Super-Minen', preis:30000, text:'Minen mit 150 Schaden und riesiger Explosion.', fx:s => { const a = A(s); a.mine = { schaden:150, splash:100, durchschlag:100, riesen:300 }; a.riesen += 10; } }
        ],
        [
          { name:'Schnellere Produktion', preis:600, text:'20 % mehr Haufen.', fx:s => { A(s).intervall *= 0.8; } },
          { name:'Fließband', preis:800, text:'Noch 33 % mehr Haufen.', fx:s => { A(s).intervall *= 0.66; } },
          { name:'Stachelschleuder', preis:2500, text:'Zwei Haufen auf einmal.', fx:s => { A(s).anzahl = 2; } },
          { name:'Stachelsturm', preis:5000, text:'Fähigkeit: Stachelhaufen überall im Kanal.', fx:s => { F(s, { id:'stachelsturm', cd:40, anzahl:40 }); } },
          { name:'Stachel-Inferno', preis:30000, text:'Vier Haufen auf einmal, doppelt so schnell, +10 Durchschlag.', fx:s => { const a = A(s); a.anzahl = 4; a.intervall *= 0.5; a.haufen.durchschlag += 10; a.schaden += 3; } }
        ],
        [
          { name:'Langlebig', preis:150, text:'Haufen bleiben über das Rundenende liegen.', fx:s => { const h = A(s).haufen; h.bleibt = true; h.leben = 90; } },
          { name:'Weitwurf', preis:400, text:'Reichweite +40.', fx:s => { s.reichweite += 40; } },
          { name:'Dornenteppich', preis:1400, text:'Haufen +10 Durchschlag und breiter.', fx:s => { const h = A(s).haufen; h.durchschlag += 10; h.radius += 6; } },
          { name:'Eisbarrikade', preis:7000, text:'Haufen +30 Durchschlag, +3 Schaden, +5 gegen Riesen.', fx:s => { const a = A(s); a.haufen.durchschlag += 30; a.schaden += 3; a.riesen += 5; } },
          { name:'Eiserne Festung', preis:25000, text:'Haufen +80 Durchschlag, +10 Schaden, +40 gegen Riesen.', fx:s => { const a = A(s); a.haufen.durchschlag += 80; a.schaden += 10; a.riesen += 40; a.haufen.leben = 140; } }
        ]
      ]
    }
  };
  for (const id of Object.keys(PINGUINE)) PINGUINE[id].id = id;
  PT.PINGUINE = PINGUINE;
  PT.PINGUIN_REIHE = ['zapfen', 'rundum', 'schneeball', 'frost', 'harpune', 'boot', 'flieger', 'moerser', 'polar', 'ninja', 'laser', 'markt', 'haeuptling', 'disco', 'fabrik'];
  PT.GRUPPEN = ['Primär', 'Militär', 'Magie', 'Unterstützung'];

  /* ---------- Helden ----------
     Ein Held pro Spiel (im Koop einer pro Spieler). Er steigt am Ende jeder Runde auf (Stufe 1–10) und bekommt dabei
     neue Kräfte und auf Stufe 3 und 7 je eine Fähigkeit. Die Meisterkraft (im Pingu-Pass freigeschaltet)
     bringt ab Stufe 5 eine dritte Fähigkeit. */
  const HELDEN = {
    kiel: {
      name:'Kapitän Kiel', preis:550, held:true, taste:'h', farbe:'#2d5a8a',
      kurz:'Alter Seebär mit Harpune und Fischernetz. Ein guter Allrounder.',
      kraft:{ id:'anker', text:'Ab Stufe 5: Ankerwurf trifft die drei stärksten Riesen und hält sie fest.' },
      stufen:['Wirft Harpunen.', 'Durchschlag +1.', 'Fähigkeit Fischernetz.', 'Sieht getarnte Fische, Reichweite +15.', 'Drei Harpunen auf einmal.',
        '+1 Schaden, +2 gegen Riesen.', 'Fähigkeit Torpedo-Salve.', 'Wirft 25 % schneller.', 'Größeres Netz, öfter.', '+2 Schaden, stärkere Torpedos.'],
      basis(L, kraft) {
        const a = angriff({ intervall:0.9, schaden:1, durchschlag:3, tempo:640, flug:300, bild:'harpuneKlein' });
        const s = { reichweite:135, camo:false, angriffe:[a] };
        if (L >= 2) a.durchschlag += 1;
        if (L >= 3) F(s, { id:'netz', cd:50, radius:170, dauer:3 });
        if (L >= 4) { s.camo = true; s.reichweite += 15; }
        if (L >= 5) { a.anzahl = 3; a.streuung = 0.15; }
        if (L >= 6) { a.schaden += 1; a.riesen += 2; }
        if (L >= 7) F(s, { id:'torpedos', cd:60, schaden:200, anzahl:12 });
        if (L >= 8) a.intervall *= 0.75;
        if (L >= 9) F(s, { id:'netz', cd:40, radius:260, dauer:3.5 });
        if (L >= 10) { a.schaden += 2; F(s, { id:'torpedos', cd:50, schaden:450, anzahl:12 }); }
        if (kraft && L >= 5) F(s, { id:'anker', cd:L >= 9 ? 45 : 55, schaden:L >= 9 ? 900 : 350, anzahl:3, betaeuben:2 });
        return s;
      }
    },
    aurora: {
      name:'Prinzessin Aurora', preis:700, held:true, taste:'h', farbe:'#6b4fd1',
      kurz:'Beherrscht das Polarlicht. Ihre Blitze springen von Fisch zu Fisch.',
      kraft:{ id:'sternschnuppe', text:'Ab Stufe 5: Sternschnuppen treffen jeden Fisch und enttarnen alle.' },
      stufen:['Polarlicht-Blitze, die überspringen.', 'Reichweite +10.', 'Fähigkeit Polarlichtschleier.', 'Sieht getarnte Fische.', 'Pinguine in der Nähe: +10 % Reichweite.',
        'Blitze springen weiter, +1 Schaden.', 'Fähigkeit Himmelsfeuer.', 'Zaubert 30 % schneller.', 'Noch mehr Sprünge, +1 Schaden.', 'Himmelsfeuer viel stärker.'],
      basis(L, kraft) {
        const a = angriff({ art:'blitz', intervall:1.0, schaden:1, kette:3, typ:'normal', bild:'blitzAurora' });
        const s = { reichweite:145, camo:false, angriffe:[a] };
        if (L >= 2) s.reichweite += 10;
        if (L >= 3) F(s, { id:'schleier', cd:45, dauer:10, faktor:2, radius:220 });
        if (L >= 4) s.camo = true;
        if (L >= 5) s.buff = { reichweite:0.1, camo:false, tempo:1, schaden:0, durchschlag:0, rabatt:0 };
        if (L >= 6) { a.kette = 6; a.schaden += 1; }
        if (L >= 7) F(s, { id:'himmelsfeuer', cd:60, schaden:30, riesen:200 });
        if (L >= 8) a.intervall *= 0.7;
        if (L >= 9) { a.kette = 10; a.schaden += 1; a.riesen += 3; }
        if (L >= 10) F(s, { id:'himmelsfeuer', cd:50, schaden:120, riesen:1200 });
        if (kraft && L >= 5) F(s, { id:'sternschnuppe', cd:L >= 9 ? 40 : 50, schaden:L >= 9 ? 12 : 4, riesen:L >= 9 ? 250 : 80 });
        return s;
      }
    },
    frosti: {
      name:'Professor Frosti', preis:600, held:true, taste:'h', farbe:'#2aa3d6',
      kurz:'Erfinder mit Eisstrahler. Bremst Fische und verdient nebenbei Geld.',
      kraft:{ id:'eiszeit', text:'Ab Stufe 5: Eiszeit bremst alle Fische und macht Pinguine in der Nähe schneller.' },
      stufen:['Eisstrahler, der Fische bremst.', 'Durchschlag +1.', 'Fähigkeit Eisfalle.', 'Sieht getarnte Fische.', '+100 Geld pro Runde.',
        '+1 Schaden, bremst stärker.', 'Fähigkeit Kälteschock.', 'Schießt 40 % schneller.', '+300 Geld pro Runde, stärkere Eisfalle.', '+3 Schaden, längerer Kälteschock.'],
      basis(L, kraft) {
        const a = angriff({ intervall:0.7, schaden:1, durchschlag:2, typ:'normal', tempo:620, flug:280, groesse:5, bild:'eisstrahl', verlangsam:0.7, verlangsamDauer:1 });
        const s = { reichweite:125, camo:false, angriffe:[a] };
        if (L >= 2) a.durchschlag += 1;
        if (L >= 3) F(s, { id:'eisfalle', cd:40, durchschlag:150, schaden:2 });
        if (L >= 4) s.camo = true;
        if (L >= 5) s.geld = { kisten:0, wert:0, flat:100 };
        if (L >= 6) { a.schaden += 1; a.verlangsam = 0.5; }
        if (L >= 7) F(s, { id:'kaelteschock', cd:60, dauer:3, schaden:0 });
        if (L >= 8) a.intervall *= 0.6;
        if (L >= 9) { s.geld.flat = 300; F(s, { id:'eisfalle', cd:35, durchschlag:400, schaden:5 }); }
        if (L >= 10) { a.schaden += 3; a.riesen += 5; F(s, { id:'kaelteschock', cd:50, dauer:5, schaden:50 }); }
        if (kraft && L >= 5) F(s, { id:'eiszeit', cd:L >= 9 ? 50 : 60, dauer:L >= 9 ? 10 : 7, faktor:1.4, radius:240 });
        return s;
      }
    }
  };
  for (const id of Object.keys(HELDEN)) HELDEN[id].id = id;
  PT.HELDEN = HELDEN;
  PT.HELDEN_REIHE = ['kiel', 'aurora', 'frosti'];
  PT.def = typ => PINGUINE[typ] || HELDEN[typ];

  // Werte eines Pinguins mit seinen Upgrades (pfade = [Stufe Pfad 1, 2, 3]) bzw. eines Helden auf Stufe L
  PT.werteFuer = function (typ, pfade, stufe = 1, kraft = false) {
    if (HELDEN[typ]) { const s = HELDEN[typ].basis(stufe, kraft); s.faehigkeiten = s.faehigkeiten || []; return s; }
    const p = PINGUINE[typ];
    const s = p.basis();
    s.faehigkeiten = [];
    // Stufe für Stufe über alle Pfade, damit spätere Upgrades auf frühere aufbauen
    for (let st = 0; st < 5; st++) {
      for (let i = 0; i < 3; i++) if (pfade[i] > st) p.pfade[i][st].fx(s);
    }
    return s;
  };
  // Upgrade-Regel: höchstens zwei Pfade, nur einer davon über Stufe 2
  PT.upgradeErlaubt = function (pfade, i) {
    if (pfade[i] >= 5) return false;
    const neu = pfade.slice(); neu[i]++;
    const benutzt = neu.filter(x => x > 0).length;
    const hoch = neu.filter(x => x > 2).length;
    return benutzt <= 2 && hoch <= 1;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
