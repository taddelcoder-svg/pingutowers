'use strict';
// Pingu Towers – Spiellogik. Rechnet auf der flachen Karte (x nach rechts, y nach unten, 1000 × 640),
// kennt keine Grafik. Was passiert (Schüsse, Treffer, Platzer, Geld …), landet in spiel.ereignisse
// und wird von der 3D-Darstellung abgeholt. Läuft auch in Node (test/sim.js).
(function (wurzel) {
  const PT = wurzel.PT || require('./pinguine.js');
  const { FISCHE } = PT;

  const SCHRITT = 2;          // Abstand der Wegpunkte in Pixeln
  const ZELLE = 64;           // Rastergröße für die Kollisionssuche
  const TURM_R = { markt:26, haeuptling:19, boot:20, flieger:20, fabrik:21, moerser:19 };
  PT.turmRadius = typ => TURM_R[typ] || 17;
  const MAX_HAUFEN = 40;      // so viele Stachelhaufen darf eine Fabrik gleichzeitig liegen haben

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
    const drin = ([x, y]) => x >= 0 && x <= PT.BREITE && y >= 0 && y <= PT.HOEHE;
    const erster = pts.findIndex(drin), letzter = pts.length - 1 - [...pts].reverse().findIndex(drin);
    return {
      pts, laenge,
      // Abschnitt, der auf der Karte liegt (für Mörser, Fallen und Fähigkeiten)
      vonDist:erster * SCHRITT, bisDist:letzter * SCHRITT,
      // endet der Kanal mitten auf der Karte? Dann ist dort ein Eisloch
      lochEnde:drin(pts[pts.length - 1]), lochAnfang:drin(pts[0]),
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

  // Leben, die ein Fisch kostet, wenn er durchkommt (ein Boss beendet das Spiel)
  function rbeRest(f) {
    if (FISCHE[f.typ].boss) return 1e9;
    const t = FISCHE[f.typ];
    return Math.max(1, Math.ceil(f.hp)) + t.kinder.reduce((s, k) => s + FISCHE[k].rbe, 0);
  }
  // kleiner Zufallsgenerator mit Startwert, damit Spiele nachvollziehbar bleiben
  // (Zustand lesbar, damit der Koop-Server ihn an die Browser weitergeben kann)
  function zufallsquelle(seed) {
    let a = seed >>> 0;
    const f = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.lesen = () => a;
    f.setzen = v => { a = v >>> 0; };
    return f;
  }
  const zahlOk = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;

  class Spiel {
    // spieler (nur Koop): [{ id, name, held, kraft }], geldModus 'geteilt' oder 'getrennt'.
    // kraft: Meisterkraft des Helden (Pingu-Pass) im Einzelspiel.
    constructor({ karte = 'scholle', stufe = 'mittel', runden = null, modus = 'standard', held = null, seed = 12345, kraft = false, spieler = null, geldModus = 'geteilt' } = {}) {
      this.karte = PT.KARTEN[karte] ? karte : 'scholle';
      this.stufe = PT.STUFEN[stufe] ? stufe : 'mittel';
      this.modus = PT.MODI[modus] ? modus : 'standard';
      const md = PT.MODI[this.modus];
      this.held = held && PT.HELDEN[held] && !md.ohneHeld ? held : null;
      this.kraft = !!kraft;
      this.koop = Array.isArray(spieler) && spieler.length > 0;
      this.geldModus = this.koop && geldModus === 'getrennt' ? 'getrennt' : 'geteilt';
      this.kartenDaten = PT.KARTEN[this.karte];
      this.wege = this.kartenDaten.wege.map(w => wegBauen(this.modus === 'umgekehrt' ? w.slice().reverse() : w));
      this.weg = this.wege[0];
      const st = PT.STUFEN[this.stufe];
      this.zielRunden = runden || md.runden || st.runden;
      this.unendlich = this.modus === 'sandkasten';
      this.geldFaktor = this.modus === 'halb' ? 0.5 : 1;
      this.geld = this.unendlich ? 999999 : st.geld;
      this.leben = this.unendlich ? 999999 : st.leben;
      // Koop: Startgeld pro Spieler, getrennt hat jeder seine eigene Kasse
      this.spieler = [];
      if (this.koop) {
        this.held = null;
        this.spieler = spieler.slice(0, PT.KOOP_MAX).map((x, i) => ({
          id:String(x.id), name:String(x.name || 'Pingu').slice(0, 16), farbe:i,
          held:x.held && PT.HELDEN[x.held] && !md.ohneHeld ? x.held : null, kraft:!!x.kraft,
          geld:this.geldModus === 'getrennt' ? this.geld : 0
        }));
        if (this.geldModus === 'geteilt' && !this.unendlich) this.geld *= this.spieler.length;
      }
      this.startLeben = this.leben;
      this.runde = 0;            // abgeschlossene Runden
      this.laeuft = false;       // gerade kommen Fische
      this.vorbei = false;       // verloren
      this.gewonnen = false;
      this.endlos = false;
      this.fische = [];
      this.geschosse = [];
      this.granaten = [];
      this.haufen = [];
      this.tuerme = [];
      this.ereignisse = [];
      this.naechsteId = 1;
      this.zeit = 0;
      this.zufall = zufallsquelle(seed);
      this.sabotage = null;
      this.warteschlange = [];
      this.kisten = [];
      this.statistik = { platzer:0, geleakt:0, verdient:0 };
    }

    /* ---------- Spieler und Kasse (Koop) ---------- */
    spielerVon(sp) { return this.koop ? this.spieler.find(x => x.id === sp) || null : null; }
    // Wessen Geld wird ausgegeben? Einzelspiel und geteiltes Geld: die gemeinsame Kasse
    kasse(sp) {
      if (this.geldModus !== 'getrennt') return this;
      return this.spielerVon(sp) || { geld:0 };
    }
    heldVon(sp) { if (!this.koop) return this.held; const x = this.spielerVon(sp); return x ? x.held : null; }
    // Darf dieser Spieler den Pinguin aufrüsten, verkaufen, umstellen? Bei getrenntem Geld nur die eigenen.
    darf(t, sp) { return !this.koop || this.geldModus !== 'getrennt' || t.besitzer === sp; }
    erlaubt(typ, sp = null) {
      const md = PT.MODI[this.modus];
      if (PT.HELDEN[typ]) return typ === this.heldVon(sp);
      return !md.erlaubt || md.erlaubt.includes(typ);
    }
    heldDa(sp = null) { return this.tuerme.find(t => PT.HELDEN[t.typ] && (!this.koop || t.besitzer === sp)); }
    // Einnahmen: an einen bestimmten Spieler (Kisten seines Markts) oder bei getrenntem Geld auf alle verteilt
    einnahme(betrag, an = null) {
      const b = betrag * this.geldFaktor;
      if (this.geldModus === 'getrennt') {
        const ziel = an != null && this.spielerVon(an);
        if (ziel) ziel.geld += b;
        else for (const x of this.spieler) x.geld += b / this.spieler.length;
      } else this.geld += b;
      this.statistik.verdient += b;
      return b;
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
    preisBau(typ, x, y) { return PT.preis(PT.def(typ).preis, this.stufe, x == null ? 0 : this.rabattAn(x, y)); }
    preisUpgrade(t, i) {
      const u = PT.PINGUINE[t.typ] && PT.PINGUINE[t.typ].pfade[i][t.pfade[i]];
      return u ? PT.preis(u.preis, this.stufe, this.rabattAn(t.x, t.y, t)) : Infinity;
    }
    // Stufe 5 gibt es pro Pinguinart und Pfad nur einmal
    upgradeErlaubt(t, i) {
      if (!PT.PINGUINE[t.typ] || !PT.upgradeErlaubt(t.pfade, i)) return false;
      if (t.pfade[i] === 4 && this.tuerme.some(x => x !== t && x.typ === t.typ && x.pfade[i] === 5)) return false;
      return true;
    }
    stufe5Vergeben(t, i) { return t.pfade[i] === 4 && this.tuerme.some(x => x !== t && x.typ === t.typ && x.pfade[i] === 5); }
    platzFrei(typ, x, y, ohne) {
      const r = PT.turmRadius(typ);
      const def = PT.def(typ);
      if (x < r || y < r || x > PT.BREITE - r || y > PT.HOEHE - r) return false;
      for (const w of this.wege) if (w.abstand(x, y) < PT.WEG_BREITE / 2 + r - 2) return false;
      for (const [hx, hy, hr] of this.kartenDaten.hindernisse) if (Math.hypot(hx - x, hy - y) < hr + r - 4) return false;
      const teiche = this.kartenDaten.wasser || [];
      if (def.wasser) {
        if (!teiche.some(([wx, wy, wr]) => Math.hypot(wx - x, wy - y) <= wr - r * 0.35)) return false;
      } else if (teiche.some(([wx, wy, wr]) => Math.hypot(wx - x, wy - y) < wr + r - 6)) return false;
      for (const t of this.tuerme) if (t !== ohne && Math.hypot(t.x - x, t.y - y) < PT.turmRadius(t.typ) + r) return false;
      return true;
    }
    bauen(typ, x, y, sp = null) {
      if (this.vorbei || !PT.def(typ) || !this.erlaubt(typ, sp) || !this.platzFrei(typ, x, y)) return null;
      if (this.koop && !this.spielerVon(sp)) return null;
      if (PT.HELDEN[typ] && this.heldDa(sp)) return null;
      const preis = this.preisBau(typ, x, y);
      const kasse = this.kasse(sp);
      if (preis > kasse.geld) return null;
      if (!this.unendlich) kasse.geld -= preis;
      const def = PT.def(typ);
      const kraft = !!PT.HELDEN[typ] && (this.koop ? this.spielerVon(sp).kraft : this.kraft);
      const t = {
        id:this.naechsteId++, typ, x, y, pfade:[0, 0, 0], ziel:def.ziele ? def.ziele[0][0] : 'erster', investiert:preis, pops:0,
        winkel:-Math.PI / 2, dreh:0, cd:[], fcd:{}, stufe:1, xp:0, temp:null, muster:'acht', phase:0, fx:x, fy:y, fw:0,
        besitzer:this.koop ? sp : null, kraft, betaeubt:0
      };
      if (typ === 'moerser') t.zielPunkt = this.standardZiel(x, y);
      this.tuerme.push(t);
      this.neuBerechnen();
      this.ereignisse.push({ art:'gebaut', turm:t });
      return t;
    }
    // Mörser zielt anfangs auf die Kanalstelle in seiner Nähe
    standardZiel(x, y) {
      let best = null, bd = Infinity;
      for (const w of this.wege) for (let d = w.vonDist; d <= w.bisDist; d += 20) {
        const [px, py] = w.punkt(d);
        const e = Math.hypot(px - x, py - y);
        if (e < bd) { bd = e; best = [px, py]; }
      }
      return best || [PT.BREITE / 2, PT.HOEHE / 2];
    }
    upgraden(t, i, sp = null) {
      if (this.vorbei || !this.upgradeErlaubt(t, i) || !this.darf(t, sp)) return false;
      const preis = this.preisUpgrade(t, i);
      const kasse = this.kasse(sp);
      if (preis > kasse.geld) return false;
      if (!this.unendlich) kasse.geld -= preis;
      t.investiert += preis;
      t.pfade[i]++;
      this.neuBerechnen();
      this.ereignisse.push({ art:'upgrade', turm:t, pfad:i });
      return true;
    }
    // Helden: Stufe direkt kaufen (1 Geld pro fehlendem Erfahrungspunkt)
    preisHeldenStufe(t) {
      if (!PT.HELDEN[t.typ] || t.stufe >= 10) return Infinity;
      return PT.preis(Math.max(5, PT.HELDEN_STUFEN[t.stufe + 1] - t.xp), this.stufe);
    }
    heldenStufeKaufen(t, sp = null) {
      const p = this.preisHeldenStufe(t);
      const kasse = this.kasse(sp);
      if (p > kasse.geld || this.vorbei || !this.darf(t, sp)) return false;
      if (!this.unendlich) kasse.geld -= p;
      t.investiert += p;
      t.xp = PT.HELDEN_STUFEN[t.stufe + 1];
      this.heldErfahrung(t, 0);
      return true;
    }
    heldErfahrung(t, xp) {
      t.xp += xp;
      let auf = false;
      while (t.stufe < 10 && t.xp >= PT.HELDEN_STUFEN[t.stufe + 1]) { t.stufe++; auf = true; }
      if (auf) { this.neuBerechnen(); this.ereignisse.push({ art:'aufstieg', turm:t, stufe:t.stufe }); }
    }
    verkaufswert(t) { return Math.floor(t.investiert * PT.VERKAUF); }
    verkaufen(t) {
      const i = this.tuerme.indexOf(t);
      if (i < 0) return;
      this.tuerme.splice(i, 1);
      if (!this.unendlich) this.kasse(t.besitzer).geld += this.verkaufswert(t);
      this.haufen = this.haufen.filter(h => h.turm !== t);
      this.neuBerechnen();
      this.ereignisse.push({ art:'verkauft', turm:t });
    }

    // Werte aller Pinguine neu bestimmen (Upgrades, Heldenstufe und Boni aus der Nähe)
    neuBerechnen() {
      for (const t of this.tuerme) t.werte = PT.werteFuer(t.typ, t.pfade, t.stufe, t.kraft);
      const quellen = this.tuerme.filter(t => t.werte.buff);
      for (const t of this.tuerme) {
        const e = { ...t.werte, angriffe:t.werte.angriffe.map(a => ({ ...a, haufen:a.haufen ? { ...a.haufen } : null })) };
        const wasser = !!PT.def(t.typ).wasser;
        let b = null;
        for (const h of quellen) {
          if (h === t || Math.hypot(h.x - t.x, h.y - t.y) > h.werte.reichweite) continue;
          const hb = h.werte.buff;
          if (hb.nurWasser && !wasser) continue;
          b = b || { reichweite:0, camo:false, tempo:1, schaden:0, durchschlag:0 };
          b.reichweite = Math.max(b.reichweite, hb.reichweite);
          b.camo = b.camo || hb.camo;
          b.tempo = Math.min(b.tempo, hb.tempo);
          b.schaden = Math.max(b.schaden, hb.schaden);
          b.durchschlag = Math.max(b.durchschlag, hb.durchschlag);
        }
        if (b) {
          if (e.reichweite < 5000) e.reichweite *= 1 + b.reichweite;
          e.camo = e.camo || b.camo;
          for (const a of e.angriffe) {
            a.intervall *= b.tempo;
            if (a.schaden > 0) a.schaden += b.schaden;
            a.durchschlag += b.durchschlag;
            if (a.haufen) a.haufen.durchschlag += b.durchschlag;
            if (a.reichweite) a.reichweite *= 1 + b.reichweite;
            if (a.art === 'wurf' || a.art === 'rundum') a.flug *= 1 + b.reichweite;
          }
        }
        e.gebufft = !!b;
        t.eff = e;
        while (t.cd.length < e.angriffe.length) t.cd.push(0);
        t.cd.length = e.angriffe.length;
        for (const f of e.faehigkeiten || []) if (t.fcd[f.id] == null) t.fcd[f.id] = f.cd * 0.25;
        if (e.flieger && !t.musterGesetzt) t.muster = t.muster || e.flieger.muster;
      }
      this.entwachsen = this.tuerme.some(t => t.eff.entwachsen);
      this.entpanzern = this.tuerme.some(t => t.eff.entpanzern);
    }

    /* ---------- Runden ---------- */
    rundeStarten() {
      if (this.laeuft || this.vorbei || (this.gewonnen && !this.endlos)) return false;
      const n = this.runde + 1;
      const r = PT.runde(n, this.modus);
      this.laeuft = true;
      this.sandWelle = false;
      this.rundenZeit = 0;
      this.zaeh = r.zaeh;
      this.warteschlange = [];
      let ende = 0;
      const wn = this.wege.length;
      r.gruppen.forEach((g, gi) => {
        for (let i = 0; i < g.anzahl; i++) {
          this.warteschlange.push({ t:g.start + i * g.abstand, typ:g.typ, camo:g.camo, nach:g.nach, fest:g.fest, p:(gi + i) % wn, boss:g.typ === r.bossTyp ? r.boss : 0 });
        }
        ende = Math.max(ende, g.start + g.anzahl * g.abstand);
      });
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
      this.ereignisse.push({ art:'rundeStart', runde:n, boss:r.boss || 0, bossTyp:r.bossTyp || null });
      return true;
    }
    // Sandkasten: Fische selbst losschicken
    sandFische(typ, anzahl = 1, zusatz = {}) {
      if (!FISCHE[typ] || this.vorbei) return;
      if (!this.laeuft) {
        this.laeuft = true; this.sandWelle = true; this.rundenZeit = 0; this.zaeh = 1;
        this.warteschlange = []; this.kisten = [];
      }
      const start = this.rundenZeit + 0.1;
      const abstand = FISCHE[typ].riese ? 1.2 : 0.25;
      for (let i = 0; i < anzahl; i++) {
        this.warteschlange.push({ t:start + i * abstand, typ, camo:!!zusatz.camo, nach:!!zusatz.nach, fest:!!zusatz.fest, p:i % this.wege.length, boss:FISCHE[typ].boss ? 1 : 0 });
      }
      this.warteschlange.sort((a, b) => b.t - a.t);
    }

    neuerFisch(typ, dist, mods = {}, vorbild = null, p = 0) {
      const T = FISCHE[typ];
      const fest = !!mods.fest && PT.kannGepanzert(typ) && !this.entpanzern;
      let hp = T.hp * (fest ? (typ === 'panzer' ? 4 : 2) : 1) * (T.riese && !T.boss ? this.zaeh || 1 : 1);
      if (T.boss) hp = PT.BOSSE[typ].hp[mods.boss || 1];
      if (T.riese && !T.boss && this.sabotage && this.sabotage.riesen && this.zeit < this.sabotage.bis) hp *= this.sabotage.riesen;
      const f = {
        id:this.naechsteId++, typ, p, hp, dist, camo:!!mods.camo || T.immer === 'camo', fest, boss:T.boss ? mods.boss || 1 : 0, phase:0,
        nach:!!mods.nach && !T.riese, ursprung:mods.ursprung || typ, nachT:0,
        frost:0, betaeubt:0, langsam:1, langsamT:0, wind:1, x:-100, y:-100, w:0, tot:false, geboren:this.zeit
      };
      f.hpMax = f.hp;
      if (vorbild) {
        const riese = T.riese, eis = (T.immun || []).includes('kaelte');
        if (!riese && !eis) f.frost = vorbild.frost;
        if (!riese) { f.betaeubt = vorbild.betaeubt; f.langsam = vorbild.langsam; f.langsamT = vorbild.langsamT; }
      }
      const pk = this.wege[p].punkt(dist);
      f.x = pk[0]; f.y = pk[1]; f.w = pk[2];
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
      const T = FISCHE[f.typ], riese = !!T.riese;
      if (a.frost && !riese && !this.immun(f, 'kaelte')) f.frost = Math.max(f.frost, a.frost);
      if (a.verlangsam && !riese) { f.langsam = Math.min(f.langsam, a.verlangsam); f.langsamT = Math.max(f.langsamT, a.verlangsamDauer); }
      if (a.riesenLangsam && riese && !f.boss) { f.langsam = Math.min(f.langsam, a.riesenLangsam); f.langsamT = Math.max(f.langsamT, 1.5); }
      if (a.betaeuben && !riese) f.betaeubt = Math.max(f.betaeubt, a.betaeuben);
      if (a.riesenBetaeuben && riese && !f.boss) f.betaeubt = Math.max(f.betaeubt, a.riesenBetaeuben);
      if (a.ablenken && !riese && this.zufall() < a.ablenken) f.dist = Math.max(0, f.dist - 50);
      const schaden = a.schaden + (riese ? a.riesen : 0);
      if (schaden <= 0) return true;
      f.hp -= schaden;
      f.nachT = 0;
      if (riese) this.ereignisse.push({ art:'riesenTreffer', fisch:f });
      if (f.boss) this.bossPruefen(f);
      if (f.hp <= 0) this.platzen(f, -f.hp, turm, getroffen, a.typ);
      return true;
    }
    // Bosse rufen bei 75, 50 und 25 % Leben Verstärkung; Kaiser Orka betäubt dabei die Pinguine am Ufer
    bossPruefen(f) {
      const B = PT.BOSSE[f.typ];
      while (f.phase < 3 && f.hp > 0 && f.hp < f.hpMax * (0.75 - 0.25 * f.phase)) {
        f.phase++;
        const welle = B.welle[f.boss === 1 ? 0 : 1];
        for (const [typ, n] of welle) for (let i = 0; i < n; i++) this.neuerFisch(typ, Math.max(0, f.dist - 40 - i * 12), {}, null, f.p);
        if (B.betaeuben) {
          const dauer = B.betaeuben.dauer[f.boss] || B.betaeuben.dauer[1];
          for (const t of this.tuerme) if (Math.hypot(t.x - f.x, t.y - f.y) <= B.betaeuben.radius) t.betaeubt = Math.max(t.betaeubt || 0, dauer);
          this.ereignisse.push({ art:'flutwelle', x:f.x, y:f.y, r:B.betaeuben.radius });
        }
        this.ereignisse.push({ art:'bossPhase', fisch:f, phase:f.phase });
      }
    }
    platzen(f, ueber, turm, getroffen, typ) {
      f.tot = true;
      this.einnahme(f.boss ? PT.BOSSE[f.typ].belohnung * f.boss : 1);
      this.statistik.platzer++;
      if (turm) turm.pops++;
      this.ereignisse.push({ art:f.boss ? 'bossBesiegt' : 'platzen', x:f.x, y:f.y, typ:f.typ, boss:f.boss });
      const kinder = FISCHE[f.typ].kinder;
      const neue = [];
      kinder.forEach((k, i) => {
        const c = this.neuerFisch(k, Math.max(0, f.dist - i * (FISCHE[f.typ].riese ? 14 : 7)),
          { camo:f.camo, nach:f.nach, ursprung:f.ursprung, fest:f.fest && PT.kannGepanzert(k) }, f, f.p);
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
    aufKarte(f) { return !f.tot && f.x > -5 && f.x < PT.BREITE + 5 && f.y > -5 && f.y < PT.HOEHE + 5; }
    zielSuchen(t, a, reichweite, ox, oy, modus) {
      let best = null, bw = -Infinity;
      modus = modus || t.ziel;
      for (const f of this.fische) {
        if (!this.kannSehen(f, t.eff.camo) || this.immun(f, a.typ, a)) continue;
        if (a.nurRiesen && !FISCHE[f.typ].riese) continue;
        const d = Math.hypot(f.x - ox, f.y - oy);
        if (d > reichweite + FISCHE[f.typ].r * 0.6) continue;
        let w;
        if (modus === 'letzter') w = -f.dist;
        else if (modus === 'stark') w = FISCHE[f.typ].rbe * 10000 + f.dist;
        else if (modus === 'nah') w = -d;
        else w = f.dist / this.wege[f.p].laenge * 1e5;
        if (w > bw) { bw = w; best = f; }
      }
      return best;
    }
    staerkster(nurRiesen) {
      let best = null, bw = -Infinity;
      for (const f of this.fische) {
        if (!this.aufKarte(f)) continue;
        if (nurRiesen && !FISCHE[f.typ].riese) continue;
        const w = FISCHE[f.typ].rbe * 1000 + f.hp;
        if (w > bw) { bw = w; best = f; }
      }
      return best;
    }
    tempo(f) {
      if (f.frost > 0 || f.betaeubt > 0) return 0;
      const sab = this.sabotage && this.zeit < this.sabotage.bis ? this.sabotage.faktor : 1;
      if (f.boss) return FISCHE[f.typ].tempo * (1 + sab) / 2;
      return FISCHE[f.typ].tempo * f.langsam * f.wind * sab;
    }

    /* ---------- Angriffe ---------- */
    feuern(t, a) {
      const flieger = !!t.eff.flieger;
      const ox = flieger ? t.fx : t.x, oy = flieger ? t.fy : t.y;
      const R = a.reichweite || t.eff.reichweite;
      if (a.art === 'ring' || a.art === 'frost') {
        let n = 0, traf = false;
        for (const f of this.fische) {
          if (n >= a.durchschlag) break;
          if (!this.kannSehen(f, t.eff.camo)) continue;
          if (Math.hypot(f.x - ox, f.y - oy) > R + FISCHE[f.typ].r * 0.6) continue;
          traf = true;
          if (this.treffer(f, a, t, null)) n++;
          else if (a.art === 'frost' && FISCHE[f.typ].riese) n++;
        }
        if (!traf) return false;
        this.ereignisse.push({ art:'ring', x:ox, y:oy, r:R, bild:a.bild, turm:t });
        return true;
      }
      if (a.art === 'moerser') {
        if (!this.fische.some(f => this.aufKarte(f))) return false;
        const [zx, zy] = t.zielPunkt || this.standardZiel(t.x, t.y);
        t.winkel = Math.atan2(zy - t.y, zx - t.x);
        for (let i = 0; i < a.anzahl; i++) {
          const w = this.zufall() * Math.PI * 2, d = Math.sqrt(this.zufall()) * a.ungenau;
          this.granaten.push({ id:this.naechsteId++, x0:t.x, y0:t.y, x:zx + Math.cos(w) * d, y:zy + Math.sin(w) * d, t:0, dauer:a.flugzeit, a, turm:t, bild:a.bild });
        }
        this.ereignisse.push({ art:'wurf', turm:t, bild:a.bild });
        return true;
      }
      if (a.art === 'stacheln') {
        if (!this.laeuft) return false;
        const orte = this.haufenOrte(t, R, a.anzahl);
        if (!orte.length) return false;
        for (const [x, y] of orte) this.haufenDazu(t, a, x, y, t.x, t.y);
        this.ereignisse.push({ art:'wurf', turm:t, bild:a.bild });
        return true;
      }
      if (a.art === 'abwurf') {
        if (!this.fische.some(f => this.kannSehen(f, true) && Math.hypot(f.x - ox, f.y - oy) < R)) return false;
        this.explosion(ox, oy, a, t, null);
        return true;
      }
      const ziel = this.zielSuchen(t, a, R, ox, oy, a.hinten ? (t.ziel === 'letzter' ? 'erster' : 'letzter') : null);
      if (!ziel) return false;
      if (!flieger && !a.hinten) t.winkel = Math.atan2(ziel.y - oy, ziel.x - ox);

      if (a.art === 'sofort') {
        this.ereignisse.push({ art:'strahl', x1:ox, y1:oy, x2:ziel.x, y2:ziel.y, bild:a.bild, turm:t });
        const zx = ziel.x, zy = ziel.y;
        this.treffer(ziel, a, t, null);
        if (a.splash) this.explosion(zx, zy, a, t, ziel.id);
        return true;
      }
      if (a.art === 'blitz') {
        const pts = [[ox, oy]];
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
        const flugzeit = Math.hypot(ziel.x - ox, ziel.y - oy) / a.tempo;
        const p = this.wege[ziel.p].punkt(ziel.dist + this.tempo(ziel) * flugzeit);
        zx = p[0]; zy = p[1];
      }
      const basis = Math.atan2(zy - oy, zx - ox);
      const n = a.anzahl;
      for (let i = 0; i < n; i++) {
        const w = a.art === 'rundum' ? t.dreh + i * Math.PI * 2 / n : basis + (i - (n - 1) / 2) * a.streuung;
        this.geschossDazu(t, a, ox, oy, w, ziel.id);
      }
      if (a.art === 'rundum') t.dreh += 0.2;
      this.ereignisse.push({ art:'wurf', turm:t, bild:a.bild, hinten:!!a.hinten });
      return true;
    }
    geschossDazu(t, a, x, y, w, zielId) {
      this.geschosse.push({
        id:this.naechsteId++, x, y, vx:Math.cos(w) * a.tempo, vy:Math.sin(w) * a.tempo, rest:a.flug,
        durchschlag:a.durchschlag, a, turm:t, getroffen:new Set(), ziel:zielId, bild:a.bild, groesse:a.groesse
      });
    }
    // Zerfall am Ende des Flugs (Gletscher-Walze zerfällt in Lawinen)
    zerfallen(g) {
      const a = g.a;
      if (!a.splitter || a.splash) return;
      const klein = { ...a, splitter:0, groesse:14, durchschlag:30, schaden:Math.max(3, a.schaden - 4), flug:200, tempo:280, bild:a.splitterArt || 'lawine', riesen:Math.floor(a.riesen / 2) };
      for (let i = 0; i < a.splitter; i++) this.geschossDazu(g.turm, klein, g.x, g.y, i * Math.PI * 2 / a.splitter, null);
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
      if (a.splitterNadeln) {
        const nadel = { ...a, splash:0, splitter:0, splitterNadeln:0, typ:'spitz', durchschlag:2, flug:70, tempo:380, groesse:4, bild:'splitter', frost:0, betaeuben:0 };
        for (let i = 0; i < a.splitterNadeln; i++) this.geschossDazu(t, nadel, x, y, i * Math.PI * 2 / a.splitterNadeln + 0.3, null);
      }
    }

    /* ---------- Stachelhaufen ---------- */
    haufenOrte(t, R, anzahl) {
      const kandidaten = [];
      for (const w of this.wege) {
        for (let d = w.vonDist; d <= w.bisDist; d += 12) {
          const [x, y] = w.punkt(d);
          if (Math.hypot(x - t.x, y - t.y) <= R) kandidaten.push([x, y, d / w.laenge]);
        }
      }
      if (!kandidaten.length) return [];
      const orte = [];
      for (let i = 0; i < anzahl; i++) {
        let k;
        if (t.ziel === 'nah') { kandidaten.sort((a, b) => Math.hypot(a[0] - t.x, a[1] - t.y) - Math.hypot(b[0] - t.x, b[1] - t.y)); k = kandidaten[Math.floor(this.zufall() * Math.min(4, kandidaten.length))]; }
        else if (t.ziel === 'anfang') { kandidaten.sort((a, b) => a[2] - b[2]); k = kandidaten[Math.floor(this.zufall() * Math.min(5, kandidaten.length))]; }
        else if (t.ziel === 'ende') { kandidaten.sort((a, b) => b[2] - a[2]); k = kandidaten[Math.floor(this.zufall() * Math.min(5, kandidaten.length))]; }
        else k = kandidaten[Math.floor(this.zufall() * kandidaten.length)];
        orte.push([k[0] + (this.zufall() - 0.5) * 14, k[1] + (this.zufall() - 0.5) * 14]);
      }
      return orte;
    }
    haufenDazu(t, a, x, y, x0, y0) {
      const h = a.haufen || { durchschlag:5, leben:40, radius:12, bleibt:false };
      this.haufen.push({ id:this.naechsteId++, x, y, x0, y0, start:this.zeit, durchschlag:h.durchschlag, max:h.durchschlag, radius:h.radius, leben:h.leben, bleibt:h.bleibt, a, turm:t, getroffen:new Set() });
      const eigene = this.haufen.filter(z => z.turm === t);
      if (t && eigene.length > MAX_HAUFEN) this.haufen.splice(this.haufen.indexOf(eigene[0]), 1);
    }

    /* ---------- Fähigkeiten ---------- */
    faehigkeitenListe(sp = null) {
      const gruppen = new Map();
      for (const t of this.tuerme) {
        if (!this.darf(t, sp)) continue;
        for (const f of t.eff.faehigkeiten || []) {
          const rest = Math.max(0, t.fcd[f.id] || 0);
          const g = gruppen.get(f.id);
          if (!g || rest < g.rest) gruppen.set(f.id, { id:f.id, rest, cd:f.cd, turm:t, anzahl:(g ? g.anzahl : 0) + 1 });
          else g.anzahl++;
        }
      }
      return [...gruppen.values()].map(g => ({ ...g, ...PT.FAEHIGKEITEN[g.id], bereit:g.rest <= 0 }));
    }
    faehigkeitAusloesen(id, sp = null) {
      if (this.vorbei) return false;
      const kandidaten = this.tuerme.filter(t => this.darf(t, sp) && (t.eff.faehigkeiten || []).some(f => f.id === id) && (t.fcd[id] || 0) <= 0);
      if (!kandidaten.length) return false;
      const t = kandidaten[0];
      const f = t.eff.faehigkeiten.find(x => x.id === id);
      t.fcd[id] = f.cd;
      const sichtbar = () => this.fische.filter(x => this.aufKarte(x));
      const alleTreffen = (schaden, riesen) => {
        for (const x of sichtbar()) this.treffer(x, PT.angriff({ schaden, riesen:riesen || 0, typ:'normal' }), t, null);
      };
      switch (id) {
        case 'turbo': t.temp = { faktor:f.faktor, bis:this.zeit + f.dauer }; break;
        case 'schlachtruf': case 'schleier': case 'party': {
          const r = f.radius || t.eff.reichweite;
          for (const x of this.tuerme) if (Math.hypot(x.x - t.x, x.y - t.y) <= r) x.temp = { faktor:f.faktor, bis:this.zeit + f.dauer };
          break;
        }
        case 'rakete': case 'haken': case 'torpedos': case 'orbital': case 'anker': {
          const ziele = [];
          for (let i = 0; i < f.anzahl; i++) {
            const z = this.staerkster(id !== 'torpedos' && id !== 'orbital') || this.staerkster(false);
            if (!z) break;
            ziele.push([z.x, z.y]);
            if (id === 'haken' && !z.boss) z.dist = Math.max(0, z.dist - 120);
            if (id === 'anker' && !z.boss) z.betaeubt = Math.max(z.betaeubt, f.betaeuben);
            this.treffer(z, PT.angriff({ schaden:f.schaden, typ:'normal' }), t, null);
          }
          this.ereignisse.push({ art:'geschossFaehigkeit', id, turm:t, ziele });
          break;
        }
        case 'schneesturm': case 'kaelteschock':
          for (const x of sichtbar()) {
            if (FISCHE[x.typ].riese) { if (!x.boss) { x.langsam = Math.min(x.langsam, 0.5); x.langsamT = Math.max(x.langsamT, f.dauer + 2); } }
            else if (id === 'kaelteschock' || !this.immun(x, 'kaelte')) x.frost = Math.max(x.frost, f.dauer);
          }
          if (f.schaden) alleTreffen(f.schaden, f.schaden * 4);
          break;
        case 'geldregen': this.einnahme(f.betrag, t.besitzer); this.ereignisse.push({ art:'kiste', turm:t, wert:Math.round(f.betrag * this.geldFaktor) }); break;
        case 'nordlicht':
          for (const x of sichtbar()) {
            if (FISCHE[x.typ].riese) { if (!x.boss) { x.langsam = Math.min(x.langsam, 0.4); x.langsamT = Math.max(x.langsamT, f.dauer + 2); } }
            else x.frost = Math.max(x.frost, f.dauer);
          }
          alleTreffen(f.schaden, f.riesen);
          break;
        case 'tanz':
          for (const x of sichtbar()) if (!x.boss) x.betaeubt = Math.max(x.betaeubt, FISCHE[x.typ].riese ? f.dauer / 2 : f.dauer);
          this.ereignisse.push({ art:'ring', x:t.x, y:t.y, r:400, bild:'schallGross', turm:t });
          break;
        case 'sternschnuppe':
          for (const x of sichtbar()) x.camo = false;
          alleTreffen(f.schaden, f.riesen);
          break;
        case 'eiszeit':
          for (const x of sichtbar()) if (!x.boss) { x.langsam = Math.min(x.langsam, 0.5); x.langsamT = Math.max(x.langsamT, f.dauer); }
          for (const x of this.tuerme) if (Math.hypot(x.x - t.x, x.y - t.y) <= f.radius) x.temp = { faktor:f.faktor, bis:this.zeit + f.dauer };
          this.ereignisse.push({ art:'ring', x:t.x, y:t.y, r:f.radius, bild:'frostStark', turm:t });
          break;
        case 'sabotage': this.sabotage = { faktor:f.faktor, bis:this.zeit + f.dauer, riesen:f.riesen || 0 }; break;
        case 'bombenteppich': case 'himmelsfeuer': case 'himmelsblitz': alleTreffen(f.schaden, f.riesen); break;
        case 'stachelsturm': {
          const a = t.eff.angriffe[0];
          let n = 0;
          for (const w of this.wege) {
            const anzahl = Math.ceil(f.anzahl / this.wege.length);
            for (let i = 0; i < anzahl && n < f.anzahl; i++, n++) {
              const [x, y] = w.punkt(w.vonDist + (w.bisDist - w.vonDist) * (i + 0.5) / anzahl);
              this.haufenDazu(null, a, x, y, t.x, t.y);
            }
          }
          break;
        }
        case 'eisfalle':
          for (const w of this.wege) {
            const [x, y] = w.punkt(w.vonDist + 40);
            this.haufenDazu(null, PT.angriff({ schaden:f.schaden, typ:'normal', riesen:f.schaden * 5, haufen:{ durchschlag:f.durchschlag, leben:60, radius:20, bleibt:false } }), x, y, t.x, t.y);
          }
          break;
        case 'knall': {
          const a = PT.angriff({ schaden:f.schaden, riesen:f.schaden * 3, typ:'normal', splash:70, splashDurchschlag:60, bild:'granateGross' });
          for (const w of this.wege) for (let i = 0; i < 10; i++) {
            const [x, y] = w.punkt(w.vonDist + (w.bisDist - w.vonDist) * (i + 0.5) / 10);
            this.explosion(x, y, a, t, null);
          }
          for (const x of sichtbar()) x.betaeubt = Math.max(x.betaeubt, x.boss ? 0 : FISCHE[x.typ].riese ? f.betaeuben / 2 : f.betaeuben);
          break;
        }
        case 'netz':
          for (const x of sichtbar()) {
            if (Math.hypot(x.x - t.x, x.y - t.y) > f.radius) continue;
            if (FISCHE[x.typ].riese) { if (!x.boss) { x.langsam = Math.min(x.langsam, 0.5); x.langsamT = Math.max(x.langsamT, f.dauer); } }
            else x.betaeubt = Math.max(x.betaeubt, f.dauer);
          }
          this.ereignisse.push({ art:'ring', x:t.x, y:t.y, r:f.radius, bild:'netz', turm:t });
          break;
      }
      this.ereignisse.push({ art:'faehigkeit', id, turm:t });
      return true;
    }

    /* ---------- Flieger ---------- */
    fliegerBewegen(t, dt) {
      const v = t.eff.flieger.tempo;
      const W = PT.BREITE, H = PT.HOEHE;
      let x, y;
      const pos = ph => {
        if (t.muster === 'kreis') {
          const cx = Math.max(130, Math.min(W - 130, t.x)), cy = Math.max(130, Math.min(H - 130, t.y));
          return [cx + Math.cos(ph) * 115, cy + Math.sin(ph) * 115];
        }
        if (t.muster === 'oval') return [W / 2 + Math.cos(ph) * 410, H / 2 + Math.sin(ph) * 235];
        return [W / 2 + Math.sin(ph) * 380, H / 2 + Math.sin(ph) * Math.cos(ph) * 430];
      };
      const umfang = t.muster === 'kreis' ? 115 : t.muster === 'oval' ? 330 : 360;
      t.phase += v * dt / umfang;
      [x, y] = pos(t.phase);
      const [nx, ny] = pos(t.phase + 0.02);
      t.fx = x; t.fy = y; t.fw = Math.atan2(ny - y, nx - x);
      t.winkel = t.fw;
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
          this.neuerFisch(s.typ, 0, s, null, s.p);
        }
        const k = this.kisten;
        while (k.length && k[k.length - 1].t <= this.rundenZeit) {
          const s = k.pop();
          if (!this.tuerme.includes(s.turm)) continue;
          const b = this.einnahme(s.wert, s.turm.besitzer);
          this.ereignisse.push({ art:'kiste', turm:s.turm, wert:Math.round(b) });
        }
        // Fischflut: die nächste Runde kommt, sobald diese ganz losgeschwommen ist
        if (this.modus === 'flut' && !q.length && !this.sandWelle && (this.endlos || this.runde + 1 < this.zielRunden)) {
          this.laeuft = false;
          this.rundeAbschliessen();
          this.rundeStarten();
        }
        for (const t of this.tuerme) for (const id of Object.keys(t.fcd)) if (t.fcd[id] > 0) t.fcd[id] -= dt;
      }

      // Wind, Leuchtfeuer, Panzerknacker
      const wind = this.tuerme.filter(t => t.eff.wind);
      const leucht = this.tuerme.filter(t => t.eff.enttarnen);
      const ueberall = leucht.some(t => t.eff.enttarnenUeberall);

      // Fische bewegen
      for (const f of this.fische) {
        if (f.tot) continue;
        const T = FISCHE[f.typ];
        f.wind = 1;
        for (const t of wind) {
          if (Math.hypot(f.x - t.x, f.y - t.y) <= t.eff.reichweite) f.wind = Math.min(f.wind, T.riese ? (t.eff.windRiesen || Math.max(t.eff.wind, 0.8)) : t.eff.wind);
        }
        if (f.camo && T.immer !== 'camo' && (ueberall || leucht.some(t => Math.hypot(f.x - t.x, f.y - t.y) <= t.eff.reichweite))) f.camo = false;
        if (f.camo && T.immer === 'camo' && ueberall) f.camo = false;
        if (this.entwachsen) f.nach = false;
        if (this.entpanzern && f.fest) { f.fest = false; f.hpMax /= 2; f.hp = Math.min(f.hp, f.hpMax); }
        // Nachwachsen
        if (f.nach && f.typ !== f.ursprung) {
          f.nachT += dt;
          if (f.nachT >= (f.typ === 'koffer' ? 1.75 : 3)) {
            const eltern = PT.eltern(f.ursprung, f.typ);
            if (eltern) {
              f.typ = eltern;
              f.hp = f.hpMax = FISCHE[eltern].hp * (f.fest && PT.kannGepanzert(eltern) ? 2 : 1);
              this.ereignisse.push({ art:'nachwachsen', x:f.x, y:f.y });
            }
            f.nachT = 0;
          }
        }
        const v = this.tempo(f);
        if (f.frost > 0) f.frost -= dt;
        if (f.betaeubt > 0) f.betaeubt -= dt;
        if (f.langsamT > 0) { f.langsamT -= dt; if (f.langsamT <= 0) f.langsam = 1; }
        f.dist += v * dt;
        const w = this.wege[f.p];
        if (f.dist >= w.laenge) {
          f.tot = true;
          const verlust = rbeRest(f);
          this.leben -= verlust;
          this.statistik.geleakt += Math.min(verlust, 1e6);
          this.ereignisse.push({ art:'leck', typ:f.typ, verlust, rest:f.hp });
          continue;
        }
        const p = w.punkt(f.dist);
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
        if (t.eff.flieger) this.fliegerBewegen(t, dt);
        if (t.betaeubt > 0) { t.betaeubt -= dt; continue; }   // von einer Flutwelle betäubt
        const tempo = t.temp && this.zeit < t.temp.bis ? t.temp.faktor : 1;
        const angriffe = t.eff.angriffe;
        for (let i = 0; i < angriffe.length; i++) {
          const a = angriffe[i];
          t.cd[i] -= dt * tempo;
          if (t.cd[i] > 0) continue;
          if (this.feuern(t, a)) t.cd[i] = Math.max(t.cd[i] + a.intervall, a.intervall * 0.5);
          else t.cd[i] = 0;
        }
      }

      // Granaten landen
      if (this.granaten.length) {
        for (const g of this.granaten) {
          g.t += dt;
          if (g.t >= g.dauer) { g.weg = true; this.explosion(g.x, g.y, g.a, g.turm, null); }
        }
        this.granaten = this.granaten.filter(g => !g.weg);
      }

      // Raster für Geschosse und Stachelhaufen
      const raster = new Map();
      for (const f of this.fische) {
        if (f.tot) continue;
        const k = Math.floor(f.x / ZELLE) * 1000 + Math.floor(f.y / ZELLE);
        let l = raster.get(k);
        if (!l) raster.set(k, l = []);
        l.push(f);
      }
      const nachbarn = function* (x, y, weite = 1) {
        const cx = Math.floor(x / ZELLE), cy = Math.floor(y / ZELLE);
        for (let ix = cx - weite; ix <= cx + weite; ix++) for (let iy = cy - weite; iy <= cy + weite; iy++) {
          const l = raster.get(ix * 1000 + iy);
          if (l) yield* l;
        }
      };

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
        if (g.rest <= 0 || g.x < -60 || g.y < -60 || g.x > PT.BREITE + 60 || g.y > PT.HOEHE + 60) { g.weg = true; this.zerfallen(g); continue; }
        const weite = g.groesse > 20 ? 2 : 1;
        for (const f of nachbarn(g.x, g.y, weite)) {
          if (f.tot || g.getroffen.has(f.id)) continue;
          const r = FISCHE[f.typ].r + g.groesse;
          if ((f.x - g.x) ** 2 + (f.y - g.y) ** 2 > r * r) continue;
          if (g.a.splash) {
            this.treffer(f, g.a, g.turm, null);
            this.explosion(g.x, g.y, g.a, g.turm, f.id);
            g.weg = true;
            break;
          }
          g.getroffen.add(f.id);
          this.treffer(f, g.a, g.turm, g.getroffen);
          if (--g.durchschlag <= 0) { g.weg = true; this.zerfallen(g); break; }
        }
      }
      this.geschosse = this.geschosse.filter(g => !g.weg);

      // Stachelhaufen
      if (this.haufen.length) {
        for (const h of this.haufen) {
          if (h.weg || this.zeit - h.start < 0.35) continue;
          if (this.laeuft) h.leben -= dt;
          if (h.leben <= 0) { h.weg = true; continue; }
          for (const f of nachbarn(h.x, h.y)) {
            if (f.tot || h.getroffen.has(f.id)) continue;
            if (Math.hypot(f.x - h.x, f.y - h.y) > h.radius + FISCHE[f.typ].r * 0.7) continue;
            h.getroffen.add(f.id);
            if (this.treffer(f, h.a, h.turm, h.getroffen) && --h.durchschlag <= 0) {
              h.weg = true;
              if (h.a.mine) {
                const m = h.a.mine;
                this.explosion(h.x, h.y, PT.angriff({ schaden:m.schaden, riesen:m.riesen, splash:m.splash, splashDurchschlag:m.durchschlag, typ:'normal', bild:'mine' }), h.turm, null);
              }
              break;
            }
          }
        }
        this.haufen = this.haufen.filter(h => !h.weg);
      }
      if (this.fische.some(f => f.tot)) this.fische = this.fische.filter(f => !f.tot);

      // Runde vorbei?
      if (this.laeuft && !this.warteschlange.length && !this.fische.length) {
        this.laeuft = false;
        this.geschosse = [];
        this.granaten = [];
        this.haufen = this.haufen.filter(h => h.bleibt);
        if (this.sandWelle) { this.sandWelle = false; this.ereignisse.push({ art:'sandEnde' }); return; }
        this.rundeAbschliessen();
        if (this.runde >= this.zielRunden && !this.gewonnen) {
          this.gewonnen = true;
          this.ereignisse.push({ art:'gewonnen' });
        }
      }
    }
    // Geld, Heldenerfahrung und Kisten am Ende einer Runde
    rundeAbschliessen() {
      this.runde++;
      let bonus = this.einnahme(PT.rundenBonus(this.runde));
      // Geld pro Runde und übrige Kisten gehen an den Besitzer des Pinguins
      for (const t of this.tuerme) if (t.eff.geld && t.eff.geld.flat) bonus += this.einnahme(t.eff.geld.flat, t.besitzer);
      for (const k of this.kisten) if (this.tuerme.includes(k.turm)) bonus += this.einnahme(k.wert, k.turm.besitzer);
      this.kisten = [];
      for (const held of this.tuerme) if (PT.HELDEN[held.typ]) this.heldErfahrung(held, PT.heldenXp(this.runde));
      this.ereignisse.push({ art:'rundeEnde', runde:this.runde, bonus:Math.round(bonus) });
    }

    // Kurzinfo für die Seitenleiste
    kennzahlen(t) {
      const a = t.eff.angriffe[0];
      if (!a) return null;
      const tempo = t.temp && this.zeit < t.temp.bis ? t.temp.faktor : 1;
      return {
        schaden:a.schaden || a.riesen, durchschlag:a.haufen ? a.haufen.durchschlag : a.art === 'ring' || a.art === 'frost' ? a.durchschlag : a.splash ? a.splashDurchschlag : a.art === 'blitz' ? a.kette : a.durchschlag,
        proSek:Math.round(10 * a.anzahl * tempo / a.intervall) / 10, reichweite:t.eff.reichweite > 5000 ? '∞' : Math.round(t.eff.reichweite),
        camo:t.eff.camo, typ:a.typ
      };
    }

    /* ---------- Befehle ----------
       Alles, was ein Spieler tut, läuft über befehl(). Im Einzelspiel ruft die Oberfläche es direkt auf,
       im Koop schickt der Browser den Befehl an den Server, und Server und alle Browser führen ihn im
       selben Takt aus. Deshalb wird hier alles geprüft, was von außen kommt. sp = Spieler-Kennung (Koop). */
    befehl(sp, b) {
      if (!b || typeof b.t !== 'string') return null;
      const t = Number.isInteger(b.id) ? this.tuerme.find(x => x.id === b.id) : null;
      switch (b.t) {
        case 'bau':
          if (typeof b.typ !== 'string' || !zahlOk(b.x, 0, PT.BREITE) || !zahlOk(b.y, 0, PT.HOEHE)) return null;
          return this.bauen(b.typ, b.x, b.y, sp);
        case 'up': return !!t && [0, 1, 2].includes(b.pfad) && this.upgraden(t, b.pfad, sp);
        case 'stufe': return !!t && this.heldenStufeKaufen(t, sp);
        case 'verkauf':
          if (!t || !this.darf(t, sp) || this.vorbei) return false;
          this.verkaufen(t); return true;
        case 'ziel': {
          if (!t || !this.darf(t, sp)) return false;
          const ziele = (PT.def(t.typ).ziele || PT.ZIELE).map(z => z[0]);
          if (!ziele.includes(b.ziel)) return false;
          t.ziel = b.ziel; return true;
        }
        case 'muster':
          if (!t || !this.darf(t, sp) || !PT.MUSTER.some(m => m[0] === b.muster)) return false;
          t.muster = b.muster; t.musterGesetzt = true; return true;
        case 'zielpunkt':
          if (!t || !this.darf(t, sp) || t.typ !== 'moerser' || !zahlOk(b.x, -50, PT.BREITE + 50) || !zahlOk(b.y, -50, PT.HOEHE + 50)) return false;
          t.zielPunkt = [Math.max(0, Math.min(PT.BREITE, b.x)), Math.max(0, Math.min(PT.HOEHE, b.y))]; return true;
        case 'fk': return typeof b.fk === 'string' && !!PT.FAEHIGKEITEN[b.fk] && this.faehigkeitAusloesen(b.fk, sp);
        case 'start':
          // Nur die nächste Runde; wenn zwei Spieler gleichzeitig drücken, startet sie trotzdem nur einmal
          if (b.runde != null && b.runde !== this.runde + 1) return false;
          return this.rundeStarten();
        case 'endlos': if (this.gewonnen) this.endlos = true; return this.endlos;
        case 'sand': {
          if (this.modus !== 'sandkasten' || typeof b.typ !== 'string' || !FISCHE[b.typ]) return false;
          const n = FISCHE[b.typ].boss ? 1 : Math.max(1, Math.min(50, b.n | 0));
          this.sandFische(b.typ, n, { camo:!!b.camo, nach:!!b.nach, fest:!!b.fest });
          return true;
        }
        case 'leeren':
          if (this.modus !== 'sandkasten') return false;
          for (const f of this.fische) f.tot = true;
          this.warteschlange = [];
          return true;
      }
      return null;
    }

    /* ---------- Zustand für den Koop ----------
       Der komplette Spielstand mitten in der Runde, als JSON-taugliches Objekt. Der Server schickt ihn
       beim Start, beim Wiederverbinden und wenn ein Browser vom Server-Spiel abweicht. */
    zustand() {
      const tid = t => (t ? t.id : null);
      const ohneTurm = ({ turm, getroffen, ...rest }) => rest;
      return {
        v:1, karte:this.karte, stufe:this.stufe, modus:this.modus, held:this.held, kraft:this.kraft, zielRunden:this.zielRunden,
        geldModus:this.geldModus, spieler:this.spieler.map(x => ({ ...x })),
        geld:this.geld, leben:this.leben, startLeben:this.startLeben, runde:this.runde, laeuft:this.laeuft, vorbei:this.vorbei,
        gewonnen:this.gewonnen, endlos:this.endlos, naechsteId:this.naechsteId, zeit:this.zeit, zufall:this.zufall.lesen(),
        sabotage:this.sabotage, rundenZeit:this.rundenZeit || 0, zaeh:this.zaeh || 1, sandWelle:!!this.sandWelle, statistik:{ ...this.statistik },
        warteschlange:this.warteschlange, kisten:this.kisten.map(k => ({ t:k.t, turm:tid(k.turm), wert:k.wert })),
        tuerme:this.tuerme.map(({ werte, eff, ...t }) => ({ ...t })),
        fische:this.fische,
        geschosse:this.geschosse.map(g => ({ ...ohneTurm(g), turm:tid(g.turm), getroffen:[...g.getroffen] })),
        granaten:this.granaten.map(g => ({ ...ohneTurm(g), turm:tid(g.turm) })),
        haufen:this.haufen.map(h => ({ ...ohneTurm(h), turm:tid(h.turm), getroffen:[...h.getroffen] }))
      };
    }
    static ausZustand(z) {
      const kopie = JSON.parse(JSON.stringify(z));
      const s = new Spiel({ karte:kopie.karte, stufe:kopie.stufe, runden:kopie.zielRunden, modus:kopie.modus, held:kopie.held, kraft:kopie.kraft,
        spieler:kopie.spieler.length ? kopie.spieler : null, geldModus:kopie.geldModus });
      for (const k of ['geld', 'leben', 'startLeben', 'runde', 'laeuft', 'vorbei', 'gewonnen', 'endlos', 'naechsteId', 'zeit', 'sabotage',
        'rundenZeit', 'zaeh', 'sandWelle', 'statistik', 'warteschlange', 'fische']) s[k] = kopie[k];
      s.spieler = kopie.spieler;
      s.zufall.setzen(kopie.zufall);
      s.tuerme = kopie.tuerme;
      s.neuBerechnen();
      const turm = id => (id == null ? null : s.tuerme.find(t => t.id === id) || null);
      s.kisten = kopie.kisten.map(k => ({ ...k, turm:turm(k.turm) })).filter(k => k.turm);
      s.geschosse = kopie.geschosse.map(g => ({ ...g, turm:turm(g.turm), getroffen:new Set(g.getroffen) }));
      s.granaten = kopie.granaten.map(g => ({ ...g, turm:turm(g.turm) }));
      s.haufen = kopie.haufen.map(h => ({ ...h, turm:turm(h.turm), getroffen:new Set(h.getroffen) }));
      return s;
    }
    // Kurze Prüfsumme: weichen Server und Browser voneinander ab? (gerundet, damit winzige Rechenunterschiede nicht zählen)
    pruefsumme() {
      let h = 2166136261;
      const dazu = v => { h = Math.imul(h ^ (Math.round(v * 100) | 0), 16777619) >>> 0; };
      dazu(this.geld); dazu(this.leben); dazu(this.runde); dazu(this.naechsteId); dazu(this.fische.length); dazu(this.tuerme.length);
      for (const x of this.spieler) dazu(x.geld);
      let d = 0, hp = 0;
      for (const f of this.fische) { d += f.dist; hp += f.hp; }
      dazu(d); dazu(hp);
      return h;
    }

    /* ---------- Speichern (nur zwischen den Runden) ---------- */
    speichern() {
      return {
        v:2, karte:this.karte, stufe:this.stufe, modus:this.modus, held:this.held, zielRunden:this.zielRunden, runde:this.runde, geld:this.geld,
        leben:this.leben, gewonnen:this.gewonnen, endlos:this.endlos, statistik:this.statistik, kraft:this.kraft,
        tuerme:this.tuerme.map(t => ({ typ:t.typ, x:t.x, y:t.y, pfade:t.pfade, ziel:t.ziel, investiert:t.investiert, pops:t.pops, stufe:t.stufe, xp:t.xp, zielPunkt:t.zielPunkt, muster:t.muster, fcd:t.fcd, kraft:!!t.kraft })),
        haufen:this.haufen.filter(h => h.bleibt && h.turm).map(h => ({ x:h.x, y:h.y, durchschlag:h.durchschlag, leben:h.leben, turm:this.tuerme.indexOf(h.turm) }))
      };
    }
    static laden(d) {
      const s = new Spiel({ karte:d.karte, stufe:d.stufe, runden:d.zielRunden, modus:d.modus || 'standard', held:d.held || null, kraft:!!d.kraft });
      Object.assign(s, { runde:d.runde, geld:d.geld, leben:d.leben, gewonnen:!!d.gewonnen, endlos:!!d.endlos, statistik:{ ...s.statistik, ...(d.statistik || {}) } });
      for (const t of d.tuerme || []) {
        if (!PT.def(t.typ)) continue;
        s.tuerme.push({
          id:s.naechsteId++, typ:t.typ, x:t.x, y:t.y, pfade:t.pfade.slice(0, 3), ziel:t.ziel || 'erster', investiert:t.investiert, pops:t.pops || 0,
          winkel:-Math.PI / 2, dreh:0, cd:[], fcd:t.fcd || {}, stufe:t.stufe || 1, xp:t.xp || 0, temp:null, zielPunkt:t.zielPunkt, muster:t.muster || 'acht', phase:0, fx:t.x, fy:t.y, fw:0,
          besitzer:null, kraft:!!t.kraft, betaeubt:0
        });
      }
      s.neuBerechnen();
      for (const h of d.haufen || []) {
        const t = s.tuerme[h.turm];
        if (!t || !t.eff.angriffe[0] || !t.eff.angriffe[0].haufen) continue;
        s.haufenDazu(t, t.eff.angriffe[0], h.x, h.y, h.x, h.y);
        Object.assign(s.haufen[s.haufen.length - 1], { durchschlag:h.durchschlag, leben:h.leben, start:-1 });
      }
      return s;
    }
  }
  PT.Spiel = Spiel;
  PT.ZIELE = [['erster', 'Erster'], ['letzter', 'Letzter'], ['stark', 'Stärkster'], ['nah', 'Nächster']];
  PT.MUSTER = [['acht', 'Acht'], ['oval', 'Oval'], ['kreis', 'Kreis']];

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
