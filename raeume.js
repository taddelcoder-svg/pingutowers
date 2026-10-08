'use strict';
/* Pingu Towers – Koop-Räume auf dem Server.
   Bis zu vier Spieler verteidigen dieselbe Karte. Der Server rechnet das Spiel mit (js/logik.js) und gibt
   den Takt vor: Er sammelt die Befehle der Spieler, ordnet jeden einem Takt zu und schickt alle 50 ms
   "bis Takt n, mit diesen Befehlen" an die Browser. Die Browser rechnen dasselbe Spiel Takt für Takt nach
   (60 Takte pro Sekunde, beim Vorspulen mehr) und schicken jede Sekunde eine Prüfsumme. Weicht ein Browser
   ab (andere Rechengenauigkeit, z. B. iPad gegen PC), bekommt er den kompletten Spielstand vom Server.
   Ohne WebSocket testbar: verbinden(transport) liefert nachricht/getrennt, takt(ms) rechnet weiter. */
const crypto = require('crypto');
const PT = require('./js/pinguine.js');
require('./js/logik.js');

const MAX_RAEUME = 40;
const LEER_MS = 15 * 60_000;           // Raum ohne Verbindung wird danach aufgeräumt
const SUMME_JEDE = 60;                 // Prüfsumme jede Sekunde Spielzeit
const AUTO_PAUSE = 72;                 // Takte zwischen zwei Runden, wenn "Auto" an ist
const MAX_TAKTE = 30;                  // höchstens so viele Takte pro Durchlauf (holt Rückstand auf)
const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BEFEHL_FELDER = { t:'s', typ:'s', x:'n', y:'n', id:'i', pfad:'i', ziel:'s', muster:'s', fk:'s', runde:'i', n:'i', camo:'b', nach:'b', fest:'b', ref:'i', weiter:'b' };

const nameOk = n => String(n || '').replace(/[\u0000-\u001f\u007f<>&"]/g, '').trim().slice(0, 16);
const skinOk = s => (/^[a-z]{1,16}$/.test(String(s)) ? String(s) : 'standard');
// Nur bekannte Felder mit dem richtigen Typ weitergeben
function befehlOk(b) {
  if (!b || typeof b !== 'object' || typeof b.t !== 'string') return null;
  const r = {};
  for (const [k, art] of Object.entries(BEFEHL_FELDER)) {
    const v = b[k];
    if (v == null) continue;
    if (art === 's' && typeof v === 'string' && v.length <= 20) r[k] = v;
    if (art === 'n' && Number.isFinite(v)) r[k] = Math.round(v * 100) / 100;
    if (art === 'i' && Number.isInteger(v)) r[k] = v;
    if (art === 'b') r[k] = !!v;
  }
  return r;
}

function raeume({ jetzt = () => Date.now(), seed = () => crypto.randomBytes(4).readUInt32LE(0) } = {}) {
  const liste = new Map();
  let naechsteId = 1;
  const code = () => { let c; do { c = Array.from({ length:4 }, () => CODE_ZEICHEN[crypto.randomInt(CODE_ZEICHEN.length)]).join(''); } while (liste.has(c)); return c; };
  const senden = (m, daten) => { if (!m.transport) return; try { m.transport.send(typeof daten === 'string' ? daten : JSON.stringify(daten)); } catch (_) { /* zu */ } };
  const mitglieder = raum => [...raum.mitglieder.values()];
  const online = raum => mitglieder(raum).filter(m => m.transport);

  /* ---------- Was die Browser über den Raum erfahren ---------- */
  function raumFuer(raum, m) {
    return {
      t:'raum', code:raum.code, host:raum.host, phase:raum.phase, du:m.id, einst:raum.einst,
      tempo:raum.tempo, pause:raum.pause, auto:raum.auto,
      mitglieder:mitglieder(raum).map(x => ({ id:x.id, name:x.name, held:x.held, kraft:x.kraft, skin:x.skin, online:!!x.transport, mit:!!x.mitspieler }))
    };
  }
  function raumSenden(raum) { for (const m of raum.mitglieder.values()) senden(m, raumFuer(raum, m)); }
  function zustandSenden(raum, m) {
    senden(m, { t:'zustand', n:raum.takt, z:raum.spiel.zustand(), tempo:raum.tempo, pause:raum.pause });
    m.zuletztZustand = jetzt();
  }

  /* ---------- Raum betreten, verlassen ---------- */
  function raumErstellen() {
    if (liste.size >= MAX_RAEUME) return null;
    const raum = {
      code:code(), host:null, phase:'lobby', mitglieder:new Map(), spiel:null, zuletzt:jetzt(),
      einst:{ karte:'scholle', stufe:'mittel', modus:'standard', geldModus:'geteilt' },
      takt:0, rest:0, tempo:1, pause:null, auto:false, autoWarte:0, ausstehend:[], summen:new Map(), letzteZeit:jetzt()
    };
    liste.set(raum.code, raum);
    return raum;
  }
  function beitreten(m, raum) {
    if (m.raum && m.raum !== raum) verlassen(m);
    m.raum = raum;
    raum.mitglieder.set(m.id, m);
    if (!raum.host || !raum.mitglieder.has(raum.host) || !raum.mitglieder.get(raum.host).transport) raum.host = m.id;
    raumSenden(raum);
  }
  function verlassen(m) {
    const raum = m.raum; if (!raum) return;
    m.raum = null;
    // Wer mitgespielt hat, bleibt im Spiel (seine Pinguine gehören ihm weiter), bis die Runde vorbei ist
    if (raum.phase === 'spiel' && m.mitspieler) { m.transport = null; m.weg = true; }
    else raum.mitglieder.delete(m.id);
    hostPruefen(raum);
    if (!online(raum).length && raum.phase === 'lobby') { liste.delete(raum.code); return; }
    raumSenden(raum);
  }
  function getrennt(m) {
    const raum = m.raum; if (!raum) return;
    m.transport = null;
    if (raum.phase === 'lobby') { verlassen(m); return; }
    hostPruefen(raum);
    raumSenden(raum);
  }
  function hostPruefen(raum) {
    const h = raum.mitglieder.get(raum.host);
    if (h && h.transport) return;
    const neu = online(raum)[0] || mitglieder(raum)[0];
    raum.host = neu ? neu.id : null;
  }
  function uebernehmen(m0, alt, raum) {
    if (alt.transport && alt.transport !== m0.transport) { const tr = alt.transport; alt.transport = null; try { tr.close && tr.close(); } catch (_) { /* egal */ } }
    alt.transport = m0.transport; alt.weg = false; alt.raum = raum;
    m0.ersetzt = alt;
    senden(alt, { t:'du', id:alt.id, token:alt.token });
    hostPruefen(raum);
    raumSenden(raum);
    if (raum.phase === 'spiel') zustandSenden(raum, alt);
  }

  /* ---------- Spiel starten ---------- */
  function spielStarten(raum) {
    const mit = online(raum);
    if (!mit.length) return;
    const e = raum.einst;
    raum.spiel = new PT.Spiel({
      karte:e.karte, stufe:e.stufe, modus:e.modus, seed:seed() & 0xffffff, geldModus:e.geldModus,
      spieler:mit.map(m => ({ id:m.id, name:m.name, held:m.held, kraft:m.kraft }))
    });
    // Wer nur zuschaut (später kommt), spielt ab der nächsten Lobby mit
    for (const m of raum.mitglieder.values()) m.mitspieler = mit.includes(m);
    raum.phase = 'spiel';
    raum.takt = 0; raum.rest = 0; raum.tempo = 1; raum.pause = null; raum.autoWarte = 0;
    raum.ausstehend = []; raum.summen.clear(); raum.letzteZeit = jetzt();
    raumSenden(raum);
    for (const m of online(raum)) zustandSenden(raum, m);
  }

  /* ---------- Nachrichten ---------- */
  function verbinden(transport) {
    const m0 = { id:'s' + (naechsteId++), token:crypto.randomBytes(12).toString('hex'), name:'', skin:'standard', held:'kiel', kraft:false,
      raum:null, transport, mitspieler:false, zaehler:0, fenster:jetzt(), zuletztZustand:0 };
    senden(m0, { t:'du', id:m0.id, token:m0.token });
    const ich = () => m0.ersetzt || m0;
    function nachricht(text) {
      const m = ich();
      const j = jetzt();
      if (j - m0.fenster > 1000) { m0.fenster = j; m0.zaehler = 0; }
      if (++m0.zaehler > 60) return;
      let d; try { d = JSON.parse(text); } catch (_) { return; }
      if (!d || typeof d.t !== 'string') return;
      const raum = m.raum;
      const fehler = t => senden(m, { t:'fehler', text:t });
      const istHost = raum && raum.host === m.id;
      switch (d.t) {
        case 'hallo': {
          const n = nameOk(d.name); if (n) m.name = n;
          m.skin = skinOk(d.skin);
          if (typeof d.token === 'string' && d.code && !raum) {
            const r = liste.get(String(d.code).toUpperCase());
            const alt = r && mitglieder(r).find(x => x.token === d.token);
            if (alt) return uebernehmen(m0, alt, r);
            return senden(m, { t:'raum', code:null, phase:'aus' });
          }
          if (raum) raumSenden(raum);
          return;
        }
        case 'erstellen': {
          if (!m.name) return fehler('Gib zuerst deinen Namen ein.');
          const neu = raumErstellen();
          if (!neu) return fehler('Gerade sind zu viele Räume offen. Versuch es später nochmal.');
          return beitreten(m, neu);
        }
        case 'beitreten': {
          if (!m.name) return fehler('Gib zuerst deinen Namen ein.');
          const ziel = liste.get(String(d.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
          if (!ziel) return fehler('Diesen Raum gibt es nicht. Stimmt der Code?');
          if (ziel === raum) return raumSenden(raum);
          if (ziel.phase !== 'lobby') return fehler('In diesem Raum wird schon gespielt. Wartet, bis die Partie vorbei ist.');
          if (online(ziel).length >= PT.KOOP_MAX) return fehler(`Der Raum ist voll (${PT.KOOP_MAX} Spieler).`);
          return beitreten(m, ziel);
        }
        case 'verlassen': verlassen(m); return senden(m, { t:'raum', code:null, phase:'aus' });
      }
      if (!raum) return;
      switch (d.t) {
        case 'wahl':
          // eigener Held, Meisterkraft und Aussehen (nur in der Lobby)
          if (raum.phase !== 'lobby') return;
          m.held = d.held === null || PT.HELDEN[d.held] ? d.held : m.held;
          m.kraft = !!d.kraft; m.skin = skinOk(d.skin);
          return raumSenden(raum);
        case 'einst': {
          if (!istHost || raum.phase !== 'lobby') return;
          const e = raum.einst;
          if (PT.KARTEN[d.karte]) e.karte = d.karte;
          if (PT.STUFEN[d.stufe]) e.stufe = d.stufe;
          if (PT.MODI[d.modus]) e.modus = d.modus;
          if (PT.KOOP_GELD[d.geldModus]) e.geldModus = d.geldModus;
          return raumSenden(raum);
        }
        case 'start':
          if (!istHost || raum.phase !== 'lobby') return;
          return spielStarten(raum);
        case 'nochmal':
          // zurück in die Lobby (Gastgeber), wer nicht mehr da ist, fliegt raus
          if (!istHost || raum.phase !== 'spiel') return;
          raum.phase = 'lobby'; raum.spiel = null; raum.pause = null;
          for (const x of mitglieder(raum)) { x.mitspieler = false; if (!x.transport) raum.mitglieder.delete(x.id); }
          return raumSenden(raum);
      }
      if (raum.phase !== 'spiel' || !m.mitspieler) return;
      switch (d.t) {
        case 'b': {
          const b = befehlOk(d.b);
          if (b && raum.ausstehend.length < 200) raum.ausstehend.push([m.id, b]);
          return;
        }
        case 'tempo':
          if ([1, 2, 3].includes(d.tempo)) { raum.tempo = d.tempo; raumSenden(raum); }
          return;
        case 'pause':
          raum.pause = d.an ? m.name || 'Jemand' : null;
          raum.letzteZeit = jetzt();
          return raumSenden(raum);
        case 'auto':
          raum.auto = !!d.an;
          return raumSenden(raum);
        case 'p': {
          // Prüfsumme vergleichen; bei Abweichung bekommt dieser Browser den Spielstand (höchstens alle 3 s)
          const soll = raum.summen.get(d.n);
          if (soll != null && soll !== d.h && j - m.zuletztZustand > 3000) zustandSenden(raum, m);
          return;
        }
      }
    }
    return { nachricht, getrennt:() => { const m = ich(); if (m.transport === transport) getrennt(m); }, mitglied:m0 };
  }

  /* ---------- Takt ---------- */
  // Rechnet alle laufenden Spiele bis zur aktuellen Zeit weiter und schickt jedem Browser die neuen Takte
  function takt() {
    const j = jetzt();
    for (const raum of liste.values()) {
      const vergangen = Math.min(500, j - raum.letzteZeit);
      raum.letzteZeit = j;
      if (raum.phase !== 'spiel' || !raum.spiel) continue;
      const sp = raum.spiel;
      // Niemand da oder Pause: anhalten (Befehle bleiben liegen)
      if (raum.pause || !online(raum).some(m => m.mitspieler)) continue;
      raum.rest = Math.min(raum.rest + vergangen * 0.06 * raum.tempo, MAX_TAKTE);
      const neu = [];
      let n = 0;
      while (raum.rest >= 1 && n < MAX_TAKTE) {
        raum.rest -= 1; n++;
        const k = ++raum.takt;
        for (const [spId, b] of raum.ausstehend) { sp.befehl(spId, b); neu.push([k, spId, b]); }
        raum.ausstehend = [];
        // Auto: nächste Runde kommt kurz nach dem Ende der letzten (als Befehl des Servers, damit alle ihn sehen)
        if (raum.auto && !sp.laeuft && !sp.vorbei && (!sp.gewonnen || sp.endlos) && sp.modus !== 'sandkasten') {
          if (++raum.autoWarte >= AUTO_PAUSE) {
            raum.autoWarte = 0;
            const b = { t:'start', runde:sp.runde + 1 };
            sp.befehl(null, b); neu.push([k, null, b]);
          }
        } else raum.autoWarte = 0;
        sp.schritt(1 / 60);
        sp.ereignisse.length = 0;
        if (k % SUMME_JEDE === 0) {
          raum.summen.set(k, sp.pruefsumme());
          if (raum.summen.size > 40) raum.summen.delete(raum.summen.keys().next().value);
        }
      }
      if (!n) continue;
      const text = JSON.stringify({ t:'takt', n:raum.takt, b:neu });
      for (const m of raum.mitglieder.values()) senden(m, text);
    }
  }
  function aufraeumenAlt() {
    const j = jetzt();
    for (const raum of [...liste.values()]) {
      if (online(raum).length) { raum.zuletzt = j; continue; }
      if (j - raum.zuletzt > LEER_MS) liste.delete(raum.code);
    }
  }

  return { verbinden, takt, aufraeumenAlt, liste };
}

module.exports = { raeume, befehlOk };
