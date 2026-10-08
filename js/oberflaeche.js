'use strict';
// Pingu Towers – Menü, Seitenleiste, Fähigkeiten, Eingabe (auch Zoom), Hauptschleife, Speicherstand,
// Medaillen, Olympiade, Pingu-Pass und Koop (Verbindung zum Server, Takt für Takt nachrechnen).
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
  if (!PT.KARTEN[wahl.karte]) wahl.karte = 'scholle';
  if (!PT.STUFEN[wahl.stufe]) wahl.stufe = 'mittel';
  if (!PT.MODI[wahl.modus]) wahl.modus = 'standard';
  if (wahl.held && !PT.HELDEN[wahl.held]) wahl.held = 'kiel';
  let grafikHoch = speicher.lesen('pt-grafik') !== false;
  let bilder = {}, fischBilder = {};
  let olymp = null;   // { ticket, info, einst } wenn als Olympia-Disziplin gespielt wird
  const medaillen = speicher.lesen('pt-medaillen') || {};

  /* ---------- Pingu-Pass ---------- */
  const pass = Object.assign({ xp:0, skin:'standard' }, speicher.lesen('pt-pass') || {});
  const passStufe = () => PT.passStufe(pass.xp).stufe;
  if (!PT.SKINS[pass.skin] || !PT.skinFrei(pass.skin, passStufe())) pass.skin = 'standard';
  let lookBilder = {};
  function belohnungText(b) { return b.skin ? `Neuer Look: ${PT.SKINS[b.skin].name}` : `Meisterkraft für ${PT.HELDEN[b.kraft].name}`; }
  function xpDazu(n) {
    if (!n || !spiel || spiel.unendlich) return;
    const vor = passStufe();
    pass.xp += n;
    speicher.schreiben('pt-pass', pass);
    const nach = passStufe();
    for (let st = vor + 1; st <= nach; st++) {
      const b = PT.PASS_BELOHNUNG[st];
      banner(`🎖️ Pingu-Pass Stufe ${st}!`, b ? belohnungText(b) : 'Weiter so!', 3);
      PT.Ton.upgrade();
    }
  }
  // Meisterkraft im Einzelspiel: freigeschaltet und eingeschaltet (in der Olympiade nie)
  const kraftAktiv = held => !olymp && wahl.kraft !== false && !!held && PT.kraftFrei(held, passStufe());
  function passBauen() {
    const info = PT.passStufe(pass.xp);
    $('#passStufe').textContent = `🎖️ Pingu-Pass · Stufe ${info.stufe}${info.stufe >= PT.PASS_MAX ? ' (Maximum)' : ''}`;
    $('#passXp').textContent = info.bedarf ? `${zahl(info.rest)} / ${zahl(info.bedarf)} Erfahrung` : `${zahl(pass.xp)} Erfahrung`;
    $('#passBalken').style.width = (info.bedarf ? Math.round(info.rest / info.bedarf * 100) : 100) + '%';
    const naechste = Object.keys(PT.PASS_BELOHNUNG).map(Number).find(st => st > info.stufe);
    $('#passNaechst').textContent = naechste ? `Nächste Belohnung auf Stufe ${naechste}: ${belohnungText(PT.PASS_BELOHNUNG[naechste])}.` : 'Alles freigeschaltet!';
    const looks = $('#looks');
    looks.innerHTML = PT.SKIN_REIHE.map(id => {
      const frei = PT.skinFrei(id, info.stufe);
      const ab = Object.entries(PT.PASS_BELOHNUNG).find(([, b]) => b.skin === id);
      return `<button class="look" data-look="${id}" aria-pressed="${pass.skin === id}" ${frei ? '' : 'disabled'}><img src="${lookBilder[id] || ''}" alt=""><b>${esc(PT.SKINS[id].name)}</b><small>${frei ? (pass.skin === id ? 'Aktiv' : 'Anziehen') : `🔒 Stufe ${ab ? ab[0] : '?'}`}</small></button>`;
    }).join('');
    for (const b of looks.querySelectorAll('[data-look]')) b.onclick = () => lookWaehlen(b.dataset.look);
    $('#kraeftePass').innerHTML = PT.HELDEN_REIHE.map(h => {
      const ab = Object.entries(PT.PASS_BELOHNUNG).find(([, b]) => b.kraft === h);
      const frei = PT.kraftFrei(h, info.stufe);
      return `<li class="${frei ? 'da' : ''}">${frei ? '✨' : '🔒'} <b>${esc(PT.HELDEN[h].name)}</b>${frei ? '' : ` (Stufe ${ab ? ab[0] : '?'})`}: ${esc(PT.HELDEN[h].kraft.text)}</li>`;
    }).join('');
  }
  function lookWaehlen(id) {
    if (!PT.skinFrei(id, passStufe()) || pass.skin === id) return;
    pass.skin = id;
    speicher.schreiben('pt-pass', pass);
    PT.Ton.klick();
    bilderMalen();
    if (netz && netz.raum) senden({ t:'wahl', held:meinMitglied() ? meinMitglied().held : wahl.held, kraft:kraftAktivKoop(), skin:pass.skin });
    menueBauen();
  }
  // Vorschaubilder im aktuellen Look (Laden, Helden) und alle Looks für den Pass
  function bilderMalen(mitLooks) {
    const b = PT.Welt.bilder([...PT.PINGUIN_REIHE, ...PT.HELDEN_REIHE], mitLooks ? [...PT.FISCH_REIHE, ...PT.BOSS_REIHE] : [], pass.skin, mitLooks ? PT.SKIN_REIHE : []);
    bilder = b.pingu;
    if (mitLooks) { fischBilder = b.fisch; lookBilder = b.look; }
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
  const kraftAktivKoop = (held) => { const m = meinMitglied(); const h = held !== undefined ? held : m ? m.held : wahl.held; return wahl.kraft !== false && !!h && PT.kraftFrei(h, passStufe()); };
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
      ws.send(JSON.stringify({ t:'hallo', name:koopName(), skin:pass.skin, token:alt && alt.token, code:alt && alt.code }));
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
        if ((!alt || alt.code !== d.code) && d.phase === 'lobby') senden({ t:'wahl', held:wahl.held, kraft:kraftAktivKoop(wahl.held), skin:pass.skin });
        if (d.phase === 'lobby' && imKoop()) zumMenue();
        if (d.phase === 'spiel' && imKoop()) {
          tempo = d.tempo;
          $('#auto').checked = d.auto;
          koopPauseZeigen();
          letzteAnzeige = '';
          // Looks und Farben der Mitspieler können sich geändert haben (z. B. nach Wiederverbinden)
          if (alt && JSON.stringify(alt.mitglieder.map(m => m.skin)) !== JSON.stringify(d.mitglieder.map(m => m.skin)) && welt) welt.allesNeu();
        }
        if (!$('#menue').hidden) menueBauen();
        break;
      }
      case 'zustand': koopZustand(d); break;
      case 'takt':
        if (!imKoop()) break;
        for (const x of d.b) if (x[0] > netz.n) netz.befehle.push(x);
        netz.ziel = Math.max(netz.ziel, d.n);
        break;
    }
  }
  function koopZustand(d) {
    const neu = PT.Spiel.ausZustand(d.z);
    netz.n = d.n; netz.ziel = d.n; netz.rest = 0;
    netz.befehle = netz.befehle.filter(x => x[0] > d.n);
    if (!spiel || !spiel.koop || $('#spiel').hidden || spiel.karte !== neu.karte) { spielStarten(neu); tempo = d.tempo || 1; return; }
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
        const res = spiel.befehl(sp, b);
        if (sp === netz.id && b.ref != null) ergebnis(b, res);
      }
      spiel.schritt(1 / 60);
      if (k % 60 === 0) senden({ t:'p', n:k, h:spiel.pruefsumme() });
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
      case 'leeren': PT.Ton.verkaufen(); break;
    }
    letzteAnzeige = '';
    anzeigen();
  }

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
      b.innerHTML = `<canvas></canvas><div><b>${esc(k.name)}<span class="chip">${esc(k.stufe)}</span></b><small>${esc(k.text)}</small>${medaillenText(id)}</div>`;
      kartenVorschau(b.querySelector('canvas'), id);
      b.onclick = () => waehle('karte', id);
      karten.appendChild(b);
    }
    const stufen = $('#stufen');
    stufen.innerHTML = '';
    for (const [id, st] of Object.entries(PT.STUFEN)) {
      const b = document.createElement('button');
      b.className = 'stufe';
      b.setAttribute('aria-pressed', E.stufe === id);
      b.disabled = aus;
      b.innerHTML = `<b>${st.medaille} ${esc(st.name)}</b><small>${st.runden} Runden · ${st.leben} ${st.leben === 1 ? 'Leben' : 'Leben'}${st.preis !== 1 ? ` · Preise ${st.preis < 1 ? '−' : '+'}${Math.round(Math.abs(1 - st.preis) * 100)} %` : ''}</small>`;
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
      b.innerHTML = `<b data-symbol="${m.symbol}">${esc(m.name)}</b><small>${esc(m.text)}</small>`;
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
    heldenBauen();
    const stand = speicher.lesen('pt-stand');
    $('#weiterReihe').hidden = koopReiter || !stand || !PT.KARTEN[stand.karte];
    if (stand && PT.KARTEN[stand.karte]) {
      $('#weiterText').textContent = `${PT.KARTEN[stand.karte].name}, ${PT.STUFEN[stand.stufe] ? PT.STUFEN[stand.stufe].name : ''}${stand.modus && stand.modus !== 'standard' ? ', ' + PT.MODI[stand.modus].name : ''} – Runde ${stand.runde + 1}`;
    }
    const zahlMed = Object.keys(medaillen).filter(k => !k.endsWith('|sandkasten')).length;
    $('#erfolge').textContent = zahlMed ? `🏅 ${zahlMed} ${zahlMed === 1 ? 'Sieg' : 'Siege'} gesammelt` : '';
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
      b.disabled = ohne && !!id;
      const kraft = d && PT.kraftFrei(id, st) && !olymp ? ' <span class="chip kraft" title="Meisterkraft freigeschaltet">✨</span>' : '';
      b.innerHTML = d ? `<img src="${bilder[id] || ''}" alt=""><span><b>${esc(d.name)}${kraft}</b><small>${esc(d.kurz)} · ${PT.preis(d.preis, E.stufe)} 💰</small></span>`
        : '<span style="font-size:2.4rem;width:72px;text-align:center">🚫</span><span><b>Ohne Held</b><small>Nur Pinguine.</small></span>';
      b.onclick = () => {
        PT.Ton.klick();
        wahl.held = id; speicher.schreiben('pt-wahl', wahl);
        if (koopReiter && netz && netz.raum) senden({ t:'wahl', held:id, kraft:kraftAktivKoop(id), skin:pass.skin });
        menueBauen();
      };
      h.appendChild(b);
    }
    // Meisterkraft ein- und ausschalten
    const frei = !!meiner && PT.kraftFrei(meiner, st) && !olymp && !ohne;
    $('#kraftReihe').hidden = !frei;
    $('#kraftAn').checked = wahl.kraft !== false;
    if (frei) $('#kraftText').textContent = PT.HELDEN[meiner].kraft.text;
  }

  /* ---------- Koop im Menü ---------- */
  function koopMenueBauen() {
    $('#reiterAllein').setAttribute('aria-pressed', !koopReiter);
    $('#reiterKoop').setAttribute('aria-pressed', koopReiter);
    const raum = koopReiter && netz && netz.raum;
    $('#koopBox').hidden = !koopReiter;
    $('#koopVerbinden').hidden = !!raum;
    $('#koopRaum').hidden = !raum;
    $('#normalMenue').hidden = koopReiter && !raum;
    $('#geldBereich').hidden = !raum;
    $('#heldBereich').hidden = koopReiter && !raum;
    $('#losReihe').hidden = koopReiter && !raum;
    if (!olymp) {
      $('#los').disabled = !!raum && !binHost();
      $('#los').textContent = raum ? (binHost() ? 'Spiel starten' : 'Der Gastgeber startet das Spiel …') : "Los geht's!";
    }
    if (!raum) return;
    $('#raumCode').textContent = raum.code;
    $('#mitglieder').innerHTML = raum.mitglieder.map((m, i) => {
      const held = m.held && PT.HELDEN[m.held] ? PT.HELDEN[m.held].name : 'ohne Held';
      return `<li style="--f:${PT.KOOP_FARBEN[i] || '#999'}" class="${m.online ? '' : 'weg'}"><i></i><b>${esc(m.name)}</b>${m.id === raum.host ? ' 👑' : ''}${m.id === netz.id ? ' (du)' : ''}<small>${esc(held)}${m.kraft ? ' ✨' : ''}${m.skin && m.skin !== 'standard' && PT.SKINS[m.skin] ? ' · ' + esc(PT.SKINS[m.skin].name) : ''}${m.online ? '' : ' · offline'}</small></li>`;
    }).join('');
    $('#koopHinweis').textContent = raum.phase === 'spiel' ? 'In diesem Raum läuft gerade eine Partie.' : binHost()
      ? `Du bist Gastgeber: Wähl Karte, Schwierigkeit, Modus und Geld, dann starte. Freunde treten mit dem Code ${raum.code} bei.`
      : 'Such dir deinen Helden aus. Karte und Modus wählt der Gastgeber.';
  }
  function koopReiterSetzen(an) {
    koopReiter = an;
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
    senden({ t:'hallo', name:n, skin:pass.skin });
    return true;
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
    beschr.orka = 'Der Boss des Orka-Angriffs. Seine Flutwellen betäuben Pinguine am Ufer. Darf nie durchkommen!';
    $('#lexikon').innerHTML = [...PT.FISCH_REIHE, ...PT.BOSS_REIHE].map(id => {
      const f = PT.FISCHE[id];
      return `<div><img src="${fischBilder[id] || ''}" alt=""><span><b>${esc(f.name)}</b><br><small>${esc(beschr[id])}</small></span></div>`;
    }).join('');
  }

  /* ---------- Spiel starten ---------- */
  function spielStarten(neu) {
    spiel = neu;
    auswahl = null; bauTyp = null; zielModus = null; tempo = 1; pausiert = false; zeitRest = 0; autoWarte = 0;
    olympGemeldet = false;
    endeArt = null;
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
        if (!spiel || !spiel.koop || t.besitzer == null) return { skin:pass.skin };
        const sp = spiel.spielerVon(t.besitzer);
        const m = netz && netz.raum && netz.raum.mitglieder.find(x => x.id === t.besitzer);
        return { skin:m ? m.skin : 'standard', farbe:sp ? PT.KOOP_FARBEN[sp.farbe] : null };
      };
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
    banner(PT.KARTEN[spiel.karte].name, `${PT.STUFEN[spiel.stufe].name} · ${spiel.zielRunden} Runden${spiel.modus !== 'standard' ? ' · ' + md.name : ''}${geldText}`);
    $('#auto').checked = spiel.koop ? !!(netz.raum && netz.raum.auto) : speicher.lesen('pt-auto') === true;
    $('#pNeu').hidden = !!olymp || spiel.koop;
    $('#pMenue').textContent = spiel.koop ? 'Raum verlassen' : 'Zum Hauptmenü';
    mitspielerZeigen();
    if (spiel.koop) koopPauseZeigen();
  }
  function neuesSpiel() {
    speicher.weg('pt-stand');
    spielStarten(new PT.Spiel({ karte:wahl.karte, stufe:wahl.stufe, modus:wahl.modus, held:wahl.held, kraft:kraftAktiv(wahl.held), seed:Date.now() & 0xffffff }));
  }
  function zumMenue() {
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
    $('#rundenZiel').textContent = spiel.endlos ? '∞' : spiel.zielRunden;
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
    const geld = meinGeld();
    const meins = spiel.darf(t, ich());
    const besitzer = spiel.koop && spiel.spielerVon(t.besitzer);
    let html = `<div class="turm-kopf"><img src="${bilder[t.typ] || ''}" alt=""><div><h3>${held ? '⭐ ' : ''}${esc(d.name)}</h3><small>${zahl(t.pops)} Fische erwischt</small>
      ${besitzer ? `<small class="besitzer" style="--f:${PT.KOOP_FARBEN[besitzer.farbe]}"><i></i>${besitzer.id === netz.id ? 'Dein Pinguin' : 'Gehört ' + esc(besitzer.name)}</small>` : ''}</div>
      <button class="lknopf schliessen" id="tiZu" aria-label="Schließen">✕</button></div>`;
    html += kennzahlenText(t);
    if (t.betaeubt > 0) html += '<p class="hinweis">💫 Von einer Flutwelle betäubt.</p>';
    if (!meins) {
      // Getrenntes Geld: fremde Pinguine nur anschauen
      html += `<p class="hinweis">Bei getrennter Kasse kann nur ${esc(besitzer ? besitzer.name : 'der Besitzer')} diesen Pinguin aufrüsten oder verkaufen.</p>`;
      el.innerHTML = html;
      $('#tiZu').onclick = () => turmWaehlen(null);
      return;
    }
    html += zielKnoepfe(t, d);
    if (held) {
      const S = PT.HELDEN_STUFEN;
      const anteil = t.stufe >= 10 ? 1 : (t.xp - S[t.stufe]) / (S[t.stufe + 1] - S[t.stufe]);
      const preis = spiel.preisHeldenStufe(t);
      html += `<div class="held-info"><b>Stufe ${t.stufe} / 10</b>${t.stufe < 10 ? ` <small style="color:var(--panel-leise)">· ${zahl(t.xp)} / ${zahl(S[t.stufe + 1])} Erfahrung</small>` : ''}
        <div class="xp"><i style="width:${Math.round(Math.max(0, Math.min(1, anteil)) * 100)}%"></i></div>
        ${t.stufe < 10 ? `<button class="kaufen" id="tiStufe" ${preis > geld ? 'disabled' : ''}>Stufe ${t.stufe + 1} kaufen · ${zahl(preis)} 💰</button>` : ''}
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
        else html += `<button data-pfad="${i}" class="${preis > geld ? 'teuer' : ''} ${stufe === 4 ? 'fuenf' : ''}"><b>${stufe === 4 ? '✨ ' : ''}${esc(u.name)}<kbd>${tasten[i]}</kbd></b><em>${zahl(preis)} 💰</em><small>${esc(u.text)}</small></button>`;
        html += '</div>';
      }
    }
    html += `<button class="verkauf" id="tiVerkauf">Verkaufen für ${zahl(spiel.verkaufswert(t))} 💰</button>`;
    el.innerHTML = html;
    $('#tiZu').onclick = () => turmWaehlen(null);
    $('#tiVerkauf').onclick = () => verkaufen();
    if ($('#tiZiel')) $('#tiZiel').onclick = () => { zielModus = zielModus === t ? null : t; welt.zielModus = !!zielModus; kurzTipp(zielModus ? 'Tippe auf die Stelle, die der Mörser treffen soll.' : ''); letzteAnzeige = ''; anzeigen(); };
    if ($('#tiStufe')) $('#tiStufe').onclick = () => tun({ t:'stufe', id:t.id });
    for (const b of el.querySelectorAll('[data-ziel]')) b.onclick = () => { PT.Ton.klick(); tun({ t:'ziel', id:t.id, ziel:b.dataset.ziel }); };
    for (const b of el.querySelectorAll('[data-muster]')) b.onclick = () => { PT.Ton.klick(); tun({ t:'muster', id:t.id, muster:b.dataset.muster }); };
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
    if (!auswahl || PT.HELDEN[auswahl.typ] || !spiel.darf(auswahl, ich())) return;
    tun({ t:'up', id:auswahl.id, pfad:i });
  }
  function verkaufen() {
    if (!auswahl || !spiel.darf(auswahl, ich())) return;
    tun({ t:'verkauf', id:auswahl.id });
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
        else banner(`Runde ${e.runde}`, rundenHinweis(e.runde));
      }
      if (e.art === 'rundeEnde') {
        const n = e.runde + 1;
        const boss = PT.bossFuer(spiel.modus);
        const bossRunde = boss && Object.keys(PT.BOSSE[boss].runden).map(Number).find(r => r >= n && r - n <= 2);
        if (bossRunde) { const k = bossRunde - n + 1; banner(`Runde ${e.runde} geschafft!`, `${PT.FISCHE[boss].name} kommt in ${k} ${k === 1 ? 'Runde' : 'Runden'} – stell auf „Stärkster“!`, 2.6); }
        else banner(`Runde ${e.runde} geschafft!`, `+${zahl(e.bonus)} 💰`);
        xpDazu(PT.passXpRunde(e.runde, spiel.stufe));
        speichern();
        if (!spiel.koop && $('#auto').checked && !spiel.gewonnen && spiel.modus !== 'flut') autoWarte = 1.2;
        if (olymp && spiel.runde >= spiel.zielRunden) olympFertig();
      }
      if (e.art === 'aufstieg') banner(`⭐ ${PT.HELDEN[e.turm.typ].name}`, `Stufe ${e.stufe}: ${PT.HELDEN[e.turm.typ].stufen[e.stufe - 1]}`, 2.2);
      if (e.art === 'bossPhase') banner(`${PT.FISCHE[e.fisch.typ].name} ruft Verstärkung!`, `${4 - e.phase} von 4 Lebensbalken übrig`, 1.8);
      if (e.art === 'flutwelle' && spiel.tuerme.some(t => t.betaeubt > 0 && (!spiel.koop || t.besitzer === ich()))) kurzTipp('🌊 Flutwelle! Deine Pinguine am Ufer sind kurz betäubt.');
      if (e.art === 'bossBesiegt') {
        const B = PT.BOSSE[e.typ] || PT.BOSSE.krakus;
        banner(`${B.symbol} ${PT.FISCHE[e.typ].name} besiegt!`, `+${zahl(B.belohnung * (spiel.modus === 'halb' ? 0.5 : 1))} 💰`, 2.5);
        xpDazu(PT.PASS_XP_BOSS);
      }
      if (e.art === 'gewonnen') { xpDazu(PT.passXpSieg(spiel.stufe)); if (!olymp) endeZeigen(true); }
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
    if (!spiel || spiel.vorbei || spiel.modus === 'sandkasten' || spiel.koop) return;
    if (olymp) speicher.schreiben('pt-olymp-stand-' + olymp.info.lauf, spiel.speichern(), sessionStorage);
    else speicher.schreiben('pt-stand', spiel.speichern());
  }

  let endeArt = null;
  function endeZeigen(gewonnen) {
    const k = $('#endeKnoepfe');
    $('#ende').hidden = false;
    endeArt = gewonnen ? 'gewonnen' : 'verloren';
    if (spiel.koop) return koopEnde(gewonnen);
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
      $('#endeTitel').textContent = endeTitel();
      $('#endeText').textContent = `Du hast ${spiel.runde} ${spiel.runde === 1 ? 'Runde' : 'Runden'} geschafft. ${zahl(spiel.statistik.platzer)} Fische erwischt.`;
      k.innerHTML = '<button class="knopf haupt" id="eNeu">Nochmal</button><button class="knopf" id="eMenue">Hauptmenü</button>';
    }
    $('#eNeu').onclick = () => { wahl = { ...wahl, karte:spiel.karte, stufe:spiel.stufe, modus:spiel.modus, held:spiel.held }; neuesSpiel(); };
    $('#eMenue').onclick = zumMenue;
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
      $('#endeText').textContent = `${namen}: alle ${spiel.zielRunden} Runden auf ${PT.KARTEN[spiel.karte].name} mit ${Math.ceil(spiel.leben)} Leben übrig.`;
    } else {
      $('#endeEmoji').textContent = '🐟';
      $('#endeTitel').textContent = endeTitel();
      $('#endeText').textContent = `Ihr habt ${spiel.runde} ${spiel.runde === 1 ? 'Runde' : 'Runden'} geschafft und ${zahl(spiel.statistik.platzer)} Fische erwischt.`;
    }
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
    const ev = spiel.ereignisse.splice(0);
    if (ev.length) { welt.ereignisse(ev); PT.Ton.ereignisse(ev); ereignisse(ev); }
    if (auswahl && !spiel.tuerme.includes(auswahl)) turmWaehlen(null);
    welt.zeichnen(spiel, (imKoop() ? koopPause : pausiert) ? 0 : dt, auswahl);
    if (bannerZeit > 0) { bannerZeit -= dt; if (bannerZeit <= 0) $('#banner').classList.remove('an'); }
    if (tippZeit > 0) { tippZeit -= dt; if (tippZeit <= 0) tipp(''); }
    faehigkeitenZeigen();
    anzeigen();
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
    lexikonBauen();
    menueBauen();
    $('#los').onclick = () => {
      PT.Ton.start();
      if (koopReiter) { if (binHost()) senden({ t:'start' }); return; }
      neuesSpiel();
    };
    $('#reiterAllein').onclick = () => { PT.Ton.klick(); koopReiterSetzen(false); };
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
      if (koopReiter && netz && netz.raum) { const m = meinMitglied(); senden({ t:'wahl', held:m ? m.held : wahl.held, kraft:kraftAktivKoop(), skin:pass.skin }); }
    };
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
            ['laser', [2, 5, 0]], ['disco', [5, 0, 2]], [spiel.held || 'kiel', [0, 0, 0]]];
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
        pass(xp, skin) { if (xp != null) pass.xp = xp; if (skin) pass.skin = skin; speicher.schreiben('pt-pass', pass); bilderMalen(); menueBauen(); return PT.passStufe(pass.xp); },
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
