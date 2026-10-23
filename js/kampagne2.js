'use strict';
// Pinguin Türmchen – Abenteuer Teil 2 „Das erwachte Licht“: Prolog und fünf Kapitel, 30 Levels.
// Drei Jahre nach dem Untergang von Pinguinhausen. Gleicher Aufbau wie Teil 1 (kampagne.js), die Kapitel haben
// die Nummern 10–15 (angezeigt als Prolog, 1–5). Neu: Lichtstrahlen, Strömung, Spiegel, wechselnde Adern,
// verbündete Haie, Opas Tagebuch (eine Seite pro Level) und der Albtraum-Modus (siehe logik.js / oberflaeche.js).
(function (wurzel) {
  const PT = wurzel.PT || (wurzel.PT = {});

  Object.assign(PT.SPRECHER, {
    mia2:     { name:'Mia', farbe:'#ffb6d5', bild:{ look:'kommandantin' } },
    orka:     { name:'Kaiser Orka', farbe:'#8fb8ff', bild:{ fisch:'orka' } },
    kristall: { name:'Mutter der Kristalle', farbe:'#d8b0ff', bild:{ fisch:'kristallmutter' } },
    traeger:  { name:'Der Lichtträger', farbe:'#fff2c4', bild:{ fisch:'lichttraeger' } },
    uralter:  { name:'Der Uralte', farbe:'#ffd27a', bild:{ fisch:'uralter' } },
    tagebuch: { name:'Opas Tagebuch', farbe:'#e8d6a8', bild:{ look:'opa' } }
  });

  PT.KAPITEL.push(
    { nr:10, teil:2, anzeige:0, name:'Prolog: Drei Winter', kurz:'Prolog', symbol:'🕯️', kiste:'silber', stimmung:'herz',
      zitat:['Drei Winter lang war es still.', 'Dann kam das Licht.'] },
    { nr:11, teil:2, anzeige:1, name:'Die Lichtgeborenen', symbol:'✨', look:'lichtkind', kiste:'silber', stimmung:'licht',
      zitat:['„Sie sind wunderschön. Und sie wollen uns fressen.“', 'Mia'] },
    { nr:12, teil:2, anzeige:2, name:'Gegen den Strom', symbol:'🌀', look:'orcareiter', kiste:'gold', stimmung:'strom',
      zitat:['„Das Meer vergisst nicht. Aber manchmal vergibt es.“', 'Kaiser Orka'] },
    { nr:13, teil:2, anzeige:3, name:'Spiegel', symbol:'🪞', look:'spiegelpingu', kiste:'gold', stimmung:'spiegel',
      zitat:['„Jedes Licht wirft einen Schatten. Je heller, desto schwärzer.“', 'Kapitän Frost'] },
    { nr:14, teil:2, anzeige:4, name:'Der Lichtträger', symbol:'🌟', look:'lichttraeger', kiste:'gold', stimmung:'abschied',
      zitat:['„Ich bin nicht zurückgekommen, Nova. Ich bin nur nie ganz gegangen.“', '???'] },
    { nr:15, teil:2, anzeige:5, name:'Das erwachte Licht', symbol:'👁️', look:'uralt', kiste:'gold', stimmung:'organisch',
      zitat:['„Ein Licht, das alles frisst, ist auch nur eine Dunkelheit, die Hunger hat.“', 'Opa Pingo'] }
  );

  const L = (kapitel, nr, name, karte, stufe, regeln, sterne, text, extra = {}) => ({ id:`s${kapitel}-${nr}`, kapitel, nr, name, karte, stufe, regeln, sterne, text, ...extra });
  PT.LEVELS.push(
    /* ===================== PROLOG: DREI WINTER ===================== */
    L(10, 1, 'Das Fest des ersten Lichts', 'neuhausen', 'schwer', { runden:30, startRunde:20, geld:6500, thema:'daemmerung', zusatz:{ '24+':'8 licht 0.45 2' } }, [['leben', 0.1], ['max', 12]],
      'Neu: Lichtgeborene. Sie leuchten wunderschön – und zerfallen in schnelle Funken. Halte Neu-Pinguinhausen bis Runde 30.', {
        gerettet:6, neuFisch:'licht',
        vorher:[
          ['erzaehler', 'Drei Winter sind vergangen, seit Pinguinhausen im Meer versank.'],
          ['erzaehler', 'Auf der Scholle steht jetzt eine Stadt. Klein, schief, aus Treibholz und Eis. Sie heißt Neu-Pinguinhausen. Und heute feiert sie.'],
          ['mia2', 'Das Fest des ersten Lichts! Kiko, häng die Laternen höher, die Kleinen sollen sie vom Ufer aus sehen!'],
          ['kiko', 'Jawohl, Chefin.'],
          ['mia2', 'Ich bin nicht die Chefin. Nova ist die Chefin.'],
          ['nova', 'Nova steht hier und hört alles. Und Nova findet, du machst das sehr gut.'],
          ['erzaehler', 'Mia trägt Walters Helm. Er rutscht ihr nicht mehr über die Augen.'],
          ['kiko', 'Nova … da draußen im Wasser. Da leuchtet was. Ganz viele.'],
          ['mia2', 'Oh … die sind ja wunderschön. Sind die wegen dem Fest gekommen?'],
          ['nova', 'Mia. Geh von der Kante weg. Sofort.']
        ],
        funk:{ r22:[['kiko', 'Die Laternen! Sie schwimmen direkt auf die Laternen zu!']], r24:[['nova', 'Die leuchtenden! Sie zerplatzen in Funken – passt auf, die sind schnell!']],
          r28:[['mia2', 'Die schauen uns an. Nova, die SCHAUEN uns an.']], knapp:[['nova', 'Haltet die Stadt! Nicht noch einmal! Nie wieder!']] },
        nachher:[
          ['erzaehler', 'Als die letzte Welle zerfällt, treibt etwas im Wasser. Ein Blatt Papier. Es leuchtet schwach.'],
          ['mia2', 'Da steht was drauf. Das ist … Opas Schrift.'],
          ['nova', 'Das ist unmöglich.'],
          ['mia2', '„Wenn ihr das lest, ist es aufgewacht. Kommt nicht nach unten.“'],
          ['erzaehler', '📜 Neu: Opas Tagebuch. In jedem Level treibt irgendwann eine leuchtende Seite vorbei – klick sie an, bevor sie verschwindet!']
        ] }),

    /* ===================== KAPITEL 1: DIE LICHTGEBORENEN ===================== */
    L(11, 1, 'Wandernde Strahlen', 'kristallwald', 'schwer', { runden:32, startRunde:22, geld:7500, thema:'licht', licht:{ anzahl:2, breite:80, tempo:38 }, zusatz:{ '22+':'6 licht 0.5 1' } }, [['leben', 0.1], ['ohneVerkauf']],
      'Lichtstrahlen wandern über die Karte: Pinguine im Licht greifen schneller an – aber Fische im Licht schwimmen auch schneller.', {
        gerettet:3, neu:'kristall',
        vorher:[
          ['erzaehler', 'Nördlich der Stadt ist über Nacht ein Wald gewachsen. Ein Wald aus Kristall.'],
          ['frost', '(über Funk, rauschend) … hört mich jemand? Hier spricht Frost. Ich bin im Norden.'],
          ['nova', 'Frost?! Drei Jahre kein Wort, und jetzt—'],
          ['frost', 'Spar dir das. Die Kristalle wachsen aus dem Meer heraus. Sie bündeln das Licht. Wo die Strahlen hinfallen, werden die Fische rasend.'],
          ['kiko', 'Und unsere Pinguine auch, schau mal! Die schießen im Licht doppelt so schnell!'],
          ['frost', 'Dann nutzt es. Und betet, dass die Fische es nicht besser nutzen.'],
          ['erzaehler', '✨ Neu: Der Kristall-Pinguin. Seine Blitze springen von Fisch zu Fisch.']
        ],
        funk:{ r25:[['frost', 'Die Strahlen wandern! Stellt eure Pinguine dahin, wo sie gleich hinfallen!']], r30:[['kiko', 'Noch zwei Runden!']] },
        nachher:[
          ['nova', 'Frost. Wo bist du?'],
          ['frost', 'Weiter weg, als dir lieb ist. Lies die Seiten, Nova. Ich habe auch welche gefunden.'],
          ['erzaehler', 'Dann bricht die Verbindung ab.']
        ] }),
    L(11, 2, 'Funkenregen', 'neuhausen', 'schwer', { runden:33, startRunde:23, geld:8000, thema:'licht', zusatz:{ '23+':'20 funke 0.12 0|20 funke 0.12 6' } }, [['leben', 0.15], ['stufe', 4]],
      'Neu: Lichtfunken. Winzig, aber rasend schnell – und sie kommen in Schwärmen.', {
        gerettet:3, neuFisch:'funke',
        vorher:[
          ['kiko', 'Es regnet! Es regnet … Licht?!'],
          ['erzaehler', 'Über Neu-Pinguinhausen fallen tausend kleine Funken vom Himmel ins Meer. Und das Meer beginnt zu glühen.'],
          ['mia2', 'Die Kleinen sollen in die Hütten! Alle! Kiko, die Glocke!'],
          ['nova', 'Pinguine mit Streuschuss nach vorn. Einzeln trefft ihr die nie.']
        ],
        funk:{ r26:[['mia2', 'Sie fliegen über die Dächer! Nein – sie schwimmen! Sie sind überall!']], knapp:[['kiko', 'Die sind zu schnell für uns!']] },
        nachher:[
          ['mia2', 'Nova. Die Seite. Lies sie vor.'],
          ['nova', '„Pako hat es zuerst gesehen. Unter dem Herzlicht. Etwas, das schläft.“'],
          ['nova', 'Opa hat davon gewusst. Schon damals.']
        ] }),
    L(11, 3, 'Kristallkrebse', 'kristallwald', 'schwer', { runden:34, startRunde:24, geld:10500, thema:'licht', licht:{ anzahl:2, breite:70, tempo:45 }, zusatz:{ '26+':'3 kristallkrebs 2.5 3' } }, [['leben', 0.1], ['ohneFk']],
      'Neu: Kristallkrebse. Langsam, dick gepanzert gegen Spitzes – und alle paar Sekunden schützen sie alle Fische um sich herum.', {
        gerettet:3, neuFisch:'kristallkrebs',
        vorher:[
          ['erzaehler', 'Die Kristalle im Wald bewegen sich. Sie haben Beine.'],
          ['kiko', 'Das sind keine Kristalle. Das sind Krebse! Riesige Krebse aus Kristall!'],
          ['nova', 'Seht ihr das Leuchten? Wenn sie aufleuchten, prallt alles an den Fischen um sie herum ab.'],
          ['nova', 'Erst die Krebse. Dann den Rest.']
        ],
        funk:{ r26:[['kiko', 'Krebse im Kanal! Haut sie weg, bevor sie leuchten!']], r30:[['nova', 'Gut so! Weiter!']] },
        nachher:[
          ['erzaehler', 'Im Panzer eines zerbrochenen Krebses steckt etwas: ein kleiner, glühender Stein. Er pulsiert. Wie ein Herzschlag.'],
          ['nova', 'Das ist ein Stück vom Herzlicht.'],
          ['mia2', 'Aber Opa hat es doch zurückgebracht. Nach unten.'],
          ['nova', 'Eben.']
        ] }),
    L(11, 4, 'Die Stimme im Funk', 'bucht', 'schwer', { runden:35, startRunde:25, geld:10000, thema:'licht', finsternis:{ alle:11, dauer:3 }, zusatz:{ '25+':'6 licht 0.4 0|2 kristallkrebs 3 5' } }, [['leben', 0.1], ['max', 14]],
      'Licht und Dunkel wechseln sich ab: Immer wieder geht jedes Licht aus. Nachtsicht hilft.', {
        gerettet:2,
        vorher:[
          ['kiko', 'Nova … ich hab heute Nacht was im Funk gehört. Auf der alten Frequenz von Pinguinhausen.'],
          ['nova', 'Pinguinhausen gibt es nicht mehr, Kiko.'],
          ['kiko', 'Ich weiß. Hör trotzdem zu.'],
          ['fremd', '(rauschend) … No… va … nicht … runterkommen … es … hört … zu …'],
          ['nova', '…'],
          ['mia2', 'Das war Opa. Nova, das war OPA!']
        ],
        funk:{ dunkel:[['fremd', '… es … frisst … das Licht …']], r30:[['fremd', '… Nova … bitte …']], r34:[['nova', 'Opa? OPA! Antworte mir!']] },
        nachher:[
          ['nova', 'Er lebt. Irgendwo da unten lebt er.'],
          ['frost', '(über Funk) Oder etwas, das so klingt wie er.'],
          ['nova', 'Ich gehe runter.'],
          ['mia2', 'Dann komme ich mit.'],
          ['nova', 'Nein. Du bleibst. Jemand muss die Stadt halten.']
        ] }),
    L(11, 5, 'Die Lichtwand', 'leuchtturm', 'schwer', { runden:36, startRunde:26, geld:11000, thema:'licht', licht:{ anzahl:3, breite:90, tempo:55 }, zusatz:{ '26+':'10 licht 0.35 0|8 funke 0.2 4' } }, [['leben', 0.1], ['stufe', 4]],
      'Drei Lichtstrahlen, schneller als zuvor. Der alte Leuchtturm wird zur Falle – oder zur Waffe.', {
        gerettet:3,
        vorher:[
          ['erzaehler', 'Das Wrack des alten Leuchtturms ragt noch aus dem Wasser. Er brennt wieder. Niemand hat ihn angezündet.'],
          ['kiko', 'Der Leuchtturm zieht sie an. Die Lichtgeborenen kommen von überall her.'],
          ['nova', 'Dann soll er sie anziehen. Wir warten auf sie.']
        ],
        funk:{ r28:[['nova', 'Folgt den Strahlen! Im Licht seid ihr schneller!']], r33:[['kiko', 'Da hinten … etwas Großes. Es singt.']] },
        nachher:[
          ['erzaehler', 'Unter dem Leuchtturm, im glühenden Wasser, öffnet sich ein Riss. Daraus steigt ein Gesang. Hoch, klar, unerträglich schön.'],
          ['kristall', 'Kleine warme Dinger. Ihr habt Licht in euch. Gebt es mir.']
        ] }),
    L(11, 6, 'Mutter der Kristalle', 'kristallwald', 'schwer', { runden:38, startRunde:28, geld:15500, thema:'licht', licht:{ anzahl:2, breite:80, tempo:42 }, bosse:{ 38:['kristallmutter', 1] } }, [['leben', 0.1], ['ohneVerkauf']],
      'Boss: Die Mutter der Kristalle. Sie ruft Lichtgeborene und hüllt alles um sich in einen Schutzschild aus Kristall.', {
        gerettet:5, boss:'kristallmutter',
        vorher:[
          ['erzaehler', 'Aus dem Riss steigt ein Wesen aus Kristall. Groß wie ein Eisberg. In ihm pulsiert ein Licht.'],
          ['kristall', 'Der Alte Hunger ist wach. Er schickt seine Kinder hinauf, um alles Licht zu holen. Ich bin die erste.'],
          ['nova', 'Wer ist „der Alte Hunger“?'],
          ['kristall', 'Er war hier, bevor das Eis kam. Er wird hier sein, wenn das Eis geht. Ihr nennt ihn nicht. Ihr fürchtet ihn.'],
          ['nova', 'Wir fürchten gar nichts mehr.']
        ],
        funk:{ boss:[['kristall', 'Kommt, kleine Lichter. Kommt zu Mutter.']], phase1:[['nova', 'Ihr Schild! Wartet, bis er bricht!']], phase2:[['kristall', 'Ihr seid … heller, als ich dachte …']] },
        nachher:[
          ['erzaehler', 'Die Mutter der Kristalle zerspringt in tausend Splitter. Für einen Moment ist es ganz still.'],
          ['kristall', '(verhallend) Er wird … euch alle … essen … zuerst … den … mit … dem … Herz …'],
          ['mia2', 'Den mit dem Herz? Was meint sie?'],
          ['nova', 'Opa.'],
          ['erzaehler', '🏘️ Gerettete aus dem Kristallwald ziehen in dein Dorf.']
        ] }),

    /* ===================== KAPITEL 2: GEGEN DEN STROM ===================== */
    L(12, 1, 'Der Strudel', 'strudel', 'schwer', { runden:38, startRunde:28, geld:13000, thema:'tiefsee', zusatz:{ '28+':'8 licht 0.35 0' } }, [['leben', 0.1], ['max', 14]],
      'Strömung: Im Strudel schwimmen die Fische auf einem Abschnitt viel schneller. Bau davor und dahinter!', {
        gerettet:2, neu:'orca',
        vorher:[
          ['erzaehler', 'Der Weg nach unten führt durch den Großen Strudel. Ein Schlund aus Wasser, der alles verschlingt.'],
          ['nova', 'Kiko, wie tief geht der?'],
          ['kiko', 'Mein Lot ist nach dreihundert Metern gerissen.'],
          ['nova', 'Dann gehen wir tiefer als dreihundert Meter.'],
          ['erzaehler', '✨ Neu: Der Orca-Reiter. Er sitzt im Wasser, schickt Wellen und Torpedos.']
        ],
        funk:{ r30:[['kiko', 'Die Strömung reißt sie mit! In der Mitte sind sie doppelt so schnell!']], r35:[['nova', 'Haltet die Ausfahrt aus dem Strudel!']] },
        nachher:[
          ['erzaehler', 'Am Rand des Strudels treibt ein Schiff. Halb versunken, das Eisen von Muscheln überwachsen.'],
          ['kiko', 'Das ist … die Eiserne Möwe. Frosts altes Schiff.']
        ] }),
    L(12, 2, 'Die Eiserne Möwe', 'wrack', 'schwer', { runden:39, startRunde:29, geld:18000, leben:150, thema:'tiefsee', wegeAb:[1, 33, 36], zusatz:{ '29+':'6 licht 0.4 0|2 kristallkrebs 3 4' } }, [['leben', 0.1], ['ohneFk']],
      'Ein Wrack mit drei Kanälen. In Runde 33 und 36 brechen sie von der Seite herein.', {
        gerettet:4,
        vorher:[
          ['frost', 'Ihr habt euch Zeit gelassen.'],
          ['erzaehler', 'Kapitän Frost steht auf dem Deck des Wracks. Hagerer als früher. Eine Narbe quer über dem Schnabel.'],
          ['nova', 'Drei Jahre, Frost. Drei Jahre ohne ein Wort.'],
          ['frost', 'Ich habe Walters Brücke verraten. Und Pakos Leben verschwendet. Ich wollte nicht, dass du mich ansehen musst.'],
          ['frost', 'Aber ich habe gesucht. Und ich habe ihn gefunden. Den Weg nach unten. Er führt direkt durch dieses Schiff.'],
          ['nova', 'Dann verteidigen wir dein Schiff.']
        ],
        funk:{ weg:[['frost', 'Backbord! Sie kommen durch das Leck an Backbord!']], r37:[['frost', 'Gut. Walter hätte euch gemocht.']] },
        nachher:[
          ['frost', 'Ich gehe mit euch nach unten.'],
          ['nova', 'Warum sollte ich dir trauen?'],
          ['frost', 'Gar nicht. Aber du brauchst jemanden, der den Weg kennt. Und ich brauche … eine zweite Chance.']
        ] }),
    L(12, 3, 'Ein alter Feind', 'strudel', 'schwer', { runden:40, startRunde:30, geld:15000, thema:'tiefsee', verbuendete:{ alle:9, schaden:4, riesen:40, ladung:18 }, zusatz:{ '30+':'10 licht 0.3 0|3 kristallkrebs 2.4 3' } }, [['leben', 0.1], ['max', 14]],
      'Neu: Verbündete! Kaiser Orkas Haie schwimmen gegen den Strom durch den Kanal und rammen alles, was ihnen begegnet.', {
        gerettet:3,
        vorher:[
          ['erzaehler', 'Etwas Riesiges taucht neben dem Wrack auf. Schwarz und weiß. Mit einer Narbe, die Nova kennt. Sie hat sie geschlagen.'],
          ['nova', 'Kaiser Orka. Wir haben dich besiegt. Damals im Thronsaal.'],
          ['orka', 'Ihr habt mich befreit. Abyssos hatte mich an der Leine. Ihr habt sie durchgeschnitten.'],
          ['orka', 'Das Meer vergisst nicht, kleine Pinguinin. Aber manchmal vergibt es.'],
          ['orka', 'Der Hunger frisst auch uns. Meine Haie kämpfen an eurer Seite – wenn ihr uns lasst.'],
          ['nova', 'Fische und Pinguine. Zusammen.'],
          ['frost', 'Walter hat immer gesagt, dass es so kommen würde.']
        ],
        funk:{ r31:[['orka', 'Meine Haie kommen! Lasst sie durch!']], r36:[['kiko', 'Die Haie räumen den Kanal auf! Wahnsinn!']], knapp:[['orka', 'Haltet durch, Kleine!']] },
        nachher:[
          ['orka', 'Ihr kämpft gut. Für so kleine Dinger.'],
          ['nova', 'Wir hatten viel Übung.']
        ] }),
    L(12, 4, 'Tiefer', 'tunnel', 'schwer', { runden:41, startRunde:31, geld:21500, thema:'tiefsee', finsternis:{ alle:10, dauer:3.5 }, licht:{ anzahl:1, breite:110, tempo:30 }, zusatz:{ '31+':'8 licht 0.35 0|4 spiegelfisch 1 3' } }, [['leben', 0.1], ['stufe', 4]],
      'Unter dem Strudel: Es ist stockdunkel – bis auf einen einzigen, wandernden Lichtstrahl. Neu: Spiegelfische werfen Geschosse zurück.', {
        gerettet:2, neuFisch:'spiegelfisch',
        vorher:[
          ['erzaehler', 'Unter dem Strudel ist es still. So still, dass man das eigene Herz hört.'],
          ['frost', 'Hier unten hat Abyssos fünfzig Jahre lang gewartet. Jetzt wartet hier etwas anderes.'],
          ['kiko', 'Fische mit Schuppen wie Spiegel! Die werfen unsere Schüsse zurück!'],
          ['nova', 'Dann schießt öfter.']
        ],
        funk:{ dunkel:[['frost', 'Bleibt im Lichtstrahl! Da seid ihr stark!']], r38:[['nova', 'Da vorne. Licht. Viel Licht.']] },
        nachher:[
          ['erzaehler', 'Vor ihnen öffnet sich eine Höhle. In ihrer Mitte: ein See, glatt wie ein Spiegel. Darin spiegelt sich ein Himmel, den es hier unten nicht geben kann.']
        ] }),
    L(12, 5, 'Bündnis', 'eisbergring', 'schwer', { runden:42, startRunde:32, geld:17000, thema:'tiefsee', verbuendete:{ alle:7, schaden:5, riesen:50, ladung:22 }, licht:{ anzahl:2, breite:80, tempo:40 }, zusatz:{ '32+':'10 licht 0.3 0|4 kristallkrebs 2 2' } }, [['leben', 0.1], ['ohneVerkauf']],
      'Haie und Pinguine Seite an Seite: Die Verbündeten kommen öfter, die Lichtstrahlen auch.', {
        gerettet:4,
        vorher:[
          ['orka', 'Die Kinder des Hungers haben mein Rudel eingekreist. Dort, am Eisbergring.'],
          ['nova', 'Dann holen wir sie raus.'],
          ['orka', 'Warum? Vor drei Jahren hättet ihr uns alle getötet.'],
          ['nova', 'Vor drei Jahren wusste ich nicht, wer der Feind ist.']
        ],
        funk:{ r34:[['orka', 'Mein Rudel! Sie leben noch!']], r40:[['frost', 'Nur noch zwei Runden!']] },
        nachher:[
          ['orka', 'Das werde ich euch nicht vergessen. Kein Fisch im Meer wird das vergessen.'],
          ['orka', 'Aber hört mich an: Ganz unten wartet einer, der leuchtet wie eine Sonne. Er trägt das Licht des Hungers. Und er spricht mit eurer Stimme.']
        ] }),
    L(12, 6, 'Der Leviathan im Licht', 'strudel', 'schwer', { runden:44, startRunde:33, geld:23000, thema:'licht', verbuendete:{ alle:10, schaden:5, riesen:60, ladung:20 }, bosse:{ 44:['leviathan', 2] } }, [['leben', 0.1], ['ohneFk']],
      'Boss: Der Eis-Leviathan, wiedererweckt vom Licht. Sein Eisatem friert Pinguine ein – Orkas Haie helfen dir.', {
        gerettet:5, boss:'leviathan',
        vorher:[
          ['erzaehler', 'Aus dem Strudel steigt ein Leib aus Eis. Sie haben ihn schon einmal besiegt. Jetzt glühen seine Augen golden.'],
          ['frost', 'Der Leviathan. Sie haben ihn wieder zusammengesetzt.'],
          ['orka', 'Er war mein Bruder, bevor Abyssos ihn nahm. Jetzt nimmt ihn der Hunger. Erlöst ihn.']
        ],
        funk:{ boss:[['orka', 'Rudel! ANGRIFF!']], phase1:[['nova', 'Eisatem! Eisbären nach vorn!']], phase2:[['frost', 'Er wird langsamer! Weiter!']] },
        nachher:[
          ['erzaehler', 'Der Leviathan zerfällt. Das goldene Licht fließt aus ihm heraus und sinkt nach unten, in die Tiefe. Als würde es nach Hause gerufen.'],
          ['orka', 'Danke. Mein Bruder schläft jetzt.'],
          ['frost', 'Nova. Der See. Wir müssen über den See.']
        ] }),

    /* ===================== KAPITEL 3: SPIEGEL ===================== */
    L(13, 1, 'Der Spiegelsee', 'spiegelsee', 'schwer', { runden:44, startRunde:34, geld:27000, thema:'licht', spiegel:0.25, zusatz:{ '34+':'6 spiegelfisch 0.8 0' } }, [['leben', 0.1], ['max', 15]],
      'Zwei Kanäle, die sich spiegeln: Was auf der einen Seite platzt, taucht manchmal auf der anderen wieder auf.', {
        gerettet:2,
        vorher:[
          ['erzaehler', 'Der Spiegelsee. Zwei Ufer, zwei Kanäle. Und im Wasser schwimmt jeder Fisch zweimal.'],
          ['kiko', 'Ich seh … uns. Im Wasser. Aber wir sehen anders aus.'],
          ['erzaehler', 'Im Spiegel steht eine Nova, die nicht lächelt. Neben ihr steht niemand.'],
          ['frost', 'Nicht hinsehen. Der See zeigt, was man am meisten fürchtet.']
        ],
        funk:{ r36:[['kiko', 'Die Fische kommen auf der anderen Seite wieder raus!']], r40:[['nova', 'Beide Ufer! Haltet beide Ufer!']] },
        nachher:[
          ['nova', 'Frost. Was hast du gesehen? Im Spiegel?'],
          ['frost', 'Walter. Auf der Brücke. Wie er mich ansieht.'],
          ['frost', 'Und du?'],
          ['nova', 'Mich. Allein. Ganz unten.']
        ] }),
    L(13, 2, 'Zwei Ufer', 'doppel', 'schwer', { runden:45, startRunde:35, geld:28500, thema:'licht', spiegel:0.35, licht:{ anzahl:2, breite:70, tempo:50 }, zusatz:{ '35+':'8 spiegelfisch 0.6 0|2 kristallkrebs 3 6' } }, [['leben', 0.1], ['ohneFk']],
      'Spiegel und Licht zugleich. Verteil deine Pinguine gut auf beide Kanäle.', {
        gerettet:3,
        vorher:[
          ['mia2', '(über Funk) Nova? Nova, hörst du mich? Hier oben ist was los!'],
          ['nova', 'Mia! Was ist passiert?'],
          ['mia2', 'Die Lichtgeborenen. Sie kommen jetzt jeden Abend. Wir halten sie auf. Aber es werden mehr.'],
          ['nova', 'Halte durch. Ich bin bald zurück.'],
          ['mia2', 'Das hat Opa auch gesagt.']
        ],
        funk:{ r38:[['frost', 'Sie spiegeln sich! Achtet auf beide Seiten!']], r43:[['mia2', '(über Funk) Wir halten! Wir halten noch!']] },
        nachher:[
          ['nova', 'Sie hat recht. Das hat Opa auch gesagt.'],
          ['frost', 'Und er hat es gemeint. Genau wie du.']
        ] }),
    L(13, 3, 'Mias Nacht', 'neuhausen', 'schwer', { runden:46, startRunde:36, geld:27000, leben:60, thema:'nacht', held:'nova', heldFaellt:38, zusatz:{ '36+':'12 licht 0.3 0|10 funke 0.15 3' } }, [['leben', 0.2], ['max', 15]],
      'Oben in Neu-Pinguinhausen: Mia hält die Stadt. Nova kommt zu Hilfe – aber nicht lange. Nur 60 Leben.', {
        gerettet:6,
        vorher:[
          ['erzaehler', 'Neu-Pinguinhausen. Es ist Nacht. Am Ufer steht Mia. Hinter ihr die ganze Stadt.'],
          ['mia2', 'Alle Kleinen in die Hütten. Alle Großen an die Kanäle.'],
          ['kiko', 'Mia … das sind hunderte.'],
          ['mia2', 'Walter hat die Brücke gehalten. Mit einem Helm und einem Stock. Wir haben mehr als das.'],
          ['nova', '(über Funk) Ich bin durch den Strudel zurück! Ich bin gleich bei dir! Ich kann nicht lange bleiben!']
        ],
        funk:{ r37:[['nova', 'Mia! Du machst das großartig!']], gefallen:[['nova', 'Ich muss zurück nach unten – Frost braucht mich! Mia, du hast das Kommando!'], ['mia2', 'Ich … ja. Ja! Ich hab das Kommando!']],
          r42:[['mia2', 'Haltet die Linie! Für Walter! Für Opa!']], knapp:[['mia2', 'Nicht aufgeben! Nicht jetzt!']] },
        heldText:['🌊 Nova muss zurück nach unten', 'Mia hat jetzt das Kommando – deine Pinguine kämpfen eine Weile wütend weiter!'],
        nachher:[
          ['erzaehler', 'Am Morgen steht Neu-Pinguinhausen noch. Mia sitzt auf den Stufen der Räucherei, den Helm in den Flossen.'],
          ['kiko', 'Du warst unglaublich.'],
          ['mia2', 'Ich hatte solche Angst.'],
          ['kiko', 'Walter auch. Jedes Mal. Das hat er mir mal erzählt.']
        ] }),
    L(13, 4, 'Das Echo', 'labyrinth', 'schwer', { runden:47, startRunde:37, geld:23000, thema:'licht', finsternis:{ alle:9, dauer:3 }, zusatz:{ '37+':'8 spiegelfisch 0.5 0|10 licht 0.3 2' } }, [['leben', 0.1], ['stufe', 4]],
      'Ein Labyrinth aus Spiegeln. Licht, Finsternis, Spiegelfische – alles auf einmal.', {
        gerettet:3,
        vorher:[
          ['erzaehler', 'Hinter dem Spiegelsee: ein Labyrinth aus glatten Kristallwänden. Jede Stimme kommt dreimal zurück.'],
          ['fremd', '… Nova … Nova … Nova …'],
          ['nova', 'Opa?!'],
          ['frost', 'Das ist ein Echo. Es macht deine Stimme nach. Oder seine.'],
          ['fremd', '… ich bin … hier … ganz … nah …']
        ],
        funk:{ dunkel:[['fremd', '… kommt … nicht … näher …']], r42:[['fremd', '… es … sieht … euch …']], r45:[['frost', 'Da vorne ist es hell. Zu hell.']] },
        nachher:[
          ['erzaehler', 'Am Ende des Labyrinths steht eine Gestalt in einem Mantel aus Licht. Sie dreht sich langsam um.'],
          ['erzaehler', 'Sie hat Opa Pingos Gesicht. Aber ihre Augen sind weiß. Ganz weiß.']
        ] }),
    L(13, 5, 'Der Fremde im Licht', 'kristallwald', 'schwer', { runden:48, startRunde:38, geld:31000, thema:'licht', licht:{ anzahl:4, breite:70, tempo:60 }, zusatz:{ '38+':'12 licht 0.28 0|3 kristallkrebs 2.2 4' } }, [['leben', 0.1], ['ohneVerkauf']],
      'Vier Lichtstrahlen jagen über die Karte. Der Lichtträger beobachtet dich.', {
        gerettet:3,
        vorher:[
          ['nova', 'Opa …'],
          ['traeger', 'Nova. Du bist groß geworden.'],
          ['nova', 'Du lebst! Du lebst! Komm mit uns nach oben, Mia wartet, alle warten—'],
          ['traeger', 'Ich kann nicht. Ich trage sein Licht. Wo ich hingehe, geht er hin.'],
          ['traeger', 'Kehr um, Nova. Bitte. Ich kann ihn nicht mehr lange zurückhalten.'],
          ['erzaehler', 'Hinter ihm wird das Licht heller. Und aus dem Licht kommen sie.']
        ],
        funk:{ r40:[['traeger', 'Kehr um!']], r44:[['traeger', 'Er zwingt mich … Nova, lauf …']], knapp:[['frost', 'Weg da! Er ist nicht mehr er selbst!']] },
        nachher:[
          ['traeger', 'Es tut mir leid. Es tut mir so leid.'],
          ['erzaehler', 'Er hebt die Flosse. Das Licht folgt ihr wie ein Hund seinem Herrn.']
        ] }),
    L(13, 6, 'Lichtträger', 'spiegelsee', 'schwer', { runden:50, startRunde:40, geld:36500, thema:'licht', spiegel:0.25, bosse:{ 50:['lichttraeger', 1] } }, [['leben', 0.1], ['ohneFk']],
      'Boss: Der Lichtträger. Er blendet deine Pinguine – geblendet greift niemand an.', {
        gerettet:4, boss:'lichttraeger',
        vorher:[
          ['traeger', 'Er hat mich gefragt, warum ich dich verschonen will. Ich hatte keine Antwort, die er versteht.'],
          ['nova', 'Kämpf dagegen an! Du hast fünfzig Jahre gegen deine Schuld gekämpft! Das hier schaffst du auch!'],
          ['traeger', 'Das ist der Unterschied, Nova. Gegen die Schuld konnte ich gewinnen. Gegen IHN nicht.'],
          ['frost', 'Nova. Er greift an.']
        ],
        funk:{ boss:[['traeger', 'Schließt die Augen, Kinder.']], phase1:[['frost', 'Er blendet sie! Verteilt euch!']], phase2:[['traeger', 'Nova … hör nicht auf …']] },
        nachher:[
          ['erzaehler', 'Der Lichtträger sinkt auf die Knie. Das Licht um ihn flackert – dann zieht es sich zurück wie Ebbe, nach unten, in die Tiefe. Und reißt ihn mit.'],
          ['nova', 'OPA!'],
          ['traeger', '(verhallend) … im … Herzen … ganz … unten …'],
          ['frost', 'Nova. Hör mir zu. Wir gehen zusammen runter. Ich lasse dich nicht allein. Das schwöre ich bei Walters Brücke.'],
          ['erzaehler', '🎖️ Kapitän Frost kämpft jetzt an deiner Seite: Er ist als Held frei – mit seiner Meisterkraft „Eisherrschaft“.']
        ] }),

    /* ===================== KAPITEL 4: DER LICHTTRÄGER ===================== */
    L(14, 1, 'Was die Sieben fanden', 'erebus', 'schwer', { runden:50, startRunde:40, geld:27000, thema:'tiefsee', licht:{ anzahl:2, breite:80, tempo:40 }, zusatz:{ '40+':'12 licht 0.3 0|4 spiegelfisch 0.8 3' } }, [['leben', 0.1], ['max', 16]],
      'Die Höhle der Sieben: Hier fanden Opa und seine Freunde vor fünfzig Jahren das Herzlicht.', {
        gerettet:2,
        vorher:[
          ['erzaehler', 'Eine Höhle aus schwarzem Stein. An den Wänden: sieben Namen, mit Flossen ins Eis geritzt.'],
          ['frost', 'Pingo. Pako. Walter. Ilse. Bruno. Tjark. Selma.'],
          ['nova', 'Walter war einer von ihnen?!'],
          ['frost', 'Natürlich. Was glaubst du, warum er immer wusste, wovor die Fische fliehen?'],
          ['erzaehler', 'Unter den Namen hat jemand ein Bild gemalt. Ein Herz aus Licht. Und darum, riesig, ein geschlossenes Auge.']
        ],
        funk:{ r44:[['frost', 'Haltet sie von der Wand fern! Das hier ist alles, was von ihnen bleibt!']], r48:[['nova', 'Fast geschafft!']] },
        nachher:[
          ['nova', 'Sie haben es gewusst. Alle sieben. Dass das Herzlicht IHN schlafen lässt.'],
          ['frost', 'Nein. Sie haben es zu spät gewusst. Darum haben sie es genommen. Um ihn auszuhungern.'],
          ['nova', 'Und Opa hat es zurückgebracht.'],
          ['frost', 'Und ihn damit gefüttert.']
        ] }),
    L(14, 2, 'Hunger', 'tunnel', 'schwer', { runden:51, startRunde:41, geld:38000, thema:'tiefsee', licht:{ anzahl:2, breite:90, tempo:35 }, finsternis:{ alle:9, dauer:3.5 }, zusatz:{ '41+':'14 licht 0.25 0|3 kristallkrebs 2 5' } }, [['leben', 0.1], ['stufe', 4]],
      'Licht und Finsternis im Wechsel – der Uralte atmet. Jeder Atemzug löscht das Licht.', {
        gerettet:3,
        vorher:[
          ['erzaehler', 'Der Tunnel bebt. Rhythmisch. Wie ein Atem.'],
          ['kiko', '(über Funk, kaum zu verstehen) … Nova … oben … der Himmel … er wird dunkler … die Sonne …'],
          ['nova', 'Was ist mit der Sonne, Kiko?!'],
          ['kiko', '… als würde etwas … sie trinken …'],
          ['frost', 'Er frisst nicht nur das Licht hier unten. Er frisst ALLES Licht.']
        ],
        funk:{ dunkel:[['frost', 'Er atmet ein! Haltet durch!']], r46:[['nova', 'Wir müssen schneller sein!']] },
        nachher:[
          ['nova', 'Wenn er die Sonne frisst … dann wird es oben für immer Winter. Für immer Nacht.'],
          ['frost', 'Dann sterben alle. Fische, Pinguine, alles.']
        ] }),
    L(14, 3, 'Orkas Opfer', 'strudel', 'schwer', { runden:52, startRunde:42, geld:39000, thema:'tiefsee', verbuendete:{ alle:6, schaden:6, riesen:70, ladung:26 }, zusatz:{ '42+':'14 licht 0.25 0|6 spiegelfisch 0.7 2' } }, [['leben', 0.1], ['ohneVerkauf']],
      'Kaiser Orka und sein ganzes Rudel stellen sich dem Hunger entgegen. Seine Haie kommen jetzt sehr oft.', {
        gerettet:4,
        vorher:[
          ['orka', 'Die Kinder des Hungers kommen von allen Seiten. Ihr kommt nicht durch, nicht so.'],
          ['orka', 'Mein Rudel öffnet euch den Weg. Wir schwimmen voraus.'],
          ['nova', 'Das schafft ihr nicht alle.'],
          ['orka', 'Nein. Aber das Meer vergisst nicht, kleine Pinguinin. Erinnere dich an uns.']
        ],
        funk:{ r44:[['orka', 'RUDEL! FÜR DAS MEER!']], r48:[['orka', 'Sie … sind … zu viele … schwimmt … weiter …']], r51:[['nova', 'Orka?! ORKA!']] },
        nachher:[
          ['erzaehler', 'Der Weg ist frei. Im Wasser treiben Lichtgeborene, erloschen, grau. Und dazwischen: ein schwarz-weißer Riese, ganz still.'],
          ['nova', 'Er hat uns vergeben. Und wir haben ihn nicht einmal retten können.'],
          ['frost', 'Er wollte nicht gerettet werden. Er wollte, dass wir ankommen.']
        ] }),
    L(14, 4, 'Novas Wahl', 'dreizack', 'schwer', { runden:47, startRunde:37, geld:23000, leben:150, thema:'licht', wegeAb:[1, 41, 44], licht:{ anzahl:3, breite:70, tempo:55 }, zusatz:{ '37+':'14 licht 0.25 0|4 kristallkrebs 1.6 4' } }, [['leben', 0.1], ['ohneFk']],
      'Drei Wege nach unten. In Runde 41 und 44 öffnen sich die anderen beiden.', {
        gerettet:3,
        vorher:[
          ['frost', 'Drei Gänge. Einer führt zu ihm. Die anderen beiden führen zurück nach oben.'],
          ['frost', 'Du kannst noch umkehren, Nova. Zu Mia. Zur Stadt. Niemand würde es dir vorwerfen.'],
          ['nova', 'Opa ist auch nicht umgekehrt. Damals, mit dem Herzlicht.'],
          ['frost', 'Opa ist DAMALS umgekehrt. Bei Pako. Und hat es fünfzig Jahre bereut.'],
          ['nova', 'Eben. Ich kehre nicht um.']
        ],
        funk:{ weg:[['frost', 'Sie kommen aus allen drei Gängen!']], r46:[['nova', 'Opa, ich komme!']] },
        nachher:[
          ['erzaehler', 'Am Ende des mittleren Gangs: ein Thron. Nicht aus Stein. Aus Licht. Und darauf sitzt er.']
        ] }),
    L(14, 5, 'Lichtsturm', 'kristallwald', 'schwer', { runden:54, startRunde:44, geld:43000, thema:'licht', licht:{ anzahl:5, breite:60, tempo:75 }, zusatz:{ '44+':'16 licht 0.22 0|20 funke 0.1 3|4 kristallkrebs 1.6 6' } }, [['leben', 0.1], ['stufe', 4]],
      'Ein Sturm aus Licht: fünf rasende Strahlen. Wo du stehst, entscheidet alles.', {
        gerettet:3,
        vorher:[
          ['traeger', 'Ihr hättet nicht kommen sollen.'],
          ['erzaehler', 'Der Lichtträger erhebt sich. Um ihn herum tobt ein Sturm aus Licht.'],
          ['traeger', 'Er hat mir verboten, zu sprechen. Also höre ich auf zu sprechen.'],
          ['frost', 'Nova – ich glaube, das ist das Letzte, was er selbst gesagt hat.']
        ],
        funk:{ r46:[['nova', 'Folgt den Strahlen! Schneller!']], r50:[['frost', 'Er bereitet sich vor. Gleich ist er dran.']], knapp:[['nova', 'Nicht aufgeben!']] },
        nachher:[
          ['erzaehler', 'Der Sturm legt sich. Der Lichtträger steht reglos auf seinem Thron. Er wartet.'],
          ['nova', 'Frost. Wenn ich ihn nicht zurückholen kann …'],
          ['frost', 'Dann holst du ihn zurück. Basta.']
        ] }),
    L(14, 6, 'Opa', 'thron', 'schwer', { runden:56, startRunde:45, geld:48500, thema:'licht', licht:{ anzahl:3, breite:80, tempo:45 }, bosse:{ 56:['lichttraeger', 2] }, zusatz:{ '45+':'10 licht 0.3 0' } }, [['leben', 0.1], ['ohneVerkauf']],
      'Boss: Der Lichtträger, mit aller Macht des Uralten. Er blendet öfter und stärker. Bring Opa nach Hause.', {
        gerettet:5, boss:'lichttraeger',
        vorher:[
          ['nova', 'Opa. Ich bin es. Nova.'],
          ['erzaehler', 'Keine Antwort. Nur Licht.'],
          ['nova', 'Weißt du noch, als ich klein war? Du hast mir jeden Abend erzählt, dass die Fische nur fliehen. Dass niemand böse ist. Nur verzweifelt.'],
          ['nova', 'Ich glaub dir das immer noch.'],
          ['traeger', '…'],
          ['traeger', 'NOVA. LAUF.']
        ],
        funk:{ boss:[['traeger', 'Ich kann ihn nicht aufhalten! Ihr müsst mich aufhalten!']], phase1:[['frost', 'Er blendet alles! Haltet durch!']],
          phase2:[['traeger', 'Weiter … Nova … du schaffst das …']], phase3:[['nova', 'Komm zurück, Opa! KOMM ZURÜCK!']], knapp:[['frost', 'Nicht jetzt aufgeben!']] },
        nachher:[
          ['erzaehler', 'Das Licht bricht. Wie Glas. Darunter liegt ein alter Pinguin, ganz klein, ganz grau.'],
          ['opa', 'Nova …'],
          ['nova', 'Ich bin da. Ich bin da, Opa.'],
          ['opa', 'Du bist … nicht umgekehrt.'],
          ['nova', 'Nein.'],
          ['opa', 'Gut. Dann hör zu. Wir dachten damals, das Herzlicht hält ihn im Schlaf. Das war falsch. Das Herzlicht IST sein Herz.'],
          ['opa', 'Solange es in ihm schlägt, frisst er. Jemand muss es herausholen. Und es halten. Ganz unten, wo es dunkel ist, für immer.'],
          ['nova', 'Dann mache ich das.'],
          ['opa', 'Nein. Ich. Ich habe ihn geweckt. Ich—'],
          ['erzaehler', 'Opa Pingo versucht aufzustehen. Er schafft es nicht. Das Licht hat zu viel von ihm genommen.'],
          ['opa', 'Pako … wartet auf mich, glaube ich. Ich soll nicht wieder zu spät kommen.'],
          ['nova', 'Opa …'],
          ['opa', 'Du warst immer die Mutigste von uns, Nova. Mutiger als die Sieben.'],
          ['erzaehler', 'Opa Pingo schließt die Augen. Diesmal ist es ganz still um ihn. Kein Licht. Kein Hunger. Nur Ruhe.']
        ] }),

    /* ===================== KAPITEL 5: DAS ERWACHTE LICHT ===================== */
    L(15, 1, 'Der Schlund', 'eingeweide', 'schwer', { runden:48, startRunde:38, geld:25000, leben:150, thema:'organisch', wegRotation:true, zusatz:{ '38+':'14 licht 0.25 0|4 kristallkrebs 1.8 3' } }, [['leben', 0.1], ['max', 16]],
      'Im Inneren des Uralten: Drei Adern, aber jede Runde ruht eine davon – die Fische drängen sich in den anderen beiden.', {
        gerettet:2,
        vorher:[
          ['erzaehler', 'Hinter dem Thron öffnet sich ein Schlund. Die Wände sind warm. Sie bewegen sich.'],
          ['kiko', '(über Funk) Nova … wo seid ihr?'],
          ['nova', 'Kiko. Wir sind … in ihm drin.'],
          ['frost', 'Drei Adern. Er pumpt seine Kinder durch zwei davon, eine ruht. Jede Runde eine andere. Achtet darauf, welche gerade still ist.']
        ],
        funk:{ r39:[['frost', 'Die Ader wechselt! Jede Runde ruht eine andere!']], r45:[['nova', 'Es wird heißer. Wir sind nah am Herz.']] },
        nachher:[
          ['erzaehler', 'Es wird hell. Nicht warm-hell wie die Sonne. Weiß. Hungrig.']
        ] }),
    L(15, 2, 'Im Bauch des Hungers', 'eingeweide', 'schwer', { runden:49, startRunde:39, geld:26500, leben:150, thema:'organisch', wegRotation:true, finsternis:{ alle:10, dauer:3 }, zusatz:{ '39+':'16 licht 0.22 0|6 spiegelfisch 0.6 3' } }, [['leben', 0.1], ['ohneFk']],
      'Die Adern wechseln, und jedes Mal, wenn der Uralte einatmet, erlischt jedes Licht.', {
        gerettet:3,
        vorher:[
          ['mia2', '(über Funk) Nova. Hier oben … die Sonne ist nur noch ein Streifen. Es schneit im Sommer.'],
          ['mia2', 'Die Kleinen fragen, ob es je wieder hell wird.'],
          ['nova', 'Sag ihnen ja.'],
          ['mia2', 'Versprichst du es?'],
          ['nova', 'Ich verspreche es.']
        ],
        funk:{ dunkel:[['frost', 'Er atmet! Haltet die Ader!']], r44:[['mia2', '(über Funk) Wir zünden alle Feuer an. Damit ihr wisst, wo oben ist.']] },
        nachher:[
          ['frost', 'Nova. Was du Mia versprochen hast …'],
          ['nova', 'Ich weiß, was ich versprochen habe.'],
          ['frost', 'Ich meine: Du hast nicht versprochen, dass DU zurückkommst.'],
          ['nova', 'Nein. Hab ich nicht.']
        ] }),
    L(15, 3, 'Herzschlag', 'eingeweide', 'schwer', { runden:50, startRunde:40, geld:28000, leben:150, thema:'organisch', wegRotation:true, flut:true, flutPause:2, zusatz:{ '40+':'12 licht 0.25 0|3 kristallkrebs 2 4' } }, [['leben', 0.1], ['stufe', 4]],
      'Der Uralte spürt euch. Sein Herz rast: kaum Pausen zwischen den Runden.', {
        gerettet:3,
        vorher:[
          ['erzaehler', 'Ein Schlag. Noch einer. Der ganze Boden zittert. Das Herz des Uralten.'],
          ['uralter', 'KLEINE … WARME … DINGE.'],
          ['uralter', 'IHR … HABT … MIR … MEIN … HERZ … GESTOHLEN. FÜNFZIG … JAHRE … HUNGER.'],
          ['uralter', 'JETZT … ESSE … ICH.'],
          ['frost', 'Er hat gemerkt, dass wir hier sind. Jetzt wird es schnell.']
        ],
        funk:{ r42:[['uralter', 'ICH … SCHMECKE … EUCH.']], r47:[['frost', 'Gleich sind wir am Herz!']], knapp:[['nova', 'Weiter! Weiter!']] },
        nachher:[
          ['erzaehler', 'Vor ihnen schlägt es. Ein Herz, groß wie ein Berg. Und in seiner Mitte, ganz klein, ganz golden: das Herzlicht.'],
          ['uralter', 'KOMMT … NÄHER.']
        ] }),
    L(15, 4, 'Der Uralte', 'thron', 'schwer', { runden:60, startRunde:49, geld:57500, thema:'organisch', licht:{ anzahl:2, breite:90, tempo:40 }, bosse:{ 60:['uralter', 2] }, zweitePhase:true, zusatz:{ '49+':'10 licht 0.3 0' } }, [['leben', 0.1], ['ohneVerkauf']],
      'Der Endkampf. Der Uralte kommt in Runde 60 – und wenn er fällt, schlägt sein Herz weiter.', {
        gerettet:6, boss:'uralter', zweiteText:['💛 Das Herz des Uralten', 'Sein Herz reißt sich los – und schlägt weiter!'],
        vorher:[
          ['erzaehler', 'Der Thron aus Licht zerbricht. Darunter: ein Auge. Dann ein zweites. Dann tausend.'],
          ['uralter', 'ICH … WAR … HIER … BEVOR … DAS … EIS … KAM.'],
          ['uralter', 'ICH … WERDE … HIER … SEIN … WENN … ES … GEHT.'],
          ['nova', 'Nein. Wirst du nicht.'],
          ['frost', 'Für Walter.'],
          ['nova', 'Für Opa. Für Pako. Für Orka. Für alle.']
        ],
        funk:{ r55:[['uralter', 'FÜNF … RUNDEN … DANN … ESSE … ICH … EURE … SONNE.']], boss:[['uralter', 'LICHT. IST. MEIN.']],
          phase1:[['frost', 'Er blendet alles! Verteilt euch!']], phase2:[['nova', 'Er wankt! Er wankt!']],
          zweite:[['erzaehler', 'Der Uralte bricht zusammen – aber aus ihm reißt sich sein Herz los. Es schlägt. Und es schwimmt.'], ['uralter', 'ICH … BIN … DAS … HERZ.']],
          knapp:[['frost', 'Haltet! Nur noch ein bisschen!']] },
        nachher:[
          ['erzaehler', 'Das Herz zerspringt. Die tausend Augen schließen sich. Der Uralte ist tot.'],
          ['erzaehler', 'In den Splittern liegt das Herzlicht. Es flackert. Es zittert. Ohne Herz, das es hält, wird es gleich zerbrechen.'],
          ['frost', 'Wenn es zerbricht …'],
          ['nova', '… wird die Tiefe wieder dunkel. Für immer. Und Abyssos war erst der Anfang.'],
          ['erzaehler', 'Nova nimmt das Herzlicht in ihre Flossen. Es ist warm. Es ist schwer wie die ganze Welt.'],
          ['nova', 'Opa hat gesagt: Jemand muss es halten. Ganz unten. Für immer.'],
          ['frost', 'Nova. Nicht.'],
          ['nova', 'Bring sie raus, Frost. Alle. Und sag Mia …'],
          ['nova', 'Sag Mia, ich hab mein Versprechen gehalten.']
        ] }),
    L(15, 5, 'Novas Licht', 'neuhausen', 'schwer', { runden:40, startRunde:26, geld:22000, leben:90, thema:'licht', held:'nova', heldFaellt:32, licht:{ anzahl:3, breite:80, tempo:45 }, zusatz:{ '26+':'10 licht 0.3 1|6 spiegelfisch 0.6 3' },
      einsturz:[[300, 420, 70, 30], [700, 360, 70, 33], [520, 120, 60, 36]] },
    [['leben', 0.25], ['ohneFk']],
      'Die letzten Kinder des Hungers greifen Neu-Pinguinhausen an. Nova kämpft ein letztes Mal mit euch – dann geht sie. Halte bis Runde 40.', {
        gerettet:50, finale:true,
        heldText:['💛 Nova geht', 'Sie trägt das Herzlicht nach unten. Mia hat das Kommando – deine Pinguine kämpfen weiter, für sie!'],
        vorher:[
          ['erzaehler', 'Neu-Pinguinhausen. Der Himmel ist schwarz. Am Horizont steigt ein letzter Schwarm Lichtgeborener aus dem Meer.'],
          ['mia2', 'Nova! Du bist zurück! Du bist—'],
          ['erzaehler', 'Nova lächelt. In ihren Flossen leuchtet es golden.'],
          ['nova', 'Nur kurz, Mia. Nur noch dieser eine Kampf.'],
          ['mia2', 'Was heißt „nur kurz“?'],
          ['nova', 'Kämpf mit mir. Dann erklär ich es dir.']
        ],
        funk:{ r28:[['nova', 'Mia! Weißt du noch, das Floß? Wie klein du warst?']], r31:[['nova', 'Es ist Zeit, Mia. Ich muss runter.'], ['mia2', 'Nein! NEIN! Du hast es versprochen!']],
          gefallen:[['nova', 'Ich habe versprochen, dass es wieder hell wird. Das halte ich.'], ['mia2', 'Nova … NOVA!']],
          r34:[['frost', 'Mia. Sie hat dir das Kommando gegeben. Nimm es.']], r37:[['mia2', 'Für Nova. Haltet die Stadt. FÜR NOVA!']],
          einsturz:[['kiko', 'Das Eis bricht da hinten! Holt die Pinguine weg!']], knapp:[['mia2', 'Nicht aufgeben! Sie hat auch nicht aufgegeben!']] },
        nachher:[] })
  );

  /* ---------- Opas Tagebuch: eine Seite pro Level in Teil 2 ---------- */
  PT.TAGEBUCH = {
    's10-1':['Wenn ihr das lest', 'Wenn ihr das lest, ist es aufgewacht. Kommt nicht nach unten. Ich weiß nicht, wie diese Seiten nach oben finden. Vielleicht trägt das Licht sie. Vielleicht will es, dass ihr kommt.'],
    's11-1':['Sieben', 'Wir waren sieben. Pako, ich, Walter, Ilse, Bruno, Tjark und Selma. Pinguinhausen erfror jeden Winter ein Stück mehr. Wir schworen, nicht ohne Wärme zurückzukommen.'],
    's11-2':['Das Leuchten', 'Am dritten Tag sah Pako es zuerst. Ein Licht unter dem Eis, so hell, dass unsere Schatten nach oben fielen. Er sagte: „Pingo, da unten schläft etwas.“ Ich habe gelacht.'],
    's11-3':['Das Herz', 'Das Herzlicht lag in einer Höhle aus schwarzem Stein. Es schlug. Wie ein Herz. Selma wollte umkehren. Ich habe sie überredet. Ich war immer gut im Überreden.'],
    's11-4':['Die Stimme', 'Als wir es nahmen, hörten wir eine Stimme. Kein Wort, nur ein Laut. Walter hat später gesagt, es klang wie ein Kind, dem man das Essen wegnimmt. Wir sind gerannt.'],
    's11-5':['Der Tunnel', 'Ich höre den Tunnel einstürzen, jede Nacht. Ich höre Pako rufen. Wir waren sieben. Wir kamen zu sechst zurück. Und wir haben Pinguinhausen gewärmt und nie wieder darüber gesprochen.'],
    's11-6':['Ilse', 'Ilse ist im Frühling gestorben. Sie war die Erste von uns. Am Ende hat sie gesagt: „Es schläft nur, Pingo. Es schläft nur, solange es Hunger hat.“ Ich habe nicht verstanden, was sie meinte.'],
    's12-1':['Walter', 'Walter will den Fischen helfen. Er sagt, sie fliehen vor der Dunkelheit, die wir gemacht haben. Er hat recht. Ich habe ihm verboten, es jemandem zu erzählen. Er hat es trotzdem allen erzählt. Niemand hat ihm geglaubt.'],
    's12-2':['Frost', 'Der junge Frost war heute bei mir. Er will wissen, woher die Wärme kommt. Er hat Augen wie Selma. Ich habe ihm nichts gesagt. Ich fürchte, er wird es selbst herausfinden.'],
    's12-3':['Die Fische', 'Ein Orka hat heute das Ufer gerammt, bis sein Kopf blutete. Alle sagten, er sei verrückt. Ich glaube, er wollte uns etwas sagen. Ich glaube, er wollte uns sagen: Gebt es zurück.'],
    's12-4':['Nova', 'Meine Enkelin ist heute geboren. Sie hat nicht geweint. Sie hat sich umgesehen, als wollte sie wissen, wo der Feind ist. Ich habe sie Nova genannt. Neues Licht.'],
    's12-5':['Die Wahrheit', 'Bruno und Tjark sind tot. Selma ist weggezogen. Nur Walter und ich sind noch übrig. Er sieht mich jeden Tag an, als würde er auf etwas warten. Ich weiß, worauf. Auf die Wahrheit.'],
    's12-6':['Zurück', '(Diese Seite ist neu. Die Schrift zittert.) Ich habe das Herzlicht zurückgebracht. Pako ist in meinen Armen gestorben. Ich dachte, jetzt ist es vorbei. Dann hat sich unter mir etwas bewegt.'],
    's13-1':['Das Auge', 'Es hat ein Auge geöffnet. Nur eines. Es ist so groß, dass ich darin stehen könnte. Es hat mich angesehen, und ich habe verstanden: Wir haben ihn damals nicht ausgehungert. Wir haben ihn nur warten lassen.'],
    's13-2':['Im Licht', 'Es hat mich nicht gefressen. Es hat mich behalten. Ich bin im Licht, und das Licht ist in mir. Ich höre, was es denkt. Es denkt nur ein einziges Wort. Immer wieder. Mehr.'],
    's13-3':['Für Mia', 'Wenn Mia das hier liest: Du hast Walters Helm. Das heißt, du hast auch seinen Mut. Er hat ihn nämlich in dem Helm gelassen, als er ihn abgenommen hat. Das hat er mir mal gesagt. Ich glaube, er hat nicht gelogen.'],
    's13-4':['Das Echo', 'Ich versuche, mit euch zu sprechen. Aber es hört zu. Jedes Wort, das ich sage, sagt es mit. Darum sage ich wenig. Darum sage ich: Kehrt um.'],
    's13-5':['Der Mantel', 'Es hat mir einen Mantel aus Licht gegeben. Damit ich sein Bote bin. Der Lichtträger. Ich soll das Licht von oben holen. Eure Feuer. Eure Laternen. Eure Sonne.'],
    's13-6':['Verzeih mir', 'Ich habe meine Enkelin angegriffen. Ich konnte nicht aufhören. Ich habe zugesehen, wie meine Flossen sich bewegten, wie die eines Fremden. Nova, wenn du das liest: Das war nicht ich. Und doch war ich es.'],
    's14-1':['Die Namen', 'Wir haben unsere Namen in die Wand geritzt, damals, bevor wir das Herzlicht nahmen. Pako hat noch gesagt: „Damit jemand weiß, dass wir hier waren.“ Jetzt weißt du es.'],
    's14-2':['Hunger', 'Er war einmal ein Fisch. Vor unendlich langer Zeit. Er hat Licht gegessen, um nicht zu frieren. Dann wollte er mehr. Und mehr. Bis er so groß war, dass ihm niemand mehr etwas abgeben konnte. Hunger, der nie satt wird, wird irgendwann zu einem Gott.'],
    's14-3':['Orka', 'Der Orka von damals hatte Junge. Einer von ihnen ist Kaiser Orka. Er hat es nie vergessen. Aber er hat uns vergeben, sagen die Fische. Ich wüsste gern, wie das geht. Vergeben.'],
    's14-4':['Umkehren', 'Ich bin damals bei Pako nicht umgekehrt. Seitdem habe ich mir jeden Tag gewünscht, ich wäre es. Und jetzt bitte ich dich, umzukehren. Ich weiß, wie das klingt.'],
    's14-5':['Der Sturm', 'Wenn der Sturm kommt, bin ich ganz weg. Dann ist nur noch er da. Wenn ich nicht mehr spreche, Nova, dann sprich du. Sprich mit mir. Irgendwo bin ich noch.'],
    's14-6':['Das Letzte', 'Das ist meine letzte Seite. Das Herzlicht ist sein Herz. Wer es hält, hält ihn im Schlaf – aber nicht, wenn er es stiehlt. Nur, wenn er es freiwillig hält. Das haben wir nie verstanden. Darum hat es nie funktioniert.'],
    's15-1':['(eine fremde Schrift)', 'Hier schreibt Kapitän Frost. Novas Großvater ist tot. Ich habe sein Tagebuch weitergeführt, weil Nova es nicht kann. Wir sind im Uralten. Es ist warm hier drin. Ich hasse Wärme.'],
    's15-2':['Frost', 'Nova schläft nicht. Sie sitzt da und hält ein Stück Kristall in den Flossen und sieht es an. Ich weiß, was sie vorhat. Walter hätte es gewusst. Walter hätte sie aufgehalten. Ich weiß nicht, wie.'],
    's15-3':['Frost', 'Ich war ein Verräter. Dann ein Kapitän ohne Schiff. Jetzt bin ich nur noch einer, der hinter einer jungen Pinguinin herläuft, die mutiger ist als ich. Das ist gar nicht so schlecht, merke ich.'],
    's15-4':['Frost', 'Der Uralte ist tot. Nova hat das Herzlicht genommen. Sie hat gelächelt. Ich habe einmal gesehen, wie Opa Pingo genauso gelächelt hat. Kurz bevor er zurück nach unten ging.'],
    's15-5':['Mia', 'Hier schreibt Mia. Es ist wieder hell. Nova hat es versprochen. Manchmal, nachts, wenn man ganz still ist, leuchtet das Meer unter der Stadt. Ganz warm. Ganz golden. Dann weiß ich, dass sie da ist.']
  };
  // In welcher Runde die Seite vorbeitreibt: etwa in der Mitte des Levels
  PT.tagebuchRunde = l => Math.round(((l.regeln.startRunde || 1) + l.regeln.runden) / 2);

  /* ---------- Ende und Abspann von Teil 2 ---------- */
  const ENDE2 = [
    ['erzaehler', 'Die letzte Welle zerfällt zu Funken. Dann zu Nichts.'],
    ['erzaehler', 'Tief unten, unter Neu-Pinguinhausen, sinkt ein goldenes Licht in die Dunkelheit. Es wird kleiner. Und kleiner.'],
    ['erzaehler', 'Dann bleibt es stehen. Und leuchtet.'],
    ['erzaehler', 'Am nächsten Morgen geht die Sonne auf. Zum ersten Mal seit Wochen. Die Kleinen rennen ans Ufer und schreien vor Freude.'],
    ['frost', 'Sie hat es gehalten. Sie hält es immer noch.'],
    ['kiko', 'Mia? Die anderen warten. Sie wollen wissen, was jetzt passiert.'],
    ['erzaehler', 'Mia setzt Walters Helm auf. Er passt.'],
    ['mia2', 'Jetzt? Jetzt bauen wir weiter. Und jeden Abend zünden wir ein Licht an. Damit sie weiß, wo oben ist.']
  ];
  const ABSPANN2 = [
    ['PINGUIN TÜRMCHEN', 'DAS ERWACHTE LICHT'],
    ['In Erinnerung an', 'Opa Pingo, der endlich zur Ruhe kam'],
    ['', 'Kaiser Orka und sein Rudel'],
    ['', 'Ilse · Bruno · Tjark · Selma · Walter · Pako'],
    ['Für', 'Nova, die das Licht hält'],
    ['Mit', 'Mia · Funker Kiko · Kapitän Frost'],
    ['Und dir', 'der nicht umgekehrt ist'],
    ['Neu-Pinguinhausen', 'Mia hat jetzt das Kommando.']
  ];
  const NACH2 = [
    ['erzaehler', 'Ganz unten. Im goldenen Licht sitzt eine Pinguinin. Sie hält etwas Warmes in den Flossen.'],
    ['erzaehler', 'Sie ist nicht allein. Neben ihr sitzen zwei alte Pinguine. Brüder. Sie lachen über etwas, das fünfzig Jahre her ist.'],
    ['erzaehler', 'Weit, weit weg, jenseits der Tiefe, schlägt etwas. Einmal. Dann noch einmal.'],
    ['fremd', 'Es gab nicht nur einen.']
  ];

  /* ---------- Die Teile des Abenteuers ---------- */
  PT.TEILE = [
    { nr:1, name:'Schwarzes Eis', symbol:'🌑', kapitel:[0, 1, 2, 3, 4, 5], ende:PT.ENDE_SZENE, abspann:PT.ABSPANN, nachAbspann:PT.NACH_ABSPANN,
      schluss:{ kapitel:'Pinguin Türmchen', titel:'Fortsetzung folgt …', zitat:['Teil 2: Das erwachte Licht', ''] },
      endeTitel:'Das Ende von Pinguinhausen', endeText:'Pinguinhausen ist versunken. Aber ihr lebt – und ihr baut neu. Dein Pingu-Dorf „Neu-Pinguinhausen“ wartet auf dich. Und Teil 2 auch …',
      endeStimmung:'herz', nachStimmung:'tiefe', finaleSymbol:'💔', looks:['held', 'opa'] },
    { nr:2, name:'Das erwachte Licht', symbol:'✨', kapitel:[10, 11, 12, 13, 14, 15], ende:ENDE2, abspann:ABSPANN2, nachAbspann:NACH2,
      schluss:{ kapitel:'Pinguin Türmchen', titel:'Fortsetzung folgt …', zitat:['„Es gab nicht nur einen.“', ''] },
      endeTitel:'Novas Licht', endeText:'Die Sonne scheint wieder über Neu-Pinguinhausen. Nova hält das Herzlicht – ganz unten, für immer. Und Mia hat das Kommando.',
      endeStimmung:'abschied', nachStimmung:'licht', finaleSymbol:'💛', looks:['hueterin', 'kommandantin'] }
  ];
  PT.TEIL_VON_KAPITEL = nr => PT.TEILE.find(t => t.kapitel.includes(nr)) || PT.TEILE[0];
  PT.teilVon = l => PT.TEIL_VON_KAPITEL(l.kapitel);
  // Ein Teil ist frei, wenn der vorige ganz geschafft ist
  PT.teilFrei = (nr, sterne) => nr === 1 || PT.abenteuerFertig(sterne, nr - 1);

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
