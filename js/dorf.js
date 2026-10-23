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
    { name:'Neu-Pinguinhausen', text:'Pinguinhausen ist versunken. Aber ihr seid noch da – und ihr baut neu.', kapitel:5, max:5 },
    // Teil 2 „Das erwachte Licht“
    { name:'Stadt des Lichts', text:'Laternen an jedem Haus, Kristalle im Garten, Orkas Rudel in der Bucht. Neu-Pinguinhausen leuchtet.', kapitel:12, max:6 },
    { name:'Novas Stadt', text:'Unter der Scholle glimmt es golden. Jeden Abend zündet Mia ein Licht an – damit Nova weiß, wo oben ist.', kapitel:15, max:7 }
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
      wert:[0, 2, 4, 6, 9, 12, 16, 20], zeigen:n => `${n} Fischmünzen pro Stunde` },
    lazarett:  { name:'Lazarett', symbol:'🏥', ab:1, text:'Verletzte werden gepflegt: mehr Leben zu Beginn (nicht auf Extrem).',
      wert:[0, 5, 10, 15, 20, 30, 35, 40], zeigen:n => `+${n} Start-Leben` },
    hafen:     { name:'Hafen', symbol:'⚓', ab:1, text:'Boote bringen Vorräte: mehr Geld zu Beginn jedes Spiels.',
      wert:[0, 30, 60, 100, 150, 200, 260, 320], zeigen:n => `+${n} Startgeld` },
    schmiede:  { name:'Schmiede', symbol:'⚒️', ab:2, text:'Bessere Waffen aus dem Feuer: Alle Pinguine greifen schneller an.',
      wert:[0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14], zeigen:n => `+${Math.round(n * 100)} % Angriffstempo` },
    wachturm:  { name:'Wachturm', symbol:'🔭', ab:2, text:'Späher auf dem Turm: Alle Pinguine sehen weiter.',
      wert:[0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14], zeigen:n => `+${Math.round(n * 100)} % Reichweite` },
    denkmal:   { name:'Walters Denkmal', symbol:'🗿', ab:2, max:1, text:'Für den alten Walter, der die Brücke hielt. Wer davor steht, trägt seinen Helm.',
      wert:[0, 1], zeigen:() => 'Look „Walters Helm“' },
    akademie:  { name:'Akademie', symbol:'📚', ab:3, text:'Nova bringt den Jungen bei, was sie gelernt hat: mehr Pinguin-Pass-Erfahrung.',
      wert:[0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35], zeigen:n => `+${Math.round(n * 100)} % Pass-Erfahrung` },
    leuchtfeuer:{ name:'Leuchtfeuer', symbol:'💡', ab:4, max:3, text:'Ein Licht, das in die Tiefe scheint. Mehr Eiskristalle – und auf Stufe 3 … wer weiß, was es dort unten weckt.',
      wert:[0, 0.1, 0.2, 0.35], zeigen:n => `+${Math.round(n * 100)} % Eiskristalle` },
    // Teil 2: ab „Stadt des Lichts“
    kristallgarten:{ name:'Kristallgarten', symbol:'💎', ab:5, text:'Lichtkristalle wachsen aus dem Eis, auch wenn du nicht spielst. Hol die Eiskristalle ab (sie sammeln sich bis zu 12 Stunden).',
      wert:[0, 0.5, 1, 1.5, 2, 2.5, 3, 4], zeigen:n => `${String(n).replace('.', ',')} Eiskristalle pro Stunde` },
    orkabucht: { name:'Orkas Bucht', symbol:'🐋', ab:5, max:3, text:'Kaiser Orkas Rudel lebt jetzt bei euch. Im freien Spiel und im Koop schwimmen verbündete Haie gegen den Strom durch den Kanal.',
      wert:[0, 1, 2, 3], zeigen:n => ['', 'Alle 30 Sekunden ein Hai', 'Alle 20 Sekunden ein Hai', 'Alle 12 Sekunden ein starker Hai'][n] },
    werft:     { name:'Frosts Werft', symbol:'🛠️', ab:5, text:'Frost repariert die Eiserne Möwe – und bastelt nebenbei bessere Zünder: Fähigkeiten laden schneller auf.',
      wert:[0, 0.03, 0.06, 0.09, 0.12, 0.15, 0.18, 0.2], zeigen:n => `−${Math.round(n * 100)} % Abklingzeit der Fähigkeiten` },
    novafeuer: { name:'Novas Leuchtfeuer', symbol:'🕯️', ab:6, max:1, text:'Für Nova, die unten das Licht hält. Wer davor steht, trägt ihre Laterne.',
      wert:[0, 1], zeigen:() => 'Look „Novas Licht“' }
  };
  PT.DORF_REIHE = Object.keys(PT.DORF_GEBAEUDE);
  PT.dorfMax = id => PT.DORF_GEBAEUDE[id].max || 7;
  // Kosten der nächsten Stufe (Fischmünzen und Eiskristalle)
  const MUENZEN = [0, 15, 35, 60, 90, 130, 180, 250], KRISTALLE = [0, 5, 10, 20, 35, 50, 75, 100];
  PT.dorfKosten = function (id, stufe) {
    if (id === 'denkmal') return { muenzen:20, kristalle:10 };
    if (id === 'novafeuer') return { muenzen:150, kristalle:80 };
    if (id === 'orkabucht') return [null, { muenzen:90, kristalle:40 }, { muenzen:160, kristalle:80 }, { muenzen:250, kristalle:120 }][stufe] || null;
    if (id === 'leuchtfeuer') return [null, { muenzen:80, kristalle:40 }, { muenzen:140, kristalle:70 }, { muenzen:220, kristalle:110 }][stufe] || null;
    return stufe >= 1 && stufe <= 7 ? { muenzen:MUENZEN[stufe], kristalle:KRISTALLE[stufe] } : null;
  };
  // Leerer Spielstand des Dorfs
  PT.dorfNeu = () => ({ stufen:{}, kristalle:0, bewohner:0, geerntet:null, garten:null, geschenk:false, auftrag:null });
  PT.dorfStufe = (dorf, id) => (dorf && dorf.stufen && dorf.stufen[id]) || 0;
  PT.dorfWert = (dorf, id) => PT.DORF_GEBAEUDE[id].wert[PT.dorfStufe(dorf, id)] || 0;
  // Darf das Gebäude auf die nächste Stufe? (Phase, Höchststufe, genug Geld und Kristalle)
  PT.dorfAusbau = function (dorf, id, phase, muenzen) {
    const g = PT.DORF_GEBAEUDE[id];
    if (!g) return { ok:false, grund:'Unbekannt' };
    const st = PT.dorfStufe(dorf, id), ziel = st + 1;
    if (phase < g.ab) return { ok:false, grund:`Ab „${PT.DORF_PHASEN[g.ab].name}“` };
    if (ziel > PT.dorfMax(id)) return { ok:false, grund:'Höchste Stufe' };
    if (g.max == null && ziel > PT.DORF_PHASEN[phase].max) return { ok:false, grund:`Stufe ${ziel} ab „${PT.DORF_PHASEN[Math.min(PT.DORF_PHASEN.length - 1, phase + 1)].name}“` };
    const k = PT.dorfKosten(id, ziel);
    if (muenzen < k.muenzen || (dorf.kristalle || 0) < k.kristalle) return { ok:false, grund:'Zu wenig', kosten:k };
    return { ok:true, kosten:k };
  };
  // Boni fürs Spiel (Spiel-Option boni; im Koop pro Spieler, siehe PT.boniOk)
  PT.dorfBoni = function (dorf) {
    if (!dorf) return null;
    const b = { geld:PT.dorfWert(dorf, 'hafen'), leben:PT.dorfWert(dorf, 'lazarett'), tempo:PT.dorfWert(dorf, 'schmiede'), reichweite:PT.dorfWert(dorf, 'wachturm'),
      haie:PT.dorfWert(dorf, 'orkabucht'), fk:PT.dorfWert(dorf, 'werft') };
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
  // Kristallgarten: Eiskristalle seit dem letzten Abholen (höchstens 12 Stunden)
  PT.dorfGartenErnte = function (dorf, jetzt) {
    const proStunde = PT.dorfWert(dorf, 'kristallgarten');
    if (!proStunde || !dorf.garten) return 0;
    return Math.floor(Math.min(12, Math.max(0, (jetzt - dorf.garten) / 3600000)) * proStunde);
  };

  /* ---------- Dorf-Aufgaben: jeden Tag bittet ein Bewohner um etwas ----------
     art wie bei den Tagesaufträgen (platzer, runden, sieg, faehigkeiten, stufe5). Lohn: Eiskristalle und ein neuer Bewohner. */
  const BITTEN = [
    { wer:'mia2', art:'runden', ziele:[20, 40], text:n => `Die Kleinen wollen Geschichten hören. Schaff ${n} Runden, dann erzähl ich ihnen von dir!` },
    { wer:'kiko', art:'platzer', ziele:[2000, 5000], text:n => `Mein Funkgerät braucht Fischschuppen als Antenne. Erwisch ${n.toLocaleString('de-DE')} Fische für mich?` },
    { wer:'frost', art:'stufe5', ziele:[1, 2], text:n => `Die Möwe braucht einen neuen Kiel. Kauf ${n === 1 ? 'ein Stufe-5-Upgrade' : `${n} Stufe-5-Upgrades`} – ich will sehen, was ihr könnt.` },
    { wer:'frost', art:'faehigkeiten', ziele:[8, 15], text:n => `Ich teste neue Zünder. Setz ${n} Fähigkeiten ein und sag mir, ob sie knallen.` },
    { wer:'mia2', art:'sieg', ziele:[1], text:() => 'Wir brauchen ein bisschen Hoffnung. Gewinn ein Spiel – egal wo.' },
    { wer:'kiko', art:'runden', ziele:[30], text:n => `Ich muss den Funkturm neu ausrichten. Halt ${n} Runden lang die Fische vom Dorf fern!` },
    { wer:'orka', art:'platzer', ziele:[3000], text:n => `Mein Rudel hat Hunger. Treib uns ${n.toLocaleString('de-DE')} Fische zu, kleine Pinguine.` }
  ];
  const hash = t => { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  PT.dorfAuftrag = function (datum, phase) {
    const moeglich = BITTEN.filter(b => phase >= 5 || b.wer !== 'orka');
    const h = hash('dorf|' + datum), b = moeglich[h % moeglich.length], k = (h >>> 8) % b.ziele.length, n = b.ziele[k];
    return { wer:b.wer, art:b.art, ziel:n, text:b.text(n), kristalle:8 + k * 6 };
  };

  // Eiskristalle mit dem Leuchtfeuer-Bonus
  PT.kristallFaktor = dorf => 1 + PT.dorfWert(dorf, 'leuchtfeuer');

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
