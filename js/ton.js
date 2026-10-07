'use strict';
// Pingu Towers – Geräusche mit Web Audio, ohne Dateien.
(function () {
  let ctx = null, haupt = null, an = true;
  const zuletzt = {};
  try { an = localStorage.getItem('pt-ton') !== 'aus'; } catch (e) { /* egal */ }

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    haupt = ctx.createGain();
    haupt.gain.value = an ? 0.5 : 0;
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

  const Ton = {
    start,
    get an() { return an; },
    umschalten() {
      an = !an;
      try { localStorage.setItem('pt-ton', an ? 'an' : 'aus'); } catch (e) { /* egal */ }
      if (haupt) haupt.gain.value = an ? 0.5 : 0;
      return an;
    },
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
