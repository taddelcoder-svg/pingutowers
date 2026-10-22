'use strict';
// Pinguin Türmchen – das Pingu-Dorf in 3D: eine Eisscholle in der Nacht mit Lagerfeuer, Gebäuden, die mit
// jeder Stufe wachsen, und Bewohnern, die herumwatscheln. Antippen wählt ein Gebäude (beiWahl), Ziehen dreht.
(function () {
  const PT = window.PT;
  const T = window.THREE;
  const { G, mat, mesh, pinguinKoerper } = PT.M3;

  // Plätze rund um den Dorfplatz (x, z)
  const PLATZ = {
    raeucherei:[-165, 70], lazarett:[-80, -140], hafen:[215, 95], schmiede:[95, -150],
    wachturm:[-205, -70], denkmal:[60, 95], akademie:[175, -55], leuchtfeuer:[-30, 205]
  };
  const HIMMEL = [0x050a18, 0x0b1630, 0x101c3a, 0x14224a, 0x2a2f5a];

  class DorfWelt {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new T.WebGLRenderer({ canvas, antialias:true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.scene = new T.Scene();
      this.kamera = new T.PerspectiveCamera(40, 2, 10, 4000);
      this.winkel = 0.6; this.abstand = 620; this.hoehe = 0.62;
      this.zeit = 0; this.laeuft = false; this.letzte = 0;
      this.gebaeude = {}; this.bewohner = []; this.funken = []; this.rauch = [];
      this.ray = new T.Raycaster();
      this.basisBauen();
      this.eingabe();
      new ResizeObserver(() => this.groesse()).observe(canvas);
      this.groesse();
    }
    groesse() {
      const w = this.canvas.clientWidth || 600, h = this.canvas.clientHeight || 300;
      this.renderer.setSize(w, h, false);
      this.kamera.aspect = w / h;
      this.kamera.updateProjectionMatrix();
    }
    basisBauen() {
      const sc = this.scene;
      sc.background = new T.Color(HIMMEL[1]);
      sc.fog = new T.Fog(HIMMEL[1], 700, 1900);
      this.halb = new T.HemisphereLight(0x9fb4ff, 0x1a2440, 0.55); sc.add(this.halb);
      this.mond = new T.DirectionalLight(0xc9d8ff, 0.5); this.mond.position.set(-300, 500, 200); sc.add(this.mond);
      // Meer
      this.meer = new T.Mesh(new T.PlaneGeometry(6000, 6000), new T.MeshPhongMaterial({ color:0x0a2142, shininess:90, specular:0x335577 }));
      this.meer.rotation.x = -Math.PI / 2; this.meer.position.y = -14; sc.add(this.meer);
      // Scholle: unregelmäßiger Rand, oben Schnee
      const geo = new T.CylinderGeometry(280, 300, 26, 40, 1);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), w = Math.atan2(z, x);
        const k = 1 + Math.sin(w * 5) * 0.05 + Math.sin(w * 11 + 1) * 0.03;
        p.setX(i, x * k); p.setZ(i, z * k);
      }
      geo.computeVertexNormals();
      const scholle = new T.Mesh(geo, new T.MeshLambertMaterial({ color:0xe6f4fb }));
      scholle.position.y = -2; sc.add(scholle);
      const platz = new T.Mesh(new T.CircleGeometry(90, 32), new T.MeshLambertMaterial({ color:0xc9dbe6 }));
      platz.rotation.x = -Math.PI / 2; platz.position.y = 11.2; sc.add(platz);
      // Lagerfeuer in der Mitte
      this.feuer = new T.Group();
      for (let i = 0; i < 5; i++) {
        const h = mesh(G.zyl, mat(0x6b4a2a), 0, 14, 0); h.scale.set(2.4, 26, 2.4); h.rotation.set(Math.PI / 2 - 0.35, i * 1.26, 0); this.feuer.add(h);
      }
      this.flamme = mesh(G.kegel, mat(0xffa030, 'basic', { transparent:true, opacity:0.9 }), 0, 24, 0); this.flamme.scale.set(9, 22, 9); this.feuer.add(this.flamme);
      this.flammeInnen = mesh(G.kegel, mat(0xfff0a0, 'basic'), 0, 21, 0); this.flammeInnen.scale.set(5, 13, 5); this.feuer.add(this.flammeInnen);
      for (let i = 0; i < 8; i++) { const w = i / 8 * Math.PI * 2; const st = mesh(G.kugelGrob, mat(0x6a7480), Math.cos(w) * 16, 13, Math.sin(w) * 16); st.scale.set(5, 3.5, 5); this.feuer.add(st); }
      this.feuerLicht = new T.PointLight(0xff9a3a, 1.6, 520, 1.5); this.feuerLicht.position.set(0, 40, 0); this.feuer.add(this.feuerLicht);
      sc.add(this.feuer);
      this.auswahlRing = mesh(G.torus, mat(0xffd54a, 'basic'), 0, 13, 0); this.auswahlRing.rotation.x = Math.PI / 2; this.auswahlRing.scale.set(46, 46, 20); this.auswahlRing.visible = false;
      sc.add(this.auswahlRing);
      this.mauer = new T.Group(); sc.add(this.mauer);
      // Schnee
      const n = 260, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 1200; pos[i * 3 + 1] = Math.random() * 500; pos[i * 3 + 2] = (Math.random() - 0.5) * 1200; }
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3));
      this.schnee = new T.Points(sg, new T.PointsMaterial({ color:0xffffff, size:3, transparent:true, opacity:0.8, depthWrite:false }));
      sc.add(this.schnee);
    }
    eingabe() {
      let zug = null;
      this.canvas.addEventListener('pointerdown', e => { zug = { x:e.clientX, y:e.clientY, w:this.winkel, bewegt:false }; this.canvas.setPointerCapture(e.pointerId); });
      this.canvas.addEventListener('pointermove', e => {
        if (!zug) return;
        const dx = e.clientX - zug.x;
        if (Math.abs(dx) > 4) zug.bewegt = true;
        this.winkel = zug.w - dx * 0.008;
        this.drehPause = 4;
      });
      this.canvas.addEventListener('pointerup', e => {
        if (zug && !zug.bewegt) this.antippen(e.clientX, e.clientY);
        zug = null;
      });
      this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.abstand = Math.max(380, Math.min(900, this.abstand * (e.deltaY > 0 ? 1.08 : 0.92))); }, { passive:false });
    }
    antippen(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      this.ray.setFromCamera(new T.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.kamera);
      const ziele = Object.values(this.gebaeude).filter(Boolean);
      const treffer = this.ray.intersectObjects(ziele, true)[0];
      if (!treffer) return;
      let o = treffer.object;
      while (o && !o.userData.gebaeude) o = o.parent;
      if (o && this.beiWahl) this.beiWahl(o.userData.gebaeude);
    }

    /* ---------- Gebäude ---------- */
    // Stufe 0: Schneehaufen, Lager (Phase 1, niedrige Stufen): Zelt, sonst Iglu-Hütte, die mit den Stufen wächst
    haus(g, stufe, phase, dach) {
      if (stufe === 0) { const h = mesh(G.kegel, mat(0xf4fbff), 0, 18, 0); h.scale.set(22, 16, 22); g.add(h); return 0; }
      if (phase <= 1 || stufe <= 1) {
        const z = mesh(G.kegel4, mat(dach), 0, 30, 0); z.scale.set(30 + stufe * 4, 36 + stufe * 4, 30 + stufe * 4); z.rotation.y = Math.PI / 4; g.add(z);
        const tuer = mesh(G.box, mat(0x2a1a10), 14, 22, 0); tuer.scale.set(2, 16, 10); g.add(tuer);
        return 46 + stufe * 4;
      }
      const r = 22 + stufe * 4;
      const iglu = mesh(G.halbkugel, mat(0xeaf6fd, 'phong', { shininess:60 }), 0, 12, 0); iglu.scale.set(r, r * 0.9, r); g.add(iglu);
      const eingang = mesh(G.zyl, mat(0xdcecf6), r * 0.9, 18, 0); eingang.scale.set(9, 14, 9); eingang.rotation.z = Math.PI / 2; g.add(eingang);
      const loch = mesh(G.zyl, mat(0x1a2a3a, 'basic'), r * 1.2 + 1, 18, 0); loch.scale.set(6, 1, 6); loch.rotation.z = Math.PI / 2; g.add(loch);
      const kappe = mesh(G.kugel, mat(dach), 0, 12 + r * 0.85, 0); kappe.scale.set(r * 0.35, r * 0.18, r * 0.35); g.add(kappe);
      if (stufe >= 4) for (const w of [0.9, -0.9, 2.4]) { const f = mesh(G.box, mat(0xffd27a, 'basic'), Math.cos(w) * r * 0.93, 12 + r * 0.4, Math.sin(w) * r * 0.93); f.scale.set(3, 6, 6); f.rotation.y = -w; g.add(f); }
      if (stufe >= 5) { const st = mesh(G.zyl, mat(0x6b4a2a), -r * 0.4, 12 + r * 1.1, 0); st.scale.set(1, 30, 1); g.add(st); const fa = mesh(G.box, mat(dach), -r * 0.4 + 8, 12 + r * 1.1 + 10, 0); fa.scale.set(16, 9, 1); g.add(fa); }
      return 12 + r;
    }
    gebaeudeBauen(id, stufe, phase) {
      const alt = this.gebaeude[id];
      if (alt) this.scene.remove(alt);
      const def = PT.DORF_GEBAEUDE[id];
      if (phase < def.ab) { this.gebaeude[id] = null; return; }
      const g = new T.Group();
      g.userData.gebaeude = id;
      const [x, z] = PLATZ[id];
      g.position.set(x, 12, z);
      g.rotation.y = Math.atan2(-z, x) + Math.PI;   // Eingang zur Mitte
      let oben = 0;
      if (id === 'raeucherei') {
        oben = this.haus(g, stufe, phase, 0x8a5a3a);
        if (stufe) {
          const sch = mesh(G.zyl, mat(0x5a4a40), -8, oben, 10); sch.scale.set(4, 22, 4); g.add(sch);
          this.rauch.push({ x:x - 8, z:z + 10, y:12 + oben + 12, t:Math.random() });
          for (let i = 0; i < Math.min(5, stufe + 1); i++) { const f = mesh(G.kugelGrob, mat(0xff8a3a), 24, 14 + i * 5, -12 + i * 6); f.scale.set(4, 1.6, 1.4); g.add(f); }
          const st = mesh(G.box, mat(0x6b4a2a), 24, 20, 0); st.scale.set(1.5, 18, 34); g.add(st);
        }
      } else if (id === 'lazarett') {
        oben = this.haus(g, stufe, phase, 0xf4f4f4);
        if (stufe) { for (const [w, h, d] of [[2, 14, 4], [2, 4, 14]]) { const k = mesh(G.box, mat(0xe2463b, 'basic'), 0, oben + 14, 0); k.scale.set(w, h, d); g.add(k); } }
      } else if (id === 'hafen') {
        const steg = mesh(G.box, mat(0x8b5a2b), -40 - stufe * 5, 2, 0); steg.scale.set(90 + stufe * 10, 4, 18); g.add(steg);
        for (let i = 0; i < stufe; i++) {
          const boot = new T.Group();
          const rumpf = mesh(G.kugel, mat(i % 2 ? 0x2f7fe0 : 0xe2463b), 0, 0, 0); rumpf.scale.set(18, 6, 8); boot.add(rumpf);
          const mast = mesh(G.zyl, mat(0x6b4a2a), 0, 16, 0); mast.scale.set(1, 26, 1); boot.add(mast);
          const segel = mesh(G.kegel4, mat(0xf4f8ff), 4, 18, 0); segel.scale.set(10, 20, 1); boot.add(segel);
          boot.position.set(-80 - i * 30, -24, i % 2 ? 26 : -26); boot.userData.schaukeln = i; g.add(boot);
        }
        oben = 20;
        if (stufe === 0) oben = this.haus(g, 0, phase, 0);
      } else if (id === 'schmiede') {
        oben = this.haus(g, stufe, phase, 0x4a4a52);
        if (stufe) {
          const amboss = mesh(G.box, mat(0x3a3f48, 'phong', { shininess:120 }), 30, 6, 0); amboss.scale.set(14, 8, 8); g.add(amboss);
          const glut = mesh(G.kugel, mat(0xff6a1a, 'basic'), 30, 0, 18); glut.scale.set(8, 4, 8); g.add(glut);
          const l = new T.PointLight(0xff6a1a, 0.6 + stufe * 0.15, 200, 2); l.position.set(30, 16, 18); g.add(l);
        }
      } else if (id === 'wachturm') {
        if (!stufe) oben = this.haus(g, 0, phase, 0);
        else {
          const h = 40 + stufe * 18;
          for (const [px, pz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) { const b = mesh(G.zyl, mat(0x8b5a2b), px, h / 2, pz); b.scale.set(2.2, h, 2.2); b.rotation.z = px * 0.004; g.add(b); }
          const boden = mesh(G.box, mat(0x6b4a2a), 0, h, 0); boden.scale.set(30, 3, 30); g.add(boden);
          const dach = mesh(G.kegel4, mat(0x3a5a8a), 0, h + 16, 0); dach.scale.set(24, 18, 24); dach.rotation.y = Math.PI / 4; g.add(dach);
          const lampe = mesh(G.kugelGrob, mat(0xfff2a8, 'basic'), 0, h + 6, 0); lampe.scale.setScalar(4); g.add(lampe);
          oben = h + 26;
        }
      } else if (id === 'denkmal') {
        if (!stufe) oben = this.haus(g, 0, phase, 0);
        else {
          const sockel = mesh(new T.CylinderGeometry(18, 22, 14, 8), mat(0xa8c8dc, 'phong', { flatShading:true }), 0, 7, 0); g.add(sockel);
          // Walter, das alte Walross – aus Eis
          const fig = PT.M3.pinguinBauen('walter', [0, 0, 0], 1, {}).g;
          fig.traverse(o => { if (o.isMesh) o.material = mat(0xcfefff, 'phong', { emissive:0x1a4a6a, shininess:140, transparent:true, opacity:0.9 }); });
          fig.position.y = 12; fig.rotation.y = Math.PI; g.add(fig);
          oben = 70;
        }
      } else if (id === 'akademie') {
        oben = this.haus(g, stufe, phase, 0x2f7fe0);
        if (stufe >= 2) { const buch = mesh(G.box, mat(0xd8262b), 30, 10, 0); buch.scale.set(8, 3, 12); g.add(buch); const s2 = mesh(G.box, mat(0x35b04a), 30, 13.5, 0); s2.scale.set(7, 3, 11); g.add(s2); }
      } else if (id === 'leuchtfeuer') {
        if (!stufe) oben = this.haus(g, 0, phase, 0);
        else {
          const h = 70 + stufe * 26;
          for (let i = 0; i < 5; i++) { const t = mesh(G.zyl, mat(i % 2 ? 0xffffff : 0xe2463b), 0, h * (i + 0.5) / 5, 0); t.scale.set(14 - i * 1.4, h / 5, 14 - i * 1.4); g.add(t); }
          const kopf = mesh(G.zyl, mat(0xfff2a8, 'basic'), 0, h + 8, 0); kopf.scale.set(9, 14, 9); g.add(kopf);
          const dach = mesh(G.kegel, mat(0x2a2f38), 0, h + 22, 0); dach.scale.set(12, 12, 12); g.add(dach);
          const kegel = new T.Mesh(new T.ConeGeometry(40, 420, 18, 1, true), new T.MeshBasicMaterial({ color:0xfff2a8, transparent:true, opacity:0.12, depthWrite:false, side:T.DoubleSide }));
          kegel.position.set(0, 0, 0); kegel.rotation.z = stufe >= 3 ? Math.PI * 0.78 : Math.PI / 2; kegel.geometry.translate(0, -210, 0);
          const dreh = new T.Group(); dreh.position.y = h + 8; dreh.add(kegel); dreh.userData.dreh = stufe >= 3 ? 0.25 : 0.9; g.add(dreh);
          // Stufe 3: das Licht scheint in die Tiefe – und dort glimmt etwas
          if (stufe >= 3) { this.auge = mesh(G.kugel, mat(0xffb030, 'basic', { transparent:true, opacity:0.5 }), x * 1.8, -16, z * 1.8); this.auge.scale.set(26, 2, 12); this.scene.add(this.auge); }
          oben = h + 34;
        }
      }
      g.userData.oben = oben;
      this.gebaeude[id] = g;
      this.scene.add(g);
    }
    mauerBauen(phase) {
      this.scene.remove(this.mauer);
      this.mauer = new T.Group();
      if (phase >= 3) {
        const n = 34;
        for (let i = 0; i < n; i++) {
          const w = i / n * Math.PI * 2;
          if (Math.abs(Math.sin(w - 0.4)) < 0.12) continue;   // Tor zum Hafen
          const st = mesh(G.box, mat(0xd6ecf7, 'phong', { flatShading:true, shininess:50 }), Math.cos(w) * 262, 22, Math.sin(w) * 262);
          st.scale.set(12, 22 + (i % 3) * 4, 46); st.rotation.y = -w; this.mauer.add(st);
          if (phase >= 4 && i % 6 === 0) {
            const f = mesh(G.zyl, mat(0x6b4a2a), Math.cos(w) * 262, 56, Math.sin(w) * 262); f.scale.set(1, 30, 1); this.mauer.add(f);
            const fa = mesh(G.box, mat(0x2f7fe0), Math.cos(w) * 262, 66, Math.sin(w) * 262 + 7); fa.scale.set(1, 9, 14); this.mauer.add(fa);
          }
        }
      }
      this.scene.add(this.mauer);
    }
    bewohnerBauen(anzahl) {
      for (const b of this.bewohner) this.scene.remove(b.g);
      this.bewohner = [];
      const farben = [0x1e2231, 0x2a3140, 0x5a3420, 0x3a3f4b, 0x1e2231];
      for (let i = 0; i < anzahl; i++) {
        const g = new T.Group();
        const klein = i % 7 === 3;
        pinguinKoerper(g, null, klein ? 0.42 : 0.6, farben[i % farben.length]);
        if (i === 3) { const m = mesh(G.kegel, mat(0xd8262b), 0, 44 * 0.42, 0); m.scale.set(4, 6, 4); m.rotation.z = 0.5; g.add(m); }   // Mia mit Mamas Mütze
        const w = Math.random() * Math.PI * 2, d = 40 + Math.random() * 150;
        g.position.set(Math.cos(w) * d, 12, Math.sin(w) * d);
        this.scene.add(g);
        this.bewohner.push({ g, ziel:null, warte:Math.random() * 3, tempo:18 + Math.random() * 14, ph:Math.random() * 6 });
      }
    }

    /* ---------- von außen ---------- */
    zeigen(dorf, phase, auswahl) {
      const sig = JSON.stringify([dorf.stufen, phase]);
      if (sig !== this.sig) {
        this.sig = sig;
        this.rauch = [];
        if (this.auge) { this.scene.remove(this.auge); this.auge = null; }
        for (const id of PT.DORF_REIHE) this.gebaeudeBauen(id, PT.dorfStufe(dorf, id), phase);
        this.mauerBauen(phase);
        const himmel = new T.Color(HIMMEL[phase]);
        this.scene.background = himmel; this.scene.fog.color = himmel;
        this.feuer.visible = phase > 0;
      }
      const n = phase ? Math.min(28, 3 + Math.floor(dorf.bewohner / 3)) : 0;
      if (n !== this.bewohner.length) this.bewohnerBauen(n);
      const g = auswahl && this.gebaeude[auswahl];
      this.auswahlRing.visible = !!g;
      if (g) this.auswahlRing.position.set(g.position.x, 13, g.position.z);
    }
    gebaut(id) {
      const g = this.gebaeude[id];
      if (!g) return;
      this.huepf = { g, t:0 };
      for (let i = 0; i < 30; i++) this.funken.push({ x:g.position.x, y:g.position.y + 10, z:g.position.z, vx:(Math.random() - 0.5) * 120, vy:80 + Math.random() * 120, vz:(Math.random() - 0.5) * 120, t:0 });
    }
    start() {
      if (this.laeuft) return;
      this.laeuft = true;
      this.letzte = performance.now();
      const schleife = jetzt => {
        if (!this.laeuft) return;
        requestAnimationFrame(schleife);
        if (!this.canvas.offsetParent) return;
        const dt = Math.min(0.1, (jetzt - this.letzte) / 1000);
        this.letzte = jetzt;
        this.bild(dt);
      };
      requestAnimationFrame(schleife);
    }
    stopp() { this.laeuft = false; }
    bild(dt) {
      this.zeit += dt;
      if (this.drehPause > 0) this.drehPause -= dt; else this.winkel += dt * 0.05;
      const k = this.kamera;
      k.position.set(Math.sin(this.winkel) * this.abstand * Math.cos(this.hoehe), Math.sin(this.hoehe) * this.abstand, Math.cos(this.winkel) * this.abstand * Math.cos(this.hoehe));
      k.lookAt(0, 20, 0);
      // Feuer flackert
      const f = 1 + Math.sin(this.zeit * 13) * 0.08 + Math.sin(this.zeit * 7.3) * 0.06;
      this.flamme.scale.set(9 * f, 22 * (2 - f), 9 * f);
      this.feuerLicht.intensity = 1.4 + Math.sin(this.zeit * 11) * 0.25;
      this.auswahlRing.rotation.z += dt;
      // Boote schaukeln, Leuchtfeuer dreht
      for (const g of Object.values(this.gebaeude)) if (g) for (const c of g.children) {
        if (c.userData.schaukeln != null) c.rotation.x = Math.sin(this.zeit * 1.3 + c.userData.schaukeln) * 0.08;
        if (c.userData.dreh) c.rotation.y += dt * c.userData.dreh;
      }
      if (this.auge) this.auge.material.opacity = 0.25 + Math.max(0, Math.sin(this.zeit * 0.6)) * 0.5;
      // Gerade gebaut: kurz hüpfen
      if (this.huepf) {
        this.huepf.t += dt;
        const t = this.huepf.t;
        this.huepf.g.scale.setScalar(1 + Math.sin(Math.min(1, t * 2) * Math.PI) * 0.18);
        if (t > 0.5) { this.huepf.g.scale.setScalar(1); this.huepf = null; }
      }
      // Bewohner watscheln zwischen Plätzen hin und her
      for (const b of this.bewohner) {
        if (b.warte > 0) { b.warte -= dt; continue; }
        if (!b.ziel) { const w = Math.random() * Math.PI * 2, d = 30 + Math.random() * 170; b.ziel = [Math.cos(w) * d, Math.sin(w) * d]; }
        const dx = b.ziel[0] - b.g.position.x, dz = b.ziel[1] - b.g.position.z, l = Math.hypot(dx, dz);
        if (l < 4) { b.ziel = null; b.warte = 1 + Math.random() * 4; b.g.position.y = 12; continue; }
        b.g.position.x += dx / l * b.tempo * dt; b.g.position.z += dz / l * b.tempo * dt;
        b.g.rotation.y = -Math.atan2(dz, dx);
        b.ph += dt * 9;
        b.g.position.y = 12 + Math.abs(Math.sin(b.ph)) * 2.5;
        b.g.rotation.z = Math.sin(b.ph) * 0.12;
      }
      // Funken beim Bauen, Rauch aus der Räucherei, Schneefall
      for (const p of this.funken) { p.t += dt; p.vy -= 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
      this.funken = this.funken.filter(p => p.t < 1.2);
      if (!this.funkPunkte) {
        this.funkPunkte = new T.Points(new T.BufferGeometry(), new T.PointsMaterial({ color:0xffd54a, size:6, transparent:true, depthWrite:false, blending:T.AdditiveBlending }));
        this.scene.add(this.funkPunkte);
      }
      const fp = new Float32Array(this.funken.length * 3);
      this.funken.forEach((p, i) => { fp[i * 3] = p.x; fp[i * 3 + 1] = p.y; fp[i * 3 + 2] = p.z; });
      this.funkPunkte.geometry.setAttribute('position', new T.BufferAttribute(fp, 3));
      if (!this.rauchPunkte) {
        this.rauchPunkte = new T.Points(new T.BufferGeometry(), new T.PointsMaterial({ color:0xb8c0c8, size:18, transparent:true, opacity:0.35, depthWrite:false }));
        this.scene.add(this.rauchPunkte);
      }
      const rp = new Float32Array(this.rauch.length * 6 * 3);
      this.rauch.forEach((r, i) => {
        for (let k = 0; k < 6; k++) {
          const t = (this.zeit * 0.25 + r.t + k / 6) % 1;
          rp[(i * 6 + k) * 3] = r.x + Math.sin(t * 6 + k) * 6; rp[(i * 6 + k) * 3 + 1] = r.y + t * 90; rp[(i * 6 + k) * 3 + 2] = r.z - t * 20;
        }
      });
      this.rauchPunkte.geometry.setAttribute('position', new T.BufferAttribute(rp, 3));
      const sp = this.schnee.geometry.attributes.position;
      for (let i = 0; i < sp.count; i++) {
        let y = sp.getY(i) - dt * 22;
        if (y < 0) y += 500;
        sp.setY(i, y);
        sp.setX(i, sp.getX(i) + Math.sin(this.zeit + i) * dt * 4);
      }
      sp.needsUpdate = true;
      this.renderer.render(this.scene, k);
    }
  }
  PT.DorfWelt = DorfWelt;
})();
