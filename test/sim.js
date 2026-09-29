'use strict';
// Balance-Test ohne Grafik: ein Bot baut nach einem festen Plan und spielt so weit er kommt.
// node test/sim.js [karte] [stufe]
const PT = require('../js/daten.js');
require('../js/logik.js');

const karte = process.argv[2] || 'scholle';
const stufe = process.argv[3] || 'mittel';
const s = new PT.Spiel({ karte, stufe, runden:60 });

// Bauplätze nach Abdeckung des Wegs sortieren
function platzFuer(typ, reichweite) {
  let best = null, bw = -1;
  for (let x = 20; x < 1000; x += 12) for (let y = 20; y < 640; y += 12) {
    if (!s.platzFrei(typ, x, y)) continue;
    let w = 0;
    for (let i = 0; i < s.weg.pts.length; i += 5) {
      const [px, py] = s.weg.pts[i];
      if (px < 0 || px > 1000 || py < 0 || py > 640) continue;
      if (Math.hypot(px - x, py - y) <= reichweite) w += 1 + i / s.weg.pts.length * 0.3;
    }
    if (w > bw) { bw = w; best = [x, y]; }
  }
  return best;
}

const plan = [
  ['bau', 'zapfen'], ['bau', 'zapfen'], ['bau', 'zapfen'],
  ['up', 0, 1], ['up', 1, 1], ['up', 0, 1], ['up', 1, 1],
  ['bau', 'rundum'], ['up', 3, 1], ['up', 3, 0],
  ['bau', 'schneeball'], ['up', 4, 0], ['up', 4, 1],
  ['up', 0, 2], ['up', 0, 2],
  ['bau', 'polar'], ['up', 5, 1], ['up', 5, 1], ['up', 5, 0],
  ['bau', 'markt'], ['up', 6, 2],
  ['up', 4, 1], ['up', 5, 0],
  ['bau', 'harpune'], ['up', 7, 1], ['up', 7, 2], ['up', 7, 2],
  ['up', 1, 2], ['up', 1, 2],
  ['up', 2, 1], ['up', 2, 1], ['up', 2, 2], ['up', 2, 2],
  ['bau', 'frost'], ['up', 8, 2], ['up', 8, 2], ['up', 8, 0],
  ['up', 5, 0], ['up', 4, 0], ['up', 4, 1],
  ['up', 7, 0], ['up', 7, 0],
  ['bau', 'haeuptling'], ['up', 9, 0], ['up', 9, 0],
  ['up', 6, 2], ['up', 6, 2],
  ['up', 1, 2], ['up', 0, 2], ['up', 4, 0],
  ['up', 7, 2], ['up', 7, 0], ['up', 5, 0],
  ['bau', 'schneeball'], ['up', 10, 1], ['up', 10, 1], ['up', 10, 1], ['up', 10, 0], ['up', 10, 0], ['up', 10, 1],
  ['up', 3, 1], ['up', 3, 1], ['up', 3, 0]
];
let schritt = 0;
function planAusfuehren() {
  while (schritt < plan.length) {
    const p = plan[schritt];
    if (p[0] === 'bau') {
      const R = PT.werteFuer(p[1], [0, 0, 0]).reichweite;
      const pos = p.pos || (p.pos = platzFuer(p[1], Math.min(R, 200)));
      if (!pos) { schritt++; continue; }
      if (s.preisBau(p[1], ...pos) > s.geld) return;
      s.bauen(p[1], ...pos);
    } else {
      const t = s.tuerme[p[1]];
      if (!t || !PT.upgradeErlaubt(t.pfade, p[2])) { schritt++; continue; }
      if (s.preisUpgrade(t, p[2]) > s.geld) return;
      s.upgraden(t, p[2]);
    }
    schritt++;
  }
}

const start = Date.now();
while (!s.vorbei && s.runde < 60) {
  planAusfuehren();
  s.rundeStarten();
  let n = 0;
  while (s.laeuft && !s.vorbei && n < 60 * 600) { s.schritt(1 / 60); n++; if (n % 30 === 0) planAusfuehren(); }
  if (s.runde % 5 === 0 || s.vorbei) {
    console.log(`Runde ${s.runde}${s.vorbei ? ' (verloren in ' + (s.runde + 1) + ')' : ''}: Leben ${s.leben}, Geld ${s.geld}, Plan ${schritt}/${plan.length}, ` +
      s.tuerme.map(t => t.typ.slice(0, 4) + t.pfade.join('')).join(' '));
  }
}
console.log(`fertig in ${Date.now() - start} ms, Platzer ${s.statistik.platzer}, geleakt ${s.statistik.geleakt}`);
