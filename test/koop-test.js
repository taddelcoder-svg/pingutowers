'use strict';
// Koop ohne WebSocket: zwei Spieler in einem Raum, Befehle, Takte, Prüfsummen, Wiederverbinden, Abweichung.
// Die "Browser" hier rechnen genauso nach wie js/oberflaeche.js. node test/koop-test.js
const PT = require('../js/pinguine.js');
require('../js/logik.js');
const { raeume } = require('../raeume');

let fehler = 0;
function pruefe(bedingung, text) { if (!bedingung) { fehler++; console.log('FEHLER:', text); } }

let uhr = 1_000_000;
const R = raeume({ jetzt:() => uhr, seed:() => 4242 });

// Ein nachrechnender Browser
function browser(name) {
  const b = { name, posteingang:[], spiel:null, takt:0, serverTakt:0, befehle:new Map(), raum:null, id:null, token:null, zustaende:0, erfolge:[] };
  b.transport = { send:t => b.posteingang.push(JSON.parse(t)), close:() => {} };
  b.v = R.verbinden(b.transport);
  b.schicken = d => b.v.nachricht(JSON.stringify(d));
  b.verarbeiten = () => {
    for (const m of b.posteingang.splice(0)) {
      if (m.t === 'du') { b.id = m.id; b.token = m.token; }
      if (m.t === 'raum') b.raum = m;
      if (m.t === 'fehler') b.fehler = m.text;
      if (m.t === 'zustand') {
        b.spiel = PT.Spiel.ausZustand(m.z); b.takt = m.n; b.serverTakt = Math.max(b.serverTakt, m.n); b.zustaende++;
        for (const k of [...b.befehle.keys()]) if (k <= m.n) b.befehle.delete(k);
      }
      if (m.t === 'takt') {
        b.serverTakt = m.n;
        for (const [k, sp, bef] of m.b) { if (!b.befehle.has(k)) b.befehle.set(k, []); b.befehle.get(k).push([sp, bef]); }
      }
    }
  };
  // bis zum Servertakt nachrechnen
  b.rechnen = (max = Infinity) => {
    let n = 0;
    while (b.spiel && b.takt < b.serverTakt && n < max) {
      const k = ++b.takt; n++;
      for (const [sp, bef] of b.befehle.get(k) || []) { const r = b.spiel.befehl(sp, bef); if (sp === b.id) b.erfolge.push([bef.t, !!r]); }
      b.befehle.delete(k);
      b.spiel.schritt(1 / 60);
      b.spiel.ereignisse.length = 0;
      if (k % 60 === 0) b.schicken({ t:'p', n:k, h:b.spiel.pruefsumme() });
    }
  };
  return b;
}
function laufen(ms, browsers, mitte) {
  for (let t = 0; t < ms; t += 50) {
    uhr += 50;
    R.takt();
    for (const b of browsers) { b.verarbeiten(); b.rechnen(); }
    if (mitte) mitte(t);
  }
}

const a = browser('Anna'), b = browser('Ben');
a.schicken({ t:'hallo', name:'Anna', skin:'kaiser' }); b.schicken({ t:'hallo', name:'Ben' });
a.schicken({ t:'erstellen' });
a.verarbeiten();
pruefe(a.raum && a.raum.code && a.raum.host === a.id, 'Raum erstellt, Anna ist Gastgeberin');
b.schicken({ t:'beitreten', code:a.raum.code.toLowerCase() });
b.verarbeiten(); a.verarbeiten();
pruefe(b.raum && b.raum.mitglieder.length === 2, 'Ben ist im Raum');
b.schicken({ t:'einst', karte:'nacht' });
a.verarbeiten();
pruefe(a.raum.einst.karte === 'scholle', 'nur der Gastgeber stellt die Karte ein');
a.schicken({ t:'einst', karte:'kreuz', stufe:'leicht', modus:'standard', geldModus:'getrennt' });
a.schicken({ t:'wahl', held:'aurora', kraft:true, skin:'gold' });
b.schicken({ t:'wahl', held:'kiel', kraft:false, skin:'standard' });
b.schicken({ t:'start' });
a.verarbeiten(); b.verarbeiten();
pruefe(a.raum.phase === 'lobby', 'nur der Gastgeber startet');
a.schicken({ t:'start' });
a.verarbeiten(); b.verarbeiten();
pruefe(a.spiel && b.spiel && a.spiel.koop && a.spiel.spieler.length === 2, 'Spiel gestartet, zwei Spieler');
pruefe(a.spiel.geldModus === 'getrennt' && a.spiel.kasse(a.id).geld === 650 && a.spiel.kasse(b.id).geld === 650, 'getrenntes Startgeld');

// Bauen: jeder seinen Helden und Pinguine
const sp = a.spiel;
const platz = (typ, i0) => { for (let i = i0; i < i0 + 4000; i++) { const p = sp.weg.pts[(i * 37) % sp.weg.pts.length]; const x = p[0] + Math.cos(i) * 56, y = p[1] + Math.sin(i) * 56; if (sp.platzFrei(typ, x, y)) return [x, y]; } return null; };
let [x, y] = platz('aurora', 0);
a.schicken({ t:'b', b:{ t:'bau', typ:'aurora', x, y, ref:1 } });
[x, y] = platz('zapfen', 200);
b.schicken({ t:'b', b:{ t:'bau', typ:'zapfen', x, y } });
[x, y] = platz('kiel', 400);
b.schicken({ t:'b', b:{ t:'bau', typ:'aurora', x, y } });   // falscher Held
laufen(200, [a, b]);
pruefe(a.spiel.tuerme.length === 2 && b.spiel.tuerme.length === 2, `zwei Pinguine gebaut (${a.spiel.tuerme.length}/${b.spiel.tuerme.length})`);
const aurora = a.spiel.tuerme.find(t => t.typ === 'aurora'), zapfen = a.spiel.tuerme.find(t => t.typ === 'zapfen');
pruefe(aurora && aurora.besitzer === a.id && aurora.kraft, 'Aurora gehört Anna, mit Meisterkraft');
pruefe(zapfen && zapfen.besitzer === b.id, 'Zapfen gehört Ben');
pruefe(Math.round(a.spiel.kasse(a.id).geld) === 650 - PT.preis(700, 'leicht') && Math.round(a.spiel.kasse(b.id).geld) === 650 - PT.preis(200, 'leicht'), 'jeder zahlt selbst');
pruefe(b.erfolge.some(e => e[0] === 'bau' && !e[1]), 'falscher Held wird abgelehnt');
// Fremden Pinguin aufrüsten geht bei getrenntem Geld nicht
a.schicken({ t:'b', b:{ t:'up', id:zapfen.id, pfad:0 } });
b.schicken({ t:'b', b:{ t:'up', id:zapfen.id, pfad:1 } });
laufen(150, [a, b]);
const z2 = a.spiel.tuerme.find(t => t.id === zapfen.id);
pruefe(z2.pfade.join() === '0,1,0', 'nur der Besitzer rüstet auf: ' + z2.pfade);

// Runden spielen (Auto), Tempo 3
a.schicken({ t:'auto', an:true });
b.schicken({ t:'tempo', tempo:3 });
a.schicken({ t:'b', b:{ t:'start', runde:1 } });
b.schicken({ t:'b', b:{ t:'start', runde:1 } });   // doppelt gedrückt
let gebaut = 0;
laufen(60_000, [a, b], t => {
  // zwischendurch weitere Pinguine kaufen
  if (t % 3000 === 0 && gebaut < 8) {
    const wer = gebaut % 2 ? b : a;
    const p = platz(['zapfen', 'disco', 'laser', 'rundum'][gebaut % 4], 600 + gebaut * 300);
    if (p && wer.spiel.kasse(wer.id).geld > 600) { wer.schicken({ t:'b', b:{ t:'bau', typ:['zapfen', 'disco', 'laser', 'rundum'][gebaut % 4], x:p[0], y:p[1] } }); gebaut++; }
  }
});
pruefe(a.spiel.runde >= 4, 'Auto spielt Runden: ' + a.spiel.runde);
pruefe(a.spiel.pruefsumme() === b.spiel.pruefsumme(), 'beide Browser gleich');
const server = R.liste.get(a.raum.code).spiel;
pruefe(server.pruefsumme() === a.spiel.pruefsumme() && a.takt === R.liste.get(a.raum.code).takt, 'Browser gleich wie Server');
pruefe(a.zustaende === 1 && b.zustaende === 1, 'keine Abweichung, kein Neuladen nötig');
pruefe(Math.abs(a.spiel.kasse(a.id).geld - server.kasse(a.id).geld) < 1e-6, 'Kasse gleich');

// Abweichung: Ben verrechnet sich, bekommt den Stand neu
b.spiel.fische.forEach(f => { f.dist += 3; });
b.spiel.kasse(b.id).geld += 5;
laufen(3000, [a, b]);
pruefe(b.zustaende === 2 && b.spiel.pruefsumme() === server.pruefsumme(), 'Abweichung wird korrigiert');

// Ben verliert die Verbindung und kommt mit seinem Token zurück
b.v.getrennt();
laufen(1000, [a]);
const b2 = browser('Ben neu');
b2.schicken({ t:'hallo', name:'Ben', token:b.token, code:a.raum.code });
laufen(1000, [a, b2]);
pruefe(b2.id === b.id && b2.spiel && b2.spiel.pruefsumme() === a.spiel.pruefsumme(), 'Wiederverbinden mit Token');

// Pause hält an
a.schicken({ t:'pause', an:true });
const vorher = R.liste.get(a.raum.code).takt;
laufen(1000, [a, b2]);
pruefe(R.liste.get(a.raum.code).takt === vorher && a.raum.pause === 'Anna', 'Pause');
a.schicken({ t:'pause', an:false });
laufen(500, [a, b2]);
pruefe(R.liste.get(a.raum.code).takt > vorher, 'weiter nach der Pause');

// Kaputte Befehle stören nicht
a.schicken({ t:'b', b:{ t:'bau', typ:'zapfen', x:'abc', y:1e9 } });
a.schicken({ t:'b', b:{ t:'up', id:'x', pfad:9 } });
a.schicken({ t:'b', b:null });
a.v.nachricht('kein json');
laufen(500, [a, b2]);
pruefe(a.spiel.pruefsumme() === server.pruefsumme(), 'kaputte Befehle');

// Ein Dritter kann nicht mitten ins Spiel
const c = browser('Cem');
c.schicken({ t:'hallo', name:'Cem' });
c.schicken({ t:'beitreten', code:a.raum.code });
c.verarbeiten();
pruefe(c.fehler && /schon gespielt/.test(c.fehler), 'kein Beitritt mitten im Spiel');

// Zurück in die Lobby
a.schicken({ t:'nochmal' });
a.verarbeiten();
pruefe(a.raum.phase === 'lobby', 'zurück in die Lobby');

// Geteiltes Geld: eine Kasse, Startgeld × Spieler, jeder darf alles
{
  const s = new PT.Spiel({ karte:'scholle', spieler:[{ id:'a', held:'kiel' }, { id:'b', held:'frosti' }], geldModus:'geteilt' });
  pruefe(s.geld === 1300 && s.kasse('a') === s && s.kasse('b') === s, 'geteiltes Geld');
  const t = s.bauen('zapfen', 160, 200, 'a');
  pruefe(t && s.befehl('b', { t:'up', id:t.id, pfad:0 }), 'bei geteiltem Geld rüstet jeder auf');
  s.geld = 1e5;
  pruefe(s.bauen('kiel', 160, 380, 'a') && !s.bauen('kiel', 600, 330, 'a') && s.bauen('frosti', 330, 200, 'b'), 'jeder Spieler einen Helden');
}
// Zustand mitten in einer Runde: gleiches Ergebnis wie ohne Speichern
{
  const s = new PT.Spiel({ karte:'doppel', stufe:'mittel', modus:'orka', seed:99 });
  s.geld = 1e6;
  let n = 0;
  for (let i = 0; i < 4000 && n < 10; i++) { const w = s.wege[i % 2], p = w.pts[(i * 37) % w.pts.length]; if (s.bauen(['fabrik', 'moerser', 'laser', 'disco', 'polar'][n % 5], p[0] + Math.cos(i) * 55, p[1] + Math.sin(i) * 55)) n++; }
  for (const t of s.tuerme) for (let k = 0; k < 3; k++) { s.upgraden(t, 0); s.upgraden(t, 2); }
  s.runde = 24; s.leben = 1e6;
  s.rundeStarten();
  for (let i = 0; i < 60 * 25; i++) s.schritt(1 / 60);
  const kopie = PT.Spiel.ausZustand(JSON.parse(JSON.stringify(s.zustand())));
  for (let i = 0; i < 60 * 20; i++) { s.schritt(1 / 60); kopie.schritt(1 / 60); }
  pruefe(s.pruefsumme() === kopie.pruefsumme() && s.fische.length === kopie.fische.length, 'Zustand mitten in der Boss-Runde');
  pruefe(s.fische.some(f => f.typ === 'orka') || s.statistik.platzer > 0, 'Kaiser Orka ist da');
}

console.log(fehler ? `${fehler} Fehler` : 'Koop: alles in Ordnung');
process.exit(fehler ? 1 : 0);
