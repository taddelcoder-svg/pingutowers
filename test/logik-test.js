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
  if (modus === 'sandkasten') { s.sandFische('krakus', 1); s.sandFische('krake', 1); }
  const ziel = modus === 'boss' ? 21 : 6;
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

console.log(fehler ? `${fehler} Fehler` : 'alles in Ordnung');
process.exit(fehler ? 1 : 0);
