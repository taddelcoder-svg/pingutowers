'use strict';
// Pinguin Türmchen – Menü, Seitenleiste, Fähigkeiten, Eingabe (auch Zoom), Hauptschleife, Speicherstand,
// Medaillen, Olympiade, Pinguin-Pass und Koop (Verbindung zum Server, Takt für Takt nachrechnen).
(function () {
  const PT = window.PT;
  const $ = s => document.querySelector(s);
  const esc = t => String(t).replace(/[&<>"]/g, z => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[z]));
  const speicher = {
    lesen(k, ls = localStorage) { try { return JSON.parse(ls.getItem(k)); } catch (e) { return null; } },
    schreiben(k, v, ls = localStorage) { try { ls.setItem(k, JSON.stringify(v)); } catch (e) { /* voll oder gesperrt */ } },
    weg(k, ls = localStorage) { try { ls.removeItem(k); } catch (e) { /* egal */ } }
  };
  const zahl = n => Math.floor(n).toLocaleString('de-DE');

  let welt = null, spiel = null, auswahl = null, bauTyp = null, zeiger = null, zielModus = null;
  let tempo = 1, pausiert = false, zeitRest = 0, letzte = 0, autoWarte = 0;
  let wahl = Object.assign({ karte:'scholle', stufe:'mittel', modus:'standard', held:'kiel', kraft:true }, speicher.lesen('pt-wahl') || {});
  // eigene Karten aus dem Editor: [{ id, ...Karte }]
  let eigeneKarten = (speicher.lesen('pt-karten') || []).map(k => { const ok = PT.karteOk(k); return ok && k.id ? { ...ok, id:String(k.id) } : null; }).filter(Boolean);
  const eigeneKarte = id => eigeneKarten.find(k => 'eigen:' + k.id === id) || null;
  if (!PT.KARTEN[wahl.karte] && !eigeneKarte(wahl.karte)) wahl.karte = 'scholle';
  if (!PT.STUFEN[wahl.stufe]) wahl.stufe = 'mittel';
  if (!PT.MODI[wahl.modus]) wahl.modus = 'standard';
  if (wahl.held && !PT.HELDEN[wahl.held]) wahl.held = 'kiel';
  let grafikHoch = speicher.lesen('pt-grafik') !== false;
  let bilder = {}, fischBilder = {};
  let olymp = null;   // { ticket, info, einst } wenn als Olympia-Disziplin gespielt wird
  const medaillen = speicher.lesen('pt-medaillen') || {};

  /* ---------- Einstellungen ---------- */
  const einstellung = Object.assign({ laut:60, design:'auto', vorschau:true, balken:true, texte:true, wackeln:true, autoStart:false }, speicher.lesen('pt-einst') || {});
  function einstAnwenden() {
    if (einstellung.design === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', einstellung.design);
    if (PT.Ton.lautstaerke) PT.Ton.lautstaerke(einstellung.laut / 100);
    if (welt) { welt.lebensbalken = einstellung.balken; welt.texteAn = einstellung.texte; welt.kameraWackeln = einstellung.wackeln; }
  }

  /* ---------- Fortschritt: Fischmünzen, Wissen, Erfolge, Aufträge, Tages-Herausforderung ---------- */
  const fort = Object.assign({ muenzen:0, wissen:{}, wissenAn:true, erfolge:{}, lebenslang:{ platzer:0, tage:0, siege:0 }, auftraege:null, tage:{},
    besitz:{ skins:{}, sockel:{} }, kisten:{ holz:0, silber:0, gold:0 }, kampagne:{}, wochen:null, saison:null, booster:0, haendler:null, dorf:null, kampagneAlt:null },
    speicher.lesen('pt-fortschritt') || {});
  fort.lebenslang = Object.assign({ platzer:0, tage:0, siege:0, kisten:0, vsSiege:0, vsSpiele:0 }, fort.lebenslang);
  fort.dorf = Object.assign(PT.dorfNeu(), fort.dorf || {});
  fort.dorf.stufen = Object.assign({}, fort.dorf.stufen);
  fort.besitz = Object.assign({ skins:{}, sockel:{}, titel:{}, effekte:{}, taenze:{}, kraefte:{}, deko:{} }, fort.besitz);
  fort.kisten = Object.assign({ holz:0, silber:0, gold:0 }, fort.kisten);
  fort.tagebuch = Object.assign({}, fort.tagebuch);   // gesammelte Seiten aus Opas Tagebuch (Teil 2)
  fort.albtraum = Object.assign({}, fort.albtraum);   // im Albtraum geschaffte Levels
  const fortMerken = () => speicher.schreiben('pt-fortschritt', fort);
  let tagesAktiv = null;          // Datum der Tages-Herausforderung, die gerade gespielt wird
  let spielLohn = { xp:0, muenzen:0, erfolge:[] };   // was dieses Spiel gebracht hat (fürs Ergebnisbild)
  let zaehler = null;             // Stand der Zähler beim letzten Melden (Aufträge, lebenslange Fische)
  function auftraegeHeute() {
    const d = PT.heute();
    if (!fort.auftraege || fort.auftraege.datum !== d) { fort.auftraege = { datum:d, stand:{}, fertig:{} }; fortMerken(); }
    return PT.tagesAuftraege(d);
  }
  function muenzenDazu(n, warum) {
    if (!n) return;
    fort.muenzen += n; spielLohn.muenzen += n; fortMerken();
    if (warum) kurzTipp(`🪙 +${n} Fischmünzen – ${warum}`);
  }
  // Boni: Pinguin-Wissen nur im freien Einzelspiel, das Pingu-Dorf auch im Abenteuer und im Koop
  const dorfBoni = () => PT.dorfBoni(fort.dorf);
  const boniAktiv = () => (olymp || tagesAktiv ? null : kampagneAktiv ? dorfBoni()
    : PT.boniMischen(fort.wissenAn !== false ? PT.boniAus(fort.wissen) : null, dorfBoni()));
  // Eiskristalle fürs Pingu-Dorf (das Leuchtfeuer bringt mehr)
  function kristalleDazu(n, warum) {
    n = Math.round(n * PT.kristallFaktor(fort.dorf));
    if (!n) return 0;
    fort.dorf.kristalle += n; spielLohn.kristalle = (spielLohn.kristalle || 0) + n; fortMerken();
    if (warum) kurzTipp(`❄️ +${n} Eiskristalle – ${warum}`);
    return n;
  }
  let kampagneAktiv = null;       // Level-Id des Abenteuers, das gerade gespielt wird
  let spielBooster = false;       // dieses Spiel bringt doppelte Erfahrung
  function kisteDazu(art, warum) {
    fort.kisten[art] = (fort.kisten[art] || 0) + 1; fortMerken();
    spielLohn.kisten = (spielLohn.kisten || []).concat(art);
    banner(`${PT.KISTEN[art].symbol} ${PT.KISTEN[art].name}!`, warum || 'Öffne sie im Menü.', 2.6);
  }
  // Wochen-Quests: Zähler für diese Woche
  function wochenHeute() {
    const w = PT.wocheId();
    if (!fort.wochen || fort.wochen.id !== w) { fort.wochen = { id:w, stand:{}, fertig:{} }; fortMerken(); }
    return PT.wochenQuests(w);
  }
  function wochenDazu(art, n) {
    if (!n) return;
    const W = fort.wochen;
    for (const q of wochenHeute()) {
      if (q.art !== art || W.fertig[q.id]) continue;
      W.stand[q.id] = Math.min(q.ziel, (W.stand[q.id] || 0) + n);
      if (W.stand[q.id] >= q.ziel) {
        W.fertig[q.id] = true;
        banner('🗓️ Wochen-Quest geschafft!', `${q.text} · +${q.xp} Erfahrung · ${PT.KISTEN[q.kiste].name}`, 3);
        fortMerken();
        xpDazu(q.xp, true);
        kisteDazu(q.kiste, 'Belohnung der Wochen-Quest');
      }
    }
    fortMerken();
  }
  // Saison: Erfahrung zählt auch für die Leiste des Monats
  function saisonHeute() {
    const id = PT.saisonId();
    if (!fort.saison || fort.saison.id !== id) { fort.saison = { id, xp:0, stufe:0 }; fortMerken(); }
    return fort.saison;
  }
  function saisonXp(n) {
    const S = saisonHeute();
    S.xp += n;
    const neu = PT.saisonStufe(S.xp);
    while (S.stufe < neu) {
      S.stufe++;
      const b = PT.SAISON_BELOHNUNG[S.stufe];
      if (!b) continue;
      if (b.muenzen) muenzenDazu(b.muenzen);
      if (b.booster) { fort.booster += b.booster; }
      if (b.saisonLook) { const look = PT.saisonLook(new Date().getMonth() + 1); if (look) { fort.besitz.skins[look] = true; banner('🍂 Saison-Look!', PT.SKINS[look].name, 3); } }
      if (b.kiste) kisteDazu(b.kiste, `Saison-Stufe ${S.stufe}`);
      else banner(`🍂 Saison-Stufe ${S.stufe}!`, b.muenzen ? `+${b.muenzen} Fischmünzen` : b.booster ? `Doppel-Erfahrung für ${b.booster} Spiele` : '', 2.4);
    }
    fortMerken();
  }

  /* ---------- Pinguin-Pass ---------- */
  const pass = Object.assign({ xp:0, skin:'standard', sockel:'standard', titel:'neuling', effekt:'standard', tanz:'standard', prestige:0, abgeholt:null }, speicher.lesen('pt-pass') || {});
  const passStufe = () => PT.passStufe(pass.xp).stufe;
  // Umstieg auf den Pass mit 100 Stufen: was nach der alten Rechnung schon erreicht war, gilt als abgeholt
  if (pass.abgeholt == null) pass.abgeholt = Math.min(passStufe(), PT.passStufeAlt(pass.xp));
  if (!PT.TITEL[pass.titel]) pass.titel = 'neuling';
  if (!PT.EFFEKTE[pass.effekt]) pass.effekt = 'standard';
  if (!PT.TAENZE[pass.tanz]) pass.tanz = 'standard';
  if (!PT.SKINS[pass.skin] || !PT.skinFrei(pass.skin, passStufe(), fort.besitz)) pass.skin = 'standard';
  if (!PT.SOCKEL[pass.sockel] || !PT.sockelFrei(pass.sockel, passStufe(), fort.besitz)) pass.sockel = 'standard';
  let lookBilder = {}, sockelBilder = {};
  // Eine Belohnung aus dem Pass als Text und Bild
  function belohnungText(b) {
    if (b.skin) return `Look: ${PT.SKINS[b.skin].name}`;
    if (b.sockel) return `Sockel: ${PT.SOCKEL[b.sockel].name}`;
    if (b.kraft) return `Meisterkraft für ${PT.HELDEN[b.kraft].name}`;
    if (b.titel) return `Titel „${PT.TITEL[b.titel]}“`;
    if (b.effekt) return `Platz-Effekt: ${PT.EFFEKTE[b.effekt].name}`;
    if (b.tanz) return `Siegestanz: ${PT.TAENZE[b.tanz].name}`;
    if (b.deko) return `Dorf-Deko: ${PT.DEKO[b.deko].name}`;
    if (b.muenzen) return `${Math.round(b.muenzen * PT.prestigeFaktor(pass.prestige))} Fischmünzen`;
    if (b.kristalle) return `${b.kristalle} Eiskristalle`;
    if (b.kiste) return PT.KISTEN[b.kiste].name;
    if (b.booster) return `${b.booster}× Doppel-Erfahrung`;
    return '';
  }
  function belohnungBild(b) {
    if (b.skin && lookBilder[b.skin]) return `<img src="${lookBilder[b.skin]}" alt="">`;
    if (b.sockel && sockelBilder[b.sockel]) return `<img src="${sockelBilder[b.sockel]}" alt="">`;
    return `<i>${b.kraft ? '✨' : b.titel ? '🏷️' : b.effekt ? PT.EFFEKTE[b.effekt].zeichen : b.tanz ? '💃' : b.deko ? PT.DEKO[b.deko].symbol : b.muenzen ? '🪙' : b.kristalle ? '❄️' : b.kiste ? PT.KISTEN[b.kiste].symbol : b.booster ? '⚡' : '🎖️'}</i>`;
  }
  const stufeText = st => (PT.PASS_STUFEN[st] ? PT.PASS_STUFEN[st].b.map(belohnungText).join(' · ') : '');
  // Münzen, Kristalle, Kisten und Booster einer Stufe gutschreiben (Looks & Co. ergeben sich aus der Stufe)
  function stufeAbholen(st) {
    const x = PT.PASS_STUFEN[st];
    if (!x) return;
    for (const b of x.b) {
      if (b.muenzen) { fort.muenzen += Math.round(b.muenzen * PT.prestigeFaktor(pass.prestige)); }
      if (b.kristalle) fort.dorf.kristalle += b.kristalle;
      if (b.kiste) fort.kisten[b.kiste] = (fort.kisten[b.kiste] || 0) + 1;
      if (b.booster) fort.booster += b.booster;
    }
    fortMerken();
  }
  // Aufstiegs-Karte in der Mitte, bei Mythisch mit Lichtstrahl (mehrere nacheinander)
  let aufSchlange = [], aufUhr = null;
  function aufstiegZeigen(st) {
    // mitten im Spiel nur ein Banner, außer bei Legendär und Mythisch
    const x = PT.PASS_STUFEN[st];
    if (!$('#spiel').hidden && x && x.s !== 'l' && x.s !== 'm') { banner(`🎖️ Pass-Stufe ${st}!`, stufeText(st), 3); PT.Ton.upgrade(); return; }
    aufSchlange.push(st);
    if (!aufUhr) aufNaechste();
  }
  function aufNaechste() {
    const st = aufSchlange.shift();
    if (st == null) { $('#aufstieg').hidden = true; aufUhr = null; return; }
    const x = PT.PASS_STUFEN[st], R = PT.SELTENHEIT[x ? x.s : 'g'];
    const k = $('#aufKarte');
    k.style.setProperty('--rf', R.farbe);
    k.classList.toggle('mythisch', !!x && x.s === 'm');
    $('#aufSeltenheit').textContent = R.name;
    $('#aufStufe').textContent = `Stufe ${st}`;
    $('#aufInhalt').innerHTML = x ? x.b.map(b => `${belohnungBild(b)}<p>${esc(belohnungText(b))}</p>`).join('') : '';
    $('#aufstieg').hidden = false;
    k.style.animation = 'none'; void k.offsetHeight; k.style.animation = '';
    if (x && (x.s === 'm' || x.s === 'l')) { PT.Ton.schlag(); PT.Ton.upgrade(); } else PT.Ton.upgrade();
    aufUhr = setTimeout(aufNaechste, x && x.s === 'm' ? 4500 : 2600);
  }
  $('#aufstieg').onclick = () => { clearTimeout(aufUhr); aufNaechste(); };
  // ohneSpiel: Erfahrung auch außerhalb eines Spiels (Kisten, Wochen-Quests)
  function xpDazu(n, ohneSpiel) {
    if (!n || (!ohneSpiel && (!spiel || spiel.unendlich))) return;
    if (spielBooster && !ohneSpiel) n *= 2;
    n = Math.round(n * (1 + PT.dorfWert(fort.dorf, 'akademie')));
    saisonXp(n);
    pass.xp += n;
    spielLohn.xp += n;
    passNachholen();
  }
  // Stufen, die neu erreicht sind: Belohnungen abholen und zeigen
  function passNachholen(still) {
    const nach = passStufe(), von = pass.abgeholt;
    while (pass.abgeholt < nach) {
      pass.abgeholt++;
      stufeAbholen(pass.abgeholt);
      if (!still || nach - von <= 3) aufstiegZeigen(pass.abgeholt);
    }
    if (still && nach - von > 3) setTimeout(() => banner('🎖️ Der Pinguin-Pass hat jetzt 100 Stufen!', `Du bist direkt auf Stufe ${nach} – die Belohnungen ab Stufe ${von + 1} sind gutgeschrieben.`, 5), 900);
    speicher.schreiben('pt-pass', pass);
  }
  // Zähler seit dem letzten Melden: Aufträge, lebenslange Fische (nach jeder Runde und am Spielende)
  function zaehlerStand() {
    const pops = {};
    for (const t of spiel.tuerme) pops[t.typ] = (pops[t.typ] || 0) + t.pops;
    return { platzer:spiel.statistik.platzer, faehigkeiten:spiel.statistik.faehigkeiten || 0, stufe5:spiel.statistik.stufe5 || 0, bosse:spiel.statistik.bosse || 0, pops };
  }
  function fortschrittMelden(art) {
    if (!spiel || spiel.unendlich || olymp) return;
    const jetzt = zaehlerStand(), alt = zaehler || jetzt;
    zaehler = jetzt;
    const d = (k) => Math.max(0, (jetzt[k] || 0) - (alt[k] || 0));
    fort.lebenslang.platzer += d('platzer');
    const liste = auftraegeHeute(), A = fort.auftraege;
    for (const a of liste) {
      if (A.fertig[a.id]) continue;
      let plus = 0;
      if (a.art === 'platzer') plus = d('platzer');
      if (a.art === 'faehigkeiten') plus = d('faehigkeiten');
      if (a.art === 'stufe5') plus = d('stufe5');
      if (a.art === 'runden' && art === 'runde') plus = 1;
      if (a.art === 'sieg' && art === 'sieg') plus = 1;
      if (a.art === 'pinguin') plus = Math.max(0, (jetzt.pops[a.typ] || 0) - (alt.pops[a.typ] || 0));
      if (!plus) continue;
      A.stand[a.id] = Math.min(a.ziel, (A.stand[a.id] || 0) + plus);
      if (A.stand[a.id] >= a.ziel) {
        A.fertig[a.id] = true;
        banner('📋 Auftrag erledigt!', `${a.text} · +${a.xp} Erfahrung · +${a.muenzen} 🪙`, 3);
        PT.Ton.aufstieg && PT.Ton.aufstieg();
        fortMerken();
        xpDazu(a.xp);
        muenzenDazu(a.muenzen);
        kristalleDazu(2);
      }
    }
    if (art === 'sieg') fort.lebenslang.siege++;
    if (art === 'runde' && spiel.runde % 5 === 0) muenzenDazu(1);
    fortMerken();
    wochenHeute();
    for (const k of ['platzer', 'faehigkeiten', 'stufe5', 'bosse']) wochenDazu(k, d(k));
    if (art === 'runde') wochenDazu('runden', 1);
    if (art === 'sieg') wochenDazu('sieg', 1);
    erfolgeCheck(art === 'sieg' || art === 'verloren', art === 'sieg');
  }
  function erfolgeCheck(ende, gewonnen) {
    if (!spiel || olymp) return;
    const neu = PT.erfolgePruefen({ spiel, gewonnen, ende, geld:meinGeld(), lebenslang:fort.lebenslang, passStufe:passStufe(), prestige:pass.prestige, medaillen,
      kampagne:fort.kampagne, dorf:fort.dorf, tagebuch:fort.tagebuch, albtraum:fort.albtraum, lookZahl:PT.SKIN_REIHE.filter(id => PT.skinFrei(id, passStufe(), fort.besitz)).length }, fort.erfolge);
    for (const e of neu) {
      fort.erfolge[e.id] = PT.heute();
      spielLohn.erfolge.push(e);
      banner(`🏆 Erfolg: ${e.name}`, `${e.text} · +${e.muenzen} 🪙`, 3);
      muenzenDazu(e.muenzen);
    }
    if (neu.length) fortMerken();
  }
  // Meisterkraft im Einzelspiel: freigeschaltet und eingeschaltet (in der Olympiade nie)
  const kraftAktiv = held => !olymp && wahl.kraft !== false && !!held && PT.kraftFrei(held, passStufe(), fort.besitz);
  function passBauen() {
    const info = PT.passStufe(pass.xp);
    $('#passStufe').textContent = `🎖️ Pinguin-Pass · Stufe ${info.stufe}${info.stufe >= PT.PASS_MAX ? ' (Maximum)' : ''}`;
    $('#passXp').textContent = info.bedarf ? `${zahl(info.rest)} / ${zahl(info.bedarf)} Erfahrung` : `${zahl(pass.xp)} Erfahrung`;
    $('#passBalken').style.width = (info.bedarf ? Math.round(info.rest / info.bedarf * 100) : 100) + '%';
    const naechste = info.stufe < PT.PASS_MAX ? info.stufe + 1 : null;
    const mythisch = Object.keys(PT.PASS_STUFEN).map(Number).find(st => st > info.stufe && PT.PASS_STUFEN[st].s === 'm');
    $('#passNaechst').textContent = naechste ? `Nächste Stufe ${naechste}: ${stufeText(naechste)}.${mythisch ? ` Mythisch auf Stufe ${mythisch}: ${stufeText(mythisch)}.` : ''}`
      : pass.prestige < PT.PRESTIGE_MAX ? 'Stufe 100! Öffne den Pass für Prestige.' : 'Alles geschafft – du bist eine Legende.';
    $('#passTitel').textContent = `${'⭐'.repeat(pass.prestige || 0)} ${PT.TITEL[pass.titel] || ''}`.trim();
    $('#muenzen').textContent = `🪙 ${zahl(fort.muenzen)}`;
    // Leiste mit den Belohnungen rund um die aktuelle Stufe
    const von = Math.max(1, Math.min(info.stufe - 2, PT.PASS_MAX - 9));
    let leiste = '';
    for (let st = von; st <= Math.min(PT.PASS_MAX, von + 11); st++) {
      const x = PT.PASS_STUFEN[st], b = x.b[0];
      leiste += `<div class="stufe-chip r-${x.s} ${st <= info.stufe ? 'da' : ''} ${st === info.stufe ? 'jetzt' : ''}" title="${esc(PT.SELTENHEIT[x.s].name + ': ' + stufeText(st))}"><b>${st}</b>${belohnungBild(b)}<span>${esc(belohnungText(b))}</span></div>`;
    }
    $('#passLeiste').innerHTML = leiste;
    // Tagesaufträge
    const auf = auftraegeHeute();
    $('#auftraege').innerHTML = auf.map(a => {
      const st = fort.auftraege.stand[a.id] || 0, fertig = !!fort.auftraege.fertig[a.id];
      return `<li class="${fertig ? 'fertig' : ''}">${fertig ? '✅' : '🎯'} ${esc(a.text)}<small>${fertig ? 'Erledigt!' : `${zahl(st)} / ${zahl(a.ziel)}`} · +${a.xp} Erfahrung · +${a.muenzen} 🪙</small><div class="mini"><i style="width:${Math.round(st / a.ziel * 100)}%"></i></div></li>`;
    }).join('');
    // Saison des Monats
    const S = saisonHeute(), sst = PT.saisonStufe(S.xp), monat = new Date().getMonth() + 1, slook = PT.saisonLook(monat);
    $('#saisonName').textContent = `🍂 ${PT.SAISON_NAMEN[monat - 1]} · Stufe ${sst} / 10`;
    $('#saisonXp').textContent = sst >= 10 ? 'Alles geholt!' : `${zahl(S.xp % PT.SAISON_STUFE_XP)} / ${PT.SAISON_STUFE_XP} Erfahrung`;
    $('#saisonBalken').style.width = (sst >= 10 ? 100 : Math.round(S.xp % PT.SAISON_STUFE_XP / PT.SAISON_STUFE_XP * 100)) + '%';
    $('#saisonLeiste').innerHTML = PT.SAISON_BELOHNUNG.slice(1).map((b, i) => {
      const bild = b.saisonLook && slook && lookBilder[slook] ? `<img src="${lookBilder[slook]}" alt="">` : `<i>${b.kiste ? PT.KISTEN[b.kiste].symbol : b.booster ? '⚡' : '🪙'}</i>`;
      const name = b.saisonLook ? (slook ? PT.SKINS[slook].name : 'Look') : b.kiste ? PT.KISTEN[b.kiste].name : b.booster ? `${b.booster}× Doppel-XP` : `${b.muenzen} Münzen`;
      return `<div class="stufe-chip ${i + 1 <= sst ? 'da' : ''}"><b>${i + 1}</b>${bild}<span>${esc(name)}</span></div>`;
    }).join('');
    $('#booster').textContent = fort.booster > 0 ? `⚡ Doppel-Erfahrung noch für ${fort.booster} ${fort.booster === 1 ? 'Spiel' : 'Spiele'}` : '';
    const herkunft = (o, art, id) => o.herkunft === 'kiste' ? '🎁 Kiste oder Händler' : o.herkunft === 'kampagne' ? '📖 Abenteuer' : o.herkunft === 'dorf' ? '🏘️ Pingu-Dorf' : o.herkunft === 'versus' ? '⚔️ 10 Versus-Siege' : o.herkunft === 'saison' ? `🍂 Saison im ${['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][o.monat - 1]}` : `🔒 Stufe ${PT.belohnungStufe(art, id) || '?'}`;
    const sockelEl = $('#sockel');
    sockelEl.innerHTML = PT.SOCKEL_REIHE.map(id => {
      const frei = PT.sockelFrei(id, info.stufe, fort.besitz);
      return `<button class="look" data-sockel="${id}" aria-pressed="${pass.sockel === id}" ${frei ? '' : 'disabled'}><img src="${sockelBilder[id] || ''}" alt=""><b>${esc(PT.SOCKEL[id].name)}</b><small>${frei ? (pass.sockel === id ? 'Aktiv' : 'Benutzen') : esc(herkunft(PT.SOCKEL[id], 'sockel', id))}</small></button>`;
    }).join('');
    for (const b of sockelEl.querySelectorAll('[data-sockel]')) b.onclick = () => sockelWaehlen(b.dataset.sockel);
    const looks = $('#looks');
    looks.innerHTML = PT.SKIN_REIHE.map(id => {
      const frei = PT.skinFrei(id, info.stufe, fort.besitz);
      return `<button class="look" data-look="${id}" aria-pressed="${pass.skin === id}" ${frei ? '' : 'disabled'}><img src="${lookBilder[id] || ''}" alt=""><b>${esc(PT.SKINS[id].name)}</b><small>${frei ? (pass.skin === id ? 'Aktiv' : 'Anziehen') : esc(herkunft(PT.SKINS[id], 'skin', id))}</small></button>`;
    }).join('');
    for (const b of looks.querySelectorAll('[data-look]')) b.onclick = () => lookWaehlen(b.dataset.look);
    $('#kraeftePass').innerHTML = PT.HELDEN_REIHE.map(h => {
      const ab = PT.belohnungStufe('kraft', h);
      const frei = PT.kraftFrei(h, info.stufe, fort.besitz);
      return `<li class="${frei ? 'da' : ''}">${frei ? '✨' : '🔒'} <b>${esc(PT.HELDEN[h].name)}</b>${frei ? '' : ` (Stufe ${ab || '?'})`}: ${esc(PT.HELDEN[h].kraft.text)}</li>`;
    }).join('');
    // Titel, Platz-Effekte, Siegestänze, Dorf-Deko
    const wahlChips = (el, reihe, name, frei, aktiv, setzen) => {
      el.innerHTML = reihe.map(id => { const ok = frei(id); return `<button data-id="${id}" aria-pressed="${aktiv === id}" ${ok ? '' : 'disabled'} title="${ok ? '' : esc('Stufe ' + (PT.belohnungStufe(el.dataset.art, id) || '?'))}">${esc(name(id))}${ok ? '' : ' 🔒'}</button>`; }).join('');
      for (const b of el.querySelectorAll('[data-id]')) b.onclick = () => { setzen(b.dataset.id); PT.Ton.klick(); speicher.schreiben('pt-pass', pass); wahlSenden(); menueBauen(); };
    };
    $('#titelWahl').dataset.art = 'titel'; $('#effektWahl').dataset.art = 'effekt'; $('#tanzWahl').dataset.art = 'tanz';
    wahlChips($('#titelWahl'), PT.TITEL_REIHE, id => PT.TITEL[id], id => PT.titelFrei(id, info.stufe, fort.besitz), pass.titel, id => { pass.titel = id; });
    wahlChips($('#effektWahl'), PT.EFFEKT_REIHE, id => `${PT.EFFEKTE[id].zeichen} ${PT.EFFEKTE[id].name}`, id => PT.effektFrei(id, info.stufe, fort.besitz), pass.effekt, id => { pass.effekt = id; });
    wahlChips($('#tanzWahl'), PT.TAENZE_REIHE, id => `💃 ${PT.TAENZE[id].name}`, id => PT.tanzFrei(id, info.stufe, fort.besitz), pass.tanz, id => { pass.tanz = id; });
    $('#dekoListe').innerHTML = PT.DEKO_REIHE.map(id => { const ok = PT.dekoFrei(id, info.stufe, fort.besitz); return `<span class="${ok ? '' : 'zu'}">${PT.DEKO[id].symbol} ${esc(PT.DEKO[id].name)}${ok ? ' ✓' : ` · Stufe ${PT.belohnungStufe('deko', id)}`}</span>`; }).join('');
    if (!$('#passSeite').hidden) passSeiteBauen();
  }
  // Große Pass-Seite: alle 100 Stufen als Karten, Prestige
  function passSeiteBauen() {
    const info = PT.passStufe(pass.xp);
    $('#psTitel').textContent = `🎖️ Pinguin-Pass · Stufe ${info.stufe} / ${PT.PASS_MAX}`;
    $('#psUnter').textContent = `${'⭐'.repeat(pass.prestige || 0)}${pass.prestige ? ` Prestige ${pass.prestige} · ` : ''}${PT.TITEL[pass.titel] || ''} · ${info.bedarf ? `${zahl(info.rest)} / ${zahl(info.bedarf)} Erfahrung bis Stufe ${info.stufe + 1}` : 'Maximum erreicht'}`;
    $('#psBalken').style.width = (info.bedarf ? Math.round(info.rest / info.bedarf * 100) : 100) + '%';
    let html = '';
    for (let st = 1; st <= PT.PASS_MAX; st++) {
      const x = PT.PASS_STUFEN[st], R = PT.SELTENHEIT[x.s];
      html += `<div class="ps-karte r-${x.s} ${st > info.stufe ? 'zu' : ''} ${st === info.stufe ? 'jetzt' : ''} ${st % 10 === 0 ? 'meilenstein' : ''}" style="--rf:${R.farbe}" data-st="${st}">
        <span class="rar">${esc(R.name)}</span><b>${st}</b>${x.b.slice(0, 2).map(belohnungBild).join('')}<span>${esc(stufeText(st))}</span></div>`;
    }
    $('#psLeiste').innerHTML = html;
    const pr = $('#psPrestige');
    if (info.stufe >= PT.PASS_MAX && pass.prestige < PT.PRESTIGE_MAX) {
      pr.innerHTML = `<span>🏆 Stufe 100 geschafft! Mit <b>Prestige ${pass.prestige + 1}</b> startest du die Leiste neu: Alles, was du freigeschaltet hast, bleibt für immer. Du bekommst einen Prestige-Stern, und Münzen aus dem Pass gibt es dann ${Math.round((PT.prestigeFaktor(pass.prestige + 1) - 1) * 100)} % mehr.</span><button class="knopf" id="prestigeLos">⭐ Prestige ${pass.prestige + 1} starten</button>`;
      $('#prestigeLos').onclick = prestigeStarten;
    } else pr.innerHTML = pass.prestige ? `<span>${'⭐'.repeat(pass.prestige)} Prestige ${pass.prestige} von ${PT.PRESTIGE_MAX}</span>` : '';
    const jetzt = $('#psLeiste').querySelector('.jetzt');
    if (jetzt) $('#psLeiste').scrollLeft = jetzt.offsetLeft - $('#psLeiste').clientWidth / 2 + 54;
  }
  function prestigeStarten() {
    if (passStufe() < PT.PASS_MAX || pass.prestige >= PT.PRESTIGE_MAX || !confirm('Prestige starten? Deine Leiste beginnt wieder bei Stufe 1 – alles Freigeschaltete bleibt.')) return;
    const alles = PT.passAllesBesitz();
    for (const [k, v] of Object.entries(alles)) fort.besitz[k] = Object.assign(fort.besitz[k] || {}, v);
    fortMerken();
    pass.prestige++; pass.xp = 0; pass.abgeholt = 1;
    speicher.schreiben('pt-pass', pass);
    banner(`⭐ Prestige ${pass.prestige}!`, 'Alles bleibt freigeschaltet – auf zu Stufe 100!', 4);
    PT.Ton.schlag(); PT.Ton.upgrade();
    wahlSenden();
    menueBauen();
  }
  const passZeigen = () => ({ skin:pass.skin, sockel:pass.sockel, titel:pass.titel, effekt:pass.effekt, prestige:pass.prestige || 0 });
  function wahlSenden() { if (netz && netz.raum) senden({ t:'wahl', boni:dorfBoni(), held:meinMitglied() ? meinMitglied().held : wahl.held, kraft:kraftAktivKoop(), ...passZeigen() }); }
  function lookWaehlen(id) {
    if (!PT.skinFrei(id, passStufe(), fort.besitz) || pass.skin === id) return;
    pass.skin = id;
    speicher.schreiben('pt-pass', pass);
    PT.Ton.klick();
    bilderMalen(false, true);
    if (netz && netz.raum) senden({ t:'wahl', boni:dorfBoni(), held:meinMitglied() ? meinMitglied().held : wahl.held, kraft:kraftAktivKoop(), ...passZeigen() });
    menueBauen();
  }
  function sockelWaehlen(id) {
    if (!PT.sockelFrei(id, passStufe(), fort.besitz) || pass.sockel === id) return;
    pass.sockel = id;
    speicher.schreiben('pt-pass', pass);
    PT.Ton.klick();
    bilderMalen();
    if (netz && netz.raum) senden({ t:'wahl', boni:dorfBoni(), held:meinMitglied() ? meinMitglied().held : wahl.held, kraft:kraftAktivKoop(), ...passZeigen() });
    menueBauen();
  }
  // Vorschaubilder im aktuellen Look (Laden, Helden), alle Looks und Sockel für den Pass
  function bilderMalen(mitLooks, nurSockel) {
    const b = PT.Welt.bilder([...PT.PINGUIN_REIHE, ...PT.HELDEN_REIHE], mitLooks ? [...PT.FISCH_REIHE, ...PT.BOSS_REIHE] : [], pass.skin, mitLooks ? PT.SKIN_REIHE : [],
      pass.sockel, mitLooks || nurSockel ? PT.SOCKEL_REIHE : []);
    bilder = b.pingu;
    if (mitLooks) { fischBilder = b.fisch; lookBilder = b.look; }
    if (mitLooks || nurSockel) sockelBilder = b.sockel;
  }

  /* ---------- Koop: Verbindung zum Server ----------
     netz.raum ist der Raum, wie der Server ihn zuletzt geschickt hat. Im Spiel rechnet der Browser Takt für
     Takt nach, was der Server vorgibt (netz.n = zuletzt gerechneter Takt, netz.ziel = letzter bekannter). */
  let koopReiter = false;
  let netz = null;
  const ich = () => (spiel && spiel.koop && netz ? netz.id : null);
  const meinGeld = () => (spiel ? spiel.kasse(ich()).geld : 0);
  const imKoop = () => !!(spiel && spiel.koop);
  const meinMitglied = () => (netz && netz.raum && netz.raum.mitglieder ? netz.raum.mitglieder.find(m => m.id === netz.id) : null);
  const binHost = () => !!(netz && netz.raum && netz.raum.host === netz.id);
  const kraftAktivKoop = (held) => { const m = meinMitglied(); const h = held !== undefined ? held : m ? m.held : wahl.held; return wahl.kraft !== false && !!h && PT.kraftFrei(h, passStufe(), fort.besitz); };
  function senden(d) {
    if (!netz) return;
    if (netz.ws && netz.ws.readyState === 1) netz.ws.send(JSON.stringify(d));
    else if (netz.warte.length < 20) netz.warte.push(d);
  }
  function netzVerbinden() {
    if (!netz) netz = { id:null, token:null, raum:null, ws:null, warte:[], befehle:[], n:0, ziel:0, rest:0, ref:1, versuche:0 };
    if (netz.ws && netz.ws.readyState <= 1) return;
    let ws;
    try { ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`); } catch (e) { koopFehler('Keine Verbindung zum Server.'); return; }
    netz.ws = ws;
    ws.onopen = () => {
      netz.versuche = 0;
      const alt = speicher.lesen('pt-koop', sessionStorage);
      ws.send(JSON.stringify({ t:'hallo', name:koopName(), ...passZeigen(), token:alt && alt.token, code:alt && alt.code }));
      for (const d of netz.warte.splice(0)) ws.send(JSON.stringify(d));
      koopFehler('');
      if (imKoop()) kurzTipp('Wieder verbunden.');
    };
    ws.onmessage = e => { let d; try { d = JSON.parse(e.data); } catch (_) { return; } netzNachricht(d); };
    ws.onclose = () => {
      if (netz.ws !== ws) return;
      netz.ws = null;
      if (!netz.raum && !koopReiter) return;
      netz.versuche++;
      if (imKoop()) tipp('Verbindung weg – verbinde neu …');
      else koopFehler(netz.versuche > 2 ? 'Keine Verbindung zum Server. Ich versuche es weiter …' : '');
      setTimeout(netzVerbinden, Math.min(8000, 800 * netz.versuche));
    };
  }
  function koopName() { return ($('#koopName').value || '').trim().slice(0, 16); }
  function koopFehler(text) { $('#koopFehler').textContent = text || ''; }
  function netzNachricht(d) {
    switch (d.t) {
      case 'du': netz.id = d.id; netz.token = d.token; break;
      case 'fehler':
        if (imKoop() && !$('#spiel').hidden) kurzTipp(d.text); else koopFehler(d.text);
        PT.Ton.fehler();
        break;
      case 'raum': {
        const alt = netz.raum;
        if (!d.code) {
          netz.raum = null;
          speicher.weg('pt-koop', sessionStorage);
          if (imKoop()) { zumMenue(); koopFehler('Die Partie ist vorbei.'); }
          if (!$('#menue').hidden) menueBauen();
          break;
        }
        netz.raum = d;
        speicher.schreiben('pt-koop', { token:netz.token, code:d.code }, sessionStorage);
        koopReiter = true;
        // gerade beigetreten: eigenen Helden, Meisterkraft und Look mitteilen
        if ((!alt || alt.code !== d.code) && d.phase === 'lobby') senden({ t:'wahl', boni:dorfBoni(), held:wahl.held, kraft:kraftAktivKoop(wahl.held), ...passZeigen() });
        if (d.phase === 'lobby' && imKoop()) zumMenue();
        if (d.phase === 'spiel' && imKoop()) {
          tempo = d.tempo;
          $('#auto').checked = d.auto;
          koopPauseZeigen();
          letzteAnzeige = '';
          // Looks und Farben der Mitspieler können sich geändert haben (z. B. nach Wiederverbinden)
          if (alt && JSON.stringify(alt.mitglieder.map(m => m.skin + m.sockel)) !== JSON.stringify(d.mitglieder.map(m => m.skin + m.sockel)) && welt) welt.allesNeu();
        }
        if (!$('#menue').hidden) menueBauen();
        break;
      }
      case 'zustand': koopZustand(d); wetterHud(); break;
      case 'takt':
        if (!imKoop()) break;
        for (const x of d.b) if (x[0] > netz.n) netz.befehle.push(x);
        netz.ziel = Math.max(netz.ziel, d.n);
        break;
    }
  }
  function koopZustand(d) {
    vs = d.z && d.z.versus ? PT.Versus.ausZustand(d.z) : null;
    const neu = vs ? vs.spielVon(netz.id) || vs.spiele[0] : PT.Spiel.ausZustand(d.z);
    netz.n = d.n; netz.ziel = d.n; netz.rest = 0;
    netz.befehle = netz.befehle.filter(x => x[0] > d.n);
    if (!spiel || !spiel.koop || $('#spiel').hidden || spiel.karte !== neu.karte || !!vs === $('#vsPanel').hidden) { spielStarten(neu); tempo = d.tempo || 1; return; }
    tempo = d.tempo || 1;
    // Spielstand vom Server übernehmen (Abweichung oder Wiederverbinden): Pinguine neu bauen, Auswahl behalten
    const altId = auswahl && auswahl.id;
    spiel = neu;
    welt.allesNeu();
    auswahl = altId ? spiel.tuerme.find(t => t.id === altId) || null : null;
    zielModus = null;
    ladenBauen(); seiteZeigen();
    fkSchluessel = ''; letzteAnzeige = '';
  }
  // Takte nachrechnen: ein kleiner Puffer gleicht das Netz aus, bei Rückstand wird aufgeholt
  function koopRechnen(dt) {
    const vorne = netz.ziel - netz.n;
    if (vorne <= 0) { netz.rest = 0; return; }
    netz.rest += dt * 60 * tempo;
    let n = Math.floor(netz.rest);
    netz.rest -= n;
    if (vorne - n > 8 * tempo + 6) n = vorne - 3 * tempo;
    n = Math.min(n, vorne, 600);
    for (let i = 0; i < n; i++) {
      const k = ++netz.n;
      while (netz.befehle.length && netz.befehle[0][0] <= k) {
        const [kk, sp, b] = netz.befehle.shift();
        if (kk < k) continue;
        const res = (vs || spiel).befehl(sp, b);
        if (sp === netz.id && b.ref != null) ergebnis(b, res);
      }
      (vs || spiel).schritt(1 / 60);
      if (vs) { const g = gegnerSpiel(); if (g) g.ereignisse.length = 0; }
      if (k % 60 === 0) senden({ t:'p', n:k, h:(vs || spiel).pruefsumme() });
    }
  }
  function koopPauseZeigen() {
    const p = netz && netz.raum && netz.raum.pause;
    if (!imKoop()) return;
    if (p) { pause(true, true); $('#pauseTitel').textContent = `Pause (${p})`; }
    else if (!$('#pause').hidden) { $('#pause').hidden = true; pausiert = false; }
  }
  function koopVerlassen() {
    senden({ t:'verlassen' });
    speicher.weg('pt-koop', sessionStorage);
    netz.raum = null;
    zumMenue();
  }
  function mitspielerZeigen() {
    const el = $('#mitspieler');
    if (!imKoop()) { el.hidden = true; return ''; }
    el.hidden = false;
    const online = id => { const m = netz.raum && netz.raum.mitglieder.find(x => x.id === id); return !m || m.online; };
    const getrennt = spiel.geldModus === 'getrennt';
    const html = spiel.spieler.map(x => `<span class="sp ${online(x.id) ? '' : 'weg'} ${x.id === netz.id ? 'ich' : ''}" style="--f:${PT.KOOP_FARBEN[x.farbe]}"><i></i>${esc(x.name)}${getrennt ? ` <b>${spiel.unendlich ? '∞' : zahl(x.geld)}</b>` : ''}</span>`).join('');
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    return html;
  }

  /* ---------- Befehle: im Einzelspiel sofort, im Koop über den Server ---------- */
  function tun(b) {
    if (!imKoop()) { const res = spiel.befehl(null, b); ergebnis(b, res); return res; }
    b.ref = netz.ref++;
    senden({ t:'b', b });
    return undefined;
  }
  function ergebnis(b, res) {
    switch (b.t) {
      case 'bau':
        if (res) {
          PT.Ton.bauen();
          if (!(b.weiter && spiel.preisBau(b.typ) <= meinGeld())) { bauTyp = null; welt.geistZeigen(null); tipp(''); turmWaehlen(res); }
        } else {
          PT.Ton.fehler();
          const d = PT.def(b.typ);
          kurzTipp(spiel.preisBau(b.typ, b.x, b.y) > meinGeld() ? 'Nicht genug Geld.' : d.wasser ? 'Boote passen nur in die runden Wasserlöcher.' : 'Hier ist kein Platz – nicht ins Wasser, nicht auf Eisberge, nicht zu nah an andere Pinguine.');
        }
        break;
      case 'up': {
        const t = spiel.tuerme.find(x => x.id === b.id);
        if (res) { PT.Ton.upgrade(); if (t && t.pfade[b.pfad] === 5) banner(PT.PINGUINE[t.typ].pfade[b.pfad][4].name, 'Stufe 5!', 1.8); }
        else PT.Ton.fehler();
        break;
      }
      case 'stufe': if (res) PT.Ton.upgrade(); else PT.Ton.fehler(); break;
      case 'verkauf': if (res) { PT.Ton.verkaufen(); if (auswahl && auswahl.id === b.id) turmWaehlen(null); } break;
      case 'fk':
        if (res) { PT.Ton.faehigkeit(); const f = PT.FAEHIGKEITEN[b.fk]; banner(`${f.symbol} ${f.name}`, '', 1.2); }
        else { PT.Ton.fehler(); kurzTipp('Die Fähigkeit lädt noch.'); }
        break;
      case 'start': if (res) { tipp(''); if (olymp) olympMelden('da'); } break;
      case 'sand': PT.Ton.klick(); break;
      case 'schick': if (!res) { PT.Ton.fehler(); kurzTipp('Nicht genug Geld – oder dieser Fisch ist erst später dran.'); } break;
      case 'karte': if (res) PT.Ton.faehigkeit(); else { PT.Ton.fehler(); kurzTipp('Die Karte lädt noch.'); } break;
      case 'leeren': PT.Ton.verkaufen(); break;
    }
    letzteAnzeige = '';
    anzeigen();
  }

  /* ---------- Menü ---------- */
  function kartenVorschau(canvas, id) {
    const k = typeof id === 'string' ? PT.KARTEN[id] || eigeneKarte(id) : id;
    canvas.width = 500; canvas.height = 320;
    const x = canvas.getContext('2d');
    x.scale(0.5, 0.5);
    const hintergrund = { tag:['#f4fbff', '#d6eaf5'], daemmerung:['#fbeef0', '#dcd6ee'], nacht:['#2a3d63', '#15233f'], vulkan:['#6b6470', '#3d3842'], licht:['#fff6e2', '#e6daf2'], organisch:['#7a3a2a', '#3a120c'], tiefsee:['#26304a', '#101628'] }[k.thema] || ['#f4fbff', '#d6eaf5'];
    const g = x.createLinearGradient(0, 0, 0, 640);
    g.addColorStop(0, hintergrund[0]); g.addColorStop(1, hintergrund[1]);
    x.fillStyle = g; x.fillRect(0, 0, 1000, 640);
    x.lineJoin = x.lineCap = 'round';
    for (const ecken of k.wege) {
      const weg = PT.wegBauen(ecken);
      const linie = (b, f) => { x.strokeStyle = f; x.lineWidth = b; x.beginPath(); weg.pts.forEach(([a, c], i) => (i ? x.lineTo(a, c) : x.moveTo(a, c))); x.stroke(); };
      linie(66, 'rgba(255,255,255,0.9)');
      linie(42, k.thema === 'nacht' ? '#1d5f8f' : '#2a8fc4');
      if (weg.lochEnde) { const [a, c] = weg.pts[weg.pts.length - 1]; x.fillStyle = '#0d2c45'; x.beginPath(); x.arc(a, c, 34, 0, Math.PI * 2); x.fill(); }
    }
    for (const [hx, hy, hr] of k.hindernisse) {
      x.fillStyle = k.thema === 'nacht' ? '#6c7f9e' : k.thema === 'vulkan' ? '#2f2a33' : '#bfe0f2';
      x.beginPath(); x.arc(hx, hy, hr, 0, Math.PI * 2); x.fill();
    }
    for (const [wx, wy, wr] of k.wasser || []) {
      x.fillStyle = '#2a8fc4'; x.strokeStyle = '#fff'; x.lineWidth = 6;
      x.beginPath(); x.arc(wx, wy, wr, 0, Math.PI * 2); x.fill(); x.stroke();
    }
    for (const [sx, sy, sr] of k.schmelzen || []) {
      x.fillStyle = 'rgba(94,200,255,0.45)'; x.strokeStyle = '#2a8fc4'; x.lineWidth = 4; x.setLineDash([10, 8]);
      x.beginPath(); x.arc(sx, sy, sr, 0, Math.PI * 2); x.fill(); x.stroke(); x.setLineDash([]);
    }
    for (const [tx, ty, tr] of k.tunnel || []) {
      x.fillStyle = k.thema === 'nacht' ? '#8ea3c4' : '#e4f5ff'; x.strokeStyle = '#9cc6e0'; x.lineWidth = 5;
      x.beginPath(); x.arc(tx, ty, tr, 0, Math.PI * 2); x.fill(); x.stroke();
    }
  }
  PT.kartenVorschau = kartenVorschau;
  /* ---------- Medaillen ----------
     Pro Karte eine Medaille je Schwierigkeit (im Standardmodus) und eine je Spielmodus. Die Modus-Medaille
     hat die Farbe der schwersten Stufe, auf der der Modus dort geschafft wurde. */
  const STUFEN_REIHE = Object.keys(PT.STUFEN);
  const medModi = () => PT.MODI_REIHE.filter(m => m !== 'standard' && m !== 'sandkasten');
  function besteStufe(karte, modus) {
    let beste = null;
    for (const id of STUFEN_REIHE) if (medaillen[`${karte}|${id}|${modus}`]) beste = id;
    return beste;
  }
  function modusMuenze(karte, modus, gross) {
    const m = PT.MODI[modus], beste = besteStufe(karte, modus);
    const titel = `${m.name}: ${beste ? 'geschafft auf ' + PT.STUFEN[beste].name : 'noch nicht geschafft'}`;
    return `<i class="muenze ${beste ? 'm-' + beste : 'aus'}${gross ? ' gross' : ''}" title="${esc(titel)}" aria-label="${esc(titel)}">${m.symbol}</i>`;
  }
  function medaillenText(karte) {
    const stufen = STUFEN_REIHE.map(id => {
      const st = PT.STUFEN[id], an = !!medaillen[`${karte}|${id}|standard`];
      return `<i class="stufen-med${an ? '' : ' aus'}" title="${esc(st.name)}: ${an ? 'geschafft' : 'noch nicht geschafft'}">${st.medaille}</i>`;
    }).join('');
    const modi = medModi();
    const anz = STUFEN_REIHE.filter(id => medaillen[`${karte}|${id}|standard`]).length + modi.filter(m => besteStufe(karte, m)).length;
    const alle = STUFEN_REIHE.length + modi.length;
    return `<div class="medaillen${anz === alle ? ' komplett' : ''}"><div class="med-reihe">${stufen}<small class="med-zahl">${anz}/${alle}</small></div>
      <div class="med-reihe modi">${modi.map(m => modusMuenze(karte, m)).join('')}</div></div>`;
  }
  const CHIP_KLASSE = { 'Anfänger':'st-leicht', Mittel:'st-mittel', Profi:'st-profi', Eigene:'st-eigen' };
  // Zusammenfassung der Auswahl in der Start-Leiste
  function losInfoZeigen(E, held) {
    const k = E.karte === 'eigen' ? E.eigen : String(E.karte).startsWith('eigen:') ? eigeneKarten.find(x => 'eigen:' + x.id === E.karte) : PT.KARTEN[E.karte];
    const st = PT.STUFEN[E.stufe], m = PT.MODI[olymp ? 'standard' : E.modus];
    const teile = [k && '🗺️ ' + k.name, st && st.medaille + ' ' + st.name, m && m.symbol + ' ' + m.name, held && PT.HELDEN[held] ? '⭐ ' + PT.HELDEN[held].name : '🚫 Ohne Held'];
    $('#losInfo').innerHTML = teile.filter(Boolean).map(t => `<span>${esc(t)}</span>`).join('');
  }
  // Was im Menü ausgewählt ist: eigene Wahl oder (im Koop) die Einstellungen des Raums
  function einst() { return koopReiter && netz && netz.raum ? netz.raum.einst : wahl; }
  const darfEinstellen = () => !koopReiter || binHost();
  function waehle(k, v) {
    PT.Ton.klick();
    if (koopReiter) { if (binHost()) senden({ t:'einst', ...netz.raum.einst, [k]:v }); return; }
    wahl[k] = v; wahlMerken();
  }
  function menueBauen() {
    const E = einst(), aus = !darfEinstellen();
    koopMenueBauen();
    passBauen();
    const karten = $('#karten');
    karten.innerHTML = '';
    for (const id of PT.KARTEN_REIHE) {
      const k = PT.KARTEN[id];
      const b = document.createElement('button');
      b.className = 'kartenwahl';
      b.setAttribute('aria-pressed', E.karte === id);
      b.disabled = aus;
      b.innerHTML = `<canvas></canvas><div><b>${esc(k.name)}<span class="chip ${CHIP_KLASSE[k.stufe] || ''}">${esc(k.stufe)}</span></b><small>${esc(k.text)}</small>${medaillenText(id)}</div>`;
      kartenVorschau(b.querySelector('canvas'), id);
      b.onclick = () => waehle('karte', id);
      karten.appendChild(b);
    }
    // Koop-Gäste sehen die eigene Karte des Gastgebers
    if (koopReiter && E.karte === 'eigen' && E.eigen && !binHost()) {
      const b = document.createElement('button');
      b.className = 'kartenwahl'; b.setAttribute('aria-pressed', 'true'); b.disabled = true;
      b.innerHTML = `<canvas></canvas><div><b>${esc(E.eigen.name)}<span class="chip st-eigen">Eigene</span></b><small>Karte des Gastgebers.</small></div>`;
      kartenVorschau(b.querySelector('canvas'), E.eigen);
      karten.appendChild(b);
    }
    // eigene Karten aus dem Editor
    if (!olymp && (!koopReiter || binHost())) {
      for (const k of eigeneKarten) {
        const id = 'eigen:' + k.id;
        const b = document.createElement('button');
        b.className = 'kartenwahl';
        b.setAttribute('aria-pressed', koopReiter ? E.karte === 'eigen' && !!E.eigen && E.eigen.name === k.name : E.karte === id);
        b.innerHTML = `<canvas></canvas><div><b>${esc(k.name)}<span class="chip st-eigen">Eigene</span></b><small>${k.wege.length} ${k.wege.length === 1 ? 'Kanal' : 'Kanäle'} · selbst gebaut</small>
          <div class="karten-knoepfe"><span data-aktion="bearbeiten" role="button" tabindex="0">✏️ Bearbeiten</span><span data-aktion="teilen" role="button" tabindex="0">🔗 Teilen</span><span data-aktion="weg" role="button" tabindex="0">🗑️</span></div></div>`;
        kartenVorschau(b.querySelector('canvas'), k);
        b.onclick = e => {
          const aktion = e.target.closest('[data-aktion]');
          if (aktion) {
            e.stopPropagation();
            if (aktion.dataset.aktion === 'bearbeiten') editorOeffnen(k);
            if (aktion.dataset.aktion === 'teilen') karteTeilen(k);
            if (aktion.dataset.aktion === 'weg' && confirm(`Karte „${k.name}“ löschen?`)) { karteLoeschen(k.id); }
            return;
          }
          if (koopReiter) { PT.Ton.klick(); if (binHost()) senden({ t:'einst', ...netz.raum.einst, karte:'eigen', eigen:{ name:k.name, thema:k.thema, wege:k.wege, hindernisse:k.hindernisse, wasser:k.wasser, tunnel:k.tunnel } }); return; }
          waehle('karte', id);
        };
        karten.appendChild(b);
      }
      const neu = document.createElement('button');
      neu.className = 'kartenwahl neu';
      neu.innerHTML = '<div><span>✏️</span>Eigene Karte bauen</div>';
      neu.onclick = () => editorOeffnen(null);
      karten.appendChild(neu);
    }
    const stufen = $('#stufen');
    stufen.innerHTML = '';
    for (const [id, st] of Object.entries(PT.STUFEN)) {
      const b = document.createElement('button');
      b.className = 'stufe';
      b.setAttribute('aria-pressed', E.stufe === id);
      b.disabled = aus;
      const geschafft = !!medaillen[`${E.karte}|${id}|standard`];
      b.classList.toggle('geschafft', geschafft);
      b.innerHTML = `${geschafft ? '<span class="haken" title="Auf dieser Karte geschafft">✓</span>' : ''}<b>${st.medaille} ${esc(st.name)}</b><small>${st.runden} Runden · ${st.leben} ${st.leben === 1 ? 'Leben' : 'Leben'}${st.preis !== 1 ? ` · Preise ${st.preis < 1 ? '−' : '+'}${Math.round(Math.abs(1 - st.preis) * 100)} %` : ''}</small>`;
      b.onclick = () => waehle('stufe', id);
      stufen.appendChild(b);
    }
    const modi = $('#modi');
    modi.innerHTML = '';
    for (const id of PT.MODI_REIHE) {
      const m = PT.MODI[id];
      const b = document.createElement('button');
      b.className = 'modus';
      b.setAttribute('aria-pressed', E.modus === id);
      b.disabled = aus;
      const medaille = id !== 'standard' && id !== 'sandkasten' && PT.KARTEN[E.karte] ? modusMuenze(E.karte, id) : '';
      b.innerHTML = `${medaille}<b data-symbol="${m.symbol}">${esc(m.name)}</b><small>${esc(m.text)}</small>`;
      b.onclick = () => waehle('modus', id);
      modi.appendChild(b);
    }
    // Koop: geteiltes oder getrenntes Geld
    const geld = $('#geldModi');
    geld.innerHTML = '';
    for (const [id, g] of Object.entries(PT.KOOP_GELD)) {
      const b = document.createElement('button');
      b.className = 'stufe';
      b.setAttribute('aria-pressed', (E.geldModus || 'geteilt') === id);
      b.disabled = aus;
      b.innerHTML = `<b>${esc(g.name)}</b><small>${esc(g.text)}</small>`;
      b.onclick = () => waehle('geldModus', id);
      geld.appendChild(b);
    }
    // Koop-Raum: Koop oder Versus
    const arten = $('#spielArten');
    arten.innerHTML = '';
    for (const [id, name, text] of [['koop', '👥 Koop', 'Alle zusammen auf einer Karte, bis zu 4 Spieler.'], ['versus', '⚔️ Versus „Eiskrieg“', 'Zu zweit gegeneinander: Fische schicken, Sabotage, ab Runde 30 Bosse.']]) {
      const b = document.createElement('button');
      b.className = 'stufe';
      b.setAttribute('aria-pressed', (E.versus ? 'versus' : 'koop') === id);
      b.disabled = aus;
      b.innerHTML = `<b>${esc(name)}</b><small>${esc(text)}</small>`;
      b.onclick = () => waehle('versus', id === 'versus');
      arten.appendChild(b);
    }
    $('#geldWahl').hidden = !!E.versus;
    heldenBauen();
    const stand = speicher.lesen('pt-stand');
    const standKarte = stand && (stand.karte === 'eigen' ? PT.karteOk(stand.eigeneKarte) : PT.KARTEN[stand.karte]);
    $('#weiterReihe').hidden = koopReiter || !standKarte;
    if (standKarte) {
      $('#weiterText').textContent = `${stand.tag ? '📅 ' : ''}${stand.level && PT.LEVEL(stand.level) ? '📖 ' + PT.LEVEL(stand.level).name + ': ' : ''}${standKarte.name}, ${PT.STUFEN[stand.stufe] ? PT.STUFEN[stand.stufe].name : ''}${stand.modus && stand.modus !== 'standard' ? ', ' + PT.MODI[stand.modus].name : ''} – Runde ${stand.runde + 1}`;
    }
    const zahlMed = Object.keys(medaillen).filter(k => !k.endsWith('|sandkasten')).length;
    const zahlErf = Object.keys(fort.erfolge).length;
    $('#erfolge').textContent = zahlMed || zahlErf ? `🏅 ${zahlMed} ${zahlMed === 1 ? 'Medaille' : 'Medaillen'} · 🏆 ${zahlErf} von ${PT.ERFOLGE.length} Erfolgen` : '';
    extrasBauen();
  }
  // Tages-Herausforderung, Pinguin-Wissen und Erfolge im Menü
  function extrasBauen() {
    const h = PT.tagesHerausforderung(PT.heute());
    const geschafft = !!fort.tage[h.datum];
    $('#tagBox').hidden = !!olymp || koopReiter;
    $('#tagBox').classList.toggle('geschafft', geschafft);
    $('#tagDatum').textContent = new Date().toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' });
    $('#tagTitel').textContent = h.titel;
    $('#tagText').textContent = h.text;
    $('#tagLohn').textContent = geschafft ? '✅ Heute schon geschafft! Morgen gibt es eine neue.' : `Belohnung: ${h.xp} Erfahrung und ${h.muenzen} 🪙 · ${fort.lebenslang.tage} geschafft`;
    $('#tagLos').textContent = geschafft ? 'Nochmal spielen (ohne Belohnung)' : 'Herausforderung starten';
    $('#wissenBox').hidden = !!olymp;
    $('#wissenAn').checked = fort.wissenAn !== false;
    const gesamt = PT.WISSEN_REIHE.reduce((n, id) => n + (fort.wissen[id] || 0), 0);
    $('#wissenKurz').textContent = `🪙 ${zahl(fort.muenzen)} · ${gesamt} gelernt`;
    $('#wissen').innerHTML = PT.WISSEN_REIHE.map(id => {
      const w = PT.WISSEN[id], n = fort.wissen[id] || 0, voll = n >= w.max, preis = voll ? 0 : w.kosten[n];
      return `<div class="wissen-item"><b>${w.symbol} ${esc(w.name)}</b><small>${n ? esc(w.text(n)) : 'Noch nicht gelernt.'}${voll ? '' : ` Nächste Stufe: ${esc(w.text(n + 1))}.`}</small>
        <div class="pips">${Array.from({ length:w.max }, (_, i) => `<i class="${i < n ? 'an' : ''}"></i>`).join('')}</div>
        <button data-wissen="${id}" ${voll || preis > fort.muenzen ? 'disabled' : ''}>${voll ? 'Voll' : `${preis} 🪙`}</button></div>`;
    }).join('');
    for (const b of document.querySelectorAll('[data-wissen]')) b.onclick = () => {
      const id = b.dataset.wissen, w = PT.WISSEN[id], n = fort.wissen[id] || 0;
      if (n >= w.max || w.kosten[n] > fort.muenzen) return;
      fort.muenzen -= w.kosten[n]; fort.wissen[id] = n + 1; fortMerken();
      PT.Ton.upgrade();
      passBauen(); extrasBauen();
    };
    $('#erfolgeKurz').textContent = `${Object.keys(fort.erfolge).length} / ${PT.ERFOLGE.length}`;
    $('#erfolgeListe').innerHTML = PT.ERFOLGE.map(e => `<div class="erfolg ${fort.erfolge[e.id] ? 'da' : ''}"><i>${e.symbol}</i><span><b>${esc(e.name)}</b><small>${esc(e.text)} · ${e.muenzen} 🪙</small></span></div>`).join('');
    kistenBauen(); haendlerBauen(); wochenBauen();
  }

  /* ---------- Kisten ---------- */
  function kistenBauen() {
    const n = PT.KISTEN_REIHE.reduce((s, k) => s + (fort.kisten[k] || 0), 0);
    $('#kistenKurz').textContent = n ? `${n} ungeöffnet` : 'keine';
    $('#kisten').innerHTML = PT.KISTEN_REIHE.map(k => {
      const K = PT.KISTEN[k], anz = fort.kisten[k] || 0;
      return `<button class="kiste k-${k}" data-kiste="${k}" ${anz ? '' : 'disabled'}><i>${K.symbol}</i><b>${esc(K.name)}</b><small>${anz ? `${anz}× · Öffnen!` : 'keine'}</small></button>`;
    }).join('');
    for (const b of document.querySelectorAll('[data-kiste]')) b.onclick = () => kisteOeffnen(b.dataset.kiste);
  }
  function inhaltText(i) {
    if (i.muenzen) return { sym:'🪙', text:`${i.muenzen} Fischmünzen` };
    if (i.xp) return { sym:'🎖️', text:`${i.xp} Erfahrung` };
    if (i.skin) return { sym:'👗', text:`Look: ${PT.SKINS[i.skin].name}`, bild:lookBilder[i.skin] };
    if (i.sockel) return { sym:'🧊', text:`Sockel: ${PT.SOCKEL[i.sockel].name}`, bild:sockelBilder[i.sockel] };
    if (i.kiste) return { sym:PT.KISTEN[i.kiste].symbol, text:PT.KISTEN[i.kiste].name };
    if (i.booster) return { sym:'⚡', text:`Doppel-Erfahrung für ${i.booster} Spiele` };
    if (i.kristalle) return { sym:'❄️', text:`${i.kristalle} Eiskristalle fürs Dorf` };
    return { sym:'❔', text:'' };
  }
  function kisteOeffnen(art) {
    if (!(fort.kisten[art] > 0)) return;
    fort.kisten[art]--;
    fort.lebenslang.kisten = (fort.lebenslang.kisten || 0) + 1;
    const inhalt = PT.kisteOeffnen(art, fort.besitz);
    for (const i of inhalt) {
      if (i.muenzen) fort.muenzen += i.muenzen;
      if (i.xp) { pass.xp += i.xp; saisonXp(i.xp); speicher.schreiben('pt-pass', pass); }
      if (i.skin) fort.besitz.skins[i.skin] = true;
      if (i.sockel) fort.besitz.sockel[i.sockel] = true;
    }
    // Eiskristalle fürs Pingu-Dorf
    const kristalle = Math.round({ holz:2, silber:5, gold:12 }[art] * PT.kristallFaktor(fort.dorf));
    fort.dorf.kristalle += kristalle;
    inhalt.push({ kristalle });
    fortMerken();
    wochenDazu('kisten', 1);
    const K = PT.KISTEN[art];
    $('#kisteTitel').textContent = `${K.symbol} ${K.name}`;
    $('#kisteInhalt').innerHTML = inhalt.map((i, n) => { const t = inhaltText(i); return `<li style="--n:${n}" class="${i.skin || i.sockel ? 'selten' : ''}">${t.bild ? `<img src="${t.bild}" alt="">` : `<i>${t.sym}</i>`}<span>${esc(t.text)}</span></li>`; }).join('');
    $('#kisteDialog').hidden = false;
    $('#kisteZu').focus();
    PT.Ton.aufstiegKlang ? PT.Ton.aufstiegKlang() : PT.Ton.upgrade();
    erfolgeOhneSpiel();
    menueBauen();
  }

  /* ---------- Händler ---------- */
  function haendlerBauen() {
    const d = PT.heute();
    if (!fort.haendler || fort.haendler.datum !== d) fort.haendler = { datum:d, gekauft:{} };
    const angebote = PT.haendlerAngebote(d);
    $('#haendler').innerHTML = angebote.map(a => {
      const t = inhaltText(a);
      const schon = a.skin ? fort.besitz.skins[a.skin] : a.sockel ? fort.besitz.sockel[a.sockel] : false;
      const weg = fort.haendler.gekauft[a.id] || schon;
      return `<div class="angebot ${a.skin || a.sockel ? 'selten' : ''}">${t.bild ? `<img src="${t.bild}" alt="">` : `<i>${t.sym}</i>`}<span>${esc(t.text)}</span>
        <button data-kaufen="${a.id}" ${weg || a.preis > fort.muenzen ? 'disabled' : ''}>${weg ? (schon ? 'Hast du' : 'Gekauft') : `${a.preis} 🪙`}</button></div>`;
    }).join('');
    for (const b of document.querySelectorAll('[data-kaufen]')) b.onclick = () => {
      const a = angebote.find(x => x.id === b.dataset.kaufen);
      if (!a || fort.haendler.gekauft[a.id] || a.preis > fort.muenzen) return;
      fort.muenzen -= a.preis; fort.haendler.gekauft[a.id] = true;
      if (a.skin) fort.besitz.skins[a.skin] = true;
      if (a.sockel) fort.besitz.sockel[a.sockel] = true;
      if (a.kiste) fort.kisten[a.kiste] = (fort.kisten[a.kiste] || 0) + 1;
      if (a.booster) fort.booster += a.booster;
      fortMerken(); PT.Ton.upgrade();
      menueBauen();
    };
  }

  /* ---------- Wochen-Quests ---------- */
  function wochenBauen() {
    const liste = wochenHeute(), W = fort.wochen;
    const fertig = liste.filter(q => W.fertig[q.id]).length;
    $('#wochenKurz').textContent = `${fertig} / ${liste.length}`;
    $('#wochen').innerHTML = liste.map(q => {
      const st = W.stand[q.id] || 0, ok = !!W.fertig[q.id];
      return `<li class="${ok ? 'fertig' : ''}">${ok ? '✅' : '🗓️'} ${esc(q.text)}<small>${ok ? 'Geschafft!' : `${zahl(st)} / ${zahl(q.ziel)}`} · +${zahl(q.xp)} Erfahrung · ${PT.KISTEN[q.kiste].symbol} ${esc(PT.KISTEN[q.kiste].name)}</small><div class="mini"><i style="width:${Math.round(st / q.ziel * 100)}%"></i></div></li>`;
    }).join('');
  }

  /* ---------- Abenteuer „Schwarzes Eis“ ---------- */
  let abenteuerReiter = false, abenteuerTeil = null;
  const kapAnz = k => (k.anzeige != null ? k.anzeige : k.nr);
  const kapitelTitel = k => (kapAnz(k) === 0 ? k.name : `Kapitel ${kapAnz(k)}: ${k.name}`);
  const levelNummer = l => { const a = kapAnz(PT.KAPITEL_VON(l.kapitel)); return a === 0 ? 'Prolog' : `${a}-${l.nr}`; };
  const heldFrei = id => !PT.heldFrei || PT.heldFrei(id, fort.kampagne);
  function abenteuerBauen() {
    const el = $('#abenteuer');
    const sterne = fort.kampagne;
    // Teil-Reiter: standardmäßig der neueste freie Teil
    const freiBis = PT.TEILE.filter(t => PT.teilFrei(t.nr, sterne)).length;
    if (!abenteuerTeil || !PT.teilFrei(abenteuerTeil, sterne)) abenteuerTeil = freiBis;
    const teil = PT.TEILE[abenteuerTeil - 1];
    const levelsTeil = t => PT.LEVELS.filter(l => t.kapitel.includes(l.kapitel));
    $('#teilReiter').innerHTML = PT.TEILE.map(t => {
      const frei = PT.teilFrei(t.nr, sterne), ls = levelsTeil(t), n = ls.reduce((a, l) => a + PT.sternZahl(sterne[l.id]), 0);
      return `<button class="teil${t.nr}" data-teil="${t.nr}" aria-pressed="${t.nr === abenteuerTeil}" ${frei ? '' : 'disabled'}>${frei ? t.symbol : '🔒'} Teil ${t.nr}: ${esc(t.name)}
        <small>${frei ? `⭐ ${n} / ${ls.length * 3}` : `Schaff erst Teil ${t.nr - 1}`}</small></button>`;
    }).join('');
    for (const b of $('#teilReiter').querySelectorAll('[data-teil]')) b.onclick = () => { PT.Ton.klick(); abenteuerTeil = +b.dataset.teil; abenteuerBauen(); };
    const lsTeil = levelsTeil(teil);
    const gesamt = lsTeil.reduce((n, l) => n + PT.sternZahl(sterne[l.id]), 0);
    $('#abenteuerTitel').textContent = `${teil.nr === 1 ? '📖' : '✨'} ${teil.name}`;
    $('#abenteuerSterne').textContent = `⭐ ${gesamt} / ${lsTeil.length * 3}`;
    $('#abenteuerText1').hidden = teil.nr !== 1;
    $('#abenteuerText2').hidden = teil.nr !== 2;
    const seiten = Object.keys(PT.TAGEBUCH).filter(id => fort.tagebuch[id]).length;
    $('#tagebuchKnopf').hidden = teil.nr !== 2;
    $('#tagebuchKnopf').textContent = `📜 Opas Tagebuch (${seiten} / ${Object.keys(PT.TAGEBUCH).length} Seiten)`;
    const alt = fort.kampagneAlt;
    $('#abenteuerAlt').hidden = !alt || teil.nr !== 1;
    if (alt) $('#abenteuerAlt').textContent = `✨ Das Abenteuer wurde komplett neu geschrieben. Für deine ${alt.sterne} Sterne aus dem alten Abenteuer hast du eine Goldkiste und ${10 + alt.sterne} Eiskristalle bekommen. Deine Looks bleiben dir.`;
    el.innerHTML = PT.KAPITEL.filter(k => teil.kapitel.includes(k.nr)).map(k => {
      const levels = PT.LEVELS.filter(l => l.kapitel === k.nr);
      const offen = PT.levelFrei(levels[0].id, sterne);
      const fertig = PT.kapitelFertig(k.nr, sterne);
      return `<section class="kapitel ${offen ? '' : 'zu'}"><h3>${k.symbol} ${esc(kapitelTitel(k))}${fertig ? ' <span class="chip">✓ geschafft</span>' : ''}</h3>
        ${offen && k.zitat ? `<p class="kapitel-zitat">${esc(k.zitat[0])}${k.zitat[1] && kapAnz(k) ? ` – ${esc(k.zitat[1])}` : ''}</p>` : ''}
        <div class="level-pfad">${levels.map(l => {
          const n = PT.sternZahl(sterne[l.id]), frei = PT.levelFrei(l.id, sterne);
          return `<button class="level ${n ? 'gespielt' : ''} ${l.boss ? 'bosslevel' : ''} ${fort.albtraum[l.id] ? 'albtraum-ok' : ''}" data-level="${l.id}" ${frei ? '' : 'disabled'}>
            <i>${frei ? (l.boss ? PT.BOSSE[l.boss].symbol : l.finale ? teil.finaleSymbol : l.nr) : '🔒'}</i><b>${esc(l.name)}</b><span class="sterne">${[0, 1, 2].map(i => (sterne[l.id] || [])[i] ? '⭐' : '☆').join('')}</span></button>`;
        }).join('')}</div>
        ${k.look ? `<p class="kapitel-lohn">Belohnung fürs ganze Kapitel: Look „${esc(PT.SKINS[k.look].name)}“ ${fort.besitz.skins[k.look] ? '✓' : ''}</p>` : ''}</section>`;
    }).join('');
    for (const b of el.querySelectorAll('[data-level]')) b.onclick = () => levelOeffnen(b.dataset.level);
  }
  function levelOeffnen(id) {
    const l = PT.LEVEL(id); if (!l) return;
    PT.Ton.klick();
    const k = PT.KAPITEL_VON(l.kapitel), st = fort.kampagne[id] || [];
    const gespielt = PT.sternZahl(st) > 0;
    const teil = PT.teilVon(l);
    $('#levelTitel').textContent = `${k.symbol} ${teil.nr > 1 ? `Teil ${teil.nr} · ` : ''}${levelNummer(l)}: ${l.name}`;
    // Neue Spieler sehen den Anfang der Szene als Vorgeschmack
    const erste = (l.vorher || []).find(z => z[0] !== 'erzaehler') || (l.vorher || [])[0];
    $('#levelStory').textContent = erste ? `${PT.SPRECHER[erste[0]].name ? PT.SPRECHER[erste[0]].name + ': ' : ''}${erste[1]}` : '';
    $('#levelStory').hidden = !erste;
    $('#levelText').textContent = l.text;
    const r = l.regeln, infos = [`🗺️ ${PT.KARTEN[l.karte].name}`, `${PT.STUFEN[l.stufe].medaille} ${PT.STUFEN[l.stufe].name}`,
      r.startRunde ? `🌊 Runde ${r.startRunde}–${r.runden}` : `🌊 ${r.runden} Runden`];
    if (r.geld) infos.push(`💰 ${zahl(r.geld)} Startgeld`);
    if (r.leben) infos.push(`❤️ nur ${r.leben} Leben`);
    if (r.flut) infos.push('⏩ keine Pausen');
    if (r.wetter) infos.push(`${PT.WETTER[r.wetter].symbol} ${PT.WETTER[r.wetter].name}`);
    if (r.finsternis) infos.push('🌑 Finsternis');
    if (r.wegeAb) infos.push('⚠️ Überfall von der Seite');
    if (r.zerstoeren) infos.push('💥 Sabotage');
    if (r.einsturz) infos.push('🧊 Das Eis bricht');
    if (r.erlaubt) infos.push('🐧 nur bestimmte Pinguine');
    if (r.licht) infos.push('🔆 Lichtstrahlen');
    if (PT.KARTEN[l.karte].stroemung) infos.push('🌀 Strömung');
    if (r.spiegel) infos.push('🪞 Spiegel');
    if (r.verbuendete) infos.push('🦈 Verbündete');
    if (r.wegRotation) infos.push('🫀 Adern ruhen abwechselnd');
    if (r.heldFaellt) infos.push('🕯️ Abschied');
    if (PT.TAGEBUCH[l.id]) infos.push(fort.tagebuch[l.id] ? '📜 Seite gefunden' : '📜 Eine Seite treibt vorbei');
    if (l.neu && PT.PINGUINE[l.neu]) infos.push(`✨ Neu: ${PT.PINGUINE[l.neu].name}`);
    if (l.neuFisch) infos.push(`🐟 Neu: ${PT.FISCHE[l.neuFisch].name}`);
    $('#levelInfos').innerHTML = infos.map(t => `<span>${esc(t)}</span>`).join('');
    $('#levelSterne').innerHTML = [['sieg'], ...l.sterne].map((a, i) => `<li class="${st[i] ? 'da' : ''}">${st[i] ? '⭐' : '☆'} ${esc(i ? PT.sternAufgabe(a) : 'Gewinne das Level')}</li>`).join('');
    const held = l.held || (wahl.held && PT.HELDEN[wahl.held] && !r.ohneHeld ? wahl.held : null);
    $('#levelHeld').textContent = l.held ? `In diesem Level ist ${PT.HELDEN[l.held].name} dein Held.` : held ? `Dein Held: ${PT.HELDEN[held].name} (unten im Menü änderbar)` : 'Ohne Held';
    $('#levelLos').textContent = gespielt ? "Los geht's!" : '▶ Szene und Level starten';
    $('#levelAlbtraumBox').hidden = !gespielt;
    $('#levelAlbtraum').checked = false;
    $('#levelAlbtraumText').textContent = `Ein Viertel weniger Geld, halb so viele Leben, schnellere Fische, anderthalbmal so starke Bosse.${fort.albtraum[id] ? ' ✓ Schon überlebt.' : ' Belohnung: 12 Eiskristalle und 150 Erfahrung.'}`;
    $('#levelLos').onclick = () => { $('#levelDialog').hidden = true; levelStarten(id, !gespielt, gespielt && $('#levelAlbtraum').checked); };
    $('#levelSzene').hidden = !gespielt;
    $('#levelSzene').onclick = () => {
      $('#levelDialog').hidden = true;
      szeneSpielen([...(l.vorher || []), ...(l.nachher || []), ...(l.finale ? teil.ende : [])], { karte:kapitelKarte(l), stimmung:k.stimmung }).then(() => levelOeffnen(id));
    };
    $('#levelDialog').hidden = false;
    $('#levelLos').focus();
  }
  const kapitelKarte = l => {
    const k = PT.KAPITEL_VON(l.kapitel), t = PT.teilVon(l), a = kapAnz(k);
    return l.nr === 1 ? { kapitel:`${t.nr > 1 ? `Teil ${t.nr} · ` : ''}${a ? `Kapitel ${a}` : 'Prolog'}`, titel:a ? k.name : k.name.replace(/^Prolog: /, ''), zitat:k.zitat } : null;
  };
  let tagebuchSeite = null;       // treibende Tagebuch-Seite im laufenden Level { id, x, y, bis }
  function levelStarten(id, mitSzene, albtraum) {
    const l = PT.LEVEL(id); if (!l) return;
    PT.Ton.start();
    speicher.weg('pt-stand');
    tagesAktiv = null; kampagneAktiv = id;
    const held = l.held || wahl.held;
    spielStarten(new PT.Spiel({ karte:l.karte, stufe:l.stufe, modus:'standard', held, kraft:kraftAktiv(held), regeln:albtraum ? { ...l.regeln, albtraum:true } : l.regeln, boni:boniAktiv(), seed:Date.now() & 0xffffff }));
    const k = PT.KAPITEL_VON(l.kapitel);
    if (albtraum) setTimeout(() => banner('😱 Albtraum', 'Weniger Geld, halbe Leben, schnellere Fische, stärkere Bosse. Viel Glück.', 3), mitSzene ? 0 : 400);
    PT.Ton.musik(k.stimmung);
    if (mitSzene && (l.vorher || []).length) szeneSpielen(l.vorher, { karte:kapitelKarte(l), imSpiel:true, stimmung:k.stimmung })
      .then(() => { if (spiel && kampagneAktiv === id) { banner(`📖 ${l.name}`, l.text.length < 70 ? l.text : `${spiel.kartenDaten.name} · bis Runde ${spiel.zielRunden}`, 3.5); tipp('Setz deine Pinguine neben den Kanal und starte die Runde.'); tippZeit = 5; } });
  }
  // Sieg im Abenteuer: Sterne, Kristalle, Gerettete fürs Dorf, Kapitel-Look, neue Dorf-Phase
  function levelGewonnen() {
    const l = PT.LEVEL(kampagneAktiv); if (!l) return null;
    const phaseVorher = PT.dorfPhase(fort.kampagne);
    const neu = PT.levelSterne(l, spiel), alt = fort.kampagne[l.id] || [];
    const zusammen = [0, 1, 2].map(i => !!(alt[i] || neu[i]));
    const dazu = zusammen.filter(Boolean).length - PT.sternZahl(alt);
    const erstesMal = !PT.sternZahl(alt);
    fort.kampagne[l.id] = zusammen;
    fortMerken();
    if (dazu > 0) { xpDazu(dazu * PT.STERN_XP); muenzenDazu(dazu * PT.STERN_MUENZEN); wochenDazu('sterne', dazu); kristalleDazu(dazu * PT.STERN_KRISTALLE); }
    if (erstesMal && l.gerettet) { fort.dorf.bewohner += l.gerettet; fortMerken(); }
    if (PT.sternZahl(zusammen) === 3 && PT.sternZahl(alt) < 3) kisteDazu(PT.KAPITEL_VON(l.kapitel).kiste, 'Alle drei Sterne!');
    const k = PT.KAPITEL_VON(l.kapitel);
    if (k.look && PT.kapitelFertig(k.nr, fort.kampagne) && !fort.besitz.skins[k.look]) {
      fort.besitz.skins[k.look] = true; fortMerken();
      banner(`📖 ${kapitelTitel(k)} geschafft!`, `Neuer Look: ${PT.SKINS[k.look].name}`, 3.5);
    }
    if (l.id === 's1-3' && !fort.besitz.skins.kueken) { fort.besitz.skins.kueken = true; fortMerken(); }
    if (l.finale) {
      for (const s of PT.teilVon(l).looks) fort.besitz.skins[s] = true;
      fortMerken();
      const naechster = PT.TEILE[PT.teilVon(l).nr];
      if (naechster && erstesMal) setTimeout(() => banner(`${naechster.symbol} Teil ${naechster.nr} ist frei!`, `„${naechster.name}“ wartet im Abenteuer.`, 4), 4000);
    }
    if (spiel.albtraum && !fort.albtraum[l.id]) {
      fort.albtraum[l.id] = true; fortMerken();
      kristalleDazu(12); xpDazu(150);
      setTimeout(() => banner('😱 Albtraum überlebt!', '+12 💎 Eiskristalle · +150 Erfahrung', 3), 2500);
    }
    for (const [held, kap] of Object.entries(PT.HELD_KAPITEL || {})) {
      if (PT.kapitelFertig(kap, fort.kampagne) && !fort.besitz.kraefte[held]) {
        fort.besitz.kraefte[held] = true; fortMerken();
        setTimeout(() => banner(`🎖️ Neuer Held: ${PT.HELDEN[held].name}`, 'Mit Meisterkraft – such ihn dir unten im Menü aus.', 4), 3000);
      }
    }
    // Das Dorf entsteht (nach Kapitel 2) und wächst mit jedem weiteren Kapitel
    const phase = PT.dorfPhase(fort.kampagne);
    if (phase > phaseVorher) {
      if (!fort.dorf.geschenk) { fort.dorf.geschenk = true; fort.dorf.kristalle += 20; }
      fortMerken();
      setTimeout(() => banner(`🏘️ ${PT.DORF_PHASEN[phase].name}!`, 'Dein Pingu-Dorf wächst – schau im Menü unter „Dorf“ vorbei.', 3.5), 1500);
    }
    return { neu, zusammen, dazu };
  }
  function tagesStarten() {
    const h = PT.tagesHerausforderung(PT.heute());
    speicher.weg('pt-stand');
    tagesAktiv = h.datum; kampagneAktiv = null;
    spielStarten(new PT.Spiel({ karte:h.karte, stufe:h.stufe, modus:h.modus, held:h.held, kraft:kraftAktiv(h.held), regeln:h.regeln, seed:Date.now() & 0xffffff }));
  }
  function heldenBauen() {
    const E = einst();
    const ohne = !!(PT.MODI[olymp ? 'standard' : E.modus].ohneHeld);
    const m = koopReiter ? meinMitglied() : null;
    const meiner = m ? m.held : wahl.held;
    const st = passStufe();
    const h = $('#helden');
    h.innerHTML = '';
    for (const id of [...PT.HELDEN_REIHE, null]) {
      const d = id && PT.HELDEN[id];
      const b = document.createElement('button');
      b.className = 'heldwahl';
      b.setAttribute('aria-pressed', !ohne && meiner === id);
      const gesperrt = !!id && !heldFrei(id);
      b.disabled = (ohne && !!id) || gesperrt;
      if (gesperrt) b.title = `Noch gesperrt: ${d.freischalten}`;
      const kraft = d && PT.kraftFrei(id, st, fort.besitz) && !olymp ? ' <span class="chip kraft" title="Meisterkraft freigeschaltet">✨</span>' : '';
      b.innerHTML = d ? `<img src="${bilder[id] || ''}" alt=""><span><b>${esc(d.name)}${kraft}</b><small>${gesperrt ? `🔒 ${esc(d.freischalten)}` : `${esc(d.kurz)} · ${PT.preis(d.preis, E.stufe)} 💰`}</small></span>`
        : '<span style="font-size:2.4rem;width:72px;text-align:center">🚫</span><span><b>Ohne Held</b><small>Nur Pinguine.</small></span>';
      b.onclick = () => {
        PT.Ton.klick();
        wahl.held = id; speicher.schreiben('pt-wahl', wahl);
        if (koopReiter && netz && netz.raum) senden({ t:'wahl', boni:dorfBoni(), held:id, kraft:kraftAktivKoop(id), ...passZeigen() });
        menueBauen();
      };
      h.appendChild(b);
    }
    // Meisterkraft ein- und ausschalten
    const frei = !!meiner && PT.kraftFrei(meiner, st, fort.besitz) && !olymp && !ohne;
    $('#kraftReihe').hidden = !frei;
    $('#kraftAn').checked = wahl.kraft !== false;
    if (frei) $('#kraftText').textContent = PT.HELDEN[meiner].kraft.text;
    losInfoZeigen(E, ohne ? null : meiner);
  }

  /* ---------- Koop im Menü ---------- */
  function koopMenueBauen() {
    $('#reiterAllein').setAttribute('aria-pressed', !koopReiter && !abenteuerReiter && !dorfReiter);
    $('#reiterKoop').setAttribute('aria-pressed', koopReiter);
    $('#reiterAbenteuer').setAttribute('aria-pressed', abenteuerReiter);
    $('#reiterDorf').setAttribute('aria-pressed', dorfReiter);
    $('#dorfBox').hidden = !dorfReiter;
    if (dorfReiter) dorfBauen(); else if (dorfWelt) dorfWelt.stopp();
    const raum = koopReiter && netz && netz.raum;
    $('#koopBox').hidden = !koopReiter;
    $('#koopVerbinden').hidden = !!raum;
    $('#koopRaum').hidden = !raum;
    $('#abenteuerBox').hidden = !abenteuerReiter;
    if (abenteuerReiter) abenteuerBauen();
    $('#normalMenue').hidden = (koopReiter && !raum) || abenteuerReiter || dorfReiter;
    $('#geldBereich').hidden = !raum;
    $('#heldBereich').hidden = (koopReiter && !raum) || dorfReiter;
    $('#losReihe').hidden = (koopReiter && !raum) || abenteuerReiter || dorfReiter;
    $('#wetterAn').checked = (raum ? raum.einst.wetter : wahl.wetter) !== false;
    $('#wetterAn').disabled = !!raum && !binHost();
    if (!olymp) {
      $('#los').disabled = !!raum && !binHost();
      $('#los').textContent = raum ? (binHost() ? 'Spiel starten' : 'Der Gastgeber startet das Spiel …') : "Los geht's!";
    }
    if (!raum) return;
    $('#raumCode').textContent = raum.code;
    $('#mitglieder').innerHTML = raum.mitglieder.map((m, i) => {
      const held = m.held && PT.HELDEN[m.held] ? PT.HELDEN[m.held].name : 'ohne Held';
      return `<li style="--f:${PT.KOOP_FARBEN[i] || '#999'}" class="${m.online ? '' : 'weg'}"><i></i><b>${'⭐'.repeat(m.prestige || 0)}${esc(m.name)}</b>${m.titel && PT.TITEL[m.titel] ? `<span class="titel">${esc(PT.TITEL[m.titel])}</span>` : ''}${m.id === raum.host ? ' 👑' : ''}${m.id === netz.id ? ' (du)' : ''}<small>${esc(held)}${m.kraft ? ' ✨' : ''}${m.skin && m.skin !== 'standard' && PT.SKINS[m.skin] ? ' · ' + esc(PT.SKINS[m.skin].name) : ''}${m.online ? '' : ' · offline'}</small></li>`;
    }).join('');
    $('#koopHinweis').textContent = raum.phase === 'spiel' ? 'In diesem Raum läuft gerade eine Partie.' : raum.einst.versus
      ? (binHost() ? `⚔️ Versus: genau 2 Spieler. Wähl Karte und Schwierigkeit, dann starte. Dein Gegner tritt mit dem Code ${raum.code} bei.` : '⚔️ Versus! Such dir deinen Helden aus. Karte und Schwierigkeit wählt der Gastgeber.')
      : binHost()
      ? `Du bist Gastgeber: Wähl Karte, Schwierigkeit, Modus und Geld, dann starte. Freunde treten mit dem Code ${raum.code} bei.`
      : 'Such dir deinen Helden aus. Karte und Modus wählt der Gastgeber.';
  }
  function koopReiterSetzen(an) {
    koopReiter = an;
    if (an) { abenteuerReiter = false; dorfReiter = false; }
    if (an) {
      if (!$('#koopName').value) $('#koopName').value = speicher.lesen('pt-name') || '';
      netzVerbinden();
    }
    menueBauen();
  }
  function koopHallo() {
    const n = koopName();
    if (!n) { koopFehler('Gib zuerst deinen Namen ein.'); $('#koopName').focus(); return false; }
    speicher.schreiben('pt-name', n);
    senden({ t:'hallo', name:n, ...passZeigen() });
    return true;
  }
  function wahlMerken() { speicher.schreiben('pt-wahl', wahl); menueBauen(); }
  function lexikonBauen() {
    const beschr = {
      rot:'Der Kleinste.', blau:'Wird zum Rotbarsch.', gruen:'Wird zum Blaubarsch.', gelb:'Sehr flink.', rosa:'Der Schnellste.',
      schwarz:'Explosionen machen ihm nichts.', weiss:'Kälte macht ihm nichts.', panzer:'Spitzes prallt ab – braucht Explosionen, Magie oder schwere Waffen.',
      zebra:'Weder Explosionen noch Kälte.', regen:'Zerfällt in zwei Zebrafische.', koffer:'Harte Schale: 10 Treffer.',
      wal:'Riesig: 200 Treffer, dann 4 Kofferfische.', mega:'700 Treffer, dann 4 Walhaie.',
      rochen:'Getarnt, taucht aber alle paar Sekunden kurz auf – dann trifft ihn jeder. Nachtsicht und Leuchtfeuer sehen ihn immer. Keine Explosionen. 320 Treffer, dann 6 Kofferfische.',
      krake:'4000 Treffer, dann 4 Megalodons.', krakus:'Der Boss der Boss-Jagd. Ruft Verstärkung. Darf nie durchkommen!'
    };
    beschr.orka = 'Der Boss des Orka-Angriffs. Seine Flutwellen betäuben Pinguine am Ufer. Darf nie durchkommen!';
    Object.assign(beschr, {
      flug:'Springt immer wieder aus dem Wasser – in der Luft treffen ihn nur Flieger.', tinte:'Verspritzt beim Platzen Tinte: Pinguine in der Nähe sehen kurz nichts.',
      kugel:'Bläht sich nach einem Treffer auf – dann prallt kurz alles ab. Dann 2 Regenbogenforellen.',
      leviathan:'Der Boss von „Leviathan-Erwachen“. Sein Eisatem friert Pinguine am Ufer ein.', haikoenig:'Der Boss von „Hai-König“. Ruft ständig neue Fische herbei.',
      abyssos:'Der Tiefseekönig, Boss von „Tiefsee-Finsternis“. Löscht immer wieder das Licht – dann sehen nur Pinguine mit Nachtsicht die Fische.',
      schatten:'Aus der sterbenden Tiefsee: getarnt, taucht aber alle paar Sekunden kurz auf. Dann 1 Anglerfisch.',
      splitter:'Flinker Splitter eines Verderbten. Wird zum Lachs.', verderbt:'Von der Dunkelheit zerfressen: Kälte macht ihm nichts. Zerfällt in 3 Splitterlinge.',
      kapitaen:'Kapitän Frost (Abenteuer): friert eure wertvollsten Pinguine ein und hüllt Fische in Eispanzer, an denen alles abprallt.',
      zerbrochen:'Pako, der Zerbrochene: die zweite Gestalt von Abyssos im Abenteuer. Ruft Schattenfische und löscht das Licht.',
      funke:'Ein winziger Lichtsplitter. Rasend schnell, kommt in Schwärmen. Wird zum Goldfisch.',
      licht:'Ein Kind des Uralten, wunderschön und hungrig. Zerfällt in 2 Lichtfunken.',
      spiegelfisch:'Schuppen wie Spiegel: Fast jedes dritte Geschoss prallt zurück. Strahlen, Blitze und Explosionen helfen. Dann 1 Regenbogenforelle.',
      kristallkrebs:'Langsam und hart, Spitzes prallt ab. Alle paar Sekunden schützt er alle Fische in der Nähe kurz mit Kristall. Dann 1 Kofferfisch.',
      kristallmutter:'Mutter der Kristalle (Abenteuer Teil 2): ruft Lichtgeborene und hüllt alle Fische um sich immer wieder in Kristall.',
      lichttraeger:'Der Lichtträger (Abenteuer Teil 2): Er blendet alle Pinguine in seiner Nähe – geblendet greift niemand an.',
      uralter:'Der Uralte (Abenteuer Teil 2): der Hunger, der alles Licht frisst. Blendet, ruft seine Kinder – und wenn er fällt, schlägt sein Herz weiter.',
      uralterkern:'Das Herz des Uralten: die zweite Gestalt. Löscht das Licht und schützt seine Kinder mit Kristall.'
    });
    $('#lexikon').innerHTML = [...PT.FISCH_REIHE, ...PT.BOSS_REIHE].map(id => {
      const f = PT.FISCHE[id];
      return `<div><img src="${fischBilder[id] || ''}" alt=""><span><b>${esc(f.name)}</b><br><small>${esc(beschr[id])}</small></span></div>`;
    }).join('');
  }

  /* ---------- Szenen: Titelkarte, Dialoge mit Porträt, Abspann ----------
     szeneSpielen(zeilen, { karte, imSpiel, stimmung, auge }) zeigt eine Szene und löst das Versprechen danach ein.
     Klick, Leertaste oder Enter: weiter (erst den Text fertig schreiben), Esc oder „Überspringen“: alles überspringen. */
  let szeneAktiv = null, portraets = null;
  function portrait(id) {
    const sp = PT.SPRECHER[id];
    if (!sp || !sp.bild) return '';
    const b = sp.bild;
    if (b.fisch) return fischBilder[b.fisch] || '';
    if (!portraets) {
      try { portraets = PT.Welt.portraets(Object.entries(PT.SPRECHER).filter(([, x]) => x.bild && !x.bild.fisch).map(([k, x]) => ({ id:k, ...x.bild }))); }
      catch (e) { portraets = {}; }
    }
    return portraets[id] || (b.held ? bilder[b.held] : lookBilder[b.look]) || '';
  }
  function szeneSpielen(zeilen, opt = {}) {
    return new Promise(fertig => {
      const el = $('#szene'), box = $('#szeneBox'), karte = $('#szeneKarte');
      const imSpiel = !!opt.imSpiel && !!welt && !$('#spiel').hidden;
      const warPausiert = pausiert;
      if (imSpiel) { pausiert = true; welt.kinoSetzen(true); $('#banner').classList.remove('an'); bannerZeit = 0; tipp(''); }
      el.classList.toggle('dunkel', !imSpiel);
      el.hidden = false;
      if (opt.stimmung) PT.Ton.musik(opt.stimmung);
      let i = -1, uhr = null, voll = '', pos = 0, ende = false;
      const schluss = () => {
        if (ende) return;
        ende = true;
        clearInterval(uhr);
        el.hidden = true; el.onclick = null; karte.hidden = true; box.hidden = true; $('#auge').hidden = true;
        szeneAktiv = null;
        if (imSpiel && welt) { welt.kinoSetzen(false); pausiert = warPausiert; }
        fertig();
      };
      const zeigen = () => {
        i++;
        if (i >= zeilen.length) { schluss(); return; }
        const [wer, text] = zeilen[i], sp = PT.SPRECHER[wer] || PT.SPRECHER.erzaehler;
        const laut = /[A-ZÄÖÜ]{4,}/.test(text);
        box.hidden = false;
        box.className = 'szene-box' + (wer === 'erzaehler' ? ' erzaehler' : '') + (laut ? ' laut' : '');
        box.style.animation = 'none'; void box.offsetHeight; box.style.animation = '';
        const bild = portrait(wer);
        $('#szeneBild').hidden = !bild;
        if (bild) $('#szeneBild').src = bild;
        $('#szeneName').textContent = sp.name;
        $('#szeneName').style.color = sp.farbe;
        if (opt.auge === i) $('#auge').hidden = false;
        voll = text; pos = 0; $('#szeneText').textContent = '';
        clearInterval(uhr);
        uhr = setInterval(() => { pos += 2; $('#szeneText').textContent = voll.slice(0, pos); if (pos >= voll.length) clearInterval(uhr); }, 26);
        if (laut) { PT.Ton.schlag(); if (welt && imSpiel) welt.wackeln = 0.5; }
        else if (wer !== 'erzaehler') PT.Ton.funk();
      };
      const weiter = () => {
        if (!karte.hidden) { karte.hidden = true; zeigen(); return; }
        if (pos < voll.length) { pos = voll.length; $('#szeneText').textContent = voll; clearInterval(uhr); return; }
        zeigen();
      };
      szeneAktiv = { weiter, schluss };
      el.onclick = e => { if (e.target.id !== 'szeneSkip') weiter(); };
      $('#szeneSkip').onclick = e => { e.stopPropagation(); schluss(); };
      box.hidden = true;
      if (opt.karte) {
        karte.hidden = false;
        $('#szeneKapitel').textContent = opt.karte.kapitel || '';
        $('#szeneTitel').textContent = opt.karte.titel;
        const z = opt.karte.zitat || ['', ''];
        $('#szeneZitat').textContent = z[0];
        $('#szeneVon').textContent = z[1] ? (opt.karte.kapitel && opt.karte.kapitel !== 'Prolog' ? '– ' + z[1] : z[1]) : '';
        PT.Ton.schlag();
        setTimeout(() => { if (!ende && !karte.hidden) weiter(); }, 5000);
      } else zeigen();
    });
  }
  // Abspann: die Namen rollen über den Bildschirm
  function abspannSpielen(rolleDaten = PT.ABSPANN) {
    return new Promise(fertig => {
      const el = $('#szene'), a = $('#abspann');
      el.classList.add('dunkel'); el.hidden = false; a.hidden = false;
      $('#szeneBox').hidden = true; $('#szeneKarte').hidden = true;
      $('#abspannRolle').innerHTML = rolleDaten.map(([k, t], i) => `<div class="${i === 0 ? 'gross' : ''}">${k ? `<small>${esc(k)}</small>` : ''}<b>${esc(t)}</b></div>`).join('');
      const rolle = $('#abspannRolle');
      rolle.style.animation = 'none'; void rolle.offsetHeight; rolle.style.animation = '';
      PT.Ton.musik('herz');
      let ende = false;
      const schluss = () => { if (ende) return; ende = true; a.hidden = true; el.hidden = true; el.onclick = null; szeneAktiv = null; fertig(); };
      szeneAktiv = { weiter:() => {}, schluss };
      el.onclick = null;
      $('#szeneSkip').onclick = e => { e.stopPropagation(); schluss(); };
      rolle.onanimationend = schluss;
      setTimeout(schluss, 36000);
    });
  }

  /* ---------- Opas Tagebuch (Teil 2): eine Seite treibt in der Mitte jedes Levels durch den Kanal ---------- */
  function tagebuchPruefen(runde) {
    const l = PT.LEVEL(kampagneAktiv);
    if (!l || !PT.TAGEBUCH[l.id] || fort.tagebuch[l.id] || tagebuchSeite || runde !== PT.tagebuchRunde(l)) return;
    const w = spiel.wege[0], [x, y] = w.punkt(w.vonDist + (w.bisDist - w.vonDist) * 0.45);
    tagebuchSeite = { id:l.id, x, y, bis:spiel.zeit + 18 };
    if (welt) welt.tagebuchZeigen(x, y);
    kurzTipp('📜 Eine leuchtende Seite treibt im Kanal – klick sie an, bevor sie versinkt!');
  }
  function tagebuchSammeln() {
    const { id } = tagebuchSeite, [titel, text] = PT.TAGEBUCH[id];
    tagebuchSeite = null;
    if (welt) welt.tagebuchWeg(true);
    fort.tagebuch[id] = true; fortMerken();
    PT.Ton.klick();
    kristalleDazu(2);
    banner(`📜 ${titel}`, 'Eine Seite aus Opas Tagebuch (+2 💎)', 2.6);
    funkSchlange.push(['tagebuch', text]);
  }
  function tagebuchOeffnen() {
    const ids = Object.keys(PT.TAGEBUCH), n = ids.filter(id => fort.tagebuch[id]).length;
    $('#tagebuchZahl').textContent = n === ids.length ? 'Alle Seiten gefunden.' : `${n} von ${ids.length} Seiten gefunden. Jede Seite treibt einmal in ihrem Level vorbei – etwa in der Mitte.`;
    $('#tagebuchSeiten').innerHTML = ids.map(id => {
      const l = PT.LEVEL(id), [titel, text] = PT.TAGEBUCH[id];
      return fort.tagebuch[id] ? `<article><h4>${esc(levelNummer(l))} · ${esc(titel)}</h4><p>${esc(text)}</p></article>`
        : `<article class="fehlt"><h4>${esc(levelNummer(l))} · ???</h4><p>Noch nicht gefunden – treibt in „${esc(l.name)}“ vorbei.</p></article>`;
    }).join('');
    $('#tagebuchDialog').hidden = false;
  }

  /* ---------- Funk im Kampf (Abenteuer) ---------- */
  let funkSchlange = [], funkZeit = 0;
  const funkGespielt = new Set();
  function funk(schluessel, wiederholen) {
    const l = kampagneAktiv && PT.LEVEL(kampagneAktiv);
    if (!l || !l.funk || !l.funk[schluessel] || szeneAktiv) return;
    if (!wiederholen && funkGespielt.has(schluessel)) return;
    funkGespielt.add(schluessel);
    funkSchlange.push(...l.funk[schluessel]);
  }
  // Zeit in echten Sekunden, damit Sprüche auch auf langsamen Geräten nicht zu lange stehen bleiben
  function funkZeigen() {
    if (funkZeit > 0) { if (performance.now() < funkZeit) return; funkZeit = 0; $('#funk').hidden = true; return; }
    if (!funkSchlange.length || szeneAktiv) return;
    const [wer, text] = funkSchlange.shift(), sp = PT.SPRECHER[wer] || PT.SPRECHER.erzaehler;
    const bild = portrait(wer);
    $('#funkBild').hidden = !bild;
    if (bild) $('#funkBild').src = bild;
    $('#funkName').textContent = sp.name || 'Funk';
    $('#funkName').style.color = sp.farbe;
    $('#funkText').textContent = text;
    const f = $('#funk');
    f.hidden = false; f.style.animation = 'none'; void f.offsetHeight; f.style.animation = '';
    funkZeit = performance.now() + (2.4 + text.length * 0.045) * 1000;
    PT.Ton.funk();
  }
  function funkLeeren() { funkSchlange = []; funkZeit = 0; funkGespielt.clear(); $('#funk').hidden = true; }

  /* ---------- Pingu-Dorf ---------- */
  let dorfReiter = false, dorfWelt = null, dorfAuswahl = null;
  function erfolgeOhneSpiel() {
    const neu = PT.erfolgePruefen({ spiel:{ statistik:{}, tuerme:[] }, lebenslang:fort.lebenslang, passStufe:passStufe(), prestige:pass.prestige, medaillen, kampagne:fort.kampagne, dorf:fort.dorf,
      lookZahl:PT.SKIN_REIHE.filter(id => PT.skinFrei(id, passStufe(), fort.besitz)).length }, fort.erfolge);
    for (const e of neu) { fort.erfolge[e.id] = PT.heute(); fort.muenzen += e.muenzen; banner(`🏆 Erfolg: ${e.name}`, `${e.text} · +${e.muenzen} 🪙`, 3); }
    if (neu.length) fortMerken();
  }
  function dorfBauen() {
    const D = fort.dorf, phase = PT.dorfPhase(fort.kampagne), P = PT.DORF_PHASEN[phase];
    $('#dorfTitel').textContent = `🏘️ ${phase ? P.name : 'Pingu-Dorf'}`;
    $('#dorfVorrat').textContent = `❄️ ${zahl(D.kristalle)} · 🪙 ${zahl(fort.muenzen)} · 🐧 ${D.bewohner} Bewohner`;
    $('#dorfText').textContent = phase ? `${P.text} ${phase < 4 ? 'Mit jedem Kapitel des Abenteuers wächst es weiter.' : ''}`
      : 'Noch gibt es kein Dorf. Spiel das Abenteuer „Schwarzes Eis“ – nach Kapitel 2 schlagen die Überlebenden ihr erstes Lager auf.';
    $('#dorfZu').hidden = phase > 0;
    $('#dorfZu').textContent = '🔒 Nach Kapitel 2 des Abenteuers entsteht hier ein Flüchtlingslager.';
    // Räucherei: Fischmünzen abholen
    const proStunde = PT.dorfWert(D, 'raeucherei'), bereit = PT.dorfErnte(D, Date.now());
    $('#dorfErnte').hidden = !proStunde;
    if (proStunde) {
      $('#dorfErnte').innerHTML = `<span>🐟 Räucherei: <b>${bereit}</b> Fischmünzen bereit <small>(${proStunde} pro Stunde, sammelt bis zu 12 Stunden)</small></span><button class="knopf" id="dorfAbholen" ${bereit ? '' : 'disabled'}>Abholen</button>`;
      $('#dorfAbholen').onclick = () => {
        const n = PT.dorfErnte(fort.dorf, Date.now());
        if (!n) return;
        fort.muenzen += n; fort.dorf.geerntet = Date.now(); fortMerken();
        PT.Ton.upgrade(); kurzTipp(`🪙 +${n} Fischmünzen aus der Räucherei`);
        menueBauen();
      };
    }
    $('#dorfGebaeude').innerHTML = PT.DORF_REIHE.map(id => {
      const g = PT.DORF_GEBAEUDE[id], st = PT.dorfStufe(D, id), max = PT.dorfMax(id);
      const zu = phase < g.ab, k = st < max ? PT.dorfKosten(id, st + 1) : null;
      const a = PT.dorfAusbau(D, id, phase, fort.muenzen);
      const knopf = !zu && k ? `<button data-ausbau="${id}" ${a.ok ? '' : 'disabled'}>${esc(a.ok || a.grund === 'Zu wenig' ? `${st ? 'Ausbauen' : 'Bauen'}: ${k.muenzen} 🪙 · ${k.kristalle} ❄️` : a.grund)}</button>` : '';
      return `<div class="gebaeude ${zu ? 'zu' : ''} ${dorfAuswahl === id ? 'gewaehlt' : ''}" data-gebaeude="${id}"><i>${g.symbol}</i>
        <b>${esc(g.name)} <span class="pips">${'<i class="an"></i>'.repeat(st)}${'<i></i>'.repeat(max - st)}</span></b>
        <small>${esc(zu ? `🔒 ab „${PT.DORF_PHASEN[g.ab].name}“` : st ? g.zeigen(g.wert[st]) : 'Noch nicht gebaut')}</small><small>${esc(g.text)}</small>${knopf}</div>`;
    }).join('');
    for (const b of document.querySelectorAll('[data-ausbau]')) b.onclick = () => ausbauen(b.dataset.ausbau);
    if (!dorfWelt && PT.DorfWelt) {
      try { dorfWelt = new PT.DorfWelt($('#dorfWelt')); dorfWelt.beiWahl = id => { dorfAuswahl = id; PT.Ton.klick(); dorfBauen(); const el = document.querySelector(`[data-gebaeude="${id}"]`); if (el) el.scrollIntoView({ block:'nearest', behavior:'smooth' }); }; }
      catch (e) { console.error(e); }
    }
    if (dorfWelt) { dorfWelt.zeigen(D, phase, dorfAuswahl, Object.fromEntries(PT.DEKO_REIHE.filter(id => PT.dekoFrei(id, passStufe(), fort.besitz)).map(id => [id, true]))); dorfWelt.start(); }
  }
  function ausbauen(id) {
    const phase = PT.dorfPhase(fort.kampagne), a = PT.dorfAusbau(fort.dorf, id, phase, fort.muenzen);
    if (!a.ok) { PT.Ton.fehler(); return; }
    fort.muenzen -= a.kosten.muenzen;
    fort.dorf.kristalle -= a.kosten.kristalle;
    fort.dorf.stufen[id] = PT.dorfStufe(fort.dorf, id) + 1;
    const st = fort.dorf.stufen[id];
    if (id === 'raeucherei' && !fort.dorf.geerntet) fort.dorf.geerntet = Date.now();
    if (id === 'denkmal') { fort.besitz.skins.veteran = true; banner('🗿 Walters Denkmal', 'Neuer Look: Walters Helm', 3); }
    if (id === 'leuchtfeuer' && st >= 3 && !fort.besitz.sockel.herzlicht) { fort.besitz.sockel.herzlicht = true; banner('💡 Das Leuchtfeuer brennt', 'Neuer Sockel: Herzlicht. Tief unten öffnet sich ein Auge …', 4); }
    else banner(`${PT.DORF_GEBAEUDE[id].symbol} ${PT.DORF_GEBAEUDE[id].name}`, `Stufe ${st}: ${PT.DORF_GEBAEUDE[id].zeigen(PT.DORF_GEBAEUDE[id].wert[st])}`, 2.4);
    fortMerken();
    PT.Ton.upgrade();
    xpDazu(40 * st, true);
    dorfAuswahl = id;
    if (dorfWelt) dorfWelt.gebaut(id);
    erfolgeOhneSpiel();
    menueBauen();
  }

  /* ---------- Versus „Eiskrieg“ im Spiel ---------- */
  let vs = null, vsSchluessel = '', vsMalZeit = 0;
  const gegnerSpiel = () => (vs ? vs.spiele.find(x => x !== spiel) : null);
  const spielerName = id => { const x = vs && vs.spieler.find(y => y.id === id); return x ? x.name : 'Gegner'; };
  function vsPanelBauen() {
    const an = !!vs;
    $('#vsPanel').hidden = !an; $('#vsGegner').hidden = !an; $('#vsEinkommen').hidden = !an;
    $('#start').hidden = an; $('#auto').parentElement.hidden = an;
    if (!an) return;
    $('#vsFische').innerHTML = PT.VS_FISCHE.map(f => `<button data-schick="${f.typ}" title="${esc(PT.FISCHE[f.typ].name)} ab Runde ${f.ab}"><img src="${fischBilder[f.typ] || ''}" alt=""><b>${f.anzahl}× ${esc(PT.FISCHE[f.typ].name)}</b><span>${zahl(f.preis)}</span><em>+${f.einkommen}/Runde</em></button>`).join('');
    for (const b of document.querySelectorAll('[data-schick]')) b.onclick = () => { PT.Ton.klick(); tun({ t:'schick', typ:b.dataset.schick }); };
    $('#vsKarten').innerHTML = PT.VS_KARTEN_REIHE.map(k => `<button data-karte="${k}" title="${esc(PT.VS_KARTEN[k].name)}: ${esc(PT.VS_KARTEN[k].text)}" aria-label="${esc(PT.VS_KARTEN[k].name)}">${PT.VS_KARTEN[k].symbol}</button>`).join('');
    for (const b of document.querySelectorAll('[data-karte]')) b.onclick = () => tun({ t:'karte', fk:b.dataset.karte });
    vsSchluessel = '';
  }
  function vsZeigen(dt) {
    if (!vs) return;
    const i = vs.index(netz.id), runde = spiel.runde + 1;
    const geld = meinGeld();
    const s = PT.VS_FISCHE.map(f => (f.ab > runde ? 'z' : geld < f.preis || !vs.gestartet ? 'a' : 'o')).join('') + (i >= 0 ? PT.VS_KARTEN_REIHE.map(k => Math.ceil(vs.karten[i][k])).join() : '');
    if (s !== vsSchluessel) {
      vsSchluessel = s;
      PT.VS_FISCHE.forEach((f, n) => { const b = document.querySelector(`[data-schick="${f.typ}"]`); if (!b) return; b.classList.toggle('zu', f.ab > runde); b.disabled = s[n] !== 'o' || i < 0; });
      for (const k of PT.VS_KARTEN_REIHE) {
        const b = document.querySelector(`[data-karte="${k}"]`); if (!b || i < 0) continue;
        const rest = vs.karten[i][k];
        b.style.setProperty('--rest', vs.gestartet ? rest / PT.VS_KARTEN[k].cd : 1);
        b.classList.toggle('bereit', vs.gestartet && rest <= 0);
        b.disabled = !vs.gestartet || rest > 0;
      }
    }
    $('#vsEinkommen').querySelector('span').textContent = `+${zahl(spiel.einkommen)}/Runde`;
    if (!vs.gestartet) { tipp(`⏳ Aufbauzeit: noch ${Math.max(0, Math.ceil(PT.VS_VORLAUF - vs.zeit))} s – setz deine Pinguine!`); tippZeit = 0.3; }
    vsMalZeit -= dt;
    if (vsMalZeit <= 0) { vsMalZeit = 0.12; vsKarteMalen(); }
  }
  function vsKarteMalen() {
    const g = gegnerSpiel(); if (!g) return;
    const c = $('#vsKarte'), x = c.getContext('2d'), W = c.width, H = c.height, k = W / PT.BREITE;
    x.fillStyle = '#1d3a5c'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#3fa8e0'; x.lineWidth = PT.WEG_BREITE * k; x.lineCap = 'round'; x.lineJoin = 'round';
    for (const w of g.wege) {
      x.beginPath();
      for (let n = 0; n < w.pts.length; n += 6) { const [px, py] = w.pts[n]; if (n) x.lineTo(px * k, py * k); else x.moveTo(px * k, py * k); }
      x.stroke();
    }
    x.fillStyle = 'rgba(200,220,235,.35)';
    for (const [hx, hy, hr] of g.kartenDaten.hindernisse) { x.beginPath(); x.arc(hx * k, hy * k, hr * k, 0, 7); x.fill(); }
    for (const t of g.tuerme) { x.fillStyle = PT.HELDEN[t.typ] ? '#ffd54a' : t.betaeubt > 0 ? '#9ff3ff' : '#ffffff'; x.beginPath(); x.arc(t.x * k, t.y * k, 3.6, 0, 7); x.fill(); }
    for (const f of g.fische) {
      const F = PT.FISCHE[f.typ];
      x.globalAlpha = f.camo ? 0.45 : 1;
      x.fillStyle = F.farbe; x.beginPath(); x.arc(f.x * k, f.y * k, Math.max(1.8, F.r * k), 0, 7); x.fill();
    }
    x.globalAlpha = 1;
    if (g.zeit < g.finsternisBis) { x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, W, H); }
    if (g.vorbei) { x.fillStyle = 'rgba(120,0,0,.5)'; x.fillRect(0, 0, W, H); }
    const id = vs.spieler[vs.spiele.indexOf(g)].id;
    $('#vsGegnerKopf').innerHTML = `<span>⚔️ ${esc(spielerName(id))}</span><span>❤️ ${Math.max(0, Math.ceil(g.leben))} · 🌊 ${g.runde} · 📈 ${zahl(g.einkommen)}</span>`;
  }
  function vsMeldung(m) {
    const ich = m.von === netz.id;
    if (m.art === 'geschickt') {
      if (ich) PT.Ton.bauen();
      else kurzTipp(`⚔️ ${spielerName(m.von)} schickt dir ${m.anzahl}× ${PT.FISCHE[m.typ].name}!`);
    }
    if (m.art === 'karte') {
      const K = PT.VS_KARTEN[m.k];
      if (ich) kurzTipp(`${K.symbol} ${K.name} trifft deinen Gegner!`);
      else { banner(`${K.symbol} ${K.name}!`, `${spielerName(m.von)} sabotiert dich`, 2); PT.Ton.fehler(); }
    }
    if (m.art === 'los') { banner('⚔️ Eiskrieg!', 'Runde 1 – die Fische kommen. Ab Runde 30 jede Runde ein Boss!', 2.6); PT.Ton.start(); }
    if (m.art === 'ende') versusEnde(m.sieger);
  }
  function versusEnde(sieger) {
    if (endeArt === 'versus') return;
    endeArt = 'versus';
    const meins = !!vs.spielVon(netz.id), gewonnen = sieger === netz.id;
    const i = vs.index(netz.id), st = i >= 0 ? vs.statistik[i] : null;
    $('#ende').hidden = false;
    $('#endeEmoji').textContent = sieger == null ? '🤝' : gewonnen ? '🏆' : meins ? '🐟' : '⚔️';
    $('#endeTitel').textContent = sieger == null ? 'Unentschieden!' : gewonnen ? 'Sieg im Eiskrieg!' : `${spielerName(sieger)} gewinnt!`;
    $('#endeText').textContent = `Runde ${vs.runde}.` + (st ? ` Du hast ${zahl(st.geschickt)} Fische für ${zahl(st.wert)} Geld geschickt und ${st.karten} ${st.karten === 1 ? 'Karte' : 'Karten'} gespielt.` : '');
    if (meins) {
      fort.lebenslang.vsSpiele++;
      if (gewonnen) {
        if (welt) welt.tanzStarten(pass.tanz);
        fort.lebenslang.vsSiege++;
        xpDazu(400); muenzenDazu(15); kristalleDazu(6);
        if (fort.lebenslang.vsSiege >= 10 && !fort.besitz.sockel.eiskrieg) { fort.besitz.sockel.eiskrieg = true; banner('⚔️ 10 Versus-Siege!', 'Neuer Sockel: Eiskrieg', 3.5); }
      } else xpDazu(150);
      fortMerken();
      erfolgeCheck(true, gewonnen);
    }
    statistikZeigen();
    const k = $('#endeKnoepfe');
    k.innerHTML = (binHost() ? '<button class="knopf haupt" id="eLobby">Revanche (zurück in die Lobby)</button>' : '<p>Der Gastgeber kann alle zurück in die Lobby holen.</p>') + '<button class="knopf" id="eRaus">Raum verlassen</button>';
    if ($('#eLobby')) $('#eLobby').onclick = () => senden({ t:'nochmal' });
    $('#eRaus').onclick = koopVerlassen;
  }

  /* ---------- Spiel starten ---------- */
  function spielStarten(neu) {
    spiel = neu;
    spielLohn = { xp:0, muenzen:0, erfolge:[] };
    spielBooster = false;
    if (fort.booster > 0 && !olymp && !neu.unendlich && neu.runde === 0) { fort.booster--; spielBooster = true; fortMerken(); }
    zaehler = zaehlerStand();
    vorschauSchluessel = '';
    auswahl = null; bauTyp = null; zielModus = null; tempo = 1; pausiert = false; zeitRest = 0; autoWarte = 0;
    olympGemeldet = false;
    endeArt = null;
    endeSzene = false; kampagneErgebnis = null;
    funkLeeren();
    tagebuchSeite = null;
    if (!neu.koop) vs = null;
    $('#pauseTitel').textContent = 'Pause';
    $('#menue').hidden = true;
    $('#spiel').hidden = false;
    $('#pause').hidden = true;
    $('#ende').hidden = true;
    document.body.style.overflow = 'hidden';
    if (!welt) {
      welt = new PT.Welt($('#welt'), $('#ueber'));
      new ResizeObserver(() => welt.groesse()).observe($('#buehne'));
      welt.grafik(grafikHoch);
      // Aussehen der Pinguine: eigener Look, im Koop Look und Farbe des Besitzers
      welt.aussehenFuer = t => {
        if (!spiel || !spiel.koop || t.besitzer == null) return { ...passZeigen() };
        const sp = spiel.spielerVon(t.besitzer);
        const m = netz && netz.raum && netz.raum.mitglieder.find(x => x.id === t.besitzer);
        return { skin:m ? m.skin : 'standard', sockel:m ? m.sockel : 'standard', farbe:sp ? PT.KOOP_FARBEN[sp.farbe] : null };
      };
      // Platz-Effekt: eigener aus dem Pass, im Koop der des Besitzers
      welt.effektFuer = von => {
        if (!spiel || !spiel.koop || von == null || (netz && von === netz.id)) return pass.effekt;
        const m = netz && netz.raum && netz.raum.mitglieder.find(x => x.id === von);
        return m && PT.EFFEKTE[m.effekt] ? m.effekt : null;
      };
      einstAnwenden();
    }
    welt.namenZeigen = spiel.koop && spiel.spieler.length > 1;
    welt.karteLaden(spiel);
    ladenBauen();
    seiteZeigen();
    letzteAnzeige = '';
    anzeigen();
    fkSchluessel = '';
    const md = PT.MODI[spiel.modus];
    $('#modusAnzeige').textContent = spiel.modus !== 'standard' ? `${md.symbol} ${md.name}` : '';
    tipp('');
    if (spiel.runde === 0 && !spiel.tuerme.length) { tipp(spiel.heldVon(ich()) ? 'Setz zuerst deinen Helden und ein paar Pinguine neben den Kanal.' : 'Wähle einen Pinguin und setz ihn neben den Kanal.'); tippZeit = 6; }
    const geldText = spiel.koop ? ` · ${spiel.spieler.length} Spieler, ${PT.KOOP_GELD[spiel.geldModus].name}` : '';
    if (tagesAktiv) banner(`📅 ${PT.tagesHerausforderung(tagesAktiv).titel}`, `${spiel.kartenDaten.name} · ${PT.STUFEN[spiel.stufe].name} · ${spiel.zielRunden} Runden`, 3);
    else banner(spiel.kartenDaten.name, `${PT.STUFEN[spiel.stufe].name} · ${spiel.zielRunden} Runden${spiel.modus !== 'standard' ? ' · ' + md.name : ''}${geldText}`);
    if (tagesAktiv) $('#modusAnzeige').textContent = '📅 Tages-Herausforderung';
    if (kampagneAktiv && PT.LEVEL(kampagneAktiv)) {
      const l = PT.LEVEL(kampagneAktiv);
      $('#modusAnzeige').textContent = `📖 ${l.kapitel}-${l.nr} ${l.name}`;
      banner(`📖 ${l.name}`, `${spiel.kartenDaten.name} · ${PT.STUFEN[spiel.stufe].name} · bis Runde ${spiel.zielRunden}`, 3);
    }
    if (spielBooster) setTimeout(() => kurzTipp('⚡ Doppel-Erfahrung ist in diesem Spiel aktiv!'), 3200);
    wetterHud();
    $('#auto').checked = spiel.koop ? !!(netz.raum && netz.raum.auto) : speicher.lesen('pt-auto') === true || (einstellung.autoStart && spiel.runde === 0);
    $('#pNeu').hidden = !!olymp || spiel.koop;
    $('#pMenue').textContent = spiel.koop ? 'Raum verlassen' : 'Zum Hauptmenü';
    mitspielerZeigen();
    vsPanelBauen();
    if (vs) { $('#modusAnzeige').textContent = '⚔️ Versus'; banner('⚔️ Eiskrieg', `${vs.spieler.map(x => x.name).join(' gegen ')} · ${spiel.kartenDaten.name}`, 3); }
    if (spiel.koop) koopPauseZeigen();
  }
  function neuesSpiel() {
    speicher.weg('pt-stand');
    tagesAktiv = null; kampagneAktiv = null;
    const eigen = eigeneKarte(wahl.karte);
    spielStarten(new PT.Spiel({ karte:eigen ? 'eigen' : wahl.karte, eigeneKarte:eigen, stufe:wahl.stufe, modus:wahl.modus, held:wahl.held, kraft:kraftAktiv(wahl.held),
      boni:boniAktiv(), wetter:wahl.wetter !== false, seed:Date.now() & 0xffffff }));
  }
  /* ---------- Eigene Karten ---------- */
  function kartenMerken() { speicher.schreiben('pt-karten', eigeneKarten); }
  function karteSpeichern(k) {
    const ok = PT.karteOk(k);
    if (!ok) return null;
    const id = k.id || Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const neu = { ...ok, id:String(id) };
    const i = eigeneKarten.findIndex(x => x.id === neu.id);
    if (i >= 0) eigeneKarten[i] = neu; else eigeneKarten.push(neu);
    eigeneKarten = eigeneKarten.slice(-20);
    kartenMerken();
    return neu;
  }
  function karteLoeschen(id) {
    eigeneKarten = eigeneKarten.filter(k => k.id !== id);
    kartenMerken();
    if (wahl.karte === 'eigen:' + id) wahl.karte = 'scholle';
    wahlMerken();
  }
  // Teilen-Link: die Karte steckt (kurz gepackt) im Link
  function karteLink(k) {
    const roh = { n:k.name, t:k.thema, w:k.wege, h:k.hindernisse, s:k.wasser, u:k.tunnel };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(roh)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${location.origin}${location.pathname}?karte=${b64}`;
  }
  function karteAusLink(text) {
    try {
      const roh = JSON.parse(decodeURIComponent(escape(atob(text.replace(/-/g, '+').replace(/_/g, '/')))));
      return PT.karteOk({ name:roh.n, thema:roh.t, wege:roh.w, hindernisse:roh.h, wasser:roh.s, tunnel:roh.u });
    } catch (e) { return null; }
  }
  async function karteTeilen(k) {
    const link = karteLink(k);
    try {
      if (navigator.share) { await navigator.share({ title:`Pinguin Türmchen: ${k.name}`, url:link }); return; }
      await navigator.clipboard.writeText(link);
      alert('Link kopiert! Schick ihn an deine Freunde – wer ihn öffnet, bekommt die Karte.');
    } catch (e) { prompt('Diesen Link kopieren und verschicken:', link); }
  }
  function editorOeffnen(k) {
    PT.Ton.klick();
    $('#menue').hidden = true;
    $('#editor').hidden = false;
    window.scrollTo(0, 0);
    PT.Editor.oeffnen(k);
  }
  function editorZu(gespeichert, spielen) {
    $('#editor').hidden = true;
    if (gespeichert) { wahl.karte = 'eigen:' + gespeichert.id; speicher.schreiben('pt-wahl', wahl); }
    if (spielen && gespeichert) { neuesSpiel(); return; }
    $('#menue').hidden = false;
    menueBauen();
  }
  PT.UI = { karteSpeichern, karteLink, karteTeilen, editorZu, kartenVorschau, speicher };
  function zumMenue() {
    if (spiel && !spiel.vorbei) fortschrittMelden('menue');
    if (kampagneAktiv) { abenteuerReiter = true; koopReiter = false; dorfReiter = false; }
    if (szeneAktiv) szeneAktiv.schluss();
    PT.Ton.musik(null);
    vs = null;
    $('#spiel').hidden = true;
    $('#pause').hidden = true;
    $('#ende').hidden = true;
    $('#menue').hidden = false;
    document.body.style.overflow = '';
    spiel = null;
    if (netz) { netz.befehle = []; netz.n = netz.ziel = 0; }
    menueBauen();
  }

  /* ---------- Anzeige ---------- */
  let bannerZeit = 0;
  function banner(text, klein, dauer = 2.2) {
    const b = $('#banner');
    b.innerHTML = esc(text) + (klein ? `<small>${esc(klein)}</small>` : '');
    b.classList.add('an');
    bannerZeit = dauer;
  }
  function tipp(text) { $('#tipp').hidden = !text; $('#tipp').textContent = text || ''; }
  let tippZeit = 0;
  function kurzTipp(text) { tipp(text); tippZeit = 2.2; }

  let letzteAnzeige = '';
  function anzeigen() {
    if (!spiel) return;
    const t = auswahl;
    const geld = meinGeld();
    const schluessel = [Math.ceil(spiel.leben), Math.floor(geld), mitspielerZeigen(), spiel.runde, spiel.laeuft, tempo, bauTyp, zielModus && zielModus.id, spiel.tuerme.length,
      t && t.id, t && t.pfade.join(), t && t.ziel, t && t.muster, t && t.pops, t && t.stufe, t && Math.floor(t.xp), t && t.eff && t.eff.gebufft].join('|');
    if (schluessel === letzteAnzeige) return;
    letzteAnzeige = schluessel;
    $('#leben').textContent = spiel.unendlich ? '∞' : Math.max(0, Math.ceil(spiel.leben));
    $('#geld').textContent = spiel.unendlich ? '∞' : zahl(geld);
    $('#runde').textContent = Math.max(1, spiel.runde + 1);
    $('#rundenZiel').textContent = spiel.endlos || vs ? '∞' : spiel.zielRunden;
    const st = $('#start');
    if (spiel.laeuft) { st.textContent = `⏩ ${tempo}×`; st.classList.add('schnell'); st.setAttribute('aria-label', `Tempo ${tempo}-fach, ändern`); }
    else { st.textContent = '▶ Runde starten'; st.classList.remove('schnell'); st.setAttribute('aria-label', 'Nächste Runde starten'); }
    for (const b of document.querySelectorAll('.pingu-kauf')) {
      const typ = b.dataset.typ;
      const preis = spiel.preisBau(typ);
      b.querySelector('span').textContent = zahl(preis) + ' 💰';
      b.classList.toggle('teuer', preis > geld);
      b.setAttribute('aria-pressed', bauTyp === typ);
      if (PT.HELDEN[typ]) b.hidden = !!spiel.heldDa(ich());
    }
    if (auswahl) turmInfoBauen();
  }

  function ladenBauen() {
    const l = $('#ladenListe');
    l.innerHTML = '';
    const held = spiel.heldVon(ich());
    if (held) {
      const d = PT.HELDEN[held];
      const b = document.createElement('button');
      b.className = 'pingu-kauf held';
      b.dataset.typ = held;
      b.title = `${d.name} – ${d.kurz}`;
      b.innerHTML = `<kbd>H</kbd><img src="${bilder[held] || ''}" alt=""><div><b>⭐ ${esc(d.name)}</b><br><span></span></div>`;
      b.onclick = () => bauWaehlen(bauTyp === held ? null : held);
      b.onpointerenter = () => { $('#ladenInfo').textContent = `${d.name}: ${d.kurz}`; };
      l.appendChild(b);
    }
    for (const gruppe of PT.GRUPPEN) {
      const typen = PT.PINGUIN_REIHE.filter(t => PT.PINGUINE[t].gruppe === gruppe && spiel.erlaubt(t, ich()));
      if (!typen.length) continue;
      const h = document.createElement('p');
      h.className = 'gruppe'; h.textContent = gruppe;
      l.appendChild(h);
      for (const typ of typen) {
        const p = PT.PINGUINE[typ];
        const b = document.createElement('button');
        b.className = 'pingu-kauf';
        b.dataset.typ = typ;
        b.title = `${p.name} – ${p.kurz}`;
        b.innerHTML = `<kbd>${p.taste}</kbd><img src="${bilder[typ] || ''}" alt=""><b>${esc(p.name)}</b><span></span>`;
        b.onclick = () => bauWaehlen(bauTyp === typ ? null : typ);
        b.onpointerenter = () => { $('#ladenInfo').textContent = `${p.name}: ${p.kurz}`; };
        l.appendChild(b);
      }
    }
    // Sandkasten: Fische selbst losschicken
    $('#sand').hidden = spiel.modus !== 'sandkasten';
    if (spiel.modus === 'sandkasten') {
      $('#sandFische').innerHTML = [...PT.FISCH_REIHE, ...PT.BOSS_REIHE].map(id => `<button data-fisch="${id}" title="${esc(PT.FISCHE[id].name)}"><img src="${fischBilder[id] || ''}" alt="${esc(PT.FISCHE[id].name)}"></button>`).join('');
      for (const b of document.querySelectorAll('[data-fisch]')) b.onclick = () => {
        tun({ t:'sand', typ:b.dataset.fisch, n:+$('#sandAnzahl').value, camo:$('#sandCamo').checked, nach:$('#sandNach').checked, fest:$('#sandFest').checked });
      };
      $('#sandLeeren').onclick = () => tun({ t:'leeren' });
    }
  }
  function bauWaehlen(typ) {
    if (typ && spiel.preisBau(typ) > meinGeld()) { PT.Ton.fehler(); kurzTipp('Dafür reicht das Geld noch nicht.'); return; }
    if (typ && PT.HELDEN[typ] && spiel.heldDa(ich())) return;
    bauTyp = typ;
    auswahl = null; zielModus = null;
    welt.geistZeigen(null);
    welt.reichweiteZeigen(null);
    welt.zielZeigen(null);
    if (typ) {
      PT.Ton.klick();
      const d = PT.def(typ);
      $('#ladenInfo').textContent = `${d.name}: ${d.kurz}`;
      tipp(d.wasser ? 'Boote dürfen nur in die runden Wasserlöcher. Esc bricht ab.' : 'Aufs Eis neben dem Kanal tippen oder ziehen und loslassen. Esc bricht ab.');
    } else tipp('');
    seiteZeigen();
    letzteAnzeige = '';
    anzeigen();
  }
  function seiteZeigen() {
    $('#laden').hidden = !!auswahl;
    $('#turmInfo').hidden = !auswahl;
    if (auswahl) turmInfoBauen();
  }

  function zielKnoepfe(t, d) {
    if (t.typ === 'moerser') return `<button class="zielknopf" id="tiZiel">🎯 ${zielModus === t ? 'Tippe auf die Karte …' : 'Ziel setzen'}</button>`;
    if (t.eff.flieger) return `<div class="ziele drei" role="group" aria-label="Flugbahn">${PT.MUSTER.map(([id, name]) => `<button data-muster="${id}" aria-pressed="${t.muster === id}">${name}</button>`).join('')}</div>`;
    if (d.greift === false) return '';
    const ziele = d.ziele || PT.ZIELE;
    return `<div class="ziele ${ziele.length > 4 ? 'sechs' : ''}" role="group" aria-label="Ziel">${ziele.map(([id, name]) => `<button data-ziel="${id}" aria-pressed="${t.ziel === id}">${name}</button>`).join('')}</div>`;
  }
  function kennzahlenText(t) {
    const k = spiel.kennzahlen(t);
    const teile = [];
    if (k) {
      if (k.schaden) teile.push(`⚔️ ${k.schaden}`);
      if (k.durchschlag) teile.push(`🎯 ${k.durchschlag}`);
      teile.push(`⏱ ${k.proSek}/s`);
      teile.push(`📏 ${k.reichweite}`);
      teile.push({ spitz:'🔪 spitz', explosion:'💥 Explosion', kaelte:'❄️ Kälte', normal:'✨ alles' }[k.typ] || '');
    }
    if (t.eff.camo) teile.push('👁 Tarnung');
    if (t.eff.gebufft) teile.push('🪶 verstärkt');
    if (t.eff.geld) {
      const g = t.eff.geld;
      if (g.kisten) teile.push(`📦 ${g.kisten} × ${Math.round(g.wert)}`);
      if (g.flat) teile.push(`💰 +${zahl(g.flat)}/Runde`);
    }
    return `<div class="werte">${teile.filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div>`;
  }
  // Die Leiste wird nur neu gebaut, wenn sich ihr Aufbau ändert. Geld, Fischzahl und Erfahrung ändern sich während
  // der Runde ständig – würde dafür jedes Mal das HTML ersetzt, ginge ein Klick zwischen Drücken und Loslassen verloren.
  let turmInfoHtml = '';
  function turmInfoBauen() {
    const t = auswahl, d = PT.def(t.typ);
    const el = $('#turmInfo');
    const held = !!PT.HELDEN[t.typ];
    const farben = ['#e2463b', '#2f7fe0', '#35b04a'];
    const tasten = [',', '.', '-'];
    const meins = spiel.darf(t, ich());
    const besitzer = spiel.koop && spiel.spielerVon(t.besitzer);
    let html = `<div class="turm-kopf" data-turm="${t.id}"><img src="${bilder[t.typ] || ''}" alt=""><div><h3>${held ? '⭐ ' : ''}${esc(d.name)}</h3><small data-wert="pops"></small>
      ${besitzer ? `<small class="besitzer" style="--f:${PT.KOOP_FARBEN[besitzer.farbe]}"><i></i>${besitzer.id === netz.id ? 'Dein Pinguin' : 'Gehört ' + esc(besitzer.name)}</small>` : ''}</div>
      <button class="lknopf schliessen" id="tiZu" aria-label="Schließen">✕</button></div>`;
    html += kennzahlenText(t);
    if (t.betaeubt > 0) html += `<p class="hinweis">${{ eis:'🧊 Vom Eisatem eingefroren.', tinte:'🦑 Voller Tinte – sieht gerade nichts.' }[t.betaeubtArt] || '💫 Von einer Flutwelle betäubt.'}</p>`;
    if (t.verdient) html += '<p class="hinweis" data-wert="verdient"></p>';
    if (!meins) {
      // Getrenntes Geld: fremde Pinguine nur anschauen
      html += `<p class="hinweis">Bei getrennter Kasse kann nur ${esc(besitzer ? besitzer.name : 'der Besitzer')} diesen Pinguin aufrüsten oder verkaufen.</p>`;
    } else {
      html += zielKnoepfe(t, d);
      if (held) {
        const S = PT.HELDEN_STUFEN;
        const preis = spiel.preisHeldenStufe(t);
        html += `<div class="held-info"><b>Stufe ${t.stufe} / 10</b>${t.stufe < 10 ? ` <small style="color:var(--panel-leise)" data-wert="xpText"></small>` : ''}
          <div class="xp"><i data-wert="xp"></i></div>
          ${t.stufe < 10 ? `<button class="kaufen" id="tiStufe" data-preis="${preis}">Stufe ${t.stufe + 1} kaufen · ${zahl(preis)} 💰</button>` : ''}
          <ul class="held-stufen">${d.stufen.map((s, i) => `<li class="${i < t.stufe ? 'da' : ''}"><b>${i + 1}</b>${esc(s)}</li>`).join('')}</ul></div>`;
      } else {
        for (let i = 0; i < 3; i++) {
          const stufe = t.pfade[i];
          const u = d.pfade[i][stufe];
          const erlaubt = spiel.upgradeErlaubt(t, i);
          const preis = u ? spiel.preisUpgrade(t, i) : 0;
          const letzte = stufe > 0 ? d.pfade[i][stufe - 1].name : 'Pfad ' + (i + 1);
          html += `<div class="pfad" style="--pf:${farben[i]}"><div class="pfad-kopf"><div class="pips">${[0, 1, 2, 3, 4].map(k => `<i class="${k < stufe ? 'an' : ''}"></i>`).join('')}</div><span>${esc(letzte)}</span></div>`;
          if (!u) html += `<button disabled class="voll"><b>✔ Voll ausgebaut</b><small>Stärker geht's nicht.</small></button>`;
          else if (spiel.stufe5Vergeben(t, i)) html += `<button disabled><b>🔒 ${esc(u.name)}</b><small>Diese Stufe 5 gibt es nur einmal – ein anderer ${esc(d.name)} hat sie schon.</small></button>`;
          else if (!erlaubt) html += `<button disabled><b>🔒 ${esc(u.name)}</b><small>Gesperrt: höchstens zwei Pfade, nur einer über Stufe 2.</small></button>`;
          else html += `<button data-pfad="${i}" data-preis="${preis}" class="${stufe === 4 ? 'fuenf' : ''}"><b>${stufe === 4 ? '✨ ' : ''}${esc(u.name)}<kbd>${tasten[i]}</kbd></b><em>${zahl(preis)} 💰</em><small>${esc(u.text)}</small></button>`;
          html += '</div>';
        }
      }
      html += `<button class="verkauf" id="tiVerkauf">Verkaufen für ${zahl(spiel.verkaufswert(t))} 💰</button>`;
    }
    if (html !== turmInfoHtml || !el.firstChild) {
      turmInfoHtml = html;
      el.innerHTML = html;
      $('#tiZu').onclick = () => turmWaehlen(null);
      if (meins) {
        $('#tiVerkauf').onclick = () => verkaufen();
        if ($('#tiZiel')) $('#tiZiel').onclick = () => { zielModus = zielModus === t ? null : t; welt.zielModus = !!zielModus; kurzTipp(zielModus ? 'Tippe auf die Stelle, die der Mörser treffen soll.' : ''); letzteAnzeige = ''; anzeigen(); };
        if ($('#tiStufe')) $('#tiStufe').onclick = () => tun({ t:'stufe', id:t.id });
        for (const b of el.querySelectorAll('[data-ziel]')) b.onclick = () => { PT.Ton.klick(); tun({ t:'ziel', id:t.id, ziel:b.dataset.ziel }); };
        for (const b of el.querySelectorAll('[data-muster]')) b.onclick = () => { PT.Ton.klick(); tun({ t:'muster', id:t.id, muster:b.dataset.muster }); };
        for (const b of el.querySelectorAll('[data-pfad]')) b.onclick = () => upgraden(+b.dataset.pfad);
      }
    }
    turmInfoWerte(t, el, held);
  }
  // Werte, die sich während der Runde laufend ändern, direkt in die bestehenden Knöpfe schreiben
  function turmInfoWerte(t, el, held) {
    const geld = meinGeld();
    const setze = (w, f) => { const x = el.querySelector(`[data-wert="${w}"]`); if (x) f(x); };
    setze('pops', x => { x.textContent = `${zahl(t.pops)} Fische erwischt`; });
    setze('verdient', x => { x.textContent = `🍤 Schon ${zahl(t.verdient)} Geld mit Fischstäbchen verdient.`; });
    if (held && t.stufe < 10) {
      const S = PT.HELDEN_STUFEN;
      const anteil = (t.xp - S[t.stufe]) / (S[t.stufe + 1] - S[t.stufe]);
      setze('xp', x => { x.style.width = Math.round(Math.max(0, Math.min(1, anteil)) * 100) + '%'; });
      setze('xpText', x => { x.textContent = `· ${zahl(t.xp)} / ${zahl(S[t.stufe + 1])} Erfahrung`; });
    } else setze('xp', x => { x.style.width = '100%'; });
    for (const b of el.querySelectorAll('[data-preis]')) {
      const zuTeuer = +b.dataset.preis > geld;
      if (b.id === 'tiStufe') b.disabled = zuTeuer;
      else { b.classList.toggle('teuer', zuTeuer); b.classList.toggle('leistbar', !zuTeuer); }
    }
  }
  function turmWaehlen(t) {
    auswahl = t;
    zielModus = null;
    if (welt) { welt.zielModus = false; welt.zielZeigen(null); if (!t) welt.reichweiteZeigen(null); }
    seiteZeigen();
    letzteAnzeige = '';
    anzeigen();
  }
  function upgraden(i) {
    if (!auswahl || PT.HELDEN[auswahl.typ] || !spiel.darf(auswahl, ich())) return;
    tun({ t:'up', id:auswahl.id, pfad:i });
  }
  function verkaufen() {
    if (!auswahl || !spiel.darf(auswahl, ich())) return;
    tun({ t:'verkauf', id:auswahl.id });
  }

  /* ---------- Vorschau auf die nächste Runde ---------- */
  let vorschauSchluessel = '', vorschauKlein = speicher.lesen('pt-vorschau-klein') === true;
  function vorschauZeigen() {
    const el = $('#vorschau');
    const zeigen = einstellung.vorschau && spiel && !spiel.laeuft && !spiel.vorbei && !spiel.unendlich && (!spiel.gewonnen || spiel.endlos) && $('#ende').hidden;
    if (!zeigen) { if (!el.hidden) el.hidden = true; return; }
    const n = spiel.runde + 1;
    const k = `${n}|${vorschauKlein}`;
    el.hidden = false;
    if (k === vorschauSchluessel) return;
    vorschauSchluessel = k;
    const r = PT.runde(n, spiel.modus, spiel.regeln && spiel.regeln.bosse, spiel.regeln && spiel.regeln.zusatz, spiel.regeln && spiel.regeln.ersetzen);
    const summe = new Map();
    for (const g of r.gruppen) {
      const sch = `${g.typ}|${g.camo ? 'c' : ''}${g.nach ? 'r' : ''}${g.fest ? 'f' : ''}`;
      const alt = summe.get(sch);
      summe.set(sch, { ...g, anzahl:(alt ? alt.anzahl : 0) + g.anzahl });
    }
    const teile = [...summe.values()].sort((a, b) => PT.FISCHE[b.typ].rbe - PT.FISCHE[a.typ].rbe).map(g => {
      const zus = (g.camo ? '👻' : '') + (g.nach ? '🌿' : '') + (g.fest ? '⛑️' : '');
      return `<span class="${PT.FISCHE[g.typ].boss ? 'boss' : ''}" title="${esc(PT.FISCHE[g.typ].name)}"><img src="${fischBilder[g.typ] || ''}" alt="${esc(PT.FISCHE[g.typ].name)}">${g.anzahl}×${zus ? `<em>${zus}</em>` : ''}</span>`;
    });
    el.classList.toggle('klein', vorschauKlein);
    el.innerHTML = `<b>🔍 Runde ${n}${r.boss ? ` · ${PT.BOSSE[r.bossTyp].symbol} Boss!` : ''}${vorschauKlein ? ' ▸' : ''}</b><div class="vf">${teile.join('')}</div>`;
  }

  // Wetter oben in der Leiste
  function wetterHud() {
    const el = $('#wetterAnzeige');
    const W = spiel && spiel.wetter && PT.WETTER[spiel.wetter];
    el.hidden = !W;
    if (W) { el.textContent = `${W.symbol} ${W.name}`; el.title = W.text; }
  }

  /* ---------- Einstellungen-Dialog ---------- */
  function einstOeffnen() {
    PT.Ton.klick();
    $('#eLaut').value = einstellung.laut;
    $('#eMusik').value = Math.round(PT.Ton.musikLaut * 100);
    $('#eGrafik').value = grafikHoch ? 'hoch' : 'schnell';
    $('#eDesign').value = einstellung.design;
    $('#eVorschau').checked = einstellung.vorschau;
    $('#eBalken').checked = einstellung.balken;
    $('#eTexte').checked = einstellung.texte;
    $('#eWackeln').checked = einstellung.wackeln;
    $('#eAuto').checked = einstellung.autoStart;
    $('#einstellungen').hidden = false;
    $('#einstZu').focus();
  }
  function einstUebernehmen() {
    einstellung.laut = +$('#eLaut').value;
    PT.Ton.musikLautstaerke(+$('#eMusik').value / 100);
    einstellung.design = $('#eDesign').value;
    einstellung.vorschau = $('#eVorschau').checked;
    einstellung.balken = $('#eBalken').checked;
    einstellung.texte = $('#eTexte').checked;
    einstellung.wackeln = $('#eWackeln').checked;
    einstellung.autoStart = $('#eAuto').checked;
    const hoch = $('#eGrafik').value === 'hoch';
    if (hoch !== grafikHoch) { grafikHoch = hoch; speicher.schreiben('pt-grafik', grafikHoch); if (welt) welt.grafik(grafikHoch); }
    speicher.schreiben('pt-einst', einstellung);
    einstAnwenden();
    vorschauSchluessel = '';
  }

  /* ---------- Fähigkeiten ---------- */
  let fkSchluessel = '';
  function faehigkeitenZeigen() {
    const liste = spiel.faehigkeitenListe(ich());
    const s = liste.map(f => f.id + f.anzahl).join();
    const el = $('#faehigkeiten');
    if (s !== fkSchluessel) {
      fkSchluessel = s;
      el.innerHTML = liste.map((f, i) => `<button class="fk" data-fk="${f.id}" title="${esc(f.name)}: ${esc(f.text)}"><kbd>${i + 1}</kbd>${f.symbol}${f.anzahl > 1 ? `<span class="anz">×${f.anzahl}</span>` : ''}</button>`).join('');
      for (const b of el.querySelectorAll('[data-fk]')) b.onclick = () => faehigkeit(b.dataset.fk);
    }
    for (const f of liste) {
      const b = el.querySelector(`[data-fk="${f.id}"]`);
      if (!b) continue;
      b.style.setProperty('--rest', f.bereit ? 0 : Math.min(1, f.rest / f.cd).toFixed(3));
      b.classList.toggle('bereit', f.bereit);
    }
  }
  function faehigkeit(id) {
    PT.Ton.start();
    tun({ t:'fk', fk:id });
  }

  /* ---------- Knöpfe ---------- */
  function startKnopf() {
    PT.Ton.start();
    if (!spiel || spiel.vorbei) return;
    if (spiel.laeuft) {
      tempo = tempo >= 3 ? 1 : tempo + 1;
      if (imKoop()) senden({ t:'tempo', tempo });
      letzteAnzeige = ''; anzeigen(); return;
    }
    rundeStarten();
  }
  function rundeStarten() {
    tun({ t:'start', runde:spiel.runde + 1 });
  }
  // Im Koop hält die Pause das Spiel für alle an; "nurZeigen" kommt vom Server
  function pause(an, nurZeigen) {
    if (imKoop() && !nurZeigen) { senden({ t:'pause', an }); if (an) return; }
    pausiert = an;
    $('#pause').hidden = !an;
    $('#pTon').textContent = PT.Ton.an ? '🔊 Ton an' : '🔇 Ton aus';
    $('#pGrafik').textContent = grafikHoch ? '✨ Grafik: hoch' : '⚡ Grafik: schnell';
    $('#pNeu').hidden = !!olymp || imKoop();
    $('#pMenue').hidden = !!olymp;
    $('#pAufgeben').hidden = !olymp;
    if (an) $('#pWeiter').focus();
  }

  /* ---------- Eingabe auf der Karte (mit Zoom und Verschieben) ---------- */
  function turmBei(x, y) {
    let best = null, bd = Infinity;
    for (const t of spiel.tuerme) {
      const tx = t.eff && t.eff.flieger ? t.x : t.x, ty = t.y;
      const d = Math.hypot(tx - x, ty - y);
      if (d < PT.turmRadius(t.typ) + 10 && d < bd) { bd = d; best = t; }
      if (t.eff && t.eff.flieger) {
        const df = Math.hypot(t.fx - x, t.fy - y);
        if (df < 40 && df < bd) { bd = df; best = t; }
      }
    }
    return best;
  }
  function vorschau() {
    if (zielModus && zeiger) { welt.zielZeigen(zeiger[0], zeiger[1], zielModus.eff.angriffe[0].splash); return; }
    if (!bauTyp || !zeiger) { welt.geistZeigen(null); if (!auswahl) welt.reichweiteZeigen(null); return; }
    const [x, y] = zeiger;
    const ok = spiel.platzFrei(bauTyp, x, y) && spiel.preisBau(bauTyp, x, y) <= meinGeld();
    const w = PT.werteFuer(bauTyp, [0, 0, 0]);
    welt.geistZeigen(bauTyp, x, y, ok);
    welt.reichweiteZeigen(x, y, w.reichweite > 5000 ? 60 : w.reichweite || 40, ok);
  }
  const zeigerListe = new Map();
  let gedrueckt = null, zwei = null;
  function zeigerAus(e) { return welt ? welt.bodenPunkt(e.clientX, e.clientY) : null; }
  function zeigerRunter(e) {
    PT.Ton.start();
    zeigerListe.set(e.pointerId, { x:e.clientX, y:e.clientY });
    $('#welt').setPointerCapture(e.pointerId);
    if (zeigerListe.size === 2) {
      // zweiter Finger: Zoom und Verschieben statt Bauen
      const [a, b] = [...zeigerListe.values()];
      zwei = { d:Math.hypot(a.x - b.x, a.y - b.y), mx:(a.x + b.x) / 2, my:(a.y + b.y) / 2 };
      gedrueckt = null;
      return;
    }
    gedrueckt = { x:e.clientX, y:e.clientY, knopf:e.button, verschoben:false, art:e.pointerType };
    zeiger = zeigerAus(e);
    if (bauTyp) vorschau();
  }
  function zeigerBewegt(e) {
    if (!spiel || !welt) return;
    const p = zeigerListe.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (zwei && zeigerListe.size >= 2) {
      const [a, b] = [...zeigerListe.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      welt.zoomen(d / Math.max(1, zwei.d), mx, my);
      welt.schwenken(mx - zwei.mx, my - zwei.my);
      zwei = { d, mx, my };
      return;
    }
    zeiger = zeigerAus(e);
    if (gedrueckt && !bauTyp && !zielModus) {
      // Ziehen auf freier Fläche verschiebt die Karte (rechte Maustaste immer)
      const dx = e.clientX - gedrueckt.x, dy = e.clientY - gedrueckt.y;
      if (gedrueckt.verschoben || Math.hypot(dx, dy) > 8) {
        if (welt.zoom > 1.01 || gedrueckt.knopf === 2) welt.schwenken(dx, dy);
        gedrueckt.verschoben = true;
        gedrueckt.x = e.clientX; gedrueckt.y = e.clientY;
      }
      return;
    }
    if ((bauTyp || zielModus) && (e.pointerType === 'mouse' || gedrueckt)) vorschau();
  }
  function zeigerHoch(e) {
    zeigerListe.delete(e.pointerId);
    if (zwei) { if (zeigerListe.size < 2) zwei = null; gedrueckt = null; return; }
    const g = gedrueckt;
    gedrueckt = null;
    if (!g || g.verschoben || g.knopf === 2) return;
    zeiger = zeigerAus(e);
    if (!zeiger) return;
    const [x, y] = zeiger;
    if (tagebuchSeite && Math.hypot(x - tagebuchSeite.x, y - tagebuchSeite.y) < 50) { tagebuchSammeln(); return; }
    if (zielModus) {
      tun({ t:'zielpunkt', id:zielModus.id, x:Math.round(x), y:Math.round(y) });
      zielModus = null; welt.zielModus = false;
      PT.Ton.klick(); tipp('');
      letzteAnzeige = ''; anzeigen();
      return;
    }
    if (bauTyp) {
      const ok = spiel.platzFrei(bauTyp, x, y) && spiel.preisBau(bauTyp, x, y) <= meinGeld();
      tun({ t:'bau', typ:bauTyp, x:Math.round(x * 100) / 100, y:Math.round(y * 100) / 100, weiter:e.shiftKey && !PT.HELDEN[bauTyp] });
      if (!ok && e.pointerType !== 'mouse' && bauTyp) vorschau();
      return;
    }
    const t = turmBei(x, y);
    turmWaehlen(t);
    if (t) PT.Ton.klick();
  }
  function rad(e) {
    if (!welt || !spiel) return;
    e.preventDefault();
    welt.zoomen(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
  }
  function tasten(e) {
    if (szeneAktiv) {
      if (e.key === 'Escape') { e.preventDefault(); szeneAktiv.schluss(); }
      else if ([' ', 'Enter', 'ArrowRight'].includes(e.key)) { e.preventDefault(); szeneAktiv.weiter(); }
      return;
    }
    if (e.key === 'Escape' && !$('#einstellungen').hidden) { e.preventDefault(); $('#einstZu').click(); return; }
    if (e.key === 'Escape' && !$('#tagebuchDialog').hidden) { e.preventDefault(); $('#tagebuchDialog').hidden = true; return; }
    if (e.key === 'Escape' && !$('#levelDialog').hidden) { e.preventDefault(); $('#levelZu').click(); return; }
    if (e.key === 'Escape' && !$('#kisteDialog').hidden) { e.preventDefault(); $('#kisteZu').click(); return; }
    if (!spiel || $('#spiel').hidden) return;
    if (!$('#ende').hidden) return;
    if (!$('#einstellungen').hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (zielModus) { zielModus = null; welt.zielModus = false; welt.zielZeigen(null); tipp(''); }
      else if (bauTyp) bauWaehlen(null);
      else if (auswahl) turmWaehlen(null);
      else pause(!pausiert);
      return;
    }
    if (pausiert) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (!$('#ende').hidden) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) {
      const f = spiel.faehigkeitenListe(ich())[n - 1];
      if (f) { e.preventDefault(); faehigkeit(f.id); }
      return;
    }
    const held = spiel.heldVon(ich());
    if (k === 'h' && held && !spiel.heldDa(ich())) { bauWaehlen(held); if (zeiger) vorschau(); return; }
    const typ = PT.PINGUIN_REIHE.find(t => PT.PINGUINE[t].taste === k || (k === 'y' && PT.PINGUINE[t].taste === 'z'));
    if (typ && spiel.erlaubt(typ, ich())) { bauWaehlen(typ); if (zeiger) vorschau(); return; }
    if (e.key === ' ') { e.preventDefault(); startKnopf(); return; }
    if (auswahl) {
      const i = [',', '.', '-'].indexOf(e.key);
      const j = i >= 0 ? i : ['/', '#'].indexOf(e.key) >= 0 ? 2 : -1;
      if (j >= 0) { e.preventDefault(); upgraden(j); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); verkaufen(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        const d = PT.def(auswahl.typ);
        if (auswahl.eff.flieger) {
          const ids = PT.MUSTER.map(z => z[0]);
          tun({ t:'muster', id:auswahl.id, muster:ids[(ids.indexOf(auswahl.muster) + 1) % ids.length] });
        } else if (d.greift !== false && auswahl.typ !== 'moerser') {
          const ids = (d.ziele || PT.ZIELE).map(z => z[0]);
          tun({ t:'ziel', id:auswahl.id, ziel:ids[(ids.indexOf(auswahl.ziel) + (e.shiftKey ? ids.length - 1 : 1)) % ids.length] });
        }
      }
    }
  }

  /* ---------- Ereignisse der Logik ---------- */
  function ereignisse(liste) {
    for (const e of liste) {
      if (e.art === 'rundeStart') {
        if (e.boss) banner(`${PT.BOSSE[e.bossTyp].symbol} ${PT.FISCHE[e.bossTyp].name} ist da!`, e.boss === 1 ? 'Boss Stufe 1 – lass ihn nicht durch!' : 'Boss Stufe 2 – das große Finale!', 3);
        else if (e.wetter && PT.WETTER[e.wetter]) banner(`${PT.WETTER[e.wetter].symbol} ${PT.WETTER[e.wetter].name}!`, PT.WETTER[e.wetter].text, 3);
        else banner(`Runde ${e.runde}`, rundenHinweis(e.runde));
        wetterHud();
      }
      if (e.art === 'finsternis') {
        kurzTipp(e.tiefe ? '🌑 Die Tiefe verschluckt das Licht! Nur Pinguine mit Nachtsicht sehen jetzt die Fische.'
          : e.typ === 'zerbrochen' ? '💔 Pako löscht das Licht! Nur Pinguine mit Nachtsicht sehen jetzt die Fische.'
          : vs && !e.typ ? '🏮 Finsternis vom Gegner! Nur Pinguine mit Nachtsicht sehen jetzt die Fische.' : '🏮 Abyssos löscht das Licht! Nur Pinguine mit Nachtsicht sehen jetzt die Fische.');
        funk('dunkel');
      }
      if (e.art === 'rundeStart') { funk('r' + e.runde); if (e.boss) { funk('boss'); if (kampagneAktiv) PT.Ton.musik('boss'); } }
      if (e.art === 'bossPhase') funk('phase' + e.phase);
      if (e.art === 'zweitePhase') {
        const zt = (kampagneAktiv && PT.LEVEL(kampagneAktiv).zweiteText) || ['💔 Pako, der Zerbrochene', 'Abyssos steht wieder auf – stärker als zuvor!'];
        banner(zt[0], zt[1], 3.5); funk('zweite');
      }
      if (e.art === 'bossBesiegt' && kampagneAktiv && !spiel.fische.some(f => f.boss && !f.tot)) PT.Ton.musik(PT.KAPITEL_VON(PT.LEVEL(kampagneAktiv).kapitel).stimmung);
      if (e.art === 'wegOffen') { banner('⚠️ Überfall!', 'Ein neuer Kanal ist offen – sie kommen von der Seite!', 3); funk('weg', true); }
      if (e.art === 'sabotiert' && e.anzahl) { banner('💥 Sabotage!', `${e.anzahl} deiner teuersten Pinguine sind zerstört. Die Hälfte des Geldes gibt es zurück.`, 3.5); funk('sabotiert'); }
      if (e.art === 'heldGefallen') {
        const ht = kampagneAktiv && PT.LEVEL(kampagneAktiv).heldText;
        if (ht) banner(ht[0], ht[1], 4.5);
        else banner(`🗿 ${e.typ ? PT.HELDEN[e.typ].name : 'Dein Held'} ist gefallen`, 'Aus Wut greifen deine Pinguine eine Weile schneller an!', 4);
        funk('gefallen');
      }
      if (e.art === 'wegWechsel') { if (!funkGespielt.has('ader!')) { funkGespielt.add('ader!'); kurzTipp('🫀 Eine Ader ruht diese Runde – nur die anderen pumpen Fische. Jede Runde eine andere!'); } funk('ader'); }
      if (e.art === 'verbuendet' && !funkGespielt.has('verbuendet')) { funkGespielt.add('verbuendet'); kurzTipp('🦈 Verbündete! Orkas Haie schwimmen gegen den Strom und rammen die Fische.'); }
      if (e.art === 'blenden' && spiel.tuerme.some(t => t.betaeubtArt === 'licht' && t.betaeubt > 0 && (!spiel.koop || t.besitzer === ich()))) { kurzTipp('🔆 Geblendet! Pinguine in der Nähe sehen kurz nichts.'); funk('blenden'); }
      if (e.art === 'rundeStart' && kampagneAktiv && !spiel.koop) tagebuchPruefen(e.runde);
      if (e.art === 'einsturzWarnung') { kurzTipp('🧊 Achtung: Nach dieser Runde bricht die rot blinkende Eisfläche weg! Was dort steht, ist verloren (ein Viertel gibt es zurück).'); funk('einsturz'); }
      if (e.art === 'eingestuerzt') letzteAnzeige = '';
      if (e.art === 'frostbefehl' && spiel.tuerme.some(t => t.betaeubtArt === 'eis' && t.betaeubt > 0 && (!spiel.koop || t.besitzer === ich()))) kurzTipp('❄️ Frostbefehl! Deine wertvollsten Pinguine sind eingefroren.');
      if (e.art === 'leck' && spiel.leben < spiel.startLeben / 2) funk('knapp');
      if (e.art === 'rundeEnde') {
        const n = e.runde + 1;
        const boss = PT.bossFuer(spiel.modus);
        const bossRunde = boss && Object.keys(PT.BOSSE[boss].runden).map(Number).find(r => r >= n && r - n <= 2);
        if (bossRunde) { const k = bossRunde - n + 1; banner(`Runde ${e.runde} geschafft!`, `${PT.FISCHE[boss].name} kommt in ${k} ${k === 1 ? 'Runde' : 'Runden'} – stell auf „Stärkster“!`, 2.6); }
        else banner(`Runde ${e.runde} geschafft!`, `+${zahl(e.bonus)} 💰`);
        xpDazu(PT.passXpRunde(e.runde, spiel.stufe));
        fortschrittMelden('runde');
        speichern();
        if (!spiel.koop && $('#auto').checked && !spiel.gewonnen && spiel.modus !== 'flut') autoWarte = 1.2;
        if (olymp && spiel.runde >= spiel.zielRunden) olympFertig();
      }
      if (e.art === 'aufstieg') banner(`⭐ ${PT.HELDEN[e.turm.typ].name}`, `Stufe ${e.stufe}: ${PT.HELDEN[e.turm.typ].stufen[e.stufe - 1]}`, 2.2);
      if (e.art === 'bossPhase') banner(`${PT.FISCHE[e.fisch.typ].name} ruft Verstärkung!`, `${4 - e.phase} von 4 Lebensbalken übrig`, 1.8);
      if (e.art === 'flutwelle' && spiel.tuerme.some(t => t.betaeubt > 0 && (!spiel.koop || t.besitzer === ich()))) kurzTipp('🌊 Flutwelle! Deine Pinguine am Ufer sind kurz betäubt.');
      if (e.art === 'eisatem' && spiel.tuerme.some(t => t.betaeubtArt === 'eis' && (!spiel.koop || t.besitzer === ich()))) kurzTipp('❄️ Eisatem! Pinguine am Ufer sind eingefroren.');
      if (e.art === 'schmelzWarnung') kurzTipp('💧 Achtung: Nach der nächsten Runde schmilzt eine Eisfläche (blau gestrichelt). Wer dort steht, bekommt sein Geld zurück.');
      if (e.art === 'geschmolzen') { kurzTipp('💧 Eine Eisfläche ist geschmolzen – jetzt dürfen dort Boote hin.'); letzteAnzeige = ''; }
      if (e.art === 'bossBesiegt') {
        const B = PT.BOSSE[e.typ] || PT.BOSSE.krakus;
        banner(`${B.symbol} ${PT.FISCHE[e.typ].name} besiegt!`, `+${zahl(B.belohnung * (spiel.modus === 'halb' ? 0.5 : 1))} 💰`, 2.5);
        xpDazu(PT.PASS_XP_BOSS);
      }
      if (e.art === 'gewonnen') {
        xpDazu(PT.passXpSieg(spiel.stufe));
        if (!olymp && !spiel.unendlich) {
          muenzenDazu(PT.MUENZEN_SIEG[spiel.stufe] || 8);
          // Tages-Herausforderung geschafft (einmal pro Tag mit Belohnung)
          if (tagesAktiv && !fort.tage[tagesAktiv]) {
            const h = PT.tagesHerausforderung(tagesAktiv);
            fort.tage[tagesAktiv] = true; fort.lebenslang.tage++; fortMerken();
            xpDazu(h.xp); muenzenDazu(h.muenzen);
          }
          fortschrittMelden('sieg');
        }
        if (!olymp) endeZeigen(true);
      }
      if (e.art === 'verloren' && vs) continue;
      if (e.art === 'verloren') {
        speicher.weg('pt-stand');
        fortschrittMelden('verloren');
        if (olymp) olympFertig(); else endeZeigen(false);
      }
    }
  }
  function rundenHinweis(n) {
    const r = PT.runde(n, spiel.modus, spiel.regeln && spiel.regeln.bosse, spiel.regeln && spiel.regeln.zusatz, spiel.regeln && spiel.regeln.ersetzen);
    const typen = [...new Set(r.gruppen.map(g => g.typ))];
    const neu = { 17:'Nachwachsende Fische! Grüne Algen = sie wachsen nach.', 20:'Anglerfische! Explosionen helfen nicht.', 22:'Eisfische! Kälte hilft nicht.', 24:'Getarnte Fische!',
      26:'Zebrafische!', 28:'Panzerwelse! Spitzes prallt ab.', 38:'Kofferfische!', 40:'Ein Walhai!', 46:'Gepanzerte Fische mit Helm!', 55:'Der Megalodon kommt!', 60:'Ein Schattenrochen! Er taucht nur kurz auf – mit Nachtsicht trifft man ihn immer.', 65:'Die Riesenkrake!',
      21:'Fliegende Fische! In der Luft treffen sie nur Flieger.', 31:'Tintenfische! Ihre Tinte blendet Pinguine.', 42:'Kugelfische! Nach einem Treffer prallt kurz alles ab.' }[n];
    if (neu) return neu;
    return typen.map(t => PT.FISCHE[t].name).join(' · ');
  }
  function speichern() {
    if (!spiel || spiel.vorbei || spiel.modus === 'sandkasten' || spiel.koop) return;
    if (olymp) speicher.schreiben('pt-olymp-stand-' + olymp.info.lauf, spiel.speichern(), sessionStorage);
    else speicher.schreiben('pt-stand', { ...spiel.speichern(), tag:tagesAktiv, level:kampagneAktiv });
  }

  let endeArt = null, endeSzene = false, kampagneErgebnis = null;
  function endeZeigen(gewonnen) {
    // Abenteuer: erst Sterne sichern, dann die Szene nach dem Level (im Finale: Ende, Abspann, das Auge)
    if (gewonnen && kampagneAktiv && !spiel.koop && !endeSzene) {
      endeSzene = true;
      const l = PT.LEVEL(kampagneAktiv);
      kampagneErgebnis = levelGewonnen();
      pausiert = true;
      (async () => {
        if (l && (l.nachher || []).length) await szeneSpielen(l.nachher, { imSpiel:true });
        if (l && l.finale) {
          const t = PT.teilVon(l);
          await szeneSpielen(t.ende, { stimmung:t.endeStimmung });
          await abspannSpielen(t.abspann);
          await szeneSpielen(t.nachAbspann, { auge:2, stimmung:t.nachStimmung });
          await szeneSpielen([], { karte:t.schluss });
        }
        endeZeigen(true);
      })();
      return;
    }
    const k = $('#endeKnoepfe');
    $('#ende').hidden = false;
    endeArt = gewonnen ? 'gewonnen' : 'verloren';
    if (gewonnen && welt) welt.tanzStarten(pass.tanz);
    if (spiel.koop) return koopEnde(gewonnen);
    pausiert = true;
    if (gewonnen) {
      const st = PT.STUFEN[spiel.stufe];
      const schluessel = `${spiel.karte}|${spiel.stufe}|${spiel.modus}`;
      const zaehlt = spiel.modus !== 'sandkasten' && spiel.karte !== 'eigen' && !tagesAktiv && !kampagneAktiv;
      const neu = !medaillen[schluessel] && zaehlt;
      if (zaehlt) { medaillen[schluessel] = true; speicher.schreiben('pt-medaillen', medaillen); }
      if (spiel.modus === 'standard' || spiel.modus === 'sandkasten' || !zaehlt) $('#endeEmoji').textContent = spiel.modus === 'standard' ? st.medaille : '🏆';
      else $('#endeEmoji').innerHTML = modusMuenze(spiel.karte, spiel.modus, true);
      $('#endeTitel').textContent = 'Gewonnen!';
      $('#endeText').textContent = `${tagesAktiv ? 'Tages-Herausforderung geschafft! ' : ''}Alle ${spiel.zielRunden} Runden auf ${spiel.kartenDaten.name} (${st.name}${spiel.modus !== 'standard' ? ', ' + PT.MODI[spiel.modus].name : ''}) mit ${Math.ceil(spiel.leben)} Leben übrig.${neu ? ' Neue Medaille!' : ''}`;
      k.innerHTML = '<button class="knopf haupt" id="eEndlos">Endlos weiterspielen</button><button class="knopf" id="eNeu">Nochmal</button><button class="knopf" id="eMenue">Hauptmenü</button>';
      $('#eEndlos').onclick = () => { spiel.endlos = true; $('#ende').hidden = true; pausiert = false; speichern(); letzteAnzeige = ''; anzeigen(); };
      // Abenteuer: Sterne statt Medaille, weiter zum nächsten Level
      if (kampagneAktiv) {
        const l = PT.LEVEL(kampagneAktiv), erg = kampagneErgebnis || levelGewonnen();
        if (l && erg) {
          const i = PT.LEVELS.indexOf(l), naechstes = PT.LEVELS[i + 1];
          $('#endeEmoji').textContent = erg.neu.map(x => (x ? '⭐' : '☆')).join('');
          $('#endeTitel').textContent = l.finale ? PT.teilVon(l).endeTitel : 'Level geschafft!';
          $('#endeText').textContent = l.finale ? PT.teilVon(l).endeText : [`${l.name}: ${erg.neu.filter(Boolean).length} von 3 Sternen.`,
            ...l.sterne.map((a, n) => `${erg.neu[n + 1] ? '✅' : '❌'} ${PT.sternAufgabe(a)}`)].join(' ');
          k.innerHTML = (naechstes ? '<button class="knopf haupt" id="eWeiterLevel">Nächstes Level ▶</button>' : '') + (l.finale ? '<button class="knopf haupt" id="eDorf">🏘️ Zum Pingu-Dorf</button>' : '')
            + '<button class="knopf" id="eNeu">Nochmal</button><button class="knopf" id="eMenue">Zum Abenteuer</button>';
          if ($('#eWeiterLevel')) $('#eWeiterLevel').onclick = () => { $('#ende').hidden = true; zumMenue(); levelOeffnen(naechstes.id); };
          if ($('#eDorf')) $('#eDorf').onclick = () => { zumMenue(); abenteuerReiter = false; dorfReiter = true; menueBauen(); };
        }
      }
    } else {
      $('#endeEmoji').textContent = '🐟';
      $('#endeTitel').textContent = endeTitel();
      $('#endeText').textContent = `Du hast ${spiel.runde} ${spiel.runde === 1 ? 'Runde' : 'Runden'} geschafft.`;
      k.innerHTML = '<button class="knopf haupt" id="eNeu">Nochmal</button><button class="knopf" id="eMenue">Hauptmenü</button>';
    }
    if (gewonnen) erfolgeCheck(true, true);
    statistikZeigen();
    $('#eNeu').onclick = () => {
      if (tagesAktiv) { tagesStarten(); return; }
      if (kampagneAktiv) { levelStarten(kampagneAktiv); return; }
      wahl = { ...wahl, karte:spiel.karte === 'eigen' ? wahl.karte : spiel.karte, stufe:spiel.stufe, modus:spiel.modus, held:spiel.held }; neuesSpiel();
    };
    $('#eMenue').onclick = zumMenue;
  }
  // Statistik fürs Ergebnisbild: Zahlen, die besten Pinguine und was das Spiel gebracht hat
  function statistikZeigen() {
    const st = spiel.statistik;
    const zeit = Math.round(st.zeit || 0), min = Math.floor(zeit / 60), sek = String(zeit % 60).padStart(2, '0');
    const top = spiel.tuerme.filter(t => t.pops > 0).sort((a, b) => b.pops - a.pops).slice(0, 4);
    const zahlen = [['🐟', zahl(st.platzer), 'Fische erwischt'], ['💰', zahl(st.verdient), 'Geld verdient'], ['⏱', `${min}:${sek}`, 'Spielzeit'],
      ['🌊', spiel.runde, 'Runden'], ['💥', zahl(st.geleakt >= 1e6 ? 0 : st.geleakt), 'Leben verloren'], ['⚡', zahl(st.faehigkeiten || 0), 'Fähigkeiten']];
    let html = `<div class="stat-zahlen">${zahlen.map(([sy, w, t]) => `<div><b>${sy} ${w}</b>${t}</div>`).join('')}</div>`;
    if (top.length) html += `<ul class="stat-top">${top.map((t, i) => `<li><span>${['🥇', '🥈', '🥉', '4.'][i]}</span><img src="${bilder[t.typ] || ''}" alt=""><span>${esc(PT.def(t.typ).name)}${t.pfade && t.pfade.some(x => x) ? ` <small>${t.pfade.join('-')}</small>` : ''}</span><em>${zahl(t.pops)}</em></li>`).join('')}</ul>`;
    const lohn = [];
    if (spielLohn.xp) lohn.push(`🎖️ +${zahl(spielLohn.xp)} Pass-Erfahrung`);
    if (spielLohn.muenzen) lohn.push(`🪙 +${spielLohn.muenzen} Fischmünzen`);
    for (const e of spielLohn.erfolge) lohn.push(`🏆 ${e.name}`);
    if (lohn.length) html += `<p class="stat-lohn">${lohn.map(esc).join(' · ')}</p>`;
    $('#endeStatistik').innerHTML = html;
  }
  function endeTitel() {
    const boss = PT.bossFuer(spiel.modus);
    return boss && spiel.leben <= 0 && spiel.statistik.geleakt >= 1e6 ? `${PT.FISCHE[boss].name} ist entkommen!` : 'Die Fische sind durch!';
  }
  // Koop: Das Spiel läuft beim Server weiter; der Gastgeber holt alle zurück in die Lobby
  function koopEnde(gewonnen) {
    const k = $('#endeKnoepfe');
    const namen = spiel.spieler.map(x => x.name).join(', ');
    if (gewonnen) {
      const schluessel = `${spiel.karte}|${spiel.stufe}|${spiel.modus}`;
      if (spiel.modus !== 'sandkasten') { medaillen[schluessel] = true; speicher.schreiben('pt-medaillen', medaillen); }
      $('#endeEmoji').textContent = '🏆';
      $('#endeTitel').textContent = 'Gemeinsam gewonnen!';
      $('#endeText').textContent = `${namen}: alle ${spiel.zielRunden} Runden auf ${spiel.kartenDaten.name} mit ${Math.ceil(spiel.leben)} Leben übrig.`;
    } else {
      $('#endeEmoji').textContent = '🐟';
      $('#endeTitel').textContent = endeTitel();
      $('#endeText').textContent = `Ihr habt ${spiel.runde} ${spiel.runde === 1 ? 'Runde' : 'Runden'} geschafft.`;
    }
    statistikZeigen();
    k.innerHTML = (gewonnen ? '<button class="knopf haupt" id="eEndlos">Endlos weiterspielen</button>' : '')
      + (binHost() ? '<button class="knopf" id="eLobby">Zurück in die Lobby</button>' : '<p>Der Gastgeber kann alle zurück in die Lobby holen.</p>')
      + '<button class="knopf" id="eRaus">Raum verlassen</button>';
    if ($('#eEndlos')) $('#eEndlos').onclick = () => { tun({ t:'endlos' }); $('#ende').hidden = true; endeArt = null; };
    if ($('#eLobby')) $('#eLobby').onclick = () => senden({ t:'nochmal' });
    $('#eRaus').onclick = koopVerlassen;
  }

  /* ---------- Olympiade ---------- */
  async function olympMelden(aktion, extra = {}) {
    try {
      const res = await fetch('/api/olymp', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ ticket:olymp.ticket, aktion, ...extra })
      });
      return await res.json();
    } catch (e) { return null; }
  }
  async function olympStart(ticket) {
    olymp = { ticket };
    $('#normalMenue').hidden = true;
    $('#olympBox').hidden = false;
    $('#olympText').textContent = 'Ticket wird geprüft …';
    $('#los').disabled = true;
    $('#los').textContent = 'Disziplin starten';
    heldenBauen();
    let d = null;
    for (let i = 0; i < 3 && !d; i++) { d = await olympMelden('info'); if (!d) await new Promise(ok => setTimeout(ok, 1500)); }
    if (!d || !d.ok) {
      $('#olympText').textContent = (d && d.fehler) || 'Das Olympia-Ticket ist ungültig oder abgelaufen. Hol dir in der Olympiade ein neues.';
      $('#heldBereich').hidden = true;
      olymp = null;
      return;
    }
    olymp.info = d.info;
    olymp.einst = d.einst;
    $('#olympTitel').textContent = `${d.info.titel} · Disziplin ${d.info.nr} von ${d.info.von}`;
    const k = PT.KARTEN[d.einst.karte], st = PT.STUFEN[d.einst.stufe];
    $('#olympEinst').innerHTML = `<li>Karte: <b>${esc(k.name)}</b></li><li>Schwierigkeit: <b>${esc(st.name)}</b> (${st.leben} Leben)</li><li>Ziel: <b>${d.einst.runden} Runden</b></li>`;
    if (d.ergebnis) {
      $('#olympText').textContent = `Hallo ${d.info.name}! Du hast diese Disziplin schon gespielt: ${d.ergebnis}.`;
      $('#heldBereich').hidden = true;
      $('#los').textContent = 'Zurück zur Olympiade';
      $('#los').disabled = false;
      $('#los').onclick = () => { location.href = d.info.zurueck || '/'; };
      return;
    }
    $('#olympText').textContent = `Hallo ${d.info.name}! Du hast einen Versuch: Überleb so viele Runden wie möglich. Wer weiter kommt, gewinnt – bei Gleichstand zählen die übrigen Leben. Such dir deinen Helden aus:`;
    $('#los').disabled = false;
    $('#los').onclick = () => {
      PT.Ton.start();
      const alt = speicher.lesen('pt-olymp-stand-' + olymp.info.lauf, sessionStorage);
      const s = alt ? PT.Spiel.laden(alt) : new PT.Spiel({ karte:d.einst.karte, stufe:d.einst.stufe, runden:d.einst.runden, held:wahl.held, kraft:false, seed:12345 });
      spielStarten(s);
      olympMelden('da');
    };
  }
  let olympGemeldet = false;
  async function olympFertig() {
    if (olympGemeldet || !olymp) return;
    olympGemeldet = true;
    pausiert = true;
    const runden = spiel.runde, leben = Math.max(0, Math.ceil(spiel.leben)), alle = runden >= spiel.zielRunden;
    $('#ende').hidden = false;
    $('#pause').hidden = true;
    $('#endeEmoji').textContent = alle ? '🏅' : '🐟';
    $('#endeTitel').textContent = alle ? 'Alle Runden geschafft!' : `Runde ${runden} geschafft`;
    $('#endeText').textContent = 'Ergebnis wird an die Olympiade gemeldet …';
    $('#endeKnoepfe').innerHTML = `<a class="knopf haupt" style="display:block;text-decoration:none" href="${esc(olymp.info.zurueck || '/')}">Zurück zur Olympiade</a>`;
    speicher.weg('pt-olymp-stand-' + olymp.info.lauf, sessionStorage);
    const d = await olympMelden('ergebnis', { runden, leben });
    $('#endeText').textContent = d && d.ok ? `Gemeldet: ${d.text}.` : 'Das Ergebnis konnte nicht gemeldet werden. Sag der Spielleitung Bescheid.';
  }

  /* ---------- Hauptschleife ---------- */
  function schleife(jetzt) {
    requestAnimationFrame(schleife);
    const dt = Math.min(0.1, (jetzt - (letzte || jetzt)) / 1000);
    letzte = jetzt;
    if (!spiel || !welt || $('#spiel').hidden) return;
    const koopPause = imKoop() && !!(netz.raum && netz.raum.pause);
    if (imKoop()) {
      koopRechnen(dt);
      // ein anderer Spieler hat "Endlos weiter" gedrückt
      if (endeArt === 'gewonnen' && spiel.endlos) { $('#ende').hidden = true; endeArt = null; }
    } else if (!pausiert) {
      zeitRest += dt * (spiel.laeuft ? tempo : 1);
      let n = 0;
      while (zeitRest >= 1 / 60 && n < 12) { spiel.schritt(1 / 60); zeitRest -= 1 / 60; n++; }
      if (n >= 12) zeitRest = 0;
      if (spiel.unendlich) { spiel.geld = 999999; spiel.leben = Math.max(spiel.leben, 999999); }
      if (autoWarte > 0) { autoWarte -= dt; if (autoWarte <= 0 && !spiel.laeuft && !spiel.vorbei) rundeStarten(); }
    }
    if (vs) { for (const m of vs.meldungen.splice(0)) vsMeldung(m); vsZeigen(dt); }
    funkZeigen();
    if (tagebuchSeite && spiel && spiel.zeit > tagebuchSeite.bis) { if (welt) welt.tagebuchWeg(false); tagebuchSeite = null; }
    const ev = spiel.ereignisse.splice(0);
    if (ev.length) { welt.ereignisse(ev); PT.Ton.ereignisse(ev); ereignisse(ev); }
    if (auswahl && !spiel.tuerme.includes(auswahl)) turmWaehlen(null);
    welt.zeichnen(spiel, (imKoop() ? koopPause : pausiert) && !welt.tanz ? 0 : dt, auswahl);
    if (bannerZeit > 0) { bannerZeit -= dt; if (bannerZeit <= 0) $('#banner').classList.remove('an'); }
    if (tippZeit > 0) { tippZeit -= dt; if (tippZeit <= 0) tipp(''); }
    faehigkeitenZeigen();
    vorschauZeigen();
    anzeigen();
  }

  // Tägliche Login-Belohnung: Erfahrung, Münzen, jeden 7. Tag in Folge eine Silberkiste
  function loginBelohnung() {
    const heute = PT.heute(), gestern = PT.heute(new Date(Date.now() - 86400000));
    const L = fort.login || { datum:null, serie:0 };
    if (L.datum === heute) return;
    L.serie = L.datum === gestern ? L.serie + 1 : 1;
    L.datum = heute;
    fort.login = L;
    const b = PT.loginBelohnung(L.serie);
    fort.muenzen += b.muenzen;
    if (b.kiste) fort.kisten[b.kiste] = (fort.kisten[b.kiste] || 0) + 1;
    fortMerken();
    xpDazu(b.xp, true);
    setTimeout(() => banner(`🎁 Täglicher Bonus · Tag ${L.serie}`, `+${b.xp} Erfahrung · +${b.muenzen} 🪙${b.kiste ? ' · Silberkiste!' : ''}`, 3.5), 600);
  }
  // Das alte Abenteuer (k1-1 …) gibt es nicht mehr: einmal gegen eine Goldkiste und Eiskristalle tauschen
  function altesAbenteuerTauschen() {
    const n = PT.alteSterne(fort.kampagne);
    if (!n) return;
    for (const id of Object.keys(fort.kampagne)) if (/^k\d-\d$/.test(id)) delete fort.kampagne[id];
    fort.kampagneAlt = { sterne:n };
    fort.kisten.gold = (fort.kisten.gold || 0) + 1;
    fort.dorf.kristalle += 10 + n;
    fortMerken();
  }

  /* ---------- Los ---------- */
  function init() {
    try {
      bilderMalen(true);
    } catch (e) {
      console.error(e);
      document.body.innerHTML = '<p style="padding:24px;font-size:1.2rem">Dein Browser kann leider kein WebGL (3D). Probier es mit einem aktuellen Chrome, Firefox, Safari oder Edge.</p>';
      return;
    }
    altesAbenteuerTauschen();
    passNachholen(true);
    loginBelohnung();
    $('#passOeffnen').onclick = () => { PT.Ton.klick(); $('#passSeite').hidden = false; passSeiteBauen(); };
    $('#passZu').onclick = () => { PT.Ton.klick(); $('#passSeite').hidden = true; };
    $('#passSeite').addEventListener('click', e => { if (e.target.id === 'passSeite') $('#passSeite').hidden = true; });
    lexikonBauen();
    menueBauen();
    einstAnwenden();
    $('#los').onclick = () => {
      PT.Ton.start();
      if (koopReiter) { if (binHost()) senden({ t:'start' }); return; }
      neuesSpiel();
    };
    $('#reiterAllein').onclick = () => { PT.Ton.klick(); abenteuerReiter = false; dorfReiter = false; koopReiterSetzen(false); };
    $('#reiterDorf').onclick = () => { PT.Ton.klick(); dorfReiter = true; abenteuerReiter = false; koopReiter = false; menueBauen(); };
    $('#reiterKoop').onclick = () => { PT.Ton.klick(); koopReiterSetzen(true); };
    $('#koopNeu').onclick = () => { PT.Ton.start(); if (koopHallo()) senden({ t:'erstellen' }); };
    $('#koopRein').onclick = () => {
      PT.Ton.start();
      const code = $('#koopCode').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 4) { koopFehler('Der Raum-Code hat 4 Zeichen.'); return; }
      if (koopHallo()) senden({ t:'beitreten', code });
    };
    $('#koopCode').onkeydown = e => { if (e.key === 'Enter') $('#koopRein').click(); };
    $('#koopRaus').onclick = () => { PT.Ton.klick(); koopVerlassen(); };
    $('#kraftAn').onchange = () => {
      wahl.kraft = $('#kraftAn').checked; speicher.schreiben('pt-wahl', wahl);
      if (koopReiter && netz && netz.raum) { const m = meinMitglied(); senden({ t:'wahl', boni:dorfBoni(), held:m ? m.held : wahl.held, kraft:kraftAktivKoop(), ...passZeigen() }); }
    };
    $('#tagLos').onclick = () => { PT.Ton.start(); tagesStarten(); };
    $('#reiterAbenteuer').onclick = () => { PT.Ton.klick(); abenteuerReiter = true; koopReiter = false; dorfReiter = false; menueBauen(); };
    $('#levelZu').onclick = () => { PT.Ton.klick(); $('#levelDialog').hidden = true; };
    $('#tagebuchKnopf').onclick = () => { PT.Ton.klick(); tagebuchOeffnen(); };
    $('#tagebuchZu').onclick = () => { PT.Ton.klick(); $('#tagebuchDialog').hidden = true; };
    $('#tagebuchDialog').addEventListener('click', e => { if (e.target.id === 'tagebuchDialog') $('#tagebuchDialog').hidden = true; });
    $('#kisteZu').onclick = () => { PT.Ton.klick(); $('#kisteDialog').hidden = true; };
    $('#wetterAn').onchange = () => {
      const an = $('#wetterAn').checked;
      if (koopReiter && netz && netz.raum) { if (binHost()) senden({ t:'einst', ...netz.raum.einst, wetter:an }); return; }
      wahl.wetter = an; speicher.schreiben('pt-wahl', wahl);
    };
    $('#wissenAn').onchange = () => { fort.wissenAn = $('#wissenAn').checked; fortMerken(); };
    $('#einstKnopf').onclick = einstOeffnen;
    $('#pEinst').onclick = einstOeffnen;
    $('#einstZu').onclick = () => { PT.Ton.klick(); $('#einstellungen').hidden = true; if (!$('#pause').hidden) pause(true, true); };
    for (const el of document.querySelectorAll('#einstellungen input, #einstellungen select')) el.addEventListener(el.type === 'range' ? 'input' : 'change', einstUebernehmen);
    $('#einstellungen').addEventListener('click', e => { if (e.target.id === 'einstellungen') $('#einstZu').click(); });
    $('#vorschau').onclick = () => { vorschauKlein = !vorschauKlein; speicher.schreiben('pt-vorschau-klein', vorschauKlein); vorschauSchluessel = ''; PT.Ton.klick(); };
    $('#weiter').onclick = () => {
      PT.Ton.start();
      const stand = speicher.lesen('pt-stand');
      if (stand && (PT.KARTEN[stand.karte] || stand.karte === 'eigen')) { tagesAktiv = stand.tag || null; kampagneAktiv = PT.LEVEL(stand.level) ? stand.level : null; spielStarten(PT.Spiel.laden(stand));
        if (kampagneAktiv) PT.Ton.musik(PT.KAPITEL_VON(PT.LEVEL(kampagneAktiv).kapitel).stimmung); }
    };
    $('#start').onclick = startKnopf;
    $('#pauseKnopf').onclick = () => pause(true);
    $('#tonKnopf').onclick = () => { PT.Ton.start(); $('#tonKnopf').textContent = PT.Ton.umschalten() ? '🔊' : '🔇'; };
    $('#tonKnopf').textContent = PT.Ton.an ? '🔊' : '🔇';
    $('#pWeiter').onclick = () => pause(false);
    $('#pTon').onclick = () => { PT.Ton.umschalten(); $('#tonKnopf').textContent = PT.Ton.an ? '🔊' : '🔇'; pause(true, true); };
    $('#pGrafik').onclick = () => { grafikHoch = !grafikHoch; speicher.schreiben('pt-grafik', grafikHoch); welt.grafik(grafikHoch); pause(true, true); };
    $('#pNeu').onclick = () => { if (confirm('Wirklich neu anfangen? Der Fortschritt geht verloren.')) { wahl = { ...wahl, karte:spiel.karte, stufe:spiel.stufe, modus:spiel.modus, held:spiel.held }; neuesSpiel(); } };
    $('#pMenue').onclick = () => {
      if (imKoop()) { if (confirm('Raum verlassen? Deine Pinguine bleiben für die anderen stehen.')) { senden({ t:'pause', an:false }); koopVerlassen(); } return; }
      speichern(); zumMenue();
    };
    $('#pAufgeben').onclick = () => { if (confirm('Wirklich aufgeben? Dann zählen die bisher geschafften Runden.')) olympFertig(); };
    $('#auto').checked = speicher.lesen('pt-auto') === true;
    $('#auto').onchange = () => { if (imKoop()) senden({ t:'auto', an:$('#auto').checked }); else speicher.schreiben('pt-auto', $('#auto').checked); };
    $('#zoomRein').onclick = () => welt && welt.zoomen(1.25);
    $('#zoomRaus').onclick = () => welt && welt.zoomen(1 / 1.25);
    $('#zoomZurueck').onclick = () => welt && welt.zoomZurueck();
    const c = $('#welt');
    c.addEventListener('pointerdown', zeigerRunter);
    c.addEventListener('pointermove', zeigerBewegt);
    c.addEventListener('pointerup', zeigerHoch);
    c.addEventListener('pointercancel', e => { zeigerListe.delete(e.pointerId); gedrueckt = null; if (zeigerListe.size < 2) zwei = null; });
    c.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { zeiger = null; vorschau(); } });
    c.addEventListener('wheel', rad, { passive:false });
    c.addEventListener('contextmenu', e => { e.preventDefault(); if (bauTyp) bauWaehlen(null); else if (zielModus) { zielModus = null; welt.zielModus = false; } });
    window.addEventListener('keydown', tasten);
    document.addEventListener('visibilitychange', () => { if (document.hidden && spiel && !spiel.koop && !$('#spiel').hidden && $('#ende').hidden) pause(true); });
    setInterval(() => { if (olymp && spiel && !olympGemeldet) olympMelden('da'); }, 60_000);

    // Olympia-Ticket im Link oder (nach Neuladen) im Sitzungsspeicher
    const url = new URL(location.href);
    let ticket = url.searchParams.get('olymp');
    if (ticket) {
      speicher.schreiben('pt-olymp', ticket, sessionStorage);
      url.searchParams.delete('olymp');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } else ticket = speicher.lesen('pt-olymp', sessionStorage);
    // Geteilte Karte im Link: in die eigenen Karten übernehmen und auswählen
    const kLink = url.searchParams.get('karte');
    if (kLink) {
      url.searchParams.delete('karte');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      const k = karteAusLink(kLink);
      if (k) {
        const schon = eigeneKarten.find(x => JSON.stringify(x.wege) === JSON.stringify(k.wege));
        const neu = schon || karteSpeichern(k);
        if (neu) { wahl.karte = 'eigen:' + neu.id; speicher.schreiben('pt-wahl', wahl); menueBauen(); setTimeout(() => alert(`Karte „${neu.name}“ geladen! Du findest sie bei den Karten.`), 300); }
      }
    }
    if (ticket) olympStart(ticket);
    // Nach dem Neuladen zurück in den Koop-Raum
    else if (speicher.lesen('pt-koop', sessionStorage)) koopReiterSetzen(true);
    $('#reiterReihe').hidden = !!ticket;

    requestAnimationFrame(schleife);

    // Nur für die Rauchtests (test/*.js): ?test im Link, nur lokal
    if (url.searchParams.has('test') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      window.__pt = {
        test(plaene) {
          spiel.geld = 1e6;
          plaene = plaene || [['zapfen', [0, 2, 5]], ['rundum', [2, 0, 5]], ['schneeball', [5, 2, 0]], ['frost', [0, 5, 2]], ['harpune', [2, 0, 5]], ['polar', [0, 5, 2]],
            ['markt', [5, 0, 2]], ['haeuptling', [2, 5, 0]], ['ninja', [5, 2, 0]], ['flieger', [5, 2, 0]], ['moerser', [0, 5, 2]], ['fabrik', [2, 0, 5]], ['boot', [5, 0, 2]],
            ['laser', [2, 5, 0]], ['disco', [5, 0, 2]], ['taucher', [5, 2, 0]], ['eisbaer', [2, 0, 5]], ['mecha', [5, 2, 0]], ['koch', [0, 2, 5]], [spiel.held || 'kiel', [0, 0, 0]]];
          let n = 0;
          for (const [typ, pf] of plaene) {
            if (!spiel.erlaubt(typ)) continue;
            let t = null;
            const teich = PT.def(typ).wasser && (spiel.kartenDaten.wasser || [])[0];
            if (teich) t = spiel.bauen(typ, teich[0], teich[1]);
            for (let i = 0; i < 4000 && !t; i++) {
              const w = spiel.wege[i % spiel.wege.length];
              const p = w.pts[(i * 37 + n * 211) % w.pts.length];
              t = spiel.bauen(typ, p[0] + Math.cos(i * 2.4) * 56, p[1] + Math.sin(i * 2.4) * 56);
            }
            if (!t) continue;
            n++;
            for (let k = 0; k < 3; k++) for (let s = 0; s < pf[k]; s++) spiel.upgraden(t, k);
            if (PT.HELDEN[typ]) for (let s = 0; s < 9; s++) spiel.heldenStufeKaufen(t);
          }
          spiel.runde = 38;
          return n;
        },
        fische() {
          spiel.fische = [];
          [...PT.FISCH_REIHE, ...PT.BOSS_REIHE].forEach((typ, i) => {
            const f = spiel.neuerFisch(typ, spiel.weg.vonDist + 60 + i * 80, { nach:i % 4 === 1, fest:typ === 'koffer' || typ === 'wal', boss:1 });
            f.betaeubt = 999; f.wind = 1;
          });
          spiel.laeuft = true; spiel.warteschlange = []; spiel.kisten = []; spiel.tuerme = []; spiel.rundenZeit = 0;
          return spiel.fische.length;
        },
        faehigkeiten() { for (const t of spiel.tuerme) for (const k of Object.keys(t.fcd)) t.fcd[k] = 0; return spiel.faehigkeitenListe().map(f => f.id); },
        ausloesen(id) { return spiel.faehigkeitAusloesen(id); },
        pass(xp, skin, sockel) { if (xp != null) { pass.xp = xp; passNachholen(); } if (skin) pass.skin = skin; if (sockel) pass.sockel = sockel; speicher.schreiben('pt-pass', pass); bilderMalen(false, true); menueBauen(); return PT.passStufe(pass.xp); },
        fort(f) { Object.assign(fort, f); fortMerken(); menueBauen(); return fort; },
        tag() { tagesStarten(); return tagesAktiv; },
        ende(g) { endeZeigen(g); },
        netz() { return netz && { id:netz.id, n:netz.n, ziel:netz.ziel, raum:netz.raum }; },
        tun(b) { return tun(b); },
        welt() { return welt; },
        spiel() { return spiel; },
        stand() { return { runde:spiel.runde, leben:spiel.leben, geld:spiel.geld, fische:spiel.fische.length, geschosse:spiel.geschosse.length, tuerme:spiel.tuerme.length, haufen:spiel.haufen.length }; }
      };
    }
  }
  init();
})();
