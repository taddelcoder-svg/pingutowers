'use strict';
// Pinguin Türmchen – Pinguin-Pass: Erfahrung über alle Spiele, Stufen 1–100 mit Seltenheiten, freischaltbare Looks
// (manche mit Aura), Sockel, Titel, Platz-Effekte, Siegestänze, Dorf-Deko, Fischmünzen, Kristalle, Kisten, Meisterkräfte
// und Prestige. Gespeichert wird im Browser (oberflaeche.js), hier stehen nur die Regeln.
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
    // Schwarzes Eis: Figuren aus dem Abenteuer und Walters Helm aus dem Pingu-Dorf
    kueken:   { name:'Mia', rumpf:0x8a8f99, bauch:0xe4e7ee, extra:'kueken', herkunft:'kampagne' },
    kapitaen: { name:'Kapitän Frost', rumpf:0x163450, bauch:0xdff4ff, glanz:true, extra:'kapitaen', leuchten:0x061826, herkunft:'kampagne' },
    pako:     { name:'Pako, der Zerbrochene', rumpf:0x1a0f2a, bauch:0x6a3a9a, leuchten:0x2a0a4a, extra:'maske', herkunft:'kampagne' },
    opa:      { name:'Opa Pingo', rumpf:0x4a4f5a, bauch:0xf0ece0, extra:'opa', herkunft:'kampagne' },
    lichtkind:{ name:'Lichtgeborener', rumpf:0xfff2c4, bauch:0xffffff, glanz:true, leuchten:0x6a5a20, extra:'glitzer', aura:'licht', herkunft:'kampagne' },
    orcareiter:{ name:'Orca-Reiter', rumpf:0x111318, bauch:0xf4f6fa, glanz:true, extra:'taucherhelm', aura:'blasen', herkunft:'kampagne' },
    spiegelpingu:{ name:'Spiegelbild', rumpf:0xc8d4e0, bauch:0xffffff, glanz:true, extra:'glitzer', leuchten:0x2a3a4a, herkunft:'kampagne' },
    lichttraeger:{ name:'Der Lichtträger', rumpf:0xfff8e0, bauch:0xffffff, glanz:true, leuchten:0x8a7a3a, extra:'opa', aura:'licht', herkunft:'kampagne' },
    uralt:    { name:'Auge des Uralten', rumpf:0x5a3a10, bauch:0xffd27a, glanz:true, leuchten:0x4a2a00, extra:'maske', aura:'feuer', herkunft:'kampagne' },
    hueterin: { name:'Nova, Hüterin des Lichts', rumpf:0x14304a, bauch:0xfff2c4, glanz:true, leuchten:0x6a4a00, extra:'heiligenschein', aura:'licht', herkunft:'kampagne' },
    kommandantin:{ name:'Kommandantin Mia', rumpf:0x8a8f99, bauch:0xffe6f0, glanz:true, extra:'stahlhelm', herkunft:'kampagne' },
    veteran:  { name:'Walters Helm', rumpf:0x3a3a30, bauch:0xe8e0c8, extra:'stahlhelm', herkunft:'dorf' },
    // Pinguin-Pass 2.0 (Stufe 36–100). aura: Teilchen rund um den Pinguin im Spiel
    ninja:    { name:'Ninja', rumpf:0x15151a, bauch:0x2a2a32, extra:'stirnband' },
    vampir:   { name:'Vampir', rumpf:0x1a0a14, bauch:0xe8d8e0, extra:'umhang' },
    detektiv: { name:'Meisterdetektiv', rumpf:0x6b4a2a, bauch:0xf3e2c3, extra:'zylinder' },
    herzchen: { name:'Herzensbrecher', rumpf:0xff8ab0, bauch:0xffffff, extra:'wangen', aura:'herzen' },
    pilot:    { name:'Fliegerass', rumpf:0x6b4a2a, bauch:0xf3e2c3, extra:'stirnlampe' },
    mumie:    { name:'Mumie', rumpf:0xe8e0c8, bauch:0xd0c8b0, extra:'zombie' },
    engel:    { name:'Schutzengel', rumpf:0xf4f8ff, bauch:0xffffff, glanz:true, extra:'heiligenschein', aura:'licht' },
    giftpingu:{ name:'Giftmischer', rumpf:0x2f8a3a, bauch:0xc8ff8a, extra:'zombie', leuchten:0x0a3a0a, aura:'gift' },
    dino:     { name:'Dino-Pinguin', rumpf:0x3f8a4a, bauch:0xd8f0a0, extra:'stacheln' },
    cyber:    { name:'Cyber-Pinguin', rumpf:0x1a1a2a, bauch:0x2affd0, glanz:true, leuchten:0x0a4a40, extra:'brille', aura:'blitz' },
    spukpingu:{ name:'Spukgestalt', rumpf:0x2a2a3a, bauch:0x8a8aaa, extra:'geist', leuchten:0x1a1a3a, aura:'schatten' },
    eisengel: { name:'Eisengel', rumpf:0xbfeeff, bauch:0xffffff, glanz:true, extra:'fluegel', aura:'schnee' },
    koenig:   { name:'Pinguinkönig', rumpf:0x4a1a6a, bauch:0xffe9a8, glanz:true, extra:'krone' },
    regenbogenpingu:{ name:'Regenbogen-Rakete', rumpf:0xff5ec8, bauch:0xfff2a8, glanz:true, extra:'glitzer', aura:'regenbogen' },
    blitzkrieger:{ name:'Blitzkrieger', rumpf:0x2a2a6a, bauch:0xfff27a, glanz:true, leuchten:0x1a1a4a, extra:'antenne', aura:'blitz' },
    schneekoenig:{ name:'Schneekönig', rumpf:0xdff6ff, bauch:0xffffff, glanz:true, extra:'krone', aura:'schnee' },
    teufel:   { name:'Höllenpinguin', rumpf:0x8a1010, bauch:0xffb0a0, leuchten:0x3a0000, extra:'hoerner', aura:'feuer' },
    vulkan:   { name:'Vulkanherz', rumpf:0x2a0a0a, bauch:0xff6a1a, leuchten:0x6a1a00, extra:'kamm', aura:'feuer' },
    tiefseejaeger:{ name:'Tiefseejäger', rumpf:0x0a2a4a, bauch:0x5ec8ff, glanz:true, leuchten:0x0a2a4a, extra:'taucherhelm', aura:'blasen' },
    // Mythisch: Stufe 25, 50, 75 und 100
    frosttitan:{ name:'Frost-Titan', rumpf:0x9fe8ff, bauch:0xe6fbff, glanz:true, leuchten:0x0a4a6a, extra:'eisruestung', aura:'frost', mythisch:true },
    schattenkaiser:{ name:'Schattenkaiser', rumpf:0x0a0612, bauch:0x3a1a5a, leuchten:0x2a0a4a, extra:'laterne', aura:'schatten', mythisch:true },
    phoenixkaiser:{ name:'Phönix-Kaiser', rumpf:0xd8401a, bauch:0xffc040, glanz:true, leuchten:0x5a1400, extra:'kamm', aura:'feuer', mythisch:true },
    legende:  { name:'Herzlicht-Legende', rumpf:0xffd54a, bauch:0xfff8d6, glanz:true, leuchten:0x6a4a00, extra:'heiligenschein', aura:'licht', mythisch:true },
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
    smaragd:  { name:'Smaragd', farbe:0x35d07a, leuchten:0x0a4020, herkunft:'kiste' },
    eiskrieg: { name:'Eiskrieg', farbe:0x9fd8ff, leuchten:0x4a0a0a, herkunft:'versus' },
    herzlicht:{ name:'Herzlicht', farbe:0xffe9a8, leuchten:0x5a3a00, herkunft:'dorf' },
    mitternacht:{ name:'Mitternacht', farbe:0x1a2a5a, leuchten:0x0a1a4a },
    eisblume: { name:'Eisblume', farbe:0xdff6ff, leuchten:0x2a6a8a },
    sternenstaub:{ name:'Sternenstaub', farbe:0x9a8aff, leuchten:0x2a1a6a },
    gewitter: { name:'Gewitter', farbe:0xfff27a, leuchten:0x4a4a00 },
    krater:   { name:'Lava-Krater', farbe:0x3a2a2a, leuchten:0xaa3a00 },
    schwarzloch:{ name:'Schwarzes Loch', farbe:0x0a0612, leuchten:0x3a0a6a },
    thron:    { name:'Kristall-Thron', farbe:0xffd54a, leuchten:0x5a3a00, bunt:true },
    legende:  { name:'Legende', farbe:0xfff2c4, leuchten:0x6a4a00, bunt:true }
  };
  PT.SOCKEL_REIHE = Object.keys(PT.SOCKEL);

  /* ---------- Titel, Platz-Effekte, Siegestänze, Dorf-Deko ---------- */
  PT.TITEL = {
    neuling:'Neuling', fischjaeger:'Fischjäger', eisbrecher:'Eisbrecher', frostherz:'Frostherz', turmbauer:'Turmbaumeister',
    bossjaeger:'Bossjäger', schattenlaeufer:'Schattenläufer', sturmreiter:'Sturmreiter', nachtwache:'Nachtwache', phoenix:'Aus der Asche',
    unbesiegbar:'Unbesiegbar', tiefseejaeger:'Tiefseejäger', unaufhaltsam:'Unaufhaltsam', legende:'Legende von Pinguinhausen'
  };
  PT.TITEL_REIHE = Object.keys(PT.TITEL);
  // Effekte, wenn eigene Pinguine einen Fisch erwischen (nur Aussehen): Farben der Funken, dazu ein Zeichen
  PT.EFFEKTE = {
    standard:{ name:'Wasserspritzer', farben:[], zeichen:'💦' }, konfetti:{ name:'Konfetti', farben:[0xff5ec8, 0xffd54a, 0x5ec8ff, 0x7dffb2], zeichen:'🎊' },
    sterne:{ name:'Sternenregen', farben:[0xffe066, 0xffffff], zeichen:'⭐' }, herzen:{ name:'Herzen', farben:[0xff5e8a, 0xffb0c8], zeichen:'💖' },
    feuerwerk:{ name:'Feuerwerk', farben:[0xff5ec8, 0xffd54a, 0x5ec8ff, 0xff6a3a, 0x7dffb2], zeichen:'🎆' },
    schatten:{ name:'Schattenhauch', farben:[0x3a1a5a, 0x7a4ab8], zeichen:'🌑' }, blitze:{ name:'Blitzschlag', farben:[0xfff27a, 0xc3b0ff], zeichen:'⚡' },
    regenbogen:{ name:'Regenbogen', farben:[0xff3a3a, 0xffa03a, 0xffe03a, 0x3aff7a, 0x3aa0ff, 0xa03aff], zeichen:'🌈' },
    schnee:{ name:'Schneegestöber', farben:[0xffffff, 0xbfeaff], zeichen:'❄️' }, flammen:{ name:'Phönixfeuer', farben:[0xff6a1a, 0xffc040, 0xff2a1a], zeichen:'🔥' },
    gold:{ name:'Goldregen', farben:[0xffd54a, 0xfff2a8], zeichen:'🪙' }, herzlicht:{ name:'Herzlicht', farben:[0xfff2c4, 0xffd54a, 0xffffff], zeichen:'💛' }
  };
  PT.EFFEKT_REIHE = Object.keys(PT.EFFEKTE);
  PT.TAENZE = {
    standard:{ name:'Jubeln' }, huepfen:{ name:'Freudensprünge' }, drehen:{ name:'Pirouette' }, wackeln:{ name:'Watschel-Wackeln' },
    welle:{ name:'La-Ola-Welle' }, salto:{ name:'Salto' }, disco:{ name:'Disco-Fieber' }, triumph:{ name:'Triumphsprung' }
  };
  PT.TAENZE_REIHE = Object.keys(PT.TAENZE);
  PT.DEKO = {
    lichterkette:{ name:'Lichterkette', symbol:'💡' }, fahnen:{ name:'Siegesfahnen', symbol:'🚩' }, eisskulptur:{ name:'Eisskulptur', symbol:'🧊' },
    goldstatue:{ name:'Goldene Statue', symbol:'🗽' }, goldiglu:{ name:'Goldenes Iglu', symbol:'🏆' }, nordlichter:{ name:'Nordlichter', symbol:'🌌' },
    feuerwerk:{ name:'Feuerwerk über dem Dorf', symbol:'🎆' }
  };
  PT.DEKO_REIHE = Object.keys(PT.DEKO);

  /* ---------- Stufen und Belohnungen ----------
     Jede Stufe hat eine Seltenheit (g gewöhnlich, s selten, e episch, l legendär, m mythisch) und eine oder mehrere
     Belohnungen: { skin }, { sockel }, { kraft }, { titel }, { effekt }, { tanz }, { deko }, { muenzen }, { kristalle },
     { kiste }, { booster }. Alle 10 Stufen ein Meilenstein, auf 25, 50, 75 und 100 etwas Mythisches. */
  PT.PASS_MAX = 100;
  PT.PRESTIGE_MAX = 5;
  PT.SELTENHEIT = { g:{ name:'Gewöhnlich', farbe:'#b8c4d0' }, s:{ name:'Selten', farbe:'#4a97f0' }, e:{ name:'Episch', farbe:'#b36bff' },
    l:{ name:'Legendär', farbe:'#f6c343' }, m:{ name:'Mythisch', farbe:'#ff4a5a' } };
  // Erfahrung für die nächste Stufe
  PT.passBedarf = stufe => 200 + 25 * stufe;
  const S = (s, ...b) => ({ s, b });
  PT.PASS_STUFEN = {
    1:S('g', { titel:'neuling' }), 2:S('s', { skin:'kaiser' }), 3:S('e', { kraft:'kiel' }), 4:S('g', { skin:'brille' }),
    5:S('s', { muenzen:15 }, { effekt:'konfetti' }), 6:S('g', { skin:'schoko' }), 7:S('e', { kraft:'aurora' }), 8:S('g', { sockel:'holz' }),
    9:S('g', { skin:'rosa' }), 10:S('l', { titel:'fischjaeger' }, { kiste:'silber' }, { muenzen:25 }), 11:S('e', { kraft:'frosti' }), 12:S('s', { sockel:'kristall' }),
    13:S('s', { skin:'eis' }), 14:S('s', { skin:'weihnacht' }), 15:S('s', { tanz:'huepfen' }, { muenzen:30 }), 16:S('s', { skin:'pirat' }),
    17:S('s', { sockel:'lava' }), 18:S('s', { skin:'zombie' }), 19:S('g', { muenzen:35 }, { kristalle:10 }), 20:S('l', { skin:'galaxie' }, { titel:'eisbrecher' }, { kiste:'gold' }),
    21:S('e', { skin:'ritter' }), 22:S('e', { sockel:'nordlicht' }), 23:S('e', { effekt:'sterne' }, { muenzen:40 }), 24:S('e', { skin:'roboter' }),
    25:S('m', { skin:'frosttitan' }, { titel:'frostherz' }), 26:S('l', { skin:'gold' }, { sockel:'gold' }), 27:S('e', { skin:'astronaut' }), 28:S('e', { tanz:'drehen' }, { muenzen:50 }),
    29:S('e', { skin:'lava' }), 30:S('l', { skin:'diamant' }, { titel:'turmbauer' }, { kiste:'gold' }), 31:S('e', { kraft:'nova' }), 32:S('e', { skin:'schatten' }),
    33:S('e', { kraft:'walter' }), 34:S('e', { sockel:'regenbogen' }), 35:S('e', { effekt:'herzen' }, { muenzen:60 }), 36:S('s', { skin:'ninja' }),
    37:S('e', { skin:'nordlicht' }), 38:S('e', { deko:'lichterkette' }, { muenzen:70 }), 39:S('s', { skin:'vampir' }), 40:S('l', { skin:'eisvogel' }, { titel:'bossjaeger' }, { kiste:'gold' }),
    41:S('s', { sockel:'mitternacht' }), 42:S('e', { sockel:'diamant' }), 43:S('s', { skin:'detektiv' }), 44:S('e', { tanz:'wackeln' }, { muenzen:80 }),
    45:S('e', { skin:'herzchen' }, { effekt:'feuerwerk' }), 46:S('s', { muenzen:90 }, { kristalle:20 }), 47:S('s', { skin:'pilot' }), 48:S('e', { deko:'fahnen' }, { muenzen:100 }),
    49:S('l', { skin:'kaiserlich' }), 50:S('m', { skin:'schattenkaiser' }, { titel:'schattenlaeufer' }, { effekt:'schatten' }),
    51:S('s', { kristalle:15 }, { booster:2 }), 52:S('s', { skin:'mumie' }), 53:S('e', { sockel:'eisblume' }), 54:S('g', { muenzen:60 }),
    55:S('e', { skin:'engel' }), 56:S('e', { tanz:'welle' }), 57:S('e', { skin:'giftpingu' }), 58:S('s', { muenzen:70 }, { kiste:'silber' }),
    59:S('e', { sockel:'sternenstaub' }), 60:S('l', { skin:'blitzkrieger' }, { effekt:'blitze' }, { titel:'sturmreiter' }, { kiste:'gold' }),
    61:S('s', { kristalle:20 }), 62:S('s', { skin:'dino' }), 63:S('e', { deko:'eisskulptur' }), 64:S('g', { muenzen:80 }),
    65:S('l', { skin:'regenbogenpingu' }, { effekt:'regenbogen' }), 66:S('e', { sockel:'gewitter' }), 67:S('e', { skin:'cyber' }), 68:S('l', { tanz:'salto' }),
    69:S('s', { muenzen:90 }, { booster:3 }), 70:S('l', { skin:'schneekoenig' }, { effekt:'schnee' }, { titel:'nachtwache' }, { kiste:'gold' }),
    71:S('e', { sockel:'krater' }), 72:S('e', { skin:'spukpingu' }), 73:S('s', { kristalle:30 }), 74:S('l', { deko:'goldstatue' }, { muenzen:100 }),
    75:S('m', { skin:'phoenixkaiser' }, { effekt:'flammen' }, { titel:'phoenix' }), 76:S('e', { skin:'eisengel' }), 77:S('s', { muenzen:110 }, { kiste:'silber' }),
    78:S('l', { sockel:'schwarzloch' }), 79:S('e', { skin:'koenig' }), 80:S('l', { skin:'teufel' }, { titel:'unbesiegbar' }, { kiste:'gold' }),
    81:S('s', { kristalle:40 }), 82:S('l', { tanz:'disco' }), 83:S('l', { skin:'vulkan' }), 84:S('e', { muenzen:120 }, { booster:3 }),
    85:S('l', { effekt:'gold' }, { deko:'goldiglu' }), 86:S('l', { sockel:'thron' }), 87:S('e', { muenzen:130 }, { kiste:'gold' }), 88:S('l', { deko:'nordlichter' }),
    89:S('e', { kristalle:50 }), 90:S('l', { skin:'tiefseejaeger' }, { titel:'tiefseejaeger' }, { kiste:'gold' }), 91:S('e', { muenzen:150 }), 92:S('l', { deko:'feuerwerk' }),
    93:S('e', { kristalle:60 }), 94:S('e', { muenzen:160 }, { kiste:'gold' }), 95:S('l', { tanz:'triumph' }), 96:S('e', { muenzen:180 }),
    97:S('l', { kristalle:80 }), 98:S('l', { booster:5 }, { kiste:'gold' }), 99:S('l', { titel:'unaufhaltsam' }, { muenzen:250 }),
    100:S('m', { skin:'legende' }, { sockel:'legende' }, { effekt:'herzlicht' }, { titel:'legende' })
  };
  // Stufe und Fortschritt aus der gesamten Erfahrung
  PT.passStufe = function (xp) {
    let stufe = 1, rest = Math.max(0, xp || 0);
    while (stufe < PT.PASS_MAX && rest >= PT.passBedarf(stufe)) { rest -= PT.passBedarf(stufe); stufe++; }
    return { stufe, rest, bedarf:stufe < PT.PASS_MAX ? PT.passBedarf(stufe) : 0 };
  };
  // Stufe nach der alten Rechnung (bis Stufe 50), damit beim Umstieg keine Belohnung doppelt kommt
  PT.passStufeAlt = function (xp) {
    let stufe = 1, rest = Math.max(0, xp || 0);
    while (stufe < 50 && rest >= 150 + 50 * stufe) { rest -= 150 + 50 * stufe; stufe++; }
    return stufe;
  };
  // Auf welcher Stufe gibt es diese Belohnung? (art: skin, sockel, kraft, titel, effekt, tanz, deko)
  PT.belohnungStufe = (art, id) => { const e = Object.entries(PT.PASS_STUFEN).find(([, x]) => x.b.some(b => b[art] === id)); return e ? +e[0] : null; };
  const frei = (art, id, stufe) => { const st = PT.belohnungStufe(art, id); return st != null && stufe >= st; };
  // besitz: aus Kisten, Händler, Saison, Abenteuer, Dorf und Prestige ({ skins, sockel, titel, effekte, taenze, kraefte })
  PT.skinFrei = (id, stufe, besitz) => id === 'standard' || frei('skin', id, stufe) || !!(besitz && besitz.skins && besitz.skins[id]);
  PT.sockelFrei = (id, stufe, besitz) => id === 'standard' || frei('sockel', id, stufe) || !!(besitz && besitz.sockel && besitz.sockel[id]);
  PT.kraftFrei = (held, stufe, besitz) => frei('kraft', held, stufe) || !!(besitz && besitz.kraefte && besitz.kraefte[held]);
  PT.titelFrei = (id, stufe, besitz) => frei('titel', id, stufe) || !!(besitz && besitz.titel && besitz.titel[id]);
  PT.effektFrei = (id, stufe, besitz) => id === 'standard' || frei('effekt', id, stufe) || !!(besitz && besitz.effekte && besitz.effekte[id]);
  PT.tanzFrei = (id, stufe, besitz) => id === 'standard' || frei('tanz', id, stufe) || !!(besitz && besitz.taenze && besitz.taenze[id]);
  PT.dekoFrei = (id, stufe, besitz) => frei('deko', id, stufe) || !!(besitz && besitz.deko && besitz.deko[id]);
  // Prestige: alles aus dem Pass bleibt für immer, die Leiste beginnt von vorn
  PT.passAllesBesitz = function () {
    const r = { skins:{}, sockel:{}, titel:{}, effekte:{}, taenze:{}, kraefte:{}, deko:{} };
    const ziel = { skin:'skins', sockel:'sockel', titel:'titel', effekt:'effekte', tanz:'taenze', kraft:'kraefte', deko:'deko' };
    for (const x of Object.values(PT.PASS_STUFEN)) for (const b of x.b) for (const [k, v] of Object.entries(b)) if (ziel[k]) r[ziel[k]][v] = true;
    return r;
  };
  PT.prestigeFaktor = p => 1 + 0.25 * Math.max(0, Math.min(PT.PRESTIGE_MAX, p || 0));
  // Erfahrung: für jede geschaffte Runde (mehr auf schweren Stufen), für Siege und besiegte Bosse
  PT.PASS_FAKTOR = { leicht:1, mittel:1.25, schwer:1.5, extrem:2 };
  PT.passXpRunde = (runde, stufe) => Math.round((10 + Math.floor(runde / 2)) * (PT.PASS_FAKTOR[stufe] || 1));
  PT.passXpSieg = stufe => Math.round(150 * (PT.PASS_FAKTOR[stufe] || 1));
  PT.PASS_XP_BOSS = 200;
  // Fischmünzen: für Pinguin-Wissen; fünf geschaffte Runden = 1 Münze, ein Sieg je nach Stufe mehr
  PT.MUENZEN_SIEG = { leicht:8, mittel:12, schwer:18, extrem:30 };
  // Tägliche Login-Belohnung: jeden Tag etwas mehr, bis zum 7. Tag in Folge
  PT.loginBelohnung = serie => ({ xp:100 + 40 * Math.min(7, serie), muenzen:2 + Math.min(7, serie), kiste:serie % 7 === 0 ? 'silber' : null });

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
