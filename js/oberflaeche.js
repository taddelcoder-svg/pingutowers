'use strict';
// Pingu Towers – Menü, Seitenleiste, Eingabe, Hauptschleife, Speicherstand und Olympiade.
(function () {
  const PT = window.PT;
  const $ = s => document.querySelector(s);
  const esc = t => String(t).replace(/[&<>"]/g, z => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[z]));
  const speicher = {
    lesen(k, ls = localStorage) { try { return JSON.parse(ls.getItem(k)); } catch (e) { return null; } },
    schreiben(k, v, ls = localStorage) { try { ls.setItem(k, JSON.stringify(v)); } catch (e) { /* voll oder gesperrt */ } },
    weg(k, ls = localStorage) { try { ls.removeItem(k); } catch (e) { /* egal */ } }
  };

  let welt = null, spiel = null, auswahl = null, bauTyp = null, zeiger = null;
  let tempo = 1, pausiert = false, zeitRest = 0, letzte = 0, autoWarte = 0;
  let wahl = speicher.lesen('pt-wahl') || { karte:'scholle', stufe:'mittel' };
  let grafikHoch = speicher.lesen('pt-grafik') !== false;
  let bilder = {}, fischBilder = {};
  let olymp = null;   // { ticket, info, einst } wenn als Olympia-Disziplin gespielt wird

  /* ---------- Menü ---------- */
  function kartenVorschau(canvas, id) {
    const k = PT.KARTEN[id];
    const weg = PT.wegBauen(k.weg);
    canvas.width = 500; canvas.height = 320;
    const x = canvas.getContext('2d');
    x.scale(0.5, 0.5);
    const hintergrund = { tag:['#f4fbff', '#d6eaf5'], daemmerung:['#fbeef0', '#dcd6ee'], nacht:['#2a3d63', '#15233f'] }[k.thema];
    const g = x.createLinearGradient(0, 0, 0, 640);
    g.addColorStop(0, hintergrund[0]); g.addColorStop(1, hintergrund[1]);
    x.fillStyle = g; x.fillRect(0, 0, 1000, 640);
    x.lineJoin = x.lineCap = 'round';
    const linie = (b, f) => { x.strokeStyle = f; x.lineWidth = b; x.beginPath(); weg.pts.forEach(([a, c], i) => (i ? x.lineTo(a, c) : x.moveTo(a, c))); x.stroke(); };
    linie(66, 'rgba(255,255,255,0.9)');
    linie(42, k.thema === 'nacht' ? '#1d5f8f' : '#2a8fc4');
    for (const [hx, hy, hr] of k.hindernisse) {
      x.fillStyle = k.thema === 'nacht' ? '#6c7f9e' : '#bfe0f2';
      x.beginPath(); x.arc(hx, hy, hr, 0, Math.PI * 2); x.fill();
    }
  }
  function menueBauen() {
    const karten = $('#karten');
    karten.innerHTML = '';
    for (const id of PT.KARTEN_REIHE) {
      const k = PT.KARTEN[id];
      const b = document.createElement('button');
      b.className = 'kartenwahl';
      b.setAttribute('aria-pressed', wahl.karte === id);
      b.innerHTML = `<canvas></canvas><div><b>${esc(k.name)}<span class="chip">${esc(k.stufe)}</span></b><small>${esc(k.text)}</small></div>`;
      kartenVorschau(b.querySelector('canvas'), id);
      b.onclick = () => { wahl.karte = id; speicher.schreiben('pt-wahl', wahl); menueBauen(); PT.Ton.klick(); };
      karten.appendChild(b);
    }
    const stufen = $('#stufen');
    stufen.innerHTML = '';
    for (const [id, st] of Object.entries(PT.STUFEN)) {
      const b = document.createElement('button');
      b.className = 'stufe';
      b.setAttribute('aria-pressed', wahl.stufe === id);
      b.innerHTML = `<b>${esc(st.name)}</b><small>${st.runden} Runden · ${st.leben} Leben${st.preis !== 1 ? ` · Preise ${st.preis < 1 ? '−' : '+'}${Math.round(Math.abs(1 - st.preis) * 100)} %` : ''}</small>`;
      b.onclick = () => { wahl.stufe = id; speicher.schreiben('pt-wahl', wahl); menueBauen(); PT.Ton.klick(); };
      stufen.appendChild(b);
    }
    const stand = speicher.lesen('pt-stand');
    $('#weiterReihe').hidden = !stand;
    if (stand) $('#weiterText').textContent = `${PT.KARTEN[stand.karte] ? PT.KARTEN[stand.karte].name : ''}, ${PT.STUFEN[stand.stufe] ? PT.STUFEN[stand.stufe].name : ''} – Runde ${stand.runde + 1}`;
  }
  function lexikonBauen() {
    const beschr = {
      rot:'Der Kleinste.', blau:'Wird zum Rotbarsch.', gruen:'Wird zum Blaubarsch.', gelb:'Sehr flink.', rosa:'Der Schnellste.',
      schwarz:'Explosionen machen ihm nichts.', weiss:'Kälte macht ihm nichts.', panzer:'Spitzes prallt ab – braucht Explosionen, Magie oder schwere Waffen.',
      zebra:'Weder Explosionen noch Kälte.', regen:'Zerfällt in zwei Zebrafische.', koffer:'Harte Schale: 10 Treffer.',
      wal:'Riesig: 200 Treffer, dann 4 Kofferfische.', mega:'Der Boss: 700 Treffer, dann 4 Walhaie.'
    };
    $('#lexikon').innerHTML = Object.values(PT.FISCHE).map(f =>
      `<div><img src="${fischBilder[f.id] || ''}" alt=""><span><b>${esc(f.name)}</b><br><small>${esc(beschr[f.id])}</small></span></div>`).join('');
  }

  /* ---------- Spiel starten ---------- */
  function spielStarten(neu) {
    spiel = neu;
    auswahl = null; bauTyp = null; tempo = 1; pausiert = false; zeitRest = 0; autoWarte = 0;
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
    anzeigen();
    tipp(spiel.runde === 0 && !spiel.tuerme.length ? 'Wähle rechts einen Pinguin und setz ihn neben den Kanal.' : '');
    banner(PT.KARTEN[spiel.karte].name, `${PT.STUFEN[spiel.stufe].name} · ${spiel.zielRunden} Runden`);
  }
  function neuesSpiel() {
    speicher.weg('pt-stand');
    spielStarten(new PT.Spiel({ karte:wahl.karte, stufe:wahl.stufe }));
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
  function banner(text, klein) {
    const b = $('#banner');
    b.innerHTML = esc(text) + (klein ? `<small>${esc(klein)}</small>` : '');
    b.classList.add('an');
    bannerZeit = 2.2;
  }
  function tipp(text) { $('#tipp').hidden = !text; $('#tipp').textContent = text || ''; }

  let letzteAnzeige = '';
  function anzeigen() {
    if (!spiel) return;
    const aktuelleRunde = Math.min(spiel.runde + (spiel.laeuft ? 1 : 1), Math.max(spiel.zielRunden, spiel.runde + 1));
    const schluessel = [spiel.leben, spiel.geld, spiel.runde, spiel.laeuft, tempo, auswahl && auswahl.id, bauTyp, auswahl && auswahl.pfade.join(), auswahl && auswahl.ziel, auswahl && auswahl.pops].join('|');
    if (schluessel === letzteAnzeige) return;
    letzteAnzeige = schluessel;
    $('#leben').textContent = Math.max(0, Math.ceil(spiel.leben));
    $('#geld').textContent = Math.floor(spiel.geld);
    $('#runde').textContent = aktuelleRunde;
    $('#rundenZiel').textContent = spiel.endlos ? '∞' : spiel.zielRunden;
    const st = $('#start');
    if (spiel.laeuft) { st.textContent = `⏩ ${tempo}×`; st.classList.add('schnell'); st.setAttribute('aria-label', `Tempo ${tempo}-fach, ändern`); }
    else { st.textContent = '▶ Runde starten'; st.classList.remove('schnell'); st.setAttribute('aria-label', 'Nächste Runde starten'); }
    // Laden
    for (const b of document.querySelectorAll('.pingu-kauf')) {
      const typ = b.dataset.typ;
      const preis = spiel.preisBau(typ);
      b.querySelector('span').textContent = preis + ' 💰';
      b.classList.toggle('teuer', preis > spiel.geld);
      b.setAttribute('aria-pressed', bauTyp === typ);
    }
    if (auswahl) turmInfoBauen();
  }

  function ladenBauen() {
    const l = $('#ladenListe');
    l.innerHTML = '';
    PT.PINGUIN_REIHE.forEach((typ, i) => {
      const p = PT.PINGUINE[typ];
      const b = document.createElement('button');
      b.className = 'pingu-kauf';
      b.dataset.typ = typ;
      b.title = `${p.name} – ${p.kurz}`;
      b.innerHTML = `<kbd>${i + 1}</kbd><img src="${bilder[typ] || ''}" alt=""><b>${esc(p.name)}</b><span></span>`;
      b.onclick = () => bauWaehlen(bauTyp === typ ? null : typ);
      b.onpointerenter = () => { $('#ladenInfo').textContent = `${p.name}: ${p.kurz}`; };
      l.appendChild(b);
    });
  }
  function bauWaehlen(typ) {
    if (typ && spiel.preisBau(typ) > spiel.geld) { PT.Ton.fehler(); tipp('Dafür reicht das Geld noch nicht.'); setTimeout(() => tipp(''), 1500); return; }
    bauTyp = typ;
    auswahl = null;
    welt.geistZeigen(null);
    welt.reichweiteZeigen(null);
    if (typ) {
      PT.Ton.klick();
      $('#ladenInfo').textContent = `${PT.PINGUINE[typ].name}: ${PT.PINGUINE[typ].kurz}`;
      tipp('Aufs Eis neben dem Kanal tippen oder ziehen und loslassen. Esc bricht ab.');
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

  function turmInfoBauen() {
    const t = auswahl, p = PT.PINGUINE[t.typ];
    const el = $('#turmInfo');
    const farben = ['#e2463b', '#2f7fe0', '#35b04a'];
    const tasten = [',', '.', '-'];
    let html = `<div class="turm-kopf"><img src="${bilder[t.typ] || ''}" alt=""><div><h3>${esc(p.name)}</h3><small>${t.pops} Fische erwischt${t.eff && t.eff.gebufft ? ' · 🪶 Häuptling' : ''}</small></div>
      <button class="lknopf schliessen" id="tiZu" aria-label="Schließen">✕</button></div>`;
    if (p.greift !== false) {
      html += `<div class="ziele" role="group" aria-label="Ziel">${PT.ZIELE.map(([id, name]) => `<button data-ziel="${id}" aria-pressed="${t.ziel === id}">${name}</button>`).join('')}</div>`;
    } else if (t.eff.geld) {
      const g = t.eff.geld;
      html += `<p class="statistik">${g.kisten ? `${g.kisten} Kisten à ${Math.round(g.wert)} 💰 pro Runde` : ''}${g.kisten && g.flat ? ' · ' : ''}${g.flat ? `+${g.flat} 💰 am Rundenende` : ''}</p>`;
    }
    for (let i = 0; i < 3; i++) {
      const stufe = t.pfade[i];
      const u = p.pfade[i][stufe];
      const erlaubt = PT.upgradeErlaubt(t.pfade, i);
      const preis = u ? spiel.preisUpgrade(t, i) : 0;
      const letzte = stufe > 0 ? p.pfade[i][stufe - 1].name : 'Pfad ' + (i + 1);
      html += `<div class="pfad" style="--pf:${farben[i]}"><div class="pfad-kopf"><div class="pips">${[0, 1, 2, 3].map(k => `<i class="${k < stufe ? 'an' : ''}"></i>`).join('')}</div>${esc(letzte)}</div>`;
      if (!u) html += `<button disabled><b>Voll ausgebaut</b><small>Stärker geht's nicht.</small></button>`;
      else if (!erlaubt) html += `<button disabled><b>🔒 ${esc(u.name)}</b><small>Gesperrt: höchstens zwei Pfade, nur einer über Stufe 2.</small></button>`;
      else html += `<button data-pfad="${i}" class="${preis > spiel.geld ? 'teuer' : ''}"><b>${esc(u.name)}<kbd>${tasten[i]}</kbd></b><em>${preis} 💰</em><small>${esc(u.text)}</small></button>`;
      html += '</div>';
    }
    html += `<button class="verkauf" id="tiVerkauf">Verkaufen für ${spiel.verkaufswert(t)} 💰</button>`;
    el.innerHTML = html;
    $('#tiZu').onclick = () => turmWaehlen(null);
    $('#tiVerkauf').onclick = () => verkaufen();
    for (const b of el.querySelectorAll('[data-ziel]')) b.onclick = () => { t.ziel = b.dataset.ziel; PT.Ton.klick(); letzteAnzeige = ''; anzeigen(); };
    for (const b of el.querySelectorAll('[data-pfad]')) b.onclick = () => upgraden(+b.dataset.pfad);
  }
  function turmWaehlen(t) {
    auswahl = t;
    if (!t) welt.reichweiteZeigen(null);
    seiteZeigen();
    letzteAnzeige = '';
    anzeigen();
  }
  function upgraden(i) {
    if (!auswahl) return;
    if (spiel.upgraden(auswahl, i)) PT.Ton.upgrade();
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

  /* ---------- Eingabe auf der Karte ---------- */
  function turmBei(x, y) {
    let best = null, bd = Infinity;
    for (const t of spiel.tuerme) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < PT.turmRadius(t.typ) + 10 && d < bd) { bd = d; best = t; }
    }
    return best;
  }
  function vorschau() {
    if (!bauTyp || !zeiger) { welt.geistZeigen(null); if (!auswahl) welt.reichweiteZeigen(null); return; }
    const [x, y] = zeiger;
    const ok = spiel.platzFrei(bauTyp, x, y) && spiel.preisBau(bauTyp, x, y) <= spiel.geld;
    const w = PT.werteFuer(bauTyp, [0, 0, 0]);
    welt.geistZeigen(bauTyp, x, y, ok);
    welt.reichweiteZeigen(x, y, w.reichweite > 5000 ? 60 : w.reichweite || 40, ok);
  }
  const buehne = () => $('#welt');
  function zeigerAus(e) { return welt ? welt.bodenPunkt(e.clientX, e.clientY) : null; }
  let gedrueckt = false;
  function zeigerRunter(e) {
    PT.Ton.start();
    gedrueckt = true;
    zeiger = zeigerAus(e);
    if (bauTyp) { buehne().setPointerCapture(e.pointerId); vorschau(); }
  }
  function zeigerBewegt(e) {
    if (!spiel || !welt) return;
    zeiger = zeigerAus(e);
    if (bauTyp && (e.pointerType === 'mouse' || gedrueckt)) vorschau();
  }
  function zeigerHoch(e) {
    if (!gedrueckt) return;
    gedrueckt = false;
    zeiger = zeigerAus(e);
    if (!zeiger) return;
    const [x, y] = zeiger;
    if (bauTyp) {
      const t = spiel.bauen(bauTyp, x, y);
      if (t) {
        PT.Ton.bauen();
        const weiterBauen = e.shiftKey && spiel.preisBau(bauTyp) <= spiel.geld;
        if (!weiterBauen) { bauTyp = null; welt.geistZeigen(null); tipp(''); turmWaehlen(t); }
      } else {
        PT.Ton.fehler();
        tipp(spiel.preisBau(bauTyp, x, y) > spiel.geld ? 'Nicht genug Geld.' : 'Hier ist kein Platz – nicht ins Wasser, nicht auf Eisberge, nicht zu nah an andere Pinguine.');
        if (e.pointerType !== 'mouse') vorschau();
      }
      letzteAnzeige = ''; anzeigen();
      return;
    }
    const t = turmBei(x, y);
    turmWaehlen(t);
    if (t) PT.Ton.klick();
  }
  function tasten(e) {
    if (!spiel || $('#spiel').hidden) return;
    if (!$('#ende').hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (bauTyp) bauWaehlen(null);
      else if (auswahl) turmWaehlen(null);
      else pause(!pausiert);
      return;
    }
    if (pausiert) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= PT.PINGUIN_REIHE.length) { bauWaehlen(PT.PINGUIN_REIHE[n - 1]); if (zeiger) vorschau(); return; }
    if (e.key === ' ') { e.preventDefault(); startKnopf(); return; }
    if (auswahl) {
      const i = [',', '.', '-'].indexOf(e.key);
      const j = i >= 0 ? i : ['/', '#'].indexOf(e.key) >= 0 ? 2 : -1;
      if (j >= 0) { e.preventDefault(); upgraden(j); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); verkaufen(); return; }
      if (e.key === 'Tab' && PT.PINGUINE[auswahl.typ].greift !== false) {
        e.preventDefault();
        const ids = PT.ZIELE.map(z => z[0]);
        auswahl.ziel = ids[(ids.indexOf(auswahl.ziel) + (e.shiftKey ? ids.length - 1 : 1)) % ids.length];
        letzteAnzeige = ''; anzeigen();
      }
    }
  }

  /* ---------- Ereignisse der Logik ---------- */
  function ereignisse(liste) {
    for (const e of liste) {
      if (e.art === 'rundeStart') banner(`Runde ${e.runde}`, rundenHinweis(e.runde));
      if (e.art === 'rundeEnde') {
        banner(`Runde ${e.runde} geschafft!`, `+${e.bonus} 💰`);
        tempo = Math.min(tempo, 3);
        speichern();
        if ($('#auto').checked && !spiel.gewonnen) autoWarte = 1.2;
        if (olymp && spiel.runde >= spiel.zielRunden) olympFertig();
      }
      if (e.art === 'gewonnen' && !olymp) endeZeigen(true);
      if (e.art === 'verloren') {
        speicher.weg('pt-stand');
        if (olymp) olympFertig(); else endeZeigen(false);
      }
    }
  }
  function rundenHinweis(n) {
    const r = PT.runde(n);
    const typen = [...new Set(r.gruppen.map(g => g.typ))];
    const neu = { 20:'Anglerfische! Explosionen helfen nicht.', 22:'Eisfische! Kälte hilft nicht.', 24:'Getarnte Fische!', 26:'Zebrafische!', 28:'Panzerwelse! Spitzes prallt ab.', 38:'Kofferfische!', 40:'Ein Walhai!', 55:'Der Megalodon kommt!' }[n];
    if (neu) return neu;
    return typen.map(t => PT.FISCHE[t].name).join(' · ');
  }
  function speichern() {
    if (!spiel || spiel.vorbei) return;
    if (olymp) speicher.schreiben('pt-olymp-stand-' + olymp.info.lauf, spiel.speichern(), sessionStorage);
    else speicher.schreiben('pt-stand', spiel.speichern());
  }

  function endeZeigen(gewonnen) {
    const k = $('#endeKnoepfe');
    $('#ende').hidden = false;
    pausiert = true;
    if (gewonnen) {
      $('#endeEmoji').textContent = '🏆';
      $('#endeTitel').textContent = 'Gewonnen!';
      $('#endeText').textContent = `Alle ${spiel.zielRunden} Runden auf ${PT.KARTEN[spiel.karte].name} (${PT.STUFEN[spiel.stufe].name}) mit ${Math.ceil(spiel.leben)} Leben übrig. Kein Fisch hatte eine Chance!`;
      k.innerHTML = '<button class="knopf haupt" id="eEndlos">Endlos weiterspielen</button><button class="knopf" id="eNeu">Nochmal</button><button class="knopf" id="eMenue">Hauptmenü</button>';
      $('#eEndlos').onclick = () => { spiel.endlos = true; $('#ende').hidden = true; pausiert = false; speichern(); letzteAnzeige = ''; anzeigen(); };
    } else {
      $('#endeEmoji').textContent = '🐟';
      $('#endeTitel').textContent = 'Die Fische sind durch!';
      $('#endeText').textContent = `Du hast ${spiel.runde} ${spiel.runde === 1 ? 'Runde' : 'Runden'} geschafft. ${spiel.statistik.platzer} Fische erwischt.`;
      k.innerHTML = '<button class="knopf haupt" id="eNeu">Nochmal</button><button class="knopf" id="eMenue">Hauptmenü</button>';
    }
    $('#eNeu').onclick = () => { wahl = { karte:spiel.karte, stufe:spiel.stufe }; neuesSpiel(); };
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
    $('#olympLos').disabled = true;
    let d = null;
    for (let i = 0; i < 3 && !d; i++) { d = await olympMelden('info'); if (!d) await new Promise(ok => setTimeout(ok, 1500)); }
    if (!d || !d.ok) {
      $('#olympText').textContent = (d && d.fehler) || 'Das Olympia-Ticket ist ungültig oder abgelaufen. Hol dir in der Olympiade ein neues.';
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
      $('#olympLos').textContent = 'Zurück zur Olympiade';
      $('#olympLos').disabled = false;
      $('#olympLos').onclick = () => { location.href = d.info.zurueck || '/'; };
      return;
    }
    $('#olympText').textContent = `Hallo ${d.info.name}! Du hast einen Versuch: Überleb so viele Runden wie möglich. Wer weiter kommt, gewinnt – bei Gleichstand zählen die übrigen Leben.`;
    $('#olympLos').disabled = false;
    $('#olympLos').onclick = () => {
      PT.Ton.start();
      const alt = speicher.lesen('pt-olymp-stand-' + olymp.info.lauf, sessionStorage);
      const s = alt ? PT.Spiel.laden(alt) : new PT.Spiel({ karte:d.einst.karte, stufe:d.einst.stufe, runden:d.einst.runden });
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
      if (autoWarte > 0) { autoWarte -= dt; if (autoWarte <= 0 && !spiel.laeuft && !spiel.vorbei) rundeStarten(); }
    }
    const ev = spiel.ereignisse.splice(0);
    if (ev.length) { welt.ereignisse(ev); PT.Ton.ereignisse(ev); ereignisse(ev); }
    if (auswahl && !spiel.tuerme.includes(auswahl)) turmWaehlen(null);
    welt.zeichnen(spiel, pausiert ? 0 : dt, auswahl);
    if (bannerZeit > 0) { bannerZeit -= dt; if (bannerZeit <= 0) $('#banner').classList.remove('an'); }
    anzeigen();
  }

  /* ---------- Los ---------- */
  function init() {
    try {
      bilder = PT.Welt.vorschauBilder(PT.PINGUIN_REIHE);
      fischBilder = PT.Welt.fischBilder();
    } catch (e) {
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
    $('#pNeu').onclick = () => { if (confirm('Wirklich neu anfangen? Der Fortschritt geht verloren.')) { wahl = { karte:spiel.karte, stufe:spiel.stufe }; neuesSpiel(); } };
    $('#pMenue').onclick = () => { speichern(); zumMenue(); };
    $('#pAufgeben').onclick = () => { if (confirm('Wirklich aufgeben? Dann zählen die bisher geschafften Runden.')) olympFertig(); };
    $('#auto').checked = speicher.lesen('pt-auto') === true;
    $('#auto').onchange = () => speicher.schreiben('pt-auto', $('#auto').checked);
    const c = $('#welt');
    c.addEventListener('pointerdown', zeigerRunter);
    c.addEventListener('pointermove', zeigerBewegt);
    c.addEventListener('pointerup', zeigerHoch);
    c.addEventListener('pointercancel', () => { gedrueckt = false; });
    c.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { zeiger = null; vorschau(); } });
    c.addEventListener('contextmenu', e => { e.preventDefault(); if (bauTyp) bauWaehlen(null); else turmWaehlen(null); });
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

    // Nur für den Rauchtest (test/browser.js): ?test im Link
    if (url.searchParams.has('test') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      window.__pt = {
        test() {
          spiel.geld = 100000;
          const plaene = [['zapfen', [0, 2, 3]], ['rundum', [2, 0, 3]], ['schneeball', [3, 2, 0]], ['frost', [0, 3, 2]],
            ['harpune', [2, 0, 3]], ['polar', [0, 4, 2]], ['markt', [3, 0, 2]], ['haeuptling', [2, 3, 0]], ['polar', [4, 0, 2]], ['zapfen', [4, 0, 2]]];
          let n = 0;
          for (const [typ, pf] of plaene) {
            let ok = false;
            for (let i = 0; i < 4000 && !ok; i++) {
              const p = spiel.weg.pts[(i * 37 + n * 211) % spiel.weg.pts.length];
              const w = i * 2.4;
              const x = p[0] + Math.cos(w) * 52, y = p[1] + Math.sin(w) * 52;
              if (spiel.platzFrei(typ, x, y)) {
                const t = spiel.bauen(typ, x, y);
                for (let k = 0; k < 3; k++) for (let s = 0; s < pf[k]; s++) spiel.upgraden(t, k);
                ok = true; n++;
              }
            }
          }
          spiel.runde = 38;
          return n;
        },
        fische() {
          spiel.fische = [];
          Object.keys(PT.FISCHE).forEach((typ, i) => {
            const f = spiel.neuerFisch(typ, 300 + i * 70, false);
            f.betaeubt = 999; f.wind = 1;
            const p = spiel.weg.punkt(f.dist); f.x = p[0]; f.y = p[1]; f.w = p[2];
          });
          const c = spiel.neuerFisch('gruen', 1100, true); c.betaeubt = 999;
          spiel.laeuft = true; spiel.warteschlange = []; spiel.kisten = []; spiel.tuerme = []; spiel.rundenZeit = 0;
          return spiel.fische.length;
        },
        welt() { return welt; },
        stand() { return { runde:spiel.runde, leben:spiel.leben, geld:spiel.geld, fische:spiel.fische.length, geschosse:spiel.geschosse.length, tuerme:spiel.tuerme.length }; }
      };
    }
  }
  init();
})();
