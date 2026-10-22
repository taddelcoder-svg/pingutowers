'use strict';
// Pinguin Türmchen – Versus „Eiskrieg“: zwei Spieler, jeder verteidigt seine eigene Kopie derselben Karte.
// Beide bekommen dieselben Wellen (ohne Pause, mit kurzer Atempause). Mit Geld schickt man dem Gegner
// zusätzliche Fische und erhöht damit sein Einkommen pro Runde. Sabotage-Karten laden sich langsam auf.
// Ab Runde 30 kommt jede Runde ein Boss zu beiden. Wer zuerst alle Leben verliert, hat verloren.
// Läuft wie der Koop im Gleichschritt auf dem Server und in beiden Browsern (raeume.js).
(function (wurzel) {
  const PT = wurzel.PT || require('./logik.js');

  // Was man schicken kann: ab welcher Runde, wie viele auf einmal, Preis und wie viel Einkommen es bringt
  PT.VS_FISCHE = [
    { typ:'rot', anzahl:12, abstand:0.22, preis:40, einkommen:2, ab:1 },
    { typ:'blau', anzahl:10, abstand:0.25, preis:70, einkommen:4, ab:1 },
    { typ:'gruen', anzahl:10, abstand:0.25, preis:110, einkommen:6, ab:4 },
    { typ:'gelb', anzahl:8, abstand:0.3, preis:170, einkommen:9, ab:7 },
    { typ:'rosa', anzahl:8, abstand:0.3, preis:250, einkommen:12, ab:10 },
    { typ:'schwarz', anzahl:6, abstand:0.4, preis:330, einkommen:15, ab:13 },
    { typ:'weiss', anzahl:6, abstand:0.4, preis:330, einkommen:15, ab:13 },
    { typ:'zebra', anzahl:5, abstand:0.5, preis:480, einkommen:20, ab:17 },
    { typ:'schatten', anzahl:6, abstand:0.45, preis:600, einkommen:24, ab:20 },
    { typ:'regen', anzahl:5, abstand:0.5, preis:700, einkommen:27, ab:22 },
    { typ:'koffer', anzahl:4, abstand:0.6, preis:950, einkommen:33, ab:25 },
    { typ:'verderbt', anzahl:3, abstand:0.8, preis:1300, einkommen:40, ab:28 },
    { typ:'wal', anzahl:1, abstand:1, preis:1700, einkommen:48, ab:30 },
    { typ:'mega', anzahl:1, abstand:1, preis:5000, einkommen:100, ab:40 },
    { typ:'krake', anzahl:1, abstand:1, preis:15000, einkommen:220, ab:52 }
  ];
  PT.VS_KARTEN = {
    nebel:     { name:'Nebel', symbol:'🌫️', text:'Die Pinguine des Gegners sehen 10 Sekunden lang viel weniger weit.', cd:40 },
    frost:     { name:'Frost', symbol:'❄️', text:'Friert die zwei teuersten Pinguine des Gegners 5 Sekunden lang ein.', cd:50 },
    sturm:     { name:'Sturm', symbol:'⚡', text:'Die Fische beim Gegner sind 8 Sekunden lang schneller.', cd:45 },
    finsternis:{ name:'Finsternis', symbol:'🏮', text:'Beim Gegner wird es 3 Sekunden lang stockdunkel: Nur Nachtsicht sieht noch etwas.', cd:60 }
  };
  PT.VS_KARTEN_REIHE = Object.keys(PT.VS_KARTEN);
  PT.VS_VORLAUF = 15;          // Sekunden zum Aufbauen, dann kommt Runde 1
  PT.VS_ERSTE_KARTE = 30;      // so lange laden die Karten am Anfang
  PT.VS_VERLAENGERUNG = 30;    // ab dieser Runde jede Runde ein Boss
  const BOSS_FOLGE = ['krakus', 'haikoenig', 'orka', 'leviathan', 'kapitaen'];
  // Verlängerung: Runde 30 bis 300 je ein Boss, ab Runde 45 in Stufe 2
  function verlaengerung() {
    const b = {};
    for (let n = PT.VS_VERLAENGERUNG; n <= 300; n++) b[n] = [BOSS_FOLGE[(n - PT.VS_VERLAENGERUNG) % BOSS_FOLGE.length], n >= 45 ? 2 : 1];
    return b;
  }

  class Versus {
    // spieler: [{ id, name, held, kraft }] – genau zwei
    constructor({ karte = 'scholle', stufe = 'mittel', seed = 12345, spieler = [], eigeneKarte = null } = {}) {
      this.versus = true;
      this.modus = 'versus';
      this.karte = karte; this.stufe = stufe; this.seed = seed;
      this.spieler = spieler.slice(0, 2).map(x => ({ id:String(x.id), name:String(x.name || 'Pinguin').slice(0, 16) }));
      const regeln = { flut:true, flutPause:5, bosse:verlaengerung() };
      this.spiele = spieler.slice(0, 2).map(x => {
        const s = new PT.Spiel({ karte, stufe, seed, eigeneKarte, regeln, runden:9999, spieler:[{ id:x.id, name:x.name, held:x.held, kraft:x.kraft }] });
        s.endlos = true;
        return s;
      });
      this.karten = this.spiele.map(() => Object.fromEntries(PT.VS_KARTEN_REIHE.map(k => [k, PT.VS_ERSTE_KARTE])));
      this.statistik = this.spiele.map(() => ({ geschickt:0, wert:0, karten:0 }));
      this.zeit = 0;
      this.gestartet = false;
      this.vorbei = false;
      this.sieger = null;     // Spieler-Id, null bei Unentschieden
      this.meldungen = [];    // für die Oberfläche (geschickte Fische, Karten, Ende)
    }
    get laeuft() { return this.gestartet && !this.vorbei; }
    get gewonnen() { return false; }
    get endlos() { return true; }
    get runde() { return Math.max(...this.spiele.map(s => s.runde)); }
    get ereignisse() { return this.spiele[0].ereignisse; }
    ereignisseLeeren() { for (const s of this.spiele) s.ereignisse.length = 0; }
    index(sp) { return this.spieler.findIndex(x => x.id === sp); }
    spielVon(sp) { const i = this.index(sp); return i < 0 ? null : this.spiele[i]; }
    gegnerVon(sp) { const i = this.index(sp); return i < 0 ? null : this.spiele[1 - i]; }
    // Was darf man gerade schicken? (Runde des Gegners zählt nicht – nur die eigene)
    schickbar(sp) { const s = this.spielVon(sp); const n = s ? s.runde + 1 : 1; return PT.VS_FISCHE.filter(f => f.ab <= n); }

    befehl(sp, b) {
      const i = this.index(sp);
      if (i < 0 || !b || typeof b.t !== 'string' || this.vorbei) return null;
      const s = this.spiele[i], g = this.spiele[1 - i];
      switch (b.t) {
        case 'schick': {
          const d = PT.VS_FISCHE.find(f => f.typ === b.typ);
          if (!d || !this.gestartet || d.ab > s.runde + 1 || s.geld < d.preis || s.vorbei) return false;
          s.geld -= d.preis;
          s.einkommen += d.einkommen;
          const p0 = this.statistik[i].geschickt;
          for (let k = 0; k < d.anzahl; k++) g.extra.push([g.zeit + 0.6 + k * d.abstand, d.typ, p0 + k]);
          g.extra.sort((a, c) => c[0] - a[0]);
          this.statistik[i].geschickt += d.anzahl;
          this.statistik[i].wert += d.preis;
          this.meldungen.push({ art:'geschickt', von:sp, typ:d.typ, anzahl:d.anzahl });
          return true;
        }
        case 'karte': {
          const k = PT.VS_KARTEN[b.fk];
          if (!k || !this.gestartet || this.karten[i][b.fk] > 0) return false;
          this.karten[i][b.fk] = k.cd;
          this.statistik[i].karten++;
          if (b.fk === 'nebel') g.vs.nebelBis = g.zeit + 10;
          if (b.fk === 'sturm') g.vs.sturmBis = g.zeit + 8;
          if (b.fk === 'finsternis') { g.finsternisBis = Math.max(g.finsternisBis, g.zeit + 3); g.ereignisse.push({ art:'finsternis', x:PT.BREITE / 2, y:PT.HOEHE / 2, dauer:3 }); }
          if (b.fk === 'frost') {
            const ziele = g.tuerme.filter(t => !t.eff.unbeirrbar).sort((a, c) => c.investiert - a.investiert || a.id - c.id).slice(0, 2);
            for (const t of ziele) { t.betaeubt = Math.max(t.betaeubt || 0, 5); t.betaeubtArt = 'eis'; }
            g.ereignisse.push({ art:'frostbefehl', x:PT.BREITE / 2, y:PT.HOEHE / 2, ziele:ziele.map(t => [t.x, t.y]) });
          }
          this.meldungen.push({ art:'karte', von:sp, k:b.fk });
          return true;
        }
        // Runden starten von selbst, Endlos und Sandkasten gibt es nicht
        case 'start': case 'endlos': case 'sand': case 'leeren': return false;
      }
      return s.befehl(sp, b);
    }

    schritt(dt) {
      if (this.vorbei) return;
      this.zeit += dt;
      if (!this.gestartet && this.zeit >= PT.VS_VORLAUF) {
        this.gestartet = true;
        for (const s of this.spiele) s.rundeStarten();
        this.meldungen.push({ art:'los' });
      }
      if (this.gestartet) for (const k of this.karten) for (const id of PT.VS_KARTEN_REIHE) if (k[id] > 0) k[id] = Math.max(0, k[id] - dt);
      for (const s of this.spiele) s.schritt(dt);
      // Fischflut wartet am Ende einer Runde nicht – falls doch einmal Pause ist (alles weg), geht es weiter
      if (this.gestartet) for (const s of this.spiele) if (!s.laeuft && !s.vorbei) s.rundeStarten();
      const weg = this.spiele.map(s => s.vorbei);
      if (weg[0] || weg[1]) {
        this.vorbei = true;
        this.sieger = weg[0] && weg[1] ? null : this.spieler[weg[0] ? 1 : 0].id;
        this.meldungen.push({ art:'ende', sieger:this.sieger });
      }
    }

    pruefsumme() {
      let h = 0;
      for (const s of this.spiele) h = Math.imul(h ^ s.pruefsumme(), 16777619) >>> 0;
      return (h ^ Math.round(this.zeit * 10)) >>> 0;
    }
    zustand() {
      return { versus:true, v:1, karte:this.karte, stufe:this.stufe, seed:this.seed, spieler:this.spieler, spiele:this.spiele.map(s => s.zustand()),
        karten:this.karten, statistik:this.statistik, zeit:this.zeit, gestartet:this.gestartet, vorbei:this.vorbei, sieger:this.sieger };
    }
    static ausZustand(z) {
      const k = JSON.parse(JSON.stringify(z));
      const v = new Versus({ karte:k.karte, stufe:k.stufe, seed:k.seed, spieler:k.spieler });
      v.spiele = k.spiele.map(x => PT.Spiel.ausZustand(x));
      for (const s of v.spiele) s.endlos = true;
      Object.assign(v, { karten:k.karten, statistik:k.statistik, zeit:k.zeit, gestartet:k.gestartet, vorbei:k.vorbei, sieger:k.sieger });
      return v;
    }
  }
  PT.Versus = Versus;

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
