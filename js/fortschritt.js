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
    { id:'pass50', symbol:'👑', name:'Pass-Legende', text:'Erreiche Pinguin-Pass Stufe 50.', muenzen:50, pruefen:k => k.passStufe >= 50 }
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

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
