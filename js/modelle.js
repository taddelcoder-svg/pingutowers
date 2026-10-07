'use strict';
// Pingu Towers – 3D-Modelle aus Grundformen: Fische (als verschmolzene Geometrie für Instanzen),
// Pinguine und Helden (als Gruppen, die mit den Upgrades wachsen) und Geschosse.
(function () {
  const PT = window.PT;
  const T = window.THREE;

  /* ---------- Hilfen ---------- */
  const matCache = new Map();
  function mat(farbe, art = 'lambert', extra = {}) {
    const k = farbe + art + JSON.stringify(extra);
    if (!matCache.has(k)) {
      const M = art === 'phong' ? T.MeshPhongMaterial : art === 'basic' ? T.MeshBasicMaterial : T.MeshLambertMaterial;
      matCache.set(k, new M(Object.assign({ color:farbe }, extra)));
    }
    return matCache.get(k);
  }
  function mesh(geo, material, x = 0, y = 0, z = 0) {
    const m = new T.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }
  function matrix(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    return new T.Matrix4().compose(new T.Vector3(px, py, pz), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
  }
  // Mehrere Formen mit Farben pro Ecke zu einer Geometrie verschmelzen
  function verschmelzen(teile) {
    const pos = [], nor = [], col = [];
    const c = new T.Color();
    for (const [geo, farbe, m] of teile) {
      const g = (geo.index ? geo.toNonIndexed() : geo.clone());
      g.applyMatrix4(m);
      const p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        pos.push(x, y, z);
        nor.push(n.getX(i), n.getY(i), n.getZ(i));
        const f = typeof farbe === 'function' ? farbe(x, y, z) : farbe;
        if (Array.isArray(f)) col.push(f[0], f[1], f[2]);
        else { c.set(f); col.push(c.r, c.g, c.b); }
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return g;
  }
  const hell = (hex, t) => { const c = new T.Color(hex).lerp(new T.Color(0xffffff), t); return [c.r, c.g, c.b]; };
  const dunkel = (hex, t) => { const c = new T.Color(hex).lerp(new T.Color(0x000000), t); return [c.r, c.g, c.b]; };
  const rgb = hex => { const c = new T.Color(hex); return [c.r, c.g, c.b]; };
  const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

  const G = {
    kugel:new T.SphereGeometry(1, 16, 12),
    kugelGrob:new T.SphereGeometry(1, 10, 8),
    halbkugel:new T.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    kegel:new T.ConeGeometry(1, 1, 8),
    kegel4:new T.ConeGeometry(1, 1, 4),
    zyl:new T.CylinderGeometry(1, 1, 1, 12),
    box:new T.BoxGeometry(1, 1, 1),
    ikosa:new T.IcosahedronGeometry(1, 1),
    okta:new T.OctahedronGeometry(1, 0),
    torus:new T.TorusGeometry(1, 0.16, 8, 24),
    ring:new T.TorusGeometry(1, 0.06, 6, 40)
  };

  /* ---------- Fische ---------- */
  function krakeGeo(r, farbe, krone) {
    const teile = [];
    const koerper = (x, y) => y < 0 ? hell(farbe, 0.35) : (hash(Math.round(x / 4), Math.round(y / 4)) > 0.82 ? dunkel(farbe, 0.35) : rgb(farbe));
    teile.push([G.kugel, koerper, matrix(-0.15 * r, 0.25 * r, 0, 0, 0, 0, 0.95 * r, 0.85 * r, 0.9 * r)]);
    // acht Fangarme nach hinten und zur Seite
    for (let i = 0; i < 8; i++) {
      const w = Math.PI * (0.55 + i / 7 * 0.9);
      const lang = 1.4 * r;
      const dx = Math.cos(w), dz = Math.sin(w);
      teile.push([G.kegel, (x, y) => (y > -0.05 * r ? rgb(farbe) : hell(farbe, 0.5)),
        new T.Matrix4().compose(new T.Vector3(dx * lang * 0.55 - 0.1 * r, -0.15 * r, dz * lang * 0.55),
          new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx, -0.08, dz).normalize()),
          new T.Vector3(0.17 * r, lang, 0.17 * r))]);
    }
    for (const s of [-1, 1]) {
      teile.push([G.kugelGrob, 0xfff4b8, matrix(0.55 * r, 0.45 * r, s * 0.38 * r, 0, 0, 0, 0.24 * r, 0.24 * r, 0.24 * r)]);
      teile.push([G.kugelGrob, 0x111111, matrix(0.72 * r, 0.47 * r, s * 0.42 * r, 0, 0, 0, 0.12 * r, 0.16 * r, 0.12 * r)]);
    }
    if (krone) {
      teile.push([G.zyl, 0xffd54a, matrix(-0.15 * r, 1.08 * r, 0, 0, 0, 0, 0.42 * r, 0.12 * r, 0.42 * r)]);
      for (let i = 0; i < 6; i++) { const w = i / 6 * Math.PI * 2; teile.push([G.kegel4, 0xffd54a, matrix(-0.15 * r + Math.cos(w) * 0.36 * r, 1.25 * r, Math.sin(w) * 0.36 * r, 0, 0, 0, 0.09 * r, 0.3 * r, 0.09 * r)]); }
      teile.push([G.okta, 0xe2463b, matrix(0.2 * r, 1.12 * r, 0, 0, 0, 0, 0.1 * r, 0.14 * r, 0.1 * r)]);
      teile.push([G.box, 0x5a1010, matrix(0.4 * r, 0.75 * r, -0.3 * r, 0, 0.4, 0.5, 0.05 * r, 0.4 * r, 0.04 * r)]);
    }
    return verschmelzen(teile);
  }
  function rochenGeo(r) {
    const teile = [];
    const farbe = (x, y, z) => y < -0.02 * r ? rgb(0xe9edf2) : (hash(Math.round(x / 3), Math.round(z / 3)) > 0.9 ? rgb(0x8e6bff) : rgb(0x2a2f3d));
    teile.push([G.kugel, farbe, matrix(0, 0, 0, 0, 0, 0, 0.95 * r, 0.2 * r, 1.7 * r)]);
    teile.push([G.kugel, farbe, matrix(0.15 * r, 0.05 * r, 0, 0, 0, 0, 0.75 * r, 0.25 * r, 0.6 * r)]);
    teile.push([G.zyl, 0x1d2029, matrix(-1.6 * r, 0, 0, 0, 0, Math.PI / 2, 0.04 * r, 1.6 * r, 0.04 * r)]);
    for (const s of [-1, 1]) {
      teile.push([G.kegel, 0x2a2f3d, matrix(0.95 * r, 0, s * 0.35 * r, 0, 0, -Math.PI / 2, 0.1 * r, 0.45 * r, 0.06 * r)]);
      teile.push([G.kugelGrob, 0xfff27a, matrix(0.62 * r, 0.12 * r, s * 0.38 * r, 0, 0, 0, 0.09 * r, 0.09 * r, 0.09 * r)]);
    }
    return verschmelzen(teile);
  }
  function fischGeo(typ) {
    const f = PT.FISCHE[typ], r = f.r, c = f.farbe;
    if (typ === 'krake') return krakeGeo(r, c, false);
    if (typ === 'krakus') return krakeGeo(r, c, true);
    if (typ === 'rochen') return rochenGeo(r);
    const bauch = hell(c, 0.55), ruecken = dunkel(c, 0.15);
    const teile = [];
    let koerper = (x, y) => y < -0.25 * r ? bauch : y > 0.4 * r ? ruecken : rgb(c);
    let flosse = dunkel(c, 0.25);
    let kScale = [1.2 * r, 0.72 * r, 0.62 * r];
    let schwanz = [0.6 * r, 0.85 * r];
    if (typ === 'zebra') koerper = x => (Math.floor((x / r + 3) * 2.4) % 2 ? rgb(0x1b1b1f) : rgb(0xf7f7f7));
    if (typ === 'regen') koerper = (x, y) => { const k = new T.Color().setHSL(((x / r + 1.3) / 2.6) * 0.8, 0.85, y < -0.3 * r ? 0.75 : 0.58); return [k.r, k.g, k.b]; };
    if (typ === 'rosa') koerper = (x, y, z) => (y > 0.2 * r && hash(Math.round(x), Math.round(z)) > 0.8 ? rgb(0x7a2f48) : y < -0.25 * r ? bauch : rgb(c));
    if (typ === 'panzer') { koerper = (x, y) => y < -0.3 * r ? rgb(0xb9c0c8) : rgb(0x7d858f); flosse = rgb(0x5a616b); }
    if (typ === 'schwarz') { koerper = (x, y) => y < -0.3 * r ? rgb(0x3a3f4b) : rgb(0x1f2229); flosse = rgb(0x121419); kScale = [1.15 * r, 0.85 * r, 0.75 * r]; }
    if (typ === 'weiss') { koerper = (x, y) => y < 0 ? rgb(0xffffff) : rgb(0xd6ecf7); flosse = rgb(0xb8dcef); }
    if (typ === 'gelb') { schwanz = [0.8 * r, 1.1 * r]; flosse = rgb(0xff8c1a); }
    if (typ === 'wal' || typ === 'mega') {
      kScale = [1.4 * r, 0.52 * r, 0.6 * r];
      schwanz = [0.75 * r, 0.9 * r];
      if (typ === 'wal') koerper = (x, y, z) => y < -0.15 * r ? rgb(0xe9eef2) : (hash(Math.round(x / 3), Math.round(z / 3) + Math.round(y / 3) * 7) > 0.86 ? rgb(0xeef5ff) : rgb(0x34557c));
      else koerper = (x, y) => y < -0.15 * r ? rgb(0xe3e6ea) : rgb(0x5d6772);
      flosse = typ === 'wal' ? rgb(0x2b4868) : rgb(0x4a525c);
    }
    if (typ === 'koffer') {
      koerper = (x, y, z) => (Math.sin(x * 0.9) * Math.sin(z * 0.9) > 0.6 ? rgb(0x6b3f19) : y < -0.3 * r ? rgb(0xe2b27a) : rgb(0xb8773a));
      teile.push([G.box, koerper, matrix(0, 0, 0, 0, 0, 0, 2.1 * r, 1.25 * r, 1.25 * r)]);
      flosse = rgb(0x8d5423);
    } else {
      teile.push([G.kugel, koerper, matrix(0, 0, 0, 0, 0, 0, ...kScale)]);
    }
    // Schwanzflosse (senkrecht), Rückenflosse, Seitenflossen
    teile.push([G.kegel, flosse, matrix(-kScale[0] - schwanz[1] * 0.3, 0, 0, 0, 0, -Math.PI / 2, schwanz[0], schwanz[1], schwanz[0] * 0.3)]);
    const rueckenH = typ === 'wal' || typ === 'mega' ? 0.9 * r : 0.55 * r;
    teile.push([G.kegel, flosse, matrix(-0.1 * r, kScale[1] + rueckenH * 0.35, 0, 0, 0, 0.35, 0.38 * r, rueckenH, 0.08 * r)]);
    for (const s of [-1, 1]) {
      teile.push([G.kugel, flosse, matrix(0.25 * r, -0.2 * r, s * kScale[2] * 0.95, 0, s * 0.5, 0, 0.4 * r, 0.07 * r, 0.3 * r)]);
      const ax = kScale[0] * 0.66, ay = typ === 'wal' || typ === 'mega' ? 0.05 * r : 0.2 * r, az = s * kScale[2] * 0.62;
      const aug = typ === 'schwarz' ? 0.26 * r : typ === 'wal' || typ === 'mega' ? 0.1 * r : 0.2 * r;
      teile.push([G.kugelGrob, 0xffffff, matrix(ax, ay, az, 0, 0, 0, aug, aug, aug)]);
      teile.push([G.kugelGrob, 0x111111, matrix(ax + aug * 0.45, ay + aug * 0.1, az + s * aug * 0.45, 0, 0, 0, aug * 0.55, aug * 0.55, aug * 0.55)]);
    }
    if (typ === 'schwarz') {
      teile.push([G.zyl, 0x2b2f38, matrix(0.75 * r, 1.1 * r, 0, 0, 0, -0.7, 0.06 * r, 0.9 * r, 0.06 * r)]);
      teile.push([G.kugelGrob, 0xfff27a, matrix(1.15 * r, 1.45 * r, 0, 0, 0, 0, 0.22 * r, 0.22 * r, 0.22 * r)]);
      for (const z of [-0.3, 0, 0.3]) teile.push([G.kegel4, 0xffffff, matrix(1.05 * r, -0.2 * r, z * r, Math.PI, 0, 0, 0.08 * r, 0.25 * r, 0.08 * r)]);
    }
    if (typ === 'panzer') {
      for (const x of [-0.6, -0.1, 0.4]) teile.push([G.box, 0x5f666f, matrix(x * r, 0.62 * r, 0, 0, 0, 0.2, 0.4 * r, 0.22 * r, 0.7 * r)]);
      for (const s of [-1, 1]) teile.push([G.zyl, 0x3d434a, matrix(1.35 * r, -0.15 * r, s * 0.35 * r, s * 0.9, 0, 1.2, 0.04 * r, 0.7 * r, 0.04 * r)]);
    }
    if (typ === 'mega' || typ === 'wal') {
      teile.push([G.box, typ === 'mega' ? 0x6b1320 : 0x1d2d44, matrix(1.28 * r, -0.12 * r, 0, 0, 0, 0, 0.22 * r, 0.1 * r, 0.62 * r)]);
      if (typ === 'mega') for (let i = -3; i <= 3; i++) teile.push([G.kegel4, 0xffffff, matrix(1.33 * r, -0.05 * r, i * 0.08 * r, Math.PI, 0, 0, 0.035 * r, 0.1 * r, 0.035 * r)]);
    }
    return verschmelzen(teile);
  }

  /* ---------- Pinguine ---------- */
  const SCHWARZ = 0x1d2230, WEISS = 0xf7f9fc, ORANGE = 0xff9a1a;
  const PFAD_FARBEN = [0xe2463b, 0x2f7fe0, 0x35b04a];

  function pinguinKoerper(g, teile, s = 1, rumpfFarbe = SCHWARZ) {
    const k = mesh(G.kugel, mat(rumpfFarbe, 'phong', { shininess:30 }), 0, 16 * s, 0);
    k.scale.set(10 * s, 14 * s, 10 * s);
    const b = mesh(G.kugel, mat(WEISS), 3.8 * s, 14.5 * s, 0);
    b.scale.set(7 * s, 11 * s, 7.6 * s);
    const kopf = mesh(G.kugel, mat(SCHWARZ, 'phong', { shininess:30 }), 1 * s, 30 * s, 0);
    kopf.scale.setScalar(8 * s);
    g.add(k, b, kopf);
    for (const z of [-1, 1]) {
      const w = mesh(G.kugel, mat(WEISS), 5.6 * s, 31.5 * s, z * 3.2 * s); w.scale.set(2.2 * s, 2.6 * s, 2.2 * s);
      const p = mesh(G.kugelGrob, mat(0x111111), 7.4 * s, 32 * s, z * 3.4 * s); p.scale.setScalar(1.1 * s);
      const fuss = mesh(G.kugel, mat(ORANGE), 5 * s, 2.5 * s, z * 4.5 * s); fuss.scale.set(4.5 * s, 1.5 * s, 2.6 * s);
      g.add(w, p, fuss);
      const fl = mesh(G.kugel, mat(rumpfFarbe), 0, 18 * s, z * 10.2 * s);
      fl.scale.set(4 * s, 9 * s, 1.6 * s);
      fl.rotation.x = z * 0.35;
      g.add(fl);
      if (teile) teile[z < 0 ? 'fluegelL' : 'fluegelR'] = fl;
    }
    const schnabel = mesh(G.kegel, mat(ORANGE), 10 * s, 29.5 * s, 0);
    schnabel.scale.set(2.4 * s, 7 * s, 2.4 * s);
    schnabel.rotation.z = -Math.PI / 2;
    g.add(schnabel);
    if (teile) teile.koerper = k;
  }
  function sockel(g, r = 17, farbe = 0xffffff) {
    const s = mesh(G.zyl, mat(farbe), 0, 1.5, 0);
    s.scale.set(r + 2, 3, r + 2);
    s.receiveShadow = true;
    g.add(s);
  }
  function hut(g, farbe, x, y, h, r) {
    const k = mesh(G.kegel, mat(farbe), x, y + h / 2, 0); k.scale.set(r, h, r); g.add(k); return k;
  }
  function wurfstern(farbe, gross = 1) {
    const g = new T.Group();
    for (const w of [0, Math.PI / 4]) { const b = mesh(G.box, mat(farbe, 'phong', { shininess:120 }), 0, 0, 0); b.scale.set(7 * gross, 0.8, 2 * gross); b.rotation.y = w; g.add(b); const c = b.clone(); c.rotation.y = w + Math.PI / 2; g.add(c); }
    return g;
  }
  // Albatros mit Pinguin-Pilot (fliegt separat über die Karte)
  function albatros(p) {
    const g = new T.Group();
    const gold = p[0] >= 5;
    const k = mesh(G.kugel, mat(0xf4f6f8), 0, 0, 0); k.scale.set(16, 7, 7); g.add(k);
    const kopf = mesh(G.kugel, mat(0xf4f6f8), 15, 3, 0); kopf.scale.setScalar(5.5); g.add(kopf);
    const schnabel = mesh(G.kegel, mat(0xffc93c), 23, 2, 0); schnabel.scale.set(2, 9, 2); schnabel.rotation.z = -Math.PI / 2; g.add(schnabel);
    const fluegel = [];
    for (const s of [-1, 1]) {
      const f = new T.Group();
      const innen = mesh(G.box, mat(gold ? 0xffd54a : 0xeef1f4), 0, 0, s * 16); innen.scale.set(12, 1.5, 32); f.add(innen);
      const spitze = mesh(G.box, mat(gold ? 0xff9a1a : p[2] >= 5 ? 0x7dffb2 : 0x2b2f38), -2, 0, s * 38); spitze.scale.set(9, 1.4, 14); f.add(spitze);
      f.position.set(2, 2, 0);
      g.add(f); fluegel.push(f);
    }
    const schwanz = mesh(G.box, mat(0xeef1f4), -17, 1, 0); schwanz.scale.set(8, 1.4, 10); g.add(schwanz);
    const pilot = new T.Group(); pilot.position.set(-2, 4, 0); pilot.scale.setScalar(0.45); pinguinKoerper(pilot, null);
    const brille = mesh(G.box, mat(0x3a2a1a), 6, 32, 0); brille.scale.set(2, 3, 12); pilot.add(brille);
    g.add(pilot);
    if (p[1] >= 1) for (const s of [-1, 1]) { const b = mesh(G.kugel, mat(0xffffff), 0, -5, s * 14); b.scale.setScalar(p[1] >= 2 ? 4 : 3); g.add(b); }
    if (p[2] >= 3) { const mg = mesh(G.zyl, mat(0x5a6573), 10, 8, 0); mg.scale.set(1.2, 14, 1.2); mg.rotation.z = -Math.PI / 2; g.add(mg); }
    g.fluegel = fluegel;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // Aussehen je Pinguin, wächst mit den Upgrades mit
  const MODELLE = {
    zapfen(g, p, t) {
      pinguinKoerper(g, t);
      const band = mesh(G.torus, mat(p[1] >= 3 ? 0xffc93c : 0xe2463b), 1, 33, 0); band.scale.setScalar(8.2); band.rotation.x = Math.PI / 2; g.add(band);
      const zapfen = (z, farbe) => { const k = mesh(G.kegel, mat(farbe, 'phong', { shininess:90 }), 6, 20, z); k.scale.set(2, 12, 2); k.rotation.z = -Math.PI / 2 - 0.3; g.add(k); };
      zapfen(11, p[1] >= 5 ? 0xff5ec8 : p[2] >= 4 ? 0x5ec8ff : p[1] >= 4 ? 0xffd54a : 0xcdefff);
      if (p[1] >= 3) zapfen(-11, p[1] >= 5 ? 0xff5ec8 : p[1] >= 4 ? 0xffd54a : 0xcdefff);
      if (p[0] >= 3) { const kg = mesh(G.ikosa, mat(0xdff4ff, 'phong', { flatShading:true, shininess:80 }), -11, 16, 0); kg.scale.setScalar(p[0] >= 5 ? 15 : p[0] >= 4 ? 11 : 8); g.add(kg); }
      if (p[2] >= 2) for (const z of [-3.4, 3.4]) { const b = mesh(G.zyl, mat(p[2] >= 4 ? 0x2f7fe0 : 0x3cb371), 7.5, 32.5, z); b.scale.set(2, 1.5, 2); b.rotation.z = Math.PI / 2; g.add(b); }
      if (p[2] >= 5) { const a = mesh(G.box, mat(0x8b5a2b), 8, 21, 11); a.scale.set(4, 2, 18); g.add(a); }
    },
    rundum(g, p, t) {
      pinguinKoerper(g, t);
      const farbe = p[0] >= 4 ? 0xffc93c : p[2] >= 4 ? 0xc0c8d4 : 0x8e5bd6;
      const helm = mesh(G.kugel, mat(farbe, 'phong', { shininess:60 }), 1, 32, 0); helm.scale.set(8.6, 5.5, 8.6); g.add(helm);
      const n = p[0] >= 5 || p[2] >= 5 ? 16 : p[0] >= 3 || p[2] >= 3 ? 12 : 8;
      for (let i = 0; i < n; i++) {
        const w = i / n * Math.PI * 2;
        const k = mesh(G.kegel, mat(0xcfe8ff, 'phong', { shininess:90 }), 1 + Math.cos(w) * 8, 34, Math.sin(w) * 8);
        k.scale.set(1.3, 6, 1.3); k.rotation.set(Math.sin(w) * 1.1, 0, -Math.cos(w) * 1.1); g.add(k);
      }
      if (p[1] >= 3) {
        const r = mesh(G.torus, mat(p[1] >= 5 ? 0xffb020 : p[1] >= 4 ? 0xb36bff : 0x7fd6e0, 'basic', { transparent:true, opacity:0.7 }), 0, 5, 0);
        r.scale.setScalar(20); r.rotation.x = Math.PI / 2; g.add(r); t.dreher = r;
      }
      if (p[1] >= 5) { const sonne = mesh(G.kugel, mat(0xffc93c, 'basic'), 0, 54, 0); sonne.scale.setScalar(7); g.add(sonne); t.orb = sonne; t.orbGroesse = 7; }
    },
    schneeball(g, p, t) {
      pinguinKoerper(g, t);
      const eimer = mesh(G.zyl, mat(p[1] >= 3 ? 0x444a55 : 0xe2463b), 1, 38, 0); eimer.scale.set(6.5, 7, 6.5); g.add(eimer);
      const gross = p[0] >= 5 ? 1.7 : p[0] >= 3 ? 1.35 : 1;
      const rohr = mesh(G.zyl, mat(p[2] >= 4 ? 0x5ec8ff : p[1] >= 5 ? 0xb3261e : 0x6d7f95, 'phong', { shininess:70 }), 12, 14, -12);
      rohr.scale.set(5 * gross, 20 * gross, 5 * gross); rohr.rotation.z = -Math.PI / 2; g.add(rohr);
      const ball = mesh(G.kugel, mat(0xffffff), 12 + 11 * gross, 14, -12); ball.scale.setScalar(4.5 * gross); g.add(ball);
      if (p[1] >= 3) for (const z of [-6, 6]) { const f = mesh(G.box, mat(0xe2463b), 3, 14, -12 + z); f.scale.set(6, 1, 4); g.add(f); }
      if (p[1] >= 4) { const r = mesh(G.kegel, mat(0xe2463b), -6, 30, 10); r.scale.set(3, 14, 3); g.add(r); }
    },
    frost(g, p, t) {
      pinguinKoerper(g, t);
      const schal = mesh(G.torus, mat(0x2f7fe0), 1, 24, 0); schal.scale.set(9.5, 9.5, 12); schal.rotation.x = Math.PI / 2; g.add(schal);
      const ende = mesh(G.box, mat(0x2f7fe0), -6, 18, 6); ende.scale.set(3, 10, 4); g.add(ende);
      const n = Math.max(1, Math.min(5, 1 + Math.floor((p[0] + p[1] + p[2]) / 2)));
      const kristalle = new T.Group();
      const stark = p[0] >= 4 || p[1] >= 4 || p[2] >= 4;
      for (let i = 0; i < n; i++) {
        const k = mesh(G.okta, mat(stark ? 0x9ff3ff : 0xbfeaff, 'phong', { flatShading:true, shininess:100, emissive:0x1d5a7a }), n > 1 ? Math.cos(i / n * 6.28) * 9 : 0, 0, n > 1 ? Math.sin(i / n * 6.28) * 9 : 0);
        k.scale.set(3.5, 6, 3.5); kristalle.add(k);
      }
      kristalle.position.y = 48; g.add(kristalle); t.dreher = kristalle;
      if (p[2] >= 3) { const k = mesh(G.zyl, mat(0x9ff3ff, 'phong', { shininess:100 }), 10, 20, 10); k.scale.set(2.2, 18, 2.2); k.rotation.z = -Math.PI / 2; g.add(k); }
    },
    harpune(g, p, t) {
      pinguinKoerper(g, t);
      const hutFarbe = p[1] >= 4 ? 0x7a4a1e : 0x1f3a5f;
      const krempe = mesh(G.zyl, mat(hutFarbe), 1, 36, 0); krempe.scale.set(10, 1.2, 10); g.add(krempe);
      const kr = mesh(G.zyl, mat(hutFarbe), 1, 40, 0); kr.scale.set(7, 7, 7); g.add(kr);
      const band = mesh(G.zyl, mat(0xffc93c), 1, 37.6, 0); band.scale.set(7.2, 1.2, 7.2); g.add(band);
      const lang = p[0] >= 5 ? 54 : p[0] >= 3 ? 44 : 34;
      const schaft = mesh(G.zyl, mat(0x8b5a2b), 10, 20, 11); schaft.scale.set(1.1, lang, 1.1); schaft.rotation.z = -Math.PI / 2; g.add(schaft);
      const spitze = mesh(G.kegel, mat(p[0] >= 4 ? 0xffd54a : 0xc8d0da, 'phong', { shininess:100 }), 10 + lang / 2 + 3, 20, 11); spitze.scale.set(2.4, 7, 2.4); spitze.rotation.z = -Math.PI / 2; g.add(spitze);
      if (p[2] >= 3) { const s2 = schaft.clone(); s2.position.z = -11; const sp2 = spitze.clone(); sp2.position.z = -11; g.add(s2, sp2); }
      if (p[1] >= 4) { const boot = mesh(G.box, mat(0xb8773a), -16, 5, 0); boot.scale.set(10, 6, 26); g.add(boot); }
      if (p[1] >= 5) for (let i = 0; i < 3; i++) { const m = mesh(G.zyl, mat(0xffd54a, 'phong', { shininess:100 }), -16, 9 + i * 1.6, -6 + i * 4); m.scale.set(3, 1.2, 3); g.add(m); }
    },
    boot(g, p, t) {
      const gross = p[0] >= 4 ? 1.3 : 1;
      const rumpf = mesh(G.box, mat(p[0] >= 5 ? 0x3d4a5c : 0xb8773a), 0, 5, 0); rumpf.scale.set(34 * gross, 8, 18 * gross); g.add(rumpf);
      const bug = mesh(G.kegel4, mat(p[0] >= 5 ? 0x3d4a5c : 0xb8773a), 17 * gross + 6, 5, 0); bug.scale.set(12.6 * gross, 13, 8); bug.rotation.set(Math.PI / 4, 0, -Math.PI / 2); g.add(bug);
      const deck = mesh(G.box, mat(0xd9b38c), 0, 9.2, 0); deck.scale.set(32 * gross, 0.6, 16 * gross); g.add(deck);
      const pg = new T.Group(); pg.position.set(-4, 9, 0); pg.scale.setScalar(0.7); pinguinKoerper(pg, t); g.add(pg);
      const hutF = p[2] >= 4 ? 0x1b1b1f : 0x1f3a5f;
      const ht = mesh(G.zyl, mat(hutF), -3.3, 34, 0); ht.scale.set(5, 3, 5); g.add(ht);
      if (p[2] >= 4) { const fl = mesh(G.box, mat(0x111111), -16, 34, 0); fl.scale.set(1, 10, 14); g.add(fl); const mast = mesh(G.zyl, mat(0x7a4a1e), -16, 22, -6); mast.scale.set(0.8, 26, 0.8); g.add(mast); }
      const kanone = mesh(G.zyl, mat(0x5a6573, 'phong', { shininess:80 }), 10, 13, 0); kanone.scale.set(2.2, 12, 2.2); kanone.rotation.z = -Math.PI / 2; g.add(kanone);
      if (p[0] >= 2) for (const z of [-6, 6]) { const k = mesh(G.zyl, mat(0x2b2f38), 4, 13, z); k.scale.set(2.6, 10, 2.6); k.rotation.z = -Math.PI / 2; g.add(k); }
      if (p[0] >= 3) { const sch = mesh(G.zyl, mat(0xe2463b), -10, 18, 0); sch.scale.set(3, 14, 3); g.add(sch); }
      if (p[1] >= 2) { const segel = mesh(G.box, mat(0xffffff), 0, 30, 0); segel.scale.set(1, 22, 14); g.add(segel); const m = mesh(G.zyl, mat(0x7a4a1e), 0, 22, 0); m.scale.set(0.8, 30, 0.8); g.add(m); }
      if (p[1] >= 3) for (let i = 0; i < 3; i++) { const k = mesh(G.box, mat(0x9b6a3c), -12 + i * 6, 12, 6); k.scale.setScalar(5); g.add(k); }
      if (p[2] >= 3) { const kran = mesh(G.zyl, mat(0x5a6573), -8, 22, -6); kran.scale.set(0.8, 24, 0.8); kran.rotation.z = 0.5; g.add(kran); const haken = mesh(G.torus, mat(0xc8d0da), -2, 12, -6); haken.scale.setScalar(3); g.add(haken); }
    },
    flieger(g, p, t) {
      // Landeplatz; der Albatros selbst fliegt (siehe Welt)
      const platz = mesh(G.zyl, mat(0xdfe8ef), 0, 2, 0); platz.scale.set(20, 3, 20); g.add(platz);
      const ring = mesh(G.torus, mat(0xf6c343), 0, 3.8, 0); ring.scale.setScalar(14); ring.rotation.x = Math.PI / 2; g.add(ring);
      for (const [x, z, sx, sz] of [[0, -5, 2, 10], [0, 5, 2, 10], [0, 0, 8, 2]]) { const b = mesh(G.box, mat(0x13315c), x, 4, z); b.scale.set(sx, 0.4, sz); g.add(b); }
      const fahne = mesh(G.kegel, mat(0xe2463b), -14, 20, 14); fahne.scale.set(3, 10, 3); fahne.rotation.z = Math.PI / 2; g.add(fahne);
      const stange = mesh(G.zyl, mat(0x777777), -14, 12, 14); stange.scale.set(0.6, 22, 0.6); g.add(stange);
    },
    moerser(g, p, t) {
      const pg = new T.Group(); pg.position.set(-10, 0, 0); pg.scale.setScalar(0.8); pinguinKoerper(pg, t); g.add(pg);
      const helm = mesh(G.halbkugel, mat(0x5b6b3a), -9, 30, 0); helm.scale.set(7.5, 5, 7.5); g.add(helm);
      const fuss = mesh(G.zyl, mat(0x5a6573), 8, 4, 0); fuss.scale.set(10, 6, 10); g.add(fuss);
      const n = p[1] >= 3 ? 3 : 1;
      const farbe = p[2] >= 4 ? 0x5ec8ff : p[0] >= 5 ? 0xe2463b : 0x6d7f95;
      for (let i = 0; i < n; i++) {
        const z = n > 1 ? (i - 1) * 7 : 0;
        const r = mesh(G.zyl, mat(farbe, 'phong', { shininess:60 }), 10, 16, z);
        const d = p[0] >= 3 ? 5 : 4;
        r.scale.set(d, 22, d); r.rotation.z = -0.5; g.add(r);
      }
      for (let i = 0; i < 3; i++) { const k = mesh(G.kugel, mat(0xffffff), -2 + i * 5, 3, 13); k.scale.setScalar(3); g.add(k); }
    },
    polar(g, p, t) {
      pinguinKoerper(g, t);
      const farbe = p[2] >= 5 ? 0x111133 : p[2] >= 4 ? 0x2b1d6b : 0x6b4fd1;
      const krempe = mesh(G.zyl, mat(farbe), 1, 36, 0); krempe.scale.set(11, 1, 11); g.add(krempe);
      const h = hut(g, farbe, 1, 36, p[2] >= 5 ? 26 : 20, 7); h.rotation.z = 0.15;
      const stern = mesh(G.okta, mat(0xffe066, 'basic'), 2, 48, 5); stern.scale.setScalar(2.2); g.add(stern);
      const stab = mesh(G.zyl, mat(0x8b5a2b), 8, 20, 12); stab.scale.set(1, 34, 1); g.add(stab);
      const orbFarbe = p[0] >= 5 ? 0xffffff : p[0] >= 3 ? 0x7dffb2 : 0xb49bff;
      const orb = mesh(G.kugel, mat(orbFarbe, 'basic', { transparent:true, opacity:0.9 }), 8, 39, 12); orb.scale.setScalar(p[0] >= 3 ? 5 : 3.8); g.add(orb);
      t.orb = orb; t.orbGroesse = p[0] >= 3 ? 5 : 3.8;
      if (p[2] >= 3) { const umhang = mesh(G.kugel, mat(farbe), -5, 18, 0); umhang.scale.set(6, 15, 11); g.add(umhang); }
    },
    ninja(g, p, t) {
      pinguinKoerper(g, t, 1, 0x23262e);
      const maske = mesh(G.torus, mat(0x16181d), 1.5, 32, 0); maske.scale.set(8.4, 8.4, 9); maske.rotation.x = Math.PI / 2; g.add(maske);
      const band = mesh(G.torus, mat(p[0] >= 4 ? 0xffd54a : 0xe2463b), 1, 35, 0); band.scale.setScalar(8.1); band.rotation.x = Math.PI / 2; g.add(band);
      for (const z of [-1.5, 1.5]) { const e = mesh(G.box, mat(p[0] >= 4 ? 0xffd54a : 0xe2463b), -10, 33, z); e.scale.set(8, 1.2, 1.2); e.rotation.z = 0.4; g.add(e); }
      const anzahl = p[0] >= 3 ? 2 : 1;
      for (let i = 0; i < anzahl; i++) { const s = wurfstern(p[0] >= 4 ? 0xffd54a : 0xc8d0da); s.position.set(8, 21, i ? -11 : 11); s.rotation.x = Math.PI / 2; g.add(s); }
      if (p[1] >= 3) { const b = mesh(G.kugel, mat(0x8a929c), -6, 10, 9); b.scale.setScalar(3.4); g.add(b); }
      if (p[2] >= 3) for (let i = 0; i < 4; i++) { const b = mesh(G.kugel, mat(i % 2 ? 0xf6c343 : 0x444a55), Math.cos(i - 1.5) * 9, 12, Math.sin(i - 1.5) * 9); b.scale.setScalar(2.2); g.add(b); }
      if (p[1] >= 5 || p[0] >= 5) { const k = mesh(G.kugel, mat(0x6b4fd1, 'basic', { transparent:true, opacity:0.35 }), 0, 18, 0); k.scale.set(15, 20, 15); g.add(k); }
    },
    markt(g, p, t) {
      const theke = mesh(G.box, mat(0x9b6a3c), 6, 7, 0); theke.scale.set(14, 14, 40); g.add(theke);
      const brett = mesh(G.box, mat(0xd8e9f2), 6, 14.5, 0); brett.scale.set(15, 1, 41); g.add(brett);
      for (let i = 0; i < 5; i++) {
        const f = mesh(G.kugel, mat([0xe8453c, 0x2f7fe0, 0xf5b623, 0x35b04a, 0xff7fa8][i]), 7, 16.5, -15 + i * 7.5); f.scale.set(3, 1.6, 2.2); f.rotation.y = 1.3; g.add(f);
      }
      for (const z of [-19, 19]) for (const x of [-12, 12]) { const s = mesh(G.zyl, mat(0x7a4a1e), x, 20, z); s.scale.set(1.2, 40, 1.2); g.add(s); }
      const dach = p[1] >= 5 ? 0xffd54a : p[1] >= 3 ? 0x2f7fe0 : 0xe2463b;
      for (let i = 0; i < 8; i++) {
        const d = mesh(G.box, mat(i % 2 ? 0xffffff : dach), 0, 41, -21 + i * 6 + 3);
        d.scale.set(30, 2, 6); d.rotation.z = 0.25; g.add(d);
      }
      const pg = new T.Group(); pg.position.set(-9, 0, 0); pg.scale.setScalar(0.8); pinguinKoerper(pg, t); g.add(pg);
      const schuerze = mesh(G.box, mat(0xffffff), -4, 14, 0); schuerze.scale.set(1, 12, 9); g.add(schuerze);
      const kisten = Math.min(9, p[0] * 2 + 1);
      for (let i = 0; i < kisten; i++) { const k = mesh(G.box, mat(0xb8773a), -20, 4 + Math.floor(i / 3) * 8, -14 + (i % 3) * 14); k.scale.setScalar(8); g.add(k); }
      if (p[2] >= 3) { const m = mesh(G.zyl, mat(0xffd54a, 'phong', { shininess:100 }), 16, 20, 0); m.scale.set(5, 1.5, 5); m.rotation.z = Math.PI / 2; g.add(m); }
      if (p[2] >= 5) { const tresor = mesh(G.box, mat(0x6d7682, 'phong', { shininess:100 }), -20, 30, 0); tresor.scale.set(10, 12, 10); g.add(tresor); }
    },
    haeuptling(g, p, t) {
      pinguinKoerper(g, t);
      const farben = [0xe2463b, 0xf6c343, 0x35b04a, 0x2f7fe0, 0xb36bff];
      const n = p[0] >= 4 ? 9 : 7;
      for (let i = 0; i < n; i++) {
        const w = (i / (n - 1) - 0.5) * 2.2;
        const fe = mesh(G.kugel, mat(farben[i % 5]), -3, 38, 0);
        fe.scale.set(1.2, 7, 2.2); fe.position.set(-3, 38 + Math.cos(w) * 4, Math.sin(w) * 8); fe.rotation.x = w * 0.9; g.add(fe);
      }
      if (p[0] >= 4) { const k = mesh(G.zyl, mat(0xffd54a, 'phong', { shininess:100 }), 1, 38, 0); k.scale.set(7, 4, 7); g.add(k); }
      const tr = mesh(G.zyl, mat(0x9b5a2b), 14, 9, 0); tr.scale.set(p[0] >= 1 ? 8 : 6.5, 12, p[0] >= 1 ? 8 : 6.5); g.add(tr);
      const fell = mesh(G.zyl, mat(0xf3e2c3), 14, 15.2, 0); fell.scale.set(p[0] >= 1 ? 8.2 : 6.7, 0.6, p[0] >= 1 ? 8.2 : 6.7); g.add(fell);
      if (p[1] >= 2) { const st = mesh(G.zyl, mat(0x777777), -10, 30, 10); st.scale.set(0.8, 26, 0.8); g.add(st); const sch = mesh(G.kegel, mat(p[1] >= 4 ? 0xffd54a : 0xdfe6ee), -10, 44, 10); sch.scale.set(6, 4, 6); sch.rotation.x = Math.PI; g.add(sch); t.dreher = sch; }
      if (p[2] >= 3) for (let i = 0; i < 4; i++) { const m = mesh(G.zyl, mat(0xffd54a, 'phong', { shininess:100 }), -14, 2 + i * 1.6, -10); m.scale.set(4, 1.4, 4); g.add(m); }
      if (p[2] >= 5) { const iglu = mesh(G.halbkugel, mat(0xffd54a, 'phong', { shininess:100 }), -16, 0, 10); iglu.scale.setScalar(9); g.add(iglu); }
    },
    fabrik(g, p, t) {
      const wand = p[2] >= 4 ? 0x6d7682 : 0xbfe6f7;
      const haus = mesh(G.box, mat(wand), -4, 13, 0); haus.scale.set(26, 26, 30); g.add(haus);
      const dach = mesh(G.box, mat(0x2f7fe0), -4, 27, 0); dach.scale.set(28, 2.5, 32); g.add(dach);
      const n = p[1] >= 2 ? 2 : 1;
      for (let i = 0; i < n; i++) { const s = mesh(G.zyl, mat(0x8a929c), -10, 36, -7 + i * 12); s.scale.set(3.2, 18, 3.2); g.add(s); }
      const tor = mesh(G.box, mat(0x13315c), 9.2, 9, 0); tor.scale.set(0.6, 14, 12); g.add(tor);
      const band = mesh(G.box, mat(0x444a55), 15, 3, 0); band.scale.set(12, 2, 8); g.add(band);
      const haufenFarbe = p[0] >= 3 ? 0xff6a5a : 0xcdefff;
      for (let i = 0; i < 5; i++) { const k = mesh(G.kegel, mat(haufenFarbe, 'phong', { shininess:90 }), 16 + Math.cos(i * 1.3) * 3, 7, Math.sin(i * 1.3) * 3); k.scale.set(1.6, 7, 1.6); k.rotation.set(Math.sin(i) * 0.6, 0, Math.cos(i) * 0.6); g.add(k); }
      const pg = new T.Group(); pg.position.set(14, 0, -12); pg.scale.setScalar(0.6); pinguinKoerper(pg, t); g.add(pg);
      const helm = mesh(G.halbkugel, mat(0xf6c343), 14.6, 18.5, -12); helm.scale.set(5.2, 3.5, 5.2); g.add(helm);
      if (p[1] >= 4) { const s = mesh(G.kugel, mat(0xe2463b, 'basic'), -4, 31, 12); s.scale.setScalar(2.5); g.add(s); }
    }
  };

  /* ---------- Helden ---------- */
  const HELDEN_MODELLE = {
    kiel(g, L, t) {
      pinguinKoerper(g, t);
      const mantel = mesh(G.kugel, mat(0xb3261e), -1.5, 16, 0); mantel.scale.set(9.6, 13.2, 10.6); g.add(mantel);
      const knoepfe = [0, 1, 2].map(i => mesh(G.kugelGrob, mat(0xffd54a), 7.5, 10 + i * 5, 0));
      knoepfe.forEach(k => { k.scale.setScalar(1.2); g.add(k); });
      const krempe = mesh(G.zyl, mat(0xffffff), 1, 37, 0); krempe.scale.set(11, 1.2, 11); g.add(krempe);
      const kr = mesh(G.zyl, mat(0xffffff), 1, 40.5, 0); kr.scale.set(8, 6, 8); g.add(kr);
      const schirm = mesh(G.box, mat(0x111111), 9, 37.5, 0); schirm.scale.set(6, 0.8, 10); g.add(schirm);
      const anker = mesh(G.okta, mat(0xffd54a), 8.8, 41, 0); anker.scale.set(0.6, 2.4, 2); g.add(anker);
      const klappe = mesh(G.box, mat(0x111111), 7.6, 32, 3.6); klappe.scale.set(1, 3.4, 3.4); g.add(klappe);
      const schaft = mesh(G.zyl, mat(0x8b5a2b), 10, 20, 11); schaft.scale.set(1.1, 36, 1.1); schaft.rotation.z = -Math.PI / 2; g.add(schaft);
      const spitze = mesh(G.kegel, mat(L >= 10 ? 0xffd54a : 0xc8d0da, 'phong', { shininess:100 }), 31, 20, 11); spitze.scale.set(2.4, 7, 2.4); spitze.rotation.z = -Math.PI / 2; g.add(spitze);
      if (L >= 3) { const netz = mesh(G.torus, mat(0xd9c49a), -9, 14, -6); netz.scale.setScalar(5); netz.rotation.y = 1; g.add(netz); }
    },
    aurora(g, L, t) {
      pinguinKoerper(g, t);
      const umhang = mesh(G.kugel, mat(0x6b4fd1, 'phong', { emissive:0x22104a }), -4, 18, 0); umhang.scale.set(7, 16, 12); g.add(umhang);
      const saum = mesh(G.kugel, mat(0x3cff9a, 'basic', { transparent:true, opacity:0.6 }), -6, 6, 0); saum.scale.set(6, 4, 12); g.add(saum);
      const reif = mesh(G.torus, mat(0xffd54a, 'phong', { shininess:120 }), 1, 37, 0); reif.scale.setScalar(6.5); reif.rotation.x = Math.PI / 2; g.add(reif);
      for (let i = 0; i < 5; i++) { const w = (i - 2) * 0.45; const z = mesh(G.kegel4, mat(0xffd54a), 1 + Math.cos(w) * 6.5, 40, Math.sin(w) * 6.5); z.scale.set(1, i === 2 ? 5 : 3, 1); g.add(z); }
      const juwel = mesh(G.okta, mat(0x7dffb2, 'basic'), 7.2, 39, 0); juwel.scale.setScalar(1.6); g.add(juwel);
      const stab = mesh(G.zyl, mat(0xeeeeee), 8, 22, 12); stab.scale.set(0.8, 26, 0.8); g.add(stab);
      const orb = mesh(G.okta, mat(0xb49bff, 'basic', { transparent:true, opacity:0.9 }), 8, 37, 12); orb.scale.setScalar(4); g.add(orb);
      t.orb = orb; t.orbGroesse = L >= 7 ? 5 : 4;
    },
    frosti(g, L, t) {
      pinguinKoerper(g, t);
      const kittel = mesh(G.kugel, mat(0xffffff), -0.5, 15, 0); kittel.scale.set(10.2, 13.5, 10.4); g.add(kittel);
      const tank = mesh(G.zyl, mat(0x7fd6e0, 'phong', { shininess:100 }), -11, 20, 0); tank.scale.set(5, 16, 5); g.add(tank);
      const deckel = mesh(G.halbkugel, mat(0x6d7f95), -11, 28, 0); deckel.scale.setScalar(5); g.add(deckel);
      for (const z of [-3.4, 3.4]) { const b = mesh(G.zyl, mat(0x3a2a1a), 6, 36, z); b.scale.set(2.6, 2, 2.6); b.rotation.z = Math.PI / 2; g.add(b); const l = mesh(G.kugelGrob, mat(0x9ff3ff, 'basic'), 7.2, 36, z); l.scale.setScalar(1.8); g.add(l); }
      const haar = mesh(G.kugel, mat(0xffffff), -1, 37.5, 0); haar.scale.set(5, 3, 7); g.add(haar);
      const strahler = mesh(G.zyl, mat(0x6d7f95, 'phong', { shininess:80 }), 12, 18, 11); strahler.scale.set(2.4, 14, 2.4); strahler.rotation.z = -Math.PI / 2; g.add(strahler);
      const muendung = mesh(G.kugelGrob, mat(L >= 7 ? 0x7dffb2 : 0x7ff0ff, 'basic'), 19.5, 18, 11); muendung.scale.setScalar(2.4); g.add(muendung);
      const schlauch = mesh(G.torus, mat(0x2b2f38), -2, 16, 7); schlauch.scale.setScalar(9); schlauch.rotation.y = 0.4; g.add(schlauch);
    }
  };

  const MODELL_GROESSE = 1.3;
  // Ein Pinguin (oder Held) mit Sockel, Stufenpunkten und bei Stufe 5 einer goldenen Aura
  function pinguinBauen(typ, pfade, stufe = 1) {
    const g = new T.Group();
    const teile = {};
    const held = !!PT.HELDEN[typ];
    const wasser = PT.def(typ).wasser;
    if (!wasser && typ !== 'flieger') sockel(g, PT.turmRadius(typ), held ? 0xfff2c4 : 0xffffff);
    const innen = new T.Group();
    if (held) HELDEN_MODELLE[typ](innen, stufe, teile);
    else MODELLE[typ](innen, pfade, teile);
    const fuenf = pfade.indexOf(5);
    teile.groesse = MODELL_GROESSE * (fuenf >= 0 ? 1.12 : 1) * (held ? 1.08 : 1);
    innen.scale.setScalar(teile.groesse);
    g.add(innen);
    if (wasser) g.position.y = 0;
    // Stufen-Punkte am Sockel (rot, blau, grün je Pfad)
    let k = 0;
    const r = PT.turmRadius(typ) + 1.5;
    if (!held) for (let i = 0; i < 3; i++) for (let s = 0; s < pfade[i]; s++) {
      const w = Math.PI * 0.75 + k++ * 0.3;
      const pk = mesh(G.kugelGrob, mat(PFAD_FARBEN[i], 'basic'), Math.cos(w) * r, 3.4, Math.sin(w) * r);
      pk.scale.setScalar(s === 4 ? 3 : 2.2);
      g.add(pk);
    }
    // Stufe 5: leuchtender Ring und schwebende Funken in der Pfadfarbe
    if (fuenf >= 0) {
      const aura = new T.Group();
      const ring = mesh(G.ring, mat(0xffd54a, 'basic', { transparent:true, opacity:0.9 }), 0, 4, 0);
      ring.scale.setScalar(r + 5); ring.rotation.x = Math.PI / 2; ring.castShadow = false;
      aura.add(ring);
      for (let i = 0; i < 4; i++) {
        const f = mesh(G.okta, mat(PFAD_FARBEN[fuenf], 'basic'), Math.cos(i * 1.57) * (r + 4), 20, Math.sin(i * 1.57) * (r + 4));
        f.scale.setScalar(2.4); f.castShadow = false; aura.add(f);
      }
      g.add(aura);
      teile.aura = aura;
    }
    if (held) {
      const ring = mesh(G.ring, mat(0xf6c343, 'basic', { transparent:true, opacity:0.8 }), 0, 3.6, 0);
      ring.scale.setScalar(r + 3); ring.rotation.x = Math.PI / 2; ring.castShadow = false; g.add(ring);
    }
    return { g, innen, teile };
  }

  /* ---------- Geschosse ---------- */
  function geschossArten() {
    const eis = (farbe) => mat(farbe, 'phong', { shininess:90 });
    const zapfenGeo = new T.ConeGeometry(2.4, 15, 6).applyMatrix4(matrix(0, 0, 0, 0, 0, -Math.PI / 2));
    const pfeilGeo = new T.ConeGeometry(1.4, 16, 5).applyMatrix4(matrix(0, 0, 0, 0, 0, -Math.PI / 2));
    const splitterGeo = new T.OctahedronGeometry(1, 0).applyMatrix4(matrix(0, 0, 0, 0, 0, 0, 5, 1.6, 1.6));
    const harpGeo = new T.ConeGeometry(2, 12, 6).applyMatrix4(matrix(0, 0, 0, 0, 0, -Math.PI / 2));
    const harpKleinGeo = verschmelzen([[G.zyl, 0x8b5a2b, matrix(-4, 0, 0, 0, 0, Math.PI / 2, 0.5, 10, 0.5)], [G.kegel, 0xc8d0da, matrix(2.5, 0, 0, 0, 0, -Math.PI / 2, 1.6, 5, 1.6)]]);
    const sternGeo = verschmelzen([[G.box, 0xffffff, matrix(0, 0, 0, 0, 0, 0, 9, 0.8, 2.4)], [G.box, 0xffffff, matrix(0, 0, 0, 0, Math.PI / 2, 0, 9, 0.8, 2.4)],
      [G.box, 0xffffff, matrix(0, 0, 0, 0, Math.PI / 4, 0, 7, 0.8, 2)], [G.box, 0xffffff, matrix(0, 0, 0, 0, -Math.PI / 4, 0, 7, 0.8, 2)]]);
    const kug = new T.SphereGeometry(1, 12, 9);
    const iko = new T.IcosahedronGeometry(1, 1);
    const rak = new T.ConeGeometry(3, 16, 8).applyMatrix4(matrix(0, 0, 0, 0, 0, -Math.PI / 2));
    const vc = (farbe, art = 'phong', extra = {}) => mat(farbe, art, Object.assign({ vertexColors:true }, extra));
    return {
      zapfen:{ geo:zapfenGeo, mat:eis(0xcdefff), y:18 },
      zapfenGold:{ geo:zapfenGeo, mat:eis(0xffd54a), y:18 },
      zapfenBlau:{ geo:zapfenGeo, mat:eis(0x5ec8ff), y:18 },
      zapfenPlasma:{ geo:zapfenGeo, mat:mat(0xff5ec8, 'basic'), y:18 },
      eisstrahl:{ geo:zapfenGeo, mat:mat(0x7ff0ff, 'basic'), y:14 },
      eisstrahlGross:{ geo:zapfenGeo, mat:mat(0xb8fbff, 'basic'), y:16, skala:1.8 },
      kugel:{ geo:iko, mat:mat(0xdff4ff, 'phong', { flatShading:true }), y:null, rollen:true, kugelig:true },
      lawine:{ geo:iko, mat:mat(0xf2fbff, 'phong', { flatShading:true }), y:null, rollen:true, kugelig:true },
      gletscher:{ geo:iko, mat:mat(0xa8e4ff, 'phong', { flatShading:true, shininess:100 }), y:null, rollen:true, kugelig:true },
      splitter:{ geo:splitterGeo, mat:eis(0xcfe8ff), y:12 },
      splitterGold:{ geo:splitterGeo, mat:eis(0xffd54a), y:12 },
      splitterBlau:{ geo:splitterGeo, mat:eis(0x6ad0ff), y:12 },
      klinge:{ geo:splitterGeo, mat:mat(0xe8eef6, 'phong', { shininess:120 }), y:12 },
      schneeball:{ geo:kug, mat:mat(0xffffff), y:22, kugelig:true },
      schneeballGross:{ geo:kug, mat:mat(0xffffff), y:22, kugelig:true },
      schneeballBlau:{ geo:kug, mat:mat(0xa8dcff), y:22, kugelig:true },
      schneeballKlein:{ geo:kug, mat:mat(0xffffff), y:10, kugelig:true },
      kanonenkugel:{ geo:kug, mat:mat(0x2b2f38, 'phong', { shininess:80 }), y:16, kugelig:true },
      rauch:{ geo:kug, mat:mat(0x9aa3ad), y:20, kugelig:true },
      blitzbombe:{ geo:kug, mat:mat(0xfff27a, 'basic'), y:20, kugelig:true },
      rakete:{ geo:rak, mat:mat(0xe2463b, 'phong'), y:20 },
      magie:{ geo:kug, mat:mat(0xc3b0ff, 'basic'), y:26, kugelig:true },
      magieGross:{ geo:kug, mat:mat(0x7dffb2, 'basic'), y:26, kugelig:true },
      eule:{ geo:kug, mat:mat(0xe6f6ff, 'basic'), y:40, kugelig:true },
      harpune:{ geo:harpGeo, mat:mat(0xc8d0da), y:18 },
      harpuneKlein:{ geo:harpKleinGeo, mat:vc(0xffffff), y:16 },
      pfeil:{ geo:pfeilGeo, mat:eis(0xdff4ff), y:null, flug:true },
      pfeilGold:{ geo:pfeilGeo, mat:eis(0xffd54a), y:null, flug:true },
      stern:{ geo:sternGeo, mat:mat(0xc8d0da, 'phong', { shininess:120 }), y:16, drehen:true },
      sternGold:{ geo:sternGeo, mat:mat(0xffd54a, 'phong', { shininess:120 }), y:16, drehen:true }
    };
  }
  // Stachelhaufen im Kanal
  function haufenGeo() {
    const teile = [];
    for (let i = 0; i < 7; i++) {
      const w = i / 7 * Math.PI * 2;
      teile.push([G.kegel, 0xdff6ff, new T.Matrix4().compose(new T.Vector3(Math.cos(w) * 0.45, 0.35, Math.sin(w) * 0.45),
        new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(Math.cos(w), 1.1, Math.sin(w)).normalize()), new T.Vector3(0.22, 1.1, 0.22))]);
    }
    teile.push([G.kegel, 0xffffff, matrix(0, 0.6, 0, 0, 0, 0, 0.25, 1.2, 0.25)]);
    teile.push([G.kugelGrob, 0xa8dcff, matrix(0, 0, 0, 0, 0, 0, 0.6, 0.25, 0.6)]);
    return verschmelzen(teile);
  }

  window.PT.M3 = { G, mat, mesh, matrix, verschmelzen, fischGeo, pinguinBauen, pinguinKoerper, albatros, geschossArten, haufenGeo, PFAD_FARBEN, MODELL_GROESSE };
})();
