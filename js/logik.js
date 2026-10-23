'use strict';
// Pinguin Türmchen – Spiellogik. Rechnet auf der flachen Karte (x nach rechts, y nach unten, 1000 × 640),
// kennt keine Grafik. Was passiert (Schüsse, Treffer, Platzer, Geld …), landet in spiel.ereignisse
// und wird von der 3D-Darstellung abgeholt. Läuft auch in Node (test/sim.js).
(function (wurzel) {
  const PT = wurzel.PT || require('./pinguine.js');
  const { FISCHE } = PT;

  const SCHRITT = 2;          // Abstand der Wegpunkte in Pixeln
  const ZELLE = 64;           // Rastergröße für die Kollisionssuche
  const TURM_R = { markt:26, haeuptling:19, boot:20, orca:22, flieger:20, fabrik:21, moerser:19, eisbaer:24, koch:21, mecha:23 };
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
  // Boni aus dem Pingu-Dorf, die von außen kommen (Koop): nur bekannte Felder, nach oben begrenzt
  // Verbündete Haie aus Orkas Bucht im Pingu-Dorf (Stufe → wie oft und wie stark); hier, damit auch der Server sie kennt
  PT.DORF_HAIE = [null, { alle:30, schaden:3, riesen:30, ladung:12 }, { alle:20, schaden:4, riesen:40, ladung:16 }, { alle:12, schaden:5, riesen:60, ladung:22 }];
  const BONI_MAX = { geld:400, leben:40, tempo:0.15, reichweite:0.15, haie:3, fk:0.25 };
  PT.boniOk = function (b) {
    if (!b || typeof b !== 'object') return null;
    const r = {};
    for (const [k, max] of Object.entries(BONI_MAX)) if (Number.isFinite(b[k]) && b[k] > 0) r[k] = Math.min(max, b[k]);
    return Object.keys(r).length ? r : null;
  };

  class Spiel {
    // spieler (nur Koop): [{ id, name, held, kraft }], geldModus 'geteilt' oder 'getrennt'.
    // kraft: Meisterkraft des Helden (Pinguin-Pass) im Einzelspiel.
    // eigeneKarte: Karte aus dem Karten-Editor (wird mit PT.karteOk geprüft), dann heißt die Karte 'eigen'.
    // regeln: Einschränkungen der Tages-Herausforderung { erlaubt, ohneHeld, maxTuerme, geld, leben, preis, keinVerkauf, maxStufe, runden }.
    // boni: dauerhaftes Pinguin-Wissen { geld, leben, rabatt, bonus, heldXp, fk }.
    // Kampagne (in regeln): bosse { runde:[typ, stufe] }, startRunde (los geht es mit dieser Runde), wetter (immer dieses Wetter).
    // Abenteuer „Schwarzes Eis“ (in regeln): thema (Stimmung), wegeAb [runde je Kanal], zusatz (Extra-Fische), flut/flutPause,
    // zerstoeren { runde:anzahl }, heldFaellt (runde), finsternis { alle, dauer }, reichweite (Faktor), einsturz [[x, y, r, runde]], zweitePhase.
    // wetter: zufällige Wetter-Ereignisse ab Runde 6 an oder aus.
    constructor({ karte = 'scholle', stufe = 'mittel', runden = null, modus = 'standard', held = null, seed = 12345, kraft = false, spieler = null, geldModus = 'geteilt',
      eigeneKarte = null, regeln = null, boni = null, wetter = false } = {}) {
      const eigen = karte === 'eigen' && PT.karteOk(eigeneKarte);
      this.karte = eigen ? 'eigen' : PT.KARTEN[karte] ? karte : 'scholle';
      this.stufe = PT.STUFEN[stufe] ? stufe : 'mittel';
      this.modus = PT.MODI[modus] ? modus : 'standard';
      const md = PT.MODI[this.modus];
      this.regeln = regeln && typeof regeln === 'object' ? { ...regeln } : null;
      this.boni = boni && typeof boni === 'object' ? { ...boni } : null;
      const rg = this.regeln || {}, bo = this.boni || {};
      this.held = held && PT.HELDEN[held] && !md.ohneHeld && !rg.ohneHeld ? held : null;
      this.kraft = !!kraft;
      this.koop = Array.isArray(spieler) && spieler.length > 0;
      this.geldModus = this.koop && geldModus === 'getrennt' ? 'getrennt' : 'geteilt';
      this.kartenDaten = eigen || PT.KARTEN[this.karte];
      if (rg.thema && PT.STIMMUNGEN.includes(rg.thema)) this.kartenDaten = { ...this.kartenDaten, thema:rg.thema };
      this.wege = this.kartenDaten.wege.map(w => wegBauen(this.modus === 'umgekehrt' ? w.slice().reverse() : w));
      this.weg = this.wege[0];
      this.tunnel = this.kartenDaten.tunnel || [];
      this.schmelzen = this.kartenDaten.schmelzen || [];
      const st = PT.STUFEN[this.stufe];
      this.zielRunden = runden || rg.runden || md.runden || st.runden;
      this.unendlich = this.modus === 'sandkasten';
      const kartenGeld = this.kartenDaten.geld || 1;
      this.geldFaktor = (this.modus === 'halb' ? 0.5 : 1) * kartenGeld;
      this.geld = this.unendlich ? 999999 : Math.round((rg.geld || st.geld) * kartenGeld) + (bo.geld || 0);
      this.leben = this.unendlich ? 999999 : (rg.leben || st.leben) + (st.leben > 1 && !rg.leben ? bo.leben || 0 : 0);
      // Koop: Startgeld pro Spieler, getrennt hat jeder seine eigene Kasse
      this.spieler = [];
      if (this.koop) {
        this.held = null;
        this.spieler = spieler.slice(0, PT.KOOP_MAX).map((x, i) => ({
          id:String(x.id), name:String(x.name || 'Pinguin').slice(0, 16), farbe:i,
          held:x.held && PT.HELDEN[x.held] && !md.ohneHeld ? x.held : null, kraft:!!x.kraft, boni:PT.boniOk ? PT.boniOk(x.boni) : null,
          geld:this.geldModus === 'getrennt' ? this.geld : 0
        }));
        // Pingu-Dorf jedes Spielers: Startgeld in seine Kasse (bzw. die gemeinsame), Leben das Beste davon
        if (this.geldModus === 'geteilt' && !this.unendlich) this.geld = this.geld * this.spieler.length + this.spieler.reduce((n, x) => n + ((x.boni && x.boni.geld) || 0), 0);
        else if (!this.unendlich) for (const x of this.spieler) x.geld += (x.boni && x.boni.geld) || 0;
        if (st.leben > 1 && !rg.leben && !this.unendlich) this.leben += Math.max(0, ...this.spieler.map(x => (x.boni && x.boni.leben) || 0));
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
      this.statistik = { platzer:0, geleakt:0, verdient:0, zeit:0, faehigkeiten:0, bosse:0, verkauft:0, stufe5:0 };
      this.koeche = [];
      // Wetter: an/aus, das aktuelle Wetter (bis zur nächsten Runde) und sein Takt (Eisregen)
      this.wetterAn = !!wetter && !this.unendlich;
      this.wetter = null;
      this.wetterT = 0;
      this.finsternisBis = 0;
      this.dunkelT = 0;
      this.wellenEnde = 0;
      // Abenteuer: Denkmäler gefallener Helden (dort darf nichts hin), einstürzende Eisflächen
      this.denkmaeler = [];
      this.einsturz = Array.isArray(rg.einsturz) ? rg.einsturz.filter(z => Array.isArray(z) && z.length === 4) : [];
      // Versus: Einkommen pro Runde, geschickte Fische (zeit, typ) und Sabotage des Gegners
      this.einkommen = 0;
      this.extra = [];
      // Teil 2: verbündete Haie, die gegen den Strom schwimmen; Albtraum-Schwierigkeit
      this.verbuendete = [];
      this.verbT = 0;
      this.albtraum = !!rg.albtraum;
      if (this.albtraum && !this.unendlich) { this.geld = Math.round(this.geld * 0.75); this.leben = Math.max(1, Math.round(this.leben * 0.5)); }
      this.vs = { nebelBis:0, sturmBis:0 };
      if (rg.startRunde > 1) this.runde = Math.min(rg.startRunde - 1, this.zielRunden - 1);
    }
    get W() { return this.wetter ? PT.WETTER[this.wetter] : null; }

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
      if (this.regeln && this.regeln.erlaubt && !this.regeln.erlaubt.includes(typ)) return false;
      return !md.erlaubt || md.erlaubt.includes(typ);
    }
    // Wasserlöcher der Karte und Eisflächen, die schon geschmolzen sind
    teiche() {
      const t = this.kartenDaten.wasser || [];
      if (!this.schmelzen.length) return t;
      return t.concat(this.schmelzen.filter(z => z[3] <= this.runde).map(z => [z[0], z[1], z[2]]));
    }
    // gemeinsamer Rabatt aus Häuptling & Co., Pinguin-Wissen und Herausforderung
    preisFaktor() { return (this.regeln && this.regeln.preis) || 1; }
    rabattGesamt(r) { const w = (this.boni && this.boni.rabatt) || 0; return 1 - (1 - r) * (1 - w); }
    heldDa(sp = null) { return this.tuerme.find(t => PT.HELDEN[t.typ] && (!this.koop || t.besitzer === sp)); }
    // Einnahmen: an einen bestimmten Spieler (Kisten seines Markts) oder bei getrenntem Geld auf alle verteilt
    einnahme(betrag, an = null) {
      const W = this.W;
      const b = betrag * this.geldFaktor * (W && W.geld ? W.geld : 1);
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
    preisBau(typ, x, y) { return PT.preis(PT.def(typ).preis * this.preisFaktor(), this.stufe, this.rabattGesamt(x == null ? 0 : this.rabattAn(x, y))); }
    preisUpgrade(t, i) {
      const u = PT.PINGUINE[t.typ] && PT.PINGUINE[t.typ].pfade[i][t.pfade[i]];
      return u ? PT.preis(u.preis * this.preisFaktor(), this.stufe, this.rabattGesamt(this.rabattAn(t.x, t.y, t))) : Infinity;
    }
    // Stufe 5 gibt es pro Pinguinart und Pfad nur einmal
    upgradeErlaubt(t, i) {
      if (!PT.PINGUINE[t.typ] || !PT.upgradeErlaubt(t.pfade, i)) return false;
      if (this.regeln && this.regeln.maxStufe && t.pfade[i] >= this.regeln.maxStufe) return false;
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
      for (const [hx, hy, hr] of this.tunnel) if (Math.hypot(hx - x, hy - y) < hr + r - 4) return false;
      for (const [hx, hy] of this.denkmaeler) if (Math.hypot(hx - x, hy - y) < 22 + r) return false;
      for (const [hx, hy, hr, rn] of this.einsturz) if (rn <= this.runde && Math.hypot(hx - x, hy - y) < hr + r - 6) return false;
      const teiche = this.teiche();
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
      if (this.regeln && this.regeln.maxTuerme && !PT.HELDEN[typ] && this.tuerme.filter(t => !PT.HELDEN[t.typ]).length >= this.regeln.maxTuerme) return null;
      const preis = this.preisBau(typ, x, y);
      const kasse = this.kasse(sp);
      if (preis > kasse.geld) return null;
      if (!this.unendlich) kasse.geld -= preis;
      const def = PT.def(typ);
      const kraft = !!PT.HELDEN[typ] && (this.koop ? this.spielerVon(sp).kraft : this.kraft);
      const t = {
        id:this.naechsteId++, typ, x, y, pfade:[0, 0, 0], ziel:def.ziele ? def.ziele[0][0] : 'erster', investiert:preis, pops:0,
        winkel:-Math.PI / 2, dreh:0, cd:[], fcd:{}, stufe:1, xp:0, temp:null, muster:'acht', phase:0, fx:x, fy:y, fw:0,
        besitzer:this.koop ? sp : null, kraft, betaeubt:0, betaeubtArt:null
      };
      if (typ === 'moerser') t.zielPunkt = this.standardZiel(x, y);
      this.tuerme.push(t);
      this.statistik.maxTuerme = Math.max(this.statistik.maxTuerme || 0, this.tuerme.filter(x => !PT.HELDEN[x.typ]).length);
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
      if (t.pfade[i] === 5) this.statistik.stufe5++;
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
      t.xp += xp * (1 + ((this.boni && this.boni.heldXp) || 0));
      let auf = false;
      while (t.stufe < 10 && t.xp >= PT.HELDEN_STUFEN[t.stufe + 1]) { t.stufe++; auf = true; }
      if (auf) { this.neuBerechnen(); this.ereignisse.push({ art:'aufstieg', turm:t, stufe:t.stufe }); }
    }
    verkaufswert(t) { return Math.floor(t.investiert * PT.VERKAUF); }
    verkaufen(t, wert = null) {
      const i = this.tuerme.indexOf(t);
      if (i < 0) return;
      this.tuerme.splice(i, 1);
      if (wert == null) this.statistik.verkauft++;
      if (!this.unendlich) this.kasse(t.besitzer).geld += wert == null ? this.verkaufswert(t) : wert;
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
        // Pingu-Dorf: Schmiede (Angriffstempo) und Wachturm (Reichweite), im Koop die des Besitzers
        const bo = this.koop ? (this.spielerVon(t.besitzer) || {}).boni : this.boni;
        if (bo && (bo.tempo || bo.reichweite)) {
          if (bo.reichweite && e.reichweite < 5000) e.reichweite *= 1 + bo.reichweite;
          for (const a of e.angriffe) {
            if (bo.tempo) a.intervall /= 1 + bo.tempo;
            if (bo.reichweite && a.reichweite) a.reichweite *= 1 + bo.reichweite;
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
      this.koeche = this.tuerme.filter(t => t.eff.koch);
    }

    /* ---------- Runden ---------- */
    rundeStarten() {
      if (this.laeuft || this.vorbei || (this.gewonnen && !this.endlos)) return false;
      const n = this.runde + 1;
      const rg = this.regeln || {};
      const r = PT.runde(n, this.modus, rg.bosse, rg.zusatz, rg.ersetzen);
      this.wetterWaehlen(n);
      this.storyRunde(n);
      this.laeuft = true;
      this.sandWelle = false;
      this.rundenZeit = 0;
      this.zaeh = r.zaeh;
      this.warteschlange = [];
      let ende = 0;
      // Kanäle, die schon offen sind (Abenteuer: manche öffnen sich erst später – Überfall von der Seite!)
      let offen = this.wege.map((w, i) => i).filter(i => !rg.wegeAb || (rg.wegeAb[i] || 1) <= n);
      if (rg.wegRotation && this.wege.length > 1) {
        const i = (n - 1) % this.wege.length, [x, y] = this.wege[i].punkt(this.wege[i].vonDist + 30);
        offen = offen.filter(k => k !== i);   // diese Ader ruht, die anderen pumpen
        this.ereignisse.push({ art:'wegWechsel', weg:i, x, y });
      }
      if (rg.wegeAb) rg.wegeAb.forEach((ab, i) => { if (ab === n && n > 1 && this.wege[i]) this.ereignisse.push({ art:'wegOffen', weg:i, x:this.wege[i].punkt(this.wege[i].vonDist + 30)[0], y:this.wege[i].punkt(this.wege[i].vonDist + 30)[1] }); });
      const wn = offen.length || 1;
      r.gruppen.forEach((g, gi) => {
        for (let i = 0; i < g.anzahl; i++) {
          this.warteschlange.push({ t:g.start + i * g.abstand, typ:g.typ, camo:g.camo, nach:g.nach, fest:g.fest, p:offen[(gi + i) % wn] || 0, boss:g.typ === r.bossTyp ? r.boss : 0 });
        }
        ende = Math.max(ende, g.start + g.anzahl * g.abstand);
      });
      this.wellenEnde = ende;
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
      this.ereignisse.push({ art:'rundeStart', runde:n, boss:r.boss || 0, bossTyp:r.bossTyp || null, wetter:this.wetter });
      return true;
    }
    // Abenteuer: zu Beginn einer Runde zerstört Sabotage die teuersten Pinguine, ein Held fällt
    storyRunde(n) {
      const rg = this.regeln;
      if (!rg) return;
      const anzahl = rg.zerstoeren && rg.zerstoeren[n];
      if (anzahl > 0) {
        const ziele = this.tuerme.filter(t => !PT.HELDEN[t.typ]).sort((a, b) => b.investiert - a.investiert || a.id - b.id).slice(0, anzahl);
        for (const t of ziele) {
          this.ereignisse.push({ art:'zerstoert', x:t.x, y:t.y, typ:t.typ });
          this.verkaufen(t, Math.floor(t.investiert * 0.5));
        }
        this.ereignisse.push({ art:'sabotiert', anzahl:ziele.length });
      }
      if (rg.heldFaellt === n) {
        const h = this.tuerme.find(t => PT.HELDEN[t.typ]);
        if (h) {
          this.denkmaeler.push([h.x, h.y, h.typ]);
          this.verkaufen(h, 0);
        }
        // Wut: alle Pinguine greifen eine Weile schneller an
        for (const t of this.tuerme) t.temp = { faktor:1.5, bis:this.zeit + 25 };
        this.ereignisse.push({ art:'heldGefallen', typ:h ? h.typ : null, x:h ? h.x : null, y:h ? h.y : null });
      }
    }
    // Wetter für die neue Runde: fest (Kampagne) oder ab Runde 6 mit etwas Glück (auf manchen Karten öfter)
    wetterWaehlen(n) {
      const fest = this.regeln && this.regeln.wetter;
      if (fest && PT.WETTER[fest]) { this.wetter = fest; return; }
      this.wetter = null;
      if (!this.wetterAn || n < PT.WETTER_AB) return;
      const chance = this.kartenDaten.wetterOft ? 0.6 : 0.3;
      if (this.zufall() < chance) this.wetter = PT.WETTER_REIHE[Math.floor(this.zufall() * PT.WETTER_REIHE.length)];
      this.wetterT = 0;
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
      if (T.boss) hp = PT.BOSSE[typ].hp[mods.boss || 1] * (this.albtraum ? 1.5 : 1);
      if (T.riese && !T.boss && this.sabotage && this.sabotage.riesen && this.zeit < this.sabotage.bis) hp *= this.sabotage.riesen;
      const f = {
        id:this.naechsteId++, typ, p, hp, dist, camo:!!mods.camo || T.immer === 'camo', fest, boss:T.boss ? mods.boss || 1 : 0, phase:0,
        nach:!!mods.nach && !T.riese, ursprung:mods.ursprung || typ, nachT:0,
        frost:0, betaeubt:0, langsam:1, langsamT:0, wind:1, x:-100, y:-100, w:0, tot:false, geboren:this.zeit,
        luft:0, sprungT:T.springen ? (this.naechsteId % 9) * 0.29 : 0, gross:0, blasPause:0, tunnel:false, bossT:0, kt:{}, schild:0, geschickt:!!mods.geschickt,
        gespiegelt:!!mods.gespiegelt
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
      if (f.gross > 0 || f.schild > 0) return false;   // aufgeblasener Kugelfisch, Eispanzer von Kapitän Frost: alles prallt ab
      const T = FISCHE[f.typ], riese = !!T.riese;
      if (a.helmWeg && f.fest && !f.boss) { f.fest = false; f.hpMax /= 2; f.hp = Math.min(f.hp, f.hpMax); }
      if (a.frost && !riese && !this.immun(f, 'kaelte')) f.frost = Math.max(f.frost, a.frost);
      if (a.verlangsam && !riese) { f.langsam = Math.min(f.langsam, a.verlangsam); f.langsamT = Math.max(f.langsamT, a.verlangsamDauer); }
      if (a.riesenLangsam && riese && !f.boss) { f.langsam = Math.min(f.langsam, a.riesenLangsam); f.langsamT = Math.max(f.langsamT, 1.5); }
      if (a.betaeuben && !riese) f.betaeubt = Math.max(f.betaeubt, a.betaeuben);
      if (a.riesenBetaeuben && riese && !f.boss) f.betaeubt = Math.max(f.betaeubt, a.riesenBetaeuben);
      if (a.ablenken && !riese && this.zufall() < a.ablenken) f.dist = Math.max(0, f.dist - 50);
      // Sturm weht zurück, Hexengift wirkt nach, Krötentrank verwandelt kleine Fische, Riesen-Fluch nagt am Leben
      if (a.zurueck && !f.boss) f.dist = Math.max(0, f.dist - (riese ? a.zurueck / 3 : a.zurueck));
      if (a.gift) {
        const dps = a.gift.dps * (riese ? a.gift.riesen || 1 : 1);
        if (dps >= (f.gift || 0) || f.giftT <= 0) { f.gift = dps; f.giftVon = turm ? turm.id : null; }
        f.giftT = Math.max(f.giftT || 0, a.gift.dauer);
      }
      if (a.verwandeln && !riese && f.typ !== 'rot' && this.zufall() < a.verwandeln) {
        f.typ = 'rot'; f.hp = f.hpMax = 1; f.fest = false; f.nach = false;
        this.ereignisse.push({ art:'verwandelt', x:f.x, y:f.y });
        return true;
      }
      if (a.schrumpf && riese) { f.hp -= f.hpMax * a.schrumpf * (f.boss ? 0.25 : 1); if (f.boss) this.bossPruefen(f); }
      const schaden = a.schaden + (riese ? a.riesen : 0);
      if (schaden <= 0) return true;
      f.hp -= schaden;
      f.nachT = 0;
      if (riese) this.ereignisse.push({ art:'riesenTreffer', fisch:f });
      if (f.boss) this.bossPruefen(f);
      if (f.hp <= 0) this.platzen(f, -f.hp, turm, getroffen, a.typ);
      else if (T.aufblasen && f.blasPause <= 0) { f.gross = T.aufblasen.dauer; f.blasPause = T.aufblasen.dauer + T.aufblasen.pause; this.ereignisse.push({ art:'aufblasen', x:f.x, y:f.y }); }
      return true;
    }
    // Pinguine im Umkreis betäuben (Flutwelle, Eisatem, Tinte); Eisbären mit dickem Fell und Flieger in der Luft nicht
    pinguineBetaeuben(x, y, r, dauer, art) {
      for (const t of this.tuerme) {
        if (t.eff.unbeirrbar || t.eff.flieger || Math.hypot(t.x - x, t.y - y) > r) continue;
        if (dauer >= (t.betaeubt || 0)) { t.betaeubt = dauer; t.betaeubtArt = art; }
      }
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
          this.pinguineBetaeuben(f.x, f.y, B.betaeuben.radius, dauer, 'flut');
          this.ereignisse.push({ art:'flutwelle', x:f.x, y:f.y, r:B.betaeuben.radius });
        }
        this.ereignisse.push({ art:'bossPhase', fisch:f, phase:f.phase });
      }
    }
    platzen(f, ueber, turm, getroffen, typ) {
      f.tot = true;
      const T = FISCHE[f.typ];
      this.einnahme(f.boss ? PT.BOSSE[f.typ].belohnung * f.boss : 1);
      this.statistik.platzer++;
      if (f.boss) { this.statistik.bosse++; this.statistik.bossTypen = { ...(this.statistik.bossTypen || {}), [f.typ]:true }; }
      if (turm) {
        turm.pops++;
        if (T.riese && turm.eff && turm.eff.kopfgeld) this.einnahme(turm.eff.kopfgeld, turm.besitzer);
      }
      // Koch-Pinguine in der Nähe machen Fischstäbchen daraus (der beste zählt)
      if (this.koeche.length) {
        let best = null;
        for (const k of this.koeche) if (Math.hypot(k.x - f.x, k.y - f.y) <= k.eff.reichweite && (!best || k.eff.koch > best.eff.koch)) best = k;
        if (best) { best.verdient = (best.verdient || 0) + this.einnahme(best.eff.koch, best.besitzer); }
      }
      if (T.tinte) {
        this.pinguineBetaeuben(f.x, f.y, T.tinte.radius, T.tinte.dauer, 'tinte');
        this.ereignisse.push({ art:'tinte', x:f.x, y:f.y, r:T.tinte.radius });
      }
      this.ereignisse.push({ art:f.boss ? 'bossBesiegt' : 'platzen', x:f.x, y:f.y, typ:f.typ, boss:f.boss, von:turm ? turm.besitzer : null, eigen:!!turm });
      // Abenteuer-Finale: Abyssos zerbricht – und steht als Pako wieder auf
      const zweite = f.boss && PT.BOSSE[f.typ].zweite;
      if (zweite && this.regeln && this.regeln.zweitePhase) {
        const neu = this.neuerFisch(zweite, Math.max(0, f.dist - 60), { boss:f.boss }, null, f.p);
        this.ereignisse.push({ art:'zweitePhase', typ:zweite, x:neu.x, y:neu.y, fisch:neu });
      }
      const kinder = FISCHE[f.typ].kinder;
      // Spiegel: nur Fische aus der Welle selbst (nicht ihre Kinder) werfen ein Spiegelbild in den anderen Kanal
      const rs = this.regeln && this.regeln.spiegel;
      if (rs && !f.boss && !f.gespiegelt && f.ursprung === f.typ && kinder.length && this.wege.length > 1 && this.zufall() < rs) {
        const q = (f.p + 1) % this.wege.length, anteil = f.dist / this.wege[f.p].laenge;
        const c = this.neuerFisch(kinder[0], anteil * this.wege[q].laenge, { gespiegelt:true }, null, q);
        this.ereignisse.push({ art:'gespiegelt', x:c.x, y:c.y });
      }
      const neue = [];
      kinder.forEach((k, i) => {
        const c = this.neuerFisch(k, Math.max(0, f.dist - i * (FISCHE[f.typ].riese ? 14 : 7)),
          { camo:f.camo && FISCHE[f.typ].immer !== 'camo', nach:f.nach, ursprung:f.ursprung, fest:f.fest && PT.kannGepanzert(k), geschickt:f.geschickt, gespiegelt:f.gespiegelt }, f, f.p);
        if (getroffen) getroffen.add(c.id);
        neue.push(c);
      });
      if (ueber > 0) {
        const c = neue.find(c => !this.immun(c, typ));
        if (c) { c.hp -= ueber; if (c.hp <= 0) this.platzen(c, -c.hp, turm, getroffen, typ); }
      }
    }

    /* ---------- Ziele ---------- */
    // t: der Pinguin, der schauen will – im Tunnel sieht nur der Taucher, springende Fische treffen nur Flieger
    kannSehen(f, camo, t) {
      if (f.tot) return false;
      if ((f.camo || (!f.boss && this.zeit < this.finsternisBis)) && !camo && !(this.W && this.W.camo)) return false;
      if (f.tunnel && !(t && t.eff && t.eff.tunnel)) return false;
      if (f.luft > 0 && !(t && t.eff && t.eff.flieger)) return false;
      return f.x > -5 && f.x < PT.BREITE + 5 && f.y > -5 && f.y < PT.HOEHE + 5;
    }
    erreichbar(f, t) { return !(f.tunnel && !(t && t.eff && t.eff.tunnel)) && !(f.luft > 0 && !(t && t.eff && t.eff.flieger)); }
    aufKarte(f) { return !f.tot && f.x > -5 && f.x < PT.BREITE + 5 && f.y > -5 && f.y < PT.HOEHE + 5; }
    zielSuchen(t, a, reichweite, ox, oy, modus) {
      let best = null, bw = -Infinity;
      modus = modus || t.ziel;
      for (const f of this.fische) {
        if (!this.kannSehen(f, t.eff.camo, t) || this.immun(f, a.typ, a)) continue;
        if (a.nurRiesen && !FISCHE[f.typ].riese) continue;
        const d = Math.hypot(f.x - ox, f.y - oy);
        if (d > reichweite + FISCHE[f.typ].r * 0.6) continue;
        let w;
        if (modus === 'letzter') w = -f.dist;
        else if (modus === 'stark') w = FISCHE[f.typ].rbe * 10000 + f.dist;
        else if (modus === 'nah') w = -d;
        else if (modus === 'riese') w = (FISCHE[f.typ].riese ? 1e7 : 0) + f.dist / this.wege[f.p].laenge * 1e5;
        else if (modus === 'camo') w = (f.camo ? 1e7 : 0) + f.dist / this.wege[f.p].laenge * 1e5;
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
      if (f.boss) return FISCHE[f.typ].tempo * (1 + sab) / 2 * this.stroemung(f);
      const W = this.W;
      return FISCHE[f.typ].tempo * f.langsam * f.wind * sab * (f.luft > 0 ? 1.5 : 1) * (W && W.fischTempo ? W.fischTempo : 1) * (this.zeit < this.vs.sturmBis ? 1.35 : 1)
        * this.stroemung(f) * (this.imLicht(f.x) ? 1.2 : 1) * (this.albtraum ? 1.12 : 1);
    }

    // Orkas Bucht (Pingu-Dorf): verbündete Haie auch ohne Abenteuer – im Koop gilt die beste Bucht
    dorfHaie() {
      if (this.unendlich) return null;
      const n = this.koop ? Math.max(0, ...this.spieler.map(x => (x.boni && x.boni.haie) || 0)) : (this.boni && this.boni.haie) || 0;
      return PT.DORF_HAIE[Math.min(3, n | 0)] || null;
    }
    // Strömung (Karte): auf manchen Abschnitten schwimmen Fische schneller
    stroemung(f) {
      const st = this.kartenDaten.stroemung;
      if (!st) return 1;
      const a = f.dist / this.wege[f.p].laenge;
      for (const [k, von, bis, faktor] of st) if (k === f.p && a >= von && a <= bis) return faktor;
      return 1;
    }
    // Lichtstrahlen (Abenteuer): senkrechte Bänder, die von links nach rechts über die Karte wandern (Mitte jedes Bands)
    lichtStrahlen() {
      const L = this.regeln && this.regeln.licht;
      if (!L) return [];
      const B = L.breite || 70, weg = PT.BREITE + B, r = [];
      for (let i = 0; i < L.anzahl; i++) r.push(((this.zeit * L.tempo + i * weg / L.anzahl) % weg) - B / 2);
      return r;
    }
    imLicht(x) {
      const L = this.regeln && this.regeln.licht;
      if (!L) return false;
      const h = (L.breite || 70) / 2;
      return this.lichtStrahlen().some(m => Math.abs(m - x) <= h);
    }

    /* ---------- Angriffe ---------- */
    feuern(t, a) {
      const flieger = !!t.eff.flieger;
      const ox = flieger ? t.fx : t.x, oy = flieger ? t.fy : t.y;
      const W = this.W;
      const R = (a.reichweite || t.eff.reichweite) * (W && W.reichweite ? W.reichweite : 1) * ((this.regeln && this.regeln.reichweite) || 1) * (this.zeit < this.vs.nebelBis ? 0.7 : 1);
      if (a.art === 'ring' || a.art === 'frost') {
        let n = 0, traf = false;
        for (const f of this.fische) {
          if (n >= a.durchschlag) break;
          if (!this.kannSehen(f, t.eff.camo, t)) continue;
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
        if (!this.fische.some(f => this.kannSehen(f, true, t) && Math.hypot(f.x - ox, f.y - oy) < R)) return false;
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
            if (g.tot || schon.has(g.id) || !this.kannSehen(g, true, t) || this.immun(g, a.typ)) continue;
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
        if (f.tot || f.id === ohne || !this.erreichbar(f, t)) continue;
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

    imTunnel(x, y) { for (const [tx, ty, tr] of this.tunnel) if (Math.hypot(tx - x, ty - y) < tr) return true; return false; }

    /* ---------- Stachelhaufen ---------- */
    haufenOrte(t, R, anzahl) {
      const kandidaten = [];
      for (const w of this.wege) {
        for (let d = w.vonDist; d <= w.bisDist; d += 12) {
          const [x, y] = w.punkt(d);
          if (Math.hypot(x - t.x, y - t.y) <= R && !this.imTunnel(x, y)) kandidaten.push([x, y, d / w.laenge]);
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
      t.fcd[id] = f.cd * (1 - ((this.boni && this.boni.fk) || 0));
      this.statistik.faehigkeiten++;
      const sichtbar = () => this.fische.filter(x => this.aufKarte(x));
      const alleTreffen = (schaden, riesen) => {
        for (const x of sichtbar()) this.treffer(x, PT.angriff({ schaden, riesen:riesen || 0, typ:'normal' }), t, null);
      };
      switch (id) {
        case 'turbo': case 'overdrive': t.temp = { faktor:f.faktor, bis:this.zeit + f.dauer }; break;
        case 'schlachtruf': case 'schleier': case 'party': case 'festmahl': case 'walrossruf': {
          if (id === 'walrossruf') { this.einnahme(f.betrag, t.besitzer); this.ereignisse.push({ art:'kiste', turm:t, wert:Math.round(f.betrag * this.geldFaktor) }); }
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
        case 'sternschnuppe': case 'prisma':
          for (const x of sichtbar()) { x.camo = false; x.enttarnt = true; }
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
        case 'fluch':
          for (const x of sichtbar()) { x.gift = Math.max(x.gift || 0, f.dps); x.giftT = Math.max(x.giftT || 0, f.dauer); x.giftVon = t.id; }
          this.ereignisse.push({ art:'ring', x:t.x, y:t.y, r:600, bild:'gift', turm:t });
          break;
        case 'orkan': case 'lawine':
          for (const x of sichtbar()) {
            if (!x.boss) x.dist = Math.max(0, x.dist - (FISCHE[x.typ].riese ? f.weite / 2 : f.weite));
            if (id === 'lawine' && !FISCHE[x.typ].riese && !this.immun(x, 'kaelte')) x.frost = Math.max(x.frost, f.dauer);
          }
          if (f.schaden) alleTreffen(f.schaden, f.riesen);
          this.ereignisse.push({ art:'ring', x:t.x, y:t.y, r:600, bild:id === 'orkan' ? 'wind' : 'frostStark', turm:t });
          break;
        case 'meteor': {
          const ziele = [];
          const a = PT.angriff({ schaden:Math.round(f.schaden / 30), riesen:f.schaden, typ:'normal', splash:60, splashDurchschlag:30, bild:'meteor' });
          for (let i = 0; i < f.anzahl; i++) {
            const z = this.staerkster(false);
            if (!z) break;
            ziele.push([z.x, z.y]);
            this.treffer(z, PT.angriff({ schaden:f.schaden, typ:'normal' }), t, null);
            this.explosion(z.x, z.y, a, t, z.id);
          }
          this.ereignisse.push({ art:'geschossFaehigkeit', id, turm:t, ziele });
          break;
        }
        case 'schwarzloch':
          for (const x of sichtbar()) if (!x.boss) { x.dist = Math.max(0, x.dist - (FISCHE[x.typ].riese ? f.weite / 2 : f.weite)); x.betaeubt = Math.max(x.betaeubt, f.dauer); }
          this.ereignisse.push({ art:'ring', x:t.x, y:t.y, r:600, bild:'ringLila', turm:t });
          break;
        case 'supernova': alleTreffen(f.schaden, f.riesen); break;
        case 'bauchklatscher':
          for (const x of sichtbar()) {
            if (Math.hypot(x.x - t.x, x.y - t.y) > f.radius) continue;
            if (!x.boss) x.betaeubt = Math.max(x.betaeubt, FISCHE[x.typ].riese ? f.dauer / 2 : f.dauer);
            this.treffer(x, PT.angriff({ schaden:f.schaden, riesen:f.riesen, typ:'normal' }), t, null);
          }
          this.ereignisse.push({ art:'ring', x:t.x, y:t.y, r:f.radius, bild:'strudel', turm:t });
          break;
        case 'finale': case 'raketenhagel': {
          const a = PT.angriff({ schaden:f.schaden, riesen:f.riesen, typ:'normal', splash:55, splashDurchschlag:40, bild:id === 'finale' ? 'feuerwerk' : 'rakete' });
          for (const w of this.wege) for (let i = 0; i < 12; i++) {
            const [x, y] = w.punkt(w.vonDist + (w.bisDist - w.vonDist) * (i + 0.5) / 12);
            this.explosion(x, y, a, t, null);
          }
          break;
        }
        case 'beben':
          for (const x of sichtbar()) {
            if (!x.boss) x.betaeubt = Math.max(x.betaeubt, FISCHE[x.typ].riese ? f.dauer / 2 : f.dauer);
            this.treffer(x, PT.angriff({ schaden:f.schaden, riesen:f.riesen, typ:'normal' }), t, null);
          }
          this.ereignisse.push({ art:'ring', x:t.x, y:t.y, r:520, bild:'stampfer', turm:t });
          break;
        case 'tsunami': case 'orcaflut':
          for (const x of sichtbar()) if (!x.boss) x.dist = Math.max(0, x.dist - (FISCHE[x.typ].riese ? f.weite / 2 : f.weite));
          alleTreffen(f.schaden, f.riesen);
          this.ereignisse.push({ art:'ring', x:t.x, y:t.y, r:500, bild:'strudel', turm:t });
          break;
        case 'stampf':
          for (const x of sichtbar()) {
            if (Math.hypot(x.x - t.x, x.y - t.y) > f.radius) continue;
            if (!x.boss) x.betaeubt = Math.max(x.betaeubt, FISCHE[x.typ].riese ? f.dauer / 2 : f.dauer);
            this.treffer(x, PT.angriff({ schaden:f.schaden, riesen:f.riesen, typ:'normal' }), t, null);
          }
          this.ereignisse.push({ art:'ring', x:t.x, y:t.y, r:f.radius, bild:'bruell', turm:t });
          break;
        case 'eisgefaengnis': case 'eisherrschaft':
          for (const x of sichtbar()) {
            if (x.boss) continue;
            if (FISCHE[x.typ].riese) x.betaeubt = Math.max(x.betaeubt, f.dauer * 0.6);
            else x.frost = Math.max(x.frost, f.dauer);
          }
          if (f.schaden) alleTreffen(f.schaden, f.riesen);
          this.ereignisse.push({ art:'ring', x:t.x, y:t.y, r:600, bild:'frostStark', turm:t });
          break;
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
        this.statistik.zeit += dt;
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
        // Fischflut: die nächste Runde kommt, sobald diese ganz losgeschwommen ist (Abenteuer/Versus: mit kurzer Pause)
        const rg = this.regeln || {};
        if ((this.modus === 'flut' || rg.flut) && !q.length && !this.sandWelle && this.rundenZeit >= this.wellenEnde + (rg.flutPause || 0)
          && (this.endlos || this.runde + 1 < this.zielRunden)) {
          this.laeuft = false;
          this.rundeAbschliessen();
          this.rundeStarten();
        }
        for (const t of this.tuerme) for (const id of Object.keys(t.fcd)) if (t.fcd[id] > 0) t.fcd[id] -= dt;
        // Abenteuer: die Tiefe löscht immer wieder das Licht
        const fi = this.regeln && this.regeln.finsternis;
        if (fi && (this.dunkelT += dt) >= fi.alle) {
          this.dunkelT = 0;
          this.finsternisBis = Math.max(this.finsternisBis, this.zeit + fi.dauer);
          this.ereignisse.push({ art:'finsternis', x:PT.BREITE / 2, y:PT.HOEHE / 2, dauer:fi.dauer, tiefe:true });
        }
      }
      // Teil 2: verbündete Haie schwimmen vom Ende des Kanals gegen den Strom und rammen Fische
      const vb = (this.regeln && this.regeln.verbuendete) || this.dorfHaie();
      if (vb && this.laeuft && (this.verbT += dt) >= vb.alle) {
        this.verbT = 0;
        const p = Math.floor(this.zufall() * this.wege.length), w = this.wege[p];
        this.verbuendete.push({ id:this.naechsteId++, p, dist:w.bisDist, ladung:vb.ladung || 25, getroffen:new Set() });
        this.ereignisse.push({ art:'verbuendet', x:w.punkt(w.bisDist)[0], y:w.punkt(w.bisDist)[1] });
      }
      for (const v of this.verbuendete) {
        const w = this.wege[v.p];
        v.dist -= 120 * dt;
        [v.x, v.y, v.w] = w.punkt(v.dist);
        for (const f of this.fische) {
          if (f.tot || f.p !== v.p || v.getroffen.has(f.id) || Math.abs(f.dist - v.dist) > 26 + FISCHE[f.typ].r * 0.5) continue;
          v.getroffen.add(f.id);
          this.treffer(f, PT.angriff({ schaden:vb ? vb.schaden || 3 : 3, riesen:vb ? vb.riesen || 30 : 30, typ:'normal' }), null, null);
          if (--v.ladung <= 0) break;
        }
      }
      if (this.verbuendete.length) this.verbuendete = this.verbuendete.filter(v => v.ladung > 0 && v.dist > this.wege[v.p].vonDist - 20 && this.laeuft);
      // Versus: vom Gegner geschickte Fische (zählen nicht zur Runde)
      while (this.extra.length && this.extra[this.extra.length - 1][0] <= this.zeit) {
        const [, typ, p] = this.extra.pop();
        if (FISCHE[typ]) this.neuerFisch(typ, 0, { geschickt:true }, null, p % this.wege.length);
      }

      // Eisregen: kleine Fische frieren immer wieder kurz ein
      const W = this.W;
      if (W && W.frost && this.laeuft) {
        this.wetterT += dt;
        if (this.wetterT >= W.frost.alle) {
          this.wetterT = 0;
          for (const f of this.fische) if (!f.tot && !FISCHE[f.typ].riese && !this.immun(f, 'kaelte')) f.frost = Math.max(f.frost, W.frost.dauer);
          this.ereignisse.push({ art:'eisregen' });
        }
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
        // Schattenrochen: taucht alle 5 s für 1,6 s auf, dann trifft ihn jeder Pinguin (Sternschnuppen enttarnen ihn ganz)
        if (T.immer === 'camo' && !f.enttarnt) { f.tauchT = (f.tauchT || 0) + dt; f.camo = f.tauchT % 5 < 3.4; }
        if (f.camo && (ueberall || leucht.some(t => Math.hypot(f.x - t.x, f.y - t.y) <= t.eff.reichweite))) f.camo = false;
        if (this.entwachsen) f.nach = false;
        if (this.entpanzern && f.fest) { f.fest = false; f.hpMax /= 2; f.hp = Math.min(f.hp, f.hpMax); }
        // Kugelfisch bläst sich auf, Fliegender Fisch springt, Bosse setzen ihre Kräfte ein
        if (f.gross > 0) f.gross -= dt;
        if (f.schild > 0) f.schild -= dt;
        if (f.blasPause > 0) f.blasPause -= dt;
        if (T.springen && f.frost <= 0 && f.betaeubt <= 0) {
          if (f.luft > 0) f.luft -= dt;
          else if ((f.sprungT += dt) >= T.springen.alle) { f.sprungT = 0; f.luft = T.springen.dauer; this.ereignisse.push({ art:'sprung', x:f.x, y:f.y }); }
        }
        if (f.boss) this.bossKraft(f, dt);
        if (T.schutz) {
          f.kt.schutz = (f.kt.schutz || 0) + dt;
          if (f.kt.schutz >= T.schutz.alle) {
            f.kt.schutz = 0;
            for (const g of this.fische) if (!g.tot && !g.boss && Math.hypot(g.x - f.x, g.y - f.y) <= T.schutz.radius) g.schild = Math.max(g.schild || 0, T.schutz.dauer);
            this.ereignisse.push({ art:'kristallschutz', x:f.x, y:f.y, r:T.schutz.radius });
          }
        }
        if (f.giftT > 0) {
          f.giftT -= dt;
          f.giftRest = (f.giftRest || 0) + f.gift * dt;
          if (f.giftRest >= 1) {
            const n = Math.floor(f.giftRest);
            f.giftRest -= n;
            const von = f.giftVon != null ? this.tuerme.find(t => t.id === f.giftVon) || null : null;
            this.treffer(f, PT.angriff({ schaden:n, typ:'normal' }), von, null);
            if (f.tot) continue;
          }
        }
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
        f.tunnel = this.tunnel.length > 0 && this.imTunnel(f.x, f.y);
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
        if (t.betaeubt > 0) { t.betaeubt -= dt; if (t.betaeubt <= 0) t.betaeubtArt = null; continue; }   // Flutwelle, Eisatem oder Tinte
        const tempo = (t.temp && this.zeit < t.temp.bis ? t.temp.faktor : 1) * (this.W && this.W.angriff ? this.W.angriff : 1) * (this.imLicht(t.x) ? 1.3 : 1);
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
          if (f.tot || g.getroffen.has(f.id) || !this.erreichbar(f, g.turm)) continue;
          const r = FISCHE[f.typ].r + g.groesse;
          if ((f.x - g.x) ** 2 + (f.y - g.y) ** 2 > r * r) continue;
          if (FISCHE[f.typ].spiegel && this.zufall() < FISCHE[f.typ].spiegel) {
            g.vx = -g.vx; g.vy = -g.vy; g.getroffen.add(f.id);
            if (this.ereignisse.length < 400) this.ereignisse.push({ art:'gespiegelt', x:f.x, y:f.y, klein:true });
            break;
          }
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
            if (f.tot || h.getroffen.has(f.id) || f.luft > 0) continue;
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
      // (Abenteuer/Versus mit regeln.flut: die Runde endet erst mit der Atempause, damit beide Spieler im Takt bleiben)
      const takt = this.regeln && this.regeln.flut && (this.endlos || this.runde + 1 < this.zielRunden);
      if (this.laeuft && !takt && !this.warteschlange.length && !this.fische.some(f => !f.geschickt)) {
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
    // Bosse mit Dauerkraft: Eisatem (friert Pinguine ein), Ruf (holt Fische herbei), Finsternis, Frostbefehl und Eispanzer.
    // Jede Kraft hat ihre eigene Uhr (f.kt).
    bossKraft(f, dt) {
      const B = PT.BOSSE[f.typ];
      if (!B) return;
      const kt = f.kt || (f.kt = {});
      const faellig = (k, alle) => { kt[k] = (kt[k] || 0) + dt; if (kt[k] < alle) return false; kt[k] = 0; return true; };
      if (B.finsternis && faellig('finsternis', B.finsternis.alle)) {
        this.finsternisBis = this.zeit + B.finsternis.dauer * (f.boss === 2 ? 1.3 : 1);
        this.ereignisse.push({ art:'finsternis', x:f.x, y:f.y, dauer:this.finsternisBis - this.zeit, typ:f.typ });
      }
      if (B.eisatem && faellig('eisatem', B.eisatem.alle)) {
        this.pinguineBetaeuben(f.x, f.y, B.eisatem.radius, B.eisatem.dauer[f.boss] || B.eisatem.dauer[1], 'eis');
        this.ereignisse.push({ art:'eisatem', x:f.x, y:f.y, r:B.eisatem.radius });
      }
      if (B.ruf && faellig('ruf', B.ruf.alle)) {
        const welle = B.ruf.welle[f.boss === 1 ? 0 : 1];
        for (const [typ, n] of welle) for (let i = 0; i < n; i++) this.neuerFisch(typ, Math.max(0, f.dist - 50 - i * 14), {}, null, f.p);
        this.ereignisse.push({ art:'bossRuf', fisch:f });
      }
      // Kapitän Frost kennt eure Stellungen: friert die wertvollsten Pinguine ein (Eisbären mit dickem Fell nicht)
      if (B.frostbefehl && faellig('frostbefehl', B.frostbefehl.alle)) {
        const n = B.frostbefehl.anzahl[f.boss] || 2, dauer = B.frostbefehl.dauer[f.boss] || 2.5;
        const ziele = this.tuerme.filter(t => !t.eff.unbeirrbar && !PT.HELDEN[t.typ]).sort((a, b) => b.investiert - a.investiert || a.id - b.id).slice(0, n);
        for (const t of ziele) if (dauer >= (t.betaeubt || 0)) { t.betaeubt = dauer; t.betaeubtArt = 'eis'; }
        this.ereignisse.push({ art:'frostbefehl', x:f.x, y:f.y, ziele:ziele.map(t => [t.x, t.y]) });
      }
      if (B.blenden && faellig('blenden', B.blenden.alle)) {
        this.pinguineBetaeuben(f.x, f.y, B.blenden.radius, B.blenden.dauer[f.boss] || B.blenden.dauer[1], 'licht');
        this.ereignisse.push({ art:'blenden', x:f.x, y:f.y, r:B.blenden.radius });
      }
      if (B.schutzAura && faellig('schutzAura', B.schutzAura.alle)) {
        for (const g of this.fische) if (!g.tot && !g.boss && Math.hypot(g.x - f.x, g.y - f.y) <= B.schutzAura.radius) g.schild = B.schutzAura.dauer;
        this.ereignisse.push({ art:'kristallschutz', x:f.x, y:f.y, r:B.schutzAura.radius });
      }
      if (B.eispanzer && faellig('eispanzer', B.eispanzer.alle)) {
        for (const g of this.fische) if (!g.tot && !g.boss && Math.hypot(g.x - f.x, g.y - f.y) <= B.eispanzer.radius) g.schild = B.eispanzer.dauer;
        this.ereignisse.push({ art:'eispanzer', x:f.x, y:f.y, r:B.eispanzer.radius });
      }
    }
    // Schmelzscholle: Eisflächen werden zu Wasser; wer dort steht, bekommt alles zurück
    schmelzPruefen() {
      for (const z of this.schmelzen) {
        if (z[3] === this.runde + 1) this.ereignisse.push({ art:'schmelzWarnung', x:z[0], y:z[1], r:z[2] });
        if (z[3] !== this.runde) continue;
        for (const t of this.tuerme.slice()) {
          if (PT.def(t.typ).wasser || Math.hypot(t.x - z[0], t.y - z[1]) > z[2] + 4) continue;
          this.verkaufen(t, t.investiert);
        }
        this.haufen = this.haufen.filter(h => Math.hypot(h.x - z[0], h.y - z[1]) > z[2]);
        this.ereignisse.push({ art:'geschmolzen', x:z[0], y:z[1], r:z[2] });
      }
    }
    // Abenteuer-Finale: Eisflächen brechen weg; was dort steht, ist verloren (ein Viertel gibt es zurück)
    einsturzPruefen() {
      for (const z of this.einsturz) {
        if (z[3] === this.runde + 1) this.ereignisse.push({ art:'einsturzWarnung', x:z[0], y:z[1], r:z[2] });
        if (z[3] !== this.runde) continue;
        for (const t of this.tuerme.slice()) {
          if (Math.hypot(t.x - z[0], t.y - z[1]) > z[2] + 4) continue;
          this.ereignisse.push({ art:'zerstoert', x:t.x, y:t.y, typ:t.typ });
          this.verkaufen(t, Math.floor(t.investiert * 0.25));
        }
        this.haufen = this.haufen.filter(h => Math.hypot(h.x - z[0], h.y - z[1]) > z[2]);
        this.ereignisse.push({ art:'eingestuerzt', x:z[0], y:z[1], r:z[2] });
      }
    }
    // Geld, Heldenerfahrung und Kisten am Ende einer Runde
    rundeAbschliessen() {
      this.runde++;
      let bonus = this.einnahme(PT.rundenBonus(this.runde) + ((this.boni && this.boni.bonus) || 0) + this.einkommen);
      // Geld pro Runde und übrige Kisten gehen an den Besitzer des Pinguins
      for (const t of this.tuerme) if (t.eff.geld && t.eff.geld.flat) bonus += this.einnahme(t.eff.geld.flat, t.besitzer);
      for (const k of this.kisten) if (this.tuerme.includes(k.turm)) bonus += this.einnahme(k.wert, k.turm.besitzer);
      this.kisten = [];
      for (const held of this.tuerme) if (PT.HELDEN[held.typ]) this.heldErfahrung(held, PT.heldenXp(this.runde));
      this.schmelzPruefen();
      this.einsturzPruefen();
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
          if (!t || !this.darf(t, sp) || this.vorbei || (this.regeln && this.regeln.keinVerkauf)) return false;
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
        eigeneKarte:this.karte === 'eigen' ? this.kartenDaten : null, regeln:this.regeln, boni:this.boni,
        geldModus:this.geldModus, spieler:this.spieler.map(x => ({ ...x })),
        geld:this.geld, leben:this.leben, startLeben:this.startLeben, runde:this.runde, laeuft:this.laeuft, vorbei:this.vorbei,
        gewonnen:this.gewonnen, endlos:this.endlos, naechsteId:this.naechsteId, zeit:this.zeit, zufall:this.zufall.lesen(),
        sabotage:this.sabotage, wetterAn:this.wetterAn, wetter:this.wetter, wetterT:this.wetterT, finsternisBis:this.finsternisBis,
        dunkelT:this.dunkelT, wellenEnde:this.wellenEnde, denkmaeler:this.denkmaeler, einkommen:this.einkommen, extra:this.extra, vs:this.vs, rundenZeit:this.rundenZeit || 0, zaeh:this.zaeh || 1, sandWelle:!!this.sandWelle, statistik:{ ...this.statistik },
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
        spieler:kopie.spieler.length ? kopie.spieler : null, geldModus:kopie.geldModus, eigeneKarte:kopie.eigeneKarte, regeln:kopie.regeln, boni:kopie.boni, wetter:kopie.wetterAn });
      for (const k of ['geld', 'leben', 'startLeben', 'runde', 'laeuft', 'vorbei', 'gewonnen', 'endlos', 'naechsteId', 'zeit', 'sabotage', 'wetter', 'wetterT', 'finsternisBis',
        'rundenZeit', 'zaeh', 'sandWelle', 'statistik', 'warteschlange', 'fische', 'dunkelT', 'wellenEnde', 'denkmaeler', 'einkommen', 'extra', 'vs']) if (kopie[k] !== undefined) s[k] = kopie[k];
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
        eigeneKarte:this.karte === 'eigen' ? this.kartenDaten : null, regeln:this.regeln, boni:this.boni,
        leben:this.leben, gewonnen:this.gewonnen, endlos:this.endlos, statistik:this.statistik, kraft:this.kraft, wetterAn:this.wetterAn, denkmaeler:this.denkmaeler,
        tuerme:this.tuerme.map(t => ({ typ:t.typ, x:t.x, y:t.y, pfade:t.pfade, ziel:t.ziel, investiert:t.investiert, pops:t.pops, stufe:t.stufe, xp:t.xp, zielPunkt:t.zielPunkt, muster:t.muster, fcd:t.fcd, kraft:!!t.kraft, verdient:t.verdient || 0 })),
        haufen:this.haufen.filter(h => h.bleibt && h.turm).map(h => ({ x:h.x, y:h.y, durchschlag:h.durchschlag, leben:h.leben, turm:this.tuerme.indexOf(h.turm) }))
      };
    }
    static laden(d) {
      const s = new Spiel({ karte:d.karte, stufe:d.stufe, runden:d.zielRunden, modus:d.modus || 'standard', held:d.held || null, kraft:!!d.kraft,
        eigeneKarte:d.eigeneKarte, regeln:d.regeln, boni:d.boni, wetter:!!d.wetterAn });
      Object.assign(s, { runde:d.runde, geld:d.geld, leben:d.leben, gewonnen:!!d.gewonnen, endlos:!!d.endlos, statistik:{ ...s.statistik, ...(d.statistik || {}) },
        denkmaeler:Array.isArray(d.denkmaeler) ? d.denkmaeler : [] });
      for (const t of d.tuerme || []) {
        if (!PT.def(t.typ)) continue;
        s.tuerme.push({
          id:s.naechsteId++, typ:t.typ, x:t.x, y:t.y, pfade:t.pfade.slice(0, 3), ziel:t.ziel || 'erster', investiert:t.investiert, pops:t.pops || 0,
          winkel:-Math.PI / 2, dreh:0, cd:[], fcd:t.fcd || {}, stufe:t.stufe || 1, xp:t.xp || 0, temp:null, zielPunkt:t.zielPunkt, muster:t.muster || 'acht', phase:0, fx:t.x, fy:t.y, fw:0,
          besitzer:null, kraft:!!t.kraft, betaeubt:0, betaeubtArt:null, verdient:t.verdient || 0
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
  PT.ZIELE = [['erster', 'Erster'], ['letzter', 'Letzter'], ['stark', 'Stärkster'], ['nah', 'Nächster'], ['riese', 'Riesen zuerst'], ['camo', 'Getarnte zuerst']];
  PT.MUSTER = [['acht', 'Acht'], ['oval', 'Oval'], ['kreis', 'Kreis']];

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
