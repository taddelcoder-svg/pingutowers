'use strict';
// Test der neuen Funktionen: Mutanten-Wellen, Kombos, Wechselwasser (wechselnde Kanäle), Boss-Rush, Seed beim Speichern.
// node test/neu-test.js
const PT = require('../js/pinguine.js');
require('../js/logik.js');
require('../js/fortschritt.js');

let fehler = 0;
function pruefe(bedingung, text) { if (!bedingung) { fehler++; console.log('FEHLER:', text); } }
const schlag = { typ:'spitz', schaden:1, riesen:0, durchschlag:1 };
function spielMit(opt) { return new PT.Spiel({ karte:'scholle', stufe:'leicht', modus:'mutation', ...opt }); }

/* ---------- Mutationen ---------- */
{
  pruefe(PT.mutationFuer(1, 5) === null && PT.mutationFuer(2, 5) === null, 'Runde 1 und 2 ohne Mutation');
  const gesehen = new Set();
  for (let n = 3; n < 200; n++) gesehen.add(PT.mutationFuer(n, 777));
  pruefe(PT.MUTATIONEN_REIHE.every(m => gesehen.has(m)), 'alle Mutationen kommen vor: ' + [...gesehen]);
  pruefe(PT.mutationFuer(9, 123) === PT.mutationFuer(9, 123), 'Mutation ist fest');

  // jede Mutation in einer echten Runde: Warteschlange, Fische, Treffer
  for (const m of PT.MUTATIONEN_REIHE) {
    let seed = 1;
    while (PT.mutationFuer(3, seed) !== m) seed++;
    const s = spielMit({ seed });
    s.runde = 2;
    s.rundeStarten();
    pruefe(s.mutation === m, `Runde 3 hat Mutation ${m}`);
    pruefe(s.warteschlange.length > 0 && s.warteschlange.every(q => q.mut === m), `Warteschlange trägt ${m}`);
    if (m === 'tarn') pruefe(s.warteschlange.every(q => q.camo), 'Tarnung: alle getarnt');
    if (m === 'heilen') pruefe(s.warteschlange.every(q => q.nach), 'Heilen: alle nachwachsend');
    const e = s.ereignisse.find(x => x.art === 'rundeStart');
    pruefe(e && e.mutation === m, 'rundeStart nennt die Mutation');
  }
  {
    const s = spielMit();
    const f = s.neuerFisch('blau', 0, { mut:'schild' });
    pruefe(f.mutSchild === 1, 'Schild gesetzt');
    s.treffer(f, schlag, null, null);
    pruefe(!f.tot && f.hp === 1 && f.mutSchild === 0, 'Schild schluckt den ersten Treffer');
    s.treffer(f, schlag, null, null);
    pruefe(f.tot, 'zweiter Treffer platzt');
    const kind = s.fische.find(x => !x.tot && x.typ === 'rot');
    pruefe(kind && kind.mutSchild === 0, 'Kinder erben das Schild nicht');
  }
  {
    const s = spielMit();
    const f = s.neuerFisch('gruen', 0, { mut:'teilung' });
    s.treffer(f, schlag, null, null);
    pruefe(s.fische.filter(x => !x.tot && x.typ === 'blau').length === 2, 'Teilung: ein Fisch mehr');
    const g = s.neuerFisch('gruen', 0, {});
    const vorher = s.fische.length;
    s.treffer(g, schlag, null, null);
    pruefe(s.fische.length - vorher === 1, 'ohne Teilung: ein Kind');
  }
  {
    const s = spielMit();
    const a = s.neuerFisch('blau', 0, {}), b = s.neuerFisch('blau', 0, { mut:'eilig' });
    pruefe(Math.abs(s.tempo(b) / s.tempo(a) - 1.3) < 1e-9, 'Eile: 30 % schneller');
  }
  {
    // Spielstand mitten in der Runde (Koop) und Speichern zwischen Runden behalten den Startwert
    const s = spielMit({ seed:4711 });
    s.runde = 4; s.rundeStarten();
    const z = JSON.parse(JSON.stringify(s.zustand()));
    const t = PT.Spiel.ausZustand(z);
    pruefe(t.seed === 4711 && t.mutation === s.mutation && t.mutationen, 'Zustand behält Seed und Mutation');
    const sp = PT.Spiel.laden(JSON.parse(JSON.stringify(spielMit({ seed:4711 }).speichern())));
    pruefe(sp.seed === 4711, 'Speichern behält den Seed');
    // gleiche Eingaben, gleicher Verlauf
    const a = spielMit({ seed:99 }), b = spielMit({ seed:99 });
    for (const x of [a, b]) { x.runde = 5; x.rundeStarten(); for (let i = 0; i < 600; i++) x.schritt(1 / 30); }
    pruefe(a.pruefsumme() === b.pruefsumme(), 'Mutations-Runde ist deterministisch');
  }
  // ohne Modus keine Mutation, mit Tagesregel schon
  const o = new PT.Spiel({ karte:'scholle', modus:'standard' }); o.runde = 4; o.rundeStarten();
  pruefe(o.mutation === null, 'Standard: keine Mutation');
  const r = new PT.Spiel({ karte:'scholle', modus:'standard', regeln:{ mutation:true }, seed:5 }); r.runde = 4; r.rundeStarten();
  pruefe(r.mutation === PT.mutationFuer(5, 5), 'Tagesregel schaltet Mutationen ein');
  const tage = new Set();
  for (let d = 1; d <= 28; d++) { const h = PT.tagesHerausforderung('2026-11-' + String(d).padStart(2, '0')); if (h.regeln.mutation) tage.add(h.titel); pruefe(Number.isInteger(h.seed), 'Tages-Seed'); }
}

/* ---------- Kombos ---------- */
{
  const s = new PT.Spiel({ karte:'scholle', stufe:'leicht', modus:'sandkasten' });
  const a = s.bauen('frost', 300, 300), b = s.bauen('schneeball', 360, 300), c = s.bauen('zapfen', 520, 450);
  pruefe(a && b && c, 'Kombo-Pinguine gebaut');
  const grund = PT.werteFuer('frost', [0, 0, 0], 1).angriffe[0].intervall;
  pruefe(a.eff.kombo && a.eff.kombo.name === 'Blizzard' && b.eff.kombo, 'Blizzard entsteht');
  pruefe(Math.abs(a.eff.angriffe[0].intervall - grund * 0.82) < 1e-9, 'Blizzard macht schneller');
  pruefe(!c.eff.kombo, 'ohne Partner keine Kombo');
  s.verkaufen(b);
  pruefe(!a.eff.kombo && Math.abs(a.eff.angriffe[0].intervall - grund) < 1e-9, 'Kombo endet mit dem Partner');
  // zu weit weg
  const w = s.bauen('schneeball', 500, 300);
  pruefe(w && !a.eff.kombo, 'zu weit entfernt: keine Kombo');
  for (const k of PT.KOMBOS) pruefe(PT.PINGUINE[k.a] && PT.PINGUINE[k.b], 'Kombo-Typen gibt es: ' + k.name);
  // Zustand überlebt den Koop-Abgleich
  const z = PT.Spiel.ausZustand(JSON.parse(JSON.stringify(s.zustand())));
  pruefe(z.tuerme.length === s.tuerme.length, 'Zustand mit Kombos');
}

/* ---------- Wechselwasser ---------- */
{
  const K = PT.KARTEN.wechselwasser;
  pruefe(K && K.wege.length === 2 && K.wechsel.alle === 6, 'Karte Wechselwasser');
  for (const [n, soll] of [[1, 0], [6, 0], [7, 1], [12, 1], [13, 0], [19, 1]]) pruefe(PT.offeneWege(K, n, 2)[0] === soll, `Runde ${n}: Kanal ${soll} offen`);
  pruefe(PT.offeneWege(PT.KARTEN.doppel, 7, 2).length === 2, 'andere Karten: alle Kanäle offen');
  const s = new PT.Spiel({ karte:'wechselwasser', stufe:'leicht' });
  pruefe(s.geldFaktor === 1, 'Wechselwasser ohne Kanal-Bonus');
  s.runde = 3; s.rundeStarten();
  pruefe(s.warteschlange.every(q => q.p === 0), 'Runde 4: alle in Kanal 1');
  const t = new PT.Spiel({ karte:'wechselwasser', stufe:'leicht' });
  t.runde = 6; t.rundeStarten();
  pruefe(t.warteschlange.length > 0 && t.warteschlange.every(q => q.p === 1), 'Runde 7: alle in Kanal 2');
  // Fische, die schon schwimmen, bleiben in ihrem Kanal; Wechsel wird am Ende von Runde 6 angekündigt
  const u = new PT.Spiel({ karte:'wechselwasser', stufe:'leicht' });
  u.runde = 5; u.laeuft = true; u.ereignisse = [];
  u.rundeAbschliessen();
  pruefe(u.ereignisse.some(e => e.art === 'tauWechsel' && e.offen[0] === 1), 'Wechsel wird angekündigt');
  u.runde = 4; u.ereignisse = []; u.rundeAbschliessen();
  pruefe(u.ereignisse.some(e => e.art === 'wegWarnung'), 'Warnung eine Runde vorher');
  // ein ganzes Spiel über den Wechsel hinweg
  const v = new PT.Spiel({ karte:'wechselwasser', stufe:'leicht', modus:'sandkasten' });
  v.sandFische('rot', 6);
  pruefe(v.warteschlange.every(q => q.p === 0), 'Sandkasten nutzt den offenen Kanal');
  for (let i = 0; i < 90; i++) v.schritt(1 / 30);
  pruefe(v.fische.some(f => f.p === 0), 'Fische schwimmen');
  // Baukarte hat Platz für Pinguine
  const w = new PT.Spiel({ karte:'wechselwasser', stufe:'leicht', modus:'sandkasten' });
  let frei = 0;
  for (let x = 40; x < 1000; x += 40) for (let y = 40; y < 620; y += 40) if (w.platzFrei('zapfen', x, y)) frei++;
  pruefe(frei > 40, 'Wechselwasser hat genug Bauplätze: ' + frei);
}

/* ---------- Boss-Rush ---------- */
{
  const plan = PT.bossPlan('bossrush');
  pruefe(Object.keys(plan).length === 8 && plan[10][0] === 'krakus' && plan[80][1] === 2, 'Boss-Rush-Plan');
  pruefe(PT.bossPlan('standard') && Object.keys(PT.bossPlan('standard')).length === 0, 'Standard ohne Boss');
  pruefe(PT.bossPlan('orka')[25][0] === 'orka' && PT.bossPlan('orka')[50][1] === 2, 'Orka-Modus wie vorher');
  const s = new PT.Spiel({ karte:'scholle', stufe:'leicht', modus:'bossrush' });
  pruefe(s.zielRunden === 80, 'Boss-Rush hat 80 Runden');
  s.runde = 19; s.rundeStarten();
  pruefe(s.ereignisse.some(e => e.art === 'rundeStart' && e.bossTyp === 'orka' && e.boss === 1), 'Runde 20: Kaiser Orka');
  for (let i = 0; i < 40; i++) s.schritt(1 / 30);
  const boss = s.fische.find(f => f.boss);
  pruefe(boss && boss.typ === 'orka', 'Orka schwimmt');
  const v0 = s.tempo(boss);
  boss.hp = boss.hpMax * 0.7; s.bossPruefen(boss);
  pruefe(boss.phase >= 1 && s.tempo(boss) > v0 * 1.1, 'Boss wird mit jeder Phase schneller');
  const n = new PT.Spiel({ karte:'scholle', stufe:'leicht', modus:'orka' });
  n.runde = 24; n.rundeStarten(); for (let i = 0; i < 40; i++) n.schritt(1 / 30);
  const o = n.fische.find(f => f.boss), v1 = n.tempo(o);
  o.hp = o.hpMax * 0.7; n.bossPruefen(o);
  pruefe(Math.abs(n.tempo(o) - v1) < 1e-9, 'andere Modi: Boss bleibt gleich schnell');
}

/* ---------- Koop-Rollen ---------- */
{
  const spieler = [{ id:'a', name:'A', held:'kiel', rolle:'baumeister' }, { id:'b', name:'B', held:null, rolle:'heiler' },
    { id:'c', name:'C', held:'aurora', rolle:'taktiker' }, { id:'d', name:'D', held:'frosti', rolle:'trainer' }];
  const s = new PT.Spiel({ karte:'scholle', stufe:'mittel', spieler, geldModus:'geteilt' });
  s.geld = 99999;
  pruefe(s.spieler.map(x => x.rolle).join() === 'baumeister,heiler,taktiker,trainer', 'Rollen übernommen');
  const ohne = new PT.Spiel({ karte:'scholle', stufe:'mittel', spieler:spieler.map(x => ({ ...x, rolle:'bogus' })) });
  pruefe(ohne.spieler.every(x => x.rolle === null), 'unbekannte Rolle fliegt raus');
  // Baumeister: Upgrades 10 % billiger, aber nur für die eigenen Pinguine
  // freie Plätze suchen, mindestens 120 Pixel voneinander (sonst gäbe es Kombos oder Platzprobleme)
  const plaetze = [];
  for (let y = 60; y < 600; y += 30) for (let x = 60; x < 980; x += 30) if (s.platzFrei('zapfen', x, y) && plaetze.every(p => Math.hypot(p[0] - x, p[1] - y) > 120)) plaetze.push([x, y]);
  pruefe(plaetze.length >= 5, 'genug Plätze');
  const [p1, p2, p3, p4, p5] = plaetze;
  const ta = s.bauen('zapfen', p1[0], p1[1], 'a'), tb = s.bauen('zapfen', p2[0], p2[1], 'b');
  const pa = s.preisUpgrade(ta, 0), pb = s.preisUpgrade(tb, 0);
  pruefe(pa < pb && Math.abs(pa / pb - 0.9) < 0.06, `Baumeister-Rabatt ${pa} vs ${pb}`);
  // Taktiker: mehr Reichweite und schneller
  const tc = s.bauen('zapfen', p3[0], p3[1], 'c');
  pruefe(tc.eff.reichweite > tb.eff.reichweite * 1.09 && tc.eff.angriffe[0].intervall < tb.eff.angriffe[0].intervall, 'Taktiker verstärkt');
  // Heldentrainer: 50 % mehr Erfahrung
  const hd = s.bauen('frosti', p4[0], p4[1], 'd'), hk = s.bauen('kiel', p5[0], p5[1], 'a');
  if (hd && hk) { s.heldErfahrung(hd, 100); s.heldErfahrung(hk, 100); pruefe(Math.abs(hd.xp / hk.xp - 1.5) < 1e-9, 'Heldentrainer'); }
  else pruefe(false, 'Helden gebaut');
  // Heiler: +2 Leben, nie über Start
  s.leben = 100; s.ereignisse = []; s.rundeAbschliessen();
  pruefe(s.leben === 102, 'Heiler gibt 2 Leben: ' + s.leben);
  s.leben = s.startLeben - 1; s.rundeAbschliessen();
  pruefe(s.leben === s.startLeben, 'nicht über die Startleben');
  const z = PT.Spiel.ausZustand(JSON.parse(JSON.stringify(s.zustand())));
  pruefe(z.spieler.map(x => x.rolle).join() === 'baumeister,heiler,taktiker,trainer', 'Rollen im Zustand');
  pruefe(z.tuerme.find(t => t.id === tc.id).eff.reichweite === tc.eff.reichweite, 'Taktiker nach Zustandsabgleich gleich');
}

console.log(fehler ? `${fehler} Fehler` : 'Neue Funktionen: alles in Ordnung');
process.exit(fehler ? 1 : 0);
