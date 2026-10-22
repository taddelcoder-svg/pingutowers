'use strict';
// Pinguin Türmchen – Geräusche mit Web Audio, ohne Dateien.
(function () {
  let ctx = null, haupt = null, an = true, laut = 0.6;
  const zuletzt = {};
  try { an = localStorage.getItem('pt-ton') !== 'aus'; } catch (e) { /* egal */ }

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    haupt = ctx.createGain();
    haupt.gain.value = an ? 0.8 * laut : 0;
    haupt.connect(ctx.destination);
  }
  function ton({ f = 440, f2 = null, dauer = 0.1, typ = 'sine', laut = 0.3, verz = 0 }) {
    if (!ctx || !an) return;
    const t = ctx.currentTime + verz;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dauer);
    g.gain.setValueAtTime(laut, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dauer);
    o.connect(g); g.connect(haupt);
    o.start(t); o.stop(t + dauer + 0.02);
  }
  function rauschen(dauer = 0.2, laut = 0.25, filter = 1200) {
    if (!ctx || !an) return;
    const n = Math.floor(ctx.sampleRate * dauer);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(), g = ctx.createGain(), fi = ctx.createBiquadFilter();
    s.buffer = b; fi.type = 'lowpass'; fi.frequency.value = filter;
    g.gain.value = laut;
    s.connect(fi); fi.connect(g); g.connect(haupt);
    s.start();
  }
  // Nicht zu oft dasselbe Geräusch (bei vielen Platzern gleichzeitig)
  function darf(k, ms) {
    const j = performance.now();
    if (zuletzt[k] && j - zuletzt[k] < ms) return false;
    zuletzt[k] = j;
    return true;
  }

  /* ---------- Musik fürs Abenteuer ----------
     Düstere Klangflächen ohne Dateien: ein tiefer Grundton, ein langsamer Akkordteppich und je nach Stimmung
     Herzschlag, Trommeln, Tropfen oder Walgesang. Wird über einen Takt (alle 200 ms) ein Stück vorausgeplant. */
  const STIMMUNGEN = {
    nacht:  { grund:55, akkorde:[[220, 261.6, 329.6], [196, 246.9, 293.7]], schlag:0, tropfen:0.3, tempo:60 },
    flut:   { grund:73.4, akkorde:[[293.7, 349.2, 440], [261.6, 329.6, 392], [233.1, 293.7, 349.2]], schlag:1, tropfen:0, tempo:66 },
    tunnel: { grund:61.7, akkorde:[[246.9, 293.7, 370], [220, 277.2, 329.6]], schlag:0, tropfen:0.8, tempo:56 },
    feuer:  { grund:49, akkorde:[[196, 233.1, 293.7], [174.6, 220, 261.6], [185, 233.1, 277.2]], schlag:2, tropfen:0, tempo:92 },
    tiefe:  { grund:41.2, akkorde:[[164.8, 196, 246.9], [146.8, 185, 220]], schlag:0, tropfen:0.2, wal:true, tempo:48 },
    herz:   { grund:55, akkorde:[[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]], schlag:1, tropfen:0, melodie:true, tempo:58 },
    boss:   { grund:46.2, akkorde:[[185, 220, 277.2], [174.6, 207.7, 261.6]], schlag:3, tropfen:0, tempo:120 }
  };
  let musik = null, musikLaut = 0.5;
  try { const m = localStorage.getItem('pt-musik'); if (m != null) musikLaut = Math.max(0, Math.min(1, +m)); } catch (e) { /* egal */ }
  function musikStop(fade = 1.5) {
    if (!musik || !ctx) { musik = null; return; }
    const m = musik; musik = null;
    clearInterval(m.uhr);
    const t = ctx.currentTime;
    m.gain.gain.cancelScheduledValues(t);
    m.gain.gain.setValueAtTime(m.gain.gain.value, t);
    m.gain.gain.linearRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => { for (const o of m.dauer) try { o.stop(); } catch (e) { /* schon aus */ } m.gain.disconnect(); }, fade * 1000 + 100);
  }
  function musikStart(id) {
    if (!ctx || !STIMMUNGEN[id]) return;
    if (musik && musik.id === id) return;
    musikStop(1.2);
    const S = STIMMUNGEN[id];
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.linearRampToValueAtTime(0.32 * musikLaut, ctx.currentTime + 2.5);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900; filter.Q.value = 0.7;
    filter.connect(gain); gain.connect(haupt);
    const dauer = [];
    // Grundton: zwei leicht verstimmte Sägezähne durch einen langsam atmenden Filter
    for (const d of [-4, 4]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = S.grund; o.detune.value = d;
      const g = ctx.createGain(); g.gain.value = 0.16;
      o.connect(g); g.connect(filter); o.start(); dauer.push(o);
    }
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 380; lfo.connect(lfoG); lfoG.connect(filter.frequency); lfo.start(); dauer.push(lfo);
    const m = { id, gain, filter, dauer, naechste:ctx.currentTime + 0.1, schlag:0, akkord:0 };
    const notiz = (f, t, lang, laut, typ = 'triangle', ziel = filter) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = typ; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(laut, t + Math.min(0.8, lang * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + lang);
      o.connect(g); g.connect(ziel); o.start(t); o.stop(t + lang + 0.05);
    };
    const trommel = (t, f, laut) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
      g.gain.setValueAtTime(laut, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g); g.connect(gain); o.start(t); o.stop(t + 0.5);
    };
    m.uhr = setInterval(() => {
      if (!ctx || musik !== m) return;
      const schlagDauer = 60 / S.tempo;
      while (m.naechste < ctx.currentTime + 0.6) {
        const t = m.naechste, n = m.schlag++;
        // alle 8 Schläge ein neuer Akkord (langer, weicher Teppich)
        if (n % 8 === 0) {
          const ak = S.akkorde[m.akkord++ % S.akkorde.length];
          for (const f of ak) notiz(f / 2, t, schlagDauer * 8.5, 0.05, 'triangle');
        }
        // Herzschlag (bum-bum), Trommeln, Kampftrommeln
        if (S.schlag === 1 && n % 4 === 0) { trommel(t, 48, 0.5); trommel(t + schlagDauer * 0.28, 44, 0.35); }
        if (S.schlag === 2 && (n % 4 === 0 || n % 4 === 3)) trommel(t, n % 4 ? 70 : 52, n % 4 ? 0.3 : 0.55);
        if (S.schlag === 3) { trommel(t, n % 2 ? 66 : 50, n % 2 ? 0.28 : 0.5); if (n % 4 === 2) trommel(t + schlagDauer / 2, 80, 0.2); }
        // Tropfen im Tunnel, Walgesang in der Tiefe, eine traurige Melodie am Ende
        if (S.tropfen && Math.random() < S.tropfen * 0.25) notiz(900 + Math.random() * 900, t + Math.random() * schlagDauer, 0.6, 0.03, 'sine', gain);
        if (S.wal && n % 16 === 5) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(110, t + 3.5);
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 1); g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
          o.connect(g); g.connect(gain); o.start(t); o.stop(t + 4.1);
        }
        if (S.melodie && n % 2 === 0) {
          const ton = [440, 392, 349.2, 329.6, 293.7, 329.6, 349.2, 329.6][(n / 2) % 8];
          if ((n / 2) % 8 !== 7) notiz(ton, t, schlagDauer * 1.9, 0.035, 'sine', gain);
        }
        m.naechste += schlagDauer;
      }
    }, 200);
    musik = m;
  }

  const Ton = {
    start,
    musik(id) { if (!id) musikStop(); else { start(); musikStart(id); } },
    musikLautstaerke(v) {
      musikLaut = Math.max(0, Math.min(1, v));
      try { localStorage.setItem('pt-musik', String(musikLaut)); } catch (e) { /* egal */ }
      if (musik && ctx) musik.gain.gain.setTargetAtTime(0.32 * musikLaut, ctx.currentTime, 0.3);
    },
    get musikLaut() { return musikLaut; },
    // kurzer, tiefer Schlag für Szenen (Titelkarte, Tod, Verrat)
    schlag() { if (!ctx || !an) return; ton({ f:70, f2:32, dauer:1.6, typ:'sine', laut:0.5 }); rauschen(1.2, 0.18, 300); },
    funk() { if (!ctx || !an) return; rauschen(0.12, 0.08, 4000); ton({ f:1400, dauer:0.05, typ:'square', laut:0.03 }); },
    get an() { return an; },
    umschalten() {
      an = !an;
      try { localStorage.setItem('pt-ton', an ? 'an' : 'aus'); } catch (e) { /* egal */ }
      if (haupt) haupt.gain.value = an ? 0.8 * laut : 0;
      return an;
    },
    lautstaerke(v) { laut = Math.max(0, Math.min(1, v)); if (haupt) haupt.gain.value = an ? 0.8 * laut : 0; },
    klick() { ton({ f:660, f2:880, dauer:0.06, typ:'triangle', laut:0.15 }); },
    bauen() { ton({ f:300, f2:600, dauer:0.12, typ:'triangle', laut:0.3 }); ton({ f:600, f2:900, dauer:0.1, typ:'sine', laut:0.2, verz:0.08 }); },
    upgrade() { [523, 659, 784, 1047].forEach((f, i) => ton({ f, dauer:0.12, typ:'triangle', laut:0.2, verz:i * 0.06 })); },
    verkaufen() { ton({ f:900, f2:400, dauer:0.18, typ:'square', laut:0.08 }); },
    fehler() { ton({ f:200, f2:150, dauer:0.15, typ:'square', laut:0.1 }); },
    faehigkeit() { rauschen(0.4, 0.25, 2500); [392, 523, 784].forEach((f, i) => ton({ f, f2:f * 1.5, dauer:0.2, typ:'sawtooth', laut:0.07, verz:i * 0.05 })); },
    ereignisse(liste) {
      if (!ctx || !an) return;
      for (const e of liste) {
        switch (e.art) {
          case 'platzen':
            if (darf('plopp', 45)) ton({ f:500 + Math.random() * 500, f2:180, dauer:0.07, typ:'sine', laut:0.18 });
            break;
          case 'explosion': if (darf('bumm', 90)) rauschen(0.25, 0.3, 700); break;
          case 'ring': if (darf('ring', 120)) ton({ f:1200, f2:2400, dauer:0.15, typ:'sine', laut:0.06 }); break;
          case 'strahl': if (darf('harp', 70)) rauschen(0.08, 0.2, 3000); break;
          case 'blitz': if (darf('blitz', 120)) { rauschen(0.15, 0.2, 5000); ton({ f:1500, f2:300, dauer:0.15, typ:'sawtooth', laut:0.05 }); } break;
          case 'wurf': if (darf('wurf', 70)) ton({ f:900, f2:500, dauer:0.05, typ:'triangle', laut:0.05 }); break;
          case 'kiste': if (darf('kiste', 80)) { ton({ f:1320, dauer:0.08, typ:'square', laut:0.06 }); ton({ f:1760, dauer:0.1, typ:'square', laut:0.06, verz:0.06 }); } break;
          case 'leck': if (darf('leck', 200)) ton({ f:220, f2:110, dauer:0.3, typ:'sawtooth', laut:0.15 }); break;
          case 'rundeStart': ton({ f:392, dauer:0.1, typ:'triangle', laut:0.2 }); ton({ f:523, dauer:0.15, typ:'triangle', laut:0.2, verz:0.1 }); break;
          case 'rundeEnde': [523, 659, 784].forEach((f, i) => ton({ f, dauer:0.15, typ:'triangle', laut:0.18, verz:i * 0.08 })); break;
          case 'gewonnen': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => ton({ f, dauer:0.25, typ:'triangle', laut:0.25, verz:i * 0.13 })); break;
          case 'aufstieg': [523, 659, 784, 1047, 1319].forEach((f, i) => ton({ f, dauer:0.14, typ:'triangle', laut:0.18, verz:i * 0.07 })); break;
          case 'bossPhase': ton({ f:110, f2:55, dauer:0.6, typ:'sawtooth', laut:0.2 }); rauschen(0.5, 0.3, 400); break;
          case 'bossBesiegt': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => ton({ f, dauer:0.3, typ:'triangle', laut:0.25, verz:i * 0.12 })); rauschen(0.8, 0.3, 900); break;
          case 'rundeStart_boss': break;
          case 'verloren': [392, 330, 262, 196].forEach((f, i) => ton({ f, dauer:0.35, typ:'sawtooth', laut:0.1, verz:i * 0.22 })); break;
        }
      }
    }
  };
  window.PT.Ton = Ton;
})();
