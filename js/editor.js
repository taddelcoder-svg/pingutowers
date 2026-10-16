'use strict';
// Pinguin Türmchen – Karten-Editor: Kanäle zeichnen, Eisberge, Wasserlöcher und Tunnel setzen, speichern, spielen, teilen.
// Die Karte wird mit PT.karteOk geprüft (daten.js) und über PT.UI (oberflaeche.js) gespeichert.
(function () {
  const PT = window.PT;
  const $ = s => document.querySelector(s);
  const W = PT.BREITE, H = PT.HOEHE, RAND = 26;
  const HINTERGRUND = { tag:['#f4fbff', '#d6eaf5'], daemmerung:['#fbeef0', '#dcd6ee'], nacht:['#2a3d63', '#15233f'], vulkan:['#6b6470', '#3d3842'] };

  let karte = null, aktiv = 0, werkzeug = 'kanal', zeiger = null, verlauf = [], geaendert = false;

  function leer() { return { id:null, name:'Meine Karte', thema:'tag', wege:[[]], hindernisse:[], wasser:[], tunnel:[] }; }
  function merken() { verlauf.push(JSON.stringify(karte)); if (verlauf.length > 60) verlauf.shift(); geaendert = true; }

  // Punkt am Rand: knapp außerhalb der Karte, damit die Fische von dort kommen bzw. dorthin schwimmen
  function amRand([x, y]) {
    if (x < RAND) x = -40; else if (x > W - RAND) x = W + 40;
    if (y < RAND) y = -40; else if (y > H - RAND) y = H + 40;
    return [Math.round(x), Math.round(y)];
  }
  function punktAus(e) {
    const c = $('#edCanvas'), r = c.getBoundingClientRect();
    return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
  }
  const groesse = () => +$('#edGroesse').value;

  /* ---------- Zeichnen ---------- */
  function zeichnen() {
    const c = $('#edCanvas'), x = c.getContext('2d');
    const nacht = karte.thema === 'nacht', vulkan = karte.thema === 'vulkan';
    const hg = HINTERGRUND[karte.thema] || HINTERGRUND.tag;
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, hg[0]); g.addColorStop(1, hg[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // Raster als Hilfe
    x.strokeStyle = nacht || vulkan ? 'rgba(255,255,255,0.07)' : 'rgba(19,49,92,0.06)'; x.lineWidth = 1;
    for (let i = 50; i < W; i += 50) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
    for (let i = 50; i < H; i += 50) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
    x.lineJoin = x.lineCap = 'round';
    karte.wege.forEach((w, i) => {
      if (w.length >= 2) {
        const weg = PT.wegBauen(w);
        const linie = (b, f) => { x.strokeStyle = f; x.lineWidth = b; x.beginPath(); weg.pts.forEach(([a, b2], k) => (k ? x.lineTo(a, b2) : x.moveTo(a, b2))); x.stroke(); };
        linie(66, nacht ? 'rgba(200,220,255,0.35)' : 'rgba(255,255,255,0.9)');
        linie(PT.WEG_BREITE, nacht ? '#1d5f8f' : '#2a8fc4');
        if (weg.lochEnde) { const [a, b2] = weg.pts[weg.pts.length - 1]; x.fillStyle = '#0d2c45'; x.beginPath(); x.arc(a, b2, 30, 0, Math.PI * 2); x.fill(); }
        // Richtungspfeile
        x.fillStyle = 'rgba(255,255,255,0.85)';
        for (let d = 80; d < weg.laenge - 40; d += 160) {
          const [px, py, wi] = weg.punkt(d);
          x.save(); x.translate(px, py); x.rotate(wi); x.beginPath(); x.moveTo(9, 0); x.lineTo(-6, -7); x.lineTo(-6, 7); x.closePath(); x.fill(); x.restore();
        }
      }
      // Eckpunkte des Kanals (der aktive hervorgehoben)
      w.forEach(([px, py], k) => {
        const cx = Math.max(8, Math.min(W - 8, px)), cy = Math.max(8, Math.min(H - 8, py));
        x.fillStyle = i === aktiv ? '#f6c343' : '#ffffff'; x.strokeStyle = '#13315c'; x.lineWidth = 3;
        x.beginPath(); x.arc(cx, cy, i === aktiv ? 9 : 7, 0, Math.PI * 2); x.fill(); x.stroke();
        if (k === 0) { x.fillStyle = nacht || vulkan ? '#ffffff' : '#13315c'; x.font = '800 15px system-ui'; x.textAlign = cx < 60 ? 'left' : cx > W - 60 ? 'right' : 'center'; x.fillText(`Start ${i + 1}`, cx, cy < 30 ? cy + 26 : cy - 15); }
      });
    });
    for (const [hx, hy, hr] of karte.hindernisse) {
      x.fillStyle = nacht ? '#6c7f9e' : vulkan ? '#2f2a33' : '#bfe0f2'; x.strokeStyle = 'rgba(19,49,92,0.35)'; x.lineWidth = 3;
      x.beginPath(); x.arc(hx, hy, hr, 0, Math.PI * 2); x.fill(); x.stroke();
      x.font = `${Math.round(hr)}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🏔️', hx, hy + 2); x.textBaseline = 'alphabetic';
    }
    for (const [wx, wy, wr] of karte.wasser) {
      x.fillStyle = '#2a8fc4'; x.strokeStyle = '#fff'; x.lineWidth = 5;
      x.beginPath(); x.arc(wx, wy, wr, 0, Math.PI * 2); x.fill(); x.stroke();
    }
    for (const [tx, ty, tr] of karte.tunnel) {
      x.fillStyle = 'rgba(228,245,255,0.88)'; x.strokeStyle = '#7fb8d8'; x.lineWidth = 4; x.setLineDash([12, 6]);
      x.beginPath(); x.arc(tx, ty, tr, 0, Math.PI * 2); x.fill(); x.stroke(); x.setLineDash([]);
      x.font = '700 15px system-ui'; x.fillStyle = '#13315c'; x.textAlign = 'center'; x.fillText('Tunnel', tx, ty + 5);
    }
    // Vorschau unter dem Zeiger
    if (zeiger) {
      const [zx, zy] = zeiger;
      x.globalAlpha = 0.55;
      if (werkzeug === 'kanal') {
        const w = karte.wege[aktiv] || [];
        const p = amRand(zeiger);
        if (w.length) { x.strokeStyle = '#2a8fc4'; x.lineWidth = PT.WEG_BREITE; x.beginPath(); x.moveTo(...w[w.length - 1]); x.lineTo(...p); x.stroke(); }
        x.fillStyle = '#f6c343'; x.beginPath(); x.arc(Math.max(8, Math.min(W - 8, p[0])), Math.max(8, Math.min(H - 8, p[1])), 9, 0, Math.PI * 2); x.fill();
      } else if (werkzeug !== 'radierer') {
        const r = werkzeug === 'tunnel' ? groesse() * 1.5 : groesse();
        x.fillStyle = werkzeug === 'wasser' ? '#2a8fc4' : werkzeug === 'tunnel' ? '#e4f5ff' : '#bfe0f2';
        x.beginPath(); x.arc(zx, zy, r, 0, Math.PI * 2); x.fill();
      } else { x.strokeStyle = '#e2463b'; x.lineWidth = 4; x.beginPath(); x.arc(zx, zy, 18, 0, Math.PI * 2); x.stroke(); }
      x.globalAlpha = 1;
    }
    pruefen();
  }

  function pruefen() {
    const info = $('#edInfo');
    const ok = PT.karteOk(karte);
    const tipps = { kanal:'Tippe Punkt für Punkt den Kanal. Am Rand tippen = die Fische kommen von außen. Endet der Kanal mitten auf der Karte, ist dort ein Eisloch.',
      eisberg:'Tippe aufs Eis, um Eisberge zu setzen – dort darf niemand bauen.', wasser:'Wasserlöcher sind für Boot-Pinguine.',
      tunnel:'Ein Tunnel über dem Kanal: Darunter sieht nur der Taucher-Pinguin die Fische.', radierer:'Tippe auf einen Punkt, Eisberg, Tunnel oder ein Wasserloch, um ihn zu löschen.' };
    if (!ok) {
      const kurz = karte.wege.every(w => w.length < 2) ? 'Zeichne zuerst einen Kanal (mindestens zwei Punkte).' : 'Jeder Kanal muss mindestens 500 lang sein – setz weitere Punkte.';
      info.textContent = `⚠️ ${kurz} ${tipps[werkzeug]}`;
      info.classList.add('fehler');
    } else {
      info.textContent = `✅ Spielbar! ${tipps[werkzeug]}`;
      info.classList.remove('fehler');
    }
    for (const id of ['edTesten', 'edSpeichern', 'edTeilen']) $('#' + id).disabled = !ok;
    $('#edNeuerKanal').disabled = karte.wege.length >= 3 || (karte.wege[aktiv] || []).length < 2;
    return ok;
  }

  /* ---------- Eingabe ---------- */
  function tippen(e) {
    const p = punktAus(e);
    if (werkzeug === 'kanal') {
      merken();
      const w = karte.wege[aktiv];
      if (w.length >= 24) return;
      w.push(amRand(p));
    } else if (werkzeug === 'radierer') {
      let best = null, bd = 24;
      karte.wege.forEach((w, i) => w.forEach(([px, py], k) => {
        const d = Math.hypot(Math.max(0, Math.min(W, px)) - p[0], Math.max(0, Math.min(H, py)) - p[1]);
        if (d < bd) { bd = d; best = () => { w.splice(k, 1); }; }
      }));
      for (const art of ['tunnel', 'wasser', 'hindernisse']) karte[art].forEach((k, i) => {
        const d = Math.hypot(k[0] - p[0], k[1] - p[1]) - k[2];
        if (d < bd) { bd = d; best = () => { karte[art].splice(i, 1); }; }
      });
      if (!best) return;
      merken(); best();
      karte.wege = karte.wege.filter((w, i) => w.length || i === 0);
      aktiv = Math.min(aktiv, karte.wege.length - 1);
    } else {
      const art = werkzeug === 'eisberg' ? 'hindernisse' : werkzeug;
      const max = { hindernisse:16, wasser:8, tunnel:4 }[art];
      if (karte[art].length >= max) { $('#edInfo').textContent = `Höchstens ${max} davon.`; return; }
      merken();
      const r = werkzeug === 'tunnel' ? Math.min(90, Math.round(groesse() * 1.5)) : groesse();
      karte[art].push([Math.round(Math.max(0, Math.min(W, p[0]))), Math.round(Math.max(0, Math.min(H, p[1]))), r]);
    }
    PT.Ton.klick();
    zeichnen();
  }
  function werkzeugWaehlen(w) {
    werkzeug = w;
    for (const b of document.querySelectorAll('[data-werkzeug]')) b.setAttribute('aria-pressed', b.dataset.werkzeug === w);
    zeichnen();
  }
  function daten() { return { ...karte, name:$('#edName').value.trim() || 'Meine Karte', thema:$('#edThema').value, wege:karte.wege.filter(w => w.length >= 2) }; }
  function speichern() {
    if (!pruefen()) return null;
    const neu = PT.UI.karteSpeichern(daten());
    if (neu) { karte.id = neu.id; geaendert = false; }
    return neu;
  }

  function oeffnen(k) {
    karte = k ? { id:k.id, name:k.name, thema:k.thema, wege:k.wege.map(w => w.map(p => p.slice())), hindernisse:k.hindernisse.map(h => h.slice()), wasser:(k.wasser || []).map(h => h.slice()), tunnel:(k.tunnel || []).map(h => h.slice()) } : leer();
    if (!karte.wege.length) karte.wege = [[]];
    aktiv = karte.wege.length - 1; verlauf = []; geaendert = false; zeiger = null;
    $('#edName').value = karte.name;
    $('#edThema').value = karte.thema;
    werkzeugWaehlen('kanal');
  }

  function init() {
    const c = $('#edCanvas');
    c.addEventListener('pointerdown', e => { e.preventDefault(); tippen(e); });
    c.addEventListener('pointermove', e => { zeiger = punktAus(e); zeichnen(); });
    c.addEventListener('pointerleave', () => { zeiger = null; zeichnen(); });
    for (const b of document.querySelectorAll('[data-werkzeug]')) b.onclick = () => { PT.Ton.klick(); werkzeugWaehlen(b.dataset.werkzeug); };
    $('#edGroesse').oninput = zeichnen;
    $('#edThema').onchange = () => { merken(); karte.thema = $('#edThema').value; zeichnen(); };
    $('#edName').oninput = () => { geaendert = true; };
    $('#edNeuerKanal').onclick = () => { if (karte.wege.length >= 3) return; merken(); karte.wege.push([]); aktiv = karte.wege.length - 1; werkzeugWaehlen('kanal'); };
    $('#edZurueck').onclick = () => { const v = verlauf.pop(); if (!v) return; karte = JSON.parse(v); aktiv = Math.min(aktiv, karte.wege.length - 1); $('#edThema').value = karte.thema; zeichnen(); };
    $('#edLeeren').onclick = () => { if (!confirm('Alles löschen und neu anfangen?')) return; merken(); const id = karte.id; karte = leer(); karte.id = id; aktiv = 0; zeichnen(); };
    $('#edSpeichern').onclick = () => { const k = speichern(); if (k) { PT.Ton.upgrade(); $('#edInfo').textContent = `💾 „${k.name}“ gespeichert. Du findest sie im Menü bei den Karten.`; } };
    $('#edTesten').onclick = () => { const k = speichern(); if (k) { PT.Ton.start(); PT.UI.editorZu(k, true); } };
    $('#edTeilen').onclick = () => { const k = speichern(); if (k) PT.UI.karteTeilen(k); };
    $('#edRaus').onclick = () => {
      if (geaendert && PT.karteOk(daten()) && confirm('Änderungen speichern?')) { const k = speichern(); PT.UI.editorZu(k, false); return; }
      PT.UI.editorZu(null, false);
    };
  }
  init();
  PT.Editor = { oeffnen, daten:() => daten(), tippen:(x, y) => {
    // nur für Tests: tippt auf Kartenkoordinaten
    const c = $('#edCanvas'), r = c.getBoundingClientRect();
    tippen({ clientX:r.left + x * r.width / W, clientY:r.top + y * r.height / H });
  }, werkzeug:werkzeugWaehlen };
})();
