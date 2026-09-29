'use strict';
// Pingu Towers – Server: liefert das Spiel aus. Gespielt wird komplett im Browser.
// Als Disziplin der Olympiade kommt man per Ticket (?olymp=…) herein; der Browser meldet
// sich über /api/olymp, und der Server gibt das Ergebnis signiert an die Olympiade weiter (olymp.js).
const http = require('http');
const fs = require('fs');
const path = require('path');
const zugang = require('./zugang')({ titel:'Pingu Towers', offen:['/api/olymp'] });
const olymp = require('./olymp')({ spiel:'pingutowers' });
const PT = require('./js/daten.js');

const PORT = Number(process.env.PORT) || 10700;

const SEITEN = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/datenschutz': 'datenschutz.html',
  '/datenschutz.html': 'datenschutz.html'
};
const TYPEN = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.woff2':'font/woff2',
  '.txt':'text/plain; charset=utf-8'
};

function senden(res, datei, cache){
  fs.stat(datei, (fehler, info) => {
    if (fehler || !info.isFile()){
      res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
      return res.end('Nicht gefunden');
    }
    res.writeHead(200, {
      'Content-Type':TYPEN[path.extname(datei)] || 'application/octet-stream',
      'Cache-Control':cache,
      'X-Content-Type-Options':'nosniff'
    });
    fs.createReadStream(datei).pipe(res);
  });
}
function json(res, status, daten){
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
  res.end(JSON.stringify(daten));
}
function koerperLesen(req){
  return new Promise((ok, nein) => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 8000){ nein(new Error('zu groß')); req.destroy(); } });
    req.on('end', () => ok(d));
    req.on('error', nein);
  });
}

/* ---------- Olympiade ---------- */
// Einstellungen der Disziplin gegen die Spieldaten prüfen
function einstellungen(c){
  return {
    karte:PT.KARTEN[c.karte] ? c.karte : 'scholle',
    stufe:PT.STUFEN[c.stufe] ? c.stufe : 'mittel',
    runden:[20, 30, 40].includes(c.runden) ? c.runden : 30
  };
}
// Wer hat schon gemeldet (Lauf + Spieler) – jeder hat nur einen Versuch
const ergebnisse = new Map();
const lebenszeichen = new Map();
setInterval(() => {
  const j = Date.now();
  for (const [k, e] of ergebnisse) if (j - e.zeit > 12 * 3600_000) ergebnisse.delete(k);
  for (const [k, z] of lebenszeichen) if (j - z > 3600_000) lebenszeichen.delete(k);
}, 600_000).unref();

async function olympAnfrage(req, res){
  let m;
  try { m = JSON.parse(await koerperLesen(req)); } catch (e) { return json(res, 400, { ok:false, fehler:'Anfrage kaputt' }); }
  const t = olymp.ticketPruefen(m && m.ticket);
  if (!t) return json(res, 403, { ok:false, fehler:'Das Olympia-Ticket ist ungültig oder abgelaufen. Hol dir in der Olympiade ein neues.' });
  const key = `${t.l}:${t.s}`;
  const einst = einstellungen(t.c);
  const schon = ergebnisse.get(key);

  if (m.aktion === 'info') return json(res, 200, { ok:true, info:olymp.fuerBrowser(t), einst, ergebnis:schon ? schon.text : null });

  if (m.aktion === 'da'){
    // Lebenszeichen: höchstens alle 20 Sekunden weitergeben (hält die Olympiade auch wach)
    const z = lebenszeichen.get(key) || 0;
    if (!schon && Date.now() - z > 20_000){ lebenszeichen.set(key, Date.now()); olymp.da(t, t.s); }
    return json(res, 200, { ok:true });
  }

  if (m.aktion === 'ergebnis'){
    if (schon) return json(res, 200, { ok:true, text:schon.text });
    const runden = Math.max(0, Math.min(einst.runden, Math.floor(Number(m.runden) || 0)));
    const leben = runden >= einst.runden ? Math.max(0, Math.min(PT.STUFEN[einst.stufe].leben, Math.floor(Number(m.leben) || 0))) : 0;
    // Wer weiter kommt, gewinnt; bei Gleichstand zählen die übrigen Leben
    const wert = runden * 1000 + leben;
    const text = runden >= einst.runden ? `Alle ${runden} Runden, ${leben} Leben übrig` : `${runden} von ${einst.runden} Runden`;
    ergebnisse.set(key, { text, zeit:Date.now() });
    olymp.wertMelden(t, t.s, wert, text);
    return json(res, 200, { ok:true, text });
  }
  json(res, 400, { ok:false, fehler:'Unbekannte Aktion' });
}

/* ---------- HTTP ---------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') return json(res, 200, { ok:true });
  if (url.pathname === '/datenschutz' || url.pathname === '/datenschutz.html') return senden(res, path.join(__dirname, 'datenschutz.html'), 'no-cache');
  // Olympia-Meldungen sind durch das signierte Ticket geschützt, nicht durch das Passwort-Cookie
  if (url.pathname === '/api/olymp'){
    if (req.method !== 'POST') return json(res, 405, { ok:false });
    return olympAnfrage(req, res).catch(() => json(res, 500, { ok:false, fehler:'Serverfehler' }));
  }
  // Passwort für Familie und Freunde; ein gültiges Olympia-Ticket im Link ersetzt es (zugang.js)
  if (zugang.pruefen(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'HEAD'){
    res.writeHead(405, { 'Content-Type':'text/plain; charset=utf-8', Allow:'GET, HEAD' });
    return res.end('Nicht erlaubt');
  }
  if (SEITEN[url.pathname]) return senden(res, path.join(__dirname, SEITEN[url.pathname]), 'no-cache');

  // Spielcode: bei jedem Aufruf kurz nachfragen, damit Updates sofort ankommen
  const js = /^\/js\/([a-z0-9-]+\.js)$/.exec(url.pathname);
  if (js) return senden(res, path.join(__dirname, 'js', js[1]), 'no-cache');

  // Selbst ausgelieferte Schrift und three.js (keine Verbindung zu Google oder CDNs)
  const statisch = /^\/(vendor|fonts)\/([\w-]+(?:\.[\w-]+)*\.(js|woff2|txt))$/.exec(url.pathname);
  if (statisch) return senden(res, path.join(__dirname, statisch[1], statisch[2]), 'public, max-age=604800');

  res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
  res.end('Nicht gefunden');
});

server.listen(PORT, () => console.log(`Pingu Towers läuft auf http://localhost:${PORT}`));
