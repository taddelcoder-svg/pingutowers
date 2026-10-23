'use strict';
// Pinguin Türmchen – Abenteuer „Schwarzes Eis“: Prolog und fünf Kapitel, 30 Levels.
// Jedes Level ist ein normales Spiel mit festen Einstellungen und Regeln (siehe Spiel in logik.js).
// Dazu Szenen vor und nach dem Level (vorher, nachher), Funksprüche mitten im Kampf (funk) und am Ende
// der Abspann. Sterne: 1 für den Sieg, 2 und 3 für besondere Aufgaben. Gespeichert wird im Browser (oberflaeche.js).
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

  /* ---------- Wer spricht ----------
     bild: Porträt (look = Pinguin im Look, held = Heldenbild, fisch = Fischbild), farbe: Namensfarbe. */
  PT.SPRECHER = {
    erzaehler:{ name:'', farbe:'#cfd8e3' },
    opa:      { name:'Opa Pingo', farbe:'#f6c343', bild:{ look:'opa' } },
    nova:     { name:'Nova', farbe:'#7dd3ff', bild:{ held:'nova' } },
    walter:   { name:'Walter', farbe:'#d9b98a', bild:{ held:'walter' } },
    frost:    { name:'Kapitän Frost', farbe:'#9fe8ff', bild:{ look:'kapitaen' } },
    kiko:     { name:'Funker Kiko', farbe:'#9fe08a', bild:{ look:'bergsteiger' } },
    lio:      { name:'Lio, Posten 7', farbe:'#ffb37a', bild:{ look:'standard' } },
    mia:      { name:'Mia', farbe:'#ffb6d5', bild:{ look:'kueken' } },
    abyssos:  { name:'Abyssos', farbe:'#c58bff', bild:{ fisch:'abyssos' } },
    pako:     { name:'Pako', farbe:'#d9a6ff', bild:{ look:'pako' } },
    fremd:    { name:'???', farbe:'#fff2a8' }
  };

  /* ---------- Kapitel ----------
     zitat: Spruch auf der Titelkarte, stimmung: Musik (ton.js), look: Belohnung fürs ganze Kapitel. */
  PT.KAPITEL = [
    { nr:0, name:'Prolog: Die Nacht, in der das Wasser schrie', kurz:'Prolog', symbol:'🌑', kiste:'holz', stimmung:'nacht',
      zitat:['Seit fünfzig Jahren hat das Eis nicht gebebt.', 'Heute Nacht bebt es.'] },
    { nr:1, name:'Die Flut', symbol:'🌊', look:'entdecker', kiste:'holz', stimmung:'flut',
      zitat:['„Fische greifen nicht an. Fische fliehen.“', 'Walter'] },
    { nr:2, name:'Die Tunnel', symbol:'🕳️', look:'bergsteiger', kiste:'silber', stimmung:'tunnel',
      zitat:['„Manche Türen schließt man nicht, damit niemand hineinkommt. Sondern damit niemand herauskommt.“', 'Walter'] },
    { nr:3, name:'Feuer und Verrat', symbol:'🔥', look:'kapitaen', kiste:'silber', stimmung:'feuer',
      zitat:['„Ihr wärmt euch an einem gestohlenen Feuer – und wundert euch, dass jemand kommt, um es zurückzuholen.“', 'Kapitän Frost'] },
    { nr:4, name:'Die Tiefe', symbol:'🌑', look:'tiefsee', kiste:'gold', stimmung:'tiefe',
      zitat:['„Unten gibt es kein Oben mehr. Nur Dunkelheit – und das, was darin wartet.“', 'Opa Pingo'] },
    { nr:5, name:'Das Herzlicht', symbol:'💔', look:'pako', kiste:'gold', stimmung:'herz',
      zitat:['„Du hast mich nicht mal gesucht.“', '???'] }
  ];
  PT.KAPITEL_VON = nr => PT.KAPITEL.find(k => k.nr === nr) || null;

  /* ---------- Levels ----------
     regeln wie bei der Tages-Herausforderung; dazu startRunde, bosse { runde:[typ, stufe] }, wetter und die
     Story-Regeln aus logik.js (thema, wegeAb, zusatz, flut, zerstoeren, heldFaellt, finsternis, reichweite, einsturz, zweitePhase).
     held: fester Held. neu: neuer Pinguin oder Fisch. gerettet: so viele ziehen danach ins Pingu-Dorf.
     vorher/nachher: Szene als [[sprecher, text], …]. funk: Sprüche im Kampf, Schlüssel r<runde>, boss, phase1–3, zweite,
     weg (neuer Kanal offen), sabotiert, gefallen, dunkel (Finsternis), einsturz, knapp (weniger als die Hälfte der Leben). */
  const L = (kapitel, nr, name, karte, stufe, regeln, sterne, text, extra = {}) => ({ id:`s${kapitel}-${nr}`, kapitel, nr, name, karte, stufe, regeln, sterne, text, ...extra });
  PT.LEVELS = [
    /* ===================== PROLOG ===================== */
    L(0, 1, 'Posten 7', 'nacht', 'leicht', { runden:8, geld:900, thema:'blut', zusatz:{ '4+':'10 blau 0.3 0|6 gruen 0.45 3' } }, [['leben', 0.1], ['max', 6]],
      'Halte den Kanal acht Runden lang, bis Posten 7 geräumt ist.', {
        gerettet:3,
        vorher:[
          ['erzaehler', 'Pinguinhausen. Die längste Nacht des Jahres.'],
          ['erzaehler', 'Seit fünfzig Jahren hat das Eis nicht mehr gebebt. Heute Nacht bebt es.'],
          ['lio', 'Hier Posten 7! Hört mich jemand?! Das Wasser … das Wasser ist SCHWARZ! Es kommen hunderte!'],
          ['kiko', 'Posten 7, hier Pinguinhausen. Wie viele genau?'],
          ['lio', 'Ich sagte HUNDERTE! Und sie greifen nicht an – sie rennen! Wovor rennen die?!'],
          ['opa', 'Ruhig, Lio. Wir schicken dir jemanden.'],
          ['opa', 'Du. Ja, du. Nimm die Zapfen-Pinguine und halte den Kanal, bis Posten 7 geräumt ist. Acht Runden. Nicht mehr.']
        ],
        funk:{ r3:[['lio', 'Sie kommen über das Eis gekrochen! Haltet die Linie!']], r6:[['lio', 'Zwei Boote sind raus! Noch zwei!']],
          r8:[['lio', 'Letzte Runde! Gleich haben wir es geschafft!']], knapp:[['lio', 'Sie sind zu viele! Beeilt euch!']] },
        nachher:[
          ['lio', 'Wir sind fast draußen! Nur noch ein Boot, dann—'],
          ['erzaehler', 'Ein Krachen. Dann nur noch Rauschen.'],
          ['kiko', 'Posten 7? … Posten 7, bitte kommen.'],
          ['kiko', '… Posten 7 meldet sich nicht mehr.'],
          ['opa', 'Holt die Überlebenden rein. Alle. Und kein Wort zu den Kleinen.']
        ] }),

    /* ===================== KAPITEL 1: DIE FLUT ===================== */
    L(1, 1, 'Am Morgen danach', 'scholle', 'leicht', { runden:15, thema:'daemmerung' }, [['leben', 0], ['stufe', 2]],
      'Die nächste Welle kommt. Halte fünfzehn Runden.', {
        gerettet:2,
        vorher:[
          ['erzaehler', 'Am Morgen ist Posten 7 nur noch ein Loch im Eis. Rundherum treiben tote Fische – schwarz verfärbt, als hätte sie etwas von innen ausgebrannt.'],
          ['nova', 'Die haben Lio erwischt. Ich will, dass jeder einzelne von denen dafür bezahlt.'],
          ['walter', 'Schau sie dir an, Mädchen. Schau sie dir genau an.'],
          ['nova', 'Ich seh Fische. Tote Fische.'],
          ['walter', 'Du siehst Flüchtlinge. Fische greifen nicht an. Fische fliehen.'],
          ['opa', 'Genug jetzt. Die nächste Welle kommt. Auf eure Posten.']
        ],
        funk:{ r10:[['kiko', 'Komisch … die schwimmen nicht auf uns zu. Die schwimmen an uns vorbei. Als wäre hinter ihnen etwas.']] },
        nachher:[
          ['nova', 'Fünfzehn Runden, keiner durch. Wer flieht, kämpft nicht so verbissen.'],
          ['walter', 'Wer nichts mehr zu verlieren hat, kämpft genau so.']
        ] }),
    L(1, 2, 'Die Flüchtenden', 'bucht', 'leicht', { runden:18, zusatz:{ '8+':'4 schatten 1 6' } }, [['leben', 0.1], ['ohneVerkauf']],
      'Neu: Schattenfische. Sie sind getarnt, tauchen aber alle paar Sekunden kurz auf. Pinguine mit Nachtsicht sehen sie immer.', {
        gerettet:4, neuFisch:'schatten',
        vorher:[
          ['kiko', 'Neue Sichtung! Fische, die man kaum sieht. Wie Schatten im Wasser.'],
          ['walter', 'Schattenfische. Die kommen aus der Tiefe. Ganz von unten.'],
          ['opa', 'Das … das kann nicht sein.'],
          ['nova', 'Opa? Was kann nicht sein?'],
          ['opa', 'Nichts. Sie tauchen immer wieder kurz auf, dann trefft ihr sie. Oder ihr nehmt Pinguine, die im Dunkeln sehen.']
        ],
        funk:{ r8:[['kiko', 'Schattenfische im Kanal! Wartet, bis sie auftauchen!']] },
        nachher:[
          ['nova', 'Opa hat gezittert. Ich hab Opa noch nie zittern sehen.'],
          ['walter', 'Dann hast du ihn noch nie lügen sehen. Glaub mir – das ist schlimmer.']
        ] }),
    L(1, 3, 'Mia', 'leuchtturm', 'leicht', { runden:20, leben:10 }, [['leben', 0], ['max', 8]],
      'Am Ende des Kanals treibt Mias Floß. Es hält nur 10 Treffer aus – lass so gut wie keinen Fisch durch!', {
        gerettet:1,
        vorher:[
          ['kiko', 'Ein Floß! Ganz hinten am Kanal treibt ein Floß!'],
          ['erzaehler', 'Auf dem Floß sitzt ein Küken. Allein. Es hält eine Mütze fest, die viel zu groß für es ist.'],
          ['nova', 'Hey, Kleine. Wie heißt du?'],
          ['mia', 'Mia. Das ist Mamas Mütze. Mama kommt gleich nach.'],
          ['walter', '…'],
          ['opa', 'Das Floß hält nicht viel aus. Kein Fisch darf bis zu ihr durch. Hörst du? Keiner.']
        ],
        funk:{ knapp:[['mia', 'Die Fische sind so nah! Ich hab Angst!']], r15:[['mia', 'Ihr seid echt mutig, wisst ihr das?']] },
        nachher:[
          ['mia', 'Kommt Mama jetzt?'],
          ['nova', '… Bald, Mia. Bald.'],
          ['walter', 'Lüg sie nicht an.'],
          ['nova', 'Was soll ich ihr denn sagen, Walter?!'],
          ['walter', 'Nichts. Manchmal ist Nichts das Ehrlichste.']
        ] }),
    L(1, 4, 'Zwei Fronten', 'doppel', 'leicht', { runden:22, wegeAb:[1, 8] }, [['leben', 0.1], ['ohneFk']],
      'Der zweite Kanal ist zugefroren. Noch.', {
        gerettet:3,
        vorher:[
          ['kiko', 'Der Ostkanal ist zugefroren. Wenigstens eine Seite, um die wir uns keine Sorgen machen müssen.'],
          ['walter', 'Eis, das zufriert, kann auch brechen.'],
          ['nova', 'Du bist echt ein Sonnenschein, Walter.']
        ],
        funk:{ weg:[['kiko', 'Der Ostkanal! Das Eis ist aufgebrochen – sie kommen von zwei Seiten!']] },
        nachher:[
          ['nova', 'Woher wusstest du das mit dem Ostkanal?'],
          ['walter', 'Weil ich so was schon mal gesehen habe. Vor fünfzig Jahren.'],
          ['nova', 'Vor fünfzig Jahren? Was war vor fünfzig Jahren?'],
          ['walter', 'Frag deinen Opa.']
        ] }),
    L(1, 5, 'Schwarzes Wasser', 'scholle', 'mittel', { runden:25, thema:'nacht', zusatz:{ '10+':'3 verderbt 1.2 5' } }, [['leben', 0.1], ['stufe', 3]],
      'Neu: Verderbte Fische. Kälte macht ihnen nichts, und wenn sie platzen, zerfallen sie in flinke Splitterlinge.', {
        gerettet:3, neuFisch:'verderbt',
        vorher:[
          ['erzaehler', 'Das Wasser im Kanal ist jetzt schwarz. Es riecht nach Rost und Asche.'],
          ['kiko', 'Da ist etwas Neues. Groß, lila, und … es zerfällt, wenn man es trifft. In kleinere Dinger.'],
          ['walter', 'Verderbte. Die Dunkelheit frisst sie von innen auf, bis nur noch Splitter übrig sind.'],
          ['nova', 'Woher weißt du so was?!'],
          ['walter', 'Kälte macht ihnen nichts. Nehmt was anderes.']
        ],
        funk:{ r12:[['kiko', 'Verderbte im Kanal! Wenn sie platzen, kommen Splitterlinge raus!']] },
        nachher:[
          ['nova', 'Opa. Walter weiß Dinge, die er nicht wissen kann. Und du auch. Was verschweigt ihr mir?'],
          ['opa', 'Manche Dinge muss man nicht wissen, um zu kämpfen, Nova.'],
          ['nova', 'Und manche Dinge muss man wissen, um zu wissen, WOFÜR man kämpft.']
        ] }),
    L(1, 6, 'Krakus', 'bucht', 'mittel', { runden:25, startRunde:10, geld:2500, bosse:{ 25:['krakus', 1] } }, [['leben', 0.1], ['ohneVerkauf']],
      'Krakus taucht in Runde 25 auf. Er ist verletzt – aber er darf nicht durch.', {
        gerettet:5, boss:'krakus',
        vorher:[
          ['kiko', 'Riesensignal! Das ist … das ist Krakus!'],
          ['nova', 'Endlich. Ein richtiger Gegner.'],
          ['walter', 'Schau dir seine Arme an.'],
          ['erzaehler', 'Krakus fehlen drei Arme. Die Wunden sind schwarz.'],
          ['walter', 'Etwas hat Krakus angefressen. KRAKUS. Und jetzt flieht er. Durch unsere Kanäle.'],
          ['opa', 'Er darf nicht durch. Egal, wovor er flieht.']
        ],
        funk:{ boss:[['kiko', 'Krakus ist da! Stellt eure Pinguine auf „Stärkster“!']], phase1:[['walter', 'Er ruft seine Brut! Nicht nachlassen!']], phase3:[['nova', 'Gleich haben wir ihn!']] },
        nachher:[
          ['erzaehler', 'Krakus sinkt. Bevor er verschwindet, öffnet er ein letztes Mal das Auge – und sieht nicht euch an. Sondern hinunter, zum Grund des Meeres.'],
          ['nova', 'Was hat er da unten gesehen?'],
          ['opa', 'Morgen gehen wir in die Berge. Die Spuren führen in die alten Tunnel.'],
          ['walter', 'Die Tunnel. Natürlich.'],
          ['walter', 'Ich hab gehofft, ich muss da nie wieder rein.']
        ] }),

    /* ===================== KAPITEL 2: DIE TUNNEL ===================== */
    L(2, 1, 'Spurensuche', 'spalte', 'mittel', { runden:25, thema:'daemmerung' }, [['leben', 0.1], ['max', 9]],
      'In der Gletscherspalte ist wenig Platz. Jeder Pinguin muss sitzen.', {
        gerettet:3,
        vorher:[
          ['erzaehler', 'Die Gletscherspalte. Hier oben ist es still. Zu still.'],
          ['nova', 'Keine Vögel. Keine Robben. Nichts.'],
          ['kiko', 'Die Fischspuren führen direkt in den Berg. Da ist ein alter Tunneleingang. Mit Pinguin-Schrift drüber.'],
          ['nova', 'Pinguin-Schrift? Wer baut denn Tunnel unter einen Gletscher?'],
          ['opa', 'Wir. Früher. Konzentrier dich.']
        ],
        funk:{ r15:[['kiko', 'Aus der Spalte kommen immer mehr. Als würde der Berg sie ausspucken.']] },
        nachher:[
          ['nova', '„Wir. Früher.“ Das war alles, was er gesagt hat.'],
          ['walter', 'Mehr kriegst du von ihm auch nicht. Nicht freiwillig.']
        ] }),
    L(2, 2, 'Unter dem Eis', 'tunnel', 'mittel', { runden:26 }, [['leben', 0.1], ['ohneVerkauf']],
      'Im Tunnel sieht nur der Taucher-Pinguin die Fische. Probier ihn aus!', {
        gerettet:3, neu:'taucher',
        vorher:[
          ['kiko', 'Im Tunnel sehen wir nichts. Nur der Taucher-Pinguin sieht, was darunter schwimmt.'],
          ['walter', 'Ich geh mit rein.'],
          ['opa', 'Walter, nein. Du weißt, was da drin ist.'],
          ['walter', 'Eben deshalb, Pingo. Eben deshalb.']
        ],
        funk:{ r12:[['walter', 'Hier unten ist es kälter, als ich es in Erinnerung hatte.']] },
        nachher:[
          ['erzaehler', 'Tief im Tunnel bleibt Walter vor einer Wand stehen. Er sagt nichts. Er legt nur die Flosse darauf, als würde er jemanden begrüßen.']
        ] }),
    L(2, 3, 'Die Wandbilder', 'labyrinth', 'mittel', { runden:28, thema:'nacht', finsternis:{ alle:14, dauer:2.5 } }, [['leben', 0.1], ['stufe', 3]],
      'Die Fackeln flackern: Immer wieder wird es kurz dunkel. Dann sehen nur Pinguine mit Nachtsicht die Fische.', {
        gerettet:2,
        vorher:[
          ['erzaehler', 'Die Wände des Labyrinths sind bemalt. Pinguine mit Fackeln. Pinguine, die in die Tiefe tauchen. Und Pinguine, die etwas Leuchtendes nach oben tragen. Einen Kristall.'],
          ['nova', 'Was ist das? Was tragen die da?'],
          ['walter', 'Das Herzlicht.'],
          ['nova', 'Das was?'],
          ['walter', 'Die Fackeln flackern. Pass auf, wenn es dunkel wird.']
        ],
        funk:{ dunkel:[['kiko', 'Die Fackeln gehen aus! Wir sehen nichts mehr!']] },
        nachher:[
          ['nova', 'Walter. Das Herzlicht. Erklär es mir.'],
          ['walter', 'Es ist das, was unser Eis zusammenhält. Und das, was die Tiefe am Leben hielt. Bevor wir es mitgenommen haben.'],
          ['nova', 'Mitgenommen. Du meinst gestohlen.'],
          ['walter', 'Ich meine, du stellst die richtigen Fragen. Nur dem falschen Pinguin.']
        ] }),
    L(2, 4, 'Der durchgestrichene Name', 'tunnel', 'mittel', { runden:30, startRunde:12, geld:3000, zusatz:{ '16+':'6 schatten 0.6 4' } }, [['leben', 0.1], ['max', 10]],
      'Start in Runde 12 mit 3.000 Geld. Aus der Tiefe des Tunnels kommen Schwärme von Schattenfischen.', {
        gerettet:4,
        vorher:[
          ['erzaehler', 'Am Ende des Tunnels: eine Liste. Sieben Namen, eingeritzt ins Eis. Die Expedition.'],
          ['nova', '„Walter.“ … Du warst dabei.'],
          ['nova', '„Pingo.“ … Opa.'],
          ['erzaehler', 'Der siebte Name ist durchgestrichen. So tief, als hätte jemand mit aller Kraft gekratzt. Man kann ihn trotzdem lesen: PAKO.'],
          ['nova', 'Wer ist Pako?'],
          ['walter', 'Frag. Deinen. Opa.']
        ],
        funk:{ r16:[['kiko', 'Schattenfische, ein ganzer Schwarm! Sie kommen von ganz unten!']] },
        nachher:[
          ['nova', 'Opa. Wer ist Pako?'],
          ['opa', '… Sprengt die Tunnel. Alle. Sofort.'],
          ['nova', 'Das ist keine Antwort!'],
          ['opa', 'Das ist ein Befehl.']
        ] }),
    L(2, 5, 'Sprengt die Tunnel!', 'labyrinth', 'mittel', { runden:30, startRunde:18, geld:5000, leben:50, flut:true, flutPause:2, thema:'daemmerung' }, [['leben', 0.2], ['ohneVerkauf']],
      'Keine Pausen! Halte die Fische auf, bis alle Sprengladungen sitzen. Nur 50 Leben.', {
        gerettet:6,
        vorher:[
          ['kiko', 'Die Sprengladungen brauchen Zeit! Ihr müsst die Fische aufhalten – und es gibt keine Pausen!'],
          ['walter', 'Er will die Wahrheit begraben. Unter tausend Tonnen Eis.'],
          ['nova', 'Und du hilfst ihm dabei?'],
          ['walter', 'Ich helfe dir, hier lebend rauszukommen. Das ist ein Unterschied.']
        ],
        funk:{ r24:[['kiko', 'Ladungen zur Hälfte gesetzt! Haltet durch!']], r29:[['kiko', 'Letzte Ladung! Alle raus da!']], knapp:[['walter', 'Rückt zusammen! Keiner kommt durch!']] },
        nachher:[
          ['erzaehler', 'Der Berg grollt. Dann stürzt der Tunnel in sich zusammen. Mit ihm die Wandbilder, die Liste und der Name.'],
          ['nova', 'Du kannst Eis sprengen, Opa. Aber nicht das, was ich gesehen habe.']
        ] }),
    L(2, 6, 'Der Hai-König', 'spalte', 'schwer', { runden:32, startRunde:18, geld:5000, bosse:{ 32:['haikoenig', 1] } }, [['leben', 0.1], ['ohneVerkauf']],
      'Start in Runde 18. In Runde 32 kommt der Hai-König und ruft ständig Fische herbei.', {
        gerettet:5, boss:'haikoenig',
        vorher:[
          ['kiko', 'Etwas Riesiges schwimmt durch die Spalte! Der Hai-König!'],
          ['walter', 'Er ruft die anderen Fische zu sich. Wie ein Hirte.'],
          ['nova', 'Oder wie ein Anführer, der sein Volk in Sicherheit bringen will.'],
          ['walter', '… Jetzt fängst du an zu verstehen.']
        ],
        funk:{ boss:[['kiko', 'Der Hai-König! Er ruft ständig neue Fische!']], phase2:[['nova', 'Er wird schwächer! Weiter!']] },
        nachher:[
          ['erzaehler', 'Der Hai-König sinkt. In seinem Maul: ein Stück Kristall, schwarz und gesprungen.'],
          ['nova', 'Ein Splitter vom Herzlicht?'],
          ['erzaehler', 'Am Fuß des Gletschers schlagen die Überlebenden ein Lager auf. Ein paar Zelte. Ein Feuer gegen die Kälte. Mia sammelt Treibholz.'],
          ['erzaehler', '🏘️ Freigeschaltet: dein Pingu-Dorf – vorerst nur ein Flüchtlingslager. Im Menü unter „Dorf“ kannst du es ausbauen. Es wächst mit der Geschichte.'],
          ['opa', 'Wir gehen zum Vulkan. Kapitän Frost wartet dort mit der Eiswache. Er ist der Beste, den wir haben.'],
          ['walter', 'Frost ist klug, Pingo. Zu klug, um keine Fragen zu stellen.']
        ] }),

    /* ===================== KAPITEL 3: FEUER UND VERRAT ===================== */
    L(3, 1, 'Am Erebus', 'erebus', 'mittel', { runden:32, startRunde:12, geld:3500 }, [['leben', 0.1], ['max', 10]],
      'Lavaspalten und wenig Platz. Start in Runde 12 mit 3.500 Geld.', {
        gerettet:4,
        vorher:[
          ['frost', 'Willkommen am Erebus. Die Eiswache hält den Krater seit drei Tagen.'],
          ['nova', 'Kapitän Frost! Ich hab so viel von Ihnen gehört.'],
          ['frost', 'Hoffentlich nur Gutes. Opa Pingo. Walter. Lange nicht gesehen.'],
          ['walter', 'Nicht lange genug.'],
          ['frost', 'Immer noch der Alte. Die Hitze des Vulkans hält die Fische auf Abstand. Noch.']
        ],
        funk:{ r20:[['frost', 'Die Eiswache steht hinter euch. Zeigt, was ihr könnt.']] },
        nachher:[
          ['frost', 'Gute Arbeit. Du hast Talent, Nova.'],
          ['frost', 'Sag mal … hat dein Opa dir je von der Expedition erzählt? Der vor fünfzig Jahren?'],
          ['nova', 'Woher wissen Sie davon?'],
          ['frost', 'Ich lese viel. Archive. Alte Logbücher. Man findet erstaunliche Dinge, wenn man nur sucht.']
        ] }),
    L(3, 2, 'Frosts Plan', 'doppel', 'mittel', { runden:32, startRunde:15, geld:4500, wegeAb:[1, 22] }, [['leben', 0.1], ['stufe', 3]],
      'Frost lässt den zweiten Kanal als Falle offen. In Runde 22 strömen die Fische hinein.', {
        gerettet:4,
        vorher:[
          ['frost', 'Mein Plan: Wir lassen den zweiten Kanal offen. Als Falle. Sie strömen hinein, und wir schlagen zu.'],
          ['walter', 'Oder sie strömen hinein, und WIR sind dran.'],
          ['frost', 'Vertrauen, Walter. Das hast du doch früher auch gekonnt. Vor fünfzig Jahren hast du Pingo blind vertraut, oder?'],
          ['walter', '…']
        ],
        funk:{ weg:[['frost', 'Jetzt! Der zweite Kanal ist offen! Zeigt ihnen, was die Eiswache kann!']] },
        nachher:[
          ['nova', 'Was meinte Frost damit? „Vor fünfzig Jahren hast du Pingo vertraut“?'],
          ['walter', 'Frost weiß es. Frost weiß alles. Und das macht mir mehr Angst als jeder Fisch da draußen.']
        ] }),
    L(3, 3, 'Verrat', 'erebus', 'schwer', { runden:34, startRunde:20, geld:7000, thema:'blut', zerstoeren:{ 26:3 } }, [['leben', 0.1], ['max', 12]],
      'Nacht am Erebus. Irgendetwas stimmt nicht mit Kapitän Frost …', {
        gerettet:2,
        vorher:[
          ['erzaehler', 'Nacht am Erebus. Der Himmel glüht rot.'],
          ['frost', 'Opa Pingo. Ich habe die Logbücher gelesen. Alle. Ich weiß, was ihr getan habt.'],
          ['opa', 'Frost. Nicht hier.'],
          ['frost', 'Doch. Genau hier! Ihr habt das Herzlicht aus der Tiefe gerissen. Ihr habt eine ganze Welt verdunkelt, damit Pinguinhausen es warm hat!'],
          ['frost', 'Die Fische sind keine Monster. Sie sind das, was übrig bleibt, wenn man jemandem das Licht stiehlt.'],
          ['nova', 'Kapitän … was haben Sie vor?'],
          ['frost', 'Das Richtige.']
        ],
        funk:{ sabotiert:[['kiko', 'Explosionen! Unsere Stellungen fliegen in die Luft!'], ['nova', 'Das war Frost! FROST!']], r28:[['frost', 'Es tut mir leid, Nova. Ehrlich.']] },
        nachher:[
          ['nova', 'Er hat uns verraten. Einfach so.'],
          ['walter', 'Nicht einfach so. Er hat sich entschieden. Und das Schlimmste ist: Vielleicht hat er recht.'],
          ['nova', 'Sag das nicht.'],
          ['walter', 'Ich sage, was wahr ist. Ich hab viel zu lange geschwiegen.']
        ] }),
    L(3, 4, 'Drei Seiten', 'dreizack', 'schwer', { runden:36, startRunde:22, geld:9000, thema:'blut', wegeAb:[1, 26, 30], bosse:{ 32:['haikoenig', 1], 36:['krakus', 1] } }, [['leben', 0.1], ['ohneFk']],
      'Frost kennt eure Schwachstellen: Die Kanäle öffnen sich nacheinander. Dann kommen der Hai-König und Krakus.', {
        gerettet:5,
        vorher:[
          ['kiko', 'Drei Kanäle! Frost verteilt die Fische auf alle drei! Er kennt unsere Schwachstellen!'],
          ['frost', 'Natürlich kenne ich sie. Ich habe sie gebaut.'],
          ['nova', 'Sie hören unseren Funk ab?!'],
          ['frost', 'Ich BIN euer Funk, Kind.']
        ],
        funk:{ weg:[['kiko', 'Der nächste Kanal ist offen! Sie kommen von der Seite!']], boss:[['frost', 'Die Könige der Tiefe kämpfen jetzt für mich. Und sie sind nicht allein.']] },
        nachher:[
          ['walter', 'Pingo. Wir müssen über die Brücke zurück. Sonst schneidet er uns ab.'],
          ['opa', 'Die Brücke hält nicht alle auf einmal.'],
          ['walter', 'Ich weiß.']
        ] }),
    L(3, 5, 'Die Brücke', 'kreuz', 'schwer', { runden:38, startRunde:24, geld:9000, thema:'blut', heldFaellt:34, bosse:{ 38:['kapitaen', 1] } }, [['leben', 0.1], ['ohneVerkauf']],
      'Walter ist dein Held. Pass gut auf ihn auf – solange du kannst. In Runde 38 kommt Kapitän Frost selbst.', {
        gerettet:3, held:'walter', boss:'kapitaen',
        vorher:[
          ['walter', 'Geht. Alle. Ich halte die Brücke.'],
          ['nova', 'Bist du verrückt? Allein?!'],
          ['walter', 'Ich bin alt, Nova. Ich hab genug gesehen. Lieber stehe ich hier, als noch fünfzig Jahre zu schweigen.'],
          ['opa', 'Walter …'],
          ['walter', 'Du hättest es ihr sagen sollen, Pingo. Damals schon. Sag es ihr, wenn ich nicht mehr da bin.']
        ],
        funk:{ r30:[['walter', 'Kommt nur. Ich hab Zeit.']], gefallen:[['walter', 'Nova … lauf …'], ['nova', 'WALTER! NEIN!']],
          r35:[['nova', 'Für Walter! Keiner kommt durch! KEINER!']], boss:[['frost', 'Ich wollte nicht, dass er stirbt. Ich wollte nur, dass ihr zuhört!']],
          phase2:[['frost', 'Ich friere eure besten Pinguine ein. Ich kenne jeden einzelnen!']] },
        nachher:[
          ['erzaehler', 'Wo Walter stand, steht jetzt ein Denkmal aus Eis. Niemand hat es gebaut. Das Eis ist einfach um ihn herum gefroren.'],
          ['nova', 'Du hast es gewusst, Opa. Die ganze Zeit. Und Walter ist dafür gestorben.'],
          ['opa', '…'],
          ['nova', 'SAG. ES. MIR.'],
          ['opa', 'Nicht hier. Erst müssen wir raus. Lebend.']
        ] }),
    L(3, 6, 'Flucht durch das Feuer', 'erebus', 'schwer', { runden:40, startRunde:28, geld:12000, leben:60, flut:true, flutPause:2, thema:'blut', zusatz:{ '30+':'4 verderbt 0.8 3' } }, [['leben', 0.2], ['max', 14]],
      'Der Vulkan bricht aus! Keine Pausen, nur 60 Leben – halte durch bis Runde 40.', {
        gerettet:8,
        vorher:[
          ['kiko', 'Der Vulkan bricht aus! Wir müssen durch den Krater fliehen – sofort!'],
          ['frost', 'Lauf, Pingo. Lauf, wie du damals gelaufen bist. Als du Pako zurückgelassen hast.'],
          ['nova', 'Pako …']
        ],
        funk:{ r33:[['kiko', 'Lava am Westufer! Weiter, weiter!']], r39:[['kiko', 'Fast draußen! Noch eine Welle!']], knapp:[['opa', 'Nicht stehen bleiben! Niemals stehen bleiben!']] },
        nachher:[
          ['erzaehler', 'Das Lager wird zur Zuflucht. Aus Zelten werden Hütten. Mia schläft jede Nacht mit Walters Helm im Arm.'],
          ['erzaehler', '🏘️ Dein Dorf wächst: Schmiede, Wachturm und Walters Denkmal kannst du jetzt bauen.']
        ] }),

    /* ===================== KAPITEL 4: DIE TIEFE ===================== */
    L(4, 1, 'Abstieg', 'inseln', 'schwer', { runden:40, startRunde:26, geld:10000, thema:'tiefsee', finsternis:{ alle:16, dauer:3 } }, [['leben', 0.1], ['stufe', 4]],
      'Je tiefer, desto dunkler. Immer wieder geht das Licht ganz aus.', {
        gerettet:3,
        vorher:[
          ['erzaehler', 'Sie tauchen hinab. Mit jedem Meter wird das Wasser kälter. Und dunkler. Und stiller.'],
          ['kiko', 'Funkverbindung wird schwächer … ich hör … euch kaum …'],
          ['nova', 'Kiko? KIKO!'],
          ['opa', 'Ab hier sind wir allein.']
        ],
        funk:{ dunkel:[['nova', 'Das Licht! Es geht einfach aus!']] },
        nachher:[
          ['nova', 'Hier unten war mal etwas. Häuser. Straßen. Aus Korallen.'],
          ['opa', 'Eine Stadt. Die schönste, die ich je gesehen habe.'],
          ['nova', 'Du warst schon mal hier.'],
          ['opa', 'Ja.']
        ] }),
    L(4, 2, 'Die sterbende Stadt', 'labyrinth', 'schwer', { runden:42, startRunde:28, geld:12000, thema:'tiefsee', reichweite:0.85, zusatz:{ '28+':'8 schatten 0.4 2' } }, [['leben', 0.1], ['max', 14]],
      'In der Tiefe sehen alle Pinguine weniger weit. Und die Schattenfische hören nicht auf.', {
        gerettet:6,
        vorher:[
          ['erzaehler', 'Die Korallenstadt ist grau. Tot. Fische liegen in ihren Häusern, als wären sie im Schlaf erfroren.'],
          ['nova', 'Das waren Familien. Kinder.'],
          ['opa', 'Fünfzig Jahre ohne Licht. Das ist, was übrig bleibt.'],
          ['nova', 'Das ist, was IHR übrig gelassen habt.']
        ],
        funk:{ r34:[['nova', 'Sie hören nicht auf! Wie viele leben hier unten noch?!']] },
        nachher:[
          ['nova', 'Ich will nicht mehr kämpfen, Opa. Nicht gegen die.'],
          ['opa', 'Dann kämpf für die, die oben auf dich warten. Für Mia.']
        ] }),
    L(4, 3, 'Kapitän Frost', 'eisbergring', 'schwer', { runden:44, startRunde:30, geld:18000, leben:150, thema:'tiefsee', bosse:{ 44:['kapitaen', 2] }, ersetzen:{ 44:'12 zebra 0.6 6|4 koffer 1.2 14' } }, [['leben', 0.1], ['ohneVerkauf']],
      'Frost stellt sich dir. Er friert deine teuersten Pinguine ein und hüllt Fische in Eispanzer. Eisbären lässt er in Ruhe.', {
        gerettet:2, boss:'kapitaen',
        vorher:[
          ['frost', 'Du bist weit gekommen, Nova. Weiter als dein Opa damals.'],
          ['nova', 'Sie haben Walter getötet!'],
          ['frost', 'Walter hat sich entschieden. Genau wie ich. Genau wie du jetzt.'],
          ['frost', 'Ich kenne jeden deiner Pinguine. Ich habe sie ausgebildet. Komm – zeig mir, dass Pinguinhausen es wert ist.']
        ],
        funk:{ boss:[['frost', 'Komm schon! Zeig mir, dass ihr es wert seid!']], phase1:[['frost', 'Eispanzer! Ihr kommt nicht durch!']], phase3:[['nova', 'Er wankt! Jetzt!']] },
        nachher:[
          ['erzaehler', 'Frost liegt im Sand. Sein Eispanzer ist zersprungen.'],
          ['frost', 'Mach schon. Bring es zu Ende.'],
          ['nova', 'Nein. Walter hätte das nicht gewollt.'],
          ['frost', '… Dann hör mir wenigstens zu. Das Herzlicht ist nicht IN Pinguinhausen, Nova. Es ist UNTER Pinguinhausen. Es hält euer Eis zusammen. Nimmst du es weg …'],
          ['nova', '… zerbricht alles.'],
          ['frost', 'Und lässt du es da, stirbt die Tiefe. Für immer. Das ist die Wahl. Das war immer die Wahl.']
        ] }),
    L(4, 4, 'Das Geständnis', 'nacht', 'schwer', { runden:45, startRunde:32, geld:15000, thema:'tiefsee', finsternis:{ alle:10, dauer:3.5 }, zusatz:{ '32+':'4 verderbt 0.6 2' } }, [['leben', 0.1], ['ohneFk']],
      'Alle zehn Sekunden wird es stockdunkel. Pinguine mit Nachtsicht sind jetzt Gold wert.', {
        gerettet:2,
        vorher:[
          ['opa', 'Nova. Setz dich.'],
          ['opa', 'Wir waren sieben. Junge Idioten, die die Welt retten wollten. Pinguinhausen erfror damals. Jeden Winter starben welche.'],
          ['opa', 'Dann fanden wir das Herzlicht. Hier unten. Es leuchtete wie eine zweite Sonne.'],
          ['opa', 'Wir haben es genommen. Pinguinhausen wurde warm. Und die Tiefe … wurde dunkel.'],
          ['nova', 'Und Pako?'],
          ['opa', 'Pako war mein Bruder.'],
          ['erzaehler', 'Stille.'],
          ['opa', 'Als wir flohen, stürzte der Tunnel ein. Pako war direkt hinter mir. Ich hätte umkehren können.'],
          ['opa', 'Ich bin nicht umgekehrt.']
        ],
        funk:{ r40:[['opa', 'Ich hab ihn jede Nacht gehört. Fünfzig Jahre lang. Jede einzelne Nacht.']], dunkel:[['nova', 'Dunkel! Nachtsicht nach vorn!']] },
        nachher:[
          ['nova', 'Du hast deinen eigenen Bruder zurückgelassen.'],
          ['opa', 'Ja.'],
          ['nova', 'Und dann hast du fünfzig Jahre lang so getan, als wärst du ein Held.'],
          ['opa', 'Nein. Ich habe fünfzig Jahre lang so getan, als wäre ich ein Opa. Das war schwerer.']
        ] }),
    L(4, 5, 'Kein Licht', 'tunnel', 'schwer', { runden:46, startRunde:34, geld:17000, thema:'tiefsee', reichweite:0.8, finsternis:{ alle:8, dauer:4 } }, [['leben', 0.1], ['max', 16]],
      'Fast völlige Dunkelheit: weniger Reichweite und alle acht Sekunden kein Licht. Baue Leuchtfeuer und Nachtsicht!', {
        gerettet:3,
        vorher:[
          ['erzaehler', 'Je tiefer sie kommen, desto dunkler wird es. Bald sieht man die eigene Flosse nicht mehr.'],
          ['nova', 'Ich seh nichts! Wie sollen wir so kämpfen?!'],
          ['opa', 'Mit Pinguinen, die im Dunkeln sehen. Mit Leuchtfeuern. Und mit Mut.']
        ],
        funk:{ dunkel:[['nova', 'Wieder dunkel! Haltet die Stellung!']], r42:[['abyssos', 'PINGO … ICH … RIECHE … DICH …']] },
        nachher:[
          ['erzaehler', 'Aus der Dunkelheit kommt eine Stimme. Tief, langsam, wie berstendes Eis.'],
          ['abyssos', 'Fünfzig Jahre, Pingo. Fünfzig Jahre habe ich im Dunkeln auf dich gewartet.'],
          ['opa', 'Er lebt.']
        ] }),
    L(4, 6, 'Der Leviathan', 'spalte', 'schwer', { runden:48, startRunde:36, geld:20000, thema:'tiefsee', bosse:{ 48:['leviathan', 1] } }, [['leben', 0.1], ['ohneVerkauf']],
      'Der Wächter der Tiefe: Sein Eisatem friert Pinguine ein. Eisbären mit dickem Fell halten das aus.', {
        gerettet:4, boss:'leviathan',
        vorher:[
          ['abyssos', 'Mein Wächter wird euch zeigen, was Kälte bedeutet.'],
          ['nova', 'Der Eis-Leviathan! Sein Atem friert alles ein!'],
          ['opa', 'Eisbären nach vorn! Ihr dickes Fell hält das aus!']
        ],
        funk:{ boss:[['abyssos', 'Friere, Pingo. Friere, wie ich gefroren habe.']], phase2:[['nova', 'Er bricht! Weiter!']] },
        nachher:[
          ['erzaehler', 'Der Leviathan zerfällt zu Schnee. Dahinter: ein Tor. Und hinter dem Tor: Licht. Ein schwaches, sterbendes Licht.'],
          ['nova', 'Das ist es. Der Thron von Abyssos.'],
          ['erzaehler', 'Oben in der Zuflucht bauen die Überlebenden Mauern aus Eis. Mia hat einen Wachturm gebaut. Er ist schief. Aber er steht.'],
          ['erzaehler', '🏘️ Dein Dorf wird zur Festung: Die Akademie ist frei, Gebäude gehen bis Stufe 4.']
        ] }),

    /* ===================== KAPITEL 5: DAS HERZLICHT ===================== */
    L(5, 1, 'Vor dem Thron', 'dreizack', 'schwer', { runden:48, startRunde:36, geld:22000, thema:'tiefsee', wegeAb:[1, 40, 44] }, [['leben', 0.1], ['stufe', 4]],
      'Abyssos schickt alles, was er hat: Die Kanäle öffnen sich in Runde 40 und 44.', {
        gerettet:3,
        vorher:[
          ['abyssos', 'Kommt näher. Ich will euch sehen. Ich will SEHEN, wofür er mich geopfert hat.'],
          ['nova', 'Drei Kanäle. Er schickt alles, was er hat.'],
          ['opa', 'Nicht alles. Noch nicht.']
        ],
        funk:{ weg:[['nova', 'Noch ein Kanal! Er kreist uns ein!']] },
        nachher:[
          ['nova', 'Opa. Wenn wir ihn besiegen – was dann?'],
          ['opa', 'Dann bringe ich zurück, was ich gestohlen habe.'],
          ['nova', 'Und Pinguinhausen?'],
          ['opa', 'Pinguinhausen hat fünfzig Jahre lang von geliehener Zeit gelebt.']
        ] }),
    L(5, 2, 'Die Wächter', 'eisbergring', 'schwer', { runden:50, startRunde:38, geld:25000, thema:'tiefsee', bosse:{ 50:['orka', 2] } }, [['leben', 0.1], ['ohneFk']],
      'Kaiser Orka, verdorben von der Dunkelheit. Seine Flutwellen betäuben Pinguine am Ufer.', {
        gerettet:4, boss:'orka',
        vorher:[
          ['abyssos', 'Kaiser Orka war einst der König der Meere. Jetzt ist er mein Hund. So weit hat uns eure Wärme gebracht.']
        ],
        funk:{ boss:[['nova', 'Seine Flutwellen! Haltet die Ufer!']], phase2:[['abyssos', 'Steh auf, Orka! STEH AUF!']] },
        nachher:[
          ['frost', '(über Funk, kaum zu hören) Nova. Hier ist Frost. Ich bin oben bei euren Leuten. Ich … helfe beim Evakuieren.'],
          ['nova', 'Sie? Warum?'],
          ['frost', 'Weil Walter es getan hätte.']
        ] }),
    L(5, 3, 'Pakos Erinnerung', 'nacht', 'schwer', { runden:50, startRunde:40, geld:26000, thema:'tiefsee', finsternis:{ alle:9, dauer:3 }, zusatz:{ '40+':'10 schatten 0.3 1|3 verderbt 0.8 4' } }, [['leben', 0.1], ['max', 16]],
      'Der Thronsaal. Schatten und Verderbte in jeder Welle, und immer wieder wird es dunkel.', {
        gerettet:2,
        vorher:[
          ['erzaehler', 'Die Wände des Thronsaals sind bemalt. Wie im Tunnel. Aber diese Bilder hat jemand anderes gemalt.'],
          ['erzaehler', 'Ein kleiner Pinguin, allein im Dunkeln. Ein Jahr. Zehn Jahre. Fünfzig. Mit jedem Bild wird er größer. Dunkler. Bis er kein Pinguin mehr ist.'],
          ['nova', 'Opa … das ist er.'],
          ['opa', 'Pako …']
        ],
        funk:{ r46:[['abyssos', 'Ich habe jeden Tag gezählt, Pingo. Jeden. Einzelnen. Tag.']], dunkel:[['abyssos', 'Wie gefällt euch MEINE Welt?']] },
        nachher:[
          ['abyssos', 'Komm zu mir, Bruder.'],
          ['opa', 'Ich komme.']
        ] }),
    L(5, 4, 'Abyssos', 'nacht', 'schwer', { runden:55, startRunde:44, geld:32000, thema:'tiefsee', bosse:{ 55:['abyssos', 2] }, zweitePhase:true }, [['leben', 0.1], ['ohneVerkauf']],
      'Der Endkampf. Abyssos kommt in Runde 55 – und wenn er fällt, ist es noch nicht vorbei.', {
        gerettet:5, boss:'abyssos',
        vorher:[
          ['erzaehler', 'Der Thronsaal. In der Mitte, an einer langen Angel, die Laterne von Abyssos. Sie flackert. Sie stirbt.'],
          ['abyssos', 'Ihr wärmt euch an meinem Licht – und nennt UNS Monster?'],
          ['nova', 'Wir wussten es nicht!'],
          ['abyssos', 'ER wusste es.'],
          ['opa', 'Ja. Ich wusste es. Kämpf gegen mich, Pako. Nicht gegen sie.'],
          ['abyssos', 'Oh, ich kämpfe gegen euch alle.']
        ],
        funk:{ r50:[['abyssos', 'Fünf Runden noch, Pingo. Dann komme ich.']], boss:[['abyssos', 'LICHT. AUS.']],
          phase2:[['abyssos', 'Spürst du das, Pingo? So fühlt sich Dunkelheit an!']],
          zweite:[['erzaehler', 'Die Maske zerbricht. Darunter: ein Pinguin. Uralt, verdreht, mit glühenden Augen.'], ['pako', 'DU … HAST … MICH … NICHT … MAL … GESUCHT!']],
          knapp:[['nova', 'Wir dürfen nicht verlieren! Nicht jetzt!']] },
        nachher:[
          ['erzaehler', 'Pako fällt. Die Dunkelheit fließt aus ihm heraus wie Tinte. Übrig bleibt ein alter, kleiner Pinguin.'],
          ['pako', 'Pingo …'],
          ['opa', 'Ich bin da, Pako. Ich bin da.'],
          ['pako', 'Du hast mich nicht mal gesucht.'],
          ['opa', 'Ich weiß. Ich weiß. Es tut mir so leid.'],
          ['pako', 'Es ist so … kalt …'],
          ['erzaehler', 'Pako schließt die Augen. Opa Pingo hält ihn, bis er nicht mehr atmet.'],
          ['opa', 'Nova. Hör mir zu. Ich bringe das Herzlicht zurück. Hierher, wo es hingehört.'],
          ['nova', 'Dann bricht das Eis! Pinguinhausen!'],
          ['opa', 'Dann bring sie raus. Alle. Du kannst das. Du konntest es schon immer.'],
          ['nova', 'Opa, nein—'],
          ['opa', 'Ich habe ihn einmal zurückgelassen. Nicht noch einmal.']
        ] }),
    L(5, 5, 'Der Zusammenbruch', 'scholle', 'schwer', { runden:32, startRunde:20, geld:15000, leben:80, thema:'blut', flut:true, flutPause:3, zusatz:{ '20+':'6 verderbt 0.5 2' },
      einsturz:[[320, 410, 72, 22], [720, 360, 72, 24], [510, 370, 66, 26], [120, 205, 56, 28], [935, 330, 70, 30], [520, 100, 58, 31]] },
    [['leben', 0.25], ['ohneFk']],
      'Pinguinhausen bricht auseinander. Halte bis Runde 32, bis das letzte Boot ablegt. Ganze Eisflächen brechen weg – achte auf die Warnungen!', {
        gerettet:40, finale:true,
        vorher:[
          ['erzaehler', 'Oben. Pinguinhausen. Das Eis singt. Ein tiefer, trauriger Ton, wie ein Abschied.'],
          ['kiko', 'Nova! Die Risse! Überall Risse! Pinguinhausen bricht auseinander!'],
          ['frost', 'Die Boote sind bereit. Aber die Fische drängen nach oben. Wir brauchen Zeit!'],
          ['nova', 'Dann holen wir uns Zeit. Alle an die Kanäle. Das ist unsere letzte Verteidigung.']
        ],
        funk:{ einsturz:[['kiko', 'Achtung! Das Eis dort bricht gleich weg! Holt eure Pinguine da raus!']], r24:[['frost', 'Die ersten Boote sind raus!']],
          r28:[['mia', 'Nova! Komm auch! Bitte komm auch!']], r31:[['kiko', 'Letztes Boot! JETZT!']], knapp:[['frost', 'Haltet durch! Nur noch ein paar Runden!']] },
        nachher:[] })
  ];
  PT.LEVEL = id => PT.LEVELS.find(l => l.id === id) || null;

  /* ---------- Ende und Abspann ---------- */
  PT.ENDE_SZENE = [
    ['erzaehler', 'Pinguinhausen versinkt.'],
    ['erzaehler', 'Erst die Häuser. Dann die Türme. Zuletzt der alte Leuchtturm, dessen Licht bis zum Schluss brennt.'],
    ['erzaehler', 'Tief unten in der Dunkelheit geht ein Licht an. Ein warmes, goldenes Licht. Die Tiefsee atmet wieder.'],
    ['erzaehler', 'Opa Pingo kommt nicht zurück.'],
    ['erzaehler', 'Auf einer Scholle treiben die Überlebenden durch die Nacht. Kiko. Frost, abseits, allein. Mia, mit Walters Helm. Und Nova.'],
    ['mia', 'Nova? Wo wohnen wir jetzt?'],
    ['nova', '…'],
    ['nova', 'Hier. Dann bauen wir eben neu.']
  ];
  PT.ABSPANN = [
    ['PINGUIN TÜRMCHEN', 'SCHWARZES EIS'],
    ['In Erinnerung an', 'Walter, der die Brücke hielt'],
    ['', 'Lio und alle von Posten 7'],
    ['', 'Opa Pingo, der zurückging'],
    ['', 'Pako, der fünfzig Jahre wartete'],
    ['Mit', 'Nova · Mia · Funker Kiko · Kapitän Frost'],
    ['Und dir', 'der kämpfte, als es dunkel wurde'],
    ['Dein Pingu-Dorf', 'Neu-Pinguinhausen ist bereit. Bau es auf.']
  ];
  PT.NACH_ABSPANN = [
    ['erzaehler', 'Tief unten. Dort, wo das Herzlicht wieder leuchtet.'],
    ['erzaehler', 'Im Licht bewegt sich etwas. Etwas Riesiges. Etwas, vor dem selbst Abyssos geflohen ist.'],
    ['erzaehler', 'Es öffnet ein Auge.'],
    ['fremd', 'Endlich … Licht.']
  ];

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
  PT.kapitelFertig = (nr, sterne) => PT.LEVELS.some(l => l.kapitel === nr) && PT.LEVELS.filter(l => l.kapitel === nr).every(l => PT.sternZahl((sterne || {})[l.id]) >= 1);
  PT.abenteuerFertig = (sterne, teil = 1) => PT.KAPITEL.filter(k => (k.teil || 1) === teil).every(k => PT.kapitelFertig(k.nr, sterne));
  // Alter Fortschritt aus der ersten Kampagne (k1-1 …): wird einmal gegen eine Entschädigung getauscht
  PT.alteSterne = sterne => Object.entries(sterne || {}).filter(([id]) => /^k\d-\d$/.test(id)).reduce((n, [, s]) => n + PT.sternZahl(s), 0);
  PT.STERN_XP = 60;
  PT.STERN_MUENZEN = 3;
  PT.STERN_KRISTALLE = 4;

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
