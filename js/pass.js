'use strict';
// Pinguin Türmchen – Pinguin-Pass: Erfahrung über alle Spiele, Stufen 1–50, freischaltbare Pinguin-Looks (Skins),
// Sockel, Fischmünzen und Meisterkräfte für die Helden. Gespeichert wird im Browser (oberflaeche.js), hier stehen nur die Regeln.
(function (wurzel) {
  const PT = wurzel.PT || (wurzel.PT = {});

  /* ---------- Looks ----------
     Färben Körper, Kopf, Bauch und Flügel aller eigenen Pinguine (Zubehör wie Hüte bleibt).
     extra: wangen (Kaiserpinguin), brille, augenklappe, glitzer (Sterne auf dem Bauch), muetze (Weihnachtsmütze),
     helm (Ritterhelm), astro (Raumhelm), antenne (Roboter), krone, zombie (rote Augen, Narbe) */
  PT.SKINS = {
    standard: { name:'Klassisch', rumpf:0x1d2230, bauch:0xf7f9fc },
    kaiser:   { name:'Kaiserpinguin', rumpf:0x2a3140, bauch:0xfff3d6, extra:'wangen' },
    brille:   { name:'Sonnenbrille', rumpf:0x1d2230, bauch:0xf7f9fc, extra:'brille' },
    schoko:   { name:'Schoko-Pinguin', rumpf:0x5a3420, bauch:0xf3e2c3 },
    rosa:     { name:'Zuckerwatte', rumpf:0xd9578f, bauch:0xffe6f0 },
    eis:      { name:'Eiskristall', rumpf:0x4fb8f0, bauch:0xeaf8ff, glanz:true },
    weihnacht:{ name:'Weihnachtspinguin', rumpf:0x1d2230, bauch:0xf7f9fc, extra:'muetze' },
    pirat:    { name:'Piraten-Pinguin', rumpf:0x23262e, bauch:0xf7f9fc, extra:'augenklappe' },
    zombie:   { name:'Zombie-Pinguin', rumpf:0x5b7a4a, bauch:0xc9d8b0, extra:'zombie' },
    galaxie:  { name:'Galaxie', rumpf:0x2b1d6b, bauch:0xb49bff, extra:'glitzer', leuchten:0x1a0f44 },
    ritter:   { name:'Ritter', rumpf:0x9aa3ad, bauch:0xdfe6ee, glanz:true, extra:'helm' },
    roboter:  { name:'Robo-Pinguin', rumpf:0x6d7682, bauch:0xc8d0da, glanz:true, extra:'antenne' },
    gold:     { name:'Goldpinguin', rumpf:0xe7b62c, bauch:0xfff2c4, glanz:true },
    astronaut:{ name:'Astronaut', rumpf:0xeef1f4, bauch:0xffffff, extra:'astro' },
    lava:     { name:'Lava-Pinguin', rumpf:0x3a1410, bauch:0xff8a3a, leuchten:0x5a1a00 },
    diamant:  { name:'Diamant', rumpf:0x9ff3ff, bauch:0xffffff, glanz:true, extra:'glitzer', leuchten:0x2a6a80 },
    schatten: { name:'Schattenpinguin', rumpf:0x14121c, bauch:0x3a2a5a, leuchten:0x2a0a4a, extra:'glitzer' },
    nordlicht:{ name:'Nordlicht', rumpf:0x0f5a5a, bauch:0x9fffe0, glanz:true, leuchten:0x0a4a3a },
    eisvogel: { name:'Eisvogel', rumpf:0x1f7fd0, bauch:0xff9a3a, glanz:true },
    kaiserlich:{ name:'Kaiser der Kaiser', rumpf:0x2a1d4a, bauch:0xffe9a8, glanz:true, extra:'krone', leuchten:0x2a1a00 }
  };
  PT.SKIN_REIHE = Object.keys(PT.SKINS);

  /* ---------- Sockel ----------
     Der Eis-Sockel unter den eigenen Pinguinen: Tönung und Leuchten */
  PT.SOCKEL = {
    standard: { name:'Eis', farbe:0xffffff },
    holz:     { name:'Treibholz', farbe:0xc79a64 },
    kristall: { name:'Kristall', farbe:0xa8ecff, leuchten:0x0a3a55 },
    lava:     { name:'Lava', farbe:0x5a4a50, leuchten:0x8a2a00 },
    nordlicht:{ name:'Nordlicht', farbe:0x7dffd0, leuchten:0x0a5a40 },
    gold:     { name:'Gold', farbe:0xffd54a, leuchten:0x3a2a00 },
    regenbogen:{ name:'Regenbogen', farbe:0xff9ad5, leuchten:0x3a0a4a, bunt:true },
    diamant:  { name:'Diamant', farbe:0xe6fdff, leuchten:0x2a6a80 }
  };
  PT.SOCKEL_REIHE = Object.keys(PT.SOCKEL);

  /* ---------- Stufen und Belohnungen ---------- */
  PT.PASS_MAX = 50;
  // Erfahrung für die nächste Stufe
  PT.passBedarf = stufe => 150 + 50 * stufe;
  PT.PASS_BELOHNUNG = {
    2:{ skin:'kaiser' }, 3:{ kraft:'kiel' }, 4:{ skin:'brille' }, 5:{ muenzen:15 }, 6:{ skin:'schoko' }, 7:{ kraft:'aurora' }, 8:{ sockel:'holz' },
    9:{ skin:'rosa' }, 10:{ muenzen:25 }, 11:{ kraft:'frosti' }, 12:{ sockel:'kristall' }, 13:{ skin:'eis' }, 14:{ skin:'weihnacht' },
    15:{ muenzen:30 }, 16:{ skin:'pirat' }, 17:{ sockel:'lava' }, 18:{ skin:'zombie' }, 19:{ muenzen:35 }, 20:{ skin:'galaxie' },
    21:{ skin:'ritter' }, 22:{ sockel:'nordlicht' }, 23:{ muenzen:40 }, 24:{ skin:'roboter' }, 25:{ skin:'gold' }, 26:{ sockel:'gold' },
    27:{ skin:'astronaut' }, 28:{ muenzen:50 }, 29:{ skin:'lava' }, 30:{ skin:'diamant' }, 32:{ skin:'schatten' }, 34:{ sockel:'regenbogen' },
    35:{ muenzen:60 }, 37:{ skin:'nordlicht' }, 38:{ muenzen:70 }, 40:{ skin:'eisvogel' }, 42:{ sockel:'diamant' }, 44:{ muenzen:80 },
    46:{ muenzen:90 }, 48:{ muenzen:100 }, 50:{ skin:'kaiserlich' }
  };
  // Stufe und Fortschritt aus der gesamten Erfahrung
  PT.passStufe = function (xp) {
    let stufe = 1, rest = Math.max(0, xp || 0);
    while (stufe < PT.PASS_MAX && rest >= PT.passBedarf(stufe)) { rest -= PT.passBedarf(stufe); stufe++; }
    return { stufe, rest, bedarf:stufe < PT.PASS_MAX ? PT.passBedarf(stufe) : 0 };
  };
  const frei = (art, id, stufe) => Object.entries(PT.PASS_BELOHNUNG).some(([s, b]) => b[art] === id && stufe >= +s);
  PT.skinFrei = (id, stufe) => id === 'standard' || frei('skin', id, stufe);
  PT.sockelFrei = (id, stufe) => id === 'standard' || frei('sockel', id, stufe);
  PT.kraftFrei = (held, stufe) => frei('kraft', held, stufe);
  PT.belohnungStufe = (art, id) => { const e = Object.entries(PT.PASS_BELOHNUNG).find(([, b]) => b[art] === id); return e ? +e[0] : null; };
  // Erfahrung: für jede geschaffte Runde (mehr auf schweren Stufen), für Siege und besiegte Bosse
  PT.PASS_FAKTOR = { leicht:1, mittel:1.25, schwer:1.5, extrem:2 };
  PT.passXpRunde = (runde, stufe) => Math.round((10 + Math.floor(runde / 2)) * (PT.PASS_FAKTOR[stufe] || 1));
  PT.passXpSieg = stufe => Math.round(150 * (PT.PASS_FAKTOR[stufe] || 1));
  PT.PASS_XP_BOSS = 200;
  // Fischmünzen: für Pinguin-Wissen; fünf geschaffte Runden = 1 Münze, ein Sieg je nach Stufe mehr
  PT.MUENZEN_SIEG = { leicht:8, mittel:12, schwer:18, extrem:30 };

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
