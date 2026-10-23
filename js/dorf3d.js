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
    wachturm:[-205, -70], denkmal:[60, 95], akademie:[175, -55], leuchtfeuer:[-30, 205],
    kristallgarten:[-175, 155], orkabucht:[235, -130], werft:[-30, -230], novafeuer:[110, 185]
  };
  // Nachthimmel je Phase; tagsüber wird er heller (Tag-Nacht-Wechsel in bild)
  const HIMMEL = [0x050a18, 0x0b1630, 0x101c3a, 0x14224a, 0x2a2f5a, 0x241f4e, 0x2e2240];
  const TAG = [0x6a8ab0, 0x7fa6cc, 0x8fb6dc, 0x9fc4e6, 0xa8cdee, 0xc8d4f0, 0xf0d8b0];
  const TAGESLAENGE = 180;   // Sekunden für einen ganzen Tag im Dorf

  class DorfWelt {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new T.WebGLRenderer({ canvas, antialias:true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.scene = new T.Scene();
      this.kamera = new T.PerspectiveCamera(40, 2, 10, 4000);
      this.winkel = 0.6; this.abstand = 620; this.hoehe = 0.62;
      this.zeit = 0; this.laeuft = false; this.letzte = 0;
      this.gebaeude = {}; this.bewohner = []; this.funken = []; this.rauch = []; this.schwimmer = []; this.figuren = [];
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
      else if (id === 'kristallgarten') {
        if (!stufe) oben = this.haus(g, 0, phase, 0);
        else {
          const n = 4 + stufe * 2;
          for (let i = 0; i < n; i++) {
            const w = i / n * Math.PI * 2 + i, d = 10 + (i % 3) * 12, h = 16 + stufe * 4 + (i % 4) * 7;
            const k = mesh(G.okta, mat(i % 3 ? 0xd8b0ff : 0xfff2c4, 'phong', { flatShading:true, shininess:150, emissive:i % 3 ? 0x3a1a6a : 0x5a4a10, transparent:true, opacity:0.92 }), Math.cos(w) * d, h * 0.5, Math.sin(w) * d);
            k.scale.set(5, h * 0.55, 5); k.rotation.set(Math.cos(w) * 0.3, w, Math.sin(w) * 0.3); g.add(k);
          }
          const beet = mesh(new T.CylinderGeometry(40, 42, 4, 16), mat(0x8a7aa8, 'lambert'), 0, 1, 0); g.add(beet);
          const l = new T.PointLight(0xd8b0ff, 0.5 + stufe * 0.12, 220, 1.8); l.position.y = 40; g.add(l);
          oben = 40 + stufe * 6;
        }
      } else if (id === 'orkabucht') {
        if (!stufe) oben = this.haus(g, 0, phase, 0);
        else {
          const steg = mesh(G.box, mat(0x8b5a2b), 40, 2, 0); steg.scale.set(80, 4, 14); g.add(steg);
          for (let i = 0; i < 4; i++) { const p = mesh(G.zyl, mat(0x6b4a2a), 10 + i * 20, -8, 9); p.scale.set(2, 26, 2); g.add(p); }
          const schild = mesh(G.box, mat(0x2a3140), 0, 22, 0); schild.scale.set(2, 16, 26); g.add(schild);
          const fisch = mesh(G.kugel, mat(0xf4f6fa), 0, 22, 1.5); fisch.scale.set(1, 6, 10); g.add(fisch);
          oben = 40;
          // Kaiser Orka zieht draußen seine Kreise, ab Stufe 2 mit Haien
          const orka = new T.Mesh(PT.M3.fischGeo('orka'), new T.MeshPhongMaterial({ vertexColors:true, shininess:60 }));
          orka.scale.setScalar(0.55); this.scene.add(orka);
          this.schwimmer.push({ m:orka, r:360, w:0.6, tempo:0.12, h:-10 });
          for (let i = 1; i < stufe; i++) for (let k = 0; k < 2; k++) {
            const flosse = mesh(G.kegel, mat(0x3a5878), 0, 0, 0); flosse.scale.set(6, 16, 2); this.scene.add(flosse);
            this.schwimmer.push({ m:flosse, r:330 + k * 50, w:i * 2 + k * 3, tempo:0.2 + k * 0.05, h:-6, flosse:true });
          }
        }
      } else if (id === 'werft') {
        if (!stufe) oben = this.haus(g, 0, phase, 0);
        else {
          for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const b = mesh(G.zyl, mat(0x6b4a2a), -30 + i * 30, 10, s * 22); b.scale.set(1.6, 24, 1.6); g.add(b); }
          const rumpf = mesh(G.kugel, mat(stufe >= 4 ? 0x3a4a5a : 0x5a3a2a, 'lambert', { flatShading:stufe < 4 }), 0, 18, 0); rumpf.scale.set(52, 14, 18); g.add(rumpf);
          const deck = mesh(G.box, mat(0x8a6a4a), 0, 26, 0); deck.scale.set(86, 3, 26); g.add(deck);
          for (let i = 0; i < Math.min(3, 1 + Math.floor(stufe / 2)); i++) {
            const mast = mesh(G.zyl, mat(0x4a3020), -24 + i * 24, 56, 0); mast.scale.set(1.8, 60, 1.8); g.add(mast);
            if (stufe >= 3) { const segel = mesh(G.box, mat(0xeef4f8), -24 + i * 24 + 2, 60, 0); segel.scale.set(1, 34, 22); g.add(segel); }
          }
          if (stufe >= 5) { const fahne = mesh(G.box, mat(0x9fe8ff, 'basic'), -24, 92, 6); fahne.scale.set(1, 8, 14); fahne.userData.flattern = 1; g.add(fahne); }
          oben = 100;
        }
      } else if (id === 'novafeuer') {
        if (!stufe) oben = this.haus(g, 0, phase, 0);
        else {
          const sockel = mesh(new T.CylinderGeometry(20, 24, 14, 8), mat(0x2a3140, 'phong', { flatShading:true }), 0, 7, 0); g.add(sockel);
          const nova = PT.M3.pinguinFigur('hueterin');
          nova.traverse(o => { if (o.isMesh) o.material = mat(0xfff2c4, 'phong', { emissive:0x6a4a10, shininess:140, transparent:true, opacity:0.92 }); });
          nova.scale.setScalar(0.9); nova.position.y = 14; nova.rotation.y = Math.PI; g.add(nova);
          const flamme = mesh(G.kegel, mat(0xffd27a, 'basic', { transparent:true, opacity:0.9 }), 0, 68, 0); flamme.scale.set(6, 14, 6); flamme.userData.flamme = true; g.add(flamme);
          const l = new T.PointLight(0xffd27a, 1.1, 320, 1.6); l.position.y = 70; g.add(l);
          oben = 90;
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
    // Stadt des Lichts: Laternen um den Platz, schwebende Kristalle; Novas Stadt: goldenes Leuchten unter der Scholle
    lichtBauen(phase) {
      if (this.lichtGruppe) this.scene.remove(this.lichtGruppe);
      const g = this.lichtGruppe = new T.Group();
      this.laternen = []; this.schwebend = []; this.tiefenLicht = null;
      if (phase >= 5) {
        for (let i = 0; i < 12; i++) {
          const w = i / 12 * Math.PI * 2 + 0.13;
          const p = mesh(G.zyl, mat(0x3a3f48), Math.cos(w) * 104, 26, Math.sin(w) * 104); p.scale.set(1.4, 30, 1.4); g.add(p);
          const l = mesh(G.kugelGrob, mat(0xffd27a, 'basic', { transparent:true, opacity:0.9 }), Math.cos(w) * 104, 43, Math.sin(w) * 104); l.scale.set(4, 5, 4); g.add(l);
          this.laternen.push(l);
        }
        for (let i = 0; i < 8; i++) {
          const w = i / 8 * Math.PI * 2, k = mesh(G.okta, mat(i % 2 ? 0xd8b0ff : 0xfff2c4, 'basic', { transparent:true, opacity:0.8 }), Math.cos(w) * 190, 90, Math.sin(w) * 190);
          k.scale.set(4, 9, 4); g.add(k); this.schwebend.push({ m:k, w, y:90 + (i % 3) * 20 });
        }
      }
      if (phase >= 6) {
        // weiches goldenes Leuchten im Wasser rund um die Scholle (Verlauf nach außen)
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const x = c.getContext('2d'), v = x.createRadialGradient(64, 64, 20, 64, 64, 64);
        v.addColorStop(0, 'rgba(255,210,110,1)'); v.addColorStop(0.55, 'rgba(255,190,80,0.55)'); v.addColorStop(1, 'rgba(255,170,60,0)');
        x.fillStyle = v; x.fillRect(0, 0, 128, 128);
        const glut = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshBasicMaterial({ map:new T.CanvasTexture(c), transparent:true, opacity:0.5, depthWrite:false, blending:T.AdditiveBlending }));
        glut.rotation.x = -Math.PI / 2; glut.position.y = -13; g.add(glut);
        this.tiefenLicht = glut;
        const l = new T.PointLight(0xffc84a, 0.9, 900, 1.2); l.position.set(0, -60, 0); g.add(l);
      }
      this.scene.add(g);
    }
    // Bekannte Gesichter: Mia am Feuer, Kiko am Wachturm, Frost an der Werft
    figurenBauen(phase, dorf) {
      if (this.figuren) for (const f of this.figuren) this.scene.remove(f);
      this.figuren = [];
      const setze = (skin, x, z, blick) => {
        const f = PT.M3.pinguinFigur(skin); f.scale.setScalar(0.62); f.position.set(x, 12, z); f.rotation.y = blick;
        f.userData.basisY = 12; this.scene.add(f); this.figuren.push(f);
      };
      if (phase >= 1) setze(phase >= 5 ? 'kommandantin' : 'kueken', 34, 18, Math.PI * 0.8);
      if (phase >= 1) setze('bergsteiger', -170, -40, 0.4);
      if (PT.dorfStufe(dorf, 'werft')) setze('kapitaen', -30, -180, Math.PI / 2);
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
    // Deko aus dem Pinguin-Pass: Lichterkette, Fahnen, Eisskulptur, Statue, goldenes Iglu, Nordlichter, Feuerwerk
    dekoBauen(deko) {
      if (this.dekoGruppe) this.scene.remove(this.dekoGruppe);
      const g = this.dekoGruppe = new T.Group();
      this.lampen = []; this.nordlicht = []; this.feuerwerk = !!deko.feuerwerk;
      if (deko.lichterkette) for (let i = 0; i < 48; i++) {
        const w = i / 48 * Math.PI * 2;
        const l = mesh(G.kugelMini, mat([0xff5e5e, 0xffd54a, 0x5ec8ff, 0x7dffb2][i % 4], 'basic'), Math.cos(w) * 120, 34 + Math.sin(i * 1.7) * 3, Math.sin(w) * 120);
        l.scale.setScalar(2.6); g.add(l); this.lampen.push(l);
      }
      if (deko.lichterkette) for (let i = 0; i < 8; i++) { const w = i / 8 * Math.PI * 2; const p = mesh(G.zyl, mat(0x6b4a2a), Math.cos(w) * 120, 22, Math.sin(w) * 120); p.scale.set(1.2, 24, 1.2); g.add(p); }
      if (deko.fahnen) for (let i = 0; i < 6; i++) {
        const w = i / 6 * Math.PI * 2 + 0.3;
        const st = mesh(G.zyl, mat(0xdfe6ee), Math.cos(w) * 100, 36, Math.sin(w) * 100); st.scale.set(1, 50, 1); g.add(st);
        const fa = mesh(G.box, mat([0xe2463b, 0x2f7fe0, 0xf6c343][i % 3]), Math.cos(w) * 100, 54, Math.sin(w) * 100 + 9); fa.scale.set(1, 12, 18); fa.userData.flattern = i; g.add(fa);
      }
      if (deko.eisskulptur) {
        const f = mesh(G.kugel, mat(0xcfefff, 'phong', { shininess:150, transparent:true, opacity:0.85, emissive:0x1a4a6a }), -60, 40, -40); f.scale.set(22, 12, 10); g.add(f);
        const sw = mesh(G.kegel, mat(0xcfefff, 'phong', { transparent:true, opacity:0.85 }), -86, 46, -40); sw.scale.set(10, 14, 3); sw.rotation.z = Math.PI / 2; g.add(sw);
        const so = mesh(new T.CylinderGeometry(14, 18, 20, 8), mat(0xa8c8dc, 'phong', { flatShading:true }), -60, 20, -40); g.add(so);
      }
      if (deko.goldstatue) {
        const fig = new T.Group(); pinguinKoerper(fig, null, 1.3, 0xc9a020);
        fig.traverse(o => { if (o.isMesh) o.material = mat(0xffd54a, 'phong', { shininess:160, specular:0xffffff, emissive:0x3a2a00 }); });
        fig.position.set(-55, 30, 45); fig.rotation.y = -0.6; g.add(fig);
        const so = mesh(new T.CylinderGeometry(18, 22, 18, 8), mat(0x8a8f99, 'phong', { flatShading:true }), -55, 21, 45); g.add(so);
      }
      if (deko.goldiglu) {
        const i = mesh(G.halbkugel, mat(0xffd54a, 'phong', { shininess:160, specular:0xffffff, emissive:0x2a1a00 }), 10, 12, -215); i.scale.set(34, 30, 34); g.add(i);
        const t = mesh(G.zyl, mat(0xffe9a8), 10, 16, -180); t.scale.set(10, 14, 10); t.rotation.x = Math.PI / 2; g.add(t);
      }
      if (deko.nordlichter) for (const [farbe, z] of [[0x3cff9a, -500], [0x9a6bff, -560], [0x3cc8ff, -620]]) {
        const n = new T.Mesh(new T.PlaneGeometry(1400, 160, 24, 1), new T.MeshBasicMaterial({ color:farbe, transparent:true, opacity:0.18, side:T.DoubleSide, depthWrite:false, blending:T.AdditiveBlending }));
        n.position.set(0, 330, z); n.basis = n.geometry.attributes.position.array.slice(); g.add(n); this.nordlicht.push(n);
      }
      this.scene.add(g);
    }
    zeigen(dorf, phase, auswahl, deko = {}) {
      const dsig = JSON.stringify(deko);
      if (dsig !== this.dekoSig) { this.dekoSig = dsig; this.dekoBauen(deko); }
      const sig = JSON.stringify([dorf.stufen, phase]);
      if (sig !== this.sig) {
        this.sig = sig;
        this.rauch = [];
        if (this.auge) { this.scene.remove(this.auge); this.auge = null; }
        for (const s of this.schwimmer || []) this.scene.remove(s.m);
        this.schwimmer = [];
        this.lichtBauen(phase);
        this.phase = phase;
        for (const id of PT.DORF_REIHE) this.gebaeudeBauen(id, PT.dorfStufe(dorf, id), phase);
        this.mauerBauen(phase);

        this.feuer.visible = phase > 0;
      }
      const fsig = JSON.stringify([phase, PT.dorfStufe(dorf, 'werft') > 0]);
      if (fsig !== this.fsig) { this.fsig = fsig; this.figurenBauen(phase, dorf); }
      const n = phase ? Math.min(50, 3 + Math.floor(dorf.bewohner / 3)) : 0;
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
      // Tag und Nacht: nachts leuchten Feuer und Laternen, tagsüber ist der Himmel hell
      const ph = this.phase || 0, tag = 0.5 + 0.5 * Math.sin(this.zeit / TAGESLAENGE * Math.PI * 2 - 0.6), nacht = 1 - tag;
      const himmel = new T.Color(HIMMEL[ph]).lerp(new T.Color(TAG[ph]), tag * 0.85);
      this.scene.background = himmel; this.scene.fog.color.copy(himmel);
      this.halb.intensity = 0.45 + tag * 0.6; this.mond.intensity = 0.35 + tag * 0.7;
      this.meer.material.color.set(0x0a2142).lerp(new T.Color(ph >= 6 ? 0x3a7ab0 : 0x2a6aa0), tag * 0.8);
      this.mond.color.set(tag > 0.5 ? 0xfff2dc : 0xc9d8ff);
      for (const [i, l] of (this.laternen || []).entries()) { l.material.opacity = 0.25 + nacht * 0.75; l.scale.setScalar(3.5 + nacht * 1.5 + Math.sin(this.zeit * 4 + i) * 0.3 * nacht); }
      for (const s of this.schwebend || []) { s.m.position.y = s.y + Math.sin(this.zeit * 0.8 + s.w * 3) * 8; s.m.rotation.y += dt * 0.6; }
      if (this.tiefenLicht) this.tiefenLicht.material.opacity = 0.3 + nacht * 0.4 + Math.sin(this.zeit * 0.9) * 0.08;
      for (const s of this.schwimmer || []) {
        const w = s.w + this.zeit * s.tempo;
        s.m.position.set(Math.cos(w) * s.r, s.h + Math.sin(this.zeit * 1.2 + s.w) * 2, Math.sin(w) * s.r);
        s.m.rotation.y = -w - Math.PI / 2 + (s.flosse ? 0 : Math.PI);
      }
      for (const [i, f] of (this.figuren || []).entries()) { f.position.y = f.userData.basisY + Math.abs(Math.sin(this.zeit * 1.5 + i)) * 1.2; f.rotation.z = Math.sin(this.zeit * 1.5 + i) * 0.05; }
      // Feuer flackert
      const f = 1 + Math.sin(this.zeit * 13) * 0.08 + Math.sin(this.zeit * 7.3) * 0.06;
      this.flamme.scale.set(9 * f, 22 * (2 - f), 9 * f);
      this.feuerLicht.intensity = (0.7 + nacht * 0.9) + Math.sin(this.zeit * 11) * 0.25;
      this.auswahlRing.rotation.z += dt;
      // Boote schaukeln, Leuchtfeuer dreht
      for (const g of Object.values(this.gebaeude)) if (g) for (const c of g.children) {
        if (c.userData.schaukeln != null) c.rotation.x = Math.sin(this.zeit * 1.3 + c.userData.schaukeln) * 0.08;
        if (c.userData.dreh) c.rotation.y += dt * c.userData.dreh;
        if (c.userData.flamme) c.scale.set(6 + Math.sin(this.zeit * 9) * 0.6, 14 + Math.sin(this.zeit * 7) * 1.5, 6);
        if (c.userData.flattern) c.rotation.y = Math.sin(this.zeit * 3) * 0.3;
      }
      for (const [i, l] of (this.lampen || []).entries()) l.visible = Math.sin(this.zeit * 3 + i * 1.3) > -0.6;
      if (this.dekoGruppe) for (const c of this.dekoGruppe.children) if (c.userData.flattern != null) c.rotation.y = Math.sin(this.zeit * 3 + c.userData.flattern) * 0.3;
      for (const [k, n] of (this.nordlicht || []).entries()) {
        const p = n.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, n.basis[i * 3 + 1] + Math.sin(this.zeit * 0.6 + n.basis[i * 3] * 0.006 + k) * 40);
        p.needsUpdate = true;
      }
      if (this.feuerwerk && Math.random() < 0.02) {
        const x = (Math.random() - 0.5) * 400, z = (Math.random() - 0.5) * 400, y = 220 + Math.random() * 100;
        for (let i = 0; i < 40; i++) { const w = Math.random() * Math.PI * 2, h = Math.random() - 0.5; this.funken.push({ x, y, z, vx:Math.cos(w) * 140 * Math.cos(h), vy:Math.sin(h) * 140 + 40, vz:Math.sin(w) * 140 * Math.cos(h), t:0 }); }
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
