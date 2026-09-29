'use strict';
// Pingu Towers – 3D-Darstellung mit three.js (r128). Schräge Kamera von oben wie im Vorbild,
// Eiskanal mit fließendem Wasser, Pinguine aus Grundformen, Fische als Instanzen (wenige Draw-Calls).
// Die Logik rechnet auf der Ebene: x → three.x, y → three.z.
(function () {
  const PT = window.PT;
  const T = window.THREE;
  const W = PT.BREITE, H = PT.HOEHE;
  const X = x => x - W / 2, Z = y => y - H / 2;
  const WASSER_Y = 3.5;

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
    kegel:new T.ConeGeometry(1, 1, 8),
    kegel4:new T.ConeGeometry(1, 1, 4),
    zyl:new T.CylinderGeometry(1, 1, 1, 12),
    box:new T.BoxGeometry(1, 1, 1),
    ikosa:new T.IcosahedronGeometry(1, 1),
    okta:new T.OctahedronGeometry(1, 0),
    torus:new T.TorusGeometry(1, 0.16, 8, 24)
  };

  /* ---------- Fische ---------- */
  function fischGeo(typ) {
    const f = PT.FISCHE[typ], r = f.r, c = f.farbe;
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
      // Augen
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
      // Maul
      teile.push([G.box, typ === 'mega' ? 0x6b1320 : 0x1d2d44, matrix(1.28 * r, -0.12 * r, 0, 0, 0, 0, 0.22 * r, 0.1 * r, 0.62 * r)]);
      if (typ === 'mega') for (let i = -3; i <= 3; i++) teile.push([G.kegel4, 0xffffff, matrix(1.33 * r, -0.05 * r, i * 0.08 * r, Math.PI, 0, 0, 0.035 * r, 0.1 * r, 0.035 * r)]);
    }
    return verschmelzen(teile);
  }

  /* ---------- Pinguine ---------- */
  const SCHWARZ = 0x1d2230, WEISS = 0xf7f9fc, ORANGE = 0xff9a1a;
  const PFAD_FARBEN = [0xe2463b, 0x2f7fe0, 0x35b04a];

  function pinguinKoerper(g, teile, s = 1) {
    const k = mesh(G.kugel, mat(SCHWARZ, 'phong', { shininess:30 }), 0, 16 * s, 0);
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
      const fl = mesh(G.kugel, mat(SCHWARZ), 0, 18 * s, z * 10.2 * s);
      fl.scale.set(4 * s, 9 * s, 1.6 * s);
      fl.rotation.x = z * 0.35;
      g.add(fl);
      teile[z < 0 ? 'fluegelL' : 'fluegelR'] = fl;
    }
    const schnabel = mesh(G.kegel, mat(ORANGE), 10 * s, 29.5 * s, 0);
    schnabel.scale.set(2.4 * s, 7 * s, 2.4 * s);
    schnabel.rotation.z = -Math.PI / 2;
    g.add(schnabel);
    teile.koerper = k;
  }
  function sockel(g, r = 17) {
    const s = mesh(G.zyl, mat(0xffffff), 0, 1.5, 0);
    s.scale.set(r + 2, 3, r + 2);
    s.receiveShadow = true;
    g.add(s);
  }
  function hut(g, farbe, x, y, h, r) {
    const k = mesh(G.kegel, mat(farbe), x, y + h / 2, 0); k.scale.set(r, h, r); g.add(k); return k;
  }

  // Aussehen je Pinguin, wächst mit den Upgrades mit
  const MODELLE = {
    zapfen(g, p, t) {
      pinguinKoerper(g, t);
      const band = mesh(G.torus, mat(p[1] >= 3 ? 0xffc93c : 0xe2463b), 1, 33, 0); band.scale.setScalar(8.2); band.rotation.x = Math.PI / 2; g.add(band);
      const zapfen = (z, farbe) => { const k = mesh(G.kegel, mat(farbe, 'phong', { shininess:90 }), 6, 20, z); k.scale.set(2, 12, 2); k.rotation.z = -Math.PI / 2 - 0.3; g.add(k); };
      zapfen(11, p[2] >= 4 ? 0x5ec8ff : p[1] >= 4 ? 0xffd54a : 0xcdefff);
      if (p[1] >= 3) zapfen(-11, p[1] >= 4 ? 0xffd54a : 0xcdefff);
      if (p[0] >= 3) { const kg = mesh(G.ikosa, mat(0xdff4ff, 'phong', { flatShading:true, shininess:80 }), -11, 16, 0); kg.scale.setScalar(p[0] >= 4 ? 11 : 8); g.add(kg); }
      if (p[2] >= 2) for (const z of [-3.4, 3.4]) { const b = mesh(G.zyl, mat(p[2] >= 4 ? 0x2f7fe0 : 0x3cb371), 7.5, 32.5, z); b.scale.set(2, 1.5, 2); b.rotation.z = Math.PI / 2; g.add(b); }
    },
    rundum(g, p, t) {
      pinguinKoerper(g, t);
      const farbe = p[0] >= 4 ? 0xffc93c : p[2] >= 4 ? 0xc0c8d4 : 0x8e5bd6;
      const helm = mesh(G.kugel, mat(farbe, 'phong', { shininess:60 }), 1, 32, 0); helm.scale.set(8.6, 5.5, 8.6); g.add(helm);
      const n = p[0] >= 3 || p[2] >= 3 ? 12 : 8;
      for (let i = 0; i < n; i++) {
        const w = i / n * Math.PI * 2;
        const k = mesh(G.kegel, mat(0xcfe8ff, 'phong', { shininess:90 }), 1 + Math.cos(w) * 8, 34, Math.sin(w) * 8);
        k.scale.set(1.3, 6, 1.3); k.rotation.set(Math.sin(w) * 1.1, 0, -Math.cos(w) * 1.1); g.add(k);
      }
      if (p[1] >= 3) { const r = mesh(G.torus, mat(p[1] >= 4 ? 0xb36bff : 0x7fd6e0, 'basic', { transparent:true, opacity:0.7 }), 0, 5, 0); r.scale.setScalar(20); r.rotation.x = Math.PI / 2; g.add(r); t.dreher = r; }
    },
    schneeball(g, p, t) {
      pinguinKoerper(g, t);
      const eimer = mesh(G.zyl, mat(p[1] >= 3 ? 0x444a55 : 0xe2463b), 1, 38, 0); eimer.scale.set(6.5, 7, 6.5); g.add(eimer);
      const gross = p[0] >= 3 ? 1.35 : 1;
      const rohr = mesh(G.zyl, mat(p[2] >= 4 ? 0x5ec8ff : 0x6d7f95, 'phong', { shininess:70 }), 12, 14, -12);
      rohr.scale.set(5 * gross, 20 * gross, 5 * gross); rohr.rotation.z = -Math.PI / 2; g.add(rohr);
      const ball = mesh(G.kugel, mat(0xffffff), 23 * gross, 14, -12); ball.scale.setScalar(4.5 * gross); g.add(ball);
      if (p[1] >= 3) for (const z of [-6, 6]) { const f = mesh(G.box, mat(0xe2463b), 3, 14, -12 + z); f.scale.set(6, 1, 4); g.add(f); }
    },
    frost(g, p, t) {
      pinguinKoerper(g, t);
      const schal = mesh(G.torus, mat(0x2f7fe0), 1, 24, 0); schal.scale.set(9.5, 9.5, 12); schal.rotation.x = Math.PI / 2; g.add(schal);
      const ende = mesh(G.box, mat(0x2f7fe0), -6, 18, 6); ende.scale.set(3, 10, 4); g.add(ende);
      const n = Math.max(1, Math.min(3, 1 + Math.floor((p[0] + p[1] + p[2]) / 3)));
      const kristalle = new T.Group();
      for (let i = 0; i < n; i++) {
        const k = mesh(G.okta, mat(p[0] >= 4 || p[1] >= 4 || p[2] >= 4 ? 0x9ff3ff : 0xbfeaff, 'phong', { flatShading:true, shininess:100, emissive:0x1d5a7a }), n > 1 ? Math.cos(i / n * 6.28) * 8 : 0, 0, n > 1 ? Math.sin(i / n * 6.28) * 8 : 0);
        k.scale.set(3.5, 6, 3.5); kristalle.add(k);
      }
      kristalle.position.y = 48; g.add(kristalle); t.dreher = kristalle;
    },
    harpune(g, p, t) {
      pinguinKoerper(g, t);
      const hutFarbe = p[1] >= 4 ? 0x7a4a1e : 0x1f3a5f;
      const krempe = mesh(G.zyl, mat(hutFarbe), 1, 36, 0); krempe.scale.set(10, 1.2, 10); g.add(krempe);
      const kr = mesh(G.zyl, mat(hutFarbe), 1, 40, 0); kr.scale.set(7, 7, 7); g.add(kr);
      const band = mesh(G.zyl, mat(0xffc93c), 1, 37.6, 0); band.scale.set(7.2, 1.2, 7.2); g.add(band);
      const lang = p[0] >= 3 ? 44 : 34;
      const schaft = mesh(G.zyl, mat(0x8b5a2b), 10, 20, 11); schaft.scale.set(1.1, lang, 1.1); schaft.rotation.z = -Math.PI / 2; g.add(schaft);
      const spitze = mesh(G.kegel, mat(p[0] >= 4 ? 0xffd54a : 0xc8d0da, 'phong', { shininess:100 }), 10 + lang / 2 + 3, 20, 11); spitze.scale.set(2.4, 7, 2.4); spitze.rotation.z = -Math.PI / 2; g.add(spitze);
      if (p[2] >= 3) { const s2 = schaft.clone(); s2.position.z = -11; const sp2 = spitze.clone(); sp2.position.z = -11; g.add(s2, sp2); }
      if (p[1] >= 4) { const boot = mesh(G.box, mat(0xb8773a), -16, 5, 0); boot.scale.set(10, 6, 26); g.add(boot); }
    },
    polar(g, p, t) {
      pinguinKoerper(g, t);
      const farbe = p[2] >= 4 ? 0x2b1d6b : 0x6b4fd1;
      const krempe = mesh(G.zyl, mat(farbe), 1, 36, 0); krempe.scale.set(11, 1, 11); g.add(krempe);
      const h = hut(g, farbe, 1, 36, 20, 7); h.rotation.z = 0.15;
      const stern = mesh(G.okta, mat(0xffe066, 'basic'), 2, 48, 5); stern.scale.setScalar(2.2); g.add(stern);
      const stab = mesh(G.zyl, mat(0x8b5a2b), 8, 20, 12); stab.scale.set(1, 34, 1); g.add(stab);
      const orbFarbe = p[0] >= 3 ? 0x7dffb2 : 0xb49bff;
      const orb = mesh(G.kugel, mat(orbFarbe, 'basic', { transparent:true, opacity:0.9 }), 8, 39, 12); orb.scale.setScalar(p[0] >= 3 ? 5 : 3.8); g.add(orb);
      t.orb = orb;
      if (p[2] >= 3) { const umhang = mesh(G.kugel, mat(farbe), -5, 18, 0); umhang.scale.set(6, 15, 11); g.add(umhang); }
    },
    markt(g, p, t) {
      const theke = mesh(G.box, mat(0x9b6a3c), 6, 7, 0); theke.scale.set(14, 14, 40); g.add(theke);
      const brett = mesh(G.box, mat(0xd8e9f2), 6, 14.5, 0); brett.scale.set(15, 1, 41); g.add(brett);
      for (let i = 0; i < 5; i++) {
        const f = mesh(G.kugel, mat([0xe8453c, 0x2f7fe0, 0xf5b623, 0x35b04a, 0xff7fa8][i]), 7, 16.5, -15 + i * 7.5); f.scale.set(3, 1.6, 2.2); f.rotation.y = 1.3; g.add(f);
      }
      for (const z of [-19, 19]) for (const x of [-12, 12]) { const s = mesh(G.zyl, mat(0x7a4a1e), x, 20, z); s.scale.set(1.2, 40, 1.2); g.add(s); }
      for (let i = 0; i < 8; i++) {
        const d = mesh(G.box, mat(i % 2 ? 0xffffff : p[1] >= 3 ? 0x2f7fe0 : 0xe2463b), 0, 41, -21 + i * 6 + 3);
        d.scale.set(30, 2, 6); d.rotation.z = 0.25; g.add(d);
      }
      const pg = new T.Group(); pg.position.set(-9, 0, 0); pg.scale.setScalar(0.8); pinguinKoerper(pg, t); g.add(pg);
      const schuerze = mesh(G.box, mat(0xffffff), -4, 14, 0); schuerze.scale.set(1, 12, 9); g.add(schuerze);
      const kisten = Math.min(6, p[0] + 1);
      for (let i = 0; i < kisten; i++) { const k = mesh(G.box, mat(0xb8773a), -20 + (i % 3) * 0, 4 + Math.floor(i / 3) * 8, -14 + (i % 3) * 14); k.scale.setScalar(8); g.add(k); }
      if (p[2] >= 3) { const m = mesh(G.zyl, mat(0xffd54a, 'phong', { shininess:100 }), 16, 20, 0); m.scale.set(5, 1.5, 5); m.rotation.z = Math.PI / 2; g.add(m); }
    },
    haeuptling(g, p, t) {
      pinguinKoerper(g, t);
      const farben = [0xe2463b, 0xf6c343, 0x35b04a, 0x2f7fe0, 0xb36bff];
      const n = p[0] >= 4 ? 9 : 7;
      for (let i = 0; i < n; i++) {
        const w = (i / (n - 1) - 0.5) * 2.2;
        const fe = mesh(G.kugel, mat(farben[i % 5]), -3, 38, 0);
        fe.scale.set(1.2, 7, 2.2); fe.position.set(-3 + Math.sin(w) * -0, 38 + Math.cos(w) * 4, Math.sin(w) * 8); fe.rotation.x = w * 0.9; g.add(fe);
      }
      if (p[0] >= 4) { const k = mesh(G.zyl, mat(0xffd54a, 'phong', { shininess:100 }), 1, 38, 0); k.scale.set(7, 4, 7); g.add(k); }
      const tr = mesh(G.zyl, mat(0x9b5a2b), 14, 9, 0); tr.scale.set(p[0] >= 1 ? 8 : 6.5, 12, p[0] >= 1 ? 8 : 6.5); g.add(tr);
      const fell = mesh(G.zyl, mat(0xf3e2c3), 14, 15.2, 0); fell.scale.set(p[0] >= 1 ? 8.2 : 6.7, 0.6, p[0] >= 1 ? 8.2 : 6.7); g.add(fell);
      if (p[1] >= 2) { const st = mesh(G.zyl, mat(0x777777), -10, 30, 10); st.scale.set(0.8, 26, 0.8); g.add(st); const sch = mesh(G.kegel, mat(0xdfe6ee), -10, 44, 10); sch.scale.set(6, 4, 6); sch.rotation.x = Math.PI; g.add(sch); t.dreher = sch; }
      if (p[2] >= 3) for (let i = 0; i < 4; i++) { const m = mesh(G.zyl, mat(0xffd54a, 'phong', { shininess:100 }), -14, 2 + i * 1.6, -10); m.scale.set(4, 1.4, 4); g.add(m); }
    }
  };

  const MODELL_GROESSE = 1.3;
  function pinguinBauen(typ, pfade) {
    const g = new T.Group();
    const teile = {};
    sockel(g, PT.turmRadius(typ));
    const innen = new T.Group();
    MODELLE[typ](innen, pfade, teile);
    innen.scale.setScalar(MODELL_GROESSE);
    g.add(innen);
    // Stufen-Punkte am Sockel (rot, blau, grün je Pfad)
    let k = 0;
    const r = PT.turmRadius(typ) + 1.5;
    for (let i = 0; i < 3; i++) for (let s = 0; s < pfade[i]; s++) {
      const w = Math.PI * 0.75 + k++ * 0.32;
      const pk = mesh(G.kugelGrob, mat(PFAD_FARBEN[i], 'basic'), Math.cos(w) * r, 3.4, Math.sin(w) * r);
      pk.scale.setScalar(2.2);
      g.add(pk);
    }
    return { g, innen, teile };
  }

  /* ---------- Geschosse ---------- */
  function geschossArten() {
    const eis = (farbe) => mat(farbe, 'phong', { shininess:90 });
    const zapfenGeo = new T.ConeGeometry(2.4, 15, 6).applyMatrix4(matrix(0, 0, 0, 0, 0, -Math.PI / 2));
    const splitterGeo = new T.OctahedronGeometry(1, 0).applyMatrix4(matrix(0, 0, 0, 0, 0, 0, 5, 1.6, 1.6));
    const harpGeo = new T.ConeGeometry(2, 12, 6).applyMatrix4(matrix(0, 0, 0, 0, 0, -Math.PI / 2));
    const kug = new T.SphereGeometry(1, 12, 9);
    const iko = new T.IcosahedronGeometry(1, 1);
    const rak = new T.ConeGeometry(3, 16, 8).applyMatrix4(matrix(0, 0, 0, 0, 0, -Math.PI / 2));
    return {
      zapfen:{ geo:zapfenGeo, mat:eis(0xcdefff), y:18 },
      zapfenGold:{ geo:zapfenGeo, mat:eis(0xffd54a), y:18 },
      zapfenBlau:{ geo:zapfenGeo, mat:eis(0x5ec8ff), y:18 },
      eisstrahl:{ geo:zapfenGeo, mat:mat(0x7ff0ff, 'basic'), y:14 },
      kugel:{ geo:iko, mat:mat(0xdff4ff, 'phong', { flatShading:true }), y:null, rollen:true },
      lawine:{ geo:iko, mat:mat(0xf2fbff, 'phong', { flatShading:true }), y:null, rollen:true },
      splitter:{ geo:splitterGeo, mat:eis(0xcfe8ff), y:12 },
      splitterGold:{ geo:splitterGeo, mat:eis(0xffd54a), y:12 },
      splitterBlau:{ geo:splitterGeo, mat:eis(0x6ad0ff), y:12 },
      klinge:{ geo:splitterGeo, mat:mat(0xe8eef6, 'phong', { shininess:120 }), y:12 },
      schneeball:{ geo:kug, mat:mat(0xffffff), y:22 },
      schneeballGross:{ geo:kug, mat:mat(0xffffff), y:22 },
      schneeballBlau:{ geo:kug, mat:mat(0xa8dcff), y:22 },
      schneeballKlein:{ geo:kug, mat:mat(0xffffff), y:10 },
      rakete:{ geo:rak, mat:mat(0xe2463b, 'phong'), y:20 },
      magie:{ geo:kug, mat:mat(0xc3b0ff, 'basic'), y:26 },
      magieGross:{ geo:kug, mat:mat(0x7dffb2, 'basic'), y:26 },
      eule:{ geo:kug, mat:mat(0xe6f6ff, 'basic'), y:40 },
      harpune:{ geo:harpGeo, mat:mat(0xc8d0da), y:18 }
    };
  }

  /* ---------- Boden-Textur ---------- */
  const THEMEN = {
    tag:        { himmel:0xcfe9f7, boden:['#d9eaf3', '#bcd6e6'], licht:0.8, halb:0.5, nebel:0xcfe9f7, fluss:0x4cc3f0, schnee:0.4, meer:0x1c5d8c },
    daemmerung: { himmel:0xf2c9c0, boden:['#eedde3', '#cdc4e2'], licht:0.8, halb:0.5, nebel:0xe7d2dc, fluss:0x55b6e6, schnee:0.6, meer:0x3b5d8f },
    nacht:      { himmel:0x0b1630, boden:['#b8c9e2', '#8ea3c6'], licht:0.55, halb:0.55, nebel:0x0e1c3a, fluss:0x3a9fd6, schnee:0.8, meer:0x0a1d3a }
  };

  function bodenTextur(karte, weg, thema) {
    const S = 2;
    const c = document.createElement('canvas');
    c.width = W * S; c.height = H * S;
    const x = c.getContext('2d');
    x.scale(S, S);
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, thema.boden[0]); gr.addColorStop(1, thema.boden[1]);
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // Eisplatten und Schneewehen
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      const px = rnd() * W, py = rnd() * H, r = 30 + rnd() * 70;
      x.fillStyle = `rgba(160,205,230,${0.12 + rnd() * 0.12})`;
      x.beginPath();
      for (let k = 0; k < 7; k++) { const w = k / 7 * Math.PI * 2; const rr = r * (0.7 + rnd() * 0.4); x.lineTo(px + Math.cos(w) * rr, py + Math.sin(w) * rr * 0.7); }
      x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 1.2; x.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const px = rnd() * W, py = rnd() * H, r = 20 + rnd() * 50;
      const rg = x.createRadialGradient(px, py, 0, px, py, r);
      rg.addColorStop(0, 'rgba(255,255,255,0.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = rg; x.beginPath(); x.ellipse(px, py, r, r * 0.6, rnd() * 3, 0, Math.PI * 2); x.fill();
    }
    // Risse
    x.strokeStyle = 'rgba(120,170,200,0.35)'; x.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      let px = rnd() * W, py = rnd() * H;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 5; k++) { px += (rnd() - 0.5) * 50; py += (rnd() - 0.5) * 50; x.lineTo(px, py); }
      x.stroke();
    }
    for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(255,255,255,${rnd() * 0.5})`; x.fillRect(rnd() * W, rnd() * H, 1.2, 1.2); }
    // Schatten und Grund unter dem Kanal
    x.lineJoin = x.lineCap = 'round';
    const linie = (breite, farbe) => {
      x.strokeStyle = farbe; x.lineWidth = breite; x.beginPath();
      weg.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke();
    };
    linie(PT.WEG_BREITE + 44, 'rgba(90,140,180,0.18)');
    linie(PT.WEG_BREITE + 2, '#3a8fc0');
    // Schatten unter Hindernissen
    for (const [hx, hy, hr] of karte.hindernisse) {
      const rg = x.createRadialGradient(hx + 6, hy + 6, hr * 0.5, hx + 6, hy + 6, hr * 1.4);
      rg.addColorStop(0, 'rgba(60,90,120,0.3)'); rg.addColorStop(1, 'rgba(60,90,120,0)');
      x.fillStyle = rg; x.beginPath(); x.arc(hx + 6, hy + 6, hr * 1.4, 0, Math.PI * 2); x.fill();
    }
    const tex = new T.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }
  function wasserTextur() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#9fdcf5'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#9fdcf5');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 64);
    x.strokeStyle = 'rgba(40,120,180,0.35)'; x.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = 6 + i * 6.5 + (i % 2) * 2;
      x.beginPath();
      for (let px = 0; px <= 256; px += 8) x.lineTo(px, y + Math.sin(px / 256 * Math.PI * 4 + i) * 2.2);
      x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 18; i++) x.fillRect((i * 53) % 256, (i * 29) % 64, 10, 1.5);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  // Band entlang des Wegs: profil = [[Abstand zur Mitte, Höhe], …]
  function wegBand(weg, profil, uvLaenge) {
    const pos = [], uv = [], idx = [];
    const pts = weg.pts;
    const reihe = [];
    const drin = i => pts[i][0] >= -2 && pts[i][0] <= W + 2 && pts[i][1] >= -2 && pts[i][1] <= H + 2;
    for (let i = 0; i < pts.length; i += 4) if (drin(i)) reihe.push(i);
    const letzter = [...pts.keys()].reverse().find(drin);
    if (reihe[reihe.length - 1] !== letzter) reihe.push(letzter);
    reihe.forEach((i, r) => {
      const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const nx = -dy, ny = dx;
      profil.forEach(([off, h], k) => {
        pos.push(X(pts[i][0] + nx * off), h, Z(pts[i][1] + ny * off));
        uv.push(i * 2 / uvLaenge, k / (profil.length - 1));
      });
      if (r > 0) {
        const n = profil.length;
        for (let k = 0; k < n - 1; k++) {
          const a0 = (r - 1) * n + k, a1 = a0 + 1, b0 = r * n + k, b1 = b0 + 1;
          idx.push(a0, b0, a1, a1, b0, b1);
        }
      }
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ---------- Welt ---------- */
  class Welt {
    constructor(canvas, overlay) {
      this.canvas = canvas;
      this.overlay = overlay;
      this.ox = overlay.getContext('2d');
      this.renderer = new T.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.scene = new T.Scene();
      this.kamera = new T.PerspectiveCamera(36, 1.6, 10, 6000);
      this.zeit = 0;
      this.pinguine = new Map();
      this.effekte = [];
      this.texte = [];
      this.blitz = 0;
      this.fischGeos = {};
      for (const typ of Object.keys(PT.FISCHE)) this.fischGeos[typ] = fischGeo(typ);
      this.geschossArten = geschossArten();
      this.ray = new T.Raycaster();
      this.ebene = new T.Plane(new T.Vector3(0, 1, 0), 0);
    }

    grafik(hoch) {
      this.renderer.shadowMap.enabled = hoch;
      this.renderer.setPixelRatio(hoch ? Math.min(window.devicePixelRatio || 1, 2) : 1);
      this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
      this.groesse();
    }

    karteLaden(spiel) {
      // alles Alte weg
      this.scene = new T.Scene();
      this.pinguine.clear();
      this.effekte = [];
      this.texte = [];
      const karte = spiel.kartenDaten;
      const thema = THEMEN[karte.thema];
      this.thema = thema;
      const sc = this.scene;
      sc.background = new T.Color(thema.himmel);
      sc.fog = new T.Fog(thema.nebel, 1400, 3200);

      sc.add(new T.HemisphereLight(0xeaf6ff, 0x7f9fb8, thema.halb));
      const sonne = new T.DirectionalLight(karte.thema === 'daemmerung' ? 0xffd9c2 : 0xffffff, thema.licht);
      sonne.position.set(-350, 800, 380);
      sonne.castShadow = true;
      sonne.shadow.mapSize.set(2048, 2048);
      Object.assign(sonne.shadow.camera, { left:-620, right:620, top:420, bottom:-420, near:100, far:2200 });
      sonne.shadow.bias = -0.0008;
      sc.add(sonne);
      this.sonne = sonne;

      // Boden: Karte mit Textur, drumherum Schnee
      const boden = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshLambertMaterial({ map:bodenTextur(karte, spiel.weg, thema) }));
      boden.rotation.x = -Math.PI / 2;
      boden.receiveShadow = true;
      sc.add(boden);
      // Drumherum das Polarmeer, die Scholle hat eine Eisklippe
      this.meerTex = wasserTextur();
      this.meerTex.repeat.set(30, 120);
      const aussen = new T.Mesh(new T.PlaneGeometry(8000, 8000), new T.MeshPhongMaterial({ color:thema.meer, map:this.meerTex, shininess:90, specular:0x557799 }));
      aussen.rotation.x = -Math.PI / 2; aussen.position.y = -22; aussen.receiveShadow = true;
      sc.add(aussen);
      const klippe = mat(0xcfe8f5, 'phong', { shininess:40 });
      for (const [x, z, sx, sz] of [[0, -H / 2 - 5, W + 10, 10], [0, H / 2 + 5, W + 10, 10], [-W / 2 - 5, 0, 10, H], [W / 2 + 5, 0, 10, H]]) {
        const m = mesh(G.box, klippe, x, -11, z); m.scale.set(sx, 24, sz); m.receiveShadow = true; sc.add(m);
        const kante = mesh(G.box, mat(0xffffff), x, 0.6, z); kante.scale.set(sx + 1, 1.2, sz + 1); sc.add(kante);
      }
      // ein paar Eisschollen im Meer
      for (let i = 0; i < 14; i++) {
        const w = i / 14 * Math.PI * 2 + 0.3, d = 640 + (i % 3) * 110;
        const e = mesh(new T.CylinderGeometry(1, 1.1, 1, 7), mat(0xeef8fd, 'lambert', { flatShading:true }), Math.cos(w) * d * 1.1, -19, Math.sin(w) * d * 0.8);
        e.scale.set(30 + (i * 17) % 50, 5, 22 + (i * 13) % 40); e.rotation.y = i; sc.add(e);
      }

      // Kanal: Wasser und Eisufer
      const b = PT.WEG_BREITE / 2;
      this.wasserTex = wasserTextur();
      const wasser = new T.Mesh(wegBand(spiel.weg, [[-b - 1, WASSER_Y], [0, WASSER_Y], [b + 1, WASSER_Y]], 120),
        new T.MeshPhongMaterial({ color:thema.fluss, map:this.wasserTex, transparent:true, opacity:0.82, shininess:120, specular:0xbfe6ff, emissive:0x0b3a5a }));
      wasser.receiveShadow = true;
      sc.add(wasser);
      const ufer = new T.MeshLambertMaterial({ color:0xeaf6fd });
      for (const s of [-1, 1]) {
        const prof = [[s * (b + 16), 0], [s * (b + 9), 5.5], [s * (b + 3), 6.5], [s * (b - 1), 2]];
        const m = new T.Mesh(wegBand(spiel.weg, s < 0 ? prof : prof.reverse(), 100), ufer);
        m.receiveShadow = true; m.castShadow = true;
        sc.add(m);
      }
      // Eishöhle am Eingang, Eisbogen am Ausgang
      const ende = (p, w, farbe) => {
        const bogen = mesh(new T.TorusGeometry(b + 10, 7, 8, 16, Math.PI), mat(farbe, 'phong', { shininess:60 }), X(p[0]), 0, Z(p[1]));
        bogen.rotation.y = -w + Math.PI / 2;
        sc.add(bogen);
      };
      const pe = spiel.weg.punkt(40), pa = spiel.weg.punkt(spiel.weg.laenge - 40);
      ende(pe, pe[2], 0xbfe6f7);
      ende(pa, pa[2], 0xa4d3ee);

      // Hindernisse: Eisberge, Felsen, Iglu
      karte.hindernisse.forEach(([hx, hy, hr], i) => {
        const g = new T.Group();
        g.position.set(X(hx), 0, Z(hy));
        if (i === 0 && karte.deko === 'iglu') {
          const kuppel = mesh(new T.SphereGeometry(hr * 0.9, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf6fbff, 'phong', { shininess:20 }));
          const tunnel = mesh(new T.CylinderGeometry(hr * 0.35, hr * 0.35, hr * 0.8, 12, 1, false, 0, Math.PI), mat(0xeaf4fb));
          tunnel.rotation.set(0, 0, Math.PI / 2); tunnel.position.set(hr * 0.8, 0, 0);
          const tuer = mesh(new T.CircleGeometry(hr * 0.26, 12, 0, Math.PI), mat(0x24384d)); tuer.position.set(hr * 1.21, 0.5, 0); tuer.rotation.y = Math.PI / 2;
          g.add(kuppel, tunnel, tuer);
          for (let r = 1; r < 4; r++) { const ring = mesh(G.torus, mat(0xd7e7f2), 0, hr * 0.9 * Math.sin(r * 0.38), 0); ring.scale.set(hr * 0.9 * Math.cos(r * 0.38), hr * 0.9 * Math.cos(r * 0.38), 1.2); ring.rotation.x = Math.PI / 2; g.add(ring); }
        } else if (i % 2 === 0 || karte.deko === 'gletscher') {
          const hoch = karte.deko === 'gletscher' ? 2.2 : 1.1;
          const berg = mesh(new T.DodecahedronGeometry(hr, 1), mat(0xdff3ff, 'phong', { flatShading:true, shininess:70, specular:0x88bbdd }), 0, hr * 0.35 * hoch, 0);
          berg.scale.set(1, 0.9 * hoch, 0.85);
          berg.rotation.y = i;
          g.add(berg);
          if (karte.deko === 'gletscher') { const spitze = mesh(G.kegel4, mat(0xc6e8fb, 'phong', { flatShading:true }), hr * 0.2, hr * 1.9, 0); spitze.scale.set(hr * 0.45, hr * 1.1, hr * 0.45); g.add(spitze); }
        } else {
          for (let k = 0; k < 3; k++) {
            const f = mesh(new T.DodecahedronGeometry(hr * (0.55 - k * 0.1), 0), mat(karte.thema === 'nacht' ? 0x4a5566 : 0x6d7682, 'lambert', { flatShading:true }), (k - 1) * hr * 0.45, hr * 0.25, (k % 2) * hr * 0.3);
            f.rotation.set(k, k * 2, 0); g.add(f);
          }
          const kappe = mesh(G.kugel, mat(0xffffff), 0, hr * 0.5, 0); kappe.scale.set(hr * 0.5, hr * 0.12, hr * 0.4); g.add(kappe);
        }
        if (karte.deko === 'nacht') {
          const kr = mesh(G.okta, mat(i % 2 ? 0x7dffb2 : 0xb49bff, 'basic'), hr * 0.3, hr * 1.1, 0); kr.scale.set(4, 9, 4); g.add(kr);
        }
        g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        sc.add(g);
      });

      // Polarlicht in der Nacht: farbige Lichter, die über das Eis wandern
      this.polarLichter = [];
      if (karte.thema === 'nacht') {
        for (const farbe of [0x3cff9a, 0x9a6bff, 0x3cc8ff]) {
          const l = new T.PointLight(farbe, 1.1, 900, 1.4);
          l.position.set(0, 160, 0);
          sc.add(l);
          this.polarLichter.push(l);
        }
      }

      // Schneefall
      const n = Math.round(500 * thema.schnee);
      const sp = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { sp[i * 3] = (Math.random() - 0.5) * 1300; sp[i * 3 + 1] = Math.random() * 500; sp[i * 3 + 2] = (Math.random() - 0.5) * 900; }
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
      this.schnee = new T.Points(sg, new T.PointsMaterial({ color:0xffffff, size:3, transparent:true, opacity:0.85, depthWrite:false }));
      sc.add(this.schnee);

      // Fische als Instanzen, getarnte Fische halb durchsichtig
      this.fischMeshes = {};
      for (const typ of Object.keys(PT.FISCHE)) {
        const max = PT.FISCHE[typ].riese ? 60 : 900;
        const normal = new T.InstancedMesh(this.fischGeos[typ], new T.MeshPhongMaterial({
          vertexColors:true, shininess:typ === 'panzer' ? 110 : 40, specular:typ === 'panzer' ? 0xffffff : 0x333333,
          transparent:typ === 'weiss', opacity:typ === 'weiss' ? 0.82 : 1
        }), max);
        const camo = new T.InstancedMesh(this.fischGeos[typ], new T.MeshLambertMaterial({ vertexColors:true, color:0x9fdc9f, transparent:true, opacity:0.4, depthWrite:false }), max);
        for (const m of [normal, camo]) { m.setColorAt(0, new T.Color(1, 1, 1)); m.count = 0; m.frustumCulled = false; m.castShadow = m === normal; sc.add(m); }
        this.fischMeshes[typ] = { normal, camo, max };
      }
      this.eisBlock = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshPhongMaterial({ color:0xbfeaff, transparent:true, opacity:0.45, shininess:120, depthWrite:false }), 900);
      this.eisBlock.count = 0; this.eisBlock.frustumCulled = false;
      sc.add(this.eisBlock);

      // Geschosse als Instanzen
      this.geschossMeshes = {};
      for (const [k, a] of Object.entries(this.geschossArten)) {
        const m = new T.InstancedMesh(a.geo, a.mat, 600);
        m.count = 0; m.frustumCulled = false; m.castShadow = true;
        sc.add(m);
        this.geschossMeshes[k] = m;
      }

      // Spritzer und Schnee-Teilchen
      this.teilchen = [];
      this.teilchenMesh = new T.InstancedMesh(new T.SphereGeometry(1, 6, 5), new T.MeshBasicMaterial({ color:0xffffff }), 1500);
      this.teilchenMesh.setColorAt(0, new T.Color(1, 1, 1));   // vor count = 0, sonst ist der Farbpuffer leer
      this.teilchenMesh.count = 0; this.teilchenMesh.frustumCulled = false;
      sc.add(this.teilchenMesh);

      // Reichweite und Vorschau
      this.reichweite = new T.Group();
      const flaeche = new T.Mesh(new T.CircleGeometry(1, 64), new T.MeshBasicMaterial({ color:0x2f7fe0, transparent:true, opacity:0.18, depthWrite:false }));
      const ring = new T.Mesh(new T.RingGeometry(0.975, 1, 64), new T.MeshBasicMaterial({ color:0x13315c, transparent:true, opacity:0.6, depthWrite:false }));
      for (const m of [flaeche, ring]) { m.rotation.x = -Math.PI / 2; m.position.y = 7.5; m.renderOrder = 2; this.reichweite.add(m); }
      this.reichweiteFlaeche = flaeche; this.reichweiteRing = ring;
      this.reichweite.visible = false;
      sc.add(this.reichweite);
      this.geist = null; this.geistTyp = null;
      this.eulen = new Map();

      this.kartenMitte = new T.Vector3(0, 0, 18);
      this.groesse();
    }

    // Kamera so weit weg, dass die ganze Karte drauf passt
    groesse() {
      const w = this.canvas.clientWidth || 800, h = this.canvas.clientHeight || 500;
      this.renderer.setSize(w, h, false);
      const pr = this.renderer.getPixelRatio();
      this.overlay.width = Math.round(w * pr); this.overlay.height = Math.round(h * pr);
      this.overlay.style.width = w + 'px'; this.overlay.style.height = h + 'px';
      this.ox.setTransform(pr, 0, 0, pr, 0, 0);
      this.pw = w; this.ph = h;
      const k = this.kamera;
      k.aspect = w / h;
      k.updateProjectionMatrix();
      const hoehe = 63 * Math.PI / 180;
      const ziel = this.kartenMitte || new T.Vector3();
      const ecken = [[-W / 2 - 14, -H / 2 - 14], [W / 2 + 14, -H / 2 - 14], [-W / 2 - 14, H / 2 + 14], [W / 2 + 14, H / 2 + 14]].map(([x, z]) => new T.Vector3(x, 0, z));
      let lo = 200, hi = 6000;
      for (let i = 0; i < 28; i++) {
        const d = (lo + hi) / 2;
        k.position.set(ziel.x, ziel.y + Math.sin(hoehe) * d, ziel.z + Math.cos(hoehe) * d);
        k.lookAt(ziel);
        k.updateMatrixWorld();
        const passt = ecken.every(e => { const p = e.clone().project(k); return Math.abs(p.x) <= 0.99 && Math.abs(p.y) <= 0.97; });
        if (passt) hi = d; else lo = d;
      }
      k.position.set(ziel.x, ziel.y + Math.sin(hoehe) * hi, ziel.z + Math.cos(hoehe) * hi);
      k.lookAt(ziel);
      k.updateMatrixWorld();
    }

    // Bildschirmpunkt → Kartenpunkt (oder null)
    bodenPunkt(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      const v = new T.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(v, this.kamera);
      const p = new T.Vector3();
      if (!this.ray.ray.intersectPlane(this.ebene, p)) return null;
      return [p.x + W / 2, p.z + H / 2];
    }
    bildschirm(x, y, h = 0) {
      const p = new T.Vector3(X(x), h, Z(y)).project(this.kamera);
      return [(p.x + 1) / 2 * this.pw, (1 - p.y) / 2 * this.ph];
    }

    reichweiteZeigen(x, y, r, ok = true) {
      if (x == null || !r) { this.reichweite.visible = false; return; }
      this.reichweite.visible = true;
      this.reichweite.position.set(X(x), 0, Z(y));
      this.reichweite.scale.setScalar(Math.min(r, 1400));
      this.reichweiteFlaeche.material.color.set(ok ? 0x2f7fe0 : 0xff4a3a);
      this.reichweiteRing.material.color.set(ok ? 0x13315c : 0xb3261e);
    }
    geistZeigen(typ, x, y, ok) {
      if (!typ) { if (this.geist) this.geist.visible = false; return; }
      if (this.geistTyp !== typ) {
        if (this.geist) this.scene.remove(this.geist);
        const { g } = pinguinBauen(typ, [0, 0, 0]);
        g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.65; o.castShadow = false; } });
        this.geist = g; this.geistTyp = typ;
        this.scene.add(g);
      }
      this.geist.visible = true;
      this.geist.position.set(X(x), 0, Z(y));
      this.geist.rotation.y = Math.PI / 2;
      this.geist.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.set(ok ? 0x000000 : 0x661010); });
    }

    /* ---------- Ereignisse aus der Logik ---------- */
    ereignisse(liste) {
      for (const e of liste) {
        switch (e.art) {
          case 'platzen': {
            const f = PT.FISCHE[e.typ];
            const n = f.riese ? 26 : 4;
            for (let i = 0; i < n; i++) this.teilchenDazu(e.x, e.y, WASSER_Y + 4, f.farbe, f.riese ? 2.5 : 1.4, f.riese ? 160 : 90);
            for (let i = 0; i < (f.riese ? 10 : 2); i++) this.teilchenDazu(e.x, e.y, WASSER_Y + 4, 0xdff5ff, 1.6, 70);
            if (f.riese) this.texte.push({ x:e.x, y:e.y, h:30, text:'💥', farbe:'#fff', t:0, dauer:1, gross:28 });
            break;
          }
          case 'explosion': {
            const r = Math.max(12, e.r);
            this.effekte.push({ art:'kugel', x:e.x, y:e.y, r, t:0, dauer:0.28, farbe:e.bild === 'schneeballBlau' ? 0xa8dcff : e.bild === 'rakete' ? 0xffb37a : 0xffffff });
            for (let i = 0; i < 6; i++) this.teilchenDazu(e.x, e.y, 10, 0xffffff, 2, r * 3);
            break;
          }
          case 'ring': {
            const farben = { ring:0xbfeaff, ringLila:0xb36bff, frost:0x7fd6ff, frostStark:0x5ec8ff, saeule:0x9ff3ff };
            this.effekte.push({ art:'ring', x:e.x, y:e.y, r:e.r, t:0, dauer:e.bild.startsWith('frost') ? 0.45 : 0.3, farbe:farben[e.bild] || 0xffffff });
            if (e.bild.startsWith('frost')) for (let i = 0; i < 12; i++) this.teilchenDazu(e.x + (Math.random() - 0.5) * e.r * 1.5, e.y + (Math.random() - 0.5) * e.r * 1.5, 8, 0xe6f8ff, 1.5, 30);
            this.animieren(e.turm, 0.2);
            break;
          }
          case 'strahl':
            this.effekte.push({ art:'strahl', x1:e.x1, y1:e.y1, x2:e.x2, y2:e.y2, t:0, dauer:0.12, farbe:e.bild === 'harpuneGold' ? 0xffd54a : 0xe8f0ff });
            this.animieren(e.turm, 0.12);
            break;
          case 'blitz':
            this.effekte.push({ art:'blitz', pts:e.pts, t:0, dauer:0.22, farbe:e.bild === 'blitzGross' ? 0x7dffb2 : 0xc3b0ff });
            this.animieren(e.turm, 0.2);
            break;
          case 'wurf':
            this.animieren(e.turm, 0.18);
            break;
          case 'kiste':
            this.texte.push({ x:e.turm.x, y:e.turm.y, h:50, text:'+' + e.wert, farbe:'#ffd54a', t:0, dauer:1.1 });
            break;
          case 'gebaut': case 'upgrade':
            for (let i = 0; i < 18; i++) this.teilchenDazu(e.turm.x, e.turm.y, 12, e.art === 'upgrade' ? 0xffd54a : 0xffffff, 1.8, 90);
            this.pinguinEntfernen(e.turm.id);
            break;
          case 'verkauft':
            for (let i = 0; i < 14; i++) this.teilchenDazu(e.turm.x, e.turm.y, 12, 0xffd54a, 1.8, 90);
            this.pinguinEntfernen(e.turm.id);
            break;
          case 'leck':
            this.blitz = 0.35;
            break;
        }
      }
    }
    animieren(turm, d) { const p = turm && this.pinguine.get(turm.id); if (p) p.anim = d; }
    teilchenDazu(x, y, h, farbe, groesse, tempo) {
      if (this.teilchen.length >= 1500) return;
      const w = Math.random() * Math.PI * 2, v = tempo * (0.4 + Math.random() * 0.6);
      this.teilchen.push({ x:X(x), y:h, z:Z(y), vx:Math.cos(w) * v, vy:60 + Math.random() * 90, vz:Math.sin(w) * v, t:0, dauer:0.45 + Math.random() * 0.3, g:groesse, farbe:new T.Color(farbe) });
    }
    pinguinEntfernen(id) {
      const p = this.pinguine.get(id);
      if (p) { this.scene.remove(p.g); this.pinguine.delete(id); }
      const e = this.eulen.get(id);
      if (e) { this.scene.remove(e); this.eulen.delete(id); }
    }

    /* ---------- Jedes Bild ---------- */
    zeichnen(spiel, dt, auswahl) {
      this.zeit += dt;
      const sc = this.scene;
      if (this.wasserTex) this.wasserTex.offset.x -= dt * 0.35;

      // Pinguine
      const da = new Set();
      for (const t of spiel.tuerme) {
        da.add(t.id);
        let p = this.pinguine.get(t.id);
        if (!p) {
          p = pinguinBauen(t.typ, t.pfade);
          p.g.position.set(X(t.x), 0, Z(t.y));
          p.winkel = -t.winkel; p.anim = 0; p.plopp = 0.25;
          p.innen.rotation.y = p.winkel;
          this.pinguine.set(t.id, p);
          sc.add(p.g);
        }
        if (PT.PINGUINE[t.typ].greift !== false) {
          let d = -t.winkel - p.winkel;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          p.winkel += d * Math.min(1, dt * 14);
          p.innen.rotation.y = p.winkel;
        } else p.innen.rotation.y = t.typ === 'markt' ? Math.PI / 2 : Math.PI / 2 + Math.sin(this.zeit * 0.8 + t.id) * 0.3;
        // Wurfbewegung und Aufploppen
        p.anim = Math.max(0, p.anim - dt);
        p.plopp = Math.max(0, p.plopp - dt);
        const a = p.anim > 0 ? Math.sin(p.anim / 0.18 * Math.PI) : 0;
        if (p.teile.fluegelR) p.teile.fluegelR.rotation.x = 0.35 + a * 1.4;
        if (p.teile.fluegelL) p.teile.fluegelL.rotation.x = -0.35 - (t.typ === 'rundum' || t.typ === 'haeuptling' ? a * 1.4 : 0);
        const s = 1 + Math.sin(p.plopp / 0.25 * Math.PI) * 0.25 - a * 0.05;
        p.innen.scale.set(s * MODELL_GROESSE, (1 + (s - 1) * 1.2 + Math.sin(this.zeit * 3 + t.id) * 0.012) * MODELL_GROESSE, s * MODELL_GROESSE);
        if (p.teile.dreher) p.teile.dreher.rotation.y += dt * 1.6;
        if (p.teile.orb) p.teile.orb.scale.setScalar((t.pfade[0] >= 3 ? 5 : 3.8) * (1 + Math.sin(this.zeit * 5) * 0.12));
        // Eule der Polarlicht-Pinguine
        if (t.eff && t.eff.eule) {
          let e = this.eulen.get(t.id);
          if (!e) {
            e = new T.Group();
            const k = mesh(G.kugel, mat(0xf4f8ff), 0, 0, 0); k.scale.set(6, 7, 6);
            const f1 = mesh(G.kugel, mat(0xdfe8f2), 0, 1, 7); f1.scale.set(4, 1.2, 8);
            const f2 = f1.clone(); f2.position.z = -7;
            const au = mesh(G.kugelGrob, mat(0xffc93c, 'basic'), 5, 3, 2); au.scale.setScalar(1.4);
            const au2 = au.clone(); au2.position.z = -2;
            e.add(k, f1, f2, au, au2); e.fluegel = [f1, f2];
            this.eulen.set(t.id, e); sc.add(e);
          }
          const w = this.zeit * 1.5 + t.id;
          e.position.set(X(t.x) + Math.cos(w) * 40, 70 + Math.sin(this.zeit * 3) * 4, Z(t.y) + Math.sin(w) * 40);
          e.rotation.y = -w - Math.PI / 2;
          e.fluegel.forEach((f, i) => { f.rotation.x = Math.sin(this.zeit * 14) * 0.5 * (i ? -1 : 1); });
        }
      }
      for (const id of [...this.pinguine.keys()]) if (!da.has(id)) this.pinguinEntfernen(id);

      // Fische
      const m4 = new T.Matrix4(), q = new T.Quaternion(), eu = new T.Euler(), v = new T.Vector3(), sk = new T.Vector3(), col = new T.Color();
      const zaehler = {}, zaehlerC = {};
      for (const k of Object.keys(this.fischMeshes)) { zaehler[k] = 0; zaehlerC[k] = 0; }
      let eis = 0;
      for (const f of spiel.fische) {
        const fm = this.fischMeshes[f.typ];
        const typ = PT.FISCHE[f.typ];
        const zielMesh = f.camo ? fm.camo : fm.normal;
        const n = f.camo ? zaehlerC[f.typ] : zaehler[f.typ];
        if (n >= fm.max || f.x < -4 || f.x > W + 4 || f.y < -4 || f.y > H + 4) continue;
        const steht = f.frost > 0 || f.betaeubt > 0;
        const wackeln = steht ? 0 : Math.sin(this.zeit * (typ.riese ? 4 : 11) + f.id) * (typ.riese ? 0.06 : 0.18);
        eu.set(0, -f.w + wackeln, steht ? 0 : Math.sin(this.zeit * 7 + f.id) * 0.08);
        q.setFromEuler(eu);
        const h = WASSER_Y + typ.r * (typ.riese ? 0.15 : 0.35) + Math.sin(this.zeit * 4 + f.id * 1.3) * 0.8;
        v.set(X(f.x), h, Z(f.y));
        const auftauchen = Math.min(1, (spiel.zeit - f.geboren) * 6 + 0.3);
        sk.setScalar(auftauchen * (typ.riese ? 1.15 : 1.45));
        m4.compose(v, q, sk);
        zielMesh.setMatrixAt(n, m4);
        // Farbe: eingefroren bläulich, betäubt gelblich, Riesen werden mit Schaden dunkler
        if (f.frost > 0) col.setRGB(0.75, 0.92, 1.15);
        else if (f.betaeubt > 0) col.setRGB(1.1, 1.05, 0.7);
        else if (typ.hp > 1) { const k = 0.55 + 0.45 * Math.max(0, f.hp / f.hpMax); col.setRGB(k, k, k); }
        else col.setRGB(1, 1, 1);
        zielMesh.setColorAt(n, col);
        if (f.camo) zaehlerC[f.typ]++; else zaehler[f.typ]++;
        if (f.frost > 0 && eis < 900) {
          const s = typ.r * 2.5 * 1.45;
          m4.compose(v, q, sk.set(s * 1.1, s * 0.75, s * 0.85));
          this.eisBlock.setMatrixAt(eis++, m4);
        }
      }
      for (const [k, fm] of Object.entries(this.fischMeshes)) {
        fm.normal.count = zaehler[k]; fm.camo.count = zaehlerC[k];
        for (const m of [fm.normal, fm.camo]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      }
      this.eisBlock.count = eis;
      this.eisBlock.instanceMatrix.needsUpdate = true;

      // Geschosse
      const gz = {};
      for (const k of Object.keys(this.geschossMeshes)) gz[k] = 0;
      for (const g of spiel.geschosse) {
        const art = this.geschossArten[g.bild] || this.geschossArten.zapfen;
        const m = this.geschossMeshes[g.bild] || this.geschossMeshes.zapfen;
        const k = this.geschossMeshes[g.bild] ? g.bild : 'zapfen';
        if (gz[k] >= 600) continue;
        const w = Math.atan2(g.vy, g.vx);
        const kugelig = art.geo.type === 'SphereGeometry' || art.geo.type === 'IcosahedronGeometry';
        eu.set(art.rollen ? 0 : 0, -w, art.rollen ? -this.zeit * 8 : 0);
        q.setFromEuler(eu);
        const s = kugelig ? g.groesse : g.bild === 'rakete' ? 1 : g.groesse / 5;
        v.set(X(g.x), art.y == null ? g.groesse + 1 : art.y, Z(g.y));
        m4.compose(v, q, sk.setScalar(s));
        m.setMatrixAt(gz[k]++, m4);
      }
      for (const [k, m] of Object.entries(this.geschossMeshes)) { m.count = gz[k]; m.instanceMatrix.needsUpdate = true; }

      // Teilchen
      let tn = 0;
      this.teilchen = this.teilchen.filter(p => (p.t += dt) < p.dauer);
      for (const p of this.teilchen) {
        p.vy -= 400 * dt;
        p.x += p.vx * dt; p.y = Math.max(WASSER_Y, p.y + p.vy * dt); p.z += p.vz * dt;
        const s = p.g * (1 - p.t / p.dauer * 0.6);
        m4.compose(v.set(p.x, p.y, p.z), q.identity(), sk.setScalar(s));
        this.teilchenMesh.setMatrixAt(tn, m4);
        this.teilchenMesh.setColorAt(tn, p.farbe);
        tn++;
      }
      this.teilchenMesh.count = tn;
      this.teilchenMesh.instanceMatrix.needsUpdate = true;
      if (this.teilchenMesh.instanceColor) this.teilchenMesh.instanceColor.needsUpdate = true;

      // Effekte (Ringe, Explosionen, Strahlen, Blitze)
      this.effekte = this.effekte.filter(e => {
        e.t += dt;
        if (!e.obj) this.effektBauen(e);
        const k = e.t / e.dauer;
        if (k >= 1) { sc.remove(e.obj); return false; }
        if (e.art === 'ring') { e.obj.scale.setScalar(Math.max(1, e.r * (0.3 + 0.7 * k))); e.obj.material.opacity = 0.7 * (1 - k); }
        else if (e.art === 'kugel') { e.obj.scale.setScalar(e.r * (0.4 + 0.6 * Math.sqrt(k))); e.obj.material.opacity = 0.75 * (1 - k); }
        else e.obj.material.opacity = 1 - k;
        return true;
      });

      // Polarlicht und Schnee
      this.polarLichter.forEach((l, i) => {
        const w = this.zeit * (0.15 + i * 0.05) + i * 2.1;
        l.position.set(Math.cos(w) * 380, 150 + Math.sin(this.zeit + i) * 30, Math.sin(w * 1.3) * 220);
        l.intensity = 0.8 + Math.sin(this.zeit * 0.7 + i) * 0.35;
      });
      if (this.schnee) {
        const p = this.schnee.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          let y = p.getY(i) - dt * 22;
          if (y < 0) y += 500;
          p.setY(i, y);
          p.setX(i, p.getX(i) + Math.sin(this.zeit + i) * dt * 6);
        }
        p.needsUpdate = true;
      }

      // Auswahl
      if (auswahl && auswahl.eff) this.reichweiteZeigen(auswahl.x, auswahl.y, auswahl.eff.reichweite > 5000 ? 0 : auswahl.eff.reichweite, true);

      this.renderer.render(sc, this.kamera);
      this.overlayZeichnen(spiel, dt);
    }

    effektBauen(e) {
      if (e.art === 'ring') {
        e.obj = new T.Mesh(new T.RingGeometry(0.86, 1, 48), new T.MeshBasicMaterial({ color:e.farbe, transparent:true, opacity:0.7, depthWrite:false, side:T.DoubleSide }));
        e.obj.rotation.x = -Math.PI / 2;
        e.obj.position.set(X(e.x), 8, Z(e.y));
      } else if (e.art === 'kugel') {
        e.obj = new T.Mesh(G.kugel, new T.MeshBasicMaterial({ color:e.farbe, transparent:true, opacity:0.75, depthWrite:false }));
        e.obj.position.set(X(e.x), 10, Z(e.y));
      } else if (e.art === 'strahl') {
        const g = new T.BufferGeometry().setFromPoints([new T.Vector3(X(e.x1), 22, Z(e.y1)), new T.Vector3(X(e.x2), 8, Z(e.y2))]);
        e.obj = new T.Line(g, new T.LineBasicMaterial({ color:e.farbe, transparent:true }));
        this.teilchenDazu(e.x2, e.y2, 8, 0xffffff, 1.5, 50);
      } else if (e.art === 'blitz') {
        const pts = [];
        e.pts.forEach(([x, y], i) => {
          if (i > 0) {
            const [px, py] = e.pts[i - 1];
            for (let k = 1; k < 4; k++) pts.push(new T.Vector3(X(px + (x - px) * k / 4) + (Math.random() - 0.5) * 12, 14 + Math.random() * 10, Z(py + (y - py) * k / 4) + (Math.random() - 0.5) * 12));
          }
          pts.push(new T.Vector3(X(x), i ? 10 : 40, Z(y)));
        });
        e.obj = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color:e.farbe, transparent:true }));
      }
      this.scene.add(e.obj);
    }

    overlayZeichnen(spiel, dt) {
      const x = this.ox;
      x.clearRect(0, 0, this.pw, this.ph);
      // Lebensbalken der großen Fische
      for (const f of spiel.fische) {
        const typ = PT.FISCHE[f.typ];
        if (typ.hp < 10 || (f.camo)) continue;
        const [sx, sy] = this.bildschirm(f.x, f.y, typ.r * 1.4 + 6);
        const b = typ.riese ? 50 : 24;
        x.fillStyle = 'rgba(10,20,40,0.7)'; x.fillRect(sx - b / 2 - 1, sy - 1, b + 2, 6);
        x.fillStyle = f.hp / f.hpMax > 0.5 ? '#4cd964' : f.hp / f.hpMax > 0.25 ? '#f6c343' : '#e2463b';
        x.fillRect(sx - b / 2, sy, b * Math.max(0, f.hp / f.hpMax), 4);
      }
      // schwebende Texte
      x.textAlign = 'center';
      this.texte = this.texte.filter(t => (t.t += dt) < t.dauer);
      for (const t of this.texte) {
        const [sx, sy] = this.bildschirm(t.x, t.y, t.h + t.t * 40);
        x.globalAlpha = 1 - t.t / t.dauer;
        x.font = `800 ${t.gross || 18}px "Bricolage Grotesque", system-ui, sans-serif`;
        x.lineWidth = 4; x.strokeStyle = 'rgba(20,30,50,0.8)'; x.strokeText(t.text, sx, sy);
        x.fillStyle = t.farbe; x.fillText(t.text, sx, sy);
      }
      x.globalAlpha = 1;
      // roter Rand, wenn ein Fisch durchkommt
      if (this.blitz > 0) {
        this.blitz -= dt;
        const g = x.createRadialGradient(this.pw / 2, this.ph / 2, Math.min(this.pw, this.ph) * 0.35, this.pw / 2, this.ph / 2, Math.max(this.pw, this.ph) * 0.7);
        g.addColorStop(0, 'rgba(226,70,59,0)'); g.addColorStop(1, `rgba(226,70,59,${Math.max(0, this.blitz) * 1.2})`);
        x.fillStyle = g; x.fillRect(0, 0, this.pw, this.ph);
      }
    }

    // Kleines Vorschaubild eines Pinguins für den Shop
    static vorschauBilder(typen, groesse = 96) {
      const c = document.createElement('canvas');
      c.width = c.height = groesse * 2;
      const r = new T.WebGLRenderer({ canvas:c, antialias:true, alpha:true, preserveDrawingBuffer:true });
      r.setPixelRatio(1); r.setSize(groesse * 2, groesse * 2, false);
      const sc = new T.Scene();
      sc.add(new T.HemisphereLight(0xffffff, 0x8899aa, 0.9));
      const l = new T.DirectionalLight(0xffffff, 0.7); l.position.set(1, 2, 1.5); sc.add(l);
      const k = new T.PerspectiveCamera(30, 1, 1, 1000);
      const bilder = {};
      for (const typ of typen) {
        const { g, innen } = pinguinBauen(typ, [0, 0, 0]);
        innen.rotation.y = typ === 'markt' ? Math.PI / 2 + 0.6 : 0.9;
        sc.add(g);
        const hoch = typ === 'markt' ? 26 : 26;
        k.position.set(68, 62 + hoch * 0.4, 88); k.lookAt(0, hoch - 2, 0);
        r.render(sc, k);
        bilder[typ] = c.toDataURL('image/png');
        sc.remove(g);
      }
      r.dispose();
      if (r.forceContextLoss) r.forceContextLoss();
      return bilder;
    }
    static fischBilder(groesse = 64) {
      const c = document.createElement('canvas');
      c.width = c.height = groesse * 2;
      const r = new T.WebGLRenderer({ canvas:c, antialias:true, alpha:true, preserveDrawingBuffer:true });
      r.setPixelRatio(1); r.setSize(groesse * 2, groesse * 2, false);
      const sc = new T.Scene();
      sc.add(new T.HemisphereLight(0xffffff, 0x8899aa, 0.95));
      const l = new T.DirectionalLight(0xffffff, 0.6); l.position.set(1, 2, 2); sc.add(l);
      const k = new T.PerspectiveCamera(30, 1, 0.1, 1000);
      const bilder = {};
      for (const typ of Object.keys(PT.FISCHE)) {
        const f = PT.FISCHE[typ];
        const m = new T.Mesh(fischGeo(typ), new T.MeshPhongMaterial({ vertexColors:true, shininess:50 }));
        m.rotation.y = -0.5;
        sc.add(m);
        const d = f.r * 5.2;
        k.position.set(d * 0.2, d * 0.45, d); k.lookAt(0, 0, 0);
        r.render(sc, k);
        bilder[typ] = c.toDataURL('image/png');
        sc.remove(m);
      }
      r.dispose();
      if (r.forceContextLoss) r.forceContextLoss();
      return bilder;
    }
  }

  window.PT.Welt = Welt;
})();
