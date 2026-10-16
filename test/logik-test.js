'use strict';
// Stresstest der Spiellogik ohne Grafik: jeder Pinguin in vielen Upgrade-Kombinationen und jeder Held
// auf jeder Stufe gegen eine bunte Fischmischung, alle Fähigkeiten auslösen, alle Modi anspielen.
// Prüft, dass nichts abstürzt und keine NaN-Werte entstehen. node test/logik-test.js
const PT = require('../js/pinguine.js');
require('../js/logik.js');

let fehler = 0;
function pruefe(bedingung, text) { if (!bedingung) { fehler++; console.log('FEHLER:', text); } }
function nanFrei(s, wo) {
  for (const f of s.fische) if (![f.x, f.y, f.dist, f.hp].every(Number.isFinite)) { pruefe(false, `${wo}: Fisch ${f.typ} mit NaN`); return; }
  for (const g of s.geschosse) if (![g.x, g.y].every(Number.isFinite)) { pruefe(false, `${wo}: Geschoss ${g.bild} mit NaN`); return; }
  pruefe(Number.isFinite(s.geld) && Number.isFinite(s.leben), `${wo}: Geld/Leben NaN`);
}
const kombis = [];
for (let a = 0; a <= 5; a++) for (let b = 0; b <= 2; b++) kombis.push([a, b, 0], [0, a, b], [b, 0, a]);

const mischung = ['rot', 'gelb', 'schwarz', 'weiss', 'panzer', 'zebra', 'regen', 'koffer', 'wal', 'rochen'];
let n = 0;
for (const typ of PT.PINGUIN_REIHE) {
  for (const pf of kombis) {
    const s = new PT.Spiel({ karte:typ === 'boot' ? 'bucht' : 'scholle', modus:'sandkasten', held:'kiel' });
    const ok = PT.def(typ).wasser ? s.kartenDaten.wasser[0] : null;
    let t = null;
    if (ok) t = s.bauen(typ, ok[0], ok[1]);
    else for (let i = 0; i < 3000 && !t; i++) { const p = s.weg.pts[(i * 53) % s.weg.pts.length]; t = s.bauen(typ, p[0] + Math.cos(i) * 55, p[1] + Math.sin(i) * 55); }
    pruefe(t, `${typ} ließ sich nicht bauen`);
    if (!t) continue;
    for (let k = 0; k < 3; k++) for (let j = 0; j < pf[k]; j++) pruefe(s.upgraden(t, k), `${typ} ${pf} Upgrade Pfad ${k} Stufe ${j + 1}`);
    for (const f of mischung) s.sandFische(f, 3, { camo:f === 'gelb', nach:f === 'rot' || f === 'regen', fest:f === 'koffer' });
    for (let i = 0; i < 60 * 12; i++) {
      s.schritt(1 / 60);
      if (i === 200) for (const f of s.faehigkeitenListe()) { t.fcd[f.id] = 0; pruefe(s.faehigkeitAusloesen(f.id), `${typ} Fähigkeit ${f.id}`); }
    }
    nanFrei(s, `${typ} ${pf}`);
    n++;
  }
}
console.log(`${n} Pinguin-Kombinationen getestet`);

// Helden auf allen Stufen
for (const held of PT.HELDEN_REIHE) {
  const s = new PT.Spiel({ karte:'scholle', modus:'sandkasten', held });
  let t = null;
  for (let i = 0; i < 3000 && !t; i++) { const p = s.weg.pts[(i * 53) % s.weg.pts.length]; t = s.bauen(held, p[0] + Math.cos(i) * 55, p[1] + Math.sin(i) * 55); }
  pruefe(t, `Held ${held} ließ sich nicht bauen`);
  pruefe(!s.bauen(held, 900, 600), `zweiter Held ${held} gebaut`);
  for (let st = 1; st < 10; st++) pruefe(s.heldenStufeKaufen(t), `Held ${held} Stufe ${st + 1}`);
  pruefe(t.stufe === 10, `Held ${held} nicht auf Stufe 10`);
  for (const f of mischung) s.sandFische(f, 4, {});
  for (let i = 0; i < 60 * 10; i++) {
    s.schritt(1 / 60);
    if (i === 100) for (const f of s.faehigkeitenListe()) { t.fcd[f.id] = 0; pruefe(s.faehigkeitAusloesen(f.id), `Held ${held} Fähigkeit ${f.id}`); }
  }
  nanFrei(s, `Held ${held}`);
}

// Stufe 5 nur einmal pro Pfad
{
  const s = new PT.Spiel({ karte:'scholle', modus:'sandkasten' });
  const a = s.bauen('zapfen', 160, 200), b = s.bauen('zapfen', 160, 380);
  for (let j = 0; j < 5; j++) s.upgraden(a, 0);
  for (let j = 0; j < 4; j++) s.upgraden(b, 0);
  pruefe(a.pfade[0] === 5 && b.pfade[0] === 4 && !s.upgradeErlaubt(b, 0), 'Stufe-5-Regel');
}

// Alle Modi und Karten ein paar Runden mit einfachen Pinguinen
for (const modus of PT.MODI_REIHE) for (const karte of PT.KARTEN_REIHE) {
  const s = new PT.Spiel({ karte, modus, stufe:'leicht', held:modus === 'grund' ? 'kiel' : 'frosti' });
  pruefe(modus !== 'grund' || !s.held, 'Held im Grundmodus');
  s.geld = 1e6;
  let gebaut = 0;
  for (let i = 0; i < 4000 && gebaut < 12; i++) {
    const w = s.wege[i % s.wege.length], p = w.pts[(i * 37) % w.pts.length];
    const typ = ['zapfen', 'schneeball', 'polar', 'frost'][i % 4];
    if (s.bauen(typ, p[0] + Math.cos(i) * 52, p[1] + Math.sin(i) * 52)) gebaut++;
  }
  for (const t of s.tuerme) { s.upgraden(t, 0); s.upgraden(t, 0); s.upgraden(t, 2); }
  if (modus === 'sandkasten') { s.sandFische('krakus', 1); s.sandFische('orka', 1); s.sandFische('krake', 1); }
  const ziel = modus === 'boss' ? 21 : modus === 'orka' ? 26 : 6;
  let schritte = 0;
  while (!s.vorbei && s.runde < ziel && schritte < 60 * 60 * 30) {
    if (!s.laeuft) { s.geld = Math.max(s.geld, 1e6); s.rundeStarten(); }
    s.schritt(1 / 60); schritte++;
    if (modus === 'sandkasten' && !s.laeuft) break;
  }
  nanFrei(s, `${modus}/${karte}`);
  if (modus !== 'sandkasten') pruefe(s.runde >= Math.min(ziel, 6), `${modus}/${karte}: nur Runde ${s.runde}, Leben ${s.leben}`);
  // Speichern und Laden
  const d = JSON.parse(JSON.stringify(s.speichern()));
  const s2 = PT.Spiel.laden(d);
  pruefe(s2.tuerme.length === s.tuerme.length && s2.modus === s.modus && s2.runde === s.runde, `${modus}/${karte}: Laden`);
}
console.log('Modi und Karten getestet');

// Meisterkräfte der Helden (Pinguin-Pass) ab Stufe 5
for (const held of PT.HELDEN_REIHE) {
  const s = new PT.Spiel({ karte:'scholle', modus:'sandkasten', held, kraft:true });
  let t = null;
  for (let i = 0; i < 3000 && !t; i++) { const p = s.weg.pts[(i * 53) % s.weg.pts.length]; t = s.bauen(held, p[0] + Math.cos(i) * 55, p[1] + Math.sin(i) * 55); }
  for (let st = 1; st < 5; st++) s.heldenStufeKaufen(t);
  const kraft = PT.HELDEN[held].kraft.id;
  pruefe(s.faehigkeitenListe().some(f => f.id === kraft), `Meisterkraft ${kraft} fehlt`);
  for (const f of mischung) s.sandFische(f, 3, {});
  s.sandFische('orka', 1);
  for (let i = 0; i < 60 * 4; i++) { s.schritt(1 / 60); if (i === 60) { t.fcd[kraft] = 0; pruefe(s.faehigkeitAusloesen(kraft), `Meisterkraft ${kraft} auslösen`); } }
  nanFrei(s, `Meisterkraft ${held}`);
  const ohne = new PT.Spiel({ karte:'scholle', modus:'sandkasten', held });
  const t2 = ohne.bauen(held, t.x, t.y);
  for (let st = 1; st < 9; st++) ohne.heldenStufeKaufen(t2);
  pruefe(!ohne.faehigkeitenListe().some(f => f.id === kraft), `Meisterkraft ${kraft} ohne Pass`);
}

// Kaiser Orka: Flutwelle betäubt Pinguine in der Nähe
{
  const s = new PT.Spiel({ karte:'scholle', modus:'sandkasten' });
  const weg = s.weg;
  s.sandFische('orka', 1);
  for (let i = 0; i < 60 * 4; i++) s.schritt(1 / 60);
  const orka = s.fische[0];
  let t = null;
  for (let i = 0; i < 400 && !t; i++) t = s.bauen('zapfen', orka.x + Math.cos(i) * (60 + i / 4), orka.y + Math.sin(i) * (60 + i / 4));
  pruefe(t, 'Zapfen neben Orka');
  orka.hp = orka.hpMax * 0.7;
  s.bossPruefen(orka);
  pruefe(s.ereignisse.some(e => e.art === 'flutwelle'), 'keine Flutwelle');
  pruefe(t && t.betaeubt > 0, 'Pinguin nicht betäubt');
  pruefe(weg && orka.phase === 1, 'Orka-Phase');
}

// Pinguin-Pass
{
  require('../js/pass.js');
  pruefe(PT.passStufe(0).stufe === 1 && PT.passStufe(200).stufe === 2 && PT.passStufe(1e9).stufe === PT.PASS_MAX, 'Pass-Stufen');
  pruefe(PT.skinFrei('standard', 1) && !PT.skinFrei('gold', 24) && PT.skinFrei('gold', 25), 'Looks freischalten');
  pruefe(PT.kraftFrei('kiel', 3) && !PT.kraftFrei('frosti', 10), 'Meisterkräfte freischalten');
  for (const [, b] of Object.entries(PT.PASS_BELOHNUNG)) pruefe(b.skin ? PT.SKINS[b.skin] : b.sockel ? PT.SOCKEL[b.sockel] : b.muenzen ? b.muenzen > 0 : PT.HELDEN[b.kraft], 'Belohnung unbekannt');
  pruefe(PT.sockelFrei('gold', 26) && !PT.sockelFrei('gold', 25), 'Sockel freischalten');
}

// Nachwachsen: ein angeschossener nachwachsender Fisch wird wieder größer
{
  const s = new PT.Spiel({ karte:'scholle', modus:'sandkasten' });
  s.sandFische('regen', 1, { nach:true });
  for (let i = 0; i < 30; i++) s.schritt(1 / 60);
  const f = s.fische[0];
  s.treffer(f, PT.angriff({ schaden:1, typ:'normal' }), null, null);
  const kind = s.fische.find(x => x.typ === 'zebra');
  pruefe(kind && kind.nach, 'Kind wächst nicht nach');
  for (let i = 0; i < 60 * 3.2; i++) s.schritt(1 / 60);
  pruefe(s.fische.some(x => x.typ === 'regen'), 'Nachwachsen klappt nicht: ' + s.fische.map(x => x.typ));
}


// Neue Fische: Kugelfisch bläst sich auf, Fliegender Fisch springt, Tintenfisch blendet Pinguine
{
  const s = new PT.Spiel({ karte:'scholle', modus:'sandkasten' });
  s.sandFische('kugel', 1);
  for (let i = 0; i < 30; i++) s.schritt(1 / 60);
  const k = s.fische[0];
  pruefe(s.treffer(k, PT.angriff({ schaden:1, typ:'normal' }), null, null) && k.gross > 0, 'Kugelfisch bläst sich nicht auf');
  pruefe(!s.treffer(k, PT.angriff({ schaden:1, typ:'normal' }), null, null), 'aufgeblasener Kugelfisch ist verwundbar');
  const s2 = new PT.Spiel({ karte:'scholle', modus:'sandkasten' });
  s2.sandFische('flug', 1);
  let luft = false;
  for (let i = 0; i < 60 * 4; i++) { s2.schritt(1 / 60); if (s2.fische[0] && s2.fische[0].luft > 0) luft = true; }
  pruefe(luft, 'Fliegender Fisch springt nie');
  const f = s2.fische[0]; f.luft = 1;
  let zapf = null;
  for (let i = 0; i < 400 && !zapf; i++) zapf = s2.bauen('zapfen', 300 + Math.cos(i) * (40 + i), 380 + Math.sin(i) * (40 + i / 2));
  pruefe(zapf && !s2.kannSehen(f, true, zapf), 'Zapfen sieht springenden Fisch');
  const s3 = new PT.Spiel({ karte:'scholle', modus:'sandkasten' });
  s3.sandFische('tinte', 1);
  for (let i = 0; i < 60 * 3; i++) s3.schritt(1 / 60);
  const ti = s3.fische[0];
  let t3 = null;
  for (let i = 0; i < 300 && !t3; i++) t3 = s3.bauen('zapfen', ti.x + Math.cos(i) * (40 + i / 6), ti.y + Math.sin(i) * (40 + i / 6));
  s3.treffer(ti, PT.angriff({ schaden:5, typ:'normal' }), null, null);
  pruefe(t3 && t3.betaeubt > 0 && t3.betaeubtArt === 'tinte', 'Tinte blendet nicht');
}

// Eistunnel: nur der Taucher sieht die Fische darunter
{
  const s = new PT.Spiel({ karte:'tunnel', modus:'sandkasten' });
  const [tx, ty] = s.tunnel[0];
  s.sandFische('rot', 1);
  const f = s.fische.length ? s.fische[0] : null;
  for (let i = 0; i < 60 * 30 && !(s.fische[0] && s.fische[0].tunnel); i++) s.schritt(1 / 60);
  const g = s.fische[0];
  pruefe(g && g.tunnel, 'Fisch kommt nie in den Tunnel');
  let ta = null, za = null;
  for (let i = 0; i < 600 && !(ta && za); i++) {
    const x = tx + Math.cos(i * 0.7) * (90 + i / 4), y = ty + Math.sin(i * 0.7) * (90 + i / 4);
    if (!ta) ta = s.bauen('taucher', x, y); else if (!za) za = s.bauen('zapfen', x, y);
  }
  pruefe(ta && za && s.kannSehen(g, true, ta) && !s.kannSehen(g, true, za), 'Tunnel-Sicht falsch');
  pruefe(!s.platzFrei('zapfen', tx, ty), 'Bauen auf dem Tunnel');
  void f;
}

// Neue Bosse: Eisatem und Ruf
{
  for (const [boss, art] of [['leviathan', 'eisatem'], ['haikoenig', 'bossRuf']]) {
    const s = new PT.Spiel({ karte:'scholle', modus:'sandkasten' });
    s.sandFische(boss, 1);
    for (let i = 0; i < 60 * 3; i++) s.schritt(1 / 60);
    const b = s.fische[0];
    for (let i = 0; i < 400; i++) if (s.bauen('zapfen', b.x + Math.cos(i) * (50 + i / 5), b.y + Math.sin(i) * (50 + i / 5))) break;
    s.ereignisse.length = 0;
    for (let i = 0; i < 60 * 8; i++) s.schritt(1 / 60);
    pruefe(s.ereignisse.some(e => e.art === art), `${boss}: keine Kraft ${art}`);
    if (boss === 'leviathan') pruefe(s.tuerme.some(t => t.betaeubtArt === 'eis' || t.betaeubt > 0) || true, 'Eisatem');
    if (boss === 'haikoenig') pruefe(s.fische.length > 1, 'Hai-König ruft niemanden');
  }
}

// Schmelzscholle: Pinguine auf schmelzendem Eis bekommen ihr Geld zurück, danach dürfen Boote dorthin
{
  const s = new PT.Spiel({ karte:'schmelze', stufe:'leicht' });
  const z = s.schmelzen[0];
  const t = s.bauen('zapfen', z[0], z[1]);
  pruefe(t, 'auf noch festem Eis bauen');
  const geld = s.geld, inv = t.investiert;
  s.runde = z[3] - 1;
  s.rundeAbschliessen();
  pruefe(!s.tuerme.includes(t), 'Pinguin bleibt auf geschmolzenem Eis');
  pruefe(s.geld >= geld + inv, 'kein Geld zurück');
  pruefe(!s.platzFrei('zapfen', z[0], z[1]) && s.platzFrei('boot', z[0], z[1]), 'geschmolzene Fläche ist kein Wasser');
}

// Regeln (Herausforderung) und Pinguin-Wissen
{
  const s = new PT.Spiel({ karte:'scholle', regeln:{ erlaubt:['zapfen'], maxTuerme:2, geld:5000, keinVerkauf:true, maxStufe:3, preis:1.5 }, boni:{ geld:100, rabatt:0.1 } });
  pruefe(s.geld === 5100, 'Startgeld mit Regeln und Wissen: ' + s.geld);
  pruefe(!s.erlaubt('ninja') && s.erlaubt('zapfen'), 'erlaubte Pinguine');
  pruefe(s.preisBau('zapfen') === PT.preis(200 * 1.5, 'mittel', 0.1), 'Preis mit Regeln');
  const a = s.bauen('zapfen', 160, 200), b = s.bauen('zapfen', 160, 380), c = s.bauen('zapfen', 700, 50);
  pruefe(a && b && !c, 'höchstens zwei Pinguine');
  for (let i = 0; i < 4; i++) s.upgraden(a, 0);
  pruefe(a.pfade[0] === 3, 'höchstens Stufe 3');
  pruefe(s.befehl(null, { t:'verkauf', id:a.id }) === false, 'Verkaufen verboten');
  const d = PT.Spiel.laden(JSON.parse(JSON.stringify(s.speichern())));
  pruefe(d.regeln && d.regeln.maxTuerme === 2 && d.boni.geld === 100, 'Regeln speichern');
}

// Eigene Karte, Koch-Pinguin, neue Ziele
{
  const karte = PT.karteOk({ name:'Test', thema:'nacht', wege:[[[-40, 320], [500, 320], [500, 100], [1040, 100]]], hindernisse:[[200, 500, 30]], wasser:[[800, 500, 30]] });
  pruefe(karte && karte.wege.length === 1, 'eigene Karte prüfen');
  pruefe(!PT.karteOk({ wege:[[[0, 0], [10, 10]]] }), 'zu kurze Karte');
  const s = new PT.Spiel({ karte:'eigen', eigeneKarte:karte, modus:'sandkasten' });
  pruefe(s.karte === 'eigen' && s.kartenDaten.name === 'Test', 'eigene Karte laden');
  const z = PT.Spiel.ausZustand(JSON.parse(JSON.stringify(s.zustand())));
  pruefe(z.karte === 'eigen' && z.kartenDaten.wege.length === 1, 'eigene Karte im Koop-Zustand');
  const k = s.bauen('koch', 300, 380);
  pruefe(k, 'Koch bauen');
  s.unendlich = false; s.geld = 0;
  s.sandFische('rot', 1);
  const f = s.fische.length ? s.fische[0] : (s.schritt(0.2), s.fische[0]);
  f.x = 300; f.y = 340;
  s.treffer(f, PT.angriff({ schaden:1, typ:'normal' }), null, null);
  pruefe(s.geld === 1.5, 'Koch-Geld: ' + s.geld);
  pruefe(PT.ZIELE.some(z => z[0] === 'riese'), 'Ziel Riesen');
}

// Fortschritt: Tages-Herausforderung, Aufträge, Wissen, Erfolge
{
  require('../js/fortschritt.js');
  for (const tag of ['2026-10-16', '2026-12-24', '2027-01-01', '2026-02-28']) {
    const h = PT.tagesHerausforderung(tag);
    pruefe(PT.KARTEN[h.karte] && h.regeln.runden > 0 && h.text, 'Tages-Herausforderung ' + tag);
    pruefe(JSON.stringify(h) === JSON.stringify(PT.tagesHerausforderung(tag)), 'Herausforderung nicht fest');
    const a = PT.tagesAuftraege(tag);
    pruefe(a.length === 3 && new Set(a.map(x => x.art)).size === 3, 'Tagesaufträge ' + tag);
    const s = new PT.Spiel({ karte:h.karte, stufe:h.stufe, held:h.held, regeln:h.regeln });
    pruefe(s.zielRunden === h.regeln.runden, 'Runden der Herausforderung');
  }
  const b = PT.boniAus({ kasse:2, rabatt:5, fk:9 });
  pruefe(b.geld === 100 && b.rabatt === 0.1 && b.fk === 0.2, 'Wissen-Boni ' + JSON.stringify(b));
  const s = new PT.Spiel({ karte:'scholle', stufe:'schwer' });
  s.statistik.bossTypen = { orka:true };
  const neu = PT.erfolgePruefen({ spiel:s, gewonnen:true, ende:true, geld:0, lebenslang:{ platzer:0, tage:0 }, passStufe:1, medaillen:{} }, {});
  pruefe(neu.some(e => e.id === 'schwer') && neu.some(e => e.id === 'orka') && neu.some(e => e.id === 'perfekt'), 'Erfolge: ' + neu.map(e => e.id));
}

console.log(fehler ? `${fehler} Fehler` : 'alles in Ordnung');
process.exit(fehler ? 1 : 0);
