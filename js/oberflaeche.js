'use strict';
// Pingu Towers – Menü, Seitenleiste, Fähigkeiten, Eingabe (auch Zoom), Hauptschleife, Speicherstand,
// Medaillen und Olympiade.
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
  let wahl = Object.assign({ karte:'scholle', stufe:'mittel', modus:'standard', held:'kiel' }, speicher.lesen('pt-wahl') || {});
  if (!PT.KARTEN[wahl.karte]) wahl.karte = 'scholle';
  if (!PT.STUFEN[wahl.stufe]) wahl.stufe = 'mittel';
  if (!PT.MODI[wahl.modus]) wahl.modus = 'standard';
  if (wahl.held && !PT.HELDEN[wahl.held]) wahl.held = 'kiel';
  let grafikHoch = speicher.lesen('pt-grafik') !== false;
  let bilder = {}, fischBilder = {};
  let olymp = null;   // { ticket, info, einst } wenn als Olympia-Disziplin gespielt wird
  const medaillen = speicher.lesen('pt-medaillen') || {};

  /* ---------- Menü ---------- */
  function kartenVorschau(canvas, id) {
    const k = PT.KARTEN[id];
    canvas.width = 500; canvas.height = 320;
    const x = canvas.getContext('2d');
    x.scale(0.5, 0.5);
    const hintergrund = { tag:['#f4fbff', '#d6eaf5'], daemmerung:['#fbeef0', '#dcd6ee'], nacht:['#2a3d63', '#15233f'], vulkan:['#6b6470', '#3d3842'] }[k.thema];
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
  }
  function medaillenText(karte) {
    const stufen = Object.entries(PT.STUFEN).map(([id, st]) => `<i class="${medaillen[`${karte}|${id}|standard`] ? '' : 'aus'}" title="${esc(st.name)}">${st.medaille}</i>`).join('');
    const modi = new Set(Object.keys(medaillen).filter(k => k.startsWith(karte + '|') && !k.endsWith('|standard') && !k.endsWith('|sandkasten')).map(k => k.split('|')[2]));
    return `<div class="medaillen">${stufen}${modi.size ? `<em>+${modi.size} ${modi.size === 1 ? 'Modus' : 'Modi'}</em>` : ''}</div>`;
  }
  function menueBauen() {
    const karten = $('#karten');
    karten.innerHTML = '';
    for (const id of PT.KARTEN_REIHE) {
      const k = PT.KARTEN[id];
      const b = document.createElement('button');
      b.className = 'kartenwahl';
      b.setAttribute('aria-pressed', wahl.karte === id);
      b.innerHTML = `<canvas></canvas><div><b>${esc(k.name)}<span class="chip">${esc(k.stufe)}</span></b><small>${esc(k.text)}</small>${medaillenText(id)}</div>`;
      kartenVorschau(b.querySelector('canvas'), id);
      b.onclick = () => { wahl.karte = id; wahlMerken(); PT.Ton.klick(); };
      karten.appendChild(b);
    }
    const stufen = $('#stufen');
    stufen.innerHTML = '';
    for (const [id, st] of Object.entries(PT.STUFEN)) {
      const b = document.createElement('button');
      b.className = 'stufe';
      b.setAttribute('aria-pressed', wahl.stufe === id);
      b.innerHTML = `<b>${st.medaille} ${esc(st.name)}</b><small>${st.runden} Runden · ${st.leben} ${st.leben === 1 ? 'Leben' : 'Leben'}${st.preis !== 1 ? ` · Preise ${st.preis < 1 ? '−' : '+'}${Math.round(Math.abs(1 - st.preis) * 100)} %` : ''}</small>`;
      b.onclick = () => { wahl.stufe = id; wahlMerken(); PT.Ton.klick(); };
      stufen.appendChild(b);
    }
    const modi = $('#modi');
    modi.innerHTML = '';
    for (const id of PT.MODI_REIHE) {
      const m = PT.MODI[id];
      const b = document.createElement('button');
      b.className = 'modus';
      b.setAttribute('aria-pressed', wahl.modus === id);
      b.innerHTML = `<b data-symbol="${m.symbol}">${esc(m.name)}</b><small>${esc(m.text)}</small>`;
      b.onclick = () => { wahl.modus = id; wahlMerken(); PT.Ton.klick(); };
      modi.appendChild(b);
    }
    heldenBauen();
    const stand = speicher.lesen('pt-stand');
    $('#weiterReihe').hidden = !stand || !PT.KARTEN[stand.karte];
    if (stand && PT.KARTEN[stand.karte]) {
      $('#weiterText').textContent = `${PT.KARTEN[stand.karte].name}, ${PT.STUFEN[stand.stufe] ? PT.STUFEN[stand.stufe].name : ''}${stand.modus && stand.modus !== 'standard' ? ', ' + PT.MODI[stand.modus].name : ''} – Runde ${stand.runde + 1}`;
    }
    const zahlMed = Object.keys(medaillen).filter(k => !k.endsWith('|sandkasten')).length;
    $('#erfolge').textContent = zahlMed ? `🏅 ${zahlMed} ${zahlMed === 1 ? 'Sieg' : 'Siege'} gesammelt` : '';
  }
  function heldenBauen() {
    const ohne = !!(PT.MODI[olymp ? 'standard' : wahl.modus].ohneHeld);
    const h = $('#helden');
    h.innerHTML = '';
    for (const id of [...PT.HELDEN_REIHE, null]) {
      const d = id && PT.HELDEN[id];
      const b = document.createElement('button');
      b.className = 'heldwahl';
      b.setAttribute('aria-pressed', !ohne && wahl.held === id);
      b.disabled = ohne && !!id;
      b.innerHTML = d ? `<img src="${bilder[id] || ''}" alt=""><span><b>${esc(d.name)}</b><small>${esc(d.kurz)} · ${PT.preis(d.preis, wahl.stufe)} 💰</small></span>`
        : '<span style="font-size:2.4rem;width:72px;text-align:center">🚫</span><span><b>Ohne Held</b><small>Nur Pinguine.</small></span>';
      b.onclick = () => { wahl.held = id; wahlMerken(); PT.Ton.klick(); };
      h.appendChild(b);
    }
  }
  function wahlMerken() { speicher.schreiben('pt-wahl', wahl); menueBauen(); }
  function lexikonBauen() {
    const beschr = {
      rot:'Der Kleinste.', blau:'Wird zum Rotbarsch.', gruen:'Wird zum Blaubarsch.', gelb:'Sehr flink.', rosa:'Der Schnellste.',
      schwarz:'Explosionen machen ihm nichts.', weiss:'Kälte macht ihm nichts.', panzer:'Spitzes prallt ab – braucht Explosionen, Magie oder schwere Waffen.',
      zebra:'Weder Explosionen noch Kälte.', regen:'Zerfällt in zwei Zebrafische.', koffer:'Harte Schale: 10 Treffer.',
      wal:'Riesig: 200 Treffer, dann 4 Kofferfische.', mega:'700 Treffer, dann 4 Walhaie.',
      rochen:'Immer getarnt, schnell, nichts Spitzes und keine Explosionen. 400 Treffer, dann 6 Kofferfische.',
      krake:'4000 Treffer, dann 4 Megalodons.', krakus:'Der Boss der Boss-Jagd. Ruft Verstärkung. Darf nie durchkommen!'
    };
    $('#lexikon').innerHTML = [...PT.FISCH_REIHE, 'krakus'].map(id => {
      const f = PT.FISCHE[id];
      return `<div><img src="${fischBilder[id] || ''}" alt=""><span><b>${esc(f.name)}</b><br><small>${esc(beschr[id])}</small></span></div>`;
    }).join('');
  }

  /* ---------- Spiel starten ---------- */
  function spielStarten(neu) {
    spiel = neu;
    auswahl = null; bauTyp = null; zielModus = null; tempo = 1; pausiert = false; zeitRest = 0; autoWarte = 0;
    olympGemeldet = false;
    $('#menue').hidden = true;
    $('#spiel').hidden = false;
    $('#pause').hidden = true;
    $('#ende').hidden = true;
    document.body.style.overflow = 'hidden';
    if (!welt) {
      welt = new PT.Welt($('#welt'), $('#ueber'));
      new ResizeObserver(() => welt.groesse()).observe($('#buehne'));
      welt.grafik(grafikHoch);
    }
    welt.karteLaden(spiel);
    ladenBauen();
    seiteZeigen();
    letzteAnzeige = '';
    anzeigen();
    fkSchluessel = '';
    const md = PT.MODI[spiel.modus];
    $('#modusAnzeige').textContent = spiel.modus !== 'standard' ? `${md.symbol} ${md.name}` : '';
    tipp('');
    if (spiel.runde === 0 && !spiel.tuerme.length) { tipp(spiel.held ? 'Setz zuerst deinen Helden und ein paar Pinguine neben den Kanal.' : 'Wähle einen Pinguin und setz ihn neben den Kanal.'); tippZeit = 6; }
    banner(PT.KARTEN[spiel.karte].name, `${PT.STUFEN[spiel.stufe].name} · ${spiel.zielRunden} Runden${spiel.modus !== 'standard' ? ' · ' + md.name : ''}`);
  }
  function neuesSpiel() {
    speicher.weg('pt-stand');
    spielStarten(new PT.Spiel({ karte:wahl.karte, stufe:wahl.stufe, modus:wahl.modus, held:wahl.held, seed:Date.now() & 0xffffff }));
  }
  function zumMenue() {
    $('#spiel').hidden = true;
    $('#pause').hidden = true;
    $('#ende').hidden = true;
    $('#menue').hidden = false;
    document.body.style.overflow = '';
    spiel = null;
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
    const schluessel = [Math.ceil(spiel.leben), Math.floor(spiel.geld), spiel.runde, spiel.laeuft, tempo, bauTyp, zielModus && zielModus.id, spiel.tuerme.length,
      t && t.id, t && t.pfade.join(), t && t.ziel, t && t.muster, t && t.pops, t && t.stufe, t && Math.floor(t.xp), t && t.eff && t.eff.gebufft].join('|');
    if (schluessel === letzteAnzeige) return;
    letzteAnzeige = schluessel;
    $('#leben').textContent = spiel.unendlich ? '∞' : Math.max(0, Math.ceil(spiel.leben));
    $('#geld').textContent = spiel.unendlich ? '∞' : zahl(spiel.geld);
    $('#runde').textContent = Math.max(1, spiel.runde + 1);
    $('#rundenZiel').textContent = spiel.endlos ? '∞' : spiel.zielRunden;
    const st = $('#start');
    if (spiel.laeuft) { st.textContent = `⏩ ${tempo}×`; st.classList.add('schnell'); st.setAttribute('aria-label', `Tempo ${tempo}-fach, ändern`); }
    else { st.textContent = '▶ Runde starten'; st.classList.remove('schnell'); st.setAttribute('aria-label', 'Nächste Runde starten'); }
    for (const b of document.querySelectorAll('.pingu-kauf')) {
      const typ = b.dataset.typ;
      const preis = spiel.preisBau(typ);
      b.querySelector('span').textContent = zahl(preis) + ' 💰';
      b.classList.toggle('teuer', preis > spiel.geld);
      b.setAttribute('aria-pressed', bauTyp === typ);
      if (PT.HELDEN[typ]) b.hidden = !!spiel.heldDa();
    }
    if (auswahl) turmInfoBauen();
  }

  function ladenBauen() {
    const l = $('#ladenListe');
    l.innerHTML = '';
    if (spiel.held) {
      const d = PT.HELDEN[spiel.held];
      const b = document.createElement('button');
      b.className = 'pingu-kauf held';
      b.dataset.typ = spiel.held;
      b.title = `${d.name} – ${d.kurz}`;
      b.innerHTML = `<kbd>H</kbd><img src="${bilder[spiel.held] || ''}" alt=""><div><b>⭐ ${esc(d.name)}</b><br><span></span></div>`;
      b.onclick = () => bauWaehlen(bauTyp === spiel.held ? null : spiel.held);
      b.onpointerenter = () => { $('#ladenInfo').textContent = `${d.name}: ${d.kurz}`; };
      l.appendChild(b);
    }
    for (const gruppe of PT.GRUPPEN) {
      const typen = PT.PINGUIN_REIHE.filter(t => PT.PINGUINE[t].gruppe === gruppe && spiel.erlaubt(t));
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
      $('#sandFische').innerHTML = [...PT.FISCH_REIHE, 'krakus'].map(id => `<button data-fisch="${id}" title="${esc(PT.FISCHE[id].name)}"><img src="${fischBilder[id] || ''}" alt="${esc(PT.FISCHE[id].name)}"></button>`).join('');
      for (const b of document.querySelectorAll('[data-fisch]')) b.onclick = () => {
        const n = +$('#sandAnzahl').value;
        spiel.sandFische(b.dataset.fisch, b.dataset.fisch === 'krakus' ? 1 : n, { camo:$('#sandCamo').checked, nach:$('#sandNach').checked, fest:$('#sandFest').checked });
        PT.Ton.klick();
      };
      $('#sandLeeren').onclick = () => { for (const f of spiel.fische) f.tot = true; spiel.warteschlange = []; PT.Ton.verkaufen(); };
    }
  }
  function bauWaehlen(typ) {
    if (typ && spiel.preisBau(typ) > spiel.geld) { PT.Ton.fehler(); kurzTipp('Dafür reicht das Geld noch nicht.'); return; }
    if (typ && PT.HELDEN[typ] && spiel.heldDa()) return;
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
    return `<div class="ziele" role="group" aria-label="Ziel">${ziele.map(([id, name]) => `<button data-ziel="${id}" aria-pressed="${t.ziel === id}">${name}</button>`).join('')}</div>`;
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
  function turmInfoBauen() {
    const t = auswahl, d = PT.def(t.typ);
    const el = $('#turmInfo');
    const held = !!PT.HELDEN[t.typ];
    const farben = ['#e2463b', '#2f7fe0', '#35b04a'];
    const tasten = [',', '.', '-'];
    let html = `<div class="turm-kopf"><img src="${bilder[t.typ] || ''}" alt=""><div><h3>${held ? '⭐ ' : ''}${esc(d.name)}</h3><small>${zahl(t.pops)} Fische erwischt</small></div>
      <button class="lknopf schliessen" id="tiZu" aria-label="Schließen">✕</button></div>`;
    html += kennzahlenText(t);
    html += zielKnoepfe(t, d);
    if (held) {
      const S = PT.HELDEN_STUFEN;
      const anteil = t.stufe >= 10 ? 1 : (t.xp - S[t.stufe]) / (S[t.stufe + 1] - S[t.stufe]);
      const preis = spiel.preisHeldenStufe(t);
      html += `<div class="held-info"><b>Stufe ${t.stufe} / 10</b>${t.stufe < 10 ? ` <small style="color:var(--panel-leise)">· ${zahl(t.xp)} / ${zahl(S[t.stufe + 1])} Erfahrung</small>` : ''}
        <div class="xp"><i style="width:${Math.round(Math.max(0, Math.min(1, anteil)) * 100)}%"></i></div>
        ${t.stufe < 10 ? `<button class="kaufen" id="tiStufe" ${preis > spiel.geld ? 'disabled' : ''}>Stufe ${t.stufe + 1} kaufen · ${zahl(preis)} 💰</button>` : ''}
        <ul class="held-stufen">${d.stufen.map((s, i) => `<li class="${i < t.stufe ? 'da' : ''}"><b>${i + 1}</b>${esc(s)}</li>`).join('')}</ul></div>`;
    } else {
      for (let i = 0; i < 3; i++) {
        const stufe = t.pfade[i];
        const u = d.pfade[i][stufe];
        const erlaubt = spiel.upgradeErlaubt(t, i);
        const preis = u ? spiel.preisUpgrade(t, i) : 0;
        const letzte = stufe > 0 ? d.pfade[i][stufe - 1].name : 'Pfad ' + (i + 1);
        html += `<div class="pfad" style="--pf:${farben[i]}"><div class="pfad-kopf"><div class="pips">${[0, 1, 2, 3, 4].map(k => `<i class="${k < stufe ? 'an' : ''}"></i>`).join('')}</div>${esc(letzte)}</div>`;
        if (!u) html += `<button disabled><b>Voll ausgebaut</b><small>Stärker geht's nicht.</small></button>`;
        else if (spiel.stufe5Vergeben(t, i)) html += `<button disabled><b>🔒 ${esc(u.name)}</b><small>Diese Stufe 5 gibt es nur einmal – ein anderer ${esc(d.name)} hat sie schon.</small></button>`;
        else if (!erlaubt) html += `<button disabled><b>🔒 ${esc(u.name)}</b><small>Gesperrt: höchstens zwei Pfade, nur einer über Stufe 2.</small></button>`;
        else html += `<button data-pfad="${i}" class="${preis > spiel.geld ? 'teuer' : ''} ${stufe === 4 ? 'fuenf' : ''}"><b>${stufe === 4 ? '✨ ' : ''}${esc(u.name)}<kbd>${tasten[i]}</kbd></b><em>${zahl(preis)} 💰</em><small>${esc(u.text)}</small></button>`;
        html += '</div>';
      }
    }
    html += `<button class="verkauf" id="tiVerkauf">Verkaufen für ${zahl(spiel.verkaufswert(t))} 💰</button>`;
    el.innerHTML = html;
    $('#tiZu').onclick = () => turmWaehlen(null);
    $('#tiVerkauf').onclick = () => verkaufen();
    if ($('#tiZiel')) $('#tiZiel').onclick = () => { zielModus = zielModus === t ? null : t; welt.zielModus = !!zielModus; kurzTipp(zielModus ? 'Tippe auf die Stelle, die der Mörser treffen soll.' : ''); letzteAnzeige = ''; anzeigen(); };
    if ($('#tiStufe')) $('#tiStufe').onclick = () => { if (spiel.heldenStufeKaufen(t)) PT.Ton.upgrade(); else PT.Ton.fehler(); letzteAnzeige = ''; anzeigen(); };
    for (const b of el.querySelectorAll('[data-ziel]')) b.onclick = () => { t.ziel = b.dataset.ziel; PT.Ton.klick(); letzteAnzeige = ''; anzeigen(); };
    for (const b of el.querySelectorAll('[data-muster]')) b.onclick = () => { t.muster = b.dataset.muster; t.musterGesetzt = true; PT.Ton.klick(); letzteAnzeige = ''; anzeigen(); };
    for (const b of el.querySelectorAll('[data-pfad]')) b.onclick = () => upgraden(+b.dataset.pfad);
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
    if (!auswahl || PT.HELDEN[auswahl.typ]) return;
    if (spiel.upgraden(auswahl, i)) { PT.Ton.upgrade(); if (auswahl.pfade[i] === 5) banner(PT.PINGUINE[auswahl.typ].pfade[i][4].name, 'Stufe 5!', 1.8); }
    else PT.Ton.fehler();
    letzteAnzeige = '';
    anzeigen();
  }
  function verkaufen() {
    if (!auswahl) return;
    spiel.verkaufen(auswahl);
    PT.Ton.verkaufen();
    turmWaehlen(null);
  }

  /* ---------- Fähigkeiten ---------- */
  let fkSchluessel = '';
  function faehigkeitenZeigen() {
    const liste = spiel.faehigkeitenListe();
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
    if (spiel.faehigkeitAusloesen(id)) { PT.Ton.faehigkeit(); const f = PT.FAEHIGKEITEN[id]; banner(`${f.symbol} ${f.name}`, '', 1.2); }
    else { PT.Ton.fehler(); kurzTipp('Die Fähigkeit lädt noch.'); }
  }

  /* ---------- Knöpfe ---------- */
  function startKnopf() {
    PT.Ton.start();
    if (!spiel || spiel.vorbei) return;
    if (spiel.laeuft) { tempo = tempo >= 3 ? 1 : tempo + 1; letzteAnzeige = ''; anzeigen(); return; }
    rundeStarten();
  }
  function rundeStarten() {
    if (spiel.rundeStarten()) {
      tipp('');
      if (olymp) olympMelden('da');
    }
    letzteAnzeige = '';
    anzeigen();
  }
  function pause(an) {
    pausiert = an;
    $('#pause').hidden = !an;
    $('#pTon').textContent = PT.Ton.an ? '🔊 Ton an' : '🔇 Ton aus';
    $('#pGrafik').textContent = grafikHoch ? '✨ Grafik: hoch' : '⚡ Grafik: schnell';
    $('#pNeu').hidden = !!olymp;
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
    const ok = spiel.platzFrei(bauTyp, x, y) && spiel.preisBau(bauTyp, x, y) <= spiel.geld;
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
    if (zielModus) {
      zielModus.zielPunkt = [Math.max(0, Math.min(PT.BREITE, x)), Math.max(0, Math.min(PT.HOEHE, y))];
      zielModus = null; welt.zielModus = false;
      PT.Ton.klick(); tipp('');
      letzteAnzeige = ''; anzeigen();
      return;
    }
    if (bauTyp) {
      const t = spiel.bauen(bauTyp, x, y);
      if (t) {
        PT.Ton.bauen();
        const weiterBauen = e.shiftKey && !PT.HELDEN[bauTyp] && spiel.preisBau(bauTyp) <= spiel.geld;
        if (!weiterBauen) { bauTyp = null; welt.geistZeigen(null); tipp(''); turmWaehlen(t); }
      } else {
        PT.Ton.fehler();
        const d = PT.def(bauTyp);
        kurzTipp(spiel.preisBau(bauTyp, x, y) > spiel.geld ? 'Nicht genug Geld.' : d.wasser ? 'Boote passen nur in die runden Wasserlöcher.' : 'Hier ist kein Platz – nicht ins Wasser, nicht auf Eisberge, nicht zu nah an andere Pinguine.');
        if (e.pointerType !== 'mouse') vorschau();
      }
      letzteAnzeige = ''; anzeigen();
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
    if (!spiel || $('#spiel').hidden) return;
    if (!$('#ende').hidden) return;
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
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) {
      const f = spiel.faehigkeitenListe()[n - 1];
      if (f) { e.preventDefault(); faehigkeit(f.id); }
      return;
    }
    if (k === 'h' && spiel.held && !spiel.heldDa()) { bauWaehlen(spiel.held); if (zeiger) vorschau(); return; }
    const typ = PT.PINGUIN_REIHE.find(t => PT.PINGUINE[t].taste === k || (k === 'y' && PT.PINGUINE[t].taste === 'z'));
    if (typ && spiel.erlaubt(typ)) { bauWaehlen(typ); if (zeiger) vorschau(); return; }
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
          auswahl.muster = ids[(ids.indexOf(auswahl.muster) + 1) % ids.length]; auswahl.musterGesetzt = true;
        } else if (d.greift !== false && auswahl.typ !== 'moerser') {
          const ids = (d.ziele || PT.ZIELE).map(z => z[0]);
          auswahl.ziel = ids[(ids.indexOf(auswahl.ziel) + (e.shiftKey ? ids.length - 1 : 1)) % ids.length];
        }
        letzteAnzeige = ''; anzeigen();
      }
    }
  }

  /* ---------- Ereignisse der Logik ---------- */
  function ereignisse(liste) {
    for (const e of liste) {
      if (e.art === 'rundeStart') {
        if (e.boss) banner(`🐙 Krakus ist da!`, e.boss === 1 ? 'Boss Stufe 1 – lass ihn nicht durch!' : 'Boss Stufe 2 – das große Finale!', 3);
        else banner(`Runde ${e.runde}`, rundenHinweis(e.runde));
      }
      if (e.art === 'rundeEnde') {
        const n = e.runde + 1;
        if (spiel.modus === 'boss' && ((n >= 17 && n < 20) || (n >= 37 && n < 40))) banner(`Runde ${e.runde} geschafft!`, `Krakus kommt in ${(n < 20 ? 20 : 40) - n + 1} ${(n < 20 ? 20 : 40) - n + 1 === 1 ? 'Runde' : 'Runden'} – stell auf „Stärkster“!`, 2.6);
        else banner(`Runde ${e.runde} geschafft!`, `+${zahl(e.bonus)} 💰`);
        speichern();
        if ($('#auto').checked && !spiel.gewonnen && spiel.modus !== 'flut') autoWarte = 1.2;
        if (olymp && spiel.runde >= spiel.zielRunden) olympFertig();
      }
      if (e.art === 'aufstieg') banner(`⭐ ${PT.HELDEN[e.turm.typ].name}`, `Stufe ${e.stufe}: ${PT.HELDEN[e.turm.typ].stufen[e.stufe - 1]}`, 2.2);
      if (e.art === 'bossPhase') banner('Krakus ruft Verstärkung!', `${4 - e.phase} von 4 Lebensbalken übrig`, 1.8);
      if (e.art === 'bossBesiegt') banner('🐙 Krakus besiegt!', `+${zahl(1500 * (spiel.modus === 'halb' ? 0.5 : 1))} 💰`, 2.5);
      if (e.art === 'gewonnen' && !olymp) endeZeigen(true);
      if (e.art === 'verloren') {
        speicher.weg('pt-stand');
        if (olymp) olympFertig(); else endeZeigen(false);
      }
    }
  }
  function rundenHinweis(n) {
    const r = PT.runde(n, spiel.modus);
    const typen = [...new Set(r.gruppen.map(g => g.typ))];
    const neu = { 17:'Nachwachsende Fische! Grüne Algen = sie wachsen nach.', 20:'Anglerfische! Explosionen helfen nicht.', 22:'Eisfische! Kälte hilft nicht.', 24:'Getarnte Fische!',
      26:'Zebrafische!', 28:'Panzerwelse! Spitzes prallt ab.', 38:'Kofferfische!', 40:'Ein Walhai!', 46:'Gepanzerte Fische mit Helm!', 55:'Der Megalodon kommt!', 60:'Ein Schattenrochen – immer getarnt!', 65:'Die Riesenkrake!' }[n];
    if (neu) return neu;
    return typen.map(t => PT.FISCHE[t].name).join(' · ');
  }
  function speichern() {
    if (!spiel || spiel.vorbei || spiel.modus === 'sandkasten') return;
    if (olymp) speicher.schreiben('pt-olymp-stand-' + olymp.info.lauf, spiel.speichern(), sessionStorage);
    else speicher.schreiben('pt-stand', spiel.speichern());
  }

  function endeZeigen(gewonnen) {
    const k = $('#endeKnoepfe');
    $('#ende').hidden = false;
    pausiert = true;
    if (gewonnen) {
      const st = PT.STUFEN[spiel.stufe];
      const schluessel = `${spiel.karte}|${spiel.stufe}|${spiel.modus}`;
      const neu = !medaillen[schluessel] && spiel.modus !== 'sandkasten';
      if (spiel.modus !== 'sandkasten') { medaillen[schluessel] = true; speicher.schreiben('pt-medaillen', medaillen); }
      $('#endeEmoji').textContent = spiel.modus === 'standard' ? st.medaille : '🏆';
      $('#endeTitel').textContent = 'Gewonnen!';
      $('#endeText').textContent = `Alle ${spiel.zielRunden} Runden auf ${PT.KARTEN[spiel.karte].name} (${st.name}${spiel.modus !== 'standard' ? ', ' + PT.MODI[spiel.modus].name : ''}) mit ${Math.ceil(spiel.leben)} Leben übrig.${neu ? ' Neue Medaille!' : ''}`;
      k.innerHTML = '<button class="knopf haupt" id="eEndlos">Endlos weiterspielen</button><button class="knopf" id="eNeu">Nochmal</button><button class="knopf" id="eMenue">Hauptmenü</button>';
      $('#eEndlos').onclick = () => { spiel.endlos = true; $('#ende').hidden = true; pausiert = false; speichern(); letzteAnzeige = ''; anzeigen(); };
    } else {
      $('#endeEmoji').textContent = '🐟';
      $('#endeTitel').textContent = spiel.modus === 'boss' && spiel.leben <= 0 && spiel.statistik.geleakt >= 1e6 ? 'Krakus ist entkommen!' : 'Die Fische sind durch!';
      $('#endeText').textContent = `Du hast ${spiel.runde} ${spiel.runde === 1 ? 'Runde' : 'Runden'} geschafft. ${zahl(spiel.statistik.platzer)} Fische erwischt.`;
      k.innerHTML = '<button class="knopf haupt" id="eNeu">Nochmal</button><button class="knopf" id="eMenue">Hauptmenü</button>';
    }
    $('#eNeu').onclick = () => { wahl = { ...wahl, karte:spiel.karte, stufe:spiel.stufe, modus:spiel.modus, held:spiel.held }; neuesSpiel(); };
    $('#eMenue').onclick = zumMenue;
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
      const s = alt ? PT.Spiel.laden(alt) : new PT.Spiel({ karte:d.einst.karte, stufe:d.einst.stufe, runden:d.einst.runden, held:wahl.held, seed:12345 });
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
    if (!pausiert) {
      zeitRest += dt * (spiel.laeuft ? tempo : 1);
      let n = 0;
      while (zeitRest >= 1 / 60 && n < 12) { spiel.schritt(1 / 60); zeitRest -= 1 / 60; n++; }
      if (n >= 12) zeitRest = 0;
      if (spiel.unendlich) { spiel.geld = 999999; spiel.leben = Math.max(spiel.leben, 999999); }
      if (autoWarte > 0) { autoWarte -= dt; if (autoWarte <= 0 && !spiel.laeuft && !spiel.vorbei) rundeStarten(); }
    }
    const ev = spiel.ereignisse.splice(0);
    if (ev.length) { welt.ereignisse(ev); PT.Ton.ereignisse(ev); ereignisse(ev); }
    if (auswahl && !spiel.tuerme.includes(auswahl)) turmWaehlen(null);
    welt.zeichnen(spiel, pausiert ? 0 : dt, auswahl);
    if (bannerZeit > 0) { bannerZeit -= dt; if (bannerZeit <= 0) $('#banner').classList.remove('an'); }
    if (tippZeit > 0) { tippZeit -= dt; if (tippZeit <= 0) tipp(''); }
    faehigkeitenZeigen();
    anzeigen();
  }

  /* ---------- Los ---------- */
  function init() {
    try {
      const b = PT.Welt.bilder([...PT.PINGUIN_REIHE, ...PT.HELDEN_REIHE], [...PT.FISCH_REIHE, 'krakus']);
      bilder = b.pingu; fischBilder = b.fisch;
    } catch (e) {
      console.error(e);
      document.body.innerHTML = '<p style="padding:24px;font-size:1.2rem">Dein Browser kann leider kein WebGL (3D). Probier es mit einem aktuellen Chrome, Firefox, Safari oder Edge.</p>';
      return;
    }
    lexikonBauen();
    menueBauen();
    $('#los').onclick = () => { PT.Ton.start(); neuesSpiel(); };
    $('#weiter').onclick = () => {
      PT.Ton.start();
      const stand = speicher.lesen('pt-stand');
      if (stand && PT.KARTEN[stand.karte]) spielStarten(PT.Spiel.laden(stand));
    };
    $('#start').onclick = startKnopf;
    $('#pauseKnopf').onclick = () => pause(true);
    $('#tonKnopf').onclick = () => { PT.Ton.start(); $('#tonKnopf').textContent = PT.Ton.umschalten() ? '🔊' : '🔇'; };
    $('#tonKnopf').textContent = PT.Ton.an ? '🔊' : '🔇';
    $('#pWeiter').onclick = () => pause(false);
    $('#pTon').onclick = () => { PT.Ton.umschalten(); $('#tonKnopf').textContent = PT.Ton.an ? '🔊' : '🔇'; pause(true); };
    $('#pGrafik').onclick = () => { grafikHoch = !grafikHoch; speicher.schreiben('pt-grafik', grafikHoch); welt.grafik(grafikHoch); pause(true); };
    $('#pNeu').onclick = () => { if (confirm('Wirklich neu anfangen? Der Fortschritt geht verloren.')) { wahl = { ...wahl, karte:spiel.karte, stufe:spiel.stufe, modus:spiel.modus, held:spiel.held }; neuesSpiel(); } };
    $('#pMenue').onclick = () => { speichern(); zumMenue(); };
    $('#pAufgeben').onclick = () => { if (confirm('Wirklich aufgeben? Dann zählen die bisher geschafften Runden.')) olympFertig(); };
    $('#auto').checked = speicher.lesen('pt-auto') === true;
    $('#auto').onchange = () => speicher.schreiben('pt-auto', $('#auto').checked);
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
    document.addEventListener('visibilitychange', () => { if (document.hidden && spiel && !$('#spiel').hidden && $('#ende').hidden) pause(true); });
    setInterval(() => { if (olymp && spiel && !olympGemeldet) olympMelden('da'); }, 60_000);

    // Olympia-Ticket im Link oder (nach Neuladen) im Sitzungsspeicher
    const url = new URL(location.href);
    let ticket = url.searchParams.get('olymp');
    if (ticket) {
      speicher.schreiben('pt-olymp', ticket, sessionStorage);
      url.searchParams.delete('olymp');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } else ticket = speicher.lesen('pt-olymp', sessionStorage);
    if (ticket) olympStart(ticket);

    requestAnimationFrame(schleife);

    // Nur für die Rauchtests (test/*.js): ?test im Link, nur lokal
    if (url.searchParams.has('test') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      window.__pt = {
        test(plaene) {
          spiel.geld = 1e6;
          plaene = plaene || [['zapfen', [0, 2, 5]], ['rundum', [2, 0, 5]], ['schneeball', [5, 2, 0]], ['frost', [0, 5, 2]], ['harpune', [2, 0, 5]], ['polar', [0, 5, 2]],
            ['markt', [5, 0, 2]], ['haeuptling', [2, 5, 0]], ['ninja', [5, 2, 0]], ['flieger', [5, 2, 0]], ['moerser', [0, 5, 2]], ['fabrik', [2, 0, 5]], ['boot', [5, 0, 2]], [spiel.held || 'kiel', [0, 0, 0]]];
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
          [...PT.FISCH_REIHE, 'krakus'].forEach((typ, i) => {
            const f = spiel.neuerFisch(typ, spiel.weg.vonDist + 60 + i * 80, { nach:i % 4 === 1, fest:typ === 'koffer' || typ === 'wal', boss:1 });
            f.betaeubt = 999; f.wind = 1;
          });
          spiel.laeuft = true; spiel.warteschlange = []; spiel.kisten = []; spiel.tuerme = []; spiel.rundenZeit = 0;
          return spiel.fische.length;
        },
        faehigkeiten() { for (const t of spiel.tuerme) for (const k of Object.keys(t.fcd)) t.fcd[k] = 0; return spiel.faehigkeitenListe().map(f => f.id); },
        ausloesen(id) { return spiel.faehigkeitAusloesen(id); },
        welt() { return welt; },
        spiel() { return spiel; },
        stand() { return { runde:spiel.runde, leben:spiel.leben, geld:spiel.geld, fische:spiel.fische.length, geschosse:spiel.geschosse.length, tuerme:spiel.tuerme.length, haufen:spiel.haufen.length }; }
      };
    }
  }
  init();
})();
