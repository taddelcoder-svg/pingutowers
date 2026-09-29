'use strict';
// Pingu Towers – Spieldaten: Fische, Pinguine mit ihren Upgrades, Karten, Schwierigkeit und Runden.
// Läuft im Browser (window.PT) und in Node (für den Balance-Test in test/sim.js).
(function (wurzel) {
  const PT = wurzel.PT || (wurzel.PT = {});

  PT.BREITE = 1000;
  PT.HOEHE = 640;

  /* ---------- Fische ----------
     hp: Treffer, bis der Fisch platzt. kinder: was danach weiterschwimmt.
     immun: gegen welche Schadensart (spitz, explosion, kaelte, normal).
     riese: kann nicht eingefroren werden, bekommt Zusatzschaden von Riesen-Upgrades. */
  const FISCHE = {
    rot:     { name:'Rotbarsch',          hp:1,   tempo:70,  r:10, farbe:'#e8453c', kinder:[] },
    blau:    { name:'Blaubarsch',         hp:1,   tempo:98,  r:11, farbe:'#2f7fe0', kinder:['rot'] },
    gruen:   { name:'Grünling',           hp:1,   tempo:126, r:11, farbe:'#35b04a', kinder:['blau'] },
    gelb:    { name:'Goldfisch',          hp:1,   tempo:224, r:11, farbe:'#f5b623', kinder:['gruen'] },
    rosa:    { name:'Lachs',              hp:1,   tempo:245, r:12, farbe:'#ff7fa8', kinder:['gelb'] },
    schwarz: { name:'Anglerfisch',        hp:1,   tempo:126, r:10, farbe:'#23262e', kinder:['rosa', 'rosa'], immun:['explosion'] },
    weiss:   { name:'Eisfisch',           hp:1,   tempo:140, r:10, farbe:'#eef6fb', kinder:['rosa', 'rosa'], immun:['kaelte'] },
    panzer:  { name:'Panzerwels',         hp:1,   tempo:70,  r:13, farbe:'#8a929c', kinder:['schwarz', 'schwarz'], immun:['spitz'] },
    zebra:   { name:'Zebrafisch',         hp:1,   tempo:126, r:12, farbe:'#f4f4f4', kinder:['schwarz', 'weiss'], immun:['explosion', 'kaelte'] },
    regen:   { name:'Regenbogenforelle',  hp:1,   tempo:154, r:13, farbe:'#b36bff', kinder:['zebra', 'zebra'] },
    koffer:  { name:'Kofferfisch',        hp:10,  tempo:175, r:15, farbe:'#b8773a', kinder:['regen', 'regen'] },
    wal:     { name:'Walhai',             hp:200, tempo:45,  r:34, farbe:'#3b5f8a', kinder:['koffer', 'koffer', 'koffer', 'koffer'], riese:true },
    mega:    { name:'Megalodon',          hp:700, tempo:22,  r:48, farbe:'#56606e', kinder:['wal', 'wal', 'wal', 'wal'], riese:true }
  };
  // Wie viele "Schichten" ein Fisch insgesamt hat (so viele Leben kostet er, wenn er durchkommt)
  for (const id of Object.keys(FISCHE)) FISCHE[id].id = id;
  function rbe(id) {
    const f = FISCHE[id];
    if (f.rbe == null) f.rbe = f.hp + f.kinder.reduce((s, k) => s + rbe(k), 0);
    return f.rbe;
  }
  Object.keys(FISCHE).forEach(rbe);
  PT.FISCHE = FISCHE;

  /* ---------- Pinguine ----------
     Jeder Pinguin hat Grundwerte und drei Upgrade-Pfade mit je 4 Stufen.
     Regel wie im Vorbild: höchstens zwei Pfade, und nur einer davon über Stufe 2.

     Angriffsarten:
       wurf    – Geschoss auf ein Ziel (mehrere mit anzahl/streuung), splash = explodiert
       rundum  – Geschosse in alle Richtungen
       ring    – trifft alles in Reichweite auf einmal
       frost   – wie ring, friert dabei ein
       sofort  – trifft sofort, egal wie weit (Harpune)
       blitz   – springt von Fisch zu Fisch */
  function angriff(werte) {
    return Object.assign({
      art:'wurf', intervall:1, schaden:1, durchschlag:1, typ:'spitz', tempo:500, flug:300, groesse:5,
      bild:'zapfen', anzahl:1, streuung:0, splash:0, splashDurchschlag:0, riesen:0, frost:0,
      verlangsam:0, verlangsamDauer:0, betaeuben:0, riesenBetaeuben:0, zielsuchend:false, kette:0,
      kettenWeite:80, reichweite:0, splitter:0
    }, werte);
  }
  PT.angriff = angriff;

  const PINGUINE = {
    zapfen: {
      name:'Zapfen-Pingu', preis:200, farbe:'#e2463b', kurz:'Wirft spitze Eiszapfen. Günstig und vielseitig.',
      basis:() => ({ reichweite:125, camo:false, angriffe:[angriff({ intervall:0.95, schaden:1, durchschlag:2, tempo:560, flug:330, bild:'zapfen' })] }),
      pfade:[
        [
          { name:'Spitzere Zapfen', preis:140, text:'Durchschlag +1', fx:s => { s.angriffe[0].durchschlag += 1; } },
          { name:'Eisspeere', preis:220, text:'Durchschlag +2', fx:s => { s.angriffe[0].durchschlag += 2; } },
          { name:'Eiskugel-Schleuder', preis:550, text:'Rollt eine riesige Eiskugel, die 18 Fische zerquetscht – auch Panzerwelse.', fx:s => {
            const a = s.angriffe[0]; Object.assign(a, { durchschlag:18 + (a.durchschlag - 5), typ:'normal', tempo:300, flug:520, groesse:13, bild:'kugel', intervall:a.intervall * 1.2 }); } },
          { name:'Lawinen-Pingu', preis:1900, text:'Riesige Lawinenkugeln: 3 Schaden, 50 Durchschlag.', fx:s => {
            const a = s.angriffe[0]; Object.assign(a, { durchschlag:a.durchschlag + 32, schaden:3, groesse:20, bild:'lawine', flug:650, riesen:4 }); } }
        ],
        [
          { name:'Schnelle Flossen', preis:100, text:'Wirft 15 % schneller.', fx:s => { s.angriffe[0].intervall *= 0.85; } },
          { name:'Turbo-Flossen', preis:190, text:'Wirft noch 33 % schneller.', fx:s => { s.angriffe[0].intervall *= 0.75; } },
          { name:'Dreifachwurf', preis:400, text:'Wirft drei Zapfen auf einmal.', fx:s => { const a = s.angriffe[0]; a.anzahl = 3; a.streuung = 0.22; } },
          { name:'Zapfen-Gewitter', preis:4200, text:'Wirft dreimal so schnell, +1 Schaden und +2 Durchschlag.', fx:s => {
            const a = s.angriffe[0]; a.intervall *= 0.33; a.schaden += 1; a.durchschlag += 2; a.bild = 'zapfenGold'; } }
        ],
        [
          { name:'Fernglas', preis:90, text:'Reichweite +25.', fx:s => { s.reichweite += 25; } },
          { name:'Nachtsicht-Brille', preis:200, text:'Sieht getarnte Fische, Reichweite +20.', fx:s => { s.reichweite += 20; s.camo = true; } },
          { name:'Kristallzapfen', preis:650, text:'+2 Schaden, fliegen schneller und weiter.', fx:s => { const a = s.angriffe[0]; a.schaden += 2; a.tempo *= 1.3; a.flug *= 1.4; } },
          { name:'Eisauge', preis:2400, text:'Zielsuchende Zapfen, +3 Schaden, +3 Durchschlag, riesige Reichweite.', fx:s => {
            const a = s.angriffe[0]; a.schaden += 3; a.durchschlag += 3; a.zielsuchend = true; a.flug *= 1.5; s.reichweite += 90; a.bild = 'zapfenBlau'; } }
        ]
      ]
    },

    rundum: {
      name:'Stachel-Pingu', preis:280, farbe:'#8e5bd6', kurz:'Schießt Eissplitter in alle Richtungen. Stark an Kurven.',
      basis:() => ({ reichweite:80, camo:false, angriffe:[angriff({ art:'rundum', intervall:1.3, schaden:1, durchschlag:1, anzahl:8, tempo:420, flug:88, groesse:4, bild:'splitter' })] }),
      pfade:[
        [
          { name:'Schnelleres Drehen', preis:150, text:'Schießt 20 % schneller.', fx:s => { s.angriffe[0].intervall *= 0.8; } },
          { name:'Wirbelwind', preis:300, text:'Schießt noch 33 % schneller.', fx:s => { s.angriffe[0].intervall *= 0.75; } },
          { name:'Splitter-Regen', preis:650, text:'16 Splitter pro Salve.', fx:s => { s.angriffe[0].anzahl = 16; } },
          { name:'Eis-Mahlstrom', preis:3600, text:'Ein Dauerfeuer aus Splittern, +1 Schaden.', fx:s => { const a = s.angriffe[0]; a.intervall *= 0.3; a.schaden += 1; a.bild = 'splitterGold'; } }
        ],
        [
          { name:'Längere Splitter', preis:110, text:'Reichweite +12, Durchschlag +1.', fx:s => { s.reichweite += 12; s.angriffe[0].flug += 12; s.angriffe[0].durchschlag += 1; } },
          { name:'Weitschuss', preis:230, text:'Reichweite +15.', fx:s => { s.reichweite += 15; s.angriffe[0].flug += 15; } },
          { name:'Eisring', preis:750, text:'Statt Splittern trifft ein Ring alle Fische in Reichweite – auch Panzerwelse.', fx:s => {
            const a = s.angriffe[0]; Object.assign(a, { art:'ring', typ:'normal', intervall:0.55, durchschlag:40, bild:'ring' }); } },
          { name:'Polar-Inferno', preis:3200, text:'Ring mit 3 Schaden, schneller und größer, +5 gegen Riesen.', fx:s => {
            const a = s.angriffe[0]; a.schaden = 3; a.intervall *= 0.65; a.riesen += 5; s.reichweite += 20; a.durchschlag = 80; a.bild = 'ringLila'; } }
        ],
        [
          { name:'Scharfe Splitter', preis:150, text:'Durchschlag +1.', fx:s => { s.angriffe[0].durchschlag += 1; } },
          { name:'Rasiersplitter', preis:420, text:'+1 Schaden, Durchschlag +1.', fx:s => { s.angriffe[0].schaden += 1; s.angriffe[0].durchschlag += 1; } },
          { name:'Stachelsturm', preis:1000, text:'10 Splitter mit Durchschlag +3.', fx:s => { const a = s.angriffe[0]; if (a.art === 'rundum') a.anzahl = Math.max(a.anzahl, 10); a.durchschlag += 3; } },
          { name:'Klingen-Wirbel', preis:2800, text:'Doppelt so schnell, +2 Schaden, sieht getarnte Fische.', fx:s => { const a = s.angriffe[0]; a.intervall *= 0.5; a.schaden += 2; s.camo = true; a.bild = 'klinge'; } }
        ]
      ]
    },

    schneeball: {
      name:'Schneeball-Pingu', preis:525, farbe:'#5aa9e6', kurz:'Wirft explodierende Schneebälle. Nichts gegen Anglerfische!',
      basis:() => ({ reichweite:140, camo:false, angriffe:[angriff({ intervall:1.5, schaden:1, typ:'explosion', tempo:400, flug:300, groesse:8, bild:'schneeball', splash:38, splashDurchschlag:14 })] }),
      pfade:[
        [
          { name:'Größere Schneebälle', preis:250, text:'Größere Explosion, trifft mehr Fische.', fx:s => { const a = s.angriffe[0]; a.splash += 14; a.splashDurchschlag += 10; } },
          { name:'Riesenschneeball', preis:650, text:'Noch größere Explosion, 40 Fische.', fx:s => { const a = s.angriffe[0]; a.splash += 16; a.splashDurchschlag = 40; a.groesse = 11; } },
          { name:'Streu-Schneeball', preis:1500, text:'Zerfällt in 8 kleine Schneebälle, die noch einmal explodieren.', fx:s => { s.angriffe[0].splitter = 8; } },
          { name:'Lawinen-Kanone', preis:5000, text:'+3 Schaden, riesige Explosion, +6 gegen Riesen.', fx:s => { const a = s.angriffe[0]; a.schaden += 3; a.splash += 25; a.splashDurchschlag = 70; a.riesen += 6; a.bild = 'schneeballGross'; } }
        ],
        [
          { name:'Schneller Wurf', preis:250, text:'Wirft 25 % schneller.', fx:s => { s.angriffe[0].intervall *= 0.75; } },
          { name:'Schneeball-Salve', preis:650, text:'Wirft 33 % schneller.', fx:s => { s.angriffe[0].intervall *= 0.66; } },
          { name:'Walhai-Schreck', preis:1100, text:'+15 Schaden gegen Walhaie und Megalodons.', fx:s => { s.angriffe[0].riesen += 15; } },
          { name:'Walhai-Zerstörer', preis:3400, text:'+45 Schaden gegen Riesen, +2 Schaden gegen alles.', fx:s => { const a = s.angriffe[0]; a.riesen += 30; a.schaden += 2; a.bild = 'rakete'; } }
        ],
        [
          { name:'Weitwurf', preis:200, text:'Reichweite +30.', fx:s => { s.reichweite += 30; s.angriffe[0].flug += 30; } },
          { name:'Matschbälle', preis:400, text:'Getroffene Fische schwimmen 2 s lang halb so schnell.', fx:s => { const a = s.angriffe[0]; a.verlangsam = 0.5; a.verlangsamDauer = 2; } },
          { name:'Betäubungsbombe', preis:1100, text:'Betäubt getroffene Fische kurz.', fx:s => { s.angriffe[0].betaeuben = 0.7; } },
          { name:'Schockwelle', preis:3000, text:'Betäubt sogar Riesen, +3 Schaden, größere Explosion.', fx:s => { const a = s.angriffe[0]; a.riesenBetaeuben = 0.5; a.schaden += 3; a.splash += 20; a.splashDurchschlag += 20; a.bild = 'schneeballBlau'; } }
        ]
      ]
    },

    frost: {
      name:'Frost-Pingu', preis:500, farbe:'#7fd6e0', kurz:'Friert alle Fische um sich herum ein. Eisfische lachen darüber.',
      basis:() => ({ reichweite:70, camo:false, angriffe:[angriff({ art:'frost', intervall:2.2, schaden:1, durchschlag:40, typ:'kaelte', frost:1.0, bild:'frost' })] }),
      pfade:[
        [
          { name:'Dauerfrost', preis:200, text:'Friert länger ein.', fx:s => { s.angriffe[0].frost += 0.6; } },
          { name:'Permafrost', preis:350, text:'Aufgetaute Fische bleiben lange langsam.', fx:s => { const a = s.angriffe[0]; a.verlangsam = 0.55; a.verlangsamDauer = 6; } },
          { name:'Eiszapfen-Rüstung', preis:1500, text:'+2 Schaden beim Einfrieren, trifft auch Panzerwelse.', fx:s => { const a = s.angriffe[0]; a.schaden += 2; a.panzerBrecher = true; } },
          { name:'Absoluter Nullpunkt', preis:3200, text:'Friert noch länger ein und bremst sogar Riesen stark.', fx:s => { const a = s.angriffe[0]; a.frost += 0.8; a.riesenLangsam = 0.4; s.reichweite += 25; a.bild = 'frostStark'; } }
        ],
        [
          { name:'Weiter Frost', preis:150, text:'Reichweite +15.', fx:s => { s.reichweite += 15; } },
          { name:'Arktischer Wind', preis:400, text:'Alle Fische in Reichweite sind dauerhaft langsamer.', fx:s => { s.wind = 0.6; s.reichweite += 10; } },
          { name:'Frostsplitter', preis:900, text:'Schießt zusätzlich Eissplitter auf Fische in der Nähe.', fx:s => {
            s.angriffe.push(angriff({ art:'rundum', intervall:0.9, schaden:1, durchschlag:2, anzahl:8, tempo:420, flug:s.reichweite + 10, groesse:4, bild:'splitterBlau' })); } },
          { name:'Eiszeit', preis:4000, text:'Doppelt so oft, +2 Schaden, bremst Riesen.', fx:s => { const a = s.angriffe[0]; a.intervall *= 0.5; a.schaden += 2; a.riesenLangsam = Math.min(a.riesenLangsam || 1, 0.6); s.wind = 0.45; a.bild = 'frostStark'; } }
        ],
        [
          { name:'Schnellfrost', preis:200, text:'Friert 25 % öfter ein.', fx:s => { s.angriffe[0].intervall *= 0.75; } },
          { name:'Kältesinn', preis:350, text:'Friert auch getarnte Fische ein.', fx:s => { s.camo = true; } },
          { name:'Eisstrahl', preis:1200, text:'Schießt zusätzlich gezielte Eisstrahlen, die einzelne Fische einfrieren.', fx:s => {
            s.angriffe.push(angriff({ art:'wurf', intervall:0.8, schaden:2, durchschlag:3, typ:'kaelte', tempo:620, flug:s.reichweite + 70, frost:0.8, groesse:5, bild:'eisstrahl', reichweite:s.reichweite + 60 })); } },
          { name:'Blizzard', preis:3000, text:'Reichweite +45, friert schneller und länger ein.', fx:s => { const a = s.angriffe[0]; s.reichweite += 45; a.intervall *= 0.6; a.frost += 0.5; for (const b of s.angriffe) if (b.reichweite) b.reichweite += 45; a.bild = 'frostStark'; } }
        ]
      ]
    },

    harpune: {
      name:'Harpunen-Pingu', preis:350, farbe:'#2d5a8a', kurz:'Trifft jeden Fisch auf der ganzen Karte sofort.',
      basis:() => ({ reichweite:9999, camo:false, angriffe:[angriff({ art:'sofort', intervall:1.6, schaden:2, durchschlag:1, typ:'spitz', bild:'harpune' })] }),
      pfade:[
        [
          { name:'Große Harpune', preis:350, text:'4 Schaden pro Treffer.', fx:s => { s.angriffe[0].schaden = 4; } },
          { name:'Walfänger-Harpune', preis:1300, text:'7 Schaden, durchbohrt auch Panzerwelse.', fx:s => { const a = s.angriffe[0]; a.schaden = 7; a.typ = 'normal'; } },
          { name:'Tiefsee-Harpune', preis:3000, text:'18 Schaden pro Treffer.', fx:s => { s.angriffe[0].schaden = 18; } },
          { name:'Kapitän Pingu', preis:6500, text:'30 Schaden, +30 gegen Riesen.', fx:s => { const a = s.angriffe[0]; a.schaden = 30; a.riesen += 30; a.bild = 'harpuneGold'; } }
        ],
        [
          { name:'Nachtsicht', preis:300, text:'Trifft getarnte Fische.', fx:s => { s.camo = true; } },
          { name:'Splitterharpune', preis:450, text:'Beim Treffer fliegen Splitter auf Fische dahinter.', fx:s => { const a = s.angriffe[0]; a.splash = 40; a.splashDurchschlag = 5; } },
          { name:'Netzharpune', preis:2000, text:'Betäubt den getroffenen Fisch – bei Riesen kurz.', fx:s => { const a = s.angriffe[0]; a.betaeuben = 1; a.riesenBetaeuben = 0.4; } },
          { name:'Fischkutter', preis:5500, text:'Bringt jede Runde 1000 extra Geld und schießt schneller.', fx:s => { s.geld = { flat:1000, kisten:0, wert:0 }; s.angriffe[0].intervall *= 0.7; } }
        ],
        [
          { name:'Schneller Nachladen', preis:400, text:'Schießt 30 % schneller.', fx:s => { s.angriffe[0].intervall *= 0.7; } },
          { name:'Halbautomatik', preis:1500, text:'Schießt dreimal so schnell.', fx:s => { s.angriffe[0].intervall *= 0.33; } },
          { name:'Vollautomatik', preis:3500, text:'Schießt doppelt so schnell, +2 Schaden.', fx:s => { const a = s.angriffe[0]; a.intervall *= 0.5; a.schaden += 2; } },
          { name:'Harpunen-Hagel', preis:9000, text:'Unglaublich schnelles Dauerfeuer.', fx:s => { const a = s.angriffe[0]; a.intervall *= 0.4; a.schaden += 2; a.bild = 'harpuneGold'; } }
        ]
      ]
    },

    polar: {
      name:'Polarlicht-Pingu', preis:375, farbe:'#6b4fd1', kurz:'Zaubert Polarlicht-Blitze. Trifft alle Fischarten.',
      basis:() => ({ reichweite:130, camo:false, angriffe:[angriff({ intervall:1.1, schaden:1, durchschlag:3, typ:'normal', tempo:460, flug:260, groesse:6, bild:'magie' })] }),
      pfade:[
        [
          { name:'Starke Magie', preis:150, text:'+1 Schaden, Durchschlag +2.', fx:s => { const a = s.angriffe[0]; a.schaden += 1; a.durchschlag += 2; } },
          { name:'Nordlicht-Blitz', preis:650, text:'Ein Blitz, der zwischen 8 Fischen hin- und herspringt.', fx:s => {
            s.angriffe.push(angriff({ art:'blitz', intervall:2.2, schaden:1, kette:8, typ:'normal', bild:'blitz' })); } },
          { name:'Polarsturm', preis:2300, text:'Blitze springen zu 16 Fischen, +1 Schaden, öfter.', fx:s => { const b = s.angriffe[s.angriffe.length - 1]; b.kette = 16; b.schaden += 1; b.intervall *= 0.6; } },
          { name:'Aurora-Beschwörer', preis:5200, text:'Gewaltige Blitze: 30 Sprünge, +2 Schaden, doppelt so oft.', fx:s => { const b = s.angriffe[s.angriffe.length - 1]; b.kette = 30; b.schaden += 2; b.intervall *= 0.5; b.bild = 'blitzGross'; } }
        ],
        [
          { name:'Weite Magie', preis:200, text:'Reichweite +25.', fx:s => { s.reichweite += 25; s.angriffe[0].flug += 25; } },
          { name:'Wissende Augen', preis:300, text:'Sieht getarnte Fische.', fx:s => { s.camo = true; } },
          { name:'Eissäulen', preis:900, text:'Zaubert Eissäulen, die alles in der Nähe treffen.', fx:s => {
            s.angriffe.push(angriff({ art:'ring', intervall:0.4, schaden:1, durchschlag:12, typ:'normal', bild:'saeule', reichweite:s.reichweite * 0.55 })); } },
          { name:'Schnee-Eule', preis:4200, text:'Eine magische Eule fliegt mit und schießt Dauerfeuer.', fx:s => {
            s.angriffe.push(angriff({ intervall:0.12, schaden:2, durchschlag:3, typ:'normal', tempo:620, flug:380, groesse:5, bild:'eule', reichweite:s.reichweite + 120, zielsuchend:true })); s.eule = true; } }
        ],
        [
          { name:'Schnellzauber', preis:150, text:'Zaubert 20 % schneller.', fx:s => { s.angriffe[0].intervall *= 0.8; } },
          { name:'Doppelzauber', preis:700, text:'Zwei Blitze auf einmal.', fx:s => { const a = s.angriffe[0]; a.anzahl = 2; a.streuung = 0.18; } },
          { name:'Zaubersalve', preis:1500, text:'Drei Blitze, 25 % schneller.', fx:s => { const a = s.angriffe[0]; a.anzahl = 3; a.intervall *= 0.75; } },
          { name:'Erzmagier', preis:5000, text:'Vier zielsuchende Blitze mit +3 Schaden.', fx:s => { const a = s.angriffe[0]; a.anzahl = 4; a.schaden += 3; a.zielsuchend = true; a.durchschlag += 3; a.bild = 'magieGross'; } }
        ]
      ]
    },

    markt: {
      name:'Fischmarkt', preis:1000, farbe:'#e6b422', kurz:'Kämpft nicht, bringt aber jede Runde Geld.', greift:false,
      basis:() => ({ reichweite:0, camo:false, angriffe:[], geld:{ kisten:4, wert:20, flat:0 } }),
      pfade:[
        [
          { name:'Mehr Kisten', preis:500, text:'6 Kisten pro Runde.', fx:s => { s.geld.kisten = 6; } },
          { name:'Großer Stand', preis:700, text:'8 Kisten pro Runde.', fx:s => { s.geld.kisten = 8; } },
          { name:'Fischfabrik', preis:2600, text:'16 Kisten pro Runde.', fx:s => { s.geld.kisten = 16; } },
          { name:'Fisch-Konzern', preis:12000, text:'30 Kisten pro Runde, jede 50 % mehr wert.', fx:s => { s.geld.kisten = 30; s.geld.wert *= 1.5; } }
        ],
        [
          { name:'Frischer Fisch', preis:300, text:'Kisten 25 statt 20 wert.', fx:s => { s.geld.wert = 25; } },
          { name:'Räucherfisch', preis:800, text:'Kisten 35 wert.', fx:s => { s.geld.wert = 35; } },
          { name:'Kaviar', preis:2800, text:'Kisten doppelt so viel wert.', fx:s => { s.geld.wert *= 2; } },
          { name:'Fisch-Börse', preis:9000, text:'Kisten 250 wert.', fx:s => { s.geld.wert = 250; } }
        ],
        [
          { name:'Stammkunden', preis:400, text:'+40 Geld am Ende jeder Runde.', fx:s => { s.geld.flat += 40; } },
          { name:'Großhandel', preis:1200, text:'+120 Geld am Ende jeder Runde.', fx:s => { s.geld.flat += 80; } },
          { name:'Fischauktion', preis:4200, text:'+500 Geld am Ende jeder Runde.', fx:s => { s.geld.flat += 380; } },
          { name:'Pingu-Bank', preis:9500, text:'+1800 Geld am Ende jeder Runde.', fx:s => { s.geld.flat += 1300; } }
        ]
      ]
    },

    haeuptling: {
      name:'Häuptlings-Pingu', preis:1100, farbe:'#c0392b', kurz:'Stärkt alle Pinguine in seiner Nähe: mehr Reichweite.', greift:false,
      basis:() => ({ reichweite:115, camo:false, angriffe:[], buff:{ reichweite:0.1, camo:false, tempo:1, schaden:0, durchschlag:0, rabatt:0 } }),
      pfade:[
        [
          { name:'Große Trommel', preis:400, text:'Größerer Wirkungskreis.', fx:s => { s.reichweite += 35; } },
          { name:'Kriegstrommel', preis:1500, text:'Pinguine in der Nähe greifen 15 % schneller an.', fx:s => { s.buff.tempo = 0.85; } },
          { name:'Jubelchor', preis:3200, text:'Pinguine in der Nähe: +1 Durchschlag.', fx:s => { s.buff.durchschlag += 1; } },
          { name:'Pingu-König', preis:8000, text:'Pinguine in der Nähe: +1 Schaden, +2 Durchschlag, noch schneller.', fx:s => { s.buff.schaden += 1; s.buff.durchschlag += 1; s.buff.tempo = 0.75; s.reichweite += 20; } }
        ],
        [
          { name:'Späher', preis:350, text:'Pinguine in der Nähe: noch mehr Reichweite.', fx:s => { s.buff.reichweite = 0.18; } },
          { name:'Radar', preis:1400, text:'Alle Pinguine in der Nähe sehen getarnte Fische.', fx:s => { s.buff.camo = true; } },
          { name:'Leuchtfeuer', preis:2500, text:'Enttarnt Fische in seiner Nähe dauerhaft.', fx:s => { s.enttarnen = true; } },
          { name:'Nordstern', preis:6000, text:'Enttarnt Fische auf der ganzen Karte.', fx:s => { s.enttarnen = true; s.enttarnenUeberall = true; } }
        ],
        [
          { name:'Fischsuppe', preis:300, text:'Pinguine und Upgrades in der Nähe 10 % günstiger.', fx:s => { s.buff.rabatt = 0.1; } },
          { name:'Handelsposten', preis:800, text:'15 % günstiger in der Nähe.', fx:s => { s.buff.rabatt = 0.15; } },
          { name:'Stammesgold', preis:2600, text:'+300 Geld am Ende jeder Runde.', fx:s => { s.geld = { kisten:0, wert:0, flat:300 }; } },
          { name:'Goldenes Iglu', preis:6500, text:'20 % Rabatt in der Nähe und +900 Geld pro Runde.', fx:s => { s.buff.rabatt = 0.2; s.geld.flat = 900; } }
        ]
      ]
    }
  };
  for (const id of Object.keys(PINGUINE)) PINGUINE[id].id = id;
  PT.PINGUINE = PINGUINE;
  PT.PINGUIN_REIHE = ['zapfen', 'rundum', 'schneeball', 'frost', 'harpune', 'polar', 'markt', 'haeuptling'];

  // Werte eines Pinguins mit seinen Upgrades (pfade = [Stufe Pfad 1, 2, 3])
  PT.werteFuer = function (typ, pfade) {
    const p = PINGUINE[typ];
    const s = p.basis();
    // Stufe für Stufe über alle Pfade, damit spätere Upgrades auf frühere aufbauen
    for (let stufe = 0; stufe < 4; stufe++) {
      for (let i = 0; i < 3; i++) if (pfade[i] > stufe) p.pfade[i][stufe].fx(s);
    }
    return s;
  };
  // Upgrade-Regel: höchstens zwei Pfade, nur einer davon über Stufe 2
  PT.upgradeErlaubt = function (pfade, i) {
    if (pfade[i] >= 4) return false;
    const neu = pfade.slice(); neu[i]++;
    const benutzt = neu.filter(x => x > 0).length;
    const hoch = neu.filter(x => x > 2).length;
    return benutzt <= 2 && hoch <= 1;
  };

  /* ---------- Schwierigkeit ---------- */
  PT.STUFEN = {
    leicht: { name:'Leicht', leben:200, preis:0.85, runden:30, geld:650 },
    mittel: { name:'Mittel', leben:150, preis:1.0, runden:40, geld:650 },
    schwer: { name:'Schwer', leben:100, preis:1.08, runden:60, geld:650 }
  };
  PT.preis = (grund, stufe, rabatt = 0) => Math.max(5, Math.round(grund * PT.STUFEN[stufe].preis * (1 - rabatt) / 5) * 5);
  PT.VERKAUF = 0.7;

  /* ---------- Karten ----------
     weg: Eckpunkte des Wasserkanals (werden abgerundet), hindernisse: Kreise, auf die nichts darf. */
  PT.KARTEN = {
    scholle: {
      name:'Eisscholle', stufe:'Anfänger', thema:'tag',
      text:'Ein langer, gewundener Kanal durchs Eis. Viel Platz zum Bauen.',
      weg:[[-40, 110], [230, 110], [230, 300], [95, 300], [95, 530], [410, 530], [410, 210], [610, 210], [610, 490], [830, 490], [830, 120], [1040, 120]],
      hindernisse:[[330, 380, 34], [520, 90, 28], [720, 330, 30], [930, 330, 36], [160, 420, 22], [960, 580, 30]],
      deko:'iglu'
    },
    spalte: {
      name:'Gletscherspalte', stufe:'Mittel', thema:'daemmerung',
      text:'Der Kanal schlängelt sich zwischen Gletschern hindurch – weniger Platz, kürzerer Weg.',
      weg:[[-40, 330], [170, 330], [170, 120], [430, 120], [430, 520], [660, 520], [660, 270], [870, 270], [870, 680]],
      hindernisse:[[300, 300, 40], [300, 470, 30], [560, 330, 34], [770, 120, 40], [770, 420, 28], [80, 520, 34], [960, 470, 26]],
      deko:'gletscher'
    },
    nacht: {
      name:'Polarnacht', stufe:'Profi', thema:'nacht',
      text:'Unter dem Polarlicht ist der Weg kurz. Hier muss jeder Pinguin sitzen.',
      weg:[[-40, 530], [290, 530], [290, 150], [700, 150], [700, 420], [1040, 420]],
      hindernisse:[[150, 330, 40], [500, 330, 46], [500, 560, 28], [860, 250, 36], [860, 560, 30], [120, 90, 26]],
      deko:'nacht'
    }
  };
  PT.KARTEN_REIHE = ['scholle', 'spalte', 'nacht'];
  PT.WEG_BREITE = 40;

  /* ---------- Runden ----------
     "anzahl typ abstand start [c]" – abstand in Sekunden zwischen zwei Fischen, start = Verzögerung, c = getarnt */
  const R = [
    null,
    '20 rot 0.9 0',
    '35 rot 0.7 0',
    '25 rot 0.7 0|5 blau 1 8',
    '35 rot 0.55 0|18 blau 0.9 5',
    '5 rot 0.6 0|27 blau 0.6 2',
    '15 rot 0.5 0|15 blau 0.6 3|4 gruen 1 8',
    '20 rot 0.5 0|25 blau 0.5 3|5 gruen 0.8 10',
    '10 rot 0.5 0|20 blau 0.5 2|14 gruen 0.6 8',
    '30 gruen 0.55 0',
    '100 blau 0.22 0',
    '10 rot 0.4 0|10 blau 0.4 2|12 gruen 0.5 4|2 gelb 1 9',
    '15 blau 0.45 0|10 gruen 0.5 4|5 gelb 0.8 8',
    '50 blau 0.3 0|23 gruen 0.45 6',
    '49 rot 0.2 0|15 blau 0.4 4|10 gruen 0.5 8|9 gelb 0.6 11',
    '20 rot 0.3 0|15 gruen 0.45 3|12 gelb 0.55 8|5 rosa 0.8 13',
    '20 gruen 0.4 0|8 gelb 0.6 5|4 rosa 0.8 9',
    '12 gelb 0.5 0|6 rosa 0.7 4',
    '80 gruen 0.25 0',
    '10 gruen 0.4 0|10 gelb 0.5 3|10 rosa 0.6 7',
    '6 schwarz 1.2 0',
    '14 gelb 0.4 0|20 rosa 0.45 3',
    '16 weiss 0.8 0',
    '7 schwarz 0.9 0|7 weiss 0.9 4',
    '20 blau 0.35 0|4 gruen 1.4 3 c',
    '25 gelb 0.35 0|12 rosa 0.5 6|4 schwarz 1 10',
    '23 rosa 0.4 0|4 zebra 1.2 6',
    '100 rot 0.12 0|60 blau 0.15 3|45 gruen 0.2 6|45 gelb 0.25 9',
    '6 panzer 1.4 0',
    '16 gelb 0.4 0|14 rosa 0.45 4|6 gelb 0.6 9 c',
    '9 panzer 1 0|6 schwarz 0.8 5',
    '8 schwarz 0.7 0|8 weiss 0.7 3|5 zebra 1 7',
    '25 schwarz 0.4 0|20 weiss 0.45 5',
    '20 gelb 0.4 0 c|13 rosa 0.5 6',
    '140 gelb 0.12 0|6 zebra 1 8',
    '35 rosa 0.25 0|25 schwarz 0.35 4|20 weiss 0.4 8|5 regen 1.2 12',
    '80 rosa 0.15 0|6 panzer 1 6',
    '20 schwarz 0.4 0|16 weiss 0.4 3|8 zebra 0.7 8|6 panzer 0.9 11|4 schwarz 1 14 c',
    '40 rosa 0.22 0|12 weiss 0.45 4|7 panzer 0.8 7|7 zebra 0.8 10|2 koffer 2.5 14',
    '10 schwarz 0.4 0|10 weiss 0.4 2|14 zebra 0.6 5|10 regen 0.8 10',
    '4 koffer 1.5 0|1 wal 1 8',
    '30 regen 0.4 0|6 koffer 1 6',
    '10 zebra 0.5 0|12 koffer 0.9 4',
    '2 wal 4 0|10 regen 0.5 2',
    '16 koffer 0.7 0|10 regen 0.4 6 c',
    '3 wal 3 0|20 zebra 0.35 5',
    '25 koffer 0.5 0',
    '12 regen 0.3 0 c|10 koffer 0.7 4|2 wal 4 8',
    '40 regen 0.25 0|4 wal 3 6',
    '30 koffer 0.4 0|10 panzer 0.5 4',
    '6 wal 2.5 0|20 koffer 0.5 6',
    '40 koffer 0.35 0',
    '8 wal 2 0|15 koffer 0.5 5 c',
    '60 regen 0.2 0 c|5 wal 2.5 6',
    '10 wal 1.6 0|30 koffer 0.4 4',
    '1 mega 1 0|20 koffer 0.5 3',
    '50 koffer 0.3 0|6 wal 2 8',
    '14 wal 1.3 0',
    '2 mega 6 0|30 koffer 0.35 4',
    '60 koffer 0.25 0 c|8 wal 1.8 6',
    '3 mega 5 0|10 wal 1.5 4'
  ];
  PT.RUNDEN_FEST = R.length - 1;

  // Gruppen einer Runde; nach Runde 60 geht es endlos mit immer zäheren Riesen weiter
  PT.runde = function (n) {
    let text = R[n], zaeh = 1;
    if (!text) {
      const k = n - PT.RUNDEN_FEST;
      zaeh = 1 + k * 0.06;
      text = `${2 + Math.floor(k / 3)} mega ${Math.max(1.2, 4 - k * 0.05).toFixed(2)} 0|${8 + k} wal ${Math.max(0.6, 1.5 - k * 0.02).toFixed(2)} 3|${30 + 3 * k} koffer 0.25 5${k % 2 ? ' c' : ''}`;
    }
    return {
      zaeh,
      gruppen:text.split('|').map(g => {
        const [anzahl, typ, abstand, start, c] = g.trim().split(/\s+/);
        return { anzahl:+anzahl, typ, abstand:+abstand, start:+start, camo:c === 'c' };
      })
    };
  };
  PT.rundenBonus = n => 100 + n;

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
