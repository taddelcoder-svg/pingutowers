'use strict';
// Pingu Towers – Pingu-Pass: Erfahrung über alle Spiele, Stufen 1–30, freischaltbare Pinguin-Looks (Skins)
// und Meisterkräfte für die Helden. Gespeichert wird im Browser (oberflaeche.js), hier stehen nur die Regeln.
(function (wurzel) {
  const PT = wurzel.PT || (wurzel.PT = {});

  /* ---------- Looks ----------
     Färben Körper, Kopf, Bauch und Flügel aller eigenen Pinguine (Zubehör wie Hüte bleibt).
     extra: wangen (Kaiserpinguin), brille, augenklappe, glitzer (Sterne auf dem Bauch) */
  PT.SKINS = {
    standard: { name:'Klassisch', rumpf:0x1d2230, bauch:0xf7f9fc },
    kaiser:   { name:'Kaiserpinguin', rumpf:0x2a3140, bauch:0xfff3d6, extra:'wangen' },
    brille:   { name:'Sonnenbrille', rumpf:0x1d2230, bauch:0xf7f9fc, extra:'brille' },
    schoko:   { name:'Schoko-Pingu', rumpf:0x5a3420, bauch:0xf3e2c3 },
    rosa:     { name:'Zuckerwatte', rumpf:0xd9578f, bauch:0xffe6f0 },
    eis:      { name:'Eiskristall', rumpf:0x4fb8f0, bauch:0xeaf8ff, glanz:true },
    pirat:    { name:'Piraten-Pingu', rumpf:0x23262e, bauch:0xf7f9fc, extra:'augenklappe' },
    galaxie:  { name:'Galaxie', rumpf:0x2b1d6b, bauch:0xb49bff, extra:'glitzer', leuchten:0x1a0f44 },
    gold:     { name:'Goldpinguin', rumpf:0xe7b62c, bauch:0xfff2c4, glanz:true },
    diamant:  { name:'Diamant', rumpf:0x9ff3ff, bauch:0xffffff, glanz:true, extra:'glitzer', leuchten:0x2a6a80 }
  };
  PT.SKIN_REIHE = Object.keys(PT.SKINS);

  /* ---------- Stufen und Belohnungen ---------- */
  PT.PASS_MAX = 30;
  // Erfahrung für die nächste Stufe
  PT.passBedarf = stufe => 150 + 50 * stufe;
  PT.PASS_BELOHNUNG = {
    2:{ skin:'kaiser' }, 3:{ kraft:'kiel' }, 4:{ skin:'brille' }, 6:{ skin:'schoko' }, 7:{ kraft:'aurora' }, 9:{ skin:'rosa' },
    11:{ kraft:'frosti' }, 13:{ skin:'eis' }, 16:{ skin:'pirat' }, 20:{ skin:'galaxie' }, 25:{ skin:'gold' }, 30:{ skin:'diamant' }
  };
  // Stufe und Fortschritt aus der gesamten Erfahrung
  PT.passStufe = function (xp) {
    let stufe = 1, rest = Math.max(0, xp || 0);
    while (stufe < PT.PASS_MAX && rest >= PT.passBedarf(stufe)) { rest -= PT.passBedarf(stufe); stufe++; }
    return { stufe, rest, bedarf:stufe < PT.PASS_MAX ? PT.passBedarf(stufe) : 0 };
  };
  PT.skinFrei = (id, stufe) => id === 'standard' || Object.entries(PT.PASS_BELOHNUNG).some(([s, b]) => b.skin === id && stufe >= +s);
  PT.kraftFrei = (held, stufe) => Object.entries(PT.PASS_BELOHNUNG).some(([s, b]) => b.kraft === held && stufe >= +s);
  // Erfahrung: für jede geschaffte Runde (mehr auf schweren Stufen), für Siege und besiegte Bosse
  PT.PASS_FAKTOR = { leicht:1, mittel:1.25, schwer:1.5, extrem:2 };
  PT.passXpRunde = (runde, stufe) => Math.round((10 + Math.floor(runde / 2)) * (PT.PASS_FAKTOR[stufe] || 1));
  PT.passXpSieg = stufe => Math.round(150 * (PT.PASS_FAKTOR[stufe] || 1));
  PT.PASS_XP_BOSS = 200;

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
