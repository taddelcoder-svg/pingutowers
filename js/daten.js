'use strict';
// Pingu Towers – Spieldaten: Fische, Karten, Schwierigkeit, Spielmodi und Runden.
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
     Zusätze pro Fisch: getarnt (camo), nachwachsend (wächst wieder zum Ursprung), gepanzert (doppelt so zäh). */
  const FISCHE = {
    rot:     { name:'Rotbarsch',          hp:1,    tempo:70,  r:10, farbe:'#e8453c', kinder:[] },
    blau:    { name:'Blaubarsch',         hp:1,    tempo:98,  r:11, farbe:'#2f7fe0', kinder:['rot'] },
    gruen:   { name:'Grünling',           hp:1,    tempo:126, r:11, farbe:'#35b04a', kinder:['blau'] },
    gelb:    { name:'Goldfisch',          hp:1,    tempo:224, r:11, farbe:'#f5b623', kinder:['gruen'] },
    rosa:    { name:'Lachs',              hp:1,    tempo:245, r:12, farbe:'#ff7fa8', kinder:['gelb'] },
    schwarz: { name:'Anglerfisch',        hp:1,    tempo:126, r:10, farbe:'#23262e', kinder:['rosa', 'rosa'], immun:['explosion'] },
    weiss:   { name:'Eisfisch',           hp:1,    tempo:140, r:10, farbe:'#eef6fb', kinder:['rosa', 'rosa'], immun:['kaelte'] },
    panzer:  { name:'Panzerwels',         hp:1,    tempo:70,  r:13, farbe:'#8a929c', kinder:['schwarz', 'schwarz'], immun:['spitz'] },
    zebra:   { name:'Zebrafisch',         hp:1,    tempo:126, r:12, farbe:'#f4f4f4', kinder:['schwarz', 'weiss'], immun:['explosion', 'kaelte'] },
    regen:   { name:'Regenbogenforelle',  hp:1,    tempo:154, r:13, farbe:'#b36bff', kinder:['zebra', 'zebra'] },
    koffer:  { name:'Kofferfisch',        hp:10,   tempo:175, r:15, farbe:'#b8773a', kinder:['regen', 'regen'] },
    wal:     { name:'Walhai',             hp:200,  tempo:45,  r:34, farbe:'#3b5f8a', kinder:['koffer', 'koffer', 'koffer', 'koffer'], riese:true },
    mega:    { name:'Megalodon',          hp:700,  tempo:22,  r:48, farbe:'#56606e', kinder:['wal', 'wal', 'wal', 'wal'], riese:true },
    rochen:  { name:'Schattenrochen',     hp:400,  tempo:170, r:26, farbe:'#2a2f3d', kinder:['koffer', 'koffer', 'koffer', 'koffer', 'koffer', 'koffer'], riese:true, immer:'camo', immun:['spitz', 'explosion'] },
    krake:   { name:'Riesenkrake',        hp:4000, tempo:18,  r:62, farbe:'#8e3fb8', kinder:['mega', 'mega', 'mega', 'mega'], riese:true },
    krakus:  { name:'Krakus der Boss',    hp:6000, tempo:13,  r:72, farbe:'#c0392b', kinder:[], riese:true, boss:true },
    orka:    { name:'Kaiser Orka',        hp:9000, tempo:19,  r:64, farbe:'#1b1d24', kinder:[], riese:true, boss:true }
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
  PT.BOSS_REIHE = ['krakus', 'orka'];
  PT.FISCH_REIHE = ['rot', 'blau', 'gruen', 'gelb', 'rosa', 'schwarz', 'weiss', 'panzer', 'zebra', 'regen', 'koffer', 'wal', 'rochen', 'mega', 'krake'];
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
    grund:      { name:'Nur Grundpinguine', symbol:'🧊', text:'Nur Zapfen-, Stachel-, Schneeball- und Frost-Pingu. Kein Held.', erlaubt:['zapfen', 'rundum', 'schneeball', 'frost'], ohneHeld:true },
    umgekehrt:  { name:'Umgekehrt', symbol:'🔄', text:'Die Fische schwimmen den Kanal andersherum.' },
    halb:       { name:'Halbes Geld', symbol:'🪙', text:'Alle Einnahmen nur zur Hälfte.' },
    flut:       { name:'Fischflut', symbol:'🌊', text:'Keine Pausen: Jede Runde kommt sofort nach der letzten.' },
    boss:       { name:'Boss-Jagd', symbol:'🐙', text:'Krakus der Boss taucht in Runde 20 und 40 auf. Lässt du ihn durch, ist es vorbei.', runden:40 },
    orka:       { name:'Orka-Angriff', symbol:'🐋', text:'Kaiser Orka kommt in Runde 25 und 50. Seine Flutwellen betäuben Pinguine am Ufer. Lässt du ihn durch, ist es vorbei.', runden:50 },
    sandkasten: { name:'Sandkasten', symbol:'🏖️', text:'Unendlich Geld und Leben. Schick die Fische selbst los und probier alles aus.' }
  };
  PT.MODI_REIHE = ['standard', 'grund', 'umgekehrt', 'halb', 'flut', 'boss', 'orka', 'sandkasten'];

  /* ---------- Karten ----------
     wege: ein oder mehrere Kanäle (Eckpunkte, werden abgerundet). Endet ein Kanal mitten auf der Karte,
     verschwinden die Fische dort in einem Eisloch. hindernisse: Kreise, auf die nichts darf.
     wasser: Wasserlöcher, in die nur Boot-Pinguine dürfen. */
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
      name:'Doppelstrom', stufe:'Profi', thema:'daemmerung',
      text:'Zwei Kanäle, zwei Fischschwärme. Die Fische teilen sich abwechselnd auf.',
      wege:[
        [[-40, 65], [880, 65], [880, 235], [-40, 235]],
        [[-40, 575], [880, 575], [880, 405], [-40, 405]]
      ],
      hindernisse:[[500, 320, 38], [960, 320, 26], [330, 150, 28], [330, 490, 28], [700, 150, 24], [700, 490, 24]],
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
  PT.KARTEN_REIHE = ['scholle', 'bucht', 'kreuz', 'spalte', 'erebus', 'nacht', 'doppel', 'inseln'];
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
    '14 gelb 0.4 0|20 rosa 0.45 3',
    '16 weiss 0.8 0',
    '7 schwarz 0.9 0|7 weiss 0.9 4',
    '20 blau 0.35 0|4 gruen 1.4 3 c',
    '25 gelb 0.35 0|12 rosa 0.5 6|4 schwarz 1 10|6 gelb 0.8 12 r',
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
    '20 koffer 0.5 0|5 koffer 0.8 5 f',
    '12 regen 0.3 0 c|10 koffer 0.7 4|2 wal 4 8',
    '40 regen 0.25 0|4 wal 3 6',
    '30 koffer 0.4 0 r|10 panzer 0.5 4 f',
    '6 wal 2.5 0|20 koffer 0.5 6',
    '40 koffer 0.35 0',
    '8 wal 2 0|15 koffer 0.5 5 c',
    '60 regen 0.2 0 c|5 wal 2.5 6',
    '10 wal 1.6 0|30 koffer 0.4 4',
    '1 mega 1 0|20 koffer 0.5 3',
    '50 koffer 0.3 0 r|6 wal 2 8',
    '14 wal 1.3 0',
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
     betaeuben: Flutwelle, die Pinguine in diesem Umkreis (Sekunden) betäubt. belohnung: Geld je Stufe. */
  PT.BOSSE = {
    krakus: { modus:'boss', runden:{ 20:1, 40:2 }, hp:[0, 450, 5000], belohnung:1500, symbol:'🐙',
      welle:[[['rosa', 6], ['zebra', 1]], [['regen', 4], ['koffer', 1]]] },
    orka:   { modus:'orka', runden:{ 25:1, 50:2 }, hp:[0, 900, 9000], belohnung:2000, symbol:'🐋',
      welle:[[['regen', 3], ['koffer', 1]], [['koffer', 4], ['wal', 1]]], betaeuben:{ radius:200, dauer:[0, 2.5, 3.5] } }
  };
  PT.BOSS_HP = PT.BOSSE.krakus.hp;
  PT.bossFuer = modus => PT.BOSS_REIHE.find(id => PT.BOSSE[id].modus === modus) || null;

  // Gruppen einer Runde; nach Runde 80 geht es endlos mit immer zäheren Riesen weiter.
  // Boss-Jagd: In Runde 20 und 40 kommt Krakus (Stufe 1 und 2) mit Begleitung, beim Orka-Angriff Kaiser Orka in 25 und 50.
  PT.runde = function (n, modus) {
    let text = R[n], zaeh = 1;
    if (!text) {
      const k = n - PT.RUNDEN_FEST;
      zaeh = 1 + k * 0.08;
      text = `${4 + Math.floor(k / 2)} krake ${Math.max(0.6, 2 - k * 0.04).toFixed(2)} 0 f|${20 + 2 * k} rochen 0.4 3|${20 + k} mega 0.8 5`;
    }
    const r = { zaeh, gruppen:gruppenLesen(text) };
    const boss = PT.bossFuer(modus);
    if (boss && PT.BOSSE[boss].runden[n]) {
      r.boss = PT.BOSSE[boss].runden[n];
      r.bossTyp = boss;
      r.gruppen.unshift({ anzahl:1, typ:boss, abstand:1, start:0 });
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
