'use strict';
// Pinguin Türmchen – Spieldaten: Fische, Karten, Schwierigkeit, Spielmodi und Runden.
// Die Pinguine und Helden stehen in pinguine.js. Läuft im Browser (window.PT) und in Node
// (Server und Balance-Test).
(function (wurzel) {
  const PT = wurzel.PT || (wurzel.PT = {});

  PT.BREITE = 1000;
  PT.HOEHE = 640;

  /* ---------- Fische ----------
     hp: Treffer, bis der Fisch platzt. kinder: was danach weiterschwimmt.
     immun: gegen welche Schadensart (spitz, explosion, kaelte, normal).
     riese: kann nicht eingefroren werden, bekommt Zusatzschaden von Riesen-Upgrades.
     Zusätze pro Fisch: getarnt (camo), nachwachsend (wächst wieder zum Ursprung), gepanzert (doppelt so zäh).
     Besondere Fische: aufblasen (nach einem Treffer kurz unverwundbar), springen (springt immer wieder aus dem Wasser,
     dann treffen ihn nur Flieger), tinte (verspritzt beim Platzen Tinte, Pinguine in der Nähe sehen kurz nichts). */
  const FISCHE = {
    rot:     { name:'Rotbarsch',          hp:1,    tempo:70,  r:10, farbe:'#e8453c', kinder:[] },
    blau:    { name:'Blaubarsch',         hp:1,    tempo:98,  r:11, farbe:'#2f7fe0', kinder:['rot'] },
    gruen:   { name:'Grünling',           hp:1,    tempo:126, r:11, farbe:'#35b04a', kinder:['blau'] },
    gelb:    { name:'Goldfisch',          hp:1,    tempo:224, r:11, farbe:'#f5b623', kinder:['gruen'] },
    rosa:    { name:'Lachs',              hp:1,    tempo:245, r:12, farbe:'#ff7fa8', kinder:['gelb'] },
    flug:    { name:'Fliegender Fisch',   hp:1,    tempo:175, r:11, farbe:'#5ec8ff', kinder:['gelb', 'gelb'], springen:{ alle:2.6, dauer:0.9 } },
    schwarz: { name:'Anglerfisch',        hp:1,    tempo:126, r:10, farbe:'#23262e', kinder:['rosa', 'rosa'], immun:['explosion'] },
    weiss:   { name:'Eisfisch',           hp:1,    tempo:140, r:10, farbe:'#eef6fb', kinder:['rosa', 'rosa'], immun:['kaelte'] },
    panzer:  { name:'Panzerwels',         hp:1,    tempo:70,  r:13, farbe:'#8a929c', kinder:['schwarz', 'schwarz'], immun:['spitz'] },
    tinte:   { name:'Tintenfisch',        hp:3,    tempo:118, r:13, farbe:'#c06bd6', kinder:['schwarz', 'weiss'], tinte:{ radius:85, dauer:2.2 } },
    zebra:   { name:'Zebrafisch',         hp:1,    tempo:126, r:12, farbe:'#f4f4f4', kinder:['schwarz', 'weiss'], immun:['explosion', 'kaelte'] },
    regen:   { name:'Regenbogenforelle',  hp:1,    tempo:154, r:13, farbe:'#b36bff', kinder:['zebra', 'zebra'] },
    kugel:   { name:'Kugelfisch',         hp:6,    tempo:105, r:14, farbe:'#e9c46a', kinder:['regen', 'regen'], aufblasen:{ dauer:0.9, pause:2.4 } },
    koffer:  { name:'Kofferfisch',        hp:10,   tempo:175, r:15, farbe:'#b8773a', kinder:['regen', 'regen'] },
    wal:     { name:'Walhai',             hp:200,  tempo:45,  r:34, farbe:'#3b5f8a', kinder:['koffer', 'koffer', 'koffer', 'koffer'], riese:true },
    mega:    { name:'Megalodon',          hp:700,  tempo:22,  r:48, farbe:'#56606e', kinder:['wal', 'wal', 'wal', 'wal'], riese:true },
    rochen:  { name:'Schattenrochen',     hp:320,  tempo:60,  r:26, farbe:'#2a2f3d', kinder:['koffer', 'koffer', 'koffer', 'koffer', 'koffer', 'koffer'], riese:true, immer:'camo', immun:['explosion'] },
    krake:   { name:'Riesenkrake',        hp:4000, tempo:18,  r:62, farbe:'#8e3fb8', kinder:['mega', 'mega', 'mega', 'mega'], riese:true },
    krakus:  { name:'Krakus der Boss',    hp:6000, tempo:13,  r:72, farbe:'#c0392b', kinder:[], riese:true, boss:true },
    orka:    { name:'Kaiser Orka',        hp:9000, tempo:19,  r:64, farbe:'#1b1d24', kinder:[], riese:true, boss:true },
    leviathan:{ name:'Eis-Leviathan',     hp:16000, tempo:14, r:70, farbe:'#7fd6ff', kinder:[], riese:true, boss:true },
    haikoenig:{ name:'Hai-König',         hp:7000, tempo:21,  r:60, farbe:'#4a6a8a', kinder:[], riese:true, boss:true },
    abyssos: { name:'Abyssos, der Tiefseekönig', hp:22000, tempo:12, r:74, farbe:'#2a1a4a', kinder:[], riese:true, boss:true },
    // Abenteuer „Schwarzes Eis“: Fische aus der sterbenden Tiefsee, Kapitän Frost und Pako
    schatten: { name:'Schattenfisch',     hp:2,    tempo:120, r:12, farbe:'#1c1530', kinder:['schwarz'], immer:'camo' },
    splitter: { name:'Splitterling',      hp:2,    tempo:165, r:10, farbe:'#9b3fb0', kinder:['rosa'] },
    verderbt: { name:'Verderbter Fisch',  hp:12,   tempo:92,  r:15, farbe:'#4a1f5c', kinder:['splitter', 'splitter', 'splitter'], immun:['kaelte'] },
    kapitaen: { name:'Kapitän Frost',     hp:5000, tempo:14, r:58, farbe:'#9fd8ff', kinder:[], riese:true, boss:true },
    zerbrochen:{ name:'Pako, der Zerbrochene', hp:26000, tempo:15, r:76, farbe:'#3a1050', kinder:[], riese:true, boss:true },
    // Teil 2 „Das erwachte Licht“: Kristallwesen aus dem Herzlicht
    funke:    { name:'Lichtfunke',        hp:1,    tempo:210, r:9,  farbe:'#ffd54a', kinder:['gelb'] },
    licht:    { name:'Lichtgeborener',    hp:3,    tempo:140, r:12, farbe:'#fff2a8', kinder:['funke', 'funke'] },
    spiegelfisch:{ name:'Spiegelfisch',   hp:8,    tempo:115, r:13, farbe:'#dfe8f0', kinder:['regen'], spiegel:0.3 },
    kristallkrebs:{ name:'Kristallkrebs', hp:24,   tempo:55,  r:16, farbe:'#b8a0ff', kinder:['koffer'], immun:['spitz'], schutz:{ alle:5, radius:90, dauer:1.5 } },
    kristallmutter:{ name:'Mutter der Kristalle', hp:9000, tempo:12, r:70, farbe:'#d8b0ff', kinder:[], riese:true, boss:true },
    lichttraeger:{ name:'Der Lichtträger', hp:13000, tempo:15, r:52, farbe:'#fff2c4', kinder:[], riese:true, boss:true },
    uralter:  { name:'Der Uralte',        hp:32000, tempo:9,  r:96, farbe:'#ffe9a8', kinder:[], riese:true, boss:true },
    uralterkern:{ name:'Herz des Uralten', hp:18000, tempo:16, r:60, farbe:'#ff9a4a', kinder:[], riese:true, boss:true }
  };
  for (const id of Object.keys(FISCHE)) FISCHE[id].id = id;
  // Wie viele "Schichten" ein Fisch insgesamt hat (so viele Leben kostet er, wenn er durchkommt)
  function rbe(id) {
    const f = FISCHE[id];
    if (f.rbe == null) f.rbe = f.hp + f.kinder.reduce((s, k) => s + rbe(k), 0);
    return f.rbe;
  }
  Object.keys(FISCHE).forEach(rbe);
  PT.FISCHE = FISCHE;
  PT.BOSS_REIHE = ['krakus', 'orka', 'leviathan', 'haikoenig', 'abyssos', 'kapitaen', 'zerbrochen', 'kristallmutter', 'lichttraeger', 'uralter', 'uralterkern'];
  PT.FISCH_REIHE = ['rot', 'blau', 'gruen', 'gelb', 'rosa', 'flug', 'schwarz', 'weiss', 'tinte', 'panzer', 'zebra', 'regen', 'kugel', 'koffer', 'schatten', 'splitter', 'verderbt', 'funke', 'licht', 'spiegelfisch', 'kristallkrebs', 'wal', 'rochen', 'mega', 'krake'];
  // Gepanzert gibt es nur für zähe Fische (wie im Vorbild)
  PT.kannGepanzert = typ => typ === 'panzer' || FISCHE[typ].hp > 1;

  // Nachwachsen: von welchem Fisch stammt typ ab, auf dem Weg zum Ursprung?
  const elternCache = new Map();
  PT.eltern = function (ursprung, typ) {
    const k = ursprung + '>' + typ;
    if (elternCache.has(k)) return elternCache.get(k);
    let ergebnis = null;
    const suche = [[ursprung, null]], gesehen = new Set();
    while (suche.length) {
      const [id, von] = suche.shift();
      if (id === typ) { ergebnis = von; break; }
      if (gesehen.has(id)) continue;
      gesehen.add(id);
      for (const kind of FISCHE[id].kinder) suche.push([kind, id]);
    }
    elternCache.set(k, ergebnis);
    return ergebnis;
  };

  /* ---------- Schwierigkeit ---------- */
  PT.STUFEN = {
    leicht: { name:'Leicht', leben:200, preis:0.85, runden:30, geld:650, medaille:'🥉' },
    mittel: { name:'Mittel', leben:150, preis:1.0, runden:40, geld:650, medaille:'🥈' },
    schwer: { name:'Schwer', leben:100, preis:1.08, runden:60, geld:650, medaille:'🥇' },
    extrem: { name:'Extrem', leben:1, preis:1.2, runden:80, geld:650, medaille:'💎' }
  };
  PT.preis = (grund, stufe, rabatt = 0) => Math.max(5, Math.round(grund * PT.STUFEN[stufe].preis * (1 - rabatt) / 5) * 5);
  PT.VERKAUF = 0.7;

  /* ---------- Spielmodi ---------- */
  PT.MODI = {
    standard:   { name:'Standard', symbol:'🐧', text:'Alle Pinguine, alle Helden, ganz normal.' },
    grund:      { name:'Nur Grundpinguine', symbol:'🧊', text:'Nur Zapfen-, Stachel-, Schneeball- und Frost-Pinguin. Kein Held.', erlaubt:['zapfen', 'rundum', 'schneeball', 'frost'], ohneHeld:true },
    umgekehrt:  { name:'Umgekehrt', symbol:'🔄', text:'Die Fische schwimmen den Kanal andersherum.' },
    halb:       { name:'Halbes Geld', symbol:'🪙', text:'Alle Einnahmen nur zur Hälfte.' },
    flut:       { name:'Fischflut', symbol:'🌊', text:'Keine Pausen: Jede Runde kommt sofort nach der letzten.' },
    boss:       { name:'Boss-Jagd', symbol:'🐙', text:'Krakus der Boss taucht in Runde 20 und 40 auf. Lässt du ihn durch, ist es vorbei.', runden:40 },
    orka:       { name:'Orka-Angriff', symbol:'🐋', text:'Kaiser Orka kommt in Runde 25 und 50. Seine Flutwellen betäuben Pinguine am Ufer. Lässt du ihn durch, ist es vorbei.', runden:50 },
    hai:        { name:'Hai-König', symbol:'🦈', text:'Der Hai-König kommt in Runde 20 und 40 und ruft ständig neue Fische herbei. Lässt du ihn durch, ist es vorbei.', runden:40 },
    tiefsee:    { name:'Tiefsee-Finsternis', symbol:'🏮', text:'Abyssos, der Tiefseekönig, kommt in Runde 35 und 70. Immer wieder wird es stockdunkel – dann sehen nur Pinguine mit Nachtsicht die Fische.', runden:70 },
    leviathan:  { name:'Leviathan-Erwachen', symbol:'🐉', text:'Der Eis-Leviathan taucht in Runde 30 und 60 auf. Sein Eisatem friert Pinguine am Ufer ein. Lässt du ihn durch, ist es vorbei.', runden:60 },
    sandkasten: { name:'Sandkasten', symbol:'🏖️', text:'Unendlich Geld und Leben. Schick die Fische selbst los und probier alles aus.' }
  };
  PT.MODI_REIHE = ['standard', 'grund', 'umgekehrt', 'halb', 'flut', 'boss', 'orka', 'hai', 'leviathan', 'tiefsee', 'sandkasten'];

  /* ---------- Wetter ----------
     Ab Runde 6 kann zu Beginn einer Runde Wetter aufziehen (bis zur nächsten Runde).
     fischTempo, reichweite, angriff (Angriffstempo), geld: Faktoren. camo: alle sehen getarnte Fische.
     frost: friert kleine Fische alle paar Sekunden kurz ein. */
  PT.WETTER = {
    schneesturm:{ name:'Schneesturm', symbol:'🌨️', text:'Die Fische kämpfen sich langsamer durch, aber die Pinguine sehen nicht so weit.', fischTempo:0.8, reichweite:0.85 },
    polarlicht: { name:'Polarlicht', symbol:'🌌', text:'Das Polarlicht beflügelt: Pinguine greifen schneller an und sehen getarnte Fische.', angriff:1.2, camo:true },
    eisregen:   { name:'Eisregen', symbol:'🧊', text:'Eiskörner prasseln: Kleine Fische frieren immer wieder kurz ein.', frost:{ alle:4, dauer:0.7 } },
    tauwetter:  { name:'Tauwetter', symbol:'☀️', text:'Warm! Die Fische sind flinker, dafür gibt es ein Viertel mehr Geld.', fischTempo:1.15, geld:1.25 },
    nebel:      { name:'Nebel', symbol:'🌫️', text:'Dichter Nebel: Die Pinguine sehen ein Fünftel weniger weit.', reichweite:0.8 }
  };
  PT.WETTER_REIHE = Object.keys(PT.WETTER);
  PT.WETTER_AB = 6;

  /* ---------- Karten ----------
     wege: ein oder mehrere Kanäle (Eckpunkte, werden abgerundet). Endet ein Kanal mitten auf der Karte,
     verschwinden die Fische dort in einem Eisloch. hindernisse: Kreise, auf die nichts darf.
     wasser: Wasserlöcher, in die nur Boot-Pinguine dürfen. tunnel: Eisberge über dem Kanal (x, y, r) – darunter sieht
     nur der Taucher-Pinguin die Fische. schmelzen: Eisflächen (x, y, r, runde), die nach dieser Runde zu Wasser werden.
     geld: Faktor auf Startgeld und alle Einnahmen (Karten mit mehreren Kanälen, weil sich die Fische dort aufteilen). */
  PT.KARTEN = {
    scholle: {
      name:'Eisscholle', stufe:'Anfänger', thema:'tag',
      text:'Ein langer, gewundener Kanal durchs Eis. Viel Platz zum Bauen.',
      wege:[[[-40, 110], [230, 110], [230, 300], [95, 300], [95, 530], [410, 530], [410, 210], [610, 210], [610, 490], [830, 490], [830, 120], [1040, 120]]],
      hindernisse:[[330, 380, 34], [520, 90, 28], [720, 330, 30], [930, 330, 36], [160, 420, 22], [960, 580, 30]],
      wasser:[[720, 600, 30], [330, 600, 26]],
      deko:'iglu'
    },
    bucht: {
      name:'Pinguinbucht', stufe:'Anfänger', thema:'tag',
      text:'Der Kanal windet sich als Schnecke ins große Eisloch. Mit Wasserlöchern für Boote.',
      wege:[[[-40, 90], [900, 90], [900, 560], [100, 560], [100, 220], [760, 220], [760, 430], [290, 430]]],
      hindernisse:[[960, 320, 26], [40, 330, 22], [620, 325, 26]],
      wasser:[[290, 325, 48], [480, 325, 40], [450, 155, 30]],
      deko:'bucht'
    },
    spalte: {
      name:'Gletscherspalte', stufe:'Mittel', thema:'daemmerung',
      text:'Der Kanal schlängelt sich zwischen Gletschern hindurch – weniger Platz, kürzerer Weg.',
      wege:[[[-40, 330], [170, 330], [170, 120], [430, 120], [430, 520], [660, 520], [660, 270], [870, 270], [870, 680]]],
      hindernisse:[[300, 300, 40], [300, 470, 30], [560, 330, 34], [770, 120, 40], [770, 420, 28], [80, 520, 34], [960, 470, 26]],
      wasser:[[560, 90, 32]],
      deko:'gletscher'
    },
    doppel: {
      name:'Doppelstrom', stufe:'Profi', thema:'daemmerung', geld:1.3,
      text:'Zwei Kanäle, zwei Fischschwärme. Die Fische teilen sich abwechselnd auf – dafür gibt es mehr Geld.',
      wege:[
        [[-40, 65], [880, 65], [880, 235], [-40, 235]],
        [[-40, 575], [880, 575], [880, 405], [-40, 405]]
      ],
      hindernisse:[[500, 320, 38], [960, 320, 26], [330, 150, 28], [330, 490, 28], [700, 150, 24], [700, 490, 24], [100, 320, 30], [380, 320, 26], [630, 320, 26]],
      wasser:[[230, 320, 30], [760, 320, 30]],
      deko:'gletscher'
    },
    nacht: {
      name:'Polarnacht', stufe:'Profi', thema:'nacht',
      text:'Unter dem Polarlicht ist der Weg kurz. Hier muss jeder Pinguin sitzen.',
      wege:[[[-40, 530], [290, 530], [290, 150], [700, 150], [700, 420], [1040, 420]]],
      hindernisse:[[150, 330, 40], [500, 330, 46], [500, 560, 28], [860, 250, 36], [860, 560, 30], [120, 90, 26]],
      wasser:[[860, 60, 26]],
      deko:'nacht'
    },
    kreuz: {
      name:'Eiskreuz', stufe:'Mittel', thema:'tag',
      text:'Der Kanal kreuzt sich selbst. Wer an der Kreuzung steht, trifft die Fische zweimal.',
      wege:[[[-40, 320], [300, 320], [300, 90], [700, 90], [700, 550], [480, 550], [480, 320], [1040, 320]]],
      hindernisse:[[150, 500, 40], [880, 140, 34], [580, 205, 30], [880, 500, 30], [150, 140, 26], [590, 435, 26]],
      wasser:[[380, 450, 34], [860, 230, 26]],
      deko:'hafen'
    },
    inseln: {
      name:'Treibeis-Inseln', stufe:'Profi', thema:'daemmerung',
      text:'Ein kurzer Kanal zwischen Treibeis und vielen Wasserlöchern. Hier zählen die Boote.',
      wege:[[[500, -40], [500, 190], [230, 190], [230, 460], [760, 460], [760, 250], [1040, 250]]],
      hindernisse:[[650, 115, 36], [890, 380, 30], [100, 300, 30], [610, 320, 28], [320, 590, 28]],
      wasser:[[120, 90, 40], [880, 120, 44], [520, 580, 40], [400, 325, 34], [920, 560, 30]],
      deko:'treibeis'
    },
    erebus: {
      name:'Erebus-Krater', stufe:'Mittel', thema:'vulkan',
      text:'Am Vulkan im ewigen Eis: Schmelzwasser, Lavaspalten und wenig Platz.',
      wege:[[[1040, 560], [720, 560], [720, 390], [880, 390], [880, 140], [540, 140], [540, 440], [300, 440], [300, 190], [-40, 190]]],
      hindernisse:[[620, 290, 44], [140, 380, 46], [420, 300, 30], [960, 260, 24], [140, 560, 30], [420, 580, 34]],
      wasser:[[800, 260, 32]],
      deko:'vulkan'
    }
  };
  PT.KARTEN.tunnel = {
    name:'Eistunnel', stufe:'Mittel', thema:'tag',
    text:'Zweimal taucht der Kanal unter einem Eisberg hindurch. Im Tunnel sieht nur der Taucher-Pinguin die Fische.',
    wege:[[[-40, 330], [200, 330], [200, 110], [560, 110], [560, 530], [820, 530], [820, 250], [1040, 250]]],
    tunnel:[[380, 110, 70], [690, 530, 62]],
    hindernisse:[[90, 520, 36], [380, 330, 40], [940, 470, 32], [700, 360, 26], [900, 90, 28]],
    wasser:[[360, 470, 34], [100, 140, 28]],
    deko:'tunnel'
  };
  PT.KARTEN.dreizack = {
    name:'Dreizack', stufe:'Profi', thema:'nacht', geld:1.5,
    text:'Drei Schlangen-Kanäle von oben nach unten. Die Fische teilen sich auf – dafür gibt es mehr Geld.',
    wege:[
      [[70, -40], [70, 150], [250, 150], [250, 320], [70, 320], [70, 490], [250, 490], [250, 680]],
      [[580, -40], [580, 150], [400, 150], [400, 320], [580, 320], [580, 490], [400, 490], [400, 680]],
      [[750, -40], [750, 150], [930, 150], [930, 320], [750, 320], [750, 490], [930, 490], [930, 680]]
    ],
    hindernisse:[[325, 70, 22], [665, 590, 22], [160, 600, 20], [840, 60, 20], [325, 240, 22], [665, 420, 22]],
    wasser:[[325, 420, 26], [665, 240, 26]],
    deko:'nacht'
  };
  PT.KARTEN.schmelze = {
    name:'Schmelzscholle', stufe:'Mittel', thema:'daemmerung',
    text:'Es wird warm: Nach und nach schmelzen Eisflächen zu Wasser. Wer dort steht, bekommt sein Geld zurück.',
    wege:[[[-40, 140], [300, 140], [300, 470], [640, 470], [640, 150], [880, 150], [880, 680]]],
    schmelzen:[[470, 300, 62, 10], [140, 340, 56, 20], [770, 350, 58, 30], [470, 580, 44, 15], [960, 300, 34, 25]],
    hindernisse:[[120, 560, 32], [470, 60, 28], [760, 600, 30], [60, 40, 20]],
    wasser:[[960, 560, 28]],
    deko:'schmelz'
  };
  PT.KARTEN.leuchtturm = {
    name:'Leuchtturm-Bucht', stufe:'Anfänger', thema:'tag',
    text:'Ein langer Kanal rund um den alten Leuchtturm. Er endet im Eisloch mitten in der Bucht.',
    wege:[[[-40, 520], [200, 520], [200, 100], [820, 100], [820, 540], [420, 540], [420, 300], [640, 300]]],
    hindernisse:[[90, 260, 32], [960, 330, 28], [320, 420, 24], [520, 200, 22], [630, 430, 22]],
    wasser:[[940, 590, 30], [300, 200, 26]],
    deko:'leuchtturm'
  };
  PT.KARTEN.labyrinth = {
    name:'Pinguin-Labyrinth', stufe:'Mittel', thema:'daemmerung',
    text:'Ein verschlungener Irrgarten mit zwei Tunneln und zwei Kreuzungen. Lang, aber eng.',
    wege:[[[-40, 80], [920, 80], [920, 560], [80, 560], [80, 200], [800, 200], [800, 440], [200, 440], [200, 320], [1040, 320]]],
    tunnel:[[500, 560, 56], [500, 80, 52]],
    hindernisse:[[300, 140, 20], [700, 140, 20], [140, 380, 22], [860, 380, 22], [500, 380, 22]],
    wasser:[[980, 520, 26], [980, 160, 24]],
    deko:'gletscher'
  };
  PT.KARTEN.eisbergring = {
    name:'Eisbergring', stufe:'Profi', thema:'nacht', wetterOft:true,
    text:'Der Kanal läuft einmal rund um den riesigen Eisberg. Hier zieht ständig Wetter auf.',
    wege:[[[-40, 420], [150, 420], [150, 560], [850, 560], [850, 80], [150, 80], [150, 240], [-40, 240]]],
    hindernisse:[[500, 320, 95], [960, 320, 30], [40, 330, 24], [300, 200, 22], [700, 440, 22]],
    wasser:[[960, 590, 26], [960, 50, 24], [300, 440, 26], [700, 200, 26]],
    deko:'eisbergring'
  };
  /* ---------- Karten aus Teil 2 ----------
     stroemung: [[kanal, von, bis, faktor]] – auf diesem Abschnitt (Anteil des Kanals) schwimmen Fische schneller */
  PT.KARTEN.neuhausen = {
    name:'Neu-Pinguinhausen', stufe:'Mittel', thema:'daemmerung',
    text:'Dein eigenes Dorf auf der Scholle. Zwischen den Iglus windet sich der Kanal – verteidige dein Zuhause.',
    wege:[[[-40, 320], [180, 320], [180, 110], [480, 110], [480, 530], [780, 530], [780, 200], [1040, 200]]],
    hindernisse:[[330, 300, 42], [630, 330, 42], [330, 520, 30], [640, 100, 30], [900, 420, 34], [80, 520, 30], [900, 60, 22]],
    wasser:[[900, 590, 26], [70, 110, 28]],
    deko:'iglu'
  };
  PT.KARTEN.kristallwald = {
    name:'Kristallwald', stufe:'Mittel', thema:'licht',
    text:'Unter Wasser wachsen Kristalle so hoch wie Bäume. Lichtstrahlen wandern über die Karte.',
    wege:[[[-40, 100], [860, 100], [860, 310], [140, 310], [140, 530], [1040, 530]]],
    hindernisse:[[500, 200, 32], [300, 420, 34], [700, 420, 34], [960, 300, 26], [40, 410, 24]],
    wasser:[[960, 80, 26], [500, 610, 22]],
    deko:'kristall'
  };
  PT.KARTEN.strudel = {
    name:'Der Strudel', stufe:'Profi', thema:'tiefsee',
    text:'Eine Spirale ins Zentrum des Meeres. Im Inneren reißt die Strömung die Fische doppelt so schnell mit.',
    wege:[[[-40, 60], [940, 60], [940, 580], [60, 580], [60, 180], [820, 180], [820, 460], [180, 460], [180, 320], [560, 320]]],
    stroemung:[[0, 0.62, 1, 1.45]],
    hindernisse:[[700, 320, 34], [380, 390, 26], [500, 250, 22]],
    wasser:[[500, 520, 22], [500, 120, 26], [300, 250, 22]],
    deko:'nacht'
  };
  PT.KARTEN.spiegelsee = {
    name:'Spiegelsee', stufe:'Profi', thema:'licht', geld:1.3,
    text:'Zwei Kanäle, einer das Spiegelbild des anderen. Was oben platzt, taucht manchmal unten wieder auf.',
    wege:[
      [[-40, 140], [300, 140], [300, 260], [700, 260], [700, 140], [1040, 140]],
      [[-40, 500], [300, 500], [300, 380], [700, 380], [700, 500], [1040, 500]]
    ],
    hindernisse:[[500, 320, 40], [150, 320, 30], [850, 320, 30]],
    wasser:[[500, 60, 30], [500, 590, 30]],
    deko:'kristall'
  };
  PT.KARTEN.wrack = {
    name:'Wrack der Eiswache', stufe:'Profi', thema:'nacht', geld:1.3,
    text:'Frosts versunkene Flotte. Zwischen den Wracks brechen mitten im Kampf neue Wege auf.',
    wege:[
      [[-40, 200], [320, 200], [320, 440], [680, 440], [680, 200], [1040, 200]],
      [[500, -40], [500, 110], [860, 110], [860, 560], [1040, 560]],
      [[500, 680], [500, 560], [140, 560], [140, 340], [-40, 340]]
    ],
    hindernisse:[[190, 90, 34], [500, 300, 40], [780, 330, 30], [960, 380, 24], [60, 450, 22]],
    wasser:[[960, 60, 26], [320, 600, 22], [620, 505, 22]],
    deko:'wrack'
  };
  PT.KARTEN.eingeweide = {
    name:'Eingeweide des Uralten', stufe:'Profi', thema:'organisch', geld:1.4,
    text:'Im Inneren der Kreatur. Drei Adern winden sich wie Därme – jede Runde ruht eine davon, die Fische nehmen die anderen.',
    wege:[
      [[-40, 40], [160, 40], [160, 170], [340, 170], [340, 40], [520, 40], [520, 170], [700, 170], [700, 40], [880, 40], [880, 170], [1040, 170]],
      [[-40, 380], [100, 380], [100, 250], [280, 250], [280, 380], [460, 380], [460, 250], [640, 250], [640, 380], [820, 380], [820, 250], [1040, 250]],
      [[-40, 460], [200, 460], [200, 600], [380, 600], [380, 460], [560, 460], [560, 600], [740, 600], [740, 460], [920, 460], [920, 600], [1040, 600]]
    ],
    hindernisse:[[960, 100, 24], [40, 215, 22], [960, 420, 22], [40, 540, 22]],
    wasser:[[610, 215, 22], [370, 420, 22], [880, 530, 20]],
    deko:'fleisch'
  };
  PT.KARTEN.thron = {
    name:'Thron des Lichts', stufe:'Profi', thema:'licht',
    text:'Blendend hell, still und kalt. Der Kanal windet sich bis zum Herzen des Uralten.',
    wege:[[[-40, 600], [900, 600], [900, 60], [100, 60], [100, 480], [760, 480], [760, 200], [260, 200], [260, 340], [540, 340]]],
    hindernisse:[[640, 340, 36], [180, 270, 22], [500, 130, 24], [960, 330, 24]],
    wasser:[[420, 540, 22], [400, 410, 26], [560, 270, 22]],
    deko:'kristall'
  };
  PT.KARTEN_REIHE = ['scholle', 'bucht', 'leuchtturm', 'kreuz', 'spalte', 'tunnel', 'schmelze', 'labyrinth', 'erebus', 'nacht', 'doppel', 'inseln', 'eisbergring', 'dreizack', 'neuhausen', 'kristallwald', 'strudel', 'spiegelsee', 'wrack', 'eingeweide', 'thron'];
  PT.THEMEN_REIHE = ['tag', 'daemmerung', 'nacht', 'vulkan'];
  // Stimmungen nur fürs Abenteuer (überschreiben das Thema der Karte): Tiefsee, Blutnacht, Asche
  PT.STIMMUNGEN = [...PT.THEMEN_REIHE, 'tiefsee', 'blut', 'asche', 'licht', 'organisch'];

  /* ---------- Eigene Karten (Karten-Editor) ----------
     Prüft eine Karte von außen (Editor, Teilen-Link, Koop) und gibt eine bereinigte Kopie zurück oder null. */
  const zahl = (v, min, max) => Number.isFinite(+v) ? Math.max(min, Math.min(max, Math.round(+v))) : null;
  const kreise = (liste, max, rMin, rMax) => (Array.isArray(liste) ? liste : []).slice(0, max)
    .map(k => Array.isArray(k) ? [zahl(k[0], 0, PT.BREITE), zahl(k[1], 0, PT.HOEHE), zahl(k[2], rMin, rMax)] : null)
    .filter(k => k && k.every(v => v != null));
  PT.karteOk = function (d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.wege)) return null;
    const wege = d.wege.slice(0, 3).map(w => (Array.isArray(w) ? w : []).slice(0, 24)
      .map(p => Array.isArray(p) ? [zahl(p[0], -40, PT.BREITE + 40), zahl(p[1], -40, PT.HOEHE + 40)] : null)
      .filter(p => p && p[0] != null && p[1] != null))
      .filter(w => w.length >= 2);
    if (!wege.length) return null;
    // jeder Kanal braucht eine Mindestlänge, sonst ist das Spiel sofort vorbei
    for (const w of wege) {
      let l = 0;
      for (let i = 1; i < w.length; i++) l += Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]);
      if (l < 500) return null;
    }
    return {
      name:String(d.name || 'Eigene Karte').replace(/[\u0000-\u001f<>&"]/g, '').trim().slice(0, 24) || 'Eigene Karte',
      stufe:'Eigene', thema:PT.THEMEN_REIHE.includes(d.thema) ? d.thema : 'tag', text:'Selbst gebaut im Karten-Editor.',
      wege, hindernisse:kreise(d.hindernisse, 16, 14, 60), wasser:kreise(d.wasser, 8, 20, 60), tunnel:kreise(d.tunnel, 4, 30, 90),
      deko:d.thema === 'vulkan' ? 'vulkan' : d.thema === 'nacht' ? 'nacht' : 'gletscher', eigen:true,
      geld:[1, 1, 1.3, 1.5][wege.length]
    };
  };
  PT.WEG_BREITE = 40;

  /* ---------- Runden ----------
     "anzahl typ abstand start [zusatz]" – abstand in Sekunden zwischen zwei Fischen, start = Verzögerung,
     zusatz aus c (getarnt), r (nachwachsend), f (gepanzert) */
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
    '12 gelb 0.5 0|6 rosa 0.7 4|4 gelb 1 7 r',
    '80 gruen 0.25 0',
    '10 gruen 0.4 0|10 gelb 0.5 3|10 rosa 0.6 7',
    '6 schwarz 1.2 0',
    '14 gelb 0.4 0|20 rosa 0.45 3|5 flug 1 8',
    '16 weiss 0.8 0',
    '7 schwarz 0.9 0|7 weiss 0.9 4',
    '20 blau 0.35 0|4 gruen 1.4 3 c',
    '25 gelb 0.35 0|12 rosa 0.5 6|4 schwarz 1 10|6 gelb 0.8 12 r',
    '23 rosa 0.4 0|4 zebra 1.2 6',
    '100 rot 0.12 0|60 blau 0.15 3|45 gruen 0.2 6|45 gelb 0.25 9',
    '6 panzer 1.4 0',
    '16 gelb 0.4 0|14 rosa 0.45 4|6 gelb 0.6 9 c',
    '9 panzer 1 0|6 schwarz 0.8 5',
    '8 schwarz 0.7 0|8 weiss 0.7 3|5 zebra 1 7|4 tinte 1.2 9',
    '25 schwarz 0.4 0|20 weiss 0.45 5|10 flug 0.6 7',
    '20 gelb 0.4 0 c|13 rosa 0.5 6',
    '140 gelb 0.12 0|6 zebra 1 8',
    '35 rosa 0.25 0|25 schwarz 0.35 4|20 weiss 0.4 8|5 regen 1.2 12',
    '80 rosa 0.15 0|6 panzer 1 6|8 tinte 0.8 8',
    '20 schwarz 0.4 0|16 weiss 0.4 3|8 zebra 0.7 8|6 panzer 0.9 11|4 schwarz 1 14 c',
    '40 rosa 0.22 0|12 weiss 0.45 4|7 panzer 0.8 7|7 zebra 0.8 10|2 koffer 2.5 14',
    '10 schwarz 0.4 0|10 weiss 0.4 2|14 zebra 0.6 5|10 regen 0.8 10',
    '4 koffer 1.5 0|1 wal 1 8',
    '30 regen 0.4 0|6 koffer 1 6',
    '10 zebra 0.5 0|12 koffer 0.9 4|4 kugel 1.5 8',
    '2 wal 4 0|10 regen 0.5 2',
    '16 koffer 0.7 0|10 regen 0.4 6 c',
    '3 wal 3 0|20 zebra 0.35 5',
    '20 koffer 0.5 0|5 koffer 0.8 5 f',
    '12 regen 0.3 0 c|10 koffer 0.7 4|2 wal 4 8',
    '40 regen 0.25 0|4 wal 3 6',
    '30 koffer 0.4 0 r|10 panzer 0.5 4 f|10 kugel 0.7 6',
    '6 wal 2.5 0|20 koffer 0.5 6',
    '40 koffer 0.35 0',
    '8 wal 2 0|15 koffer 0.5 5 c',
    '60 regen 0.2 0 c|5 wal 2.5 6',
    '10 wal 1.6 0|30 koffer 0.4 4',
    '1 mega 1 0|20 koffer 0.5 3',
    '50 koffer 0.3 0 r|6 wal 2 8',
    '14 wal 1.3 0|20 kugel 0.4 3 c|20 flug 0.3 6',
    '2 mega 6 0|30 koffer 0.35 4',
    '60 koffer 0.25 0 c|8 wal 1.8 6',
    '3 mega 5 0|10 wal 1.5 4|1 rochen 1 10',
    '4 mega 3 0|20 koffer 0.3 2 f',
    '20 wal 0.9 0',
    '3 rochen 2 0|40 koffer 0.25 3',
    '6 mega 2.5 0|30 regen 0.15 2 c',
    '1 krake 1 0|10 wal 1 4',
    '5 rochen 1.5 0|8 mega 2 5',
    '80 koffer 0.15 0 f',
    '2 krake 6 0|20 wal 0.8 3',
    '8 rochen 1 0|60 koffer 0.2 2 r',
    '3 krake 4 0|10 mega 1.5 3',
    '12 rochen 0.8 0|30 wal 0.6 4',
    '4 krake 3 0|20 mega 1 2 f',
    '20 rochen 0.5 0',
    '6 krake 2.5 0|100 koffer 0.1 2 f',
    '5 krake 3 0|20 rochen 0.6 4|20 mega 0.8 6',
    '50 wal 0.4 0 f',
    '30 rochen 0.4 0|8 krake 2 4',
    '10 krake 1.8 0 f|30 mega 0.6 4',
    '12 krake 1.5 0|40 rochen 0.3 3',
    '20 krake 1 0 f|60 rochen 0.25 5'
  ];
  PT.RUNDEN_FEST = R.length - 1;

  function gruppenLesen(text) {
    return text.split('|').map(g => {
      const [anzahl, typ, abstand, start, z = ''] = g.trim().split(/\s+/);
      return { anzahl:+anzahl, typ, abstand:+abstand, start:+start, camo:z.includes('c'), nach:z.includes('r'), fest:z.includes('f') };
    });
  }
  /* ---------- Bosse ----------
     runden: in welcher Runde welche Bossstufe kommt (je Spielmodus). hp je Stufe. welle: Verstärkung bei 75, 50 und 25 %.
     betaeuben: Flutwelle, die Pinguine in diesem Umkreis (Sekunden) betäubt. belohnung: Geld je Stufe.
     eisatem: friert alle paar Sekunden die Pinguine im Umkreis ein. ruf: ruft alle paar Sekunden Fische herbei. */
  PT.BOSSE = {
    krakus: { modus:'boss', runden:{ 20:1, 40:2 }, hp:[0, 450, 5000], belohnung:1500, symbol:'🐙',
      welle:[[['rosa', 6], ['zebra', 1]], [['regen', 4], ['koffer', 1]]] },
    orka:   { modus:'orka', runden:{ 25:1, 50:2 }, hp:[0, 900, 9000], belohnung:2000, symbol:'🐋',
      welle:[[['regen', 3], ['koffer', 1]], [['koffer', 4], ['wal', 1]]], betaeuben:{ radius:200, dauer:[0, 2.5, 3.5] } },
    leviathan:{ modus:'leviathan', runden:{ 30:1, 60:2 }, hp:[0, 2600, 16000], belohnung:2500, symbol:'🐉',
      welle:[[['weiss', 8], ['zebra', 2]], [['koffer', 4], ['wal', 2]]], eisatem:{ alle:7, radius:170, dauer:[0, 1.8, 2.8] } },
    haikoenig:{ modus:'hai', runden:{ 20:1, 40:2 }, hp:[0, 650, 7000], belohnung:1800, symbol:'🦈',
      welle:[[['rosa', 6], ['koffer', 1]], [['koffer', 3], ['wal', 1]]], ruf:{ alle:6, welle:[[['rosa', 3], ['gelb', 3]], [['koffer', 2], ['regen', 2]]] } },
    // Abyssos: macht es immer wieder stockdunkel (alle Fische außer ihm sind dann getarnt)
    abyssos:{ modus:'tiefsee', runden:{ 35:1, 70:2 }, hp:[0, 3500, 22000], belohnung:3000, symbol:'🏮',
      welle:[[['schwarz', 8], ['tinte', 4]], [['koffer', 4], ['rochen', 1]]], finsternis:{ alle:9, dauer:3.5 }, zweite:'zerbrochen' },
    // Kapitän Frost: friert die wertvollsten Pinguine ein und hüllt Fische in seiner Nähe kurz in Eispanzer (alles prallt ab)
    kapitaen:{ modus:null, runden:{}, hp:[0, 1600, 5000], belohnung:2200, symbol:'🎖️',
      welle:[[['weiss', 8], ['zebra', 2]], [['zebra', 6], ['koffer', 2]]], frostbefehl:{ alle:8, anzahl:[0, 2, 2], dauer:[0, 2.5, 2.5] }, eispanzer:{ alle:12, radius:150, dauer:1.5 } },
    // Pako, der Zerbrochene: die zweite Gestalt von Abyssos (nur im Abenteuer, regeln.zweitePhase)
    zerbrochen:{ modus:null, runden:{}, hp:[0, 6000, 26000], belohnung:4000, symbol:'💔',
      welle:[[['schatten', 8], ['verderbt', 2]], [['verderbt', 6], ['rochen', 2]]], finsternis:{ alle:7, dauer:3 },
      ruf:{ alle:6, welle:[[['schatten', 4]], [['schatten', 6], ['verderbt', 2]]] } },
    // Teil 2: blenden (Pinguine im Umkreis geblendet), schutzAura (Fische im Umkreis kurz unverwundbar)
    kristallmutter:{ modus:null, runden:{}, hp:[0, 3500, 9000], belohnung:2500, symbol:'💎',
      welle:[[['licht', 6], ['kristallkrebs', 1]], [['kristallkrebs', 3], ['licht', 8]]], ruf:{ alle:7, welle:[[['licht', 3]], [['licht', 4], ['spiegelfisch', 2]]] },
      schutzAura:{ alle:8, radius:200, dauer:2 } },
    lichttraeger:{ modus:null, runden:{}, hp:[0, 3000, 8000], belohnung:3000, symbol:'🌟',
      welle:[[['licht', 8]], [['licht', 10], ['kristallkrebs', 2]]], blenden:{ alle:9, radius:220, dauer:[0, 2, 2.6] } },
    uralter:{ modus:null, runden:{}, hp:[0, 9000, 26000], belohnung:5000, symbol:'👁️', zweite:'uralterkern',
      welle:[[['licht', 10], ['spiegelfisch', 3]], [['kristallkrebs', 4], ['mega', 1]]], blenden:{ alle:11, radius:260, dauer:[0, 2, 2.6] },
      ruf:{ alle:8, welle:[[['licht', 4], ['funke', 8]], [['licht', 6], ['spiegelfisch', 3]]] } },
    uralterkern:{ modus:null, runden:{}, hp:[0, 5000, 14000], belohnung:6000, symbol:'💛',
      welle:[[['licht', 8], ['funke', 10]], [['kristallkrebs', 3], ['licht', 12]]], finsternis:{ alle:8, dauer:3 }, schutzAura:{ alle:10, radius:180, dauer:1.5 } }
  };
  PT.BOSS_HP = PT.BOSSE.krakus.hp;
  PT.bossFuer = modus => PT.BOSS_REIHE.find(id => PT.BOSSE[id].modus === modus) || null;

  // Gruppen einer Runde; nach Runde 80 geht es endlos mit immer zäheren Riesen weiter.
  // Boss-Jagd: In Runde 20 und 40 kommt Krakus (Stufe 1 und 2) mit Begleitung, beim Orka-Angriff Kaiser Orka in 25 und 50.
  // bosse (Kampagne): { runde:[typ, stufe] } – zusätzliche Bosse unabhängig vom Spielmodus
  // zusatz (Kampagne): { '12':'gruppen', '20+':'gruppen' } – zusätzliche Fische in Runde 12 bzw. ab Runde 20
  // ersetzen (Kampagne): { runde:'gruppen' } – diese Runde besteht nur aus den angegebenen Fischen (plus Boss)
  PT.runde = function (n, modus, bosse, zusatz, ersetzen) {
    let text = ersetzen && typeof ersetzen[n] === 'string' ? ersetzen[n] : R[n], zaeh = 1;
    if (!text) {
      const k = n - PT.RUNDEN_FEST;
      zaeh = 1 + k * 0.08;
      text = `${4 + Math.floor(k / 2)} krake ${Math.max(0.6, 2 - k * 0.04).toFixed(2)} 0 f|${20 + 2 * k} rochen 0.4 3|${20 + k} mega 0.8 5`;
    }
    const r = { zaeh, gruppen:gruppenLesen(text) };
    if (zusatz) for (const [k, t] of Object.entries(zusatz)) {
      const ab = k.endsWith('+'), rn = parseInt(k, 10);
      if (typeof t === 'string' && (ab ? n >= rn : n === rn)) r.gruppen.push(...gruppenLesen(t).filter(g => FISCHE[g.typ] && !FISCHE[g.typ].boss && g.anzahl > 0));
    }
    const boss = PT.bossFuer(modus);
    if (boss && PT.BOSSE[boss].runden[n]) {
      r.boss = PT.BOSSE[boss].runden[n];
      r.bossTyp = boss;
      r.gruppen.unshift({ anzahl:1, typ:boss, abstand:1, start:0 });
    } else if (bosse && bosse[n] && PT.BOSSE[bosse[n][0]]) {
      r.boss = bosse[n][1] === 2 ? 2 : 1;
      r.bossTyp = bosse[n][0];
      r.gruppen.unshift({ anzahl:1, typ:r.bossTyp, abstand:1, start:0 });
    }
    return r;
  };
  PT.BOSS_HP = [0, 450, 5000];
  PT.rundenBonus = n => 100 + n;
  // Erfahrung für Helden am Ende einer Runde
  PT.heldenXp = n => 40 + 20 * n;
  PT.HELDEN_STUFEN = [0, 0, 100, 300, 700, 1300, 2200, 3500, 5300, 8000, 12000];

  /* ---------- Koop ----------
     Bis zu vier Spieler auf einer Karte. Geld geteilt (eine Kasse) oder getrennt (jeder hat seine eigene,
     Einnahmen aus Fischen und Rundenbonus werden aufgeteilt). Startgeld gibt es pro Spieler. */
  PT.KOOP_MAX = 4;
  PT.KOOP_FARBEN = ['#f6c343', '#2f7fe0', '#e2463b', '#35b04a'];
  PT.KOOP_GELD = { geteilt:{ name:'Geteiltes Geld', text:'Eine Kasse für alle. Jeder darf alles kaufen und aufrüsten.' },
    getrennt:{ name:'Getrenntes Geld', text:'Jeder hat seine eigene Kasse und rüstet nur seine eigenen Pinguine auf.' } };

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
