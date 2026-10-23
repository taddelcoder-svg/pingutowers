'use strict';
// Pinguin Türmchen – Freischaltung durch das Abenteuer: Neue Spieler beginnen mit fünf Pinguinen und Kapitän Kiel.
// Jedes weitere Pinguin- oder Heldenteam kommt nach einem bestimmten Abenteuer-Level dazu (mindestens ein Stern).
// Wer schon vor dieser Regel gespielt hat, behält alles (fort.allesFrei) – außer dem, was schon immer an die
// Story gebunden war (immer). Gilt allein und im Koop; Tages-Herausforderung, Olympiade, Sandkasten und Versus
// lassen alles zu (siehe oberflaeche.js).
(function (wurzel) {
  const PT = wurzel.PT || (wurzel.PT = {});

  // typ → Level-Id, nach dem er frei wird (null: von Anfang an)
  PT.FREI = {
    zapfen:null, rundum:null, schneeball:null, frost:null, harpune:null, kiel:null,
    feuerwerk:'s0-1', polar:'s0-1', ninja:'s0-1',
    boot:'s1-1', aurora:'s1-2', hexe:'s1-3', moerser:'s1-4', disco:'s1-5', markt:'s1-6',
    taucher:'s2-1', sturm:'s2-2', frosti:'s2-3', koch:'s2-4', flieger:'s2-6',
    eisbaer:'s3-2', nova:'s3-3', haeuptling:'s3-4', walter:'s3-5', fabrik:'s3-6',
    mecha:'s4-2', laser:'s4-4',
    kristall:'s10-1', orca:'s11-6', eiskapitaen:'s13-6'
  };
  // Auch für alte Spielstände an die Story gebunden
  const IMMER = { eiskapitaen:true };

  // Ist der Pinguin oder Held frei? kampagne: gespeicherte Sterne, allesFrei: alter Spielstand
  PT.istFrei = function (typ, kampagne, allesFrei) {
    const lv = PT.FREI[typ];
    if (lv == null) return true;
    if (allesFrei && !IMMER[typ]) return true;
    return PT.sternZahl((kampagne || {})[lv]) >= 1;
  };
  // Was ein Level freischaltet (für Leveldialog und Banner)
  PT.freiDurch = id => Object.keys(PT.FREI).filter(t => PT.FREI[t] === id);
  PT.freiName = typ => (PT.HELDEN[typ] ? PT.HELDEN[typ].name : PT.PINGUINE[typ] ? PT.PINGUINE[typ].name : typ);
  // Text für gesperrte Einträge: „Frei nach Abenteuer 1-3 „Mia““
  PT.freiText = function (typ) {
    const l = PT.LEVEL && PT.LEVEL(PT.FREI[typ]);
    if (!l) return '';
    const k = PT.KAPITEL_VON(l.kapitel), a = k.anzeige != null ? k.anzeige : k.nr, teil = l.kapitel >= 10 ? 'Teil 2, ' : '';
    return `Frei nach dem Abenteuer: ${teil}${a ? `${a}-${l.nr}` : 'Prolog'} „${l.name}“`;
  };
  // Helden: alte Schnittstelle aus kampagne2.js
  PT.heldFrei = (id, sterne, allesFrei) => PT.istFrei(id, sterne, allesFrei);

  if (typeof module !== 'undefined' && module.exports) module.exports = PT;
})(typeof window !== 'undefined' ? window : globalThis);
