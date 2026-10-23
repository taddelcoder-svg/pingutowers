'use strict';
// Pinguin Türmchen – Fortschritt über viele Spiele: Erfolge, Pinguin-Wissen (dauerhafte Boni für Fischmünzen),
// Tagesaufträge für den Pinguin-Pass und die tägliche Herausforderung. Nur Regeln; gespeichert wird im Browser.
(function (wurzel) {
  const PT = wurzel.PT || (wurzel.PT = {});

  // kleiner Zufall aus einem Text (Datum), damit alle am selben Tag dasselbe bekommen
  function zufallAus(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
    return () => {
      h = (h + 0x6D2B79F5) >>> 0;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  PT.zufallAus = zufallAus;
  const wahl = (z, liste) => liste[Math.floor(z() * liste.length)];
  // Datum als Text JJJJ-MM-TT in Ortszeit
  PT.heute = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  /* ---------- Erfolge ----------
     k: { spiel, gewonnen, ende, lebenslang:{ platzer, tage, siege, koopSiege }, passStufe, medaillen, eigen } */
  const sieg = k => k.ende && k.gewonnen;
  const stufeSieg = st => k => sieg(k) && k.spiel.stufe === st;
  const bossWeg = typ => k => !!(k.spiel.statistik.bossTypen && k.spiel.statistik.bossTypen[typ]);
  PT.ERFOLGE = [
    { id:'sieg', symbol:'🏁', name:'Erster Sieg', text:'Gewinne ein Spiel.', muenzen:5, pruefen:sieg },
    { id:'schwer', symbol:'🥇', name:'Harter Brocken', text:'Gewinne auf Schwer.', muenzen:15, pruefen:stufeSieg('schwer') },
    { id:'extrem', symbol:'💎', name:'Ein Leben, ein Ziel', text:'Gewinne auf Extrem.', muenzen:40, pruefen:stufeSieg('extrem') },
    { id:'perfekt', symbol:'🛡️', name:'Kein Fisch kam durch', text:'Gewinne, ohne ein Leben zu verlieren.', muenzen:20, pruefen:k => sieg(k) && k.spiel.leben >= k.spiel.startLeben && !k.spiel.unendlich },
    { id:'grund', symbol:'🧊', name:'Zurück zu den Wurzeln', text:'Gewinne im Modus „Nur Grundpinguine“.', muenzen:15, pruefen:k => sieg(k) && k.spiel.modus === 'grund' },
    { id:'ohneVerkauf', symbol:'🤝', name:'Treue Truppe', text:'Gewinne, ohne einen Pinguin zu verkaufen.', muenzen:10, pruefen:k => sieg(k) && !k.spiel.statistik.verkauft },
    { id:'ohneHeld', symbol:'🚫', name:'Ganz ohne Held', text:'Gewinne auf Mittel oder schwerer ohne Helden.', muenzen:10, pruefen:k => sieg(k) && !k.spiel.held && !k.spiel.koop && k.spiel.stufe !== 'leicht' },
    { id:'krakus', symbol:'🐙', name:'Krakus erledigt', text:'Besiege Krakus den Boss.', muenzen:15, pruefen:bossWeg('krakus') },
    { id:'orka', symbol:'🐋', name:'Kaiser gestürzt', text:'Besiege Kaiser Orka.', muenzen:15, pruefen:bossWeg('orka') },
    { id:'hai', symbol:'🦈', name:'Haifischflosse', text:'Besiege den Hai-König.', muenzen:15, pruefen:bossWeg('haikoenig') },
    { id:'leviathan', symbol:'🐉', name:'Drachentöter', text:'Besiege den Eis-Leviathan.', muenzen:25, pruefen:bossWeg('leviathan') },
    { id:'fuenf', symbol:'✨', name:'Stufe 5!', text:'Kaufe ein Upgrade der Stufe 5.', muenzen:5, pruefen:k => k.spiel.statistik.stufe5 >= 1 },
    { id:'drei5', symbol:'🌟', name:'Drei Legenden', text:'Habe drei Stufe-5-Pinguine gleichzeitig.', muenzen:20, pruefen:k => k.spiel.tuerme.filter(t => t.pfade && t.pfade.includes(5)).length >= 3 },
    { id:'held10', symbol:'⭐', name:'Heldenhaft', text:'Bring einen Helden auf Stufe 10.', muenzen:10, pruefen:k => k.spiel.tuerme.some(t => PT.HELDEN[t.typ] && t.stufe >= 10) },
    { id:'reich', symbol:'💰', name:'Dagobert Pinguin', text:'Habe 50.000 Geld auf einmal.', muenzen:10, pruefen:k => !k.spiel.unendlich && k.geld >= 50000 },
    { id:'platzer10k', symbol:'🐟', name:'Fischschwarm', text:'Erwische 10.000 Fische in einem Spiel.', muenzen:10, pruefen:k => k.spiel.statistik.platzer >= 10000 },
    { id:'platzer100k', symbol:'🌊', name:'Ozean leergefischt', text:'Erwische insgesamt 100.000 Fische.', muenzen:25, pruefen:k => k.lebenslang.platzer >= 100000 },
    { id:'runde100', symbol:'♾️', name:'Endlos-Profi', text:'Schaff Runde 100.', muenzen:30, pruefen:k => !k.spiel.unendlich && k.spiel.runde >= 100 },
    { id:'alleKarten', symbol:'🗺️', name:'Weltenbummler', text:'Gewinne auf jeder Karte (Standardmodus).', muenzen:40,
      pruefen:k => PT.KARTEN_REIHE.every(id => Object.keys(k.medaillen).some(m => m.startsWith(id + '|') && m.endsWith('|standard'))) },
    { id:'koop', symbol:'👥', name:'Teamwork', text:'Gewinne ein Koop-Spiel.', muenzen:15, pruefen:k => sieg(k) && k.spiel.koop },
    { id:'tag', symbol:'📅', name:'Tagesheld', text:'Schaff eine tägliche Herausforderung.', muenzen:10, pruefen:k => k.lebenslang.tage >= 1 },
    { id:'tag7', symbol:'🗓️', name:'Eine ganze Woche', text:'Schaff 7 tägliche Herausforderungen.', muenzen:30, pruefen:k => k.lebenslang.tage >= 7 },
    { id:'editor', symbol:'✏️', name:'Kartenbauer', text:'Gewinne auf einer selbst gebauten Karte.', muenzen:10, pruefen:k => sieg(k) && k.spiel.karte === 'eigen' },
    { id:'koch', symbol:'🍤', name:'Fischstäbchen-Fabrik', text:'Ein Koch-Pinguin verdient 5.000 Geld in einem Spiel.', muenzen:10, pruefen:k => k.spiel.tuerme.some(t => (t.verdient || 0) >= 5000) },
    { id:'pass25', symbol:'🎖️', name:'Halbe Strecke', text:'Erreiche Pinguin-Pass Stufe 25.', muenzen:20, pruefen:k => k.passStufe >= 25 },
    { id:'pass50', symbol:'👑', name:'Pass-Legende', text:'Erreiche Pinguin-Pass Stufe 50.', muenzen:50, pruefen:k => k.passStufe >= 50 },
    { id:'pass100', symbol:'💛', name:'Herzlicht', text:'Erreiche Pinguin-Pass Stufe 100.', muenzen:100, pruefen:k => k.passStufe >= 100 },
    { id:'prestige', symbol:'⭐', name:'Noch einmal von vorn', text:'Starte das erste Prestige im Pinguin-Pass.', muenzen:50, pruefen:k => (k.prestige || 0) >= 1 },
    { id:'abyssos', symbol:'🏮', name:'Licht aus, Abyssos!', text:'Besiege Abyssos, den Tiefseekönig.', muenzen:30, pruefen:bossWeg('abyssos') },
    { id:'kapitel1', symbol:'🌊', name:'Die Flut', text:'Schaff alle Levels von Kapitel 1 des Abenteuers.', muenzen:15, pruefen:k => !!(k.kampagne && PT.kapitelFertig && PT.kapitelFertig(1, k.kampagne)) },
    { id:'kampagne', symbol:'📖', name:'Schwarzes Eis', text:'Schaff das ganze Abenteuer bis zum bitteren Ende.', muenzen:60, pruefen:k => !!(k.kampagne && PT.abenteuerFertig && PT.abenteuerFertig(k.kampagne)) },
    { id:'sterne90', symbol:'⭐', name:'Sternensammler', text:'Hol alle 90 Sterne in „Schwarzes Eis“.', muenzen:80, pruefen:k => !!(k.kampagne && PT.LEVELS && PT.LEVELS.filter(l => l.kapitel < 10).every(l => PT.sternZahl(k.kampagne[l.id]) === 3)) },
    { id:'teil2', symbol:'✨', name:'Das erwachte Licht', text:'Schaff Teil 2 des Abenteuers.', muenzen:80, pruefen:k => !!(k.kampagne && PT.TEILE && PT.abenteuerFertig(k.kampagne, 2)) },
    { id:'sterne180', symbol:'🌟', name:'Sternenhimmel', text:'Hol alle 180 Sterne in beiden Teilen des Abenteuers.', muenzen:120, pruefen:k => !!(k.kampagne && PT.TEILE && PT.LEVELS.every(l => PT.sternZahl(k.kampagne[l.id]) === 3)) },
    { id:'tagebuch', symbol:'📜', name:'Opas Tagebuch', text:'Finde alle 30 Seiten aus Opas Tagebuch.', muenzen:50, pruefen:k => !!(k.tagebuch && PT.TAGEBUCH && Object.keys(PT.TAGEBUCH).every(id => k.tagebuch[id])) },
    { id:'albtraum1', symbol:'😱', name:'Schlaflos', text:'Überlebe ein Level im Albtraum.', muenzen:20, pruefen:k => !!(k.albtraum && Object.keys(k.albtraum).length >= 1) },
    { id:'albtraum30', symbol:'👁️', name:'Albtraumbezwinger', text:'Überlebe alle 30 Levels von Teil 2 im Albtraum.', muenzen:150, pruefen:k => !!(k.albtraum && PT.LEVELS && PT.LEVELS.filter(l => l.kapitel >= 10).every(l => k.albtraum[l.id])) },
    { id:'uralter', symbol:'💛', name:'Der Hunger ist satt', text:'Besiege den Uralten und sein Herz.', muenzen:40, pruefen:bossWeg('uralterkern') },
    { id:'opa', symbol:'🕯️', name:'Nach Hause', text:'Besiege den Lichtträger.', muenzen:30, pruefen:bossWeg('lichttraeger') },
    { id:'walter', symbol:'🗿', name:'Für Walter', text:'Halte die Brücke (Kapitel 3).', muenzen:20, pruefen:k => !!(k.kampagne && PT.sternZahl && PT.sternZahl(k.kampagne['s3-5']) >= 1) },
    { id:'frost', symbol:'🎖️', name:'Kapitän gestürzt', text:'Besiege Kapitän Frost.', muenzen:20, pruefen:bossWeg('kapitaen') },
    { id:'pako', symbol:'💔', name:'Bruder', text:'Besiege Pako, den Zerbrochenen.', muenzen:40, pruefen:bossWeg('zerbrochen') },
    { id:'dorf5', symbol:'🏘️', name:'Baumeister', text:'Bau ein Gebäude im Pingu-Dorf auf Stufe 5.', muenzen:25, pruefen:k => !!(k.dorf && Object.values(k.dorf.stufen || {}).some(n => n >= 5)) },
    { id:'dorfAlle', symbol:'🏰', name:'Neu-Pinguinhausen', text:'Bau alle Gebäude im Dorf auf die höchste Stufe.', muenzen:80, pruefen:k => !!(k.dorf && PT.DORF_REIHE && PT.DORF_REIHE.every(id => PT.dorfStufe(k.dorf, id) >= PT.dorfMax(id))) },
    { id:'vs1', symbol:'⚔️', name:'Eiskrieger', text:'Gewinne ein Versus-Spiel.', muenzen:15, pruefen:k => (k.lebenslang.vsSiege || 0) >= 1 },
    { id:'vs10', symbol:'🥶', name:'Eiskriegsherr', text:'Gewinne 10 Versus-Spiele (Sockel „Eiskrieg“).', muenzen:40, pruefen:k => (k.lebenslang.vsSiege || 0) >= 10 },
    { id:'kisten10', symbol:'🎁', name:'Schatzjäger', text:'Öffne 10 Kisten.', muenzen:15, pruefen:k => (k.lebenslang.kisten || 0) >= 10 },
    { id:'wetter', symbol:'🌦️', name:'Wetterfest', text:'Gewinne ein Spiel mit Wetter-Ereignissen auf Schwer oder Extrem.', muenzen:15, pruefen:k => sieg(k) && k.spiel.wetterAn && (k.spiel.stufe === 'schwer' || k.spiel.stufe === 'extrem') },
    { id:'sammler', symbol:'👗', name:'Modepinguin', text:'Besitze 30 Looks.', muenzen:25, pruefen:k => (k.lookZahl || 0) >= 30 }
  ];
  // Welche Erfolge sind jetzt neu geschafft? (schon: Objekt der bisherigen)
  PT.erfolgePruefen = function (k, schon) {
    const neu = [];
    for (const e of PT.ERFOLGE) {
      if (schon[e.id]) continue;
      try { if (e.pruefen(k)) neu.push(e); } catch (_) { /* fehlende Angaben: noch nicht geschafft */ }
    }
    return neu;
  };

  /* ---------- Pinguin-Wissen ----------
     Dauerhafte kleine Boni im Einzelspiel (nicht in Olympiade und Koop). kosten je Stufe in Fischmünzen. */
  PT.WISSEN = {
    kasse:  { name:'Sparstrumpf', symbol:'🪙', text:n => `+${n * 50} Startgeld`, max:5, kosten:[10, 20, 35, 55, 80], wert:n => ({ geld:n * 50 }) },
    leben:  { name:'Dickes Eis', symbol:'❤️', text:n => `+${n * 5} Start-Leben (nicht auf Extrem)`, max:4, kosten:[10, 25, 45, 70], wert:n => ({ leben:n * 5 }) },
    rabatt: { name:'Handelsgeschick', symbol:'🏷️', text:n => `Pinguine und Upgrades ${n * 2} % günstiger`, max:5, kosten:[15, 30, 50, 75, 110], wert:n => ({ rabatt:n * 0.02 }) },
    bonus:  { name:'Fleißige Fischer', symbol:'🎣', text:n => `+${n * 10} Geld am Ende jeder Runde`, max:5, kosten:[10, 20, 35, 55, 80], wert:n => ({ bonus:n * 10 }) },
    held:   { name:'Heldenschule', symbol:'⭐', text:n => `Helden bekommen ${n * 10} % mehr Erfahrung`, max:5, kosten:[10, 20, 35, 55, 80], wert:n => ({ heldXp:n * 0.1 }) },
    fk:     { name:'Schnelles Aufladen', symbol:'⚡', text:n => `Fähigkeiten laden ${n * 4} % schneller`, max:5, kosten:[15, 30, 50, 75, 110], wert:n => ({ fk:n * 0.04 }) }
  };
  PT.WISSEN_REIHE = Object.keys(PT.WISSEN);
  PT.boniAus = function (stufen) {
    const b = {};
    for (const id of PT.WISSEN_REIHE) {
      const n = Math.max(0, Math.min(PT.WISSEN[id].max, (stufen && stufen[id]) | 0));
      if (n) Object.assign(b, PT.WISSEN[id].wert(n));
    }
    return Object.keys(b).length ? b : null;
  };

  /* ---------- Tagesaufträge (Pinguin-Pass) ----------
     Drei Aufträge pro Tag. art: platzer, runden, sieg, faehigkeiten, bosse, stufe5, pinguin (Fische mit einer Pinguinart) */
  const AUFTRAG_ARTEN = [
    { art:'platzer', ziele:[1500, 3000, 6000], text:n => `Erwische ${n.toLocaleString('de-DE')} Fische`, xp:[250, 400, 600] },
    { art:'runden', ziele:[15, 30, 50], text:n => `Schaff ${n} Runden`, xp:[250, 400, 600] },
    { art:'faehigkeiten', ziele:[5, 12, 25], text:n => `Setz ${n} Fähigkeiten ein`, xp:[250, 400, 550] },
    { art:'stufe5', ziele:[1, 2], text:n => n === 1 ? 'Kauf ein Stufe-5-Upgrade' : `Kauf ${n} Stufe-5-Upgrades`, xp:[350, 550] },
    { art:'sieg', ziele:[1], text:() => 'Gewinne ein Spiel', xp:[500] },
    { art:'pinguin', ziele:[300, 800], text:(n, typ) => `Erwische ${n} Fische mit ${PT.PINGUINE[typ] ? PT.PINGUINE[typ].name.replace('-Pinguin', '-Pinguinen') : typ}`, xp:[300, 450] }
  ];
  PT.tagesAuftraege = function (datum) {
    const z = zufallAus('auftrag|' + datum);
    const arten = AUFTRAG_ARTEN.slice();
    const liste = [];
    for (let i = 0; i < 3; i++) {
      const a = arten.splice(Math.floor(z() * arten.length), 1)[0];
      const k = Math.floor(z() * a.ziele.length);
      const typ = a.art === 'pinguin' ? wahl(z, PT.PINGUIN_REIHE.filter(t => PT.PINGUINE[t].greift !== false)) : null;
      liste.push({ id:`${a.art}${typ ? '-' + typ : ''}`, art:a.art, typ, ziel:a.ziele[k], text:a.text(a.ziele[k], typ), xp:a.xp[k], muenzen:3 + k * 2 });
    }
    return liste;
  };

  /* ---------- Tägliche Herausforderung ----------
     Jeden Tag eine feste Aufgabe: Karte, Stufe, Held und ein oder zwei besondere Regeln. */
  const GRUPPE = g => PT.PINGUIN_REIHE.filter(t => PT.PINGUINE[t].gruppe === g);
  const REGELN = [
    { titel:'Nur Primär', text:'Nur Zapfen-, Stachel-, Schneeball- und Frost-Pinguine.', regeln:() => ({ erlaubt:GRUPPE('Primär') }) },
    { titel:'Militär-Tag', text:'Nur Militär-Pinguine.', regeln:() => ({ erlaubt:GRUPPE('Militär') }) },
    { titel:'Magische Nacht', text:'Nur Magie- und Unterstützungs-Pinguine.', regeln:() => ({ erlaubt:[...GRUPPE('Magie'), ...GRUPPE('Unterstützung')] }) },
    { titel:'Kleine Truppe', text:'Höchstens 6 Pinguine (der Held zählt nicht).', regeln:() => ({ maxTuerme:6 }) },
    { titel:'Bescheidenheit', text:'Upgrades höchstens bis Stufe 3.', regeln:() => ({ maxStufe:3 }) },
    { titel:'Kein Zurück', text:'Verkaufen ist verboten.', regeln:() => ({ keinVerkauf:true }) },
    { titel:'Teure Zeiten', text:'Alles kostet 40 % mehr, dafür 1.200 Startgeld.', regeln:() => ({ preis:1.4, geld:1200 }) },
    { titel:'Glaskanone', text:'Nur 25 Leben.', regeln:() => ({ leben:25 }) },
    { titel:'Allein gegen alle', text:'Kein Held.', regeln:() => ({ ohneHeld:true }) },
    { titel:'Knappe Kasse', text:'Nur 450 Startgeld.', regeln:() => ({ geld:450 }) }
  ];
  PT.tagesHerausforderung = function (datum) {
    const z = zufallAus('tag|' + datum);
    const karte = wahl(z, PT.KARTEN_REIHE);
    const stufe = wahl(z, ['leicht', 'mittel', 'mittel', 'schwer']);
    const a = wahl(z, REGELN);
    let b = wahl(z, REGELN);
    if (b === a || (a.regeln().erlaubt && b.regeln().erlaubt) || (a.regeln().geld && b.regeln().geld)) b = null;
    const regeln = { ...a.regeln(), ...(b ? b.regeln() : {}), runden:wahl(z, [25, 30, 35]) };
    const held = regeln.ohneHeld ? null : wahl(z, PT.HELDEN_REIHE);
    return {
      datum, karte, stufe, modus:'standard', held, regeln,
      titel:b ? `${a.titel} + ${b.titel}` : a.titel,
      text:[a.text, b && b.text, `${regeln.runden} Runden auf ${PT.KARTEN[karte].name} (${PT.STUFEN[stufe].name})${held ? `, Held: ${PT.HELDEN[held].name}` : ''}.`].filter(Boolean).join(' '),
      xp:600 + (stufe === 'schwer' ? 300 : stufe === 'mittel' ? 150 : 0), muenzen:stufe === 'schwer' ? 25 : stufe === 'mittel' ? 18 : 12
    };
  };

  /* ---------- Kisten ----------
     Holz, Silber und Gold. Inhalt: Fischmünzen, Pass-Erfahrung und mit etwas Glück ein Look oder Sockel aus der Kiste.
     zufall: eine Funktion wie Math.random (für Tests austauschbar); besitz: { skins, sockel } schon vorhanden. */
  PT.KISTEN = {
    holz:   { name:'Holzkiste', symbol:'📦', teile:2, muenzen:[5, 15], xp:[100, 250], kosmetik:0.15 },
    silber: { name:'Silberkiste', symbol:'🎁', teile:3, muenzen:[15, 35], xp:[250, 500], kosmetik:0.35 },
    gold:   { name:'Goldkiste', symbol:'👑', teile:4, muenzen:[40, 80], xp:[500, 900], kosmetik:1 }
  };
  PT.KISTEN_REIHE = ['holz', 'silber', 'gold'];
  PT.kistenKosmetik = () => [
    ...PT.SKIN_REIHE.filter(id => PT.SKINS[id].herkunft === 'kiste').map(id => ({ skin:id })),
    ...PT.SOCKEL_REIHE.filter(id => PT.SOCKEL[id].herkunft === 'kiste').map(id => ({ sockel:id }))
  ];
  PT.kisteOeffnen = function (art, besitz = {}, zufall = Math.random) {
    const K = PT.KISTEN[art] || PT.KISTEN.holz;
    const zw = ([a, b]) => Math.round(a + zufall() * (b - a));
    const inhalt = [{ muenzen:zw(K.muenzen) }, { xp:zw(K.xp) }];
    const offen = PT.kistenKosmetik().filter(k => !(k.skin ? (besitz.skins || {})[k.skin] : (besitz.sockel || {})[k.sockel]));
    if (K.teile >= 3) inhalt.push(zufall() < 0.5 ? { muenzen:zw(K.muenzen) } : { xp:zw(K.xp) });
    if (zufall() < K.kosmetik) {
      if (offen.length) inhalt.push(offen[Math.floor(zufall() * offen.length)]);
      else inhalt.push({ muenzen:zw(K.muenzen) * 2 });
    } else if (K.teile >= 4) inhalt.push({ muenzen:zw(K.muenzen) });
    return inhalt;
  };

  /* ---------- Händler ----------
     Jeden Tag vier Angebote für Fischmünzen: zwei Looks oder Sockel aus den Kisten, eine Kiste und ein Erfahrungs-Booster. */
  PT.haendlerAngebote = function (datum) {
    const z = zufallAus('haendler|' + datum);
    const pool = PT.kistenKosmetik();
    const a = pool.splice(Math.floor(z() * pool.length), 1)[0], b = pool.splice(Math.floor(z() * pool.length), 1)[0];
    const kiste = wahl(z, ['holz', 'silber', 'silber', 'gold']);
    const preisKosmetik = k => (k.skin ? 80 : 45) + Math.floor(z() * 4) * 5;
    return [
      { id:'a', ...a, preis:preisKosmetik(a) },
      { id:'b', ...b, preis:preisKosmetik(b) },
      { id:'k', kiste, preis:{ holz:15, silber:35, gold:70 }[kiste] },
      { id:'x', booster:3, preis:25 }
    ];
  };

  /* ---------- Wochen-Quests ----------
     Fünf größere Aufgaben pro Woche (Montag bis Sonntag), Belohnung: Erfahrung und eine Kiste. */
  PT.wocheId = (d = new Date()) => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const tag = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - tag);
    const jahr = t.getUTCFullYear();
    const woche = Math.ceil(((t - Date.UTC(jahr, 0, 1)) / 86400000 + 1) / 7);
    return `${jahr}-W${String(woche).padStart(2, '0')}`;
  };
  const WOCHEN_ARTEN = [
    { art:'platzer', ziel:20000, text:'Erwische 20.000 Fische', xp:1200, kiste:'silber' },
    { art:'runden', ziel:120, text:'Schaff 120 Runden', xp:1200, kiste:'silber' },
    { art:'sieg', ziel:3, text:'Gewinne 3 Spiele', xp:1500, kiste:'gold' },
    { art:'bosse', ziel:2, text:'Besiege 2 Bosse', xp:1200, kiste:'silber' },
    { art:'sterne', ziel:6, text:'Hol 6 Sterne im Abenteuer', xp:1200, kiste:'silber' },
    { art:'tag', ziel:3, text:'Schaff 3 Tages-Herausforderungen', xp:1500, kiste:'gold' },
    { art:'stufe5', ziel:6, text:'Kauf 6 Stufe-5-Upgrades', xp:1000, kiste:'silber' },
    { art:'faehigkeiten', ziel:60, text:'Setz 60 Fähigkeiten ein', xp:1000, kiste:'silber' },
    { art:'kisten', ziel:3, text:'Öffne 3 Kisten', xp:800, kiste:'holz' }
  ];
  PT.wochenQuests = function (woche) {
    const z = zufallAus('woche|' + woche);
    const pool = WOCHEN_ARTEN.slice();
    const liste = [];
    for (let i = 0; i < 5; i++) { const q = pool.splice(Math.floor(z() * pool.length), 1)[0]; liste.push({ ...q, id:q.art }); }
    return liste;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
