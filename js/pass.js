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
    kaiserlich:{ name:'Kaiser der Kaiser', rumpf:0x2a1d4a, bauch:0xffe9a8, glanz:true, extra:'krone', leuchten:0x2a1a00 },
    // aus Kisten und beim Händler (herkunft: kiste)
    drache:   { name:'Drachenpinguin', rumpf:0x2f8a3a, bauch:0xf2e08a, glanz:true, extra:'hoerner', herkunft:'kiste' },
    einhorn:  { name:'Einhorn', rumpf:0xf4f0ff, bauch:0xffd6f0, extra:'horn', herkunft:'kiste' },
    phoenix:  { name:'Phönix', rumpf:0xd8401a, bauch:0xffc040, leuchten:0x4a1000, extra:'kamm', herkunft:'kiste' },
    geist:    { name:'Gespenst', rumpf:0xdfe8f2, bauch:0xffffff, leuchten:0x2a3a4a, extra:'geist', herkunft:'kiste' },
    kaktus:   { name:'Kaktus', rumpf:0x3f8a4a, bauch:0xbfe6a0, extra:'stacheln', herkunft:'kiste' },
    samurai:  { name:'Samurai', rumpf:0x2a1a1a, bauch:0xe8d8c0, extra:'samurai', herkunft:'kiste' },
    // Kampagne (herkunft: kampagne, für ein abgeschlossenes Kapitel)
    entdecker:{ name:'Entdecker', rumpf:0x6b4a2a, bauch:0xf3e2c3, extra:'tropenhut', herkunft:'kampagne' },
    bergsteiger:{ name:'Bergsteiger', rumpf:0x2f5a8a, bauch:0xf7f9fc, extra:'stirnlampe', herkunft:'kampagne' },
    feuerwehr:{ name:'Vulkan-Wächter', rumpf:0x8a1a1a, bauch:0xffd27a, extra:'helm', glanz:true, herkunft:'kampagne' },
    tiefsee:  { name:'Tiefseetaucher', rumpf:0x14304a, bauch:0x9fe4ff, extra:'taucherhelm', herkunft:'kampagne' },
    held:     { name:'Held von Pinguinhausen', rumpf:0x1d2230, bauch:0xfff2c4, extra:'umhang', glanz:true, leuchten:0x1a1400, herkunft:'kampagne' },
    // Saison-Looks: einer pro Monat (herkunft: saison, monat 1–12)
    schneemann:{ name:'Schneemann', rumpf:0xf4f8ff, bauch:0xffffff, extra:'zylinder', herkunft:'saison', monat:1 },
    karneval: { name:'Karneval', rumpf:0xe2463b, bauch:0xfff27a, extra:'clown', herkunft:'saison', monat:2 },
    fruehling:{ name:'Frühlingspinguin', rumpf:0x4a8a3a, bauch:0xf7fff0, extra:'blume', herkunft:'saison', monat:3 },
    osterhase:{ name:'Osterhase', rumpf:0xc8a27a, bauch:0xfff8f0, extra:'hasenohren', herkunft:'saison', monat:4 },
    maibaum:  { name:'Blütenzauber', rumpf:0xd96aa8, bauch:0xfff0f8, extra:'blume', herkunft:'saison', monat:5 },
    sommer:   { name:'Sommerfrische', rumpf:0x2f9fd0, bauch:0xfffbe6, extra:'sonnenhut', herkunft:'saison', monat:6 },
    surfer:   { name:'Surfer', rumpf:0x1aa0a0, bauch:0xffe9a8, extra:'brille', herkunft:'saison', monat:7 },
    eiswaffel:{ name:'Eiswaffel', rumpf:0xf0a0c0, bauch:0xfff0d6, extra:'kirsche', herkunft:'saison', monat:8 },
    herbst:   { name:'Herbstwind', rumpf:0xb8642a, bauch:0xffe0b0, extra:'blatt', herkunft:'saison', monat:9 },
    kuerbis:  { name:'Kürbiskopf', rumpf:0x1d1a24, bauch:0xff9a2a, extra:'kuerbis', leuchten:0x2a1000, herkunft:'saison', monat:10 },
    laterne:  { name:'Laternenpinguin', rumpf:0x3a2a5a, bauch:0xfff2c4, extra:'laterne', herkunft:'saison', monat:11 },
    rentier:  { name:'Rentier', rumpf:0x7a4a2a, bauch:0xf3e2c3, extra:'geweih', herkunft:'saison', monat:12 }
  };
  PT.SKIN_REIHE = Object.keys(PT.SKINS);
  PT.saisonLook = monat => PT.SKIN_REIHE.find(id => PT.SKINS[id].monat === monat) || null;

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
    diamant:  { name:'Diamant', farbe:0xe6fdff, leuchten:0x2a6a80 },
    sterne:   { name:'Sternenhimmel', farbe:0x2a3a8a, leuchten:0x1a2060, herkunft:'kiste' },
    kirsche:  { name:'Kirschblüte', farbe:0xffb6d5, leuchten:0x3a0a20, herkunft:'kiste' },
    smaragd:  { name:'Smaragd', farbe:0x35d07a, leuchten:0x0a4020, herkunft:'kiste' }
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
    46:{ muenzen:90 }, 48:{ muenzen:100 }, 50:{ skin:'kaiserlich' }, 31:{ kraft:'nova' }, 33:{ kraft:'walter' }
  };
  // Stufe und Fortschritt aus der gesamten Erfahrung
  PT.passStufe = function (xp) {
    let stufe = 1, rest = Math.max(0, xp || 0);
    while (stufe < PT.PASS_MAX && rest >= PT.passBedarf(stufe)) { rest -= PT.passBedarf(stufe); stufe++; }
    return { stufe, rest, bedarf:stufe < PT.PASS_MAX ? PT.passBedarf(stufe) : 0 };
  };
  const frei = (art, id, stufe) => Object.entries(PT.PASS_BELOHNUNG).some(([s, b]) => b[art] === id && stufe >= +s);
  // besitz: Looks und Sockel aus Kisten, Händler, Saison und Kampagne ({ skins:{ id:true }, sockel:{ id:true } })
  PT.skinFrei = (id, stufe, besitz) => id === 'standard' || frei('skin', id, stufe) || !!(besitz && besitz.skins && besitz.skins[id]);
  PT.sockelFrei = (id, stufe, besitz) => id === 'standard' || frei('sockel', id, stufe) || !!(besitz && besitz.sockel && besitz.sockel[id]);
  PT.kraftFrei = (held, stufe) => frei('kraft', held, stufe);
  PT.belohnungStufe = (art, id) => { const e = Object.entries(PT.PASS_BELOHNUNG).find(([, b]) => b[art] === id); return e ? +e[0] : null; };
  // Erfahrung: für jede geschaffte Runde (mehr auf schweren Stufen), für Siege und besiegte Bosse
  PT.PASS_FAKTOR = { leicht:1, mittel:1.25, schwer:1.5, extrem:2 };
  PT.passXpRunde = (runde, stufe) => Math.round((10 + Math.floor(runde / 2)) * (PT.PASS_FAKTOR[stufe] || 1));
  PT.passXpSieg = stufe => Math.round(150 * (PT.PASS_FAKTOR[stufe] || 1));
  PT.PASS_XP_BOSS = 200;
  // Fischmünzen: für Pinguin-Wissen; fünf geschaffte Runden = 1 Münze, ein Sieg je nach Stufe mehr
  PT.MUENZEN_SIEG = { leicht:8, mittel:12, schwer:18, extrem:30 };

  /* ---------- Saison ----------
     Jeder Monat ist eine Saison mit eigener Leiste: 10 Stufen zu je 400 Erfahrung (zählt mit der Pass-Erfahrung).
     Auf Stufe 10 gibt es den Look des Monats. */
  PT.SAISON_NAMEN = ['Eiszapfen-Saison', 'Karnevals-Saison', 'Frühlings-Saison', 'Oster-Saison', 'Blüten-Saison', 'Sommer-Saison',
    'Surf-Saison', 'Eiscreme-Saison', 'Herbst-Saison', 'Grusel-Saison', 'Laternen-Saison', 'Winterzauber-Saison'];
  PT.SAISON_STUFE_XP = 400;
  PT.SAISON_BELOHNUNG = [null, { muenzen:10 }, { kiste:'holz' }, { muenzen:15 }, { kiste:'holz' }, { kiste:'silber' },
    { muenzen:25 }, { booster:2 }, { kiste:'silber' }, { muenzen:40 }, { saisonLook:true, kiste:'gold' }];
  PT.saisonId = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  PT.saisonStufe = xp => Math.min(10, Math.floor(Math.max(0, xp || 0) / PT.SAISON_STUFE_XP));

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
