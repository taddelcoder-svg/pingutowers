'use strict';
// Pinguin Türmchen – Abenteuer (Kampagne): vier Kapitel mit je sechs Levels und einer kleinen Geschichte.
// Jedes Level ist ein normales Spiel mit festen Einstellungen und Regeln (siehe Spiel in logik.js).
// Sterne: 1 für den Sieg, 2 und 3 für besondere Aufgaben. Gespeichert wird im Browser (oberflaeche.js).
(function (wurzel) {
  const PT = wurzel.PT || (wurzel.PT = {});

  /* ---------- Sterne-Aufgaben ----------
     [art, wert]: leben (höchstens so viel Anteil verloren), max (höchstens so viele Pinguine, ohne Held),
     ohneVerkauf, stufe (kein Upgrade über dieser Stufe), gruppe (nur Pinguine dieser Gruppe), ohneFk (keine Fähigkeit),
     geld (mit so viel Geld übrig gewinnen) */
  const AUFGABEN = {
    leben:      w => w === 0 ? 'Verliere kein einziges Leben' : `Verliere höchstens ${Math.round(w * 100)} % der Leben`,
    max:        w => `Höchstens ${w} Pinguine (ohne Held)`,
    ohneVerkauf:() => 'Verkaufe keinen Pinguin',
    stufe:      w => `Kein Upgrade über Stufe ${w}`,
    gruppe:     w => `Nur ${w}-Pinguine (und Held)`,
    ohneFk:     () => 'Setz keine Fähigkeit ein',
    geld:       w => `Gewinne mit mindestens ${w.toLocaleString('de-DE')} Geld übrig`
  };
  PT.sternAufgabe = ([art, w]) => (AUFGABEN[art] ? AUFGABEN[art](w) : art);
  // Prüft eine Aufgabe am Ende eines gewonnenen Spiels
  PT.sternGeschafft = function ([art, w], spiel) {
    const pinguine = spiel.tuerme.filter(t => !PT.HELDEN[t.typ]);
    switch (art) {
      case 'leben': return spiel.leben >= spiel.startLeben * (1 - w) - 1e-9;
      case 'max': return pinguine.length <= w && (spiel.statistik.maxTuerme || 0) <= w;
      case 'ohneVerkauf': return !spiel.statistik.verkauft;
      case 'stufe': return pinguine.every(t => t.pfade.every(p => p <= w));
      case 'gruppe': return pinguine.every(t => PT.PINGUINE[t.typ] && PT.PINGUINE[t.typ].gruppe === w);
      case 'ohneFk': return !spiel.statistik.faehigkeiten;
      case 'geld': return spiel.geld >= w;
    }
    return false;
  };

  /* ---------- Kapitel ---------- */
  PT.KAPITEL = [
    { nr:1, name:'Die Eisscholle erwacht', symbol:'🧊', look:'entdecker', kiste:'holz',
      intro:'Opa Pingo kratzt sich am Schnabel: „Seltsam … seit Tagen schwimmen immer mehr Fische durch unsere Kanäle. Irgendetwas in der Tiefe scheucht sie auf. Lass uns die Eisscholle verteidigen!“' },
    { nr:2, name:'Durch Gletscher und Tunnel', symbol:'🏔️', look:'bergsteiger', kiste:'silber',
      intro:'„Die Spuren führen ins Gebirge“, sagt Opa Pingo. „Dort haben die Fische alte Tunnel gefunden. Nur unsere Taucher sehen, was darin schwimmt.“' },
    { nr:3, name:'Feuer und Eis', symbol:'🌋', look:'feuerwehr', kiste:'silber',
      intro:'„Am Erebus-Vulkan brodelt es. Krakus und der Hai-König haben sich mit den Fischen verbündet! Jetzt wird es ernst, mein Kleiner.“' },
    { nr:4, name:'Die Tiefsee ruft', symbol:'🌊', look:'tiefsee', kiste:'gold',
      intro:'„Jetzt wissen wir, wer hinter allem steckt: Abyssos, der Tiefseekönig. Mit seiner Laterne lockt er alle Fische an. Wir müssen ihn aufhalten – für Pinguinhausen!“' }
  ];

  /* ---------- Levels ----------
     regeln wie bei der Tages-Herausforderung; dazu startRunde, bosse { runde:[typ, stufe] } und wetter.
     held: fester Held (sonst freie Wahl). neu: Hinweis auf etwas Neues. */
  const L = (kapitel, nr, name, karte, stufe, regeln, sterne, text, extra = {}) => ({ id:`k${kapitel}-${nr}`, kapitel, nr, name, karte, stufe, regeln, sterne, text, ...extra });
  PT.LEVELS = [
    // Kapitel 1: leicht, kurz
    L(1, 1, 'Erste Schritte', 'scholle', 'leicht', { runden:10 }, [['leben', 0], ['max', 4]],
      'Setz ein paar Zapfen-Pinguine ans Ufer und halte die ersten zehn Runden durch. Ganz entspannt!'),
    L(1, 2, 'Die Bucht', 'bucht', 'leicht', { runden:15 }, [['leben', 0.1], ['stufe', 2]],
      'In der Pinguinbucht verschwinden die Fische im Eisloch. In den Wasserlöchern dürfen Boote fahren.'),
    L(1, 3, 'Das Leuchtfeuer', 'leuchtturm', 'leicht', { runden:18 }, [['leben', 0], ['ohneVerkauf']],
      'Der alte Leuchtturm warnt die Schiffe. Heute warnt er uns vor einem großen Schwarm.'),
    L(1, 4, 'Nur das Nötigste', 'kreuz', 'leicht', { runden:20, erlaubt:['zapfen', 'rundum', 'schneeball', 'frost', 'feuerwerk'] }, [['leben', 0.1], ['max', 6]],
      'Die Händler sind weg – heute gibt es nur Primär-Pinguine. An der Kreuzung trifft man die Fische zweimal!'),
    L(1, 5, 'Schneesturm', 'scholle', 'leicht', { runden:22, wetter:'schneesturm' }, [['leben', 0], ['ohneFk']],
      'Ein Schneesturm zieht auf und bleibt. Die Fische sind langsamer, aber deine Pinguine sehen nicht so weit.'),
    L(1, 6, 'Krakus der Kleine', 'bucht', 'leicht', { runden:20, bosse:{ 20:['krakus', 1] } }, [['leben', 0.1], ['ohneVerkauf']],
      'Ein erster Boss! Krakus taucht in Runde 20 auf. Stell deine Pinguine auf „Stärkster“ – er darf nicht durch!', { boss:'krakus' }),
    // Kapitel 2: mittel
    L(2, 1, 'Gletscherpfad', 'spalte', 'mittel', { runden:22 }, [['leben', 0.1], ['max', 8]],
      'In der Gletscherspalte ist wenig Platz. Jeder Pinguin muss gut stehen.'),
    L(2, 2, 'Der Eistunnel', 'tunnel', 'mittel', { runden:24 }, [['leben', 0.1], ['ohneVerkauf']],
      'Unter den Eisbergen sieht nur der Taucher-Pinguin die Fische. Probier ihn aus!', { neu:'taucher' }),
    L(2, 3, 'Tauwetter', 'schmelze', 'mittel', { runden:26, wetter:'tauwetter' }, [['leben', 0.1], ['geld', 3000]],
      'Es wird warm! Die Fische sind flinker, aber es gibt mehr Geld. Und die Eisflächen schmelzen …'),
    L(2, 4, 'Im Labyrinth', 'labyrinth', 'mittel', { runden:28 }, [['leben', 0.05], ['stufe', 3]],
      'Ein verschlungener Irrgarten mit Tunneln. Wer klug baut, trifft die Fische gleich mehrmals.'),
    L(2, 5, 'Hexenküche', 'kreuz', 'mittel', { runden:30, erlaubt:['hexe', 'polar', 'ninja', 'laser', 'sturm', 'markt', 'haeuptling', 'disco', 'koch', 'fabrik'] }, [['leben', 0.1], ['max', 10]],
      'Heute nur Magie und Unterstützung. Die Hexe verwandelt Fische in Rotbarsche – und ihr Gift wirkt nach!', { neu:'hexe' }),
    L(2, 6, 'Der Hai-König', 'tunnel', 'mittel', { runden:30, startRunde:15, geld:3500, bosse:{ 30:['haikoenig', 1] } }, [['leben', 0.1], ['ohneVerkauf']],
      'Los geht es in Runde 15 mit 3.500 Geld. In Runde 30 kommt der Hai-König und ruft ständig Fische herbei.', { boss:'haikoenig' }),
    // Kapitel 3: mittel bis schwer, Bosse
    L(3, 1, 'Am Vulkan', 'erebus', 'mittel', { runden:32 }, [['leben', 0.1], ['max', 10]],
      'Lavaspalten und wenig Platz. Der Feuerwerks-Pinguin fühlt sich hier wohl.', { neu:'feuerwerk' }),
    L(3, 2, 'Polarnacht', 'nacht', 'mittel', { runden:34, wetter:'polarlicht' }, [['leben', 0.05], ['ohneFk']],
      'Unter dem Polarlicht sehen alle Pinguine getarnte Fische und greifen schneller an. Nutze es!'),
    L(3, 3, 'Sturmwarnung', 'inseln', 'mittel', { runden:34 }, [['leben', 0.1], ['stufe', 3]],
      'Der Sturm-Pinguin weht Fische zurück. Auf den Treibeis-Inseln zählt jede Sekunde.', { neu:'sturm' }),
    L(3, 4, 'Krakus kehrt zurück', 'erebus', 'schwer', { runden:40, startRunde:25, geld:6000, bosse:{ 40:['krakus', 2] } }, [['leben', 0.1], ['ohneVerkauf']],
      'Krakus ist wieder da – größer als je zuvor! Start in Runde 25 mit 6.000 Geld.', { boss:'krakus' }),
    L(3, 5, 'Zwei Ströme', 'doppel', 'mittel', { runden:30 }, [['leben', 0.1], ['max', 12]],
      'Zwei Kanäle, zwei Schwärme. Auf dem Doppelstrom gibt es mehr Geld – du brauchst es.'),
    L(3, 6, 'Kaiser Orka', 'eisbergring', 'schwer', { runden:40, startRunde:28, geld:8000, bosse:{ 40:['orka', 2] } }, [['leben', 0.1], ['ohneFk']],
      'Rund um den riesigen Eisberg wartet Kaiser Orka. Seine Flutwellen betäuben Pinguine am Ufer!', { boss:'orka' }),
    // Kapitel 4: schwer, Finale
    L(4, 1, 'Der Dreizack', 'dreizack', 'mittel', { runden:35 }, [['leben', 0.1], ['max', 14]],
      'Drei Kanäle auf einmal! Stell Pinguine zwischen die Kanäle, dann treffen sie zwei gleichzeitig.'),
    L(4, 2, 'Eisregen', 'labyrinth', 'schwer', { runden:40, startRunde:20, geld:5000, wetter:'eisregen' }, [['leben', 0.05], ['stufe', 4]],
      'Eisregen friert die kleinen Fische immer wieder ein – aber die Riesen kommen trotzdem.'),
    L(4, 3, 'Der Eis-Leviathan', 'spalte', 'schwer', { runden:45, startRunde:30, geld:9000, bosse:{ 45:['leviathan', 1] } }, [['leben', 0.1], ['ohneVerkauf']],
      'Aus dem Gletscher steigt der Eis-Leviathan. Sein Eisatem friert deine Pinguine ein. Eisbären mit dickem Fell helfen!', { boss:'leviathan' }),
    L(4, 4, 'Nebel über der Bucht', 'leuchtturm', 'schwer', { runden:50, startRunde:35, geld:12000, wetter:'nebel' }, [['leben', 0.05], ['max', 14]],
      'Dichter Nebel. Die Pinguine sehen nicht weit – baue dicht am Kanal.'),
    L(4, 5, 'Vor dem Sturm', 'dreizack', 'schwer', { runden:50, startRunde:38, geld:16000 }, [['leben', 0.1], ['ohneFk']],
      'Ein letzter großer Schwarm vor dem Finale. Danach geht es in die Tiefsee.'),
    L(4, 6, 'Abyssos', 'nacht', 'schwer', { runden:55, startRunde:40, geld:20000, bosse:{ 50:['haikoenig', 2], 55:['abyssos', 1] } }, [['leben', 0.1], ['ohneVerkauf']],
      'Das Finale! Erst der Hai-König, dann Abyssos selbst. Wenn er seine Laterne löscht, sehen nur Pinguine mit Nachtsicht die Fische. Viel Glück!', { boss:'abyssos', finale:true })
  ];
  PT.LEVEL = id => PT.LEVELS.find(l => l.id === id) || null;
  PT.ENDE_TEXT = 'Abyssos sinkt zurück in die Tiefe, seine Laterne erlischt für immer. Die Fische beruhigen sich, und ganz Pinguinhausen feiert dich als Held! Opa Pingo zwinkert: „Ich wusste es doch.“';

  // gespeichert wird je Level, welche der drei Sterne schon geholt sind: [sieg, aufgabe1, aufgabe2]
  PT.sternZahl = x => (Array.isArray(x) ? x.filter(Boolean).length : 0);
  // Freigeschaltet: das erste Level und jedes, dessen Vorgänger mindestens einen Stern hat
  PT.levelFrei = function (id, sterne) {
    const i = PT.LEVELS.findIndex(l => l.id === id);
    return i === 0 || (i > 0 && PT.sternZahl(sterne[PT.LEVELS[i - 1].id]) >= 1);
  };
  // Sterne eines gewonnenen Spiels: 1 für den Sieg, je einer für die beiden Aufgaben
  PT.levelSterne = function (level, spiel) {
    return [true, ...level.sterne.map(a => PT.sternGeschafft(a, spiel))];
  };
  PT.kapitelFertig = (nr, sterne) => PT.LEVELS.filter(l => l.kapitel === nr).every(l => PT.sternZahl(sterne[l.id]) >= 1);
  PT.STERN_XP = 60;
  PT.STERN_MUENZEN = 3;

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
