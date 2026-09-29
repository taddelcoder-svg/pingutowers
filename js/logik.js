'use strict';
// Pingu Towers – Spiellogik. Rechnet auf der flachen Karte (x nach rechts, y nach unten, 1000 × 640),
// kennt keine Grafik. Was passiert (Schüsse, Treffer, Platzer, Geld …), landet in spiel.ereignisse
// und wird von der 3D-Darstellung abgeholt. Läuft auch in Node (test/sim.js).
(function (wurzel) {
  const PT = wurzel.PT || require('./daten.js');
  const { FISCHE, PINGUINE } = PT;

  const SCHRITT = 2;          // Abstand der Wegpunkte in Pixeln
  const ZELLE = 64;           // Rastergröße für die Kollisionssuche
  const TURM_R = { markt:26, haeuptling:19 };
  PT.turmRadius = typ => TURM_R[typ] || 17;

  /* ---------- Weg: abgerundete Ecken, gleichmäßig abgetastet ---------- */
  function wegBauen(ecken) {
    const roh = [];
    const r = 55;
    roh.push(ecken[0]);
    for (let i = 1; i < ecken.length - 1; i++) {
      const [px, py] = ecken[i - 1], [cx, cy] = ecken[i], [nx, ny] = ecken[i + 1];
      const l1 = Math.hypot(cx - px, cy - py), l2 = Math.hypot(nx - cx, ny - cy);
      const k = Math.min(r, l1 / 2, l2 / 2);
      const ax = cx + (px - cx) / l1 * k, ay = cy + (py - cy) / l1 * k;
      const bx = cx + (nx - cx) / l2 * k, by = cy + (ny - cy) / l2 * k;
      for (let t = 0; t <= 1; t += 0.05) {
        const u = 1 - t;
        roh.push([u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by]);
      }
    }
    roh.push(ecken[ecken.length - 1]);
    // gleichmäßig neu abtasten
    const pts = [roh[0].slice()];
    let rest = 0;
    for (let i = 1; i < roh.length; i++) {
      const [ax, ay] = roh[i - 1], [bx, by] = roh[i];
      const l = Math.hypot(bx - ax, by - ay);
      let d = SCHRITT - rest;
      while (d <= l) { pts.push([ax + (bx - ax) * d / l, ay + (by - ay) * d / l]); d += SCHRITT; }
      rest = l - (d - SCHRITT);
    }
    const laenge = (pts.length - 1) * SCHRITT;
    return {
      pts, laenge,
      punkt(dist) {
        const f = Math.max(0, Math.min(dist, laenge)) / SCHRITT;
        const i = Math.min(pts.length - 2, Math.floor(f)), t = f - i;
        const a = pts[i], b = pts[i + 1];
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
      },
      abstand(x, y) {
        let m = Infinity;
        for (let i = 0; i < pts.length; i += 2) { const d = (pts[i][0] - x) ** 2 + (pts[i][1] - y) ** 2; if (d < m) m = d; }
        return Math.sqrt(m);
      }
    };
  }
  PT.wegBauen = wegBauen;

  function rbeRest(f) {
    const t = FISCHE[f.typ];
    return Math.max(1, Math.ceil(f.hp)) + t.kinder.reduce((s, k) => s + FISCHE[k].rbe, 0);
  }

  class Spiel {
    constructor({ karte = 'scholle', stufe = 'mittel', runden = null } = {}) {
      this.karte = karte;
      this.stufe = stufe;
      this.kartenDaten = PT.KARTEN[karte];
      this.weg = wegBauen(this.kartenDaten.weg);
      const st = PT.STUFEN[stufe];
      this.zielRunden = runden || st.runden;
      this.geld = st.geld;
      this.leben = st.leben;
      this.startLeben = st.leben;
      this.runde = 0;            // abgeschlossene Runden
      this.laeuft = false;       // gerade kommen Fische
      this.vorbei = false;       // verloren
      this.gewonnen = false;
      this.endlos = false;
      this.fische = [];
      this.geschosse = [];
      this.tuerme = [];
      this.ereignisse = [];
      this.naechsteId = 1;
      this.zeit = 0;
      this.statistik = { platzer:0, geleakt:0 };
    }

    /* ---------- Bauen ---------- */
    rabattAn(x, y, ohne) {
      let r = 0;
      for (const t of this.tuerme) {
        if (t === ohne || !t.werte.buff || !t.werte.buff.rabatt) continue;
        if (Math.hypot(t.x - x, t.y - y) <= t.werte.reichweite) r = Math.max(r, t.werte.buff.rabatt);
      }
      return r;
    }
    preisBau(typ, x, y) { return PT.preis(PINGUINE[typ].preis, this.stufe, x == null ? 0 : this.rabattAn(x, y)); }
    preisUpgrade(t, i) {
      const u = PINGUINE[t.typ].pfade[i][t.pfade[i]];
      return u ? PT.preis(u.preis, this.stufe, this.rabattAn(t.x, t.y, t)) : Infinity;
    }
    platzFrei(typ, x, y, ohne) {
      const r = PT.turmRadius(typ);
      if (x < r || y < r || x > PT.BREITE - r || y > PT.HOEHE - r) return false;
      if (this.weg.abstand(x, y) < PT.WEG_BREITE / 2 + r - 2) return false;
      for (const [hx, hy, hr] of this.kartenDaten.hindernisse) if (Math.hypot(hx - x, hy - y) < hr + r - 4) return false;
      for (const t of this.tuerme) if (t !== ohne && Math.hypot(t.x - x, t.y - y) < PT.turmRadius(t.typ) + r) return false;
      return true;
    }
    bauen(typ, x, y) {
      if (this.vorbei || !this.platzFrei(typ, x, y)) return null;
      const preis = this.preisBau(typ, x, y);
      if (preis > this.geld) return null;
      this.geld -= preis;
      const t = { id:this.naechsteId++, typ, x, y, pfade:[0, 0, 0], ziel:'erster', investiert:preis, pops:0, winkel:-Math.PI / 2, dreh:0, cd:[] };
      this.tuerme.push(t);
      this.neuBerechnen();
      this.ereignisse.push({ art:'gebaut', turm:t });
      return t;
    }
    upgraden(t, i) {
      if (this.vorbei || !PT.upgradeErlaubt(t.pfade, i)) return false;
      const preis = this.preisUpgrade(t, i);
      if (preis > this.geld) return false;
      this.geld -= preis;
      t.investiert += preis;
      t.pfade[i]++;
      this.neuBerechnen();
      this.ereignisse.push({ art:'upgrade', turm:t, pfad:i });
      return true;
    }
    verkaufswert(t) { return Math.floor(t.investiert * PT.VERKAUF); }
    verkaufen(t) {
      const i = this.tuerme.indexOf(t);
      if (i < 0) return;
      this.tuerme.splice(i, 1);
      this.geld += this.verkaufswert(t);
      this.neuBerechnen();
      this.ereignisse.push({ art:'verkauft', turm:t });
    }

    // Werte aller Pinguine neu bestimmen (Upgrades und Häuptlings-Boni)
    neuBerechnen() {
      for (const t of this.tuerme) t.werte = PT.werteFuer(t.typ, t.pfade);
      const haeupter = this.tuerme.filter(t => t.werte.buff);
      for (const t of this.tuerme) {
        const e = { ...t.werte, angriffe:t.werte.angriffe.map(a => ({ ...a })) };
        let b = null;
        for (const h of haeupter) {
          if (h === t || Math.hypot(h.x - t.x, h.y - t.y) > h.werte.reichweite) continue;
          const hb = h.werte.buff;
          b = b || { reichweite:0, camo:false, tempo:1, schaden:0, durchschlag:0 };
          b.reichweite = Math.max(b.reichweite, hb.reichweite);
          b.camo = b.camo || hb.camo;
          b.tempo = Math.min(b.tempo, hb.tempo);
          b.schaden = Math.max(b.schaden, hb.schaden);
          b.durchschlag = Math.max(b.durchschlag, hb.durchschlag);
        }
        if (b && !t.werte.buff) {
          if (e.reichweite < 5000) e.reichweite *= 1 + b.reichweite;
          e.camo = e.camo || b.camo;
          for (const a of e.angriffe) {
            a.intervall *= b.tempo; a.schaden += b.schaden; a.durchschlag += b.durchschlag;
            if (a.reichweite) a.reichweite *= 1 + b.reichweite;
            if (a.art === 'wurf' || a.art === 'rundum') a.flug *= 1 + b.reichweite;
          }
        }
        e.gebufft = !!b;
        t.eff = e;
        while (t.cd.length < e.angriffe.length) t.cd.push(0);
        t.cd.length = e.angriffe.length;
      }
    }

    /* ---------- Runden ---------- */
    rundeStarten() {
      if (this.laeuft || this.vorbei || (this.gewonnen && !this.endlos)) return false;
      const n = this.runde + 1;
      const r = PT.runde(n);
      this.laeuft = true;
      this.rundenZeit = 0;
      this.zaeh = r.zaeh;
      this.warteschlange = [];
      let ende = 0;
      for (const g of r.gruppen) {
        for (let i = 0; i < g.anzahl; i++) this.warteschlange.push({ t:g.start + i * g.abstand, typ:g.typ, camo:g.camo });
        ende = Math.max(ende, g.start + g.anzahl * g.abstand);
      }
      this.warteschlange.sort((a, b) => b.t - a.t);   // hinten die nächsten
      // Kisten der Fischmärkte über die Runde verteilen
      this.kisten = [];
      const dauer = Math.max(6, Math.min(ende, 30));
      for (const t of this.tuerme) {
        const g = t.eff.geld;
        if (!g || !g.kisten) continue;
        for (let i = 0; i < g.kisten; i++) this.kisten.push({ t:(i + 1) * dauer / (g.kisten + 1), turm:t, wert:Math.round(g.wert) });
      }
      this.kisten.sort((a, b) => b.t - a.t);
      this.ereignisse.push({ art:'rundeStart', runde:n });
      return true;
    }

    neuerFisch(typ, dist, camo, vorbild) {
      const f = {
        id:this.naechsteId++, typ, hp:FISCHE[typ].hp * (FISCHE[typ].riese ? this.zaeh || 1 : 1), dist, camo,
        frost:0, betaeubt:0, langsam:1, langsamT:0, wind:1, x:-100, y:-100, w:0, tot:false, geboren:this.zeit
      };
      f.hpMax = f.hp;
      if (vorbild) {
        const riese = FISCHE[typ].riese, eis = (FISCHE[typ].immun || []).includes('kaelte');
        if (!riese && !eis) f.frost = vorbild.frost;
        if (!riese) f.betaeubt = vorbild.betaeubt;
        if (!riese) { f.langsam = vorbild.langsam; f.langsamT = vorbild.langsamT; }
      }
      this.fische.push(f);
      return f;
    }

    /* ---------- Schaden ---------- */
    immun(f, typ, a) {
      if (a && a.panzerBrecher && f.typ === 'panzer') return false;
      const im = FISCHE[f.typ].immun;
      return !!im && im.includes(typ);
    }
    treffer(f, a, turm, getroffen) {
      if (f.tot || this.immun(f, a.typ, a)) return false;
      const riese = FISCHE[f.typ].riese;
      if (a.frost && !riese && !this.immun(f, 'kaelte')) f.frost = Math.max(f.frost, a.frost);
      if (a.verlangsam && !riese) { f.langsam = Math.min(f.langsam, a.verlangsam); f.langsamT = Math.max(f.langsamT, a.verlangsamDauer); }
      if (a.riesenLangsam && riese) { f.langsam = Math.min(f.langsam, a.riesenLangsam); f.langsamT = Math.max(f.langsamT, 1.5); }
      if (a.betaeuben && !riese) f.betaeubt = Math.max(f.betaeubt, a.betaeuben);
      if (a.riesenBetaeuben && riese) f.betaeubt = Math.max(f.betaeubt, a.riesenBetaeuben);
      f.hp -= a.schaden + (riese ? a.riesen : 0);
      if (riese) this.ereignisse.push({ art:'riesenTreffer', fisch:f });
      if (f.hp <= 0) this.platzen(f, -f.hp, turm, getroffen, a.typ);
      return true;
    }
    platzen(f, ueber, turm, getroffen, typ) {
      f.tot = true;
      this.geld += 1;
      this.statistik.platzer++;
      if (turm) turm.pops++;
      this.ereignisse.push({ art:'platzen', x:f.x, y:f.y, typ:f.typ });
      const kinder = FISCHE[f.typ].kinder;
      const neue = [];
      kinder.forEach((k, i) => {
        const c = this.neuerFisch(k, Math.max(0, f.dist - i * (FISCHE[f.typ].riese ? 14 : 7)), f.camo, f);
        c.x = f.x; c.y = f.y; c.w = f.w;
        if (getroffen) getroffen.add(c.id);
        neue.push(c);
      });
      if (ueber > 0) {
        const c = neue.find(c => !this.immun(c, typ));
        if (c) { c.hp -= ueber; if (c.hp <= 0) this.platzen(c, -c.hp, turm, getroffen, typ); }
      }
    }

    /* ---------- Ziele ---------- */
    kannSehen(f, camo) { return !f.tot && (!f.camo || camo) && f.x > -5 && f.x < PT.BREITE + 5 && f.y > -5 && f.y < PT.HOEHE + 5; }
    zielSuchen(t, a, reichweite) {
      let best = null, bw = -Infinity;
      const modus = t.ziel;
      for (const f of this.fische) {
        if (!this.kannSehen(f, t.eff.camo) || this.immun(f, a.typ, a)) continue;
        const d = Math.hypot(f.x - t.x, f.y - t.y);
        if (d > reichweite + FISCHE[f.typ].r * 0.6) continue;
        let w;
        if (modus === 'erster') w = f.dist;
        else if (modus === 'letzter') w = -f.dist;
        else if (modus === 'stark') w = FISCHE[f.typ].rbe * 10000 + f.dist;
        else w = -d;
        if (w > bw) { bw = w; best = f; }
      }
      return best;
    }
    tempo(f) {
      if (f.frost > 0 || f.betaeubt > 0) return 0;
      return FISCHE[f.typ].tempo * f.langsam * f.wind;
    }

    /* ---------- Angriffe ---------- */
    feuern(t, a) {
      const R = a.reichweite || t.eff.reichweite;
      if (a.art === 'ring' || a.art === 'frost') {
        let n = 0, traf = false;
        for (const f of this.fische) {
          if (n >= a.durchschlag) break;
          if (!this.kannSehen(f, t.eff.camo)) continue;
          if (Math.hypot(f.x - t.x, f.y - t.y) > R + FISCHE[f.typ].r * 0.6) continue;
          traf = true;
          if (this.treffer(f, a, t, null)) n++;
          else if (a.art === 'frost' && FISCHE[f.typ].riese) n++;
        }
        if (!traf) return false;
        this.ereignisse.push({ art:'ring', x:t.x, y:t.y, r:R, bild:a.bild, turm:t });
        return true;
      }
      const ziel = this.zielSuchen(t, a, R);
      if (!ziel) return false;
      t.winkel = Math.atan2(ziel.y - t.y, ziel.x - t.x);

      if (a.art === 'sofort') {
        this.ereignisse.push({ art:'strahl', x1:t.x, y1:t.y, x2:ziel.x, y2:ziel.y, bild:a.bild, turm:t });
        const zx = ziel.x, zy = ziel.y;
        this.treffer(ziel, a, t, null);
        if (a.splash) this.explosion(zx, zy, a, t, ziel.id);
        return true;
      }
      if (a.art === 'blitz') {
        const pts = [[t.x, t.y]];
        const schon = new Set();
        let f = ziel;
        for (let k = 0; k < a.kette && f; k++) {
          schon.add(f.id);
          pts.push([f.x, f.y]);
          const fx = f.x, fy = f.y;
          this.treffer(f, a, t, schon);
          let naechst = null, nd = a.kettenWeite;
          for (const g of this.fische) {
            if (g.tot || schon.has(g.id) || !this.kannSehen(g, true) || this.immun(g, a.typ)) continue;
            const d = Math.hypot(g.x - fx, g.y - fy);
            if (d < nd) { nd = d; naechst = g; }
          }
          f = naechst;
        }
        this.ereignisse.push({ art:'blitz', pts, bild:a.bild, turm:t });
        return true;
      }
      // Geschosse: auf die Stelle zielen, an der der Fisch gleich ist
      let zx = ziel.x, zy = ziel.y;
      if (a.art === 'wurf') {
        const flugzeit = Math.hypot(ziel.x - t.x, ziel.y - t.y) / a.tempo;
        const p = this.weg.punkt(ziel.dist + this.tempo(ziel) * flugzeit);
        zx = p[0]; zy = p[1];
      }
      const basis = Math.atan2(zy - t.y, zx - t.x);
      if (a.art === 'wurf') t.winkel = basis;
      const n = a.anzahl;
      for (let i = 0; i < n; i++) {
        const w = a.art === 'rundum' ? t.dreh + i * Math.PI * 2 / n : basis + (i - (n - 1) / 2) * a.streuung;
        this.geschossDazu(t, a, t.x, t.y, w, ziel.id);
      }
      if (a.art === 'rundum') t.dreh += 0.2;
      this.ereignisse.push({ art:'wurf', turm:t, bild:a.bild });
      return true;
    }
    geschossDazu(t, a, x, y, w, zielId) {
      this.geschosse.push({
        id:this.naechsteId++, x, y, vx:Math.cos(w) * a.tempo, vy:Math.sin(w) * a.tempo, rest:a.flug,
        durchschlag:a.durchschlag, a, turm:t, getroffen:new Set(), ziel:zielId, bild:a.bild, groesse:a.groesse
      });
    }
    explosion(x, y, a, t, ohne) {
      let n = 0;
      const r2 = a.splash;
      for (const f of this.fische) {
        if (n >= a.splashDurchschlag) break;
        if (f.tot || f.id === ohne) continue;
        if (Math.hypot(f.x - x, f.y - y) > r2 + FISCHE[f.typ].r * 0.5) continue;
        if (this.treffer(f, a, t, null)) n++;
      }
      this.ereignisse.push({ art:'explosion', x, y, r:r2, bild:a.bild });
      if (a.splitter) {
        const klein = { ...a, splitter:0, splash:24, splashDurchschlag:6, flug:75, tempo:300, groesse:5, bild:'schneeballKlein', riesen:Math.floor(a.riesen / 3) };
        for (let i = 0; i < a.splitter; i++) this.geschossDazu(t, klein, x, y, i * Math.PI * 2 / a.splitter, null);
      }
    }

    /* ---------- Ein Zeitschritt ---------- */
    schritt(dt) {
      if (this.vorbei) return;
      this.zeit += dt;
      if (this.laeuft) {
        this.rundenZeit += dt;
        const q = this.warteschlange;
        while (q.length && q[q.length - 1].t <= this.rundenZeit) {
          const s = q.pop();
          this.neuerFisch(s.typ, 0, s.camo);
        }
        const k = this.kisten;
        while (k.length && k[k.length - 1].t <= this.rundenZeit) {
          const s = k.pop();
          if (!this.tuerme.includes(s.turm)) continue;
          this.geld += s.wert;
          this.ereignisse.push({ art:'kiste', turm:s.turm, wert:s.wert });
        }
      }

      // Wind und Leuchtfeuer der Pinguine
      const wind = this.tuerme.filter(t => t.eff.wind);
      const leucht = this.tuerme.filter(t => t.eff.enttarnen);
      const ueberall = leucht.some(t => t.eff.enttarnenUeberall);

      // Fische bewegen
      for (const f of this.fische) {
        if (f.tot) continue;
        f.wind = 1;
        for (const t of wind) {
          if (Math.hypot(f.x - t.x, f.y - t.y) <= t.eff.reichweite) f.wind = Math.min(f.wind, FISCHE[f.typ].riese ? Math.max(t.eff.wind, 0.8) : t.eff.wind);
        }
        if (f.camo && (ueberall || leucht.some(t => Math.hypot(f.x - t.x, f.y - t.y) <= t.eff.reichweite))) f.camo = false;
        const v = this.tempo(f);
        if (f.frost > 0) f.frost -= dt;
        if (f.betaeubt > 0) f.betaeubt -= dt;
        if (f.langsamT > 0) { f.langsamT -= dt; if (f.langsamT <= 0) f.langsam = 1; }
        f.dist += v * dt;
        if (f.dist >= this.weg.laenge) {
          f.tot = true;
          const verlust = rbeRest(f);
          this.leben -= verlust;
          this.statistik.geleakt += verlust;
          this.ereignisse.push({ art:'leck', typ:f.typ, verlust });
          continue;
        }
        const p = this.weg.punkt(f.dist);
        f.x = p[0]; f.y = p[1]; f.w = p[2];
      }
      if (this.leben <= 0) {
        this.leben = 0;
        this.vorbei = true;
        this.laeuft = false;
        this.ereignisse.push({ art:'verloren' });
        return;
      }

      // Pinguine greifen an
      for (const t of this.tuerme) {
        const angriffe = t.eff.angriffe;
        for (let i = 0; i < angriffe.length; i++) {
          const a = angriffe[i];
          t.cd[i] -= dt;
          if (t.cd[i] > 0) continue;
          if (this.feuern(t, a)) t.cd[i] = Math.max(t.cd[i] + a.intervall, a.intervall * 0.5);
          else t.cd[i] = 0;
        }
      }

      // Raster für die Geschosse
      const raster = new Map();
      for (const f of this.fische) {
        if (f.tot) continue;
        const k = Math.floor(f.x / ZELLE) * 1000 + Math.floor(f.y / ZELLE);
        let l = raster.get(k);
        if (!l) raster.set(k, l = []);
        l.push(f);
      }

      // Geschosse bewegen und treffen lassen
      for (const g of this.geschosse) {
        if (g.weg) continue;
        if (g.a.zielsuchend) {
          let z = g.ziel && this.fische.find(f => f.id === g.ziel && !f.tot);
          if (!z) {
            let nd = 220; z = null;
            for (const f of this.fische) {
              if (!this.kannSehen(f, true) || g.getroffen.has(f.id)) continue;
              const d = Math.hypot(f.x - g.x, f.y - g.y);
              if (d < nd) { nd = d; z = f; }
            }
            g.ziel = z ? z.id : null;
          }
          if (z) {
            const soll = Math.atan2(z.y - g.y, z.x - g.x), ist = Math.atan2(g.vy, g.vx);
            let d = soll - ist;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            const w = ist + Math.max(-8 * dt, Math.min(8 * dt, d));
            const v = Math.hypot(g.vx, g.vy);
            g.vx = Math.cos(w) * v; g.vy = Math.sin(w) * v;
          }
        }
        const sx = g.vx * dt, sy = g.vy * dt;
        g.x += sx; g.y += sy;
        g.rest -= Math.hypot(sx, sy);
        if (g.rest <= 0 || g.x < -60 || g.y < -60 || g.x > PT.BREITE + 60 || g.y > PT.HOEHE + 60) { g.weg = true; continue; }
        const cx = Math.floor(g.x / ZELLE), cy = Math.floor(g.y / ZELLE);
        treffen:
        for (let ix = cx - 1; ix <= cx + 1; ix++) {
          for (let iy = cy - 1; iy <= cy + 1; iy++) {
            const l = raster.get(ix * 1000 + iy);
            if (!l) continue;
            for (const f of l) {
              if (f.tot || g.getroffen.has(f.id)) continue;
              const r = FISCHE[f.typ].r + g.groesse;
              if ((f.x - g.x) ** 2 + (f.y - g.y) ** 2 > r * r) continue;
              if (g.a.splash) {
                this.treffer(f, g.a, g.turm, null);
                this.explosion(g.x, g.y, g.a, g.turm, f.id);
                g.weg = true;
                break treffen;
              }
              g.getroffen.add(f.id);
              this.treffer(f, g.a, g.turm, g.getroffen);
              if (--g.durchschlag <= 0) { g.weg = true; break treffen; }
            }
          }
        }
      }
      this.geschosse = this.geschosse.filter(g => !g.weg);
      if (this.fische.some(f => f.tot)) this.fische = this.fische.filter(f => !f.tot);

      // Runde vorbei?
      if (this.laeuft && !this.warteschlange.length && !this.fische.length) {
        this.laeuft = false;
        this.runde++;
        let bonus = PT.rundenBonus(this.runde);
        for (const t of this.tuerme) if (t.eff.geld && t.eff.geld.flat) bonus += t.eff.geld.flat;
        for (const k of this.kisten) if (this.tuerme.includes(k.turm)) bonus += k.wert;   // übrige Kisten
        this.kisten = [];
        this.geld += bonus;
        this.geschosse = [];
        this.ereignisse.push({ art:'rundeEnde', runde:this.runde, bonus });
        if (this.runde >= this.zielRunden && !this.gewonnen) {
          this.gewonnen = true;
          this.ereignisse.push({ art:'gewonnen' });
        }
      }
    }

    /* ---------- Speichern (nur zwischen den Runden) ---------- */
    speichern() {
      return {
        v:1, karte:this.karte, stufe:this.stufe, zielRunden:this.zielRunden, runde:this.runde, geld:this.geld,
        leben:this.leben, gewonnen:this.gewonnen, endlos:this.endlos, statistik:this.statistik,
        tuerme:this.tuerme.map(t => ({ typ:t.typ, x:t.x, y:t.y, pfade:t.pfade, ziel:t.ziel, investiert:t.investiert, pops:t.pops }))
      };
    }
    static laden(d) {
      const s = new Spiel({ karte:d.karte, stufe:d.stufe, runden:d.zielRunden });
      Object.assign(s, { runde:d.runde, geld:d.geld, leben:d.leben, gewonnen:!!d.gewonnen, endlos:!!d.endlos, statistik:d.statistik || s.statistik });
      for (const t of d.tuerme || []) {
        if (!PINGUINE[t.typ]) continue;
        s.tuerme.push({ id:s.naechsteId++, typ:t.typ, x:t.x, y:t.y, pfade:t.pfade.slice(0, 3), ziel:t.ziel || 'erster', investiert:t.investiert, pops:t.pops || 0, winkel:-Math.PI / 2, dreh:0, cd:[] });
      }
      s.neuBerechnen();
      return s;
    }
  }
  PT.Spiel = Spiel;
  PT.ZIELE = [['erster', 'Erster'], ['letzter', 'Letzter'], ['stark', 'Stärkster'], ['nah', 'Nächster']];

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
