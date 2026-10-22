'use strict';
// Pinguin Türmchen – Pingu-Dorf: Nach dem Untergang von Pinguinhausen baut ihr auf einer Scholle neu auf.
// Das Dorf wächst mit dem Abenteuer (Lager → Zuflucht → Festung → Neu-Pinguinhausen). Gebäude kosten
// Fischmünzen und Eiskristalle und geben kleine Boni fürs Spiel. Gespeichert wird im Browser (fort.dorf).
(function (wurzel) {
  const PT = wurzel.PT || (wurzel.PT = {});

  /* ---------- Ausbaustufen des Dorfs (nach Kapiteln des Abenteuers) ---------- */
  PT.DORF_PHASEN = [
    { name:'Verschollen', text:'Noch gibt es kein Dorf. Spiel das Abenteuer weiter …', kapitel:null, max:0 },
    { name:'Flüchtlingslager', text:'Ein paar Zelte auf dem Eis, ein Feuer gegen die Kälte. Die ersten Geretteten.', kapitel:2, max:2 },
    { name:'Zuflucht', text:'Aus Zelten werden Hütten. Eine Schmiede glüht, ein Wachturm späht über das Eis.', kapitel:3, max:3 },
    { name:'Festung', text:'Mauern aus Eis. Hier fällt niemand mehr ohne Kampf.', kapitel:4, max:4 },
    { name:'Neu-Pinguinhausen', text:'Pinguinhausen ist versunken. Aber ihr seid noch da – und ihr baut neu.', kapitel:5, max:5 }
  ];
  // geschaffte Kapitel → Phase (das Lager entsteht nach Kapitel 2)
  PT.dorfPhase = function (kampagne) {
    if (!PT.kapitelFertig) return 0;
    let p = 0;
    for (let i = 1; i < PT.DORF_PHASEN.length; i++) if (PT.kapitelFertig(PT.DORF_PHASEN[i].kapitel, kampagne || {})) p = i;
    return p;
  };

  /* ---------- Gebäude ----------
     wert[stufe]: was die Stufe bringt. ab: ab welcher Phase man es bauen darf. max: höchste Stufe (sonst 5). */
  PT.DORF_GEBAEUDE = {
    raeucherei:{ name:'Räucherei', symbol:'🐟', ab:1, text:'Räuchert Fisch, auch wenn du nicht spielst. Hol die Fischmünzen ab (sie sammeln sich bis zu 12 Stunden).',
      wert:[0, 2, 4, 6, 9, 12], zeigen:n => `${n} Fischmünzen pro Stunde` },
    lazarett:  { name:'Lazarett', symbol:'🏥', ab:1, text:'Verletzte werden gepflegt: mehr Leben zu Beginn (nicht auf Extrem).',
      wert:[0, 5, 10, 15, 20, 30], zeigen:n => `+${n} Start-Leben` },
    hafen:     { name:'Hafen', symbol:'⚓', ab:1, text:'Boote bringen Vorräte: mehr Geld zu Beginn jedes Spiels.',
      wert:[0, 30, 60, 100, 150, 200], zeigen:n => `+${n} Startgeld` },
    schmiede:  { name:'Schmiede', symbol:'⚒️', ab:2, text:'Bessere Waffen aus dem Feuer: Alle Pinguine greifen schneller an.',
      wert:[0, 0.02, 0.04, 0.06, 0.08, 0.1], zeigen:n => `+${Math.round(n * 100)} % Angriffstempo` },
    wachturm:  { name:'Wachturm', symbol:'🔭', ab:2, text:'Späher auf dem Turm: Alle Pinguine sehen weiter.',
      wert:[0, 0.02, 0.04, 0.06, 0.08, 0.1], zeigen:n => `+${Math.round(n * 100)} % Reichweite` },
    denkmal:   { name:'Walters Denkmal', symbol:'🗿', ab:2, max:1, text:'Für den alten Walter, der die Brücke hielt. Wer davor steht, trägt seinen Helm.',
      wert:[0, 1], zeigen:() => 'Look „Walters Helm“' },
    akademie:  { name:'Akademie', symbol:'📚', ab:3, text:'Nova bringt den Jungen bei, was sie gelernt hat: mehr Pinguin-Pass-Erfahrung.',
      wert:[0, 0.05, 0.1, 0.15, 0.2, 0.25], zeigen:n => `+${Math.round(n * 100)} % Pass-Erfahrung` },
    leuchtfeuer:{ name:'Leuchtfeuer', symbol:'💡', ab:4, max:3, text:'Ein Licht, das in die Tiefe scheint. Mehr Eiskristalle – und auf Stufe 3 … wer weiß, was es dort unten weckt.',
      wert:[0, 0.1, 0.2, 0.35], zeigen:n => `+${Math.round(n * 100)} % Eiskristalle` }
  };
  PT.DORF_REIHE = Object.keys(PT.DORF_GEBAEUDE);
  PT.dorfMax = id => PT.DORF_GEBAEUDE[id].max || 5;
  // Kosten der nächsten Stufe (Fischmünzen und Eiskristalle)
  const MUENZEN = [0, 15, 35, 60, 90, 130], KRISTALLE = [0, 5, 10, 20, 35, 50];
  PT.dorfKosten = function (id, stufe) {
    if (id === 'denkmal') return { muenzen:20, kristalle:10 };
    if (id === 'leuchtfeuer') return [null, { muenzen:80, kristalle:40 }, { muenzen:140, kristalle:70 }, { muenzen:220, kristalle:110 }][stufe] || null;
    return stufe >= 1 && stufe <= 5 ? { muenzen:MUENZEN[stufe], kristalle:KRISTALLE[stufe] } : null;
  };
  // Leerer Spielstand des Dorfs
  PT.dorfNeu = () => ({ stufen:{}, kristalle:0, bewohner:0, geerntet:null, geschenk:false });
  PT.dorfStufe = (dorf, id) => (dorf && dorf.stufen && dorf.stufen[id]) || 0;
  PT.dorfWert = (dorf, id) => PT.DORF_GEBAEUDE[id].wert[PT.dorfStufe(dorf, id)] || 0;
  // Darf das Gebäude auf die nächste Stufe? (Phase, Höchststufe, genug Geld und Kristalle)
  PT.dorfAusbau = function (dorf, id, phase, muenzen) {
    const g = PT.DORF_GEBAEUDE[id];
    if (!g) return { ok:false, grund:'Unbekannt' };
    const st = PT.dorfStufe(dorf, id), ziel = st + 1;
    if (phase < g.ab) return { ok:false, grund:`Ab „${PT.DORF_PHASEN[g.ab].name}“` };
    if (ziel > PT.dorfMax(id)) return { ok:false, grund:'Höchste Stufe' };
    if (g.max == null && ziel > PT.DORF_PHASEN[phase].max) return { ok:false, grund:`Stufe ${ziel} ab „${PT.DORF_PHASEN[Math.min(4, phase + 1)].name}“` };
    const k = PT.dorfKosten(id, ziel);
    if (muenzen < k.muenzen || (dorf.kristalle || 0) < k.kristalle) return { ok:false, grund:'Zu wenig', kosten:k };
    return { ok:true, kosten:k };
  };
  // Boni fürs Spiel (Spiel-Option boni; im Koop pro Spieler, siehe PT.boniOk)
  PT.dorfBoni = function (dorf) {
    if (!dorf) return null;
    const b = { geld:PT.dorfWert(dorf, 'hafen'), leben:PT.dorfWert(dorf, 'lazarett'), tempo:PT.dorfWert(dorf, 'schmiede'), reichweite:PT.dorfWert(dorf, 'wachturm') };
    for (const k of Object.keys(b)) if (!b[k]) delete b[k];
    return Object.keys(b).length ? b : null;
  };
  // Zwei Boni-Objekte zusammenzählen (Pinguin-Wissen und Dorf)
  PT.boniMischen = function (a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const r = { ...a };
    for (const [k, v] of Object.entries(b)) r[k] = (r[k] || 0) + v;
    return r;
  };
  // Räucherei: wie viele Fischmünzen seit dem letzten Abholen bereitliegen (höchstens 12 Stunden)
  PT.dorfErnte = function (dorf, jetzt) {
    const proStunde = PT.dorfWert(dorf, 'raeucherei');
    if (!proStunde || !dorf.geerntet) return 0;
    const h = Math.min(12, Math.max(0, (jetzt - dorf.geerntet) / 3600000));
    return Math.floor(h * proStunde);
  };
  // Eiskristalle mit dem Leuchtfeuer-Bonus
  PT.kristallFaktor = dorf => 1 + PT.dorfWert(dorf, 'leuchtfeuer');

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
