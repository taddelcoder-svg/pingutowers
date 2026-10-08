'use strict';
// Pingu Towers – 3D-Darstellung mit three.js (r128). Schräge Kamera von oben wie im Vorbild,
// Eiskanäle mit fließendem Wasser, Pinguine aus Grundformen (modelle.js), Fische als Instanzen
// (wenige Draw-Calls, Schwanzschlag im Shader). Die Logik rechnet auf der Ebene: x → three.x, y → three.z.
(function () {
  const PT = window.PT;
  const T = window.THREE;
  const { G, mat, mesh, fischGeo, pinguinBauen, pinguinKoerper, albatros, geschossArten, haufenGeo } = PT.M3;
  const W = PT.BREITE, H = PT.HOEHE;
  const X = x => x - W / 2, Z = y => y - H / 2;
  const WASSER_Y = 3.5;
  const FLUGHOEHE = 78;

  /* ---------- Themen und Boden ---------- */
  const THEMEN = {
    tag:        { himmel:0xcfe9f7, boden:['#d9eaf3', '#bcd6e6'], licht:0.8, halb:0.5, nebel:0xcfe9f7, fluss:0x4cc3f0, schnee:0.4, meer:0x1c5d8c },
    daemmerung: { himmel:0xf2c9c0, boden:['#eedde3', '#cdc4e2'], licht:0.8, halb:0.5, nebel:0xe7d2dc, fluss:0x55b6e6, schnee:0.6, meer:0x3b5d8f },
    nacht:      { himmel:0x0b1630, boden:['#b8c9e2', '#8ea3c6'], licht:0.55, halb:0.55, nebel:0x0e1c3a, fluss:0x3a9fd6, schnee:0.8, meer:0x0a1d3a },
    vulkan:     { himmel:0x2a1a1c, boden:['#857e8a', '#5f5866'], licht:0.75, halb:0.45, nebel:0x2a1a1c, fluss:0x3fb0e0, schnee:0.25, meer:0x16202e, lava:true }
  };

  function bodenTextur(karte, wege, thema) {
    const S = 2;
    const c = document.createElement('canvas');
    c.width = W * S; c.height = H * S;
    const x = c.getContext('2d');
    x.scale(S, S);
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, thema.boden[0]); gr.addColorStop(1, thema.boden[1]);
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // Eisplatten (bzw. Gesteinsplatten am Vulkan) und Schneewehen
    for (let i = 0; i < 26; i++) {
      const px = rnd() * W, py = rnd() * H, r = 30 + rnd() * 70;
      x.fillStyle = thema.lava ? `rgba(40,35,45,${0.15 + rnd() * 0.15})` : `rgba(160,205,230,${0.12 + rnd() * 0.12})`;
      x.beginPath();
      for (let k = 0; k < 7; k++) { const w = k / 7 * Math.PI * 2; const rr = r * (0.7 + rnd() * 0.4); x.lineTo(px + Math.cos(w) * rr, py + Math.sin(w) * rr * 0.7); }
      x.closePath(); x.fill();
      x.strokeStyle = thema.lava ? 'rgba(30,25,30,0.4)' : 'rgba(255,255,255,0.6)'; x.lineWidth = 1.2; x.stroke();
    }
    for (let i = 0; i < (thema.lava ? 30 : 40); i++) {
      const px = rnd() * W, py = rnd() * H, r = 20 + rnd() * 50;
      const rg = x.createRadialGradient(px, py, 0, px, py, r);
      rg.addColorStop(0, `rgba(255,255,255,${thema.lava ? 0.85 : 0.7})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = rg; x.beginPath(); x.ellipse(px, py, r, r * 0.6, rnd() * 3, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = thema.lava ? 'rgba(20,15,20,0.5)' : 'rgba(120,170,200,0.35)'; x.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      let px = rnd() * W, py = rnd() * H;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 5; k++) { px += (rnd() - 0.5) * 50; py += (rnd() - 0.5) * 50; x.lineTo(px, py); }
      x.stroke();
    }
    for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(255,255,255,${rnd() * 0.5})`; x.fillRect(rnd() * W, rnd() * H, 1.2, 1.2); }
    // Schatten und Grund unter den Kanälen
    x.lineJoin = x.lineCap = 'round';
    const linie = (breite, farbe) => {
      for (const w of wege) {
        x.strokeStyle = farbe; x.lineWidth = breite; x.beginPath();
        w.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke();
      }
    };
    linie(PT.WEG_BREITE + 44, thema.lava ? 'rgba(30,20,25,0.25)' : 'rgba(90,140,180,0.18)');
    linie(PT.WEG_BREITE + 2, '#3a8fc0');
    for (const [wx, wy, wr] of karte.wasser || []) {
      x.fillStyle = 'rgba(90,140,180,0.22)'; x.beginPath(); x.arc(wx, wy, wr + 14, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#2f7fb0'; x.beginPath(); x.arc(wx, wy, wr, 0, Math.PI * 2); x.fill();
    }
    for (const w of wege) {
      for (const [ok, i] of [[w.lochEnde, w.pts.length - 1], [w.lochAnfang, 0]]) {
        if (!ok) continue;
        const [px, py] = w.pts[i];
        x.fillStyle = '#0d2c45'; x.beginPath(); x.arc(px, py, 34, 0, Math.PI * 2); x.fill();
      }
    }
    for (const [hx, hy, hr] of karte.hindernisse) {
      const rg = x.createRadialGradient(hx + 6, hy + 6, hr * 0.5, hx + 6, hy + 6, hr * 1.4);
      rg.addColorStop(0, 'rgba(40,60,90,0.3)'); rg.addColorStop(1, 'rgba(40,60,90,0)');
      x.fillStyle = rg; x.beginPath(); x.arc(hx + 6, hy + 6, hr * 1.4, 0, Math.PI * 2); x.fill();
    }
    const tex = new T.CanvasTexture(c);
    tex.anisotropy = 4;
    // Vulkan: glühende Lavaspalten als Leuchttextur
    let glut = null;
    if (thema.lava) {
      const l = document.createElement('canvas');
      l.width = W; l.height = H;
      const y = l.getContext('2d');
      y.fillStyle = '#000'; y.fillRect(0, 0, W, H);
      y.lineCap = 'round';
      for (let i = 0; i < 22; i++) {
        let px = rnd() * W, py = rnd() * H;
        const pfad = [[px, py]];
        for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * 70; py += (rnd() - 0.5) * 70; pfad.push([px, py]); }
        for (const [b, f] of [[7, 'rgba(255,90,20,0.35)'], [2.5, '#ffb020']]) {
          y.strokeStyle = f; y.lineWidth = b; y.beginPath();
          pfad.forEach(([a, c2], k) => (k ? y.lineTo(a, c2) : y.moveTo(a, c2))); y.stroke();
        }
      }
      // keine Glut im Wasser
      y.strokeStyle = '#000'; y.lineWidth = PT.WEG_BREITE + 30; y.lineJoin = 'round';
      for (const w of wege) { y.beginPath(); w.pts.forEach(([px, py], i) => (i ? y.lineTo(px, py) : y.moveTo(px, py))); y.stroke(); }
      glut = new T.CanvasTexture(l);
    }
    return { tex, glut };
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
  function strudelTextur() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, '#04121f'); gr.addColorStop(0.6, '#1d5f8f'); gr.addColorStop(1, '#4cc3f0');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 3;
    for (let a = 0; a < 4; a++) {
      x.beginPath();
      for (let t = 0; t < 1; t += 0.02) { const r = 60 * (1 - t), w = a * Math.PI / 2 + t * 7; x.lineTo(64 + Math.cos(w) * r, 64 + Math.sin(w) * r); }
      x.stroke();
    }
    return new T.CanvasTexture(c);
  }

  // Band entlang eines Wegs: profil = [[Abstand zur Mitte, Höhe], …], nur der Teil auf der Karte
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
      this.zeitUniform = { value:0 };
      this.pinguine = new Map();
      this.flieger = new Map();
      this.eulen = new Map();
      this.effekte = [];
      this.texte = [];
      this.blitz = 0;
      this.flash = null;
      this.wackeln = 0;
      this.zoom = 1;
      this.schwenk = new T.Vector2(0, 0);
      this.kartenMitte = new T.Vector3(0, 0, 18);
      this.basisAbstand = 1200;
      this.rauch = []; this.lichter = []; this.strudel = [];
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

    // Fischmaterial mit Schwanzschlag: der hintere Teil schwingt seitlich, je Fisch versetzt
    wackelMaterial(material, laenge, tempo) {
      const zeit = this.zeitUniform;
      material.onBeforeCompile = sh => {
        sh.uniforms.uZeit = zeit;
        sh.uniforms.uLaenge = { value:laenge };
        sh.uniforms.uTempo = { value:tempo };
        sh.vertexShader = 'uniform float uZeit;\nuniform float uLaenge;\nuniform float uTempo;\nattribute float aWag;\n' +
          sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
            float hinten = clamp(-transformed.x / uLaenge, 0.0, 2.4);
            float ph = instanceMatrix[3].x * 0.071 + instanceMatrix[3].z * 0.053;
            transformed.z += sin(uZeit * uTempo + ph - hinten * 1.6) * hinten * hinten * uLaenge * 0.17 * aWag;`);
      };
      return material;
    }

    karteLaden(spiel) {
      this.scene = new T.Scene();
      this.pinguine.clear(); this.flieger.clear(); this.eulen.clear();
      this.strudel = []; this.lavaLicht = null; this.rauch = [];
      this.effekte = [];
      this.texte = [];
      this.zoom = 1; this.schwenk.set(0, 0);
      const karte = spiel.kartenDaten;
      const thema = THEMEN[karte.thema] || THEMEN.tag;
      this.thema = thema;
      const sc = this.scene;
      sc.background = new T.Color(thema.himmel);
      sc.fog = new T.Fog(thema.nebel, 1500, 3400);

      sc.add(new T.HemisphereLight(0xeaf6ff, 0x7f9fb8, thema.halb));
      const sonne = new T.DirectionalLight(karte.thema === 'daemmerung' ? 0xffd9c2 : thema.lava ? 0xffe2cc : 0xffffff, thema.licht);
      sonne.position.set(-350, 800, 380);
      sonne.castShadow = true;
      sonne.shadow.mapSize.set(2048, 2048);
      Object.assign(sonne.shadow.camera, { left:-620, right:620, top:420, bottom:-420, near:100, far:2200 });
      sonne.shadow.bias = -0.0008;
      sc.add(sonne);

      // Boden der Scholle
      const { tex, glut } = bodenTextur(karte, spiel.wege, thema);
      this.bodenMat = new T.MeshLambertMaterial({ map:tex, emissive:glut ? 0xffffff : 0x000000, emissiveMap:glut });
      const boden = new T.Mesh(new T.PlaneGeometry(W, H), this.bodenMat);
      boden.rotation.x = -Math.PI / 2;
      boden.receiveShadow = true;
      sc.add(boden);
      // Drumherum das Polarmeer, die Scholle hat eine Eisklippe
      this.meerTex = wasserTextur();
      this.meerTex.repeat.set(30, 120);
      const aussen = new T.Mesh(new T.PlaneGeometry(8000, 8000), new T.MeshPhongMaterial({ color:thema.meer, map:this.meerTex, shininess:90, specular:0x557799 }));
      aussen.rotation.x = -Math.PI / 2; aussen.position.y = -22; aussen.receiveShadow = true;
      sc.add(aussen);
      const klippe = mat(thema.lava ? 0x4b4552 : 0xcfe8f5, 'phong', { shininess:40 });
      for (const [x, z, sx, sz] of [[0, -H / 2 - 5, W + 10, 10], [0, H / 2 + 5, W + 10, 10], [-W / 2 - 5, 0, 10, H], [W / 2 + 5, 0, 10, H]]) {
        const m = mesh(G.box, klippe, x, -11, z); m.scale.set(sx, 24, sz); m.receiveShadow = true; sc.add(m);
        const kante = mesh(G.box, mat(0xffffff), x, 0.6, z); kante.scale.set(sx + 1, 1.2, sz + 1); sc.add(kante);
      }
      for (let i = 0; i < 14; i++) {
        const w = i / 14 * Math.PI * 2 + 0.3, d = 640 + (i % 3) * 110;
        const e = mesh(new T.CylinderGeometry(1, 1.1, 1, 7), mat(0xeef8fd, 'lambert', { flatShading:true }), Math.cos(w) * d * 1.1, -19, Math.sin(w) * d * 0.8);
        e.scale.set(30 + (i * 17) % 50, 5, 22 + (i * 13) % 40); e.rotation.y = i; sc.add(e);
      }

      // Kanäle: Wasser und Eisufer
      const b = PT.WEG_BREITE / 2;
      this.wasserTex = wasserTextur();
      const wasserMat = new T.MeshPhongMaterial({ color:thema.fluss, map:this.wasserTex, transparent:true, opacity:0.82, shininess:120, specular:0xbfe6ff, emissive:0x0b3a5a });
      const ufer = new T.MeshLambertMaterial({ color:thema.lava ? 0xd9d4dc : 0xeaf6fd });
      for (const w of spiel.wege) {
        const wasser = new T.Mesh(wegBand(w, [[-b - 1, WASSER_Y], [0, WASSER_Y], [b + 1, WASSER_Y]], 120), wasserMat);
        wasser.receiveShadow = true;
        sc.add(wasser);
        for (const s of [-1, 1]) {
          const prof = [[s * (b + 16), 0], [s * (b + 9), 5.5], [s * (b + 3), 6.5], [s * (b - 1), 2]];
          const m = new T.Mesh(wegBand(w, s < 0 ? prof : prof.reverse(), 100), ufer);
          m.receiveShadow = true; m.castShadow = true;
          sc.add(m);
        }
        // Eisbogen an den Kartenrändern, Strudel bei einem Eisloch mitten auf der Karte
        const bogen = (p, farbe) => {
          const m = mesh(new T.TorusGeometry(b + 10, 7, 8, 16, Math.PI), mat(farbe, 'phong', { shininess:60 }), X(p[0]), 0, Z(p[1]));
          m.rotation.y = -p[2] + Math.PI / 2;
          sc.add(m);
        };
        if (!w.lochAnfang) bogen(w.punkt(w.vonDist + 4), 0xbfe6f7);
        if (!w.lochEnde) bogen(w.punkt(w.bisDist - 4), 0xa4d3ee);
        for (const [ok, p] of [[w.lochEnde, w.pts[w.pts.length - 1]], [w.lochAnfang, w.pts[0]]]) {
          if (!ok) continue;
          const s = new T.Mesh(new T.CircleGeometry(32, 40), new T.MeshBasicMaterial({ map:strudelTextur() }));
          s.rotation.x = -Math.PI / 2; s.position.set(X(p[0]), WASSER_Y + 0.4, Z(p[1]));
          sc.add(s); this.strudel.push(s);
          const rand = mesh(G.torus, mat(0xeaf6fd), X(p[0]), 2, Z(p[1])); rand.scale.set(34, 34, 30); rand.rotation.x = Math.PI / 2; sc.add(rand);
        }
      }
      // Wasserlöcher für Boote
      for (const [wx, wy, wr] of karte.wasser || []) {
        const s = new T.Mesh(new T.CircleGeometry(wr, 40), wasserMat);
        s.rotation.x = -Math.PI / 2; s.position.set(X(wx), WASSER_Y, Z(wy)); s.receiveShadow = true;
        sc.add(s);
        const rand = mesh(G.torus, ufer, X(wx), 2.4, Z(wy)); rand.scale.set(wr + 3, wr + 3, 22); rand.rotation.x = Math.PI / 2; rand.receiveShadow = true;
        sc.add(rand);
      }

      this.dekoBauen(karte, thema);

      // Polarlicht in der Nacht, Glut am Vulkan
      this.lichter = [];
      if (karte.thema === 'nacht') {
        for (const farbe of [0x3cff9a, 0x9a6bff, 0x3cc8ff]) {
          const l = new T.PointLight(farbe, 1.1, 900, 1.4);
          l.position.set(0, 160, 0); l.polar = true;
          sc.add(l); this.lichter.push(l);
        }
      }

      // Schneefall
      const n = Math.round(500 * thema.schnee);
      const sp = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { sp[i * 3] = (Math.random() - 0.5) * 1300; sp[i * 3 + 1] = Math.random() * 500; sp[i * 3 + 2] = (Math.random() - 0.5) * 900; }
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
      this.schnee = new T.Points(sg, new T.PointsMaterial({ color:thema.lava ? 0xbbbbbb : 0xffffff, size:3, transparent:true, opacity:0.85, depthWrite:false }));
      sc.add(this.schnee);

      // Fische als Instanzen mit Schwanzschlag, getarnte Fische halb durchsichtig
      this.fischMeshes = {};
      for (const typ of Object.keys(PT.FISCHE)) {
        const F = PT.FISCHE[typ];
        const max = F.boss ? 4 : F.riese ? 80 : 900;
        const mach = (material) => {
          const geo = this.fischGeos[typ].clone();
          const wag = new T.InstancedBufferAttribute(new Float32Array(max), 1);
          geo.setAttribute('aWag', wag);
          const m = new T.InstancedMesh(geo, this.wackelMaterial(material, F.r, F.riese ? 4 : 11), max);
          m.setColorAt(0, new T.Color(1, 1, 1));   // vor count = 0, sonst ist der Farbpuffer leer
          m.count = 0; m.frustumCulled = false;
          m.wag = wag;
          sc.add(m);
          return m;
        };
        const normal = mach(new T.MeshPhongMaterial({
          vertexColors:true, shininess:typ === 'panzer' ? 110 : 40, specular:typ === 'panzer' ? 0xffffff : 0x333333,
          transparent:typ === 'weiss', opacity:typ === 'weiss' ? 0.82 : 1
        }));
        normal.castShadow = true;
        const camo = mach(new T.MeshLambertMaterial({ vertexColors:true, color:0x9fdc9f, transparent:true, opacity:0.4, depthWrite:false }));
        this.fischMeshes[typ] = { normal, camo, max };
      }
      const markerMesh = (geo, material, max, farbig) => {
        const m = new T.InstancedMesh(geo, material, max);
        if (farbig) m.setColorAt(0, new T.Color(1, 1, 1));   // vor count = 0, sonst ist der Farbpuffer leer
        m.count = 0; m.frustumCulled = false; sc.add(m); return m;
      };
      this.eisBlock = markerMesh(new T.BoxGeometry(1, 1, 1), new T.MeshPhongMaterial({ color:0xbfeaff, transparent:true, opacity:0.45, shininess:120, depthWrite:false }), 900);
      // Nachwachsend: grüne Algen-Sprosse; gepanzert: Metallhelm
      const algen = PT.M3.verschmelzen([[G.kegel, 0x35d05a, PT.M3.matrix(0, 0.5, 0, 0, 0, 0.4, 0.22, 1, 0.22)], [G.kegel, 0x2aa34a, PT.M3.matrix(0, 0.45, 0, 0.5, 0, -0.4, 0.2, 0.9, 0.2)], [G.kugelGrob, 0x7dffb2, PT.M3.matrix(0, 1.05, 0, 0, 0, 0, 0.16, 0.16, 0.16)]]);
      this.algenMesh = markerMesh(algen, new T.MeshLambertMaterial({ vertexColors:true }), 900);
      this.helmMesh = markerMesh(G.halbkugel, new T.MeshPhongMaterial({ color:0x9aa3ad, shininess:120, specular:0xffffff }), 900);

      // Geschosse, Granaten und Stachelhaufen als Instanzen
      this.geschossMeshes = {};
      for (const [k, a] of Object.entries(this.geschossArten)) {
        const m = markerMesh(a.geo, a.mat, 600);
        m.castShadow = true;
        this.geschossMeshes[k] = m;
      }
      this.granatenMesh = markerMesh(G.kugel, new T.MeshPhongMaterial({ color:0x4a5260, shininess:60 }), 200);
      this.granatenMesh.castShadow = true;
      this.haufenMesh = markerMesh(haufenGeo(), new T.MeshPhongMaterial({ vertexColors:true, shininess:90 }), 800, true);

      // Spritzer und Schnee-Teilchen
      this.teilchen = [];
      this.teilchenMesh = new T.InstancedMesh(new T.SphereGeometry(1, 6, 5), new T.MeshBasicMaterial({ color:0xffffff }), 1500);
      this.teilchenMesh.setColorAt(0, new T.Color(1, 1, 1));
      this.teilchenMesh.count = 0; this.teilchenMesh.frustumCulled = false;
      sc.add(this.teilchenMesh);

      // Reichweite, Vorschau und Mörserziel
      this.reichweite = new T.Group();
      const flaeche = new T.Mesh(new T.CircleGeometry(1, 64), new T.MeshBasicMaterial({ color:0x2f7fe0, transparent:true, opacity:0.18, depthWrite:false }));
      const ring = new T.Mesh(new T.RingGeometry(0.975, 1, 64), new T.MeshBasicMaterial({ color:0x13315c, transparent:true, opacity:0.6, depthWrite:false }));
      for (const m of [flaeche, ring]) { m.rotation.x = -Math.PI / 2; m.position.y = 7.5; m.renderOrder = 2; this.reichweite.add(m); }
      this.reichweiteFlaeche = flaeche; this.reichweiteRing = ring;
      this.reichweite.visible = false;
      sc.add(this.reichweite);
      this.zielKreuz = new T.Group();
      const zr = new T.Mesh(new T.RingGeometry(0.9, 1, 48), new T.MeshBasicMaterial({ color:0xe2463b, transparent:true, opacity:0.85, depthWrite:false, side:T.DoubleSide }));
      zr.rotation.x = -Math.PI / 2; this.zielKreuz.add(zr);
      for (const w of [0, Math.PI / 2]) { const s = new T.Mesh(new T.PlaneGeometry(2.2, 0.08), zr.material); s.rotation.set(-Math.PI / 2, 0, w); this.zielKreuz.add(s); }
      this.zielKreuz.position.y = 8; this.zielKreuz.visible = false;
      sc.add(this.zielKreuz);
      this.geist = null; this.geistTyp = null;

      this.kartenMitte = new T.Vector3(0, 0, 18);
      this.groesse();
    }

    // Hindernisse und Dekoration je Karte
    dekoBauen(karte, thema) {
      const sc = this.scene;
      this.rauch = [];
      this.schollen = [];
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
        } else if (i === 0 && karte.deko === 'bucht') {
          // eine kleine Pinguinkolonie schaut zu
          const schnee = mesh(G.halbkugel, mat(0xffffff), 0, 0, 0); schnee.scale.set(hr, hr * 0.3, hr); g.add(schnee);
          for (let k = 0; k < 5; k++) {
            const p = new T.Group();
            const w = k / 5 * Math.PI * 2;
            p.position.set(Math.cos(w) * hr * 0.55, hr * 0.15, Math.sin(w) * hr * 0.55);
            p.scale.setScalar(0.38); p.rotation.y = Math.PI / 2 + k;
            pinguinKoerper(p, null);
            g.add(p);
          }
        } else if (i === 0 && karte.deko === 'vulkan') {
          const kegel = mesh(new T.CylinderGeometry(hr * 0.45, hr, hr * 0.9, 14), mat(0x3d3842, 'lambert', { flatShading:true }), 0, hr * 0.45, 0);
          const lava = mesh(new T.CircleGeometry(hr * 0.4, 20), mat(0xff7a20, 'basic'), 0, hr * 0.91, 0); lava.rotation.x = -Math.PI / 2;
          const schnee = mesh(new T.CylinderGeometry(hr * 0.88, hr * 1.02, hr * 0.12, 14), mat(0xffffff), 0, hr * 0.05, 0);
          g.add(kegel, lava, schnee);
          const l = new T.PointLight(0xff6a20, 1.4, 320, 1.5); l.position.set(0, hr * 1.4, 0); g.add(l);
          this.lavaLicht = l;
          for (let k = 0; k < 8; k++) {
            const r = mesh(G.kugel, new T.MeshLambertMaterial({ color:0x8a8590, transparent:true, opacity:0.5, depthWrite:false }), 0, 0, 0);
            r.castShadow = false;
            this.rauch.push({ m:r, t:k / 8, x:X(hx), y:hr * 0.95, z:Z(hy) });
            sc.add(r);
          }
        } else if (i === 0 && karte.deko === 'hafen') {
          // kleiner Fischerhafen: Holzsteg, Hütte und ein Kutter
          const steg = mesh(G.box, mat(0x8b5a2b), 0, 4, 0); steg.scale.set(hr * 1.8, 4, hr * 0.5); g.add(steg);
          for (const sx of [-0.8, -0.3, 0.2, 0.7]) for (const sz of [-1, 1]) { const pf = mesh(G.zyl, mat(0x6b4423), sx * hr, -2, sz * hr * 0.22); pf.scale.set(2.4, 14, 2.4); g.add(pf); }
          const huette = mesh(G.box, mat(0xe2463b), -hr * 0.55, 16, 0); huette.scale.set(hr * 0.6, 24, hr * 0.5); g.add(huette);
          const dach = mesh(G.kegel4, mat(0x5a3420, 'lambert', { flatShading:true }), -hr * 0.55, 34, 0); dach.scale.set(hr * 0.5, 14, hr * 0.45); dach.rotation.y = Math.PI / 4; g.add(dach);
          const kutter = new T.Group(); kutter.position.set(hr * 0.5, 2, hr * 0.6);
          const rumpf = mesh(G.box, mat(0x2f7fe0), 0, 0, 0); rumpf.scale.set(hr * 0.9, 9, hr * 0.32); kutter.add(rumpf);
          const kabine = mesh(G.box, mat(0xffffff), -4, 9, 0); kabine.scale.set(12, 10, 10); kutter.add(kabine);
          const mast = mesh(G.zyl, mat(0x6b4423), 8, 20, 0); mast.scale.set(1, 30, 1); kutter.add(mast);
          g.add(kutter);
        } else if (karte.deko === 'hafen') {
          // Fischkisten und Fässer am Ufer
          for (let k = 0; k < 4; k++) {
            const kiste = mesh(k % 2 ? G.zyl : G.box, mat(k % 2 ? 0x5a6573 : 0xb07a3c), (k % 2 - 0.5) * hr * 0.6, 5 + (k > 1 ? 10 : 0), (k > 1 ? 0 : (k - 0.5) * hr * 0.5));
            kiste.scale.set(hr * 0.35, 10, hr * 0.35); kiste.rotation.y = k; g.add(kiste);
          }
          const schnee = mesh(G.halbkugel, mat(0xffffff), 0, 0, 0); schnee.scale.set(hr, hr * 0.15, hr); g.add(schnee);
        } else if (karte.deko === 'treibeis') {
          // flache Eisschollen, die leicht schaukeln; auf der ersten sonnt sich eine Robbe
          const scholle = mesh(new T.CylinderGeometry(hr, hr * 0.92, 8, 7), mat(0xf2faff, 'phong', { flatShading:true, shininess:60, specular:0x88bbdd }), 0, 2, 0);
          scholle.rotation.y = i * 1.3; g.add(scholle);
          if (i === 0) {
            const robbe = mesh(G.kugel, mat(0x8a93a3, 'phong', { shininess:40 }), 0, 12, 0); robbe.scale.set(hr * 0.55, hr * 0.22, hr * 0.25); g.add(robbe);
            const kopf = mesh(G.kugel, mat(0x8a93a3), hr * 0.5, 18, 0); kopf.scale.setScalar(hr * 0.18); g.add(kopf);
          } else if (i % 2) {
            const brocken = mesh(new T.DodecahedronGeometry(hr * 0.35, 0), mat(0xdff3ff, 'phong', { flatShading:true }), hr * 0.2, 10, -hr * 0.2); g.add(brocken);
          }
          this.schollen = this.schollen || [];
          this.schollen.push({ g, i });
        } else if (karte.deko === 'vulkan') {
          for (let k = 0; k < 3; k++) {
            const f = mesh(new T.DodecahedronGeometry(hr * (0.55 - k * 0.1), 0), mat(0x2f2a33, 'lambert', { flatShading:true }), (k - 1) * hr * 0.45, hr * 0.25, (k % 2) * hr * 0.3);
            f.rotation.set(k, k * 2, 0); g.add(f);
          }
          const glut = mesh(G.okta, mat(0xff8a2a, 'basic'), hr * 0.2, hr * 0.6, 0); glut.scale.set(3, 6, 3); g.add(glut);
          const kappe = mesh(G.kugel, mat(0xffffff), 0, hr * 0.5, 0); kappe.scale.set(hr * 0.45, hr * 0.1, hr * 0.35); g.add(kappe);
        } else if (karte.deko === 'bucht') {
          const huegel = mesh(G.halbkugel, mat(0xf4fbff, 'phong', { shininess:10 }), 0, 0, 0); huegel.scale.set(hr, hr * 0.55, hr * 0.9); g.add(huegel);
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
        g.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
        sc.add(g);
      });
    }

    /* ---------- Kamera ---------- */
    // Entfernung so wählen, dass die ganze Karte drauf passt; Zoom und Schwenk kommen dazu
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
      this.hoehe = 63 * Math.PI / 180;
      const ziel = this.kartenMitte || new T.Vector3();
      const ecken = [[-W / 2 - 14, -H / 2 - 14], [W / 2 + 14, -H / 2 - 14], [-W / 2 - 14, H / 2 + 14], [W / 2 + 14, H / 2 + 14]].map(([x, z]) => new T.Vector3(x, 0, z));
      let lo = 200, hi = 6000;
      for (let i = 0; i < 28; i++) {
        const d = (lo + hi) / 2;
        k.position.set(ziel.x, ziel.y + Math.sin(this.hoehe) * d, ziel.z + Math.cos(this.hoehe) * d);
        k.lookAt(ziel);
        k.updateMatrixWorld();
        const passt = ecken.every(e => { const p = e.clone().project(k); return Math.abs(p.x) <= 0.99 && Math.abs(p.y) <= 0.97; });
        if (passt) hi = d; else lo = d;
      }
      this.basisAbstand = hi;
      this.kameraSetzen();
    }
    kameraSetzen() {
      const k = this.kamera;
      // Schwenk so begrenzen, dass man nicht von der Karte wegschiebt
      const grenzeX = W / 2 * (1 - 1 / this.zoom), grenzeZ = H / 2 * (1 - 1 / this.zoom);
      this.schwenk.x = Math.max(-grenzeX, Math.min(grenzeX, this.schwenk.x));
      this.schwenk.y = Math.max(-grenzeZ, Math.min(grenzeZ, this.schwenk.y));
      const ziel = new T.Vector3(this.kartenMitte.x + this.schwenk.x, 0, this.kartenMitte.z + this.schwenk.y);
      const d = this.basisAbstand / this.zoom;
      const zittern = this.wackeln > 0 ? this.wackeln * 6 : 0;
      k.position.set(ziel.x + (Math.random() - 0.5) * zittern, Math.sin(this.hoehe) * d, ziel.z + Math.cos(this.hoehe) * d + (Math.random() - 0.5) * zittern);
      k.lookAt(ziel);
      k.updateMatrixWorld();
    }
    // Zoomen zum Punkt unter dem Finger bzw. Mauszeiger
    zoomen(faktor, cx, cy) {
      const alt = this.zoom;
      this.zoom = Math.max(1, Math.min(2.8, this.zoom * faktor));
      if (cx != null && this.zoom !== alt) {
        const p = this.bodenPunkt(cx, cy);
        if (p) {
          const mx = this.kartenMitte.x + this.schwenk.x, mz = this.kartenMitte.z + this.schwenk.y;
          const k = 1 - alt / this.zoom;
          this.schwenk.x += (X(p[0]) - mx) * k;
          this.schwenk.y += (Z(p[1]) - mz) * k;
        }
      }
      this.kameraSetzen();
    }
    schwenken(dx, dy) {
      const s = this.basisAbstand / this.zoom / this.ph * 0.9;
      this.schwenk.x -= dx * s;
      this.schwenk.y -= dy * s / Math.sin(this.hoehe);
      this.kameraSetzen();
    }
    zoomZurueck() { this.zoom = 1; this.schwenk.set(0, 0); this.kameraSetzen(); }

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
    zielZeigen(x, y, r) {
      if (x == null) { this.zielKreuz.visible = false; return; }
      this.zielKreuz.visible = true;
      this.zielKreuz.position.set(X(x), 8, Z(y));
      this.zielKreuz.scale.setScalar(Math.max(20, r));
    }
    geistZeigen(typ, x, y, ok) {
      if (!typ) { if (this.geist) this.geist.visible = false; return; }
      if (this.geistTyp !== typ) {
        if (this.geist) this.scene.remove(this.geist);
        const { g } = pinguinBauen(typ, [0, 0, 0], 1, { skin:this.aussehen({ typ }).skin });
        g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.65; o.castShadow = false; } });
        this.geist = g; this.geistTyp = typ;
        this.scene.add(g);
      }
      this.geist.visible = true;
      this.geist.position.set(X(x), PT.def(typ).wasser ? WASSER_Y - 4 : 0, Z(y));
      this.geist.rotation.y = Math.PI / 2;
      this.geist.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.set(ok ? 0x000000 : 0x661010); });
    }

    /* ---------- Ereignisse aus der Logik ---------- */
    ereignisse(liste) {
      const ringFarben = { ring:0xbfeaff, ringLila:0xb36bff, sonne:0xffb020, frost:0x7fd6ff, frostStark:0x5ec8ff, saeule:0x9ff3ff, netz:0xd9c49a, schall:0xff5ec8, schallGross:0xffd54a };
      const flashFarben = { schneesturm:'#dff6ff', kaelteschock:'#9ff3ff', himmelsfeuer:'#ff9a4a', himmelsblitz:'#7dffb2', bombenteppich:'#ffb37a', knall:'#ffd29a', sabotage:'#b49bff', geldregen:'#ffd54a', stachelsturm:'#dff6ff',
        nordlicht:'#5effc8', orbital:'#fff2a8', party:'#ff5ec8', tanz:'#b36bff', sternschnuppe:'#ffe066', eiszeit:'#bfeaff', anker:'#8a93a3' };
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
          case 'bossBesiegt':
            for (let i = 0; i < 120; i++) this.teilchenDazu(e.x, e.y, 20, i % 2 ? 0xc0392b : 0xffd54a, 3, 260);
            this.texte.push({ x:e.x, y:e.y, h:60, text:`${PT.FISCHE[e.typ] ? PT.FISCHE[e.typ].name : 'Boss'} besiegt!`, farbe:'#ffd54a', t:0, dauer:2.5, gross:30 });
            this.wackeln = 0.8;
            break;
          case 'flutwelle':
            // Kaiser Orka schlägt mit der Flosse: Welle, die Pinguine im Umkreis kurz betäubt
            this.wackeln = 0.6;
            this.effekte.push({ art:'ring', x:e.x, y:e.y, r:e.r, t:0, dauer:0.8, farbe:0x5ec8ff });
            this.effekte.push({ art:'ring', x:e.x, y:e.y, r:e.r * 0.7, t:0, dauer:0.6, farbe:0xdff6ff });
            for (let i = 0; i < 40; i++) { const w = Math.random() * Math.PI * 2, d = Math.random() * e.r; this.teilchenDazu(e.x + Math.cos(w) * d, e.y + Math.sin(w) * d, 6, 0xbfeaff, 2.2, 60); }
            this.texte.push({ x:e.x, y:e.y, h:70, text:'🌊 Flutwelle!', farbe:'#9fe4ff', t:0, dauer:1.6, gross:24 });
            break;
          case 'bossPhase':
            this.wackeln = 0.5;
            this.effekte.push({ art:'ring', x:e.fisch.x, y:e.fisch.y, r:160, t:0, dauer:0.6, farbe:0xc0392b });
            break;
          case 'explosion': {
            const r = Math.max(12, e.r);
            const farbe = e.bild === 'schneeballBlau' ? 0xa8dcff : e.bild === 'rakete' ? 0xffb37a : e.bild === 'mine' ? 0xff6a3a : e.bild === 'rauch' ? 0x9aa3ad : e.bild === 'blitzbombe' ? 0xfff27a : 0xffffff;
            this.effekte.push({ art:'kugel', x:e.x, y:e.y, r, t:0, dauer:0.28, farbe });
            for (let i = 0; i < 6; i++) this.teilchenDazu(e.x, e.y, 10, 0xffffff, 2, r * 3);
            break;
          }
          case 'ring':
            this.effekte.push({ art:'ring', x:e.x, y:e.y, r:e.r, t:0, dauer:e.bild.startsWith('frost') || e.bild === 'netz' ? 0.45 : 0.3, farbe:ringFarben[e.bild] || 0xffffff });
            if (e.bild.startsWith('frost')) for (let i = 0; i < 12; i++) this.teilchenDazu(e.x + (Math.random() - 0.5) * e.r * 1.5, e.y + (Math.random() - 0.5) * e.r * 1.5, 8, 0xe6f8ff, 1.5, 30);
            this.animieren(e.turm, 0.2);
            break;
          case 'strahl':
            this.effekte.push({ art:'strahl', x1:e.x1, y1:e.y1, x2:e.x2, y2:e.y2, t:0, dauer:0.12, farbe:e.bild === 'harpuneGold' ? 0xffd54a : e.bild === 'haft' ? 0xff6a3a : 0xe8f0ff, h1:e.turm && e.turm.eff && e.turm.eff.flieger ? FLUGHOEHE : 22 });
            this.animieren(e.turm, 0.12);
            break;
          case 'blitz':
            this.effekte.push({ art:'blitz', pts:e.pts, t:0, dauer:0.22, farbe:e.bild === 'blitzGross' ? 0x7dffb2 : e.bild === 'blitzAurora' ? 0x5effc8 : 0xc3b0ff });
            this.animieren(e.turm, 0.2);
            break;
          case 'wurf':
            this.animieren(e.turm, 0.18);
            break;
          case 'kiste':
            this.texte.push({ x:e.turm.x, y:e.turm.y, h:50, text:'+' + e.wert, farbe:'#ffd54a', t:0, dauer:1.1 });
            break;
          case 'nachwachsen':
            for (let i = 0; i < 3; i++) this.teilchenDazu(e.x, e.y, 10, 0x35d05a, 1.4, 40);
            break;
          case 'aufstieg':
            for (let i = 0; i < 30; i++) this.teilchenDazu(e.turm.x, e.turm.y, 20, 0xffd54a, 2, 110);
            this.texte.push({ x:e.turm.x, y:e.turm.y, h:70, text:`Stufe ${e.stufe}!`, farbe:'#ffd54a', t:0, dauer:1.8, gross:22 });
            this.pinguinEntfernen(e.turm.id);
            break;
          case 'faehigkeit':
            if (flashFarben[e.id]) this.flash = { farbe:flashFarben[e.id], t:0, dauer:0.6 };
            if (e.turm) { this.effekte.push({ art:'ring', x:e.turm.x, y:e.turm.y, r:70, t:0, dauer:0.5, farbe:0xffd54a }); this.animieren(e.turm, 0.3); }
            if (e.id === 'knall' || e.id === 'bombenteppich') this.wackeln = 0.4;
            break;
          case 'geschossFaehigkeit':
            for (const [x, y] of e.ziele) {
              this.effekte.push({ art:'strahl', x1:e.turm.x, y1:e.turm.y, x2:x, y2:y, t:0, dauer:0.35, farbe:e.id === 'haken' ? 0x8b5a2b : e.id === 'torpedos' ? 0x5ec8ff : 0xff6a3a, h1:60 });
              this.effekte.push({ art:'kugel', x, y, r:45, t:0, dauer:0.4, farbe:e.id === 'torpedos' ? 0x9fe4ff : 0xffb37a });
            }
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
    // Aussehen eines Pinguins: Look (Pingu-Pass) und im Koop die Farbe seines Besitzers. Setzt die Oberfläche.
    aussehen(t) { return this.aussehenFuer ? this.aussehenFuer(t) || {} : {}; }
    // alle Pinguine neu bauen (neuer Look oder Spielstand vom Server übernommen)
    allesNeu() { for (const id of [...this.pinguine.keys(), ...this.flieger.keys(), ...this.eulen.keys()]) this.pinguinEntfernen(id); }
    animieren(turm, d) { const p = turm && this.pinguine.get(turm.id); if (p) p.anim = d; }
    teilchenDazu(x, y, h, farbe, groesse, tempo) {
      if (this.teilchen.length >= 1500) return;
      const w = Math.random() * Math.PI * 2, v = tempo * (0.4 + Math.random() * 0.6);
      this.teilchen.push({ x:X(x), y:h, z:Z(y), vx:Math.cos(w) * v, vy:60 + Math.random() * 90, vz:Math.sin(w) * v, t:0, dauer:0.45 + Math.random() * 0.3, g:groesse, farbe:new T.Color(farbe) });
    }
    pinguinEntfernen(id) {
      for (const karte of [this.pinguine, this.flieger, this.eulen]) {
        const o = karte.get(id);
        if (o) { this.scene.remove(o.g || o); karte.delete(id); }
      }
    }

    /* ---------- Jedes Bild ---------- */
    zeichnen(spiel, dt, auswahl) {
      this.zeit += dt;
      this.zeitUniform.value = this.zeit;
      const sc = this.scene;
      if (this.wasserTex) this.wasserTex.offset.x -= dt * 0.35;
      if (this.strudel) for (const s of this.strudel) s.rotation.z += dt * 1.5;
      if (this.schollen) for (const s of this.schollen) { s.g.rotation.x = Math.sin(this.zeit * 0.9 + s.i) * 0.03; s.g.rotation.z = Math.cos(this.zeit * 0.7 + s.i) * 0.03; }
      if (this.wackeln > 0) { this.wackeln = Math.max(0, this.wackeln - dt); this.kameraSetzen(); }
      if (this.bodenMat && this.thema.lava) this.bodenMat.emissiveIntensity = 0.75 + Math.sin(this.zeit * 1.7) * 0.25;
      if (this.lavaLicht) this.lavaLicht.intensity = 1.2 + Math.sin(this.zeit * 3) * 0.3;
      for (const r of this.rauch) {
        r.t = (r.t + dt * 0.12) % 1;
        r.m.position.set(r.x + Math.sin(r.t * 6) * 8, r.y + r.t * 140, r.z - r.t * 20);
        r.m.scale.setScalar(8 + r.t * 26);
        r.m.material.opacity = 0.5 * (1 - r.t);
      }

      this.pinguineZeichnen(spiel, dt);
      this.fischeZeichnen(spiel);
      this.geschosseZeichnen(spiel);

      // Teilchen
      const m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sk = new T.Vector3();
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
        if (k >= 1) { sc.remove(e.obj); if (e.obj.geometry !== G.kugel) e.obj.geometry.dispose(); e.obj.material.dispose(); return false; }
        if (e.art === 'ring') { e.obj.scale.setScalar(Math.max(1, e.r * (0.3 + 0.7 * k))); e.obj.material.opacity = 0.7 * (1 - k); }
        else if (e.art === 'kugel') { e.obj.scale.setScalar(e.r * (0.4 + 0.6 * Math.sqrt(k))); e.obj.material.opacity = 0.75 * (1 - k); }
        else e.obj.material.opacity = 1 - k;
        return true;
      });

      // Polarlicht und Schnee
      this.lichter.forEach((l, i) => {
        if (!l.polar) return;
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

      // Auswahl: Reichweite, beim Mörser das Ziel
      if (auswahl && auswahl.eff) {
        this.reichweiteZeigen(auswahl.x, auswahl.y, auswahl.eff.reichweite > 5000 ? 0 : auswahl.eff.reichweite, true);
        if (auswahl.zielPunkt && !this.zielModus) this.zielZeigen(auswahl.zielPunkt[0], auswahl.zielPunkt[1], auswahl.eff.angriffe[0].splash);
      }
      this.renderer.render(sc, this.kamera);
      this.overlayZeichnen(spiel, dt);
    }

    pinguineZeichnen(spiel, dt) {
      const sc = this.scene;
      const da = new Set();
      for (const t of spiel.tuerme) {
        da.add(t.id);
        let p = this.pinguine.get(t.id);
        const wasser = PT.def(t.typ).wasser;
        if (!p) {
          p = pinguinBauen(t.typ, t.pfade, t.stufe, this.aussehen(t));
          p.g.position.set(X(t.x), wasser ? WASSER_Y - 4 : 0, Z(t.y));
          p.winkel = -t.winkel; p.anim = 0; p.plopp = 0.25;
          p.innen.rotation.y = p.winkel;
          this.pinguine.set(t.id, p);
          sc.add(p.g);
        }
        const greift = PT.def(t.typ).greift !== false && t.typ !== 'flieger';
        if (greift) {
          let d = -t.winkel - p.winkel;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          p.winkel += d * Math.min(1, dt * 14);
          p.innen.rotation.y = p.winkel;
        } else p.innen.rotation.y = t.typ === 'markt' || t.typ === 'flieger' ? Math.PI / 2 : Math.PI / 2 + Math.sin(this.zeit * 0.8 + t.id) * 0.3;
        if (wasser) { p.g.position.y = WASSER_Y - 4 + Math.sin(this.zeit * 2 + t.id) * 0.8; p.g.rotation.z = Math.sin(this.zeit * 1.6 + t.id) * 0.04; }
        // Wurfbewegung und Aufploppen
        p.anim = Math.max(0, p.anim - dt);
        p.plopp = Math.max(0, p.plopp - dt);
        const a = p.anim > 0 ? Math.sin(p.anim / 0.18 * Math.PI) : 0;
        if (p.teile.fluegelR) p.teile.fluegelR.rotation.x = 0.35 + a * 1.4;
        if (p.teile.fluegelL) p.teile.fluegelL.rotation.x = -0.35 - (t.typ === 'rundum' || t.typ === 'haeuptling' ? a * 1.4 : 0);
        const s = 1 + Math.sin(p.plopp / 0.25 * Math.PI) * 0.25 - a * 0.05;
        const gr = p.teile.groesse;
        p.innen.scale.set(s * gr, (1 + (s - 1) * 1.2 + Math.sin(this.zeit * 3 + t.id) * 0.012) * gr, s * gr);
        if (p.teile.dreher) p.teile.dreher.rotation.y += dt * 1.6;
        if (p.teile.aura) p.teile.aura.rotation.y -= dt * 0.9;
        if (p.teile.orb) p.teile.orb.scale.setScalar((p.teile.orbGroesse || 4) * (1 + Math.sin(this.zeit * 5) * 0.12));
        // Albatros fliegt über die Karte
        if (t.eff && t.eff.flieger) {
          let f = this.flieger.get(t.id);
          if (!f) { f = albatros(t.pfade, this.aussehen(t).skin); this.flieger.set(t.id, f); sc.add(f); f.letzterWinkel = t.fw; }
          let dw = t.fw - f.letzterWinkel;
          while (dw > Math.PI) dw -= Math.PI * 2;
          while (dw < -Math.PI) dw += Math.PI * 2;
          f.letzterWinkel = t.fw;
          f.neigung = (f.neigung || 0) * 0.9 + Math.max(-0.6, Math.min(0.6, dw / Math.max(dt, 0.001) * 0.25)) * 0.1;
          f.position.set(X(t.fx), FLUGHOEHE + Math.sin(this.zeit * 2 + t.id) * 3, Z(t.fy));
          f.rotation.set(-f.neigung, -t.fw, 0, 'YXZ');
          const schlag = Math.sin(this.zeit * 6 + t.id) * 0.35;
          f.fluegel.forEach((fl, i) => { fl.rotation.x = (i ? -1 : 1) * schlag; });
        }
        // Eulen der Polarlicht-Pinguine
        if (t.eff && t.eff.eule) {
          let e = this.eulen.get(t.id);
          if (!e) {
            e = new T.Group();
            for (let n = 0; n < t.eff.eule; n++) {
              const eu = new T.Group();
              const k = mesh(G.kugel, mat(n ? 0xfff2c4 : 0xf4f8ff), 0, 0, 0); k.scale.set(6, 7, 6);
              const f1 = mesh(G.kugel, mat(0xdfe8f2), 0, 1, 7); f1.scale.set(4, 1.2, 8);
              const f2 = f1.clone(); f2.position.z = -7;
              const au = mesh(G.kugelGrob, mat(0xffc93c, 'basic'), 5, 3, 2); au.scale.setScalar(1.4);
              const au2 = au.clone(); au2.position.z = -2;
              eu.add(k, f1, f2, au, au2); eu.fluegel = [f1, f2];
              e.add(eu);
            }
            this.eulen.set(t.id, e); sc.add(e);
          }
          e.children.forEach((eu, n) => {
            const w = this.zeit * 1.5 + t.id + n * Math.PI;
            eu.position.set(X(t.x) + Math.cos(w) * 40, 70 + Math.sin(this.zeit * 3 + n) * 4, Z(t.y) + Math.sin(w) * 40);
            eu.rotation.y = -w - Math.PI / 2;
            eu.fluegel.forEach((f, i) => { f.rotation.x = Math.sin(this.zeit * 14) * 0.5 * (i ? -1 : 1); });
          });
        }
      }
      for (const id of [...this.pinguine.keys()]) if (!da.has(id)) this.pinguinEntfernen(id);
    }

    fischeZeichnen(spiel) {
      const m4 = new T.Matrix4(), q = new T.Quaternion(), eu = new T.Euler(), v = new T.Vector3(), sk = new T.Vector3(), col = new T.Color();
      const zaehler = {}, zaehlerC = {};
      for (const k of Object.keys(this.fischMeshes)) { zaehler[k] = 0; zaehlerC[k] = 0; }
      let eis = 0, algen = 0, helme = 0;
      const mo = new T.Matrix4();
      for (const f of spiel.fische) {
        const fm = this.fischMeshes[f.typ];
        const typ = PT.FISCHE[f.typ];
        const zielMesh = f.camo ? fm.camo : fm.normal;
        const n = f.camo ? zaehlerC[f.typ] : zaehler[f.typ];
        if (n >= fm.max || f.x < -4 || f.x > W + 4 || f.y < -4 || f.y > H + 4) continue;
        const steht = f.frost > 0 || f.betaeubt > 0;
        eu.set(0, -f.w, steht ? 0 : Math.sin(this.zeit * 7 + f.id) * 0.06);
        q.setFromEuler(eu);
        const h = WASSER_Y + typ.r * (typ.riese ? 0.15 : 0.35) + Math.sin(this.zeit * 4 + f.id * 1.3) * 0.8;
        v.set(X(f.x), h, Z(f.y));
        const auftauchen = Math.min(1, (spiel.zeit - f.geboren) * 6 + 0.3);
        const gross = auftauchen * (typ.riese ? 1.15 : 1.45);
        sk.setScalar(gross);
        m4.compose(v, q, sk);
        zielMesh.setMatrixAt(n, m4);
        zielMesh.wag.array[n] = steht ? 0 : 1;
        // Farbe: eingefroren bläulich, betäubt gelblich, zähe Fische werden mit Schaden dunkler
        if (f.frost > 0) col.setRGB(0.75, 0.92, 1.15);
        else if (f.betaeubt > 0) col.setRGB(1.1, 1.05, 0.7);
        else if (typ.hp > 1 || f.fest) { const k = 0.55 + 0.45 * Math.max(0, f.hp / f.hpMax); col.setRGB(k, k, k); }
        else col.setRGB(1, 1, 1);
        zielMesh.setColorAt(n, col);
        if (f.camo) zaehlerC[f.typ]++; else zaehler[f.typ]++;
        if (f.frost > 0 && eis < 900) {
          const s = typ.r * 2.5 * 1.45;
          mo.compose(v, q, sk.set(s * 1.1, s * 0.75, s * 0.85));
          this.eisBlock.setMatrixAt(eis++, mo);
        }
        if (f.nach && algen < 900) {
          const s = typ.r * gross * 0.9;
          mo.compose(v.set(X(f.x), h + typ.r * gross * 0.75, Z(f.y)), q, sk.setScalar(s));
          this.algenMesh.setMatrixAt(algen++, mo);
        }
        if (f.fest && helme < 900) {
          const s = typ.r * gross;
          mo.compose(v.set(X(f.x), h + typ.r * gross * (typ.riese ? 0.35 : 0.5), Z(f.y)), q, sk.set(s * 0.9, s * 0.55, s * 0.75));
          this.helmMesh.setMatrixAt(helme++, mo);
        }
      }
      for (const [k, fm] of Object.entries(this.fischMeshes)) {
        fm.normal.count = zaehler[k]; fm.camo.count = zaehlerC[k];
        for (const m of [fm.normal, fm.camo]) {
          m.instanceMatrix.needsUpdate = true; m.wag.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
      }
      for (const [m, n] of [[this.eisBlock, eis], [this.algenMesh, algen], [this.helmMesh, helme]]) { m.count = n; m.instanceMatrix.needsUpdate = true; }
    }

    geschosseZeichnen(spiel) {
      const m4 = new T.Matrix4(), q = new T.Quaternion(), eu = new T.Euler(), v = new T.Vector3(), sk = new T.Vector3(), col = new T.Color();
      const gz = {};
      for (const k of Object.keys(this.geschossMeshes)) gz[k] = 0;
      for (const g of spiel.geschosse) {
        const k = this.geschossMeshes[g.bild] ? g.bild : 'zapfen';
        const art = this.geschossArten[k];
        const m = this.geschossMeshes[k];
        if (gz[k] >= 600) continue;
        const w = Math.atan2(g.vy, g.vx);
        eu.set(art.drehen ? 0 : 0, art.drehen ? this.zeit * 14 : -w, art.rollen ? -this.zeit * 8 : 0);
        q.setFromEuler(eu);
        const s = art.kugelig ? g.groesse : g.bild === 'rakete' ? 1 : (g.groesse / 5) * (art.skala || 1);
        let y = art.y == null ? g.groesse + 1 : art.y;
        if (art.flug) y = 12 + (FLUGHOEHE - 20) * Math.max(0, g.rest / g.a.flug);
        v.set(X(g.x), y, Z(g.y));
        m4.compose(v, q, sk.setScalar(s));
        m.setMatrixAt(gz[k]++, m4);
      }
      for (const [k, m] of Object.entries(this.geschossMeshes)) { m.count = gz[k]; m.instanceMatrix.needsUpdate = true; }
      // Granaten fliegen im hohen Bogen
      let gn = 0;
      for (const g of spiel.granaten) {
        if (gn >= 200) break;
        const k = Math.min(1, g.t / g.dauer);
        v.set(X(g.x0 + (g.x - g.x0) * k), 24 + Math.sin(k * Math.PI) * 170, Z(g.y0 + (g.y - g.y0) * k));
        m4.compose(v, q.identity(), sk.setScalar(g.bild === 'granateGross' ? 8 : 6));
        this.granatenMesh.setMatrixAt(gn++, m4);
      }
      this.granatenMesh.count = gn; this.granatenMesh.instanceMatrix.needsUpdate = true;
      // Stachelhaufen (fliegen erst von der Fabrik in den Kanal)
      let hn = 0;
      for (const h of spiel.haufen) {
        if (hn >= 800) break;
        const k = Math.min(1, (spiel.zeit - h.start) / 0.35);
        const x = h.x0 + (h.x - h.x0) * k, y = h.y0 + (h.y - h.y0) * k;
        const s = h.radius * 0.95 * (0.55 + 0.45 * Math.max(0, h.durchschlag / h.max));
        eu.set(0, h.id, 0); q.setFromEuler(eu);
        m4.compose(v.set(X(x), WASSER_Y + 1 + Math.sin(k * Math.PI) * 40, Z(y)), q, sk.setScalar(s));
        this.haufenMesh.setMatrixAt(hn, m4);
        this.haufenMesh.setColorAt(hn, h.a.mine ? col.setRGB(1.2, 0.55, 0.45) : col.setRGB(1, 1, 1));
        hn++;
      }
      this.haufenMesh.count = hn; this.haufenMesh.instanceMatrix.needsUpdate = true;
      if (this.haufenMesh.instanceColor) this.haufenMesh.instanceColor.needsUpdate = true;
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
        const g = new T.BufferGeometry().setFromPoints([new T.Vector3(X(e.x1), e.h1 || 22, Z(e.y1)), new T.Vector3(X(e.x2), 8, Z(e.y2))]);
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
      const schrift = gr => `800 ${gr}px "Bricolage Grotesque", system-ui, sans-serif`;
      // Lebensbalken der zähen Fische; der Boss bekommt einen großen Balken oben
      let boss = null;
      for (const f of spiel.fische) {
        const typ = PT.FISCHE[f.typ];
        if (f.boss) { boss = f; continue; }
        if (typ.hp < 10 || f.camo) continue;
        const [sx, sy] = this.bildschirm(f.x, f.y, typ.r * 1.4 + 6);
        const b = typ.riese ? Math.min(80, 30 + typ.r) : 24;
        x.fillStyle = 'rgba(10,20,40,0.7)'; x.fillRect(sx - b / 2 - 1, sy - 1, b + 2, 6);
        x.fillStyle = f.hp / f.hpMax > 0.5 ? '#4cd964' : f.hp / f.hpMax > 0.25 ? '#f6c343' : '#e2463b';
        x.fillRect(sx - b / 2, sy, b * Math.max(0, f.hp / f.hpMax), 4);
      }
      if (boss) {
        const b = Math.min(this.pw - 40, 520), lx = (this.pw - b) / 2, ly = 14;
        x.fillStyle = 'rgba(10,20,40,0.85)'; x.fillRect(lx - 4, ly - 4, b + 8, 30);
        x.fillStyle = '#5a1010'; x.fillRect(lx, ly, b, 22);
        x.fillStyle = '#e2463b'; x.fillRect(lx, ly, b * Math.max(0, boss.hp / boss.hpMax), 22);
        x.fillStyle = 'rgba(255,255,255,0.5)';
        for (const k of [0.25, 0.5, 0.75]) x.fillRect(lx + b * k - 1, ly, 2, 22);
        x.font = schrift(15); x.textAlign = 'center'; x.fillStyle = '#fff';
        const bd = PT.BOSSE[boss.typ] || {};
        x.fillText(`${bd.symbol || '👑'} ${PT.FISCHE[boss.typ].name} · Stufe ${boss.boss} · ${Math.ceil(boss.hp)} / ${Math.round(boss.hpMax)}`, this.pw / 2, ly + 16);
      }
      // betäubte Pinguine (Flutwelle) und im Koop der Name des Besitzers
      const koop = spiel.koop && spiel.spieler.length > 1;
      for (const t of spiel.tuerme) {
        if (t.betaeubt > 0) {
          const [sx, sy] = this.bildschirm(t.x, t.y, 58);
          x.font = schrift(18); x.textAlign = 'center';
          x.fillText('💫', sx + Math.sin(this.zeit * 6 + t.id) * 4, sy);
        }
        if (koop && t.besitzer != null && this.namenZeigen) {
          const sp = spiel.spielerVon(t.besitzer);
          if (!sp) continue;
          const [sx, sy] = this.bildschirm(t.x, t.y, -4);
          x.font = schrift(11); x.textAlign = 'center';
          x.lineWidth = 3; x.strokeStyle = 'rgba(20,30,50,0.85)'; x.strokeText(sp.name, sx, sy + 14);
          x.fillStyle = PT.KOOP_FARBEN[sp.farbe] || '#fff'; x.fillText(sp.name, sx, sy + 14);
        }
      }
      // Heldenstufe
      for (const t of spiel.tuerme) {
        if (!PT.HELDEN[t.typ]) continue;
        const [sx, sy] = this.bildschirm(t.x, t.y, 72);
        x.font = schrift(14); x.textAlign = 'center';
        x.lineWidth = 4; x.strokeStyle = 'rgba(20,30,50,0.85)'; x.strokeText(`⭐ ${t.stufe}`, sx, sy);
        x.fillStyle = '#ffd54a'; x.fillText(`⭐ ${t.stufe}`, sx, sy);
      }
      // schwebende Texte
      x.textAlign = 'center';
      this.texte = this.texte.filter(t => (t.t += dt) < t.dauer);
      for (const t of this.texte) {
        const [sx, sy] = this.bildschirm(t.x, t.y, t.h + t.t * 40);
        x.globalAlpha = 1 - t.t / t.dauer;
        x.font = schrift(t.gross || 18);
        x.lineWidth = 4; x.strokeStyle = 'rgba(20,30,50,0.8)'; x.strokeText(t.text, sx, sy);
        x.fillStyle = t.farbe; x.fillText(t.text, sx, sy);
      }
      x.globalAlpha = 1;
      // Aufblitzen bei großen Fähigkeiten
      if (this.flash) {
        this.flash.t += dt;
        const k = this.flash.t / this.flash.dauer;
        if (k >= 1) this.flash = null;
        else { x.globalAlpha = 0.45 * (1 - k); x.fillStyle = this.flash.farbe; x.fillRect(0, 0, this.pw, this.ph); x.globalAlpha = 1; }
      }
      // roter Rand, wenn ein Fisch durchkommt
      if (this.blitz > 0) {
        this.blitz -= dt;
        const g = x.createRadialGradient(this.pw / 2, this.ph / 2, Math.min(this.pw, this.ph) * 0.35, this.pw / 2, this.ph / 2, Math.max(this.pw, this.ph) * 0.7);
        g.addColorStop(0, 'rgba(226,70,59,0)'); g.addColorStop(1, `rgba(226,70,59,${Math.max(0, this.blitz) * 1.2})`);
        x.fillStyle = g; x.fillRect(0, 0, this.pw, this.ph);
      }
    }

    /* ---------- Vorschaubilder für Laden und Lexikon ---------- */
    // skin: Look für die Pinguine; looks: diese Looks zusätzlich am Zapfen-Pingu zeigen (Pingu-Pass)
    static bilder(typen, fische, skin = null, looks = []) {
      const groesse = 192;
      const c = document.createElement('canvas');
      c.width = c.height = groesse;
      const r = new T.WebGLRenderer({ canvas:c, antialias:true, alpha:true, preserveDrawingBuffer:true });
      r.setPixelRatio(1); r.setSize(groesse, groesse, false);
      const sc = new T.Scene();
      sc.add(new T.HemisphereLight(0xffffff, 0x8899aa, 0.9));
      const l = new T.DirectionalLight(0xffffff, 0.7); l.position.set(1, 2, 1.5); sc.add(l);
      const k = new T.PerspectiveCamera(30, 1, 0.1, 2000);
      const pingu = {}, fisch = {};
      for (const typ of typen) {
        let g;
        if (typ === 'flieger') { g = albatros([0, 0, 0], skin); g.rotation.y = 0.9; g.position.y = 20; }
        else { const b = pinguinBauen(typ, [0, 0, 0], 1, { skin }); g = b.g; b.innen.rotation.y = typ === 'markt' || typ === 'fabrik' ? Math.PI / 2 + 0.6 : 0.9; }
        sc.add(g);
        const boot = typ === 'boot';
        k.position.set(68, boot ? 70 : 72, 88); k.lookAt(0, boot ? 14 : 24, 0);
        if (typ === 'flieger') { k.position.set(60, 70, 80); k.lookAt(0, 20, 0); }
        r.render(sc, k);
        pingu[typ] = c.toDataURL('image/png');
        sc.remove(g);
      }
      const look = {};
      for (const id of looks) {
        const b = pinguinBauen('zapfen', [0, 0, 0], 1, { skin:id });
        b.innen.rotation.y = 0.9;
        sc.add(b.g);
        k.position.set(68, 72, 88); k.lookAt(0, 24, 0);
        r.render(sc, k);
        look[id] = c.toDataURL('image/png');
        sc.remove(b.g);
      }
      for (const typ of fische) {
        const f = PT.FISCHE[typ];
        const m = new T.Mesh(fischGeo(typ), new T.MeshPhongMaterial({ vertexColors:true, shininess:50 }));
        m.rotation.y = -0.5;
        sc.add(m);
        const d = f.r * (typ === 'krake' || typ === 'krakus' || typ === 'rochen' ? 6.5 : typ === 'orka' ? 7.2 : 5.2);
        k.position.set(d * 0.2, d * 0.45, d); k.lookAt(0, 0, 0);
        r.render(sc, k);
        fisch[typ] = c.toDataURL('image/png');
        sc.remove(m);
      }
      r.dispose();
      if (r.forceContextLoss) r.forceContextLoss();
      return { pingu, fisch, look };
    }
  }

  window.PT.Welt = Welt;
})();
