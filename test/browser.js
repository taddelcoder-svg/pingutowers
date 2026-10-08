'use strict';
// Rauchtest im echten Browser (Server muss laufen: npm start).
// Menü mit Pingu-Pass, alle Karten mit allen Pinguinen auf Stufe 5, Fähigkeiten, Fische aus der Nähe,
// Orka-Angriff, Koop mit zwei Browsern, Sandkasten, Handy.
// node test/browser.js [ausgabeordner]
const { chromium } = require('playwright');
const aus = process.argv[2] || '.';
const URL = process.env.URL || 'http://localhost:10700/?test=1';

(async () => {
  const browser = await chromium.launch({ args:['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const fehler = [];
  const seite = async (name, wahl, vp = { width:1400, height:860 }, extra = {}) => {
    const page = await browser.newPage({ viewport:vp, deviceScaleFactor:1, ...extra });
    page.on('pageerror', e => fehler.push(`${name}: ${e.stack}`));
    page.on('console', m => { if (m.type() === 'error') fehler.push(`${name} console: ${m.text()}`); });
    page.on('dialog', d => d.accept());
    if (wahl) await page.addInitScript(w => localStorage.setItem('pt-wahl', JSON.stringify(w)), wahl);
    await page.goto(URL);
    await page.waitForTimeout(1500);
    return page;
  };

  // Menü
  {
    const page = await seite('menue', null);
    await page.screenshot({ path:`${aus}/menue.png`, fullPage:true });
    // Pingu-Pass auf Stufe 21 mit Galaxie-Look
    const st = await page.evaluate(() => window.__pt.pass(9000, 'galaxie'));
    console.log('Pass', JSON.stringify(st));
    await page.click('#passBox summary');
    await page.waitForTimeout(300);
    await page.screenshot({ path:`${aus}/pass.png`, fullPage:true });
    await page.close();
  }
  // Alle Karten, voll ausgebaut, eine späte Runde
  for (const [karte, held] of [['scholle', 'kiel'], ['bucht', 'aurora'], ['kreuz', 'frosti'], ['spalte', 'frosti'], ['erebus', 'kiel'], ['nacht', 'aurora'], ['doppel', 'frosti'], ['inseln', 'kiel']]) {
    const page = await seite(karte, { karte, stufe:'mittel', modus:'standard', held });
    await page.click('#los');
    await page.waitForTimeout(800);
    const n = await page.evaluate(() => window.__pt.test());
    await page.click('#start');
    await page.waitForTimeout(4500);
    if (karte === 'scholle') {
      const ids = await page.evaluate(() => window.__pt.faehigkeiten());
      console.log('Fähigkeiten:', ids.join(', '));
      await page.screenshot({ path:`${aus}/karte-${karte}-vorher.png` });
      for (const id of ids) await page.evaluate(i => window.__pt.ausloesen(i), id);
      await page.waitForTimeout(250);
      await page.screenshot({ path:`${aus}/karte-${karte}-faehigkeiten.png` });
      // einen Pinguin anklicken: Seitenleiste mit Stufe 5
      await page.evaluate(() => { const s = window.__pt.spiel(); });
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path:`${aus}/karte-${karte}.png` });
    console.log(karte, n, 'Pinguine', JSON.stringify(await page.evaluate(() => window.__pt.stand())));
    await page.close();
  }
  // Fische aus der Nähe (gezoomt)
  {
    const page = await seite('fische', { karte:'scholle', stufe:'mittel', modus:'standard', held:null }, { width:1400, height:860 }, { deviceScaleFactor:2 });
    await page.click('#los');
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__pt.fische());
    await page.evaluate(() => { const w = window.__pt.welt(); w.zoom = 1.9; w.schwenk.set(-250, 40); w.kameraSetzen(); });
    await page.waitForTimeout(1500);
    await page.screenshot({ path:`${aus}/fische.png` });
    await page.close();
  }
  // Turm-Seitenleiste und Boss
  {
    const page = await seite('boss', { karte:'nacht', stufe:'mittel', modus:'boss', held:'kiel' });
    await page.click('#los');
    await page.waitForTimeout(800);
    await page.evaluate(() => { window.__pt.test([['zapfen', [0, 2, 5]], ['ninja', [5, 2, 0]], ['kiel', [0, 0, 0]]]); const s = window.__pt.spiel(); s.runde = 19; });
    await page.click('#start');
    await page.waitForTimeout(3000);
    // Zapfen auswählen über einen Klick auf seine Position
    const pos = await page.evaluate(() => { const s = window.__pt.spiel(), w = window.__pt.welt(); const t = s.tuerme[0]; const r = document.querySelector('#welt').getBoundingClientRect(); const [x, y] = w.bildschirm(t.x, t.y, 0); return [r.left + x, r.top + y]; });
    await page.mouse.click(pos[0], pos[1]);
    await page.waitForTimeout(400);
    await page.screenshot({ path:`${aus}/boss.png` });
    await page.close();
  }
  // Orka-Angriff: Kaiser Orka in Runde 25 mit Flutwelle, Meisterkraft und Look
  {
    const page = await seite('orka', { karte:'inseln', stufe:'mittel', modus:'orka', held:'frosti', kraft:true });
    await page.evaluate(() => window.__pt.pass(20000, 'gold'));
    await page.click('#los');
    await page.waitForTimeout(800);
    await page.evaluate(() => { window.__pt.test([['laser', [2, 5, 0]], ['disco', [0, 2, 5]], ['zapfen', [0, 2, 5]], ['ninja', [5, 2, 0]], ['frosti', [0, 0, 0]]]); window.__pt.spiel().runde = 24; });
    await page.click('#start');
    await page.waitForTimeout(6000);
    const orka = await page.evaluate(() => { const s = window.__pt.spiel(); const o = s.fische.find(f => f.typ === 'orka'); if (o) { o.hp = o.hpMax * 0.7; s.bossPruefen(o); } return { orka:!!o, betaeubt:s.tuerme.filter(t => t.betaeubt > 0).length, fk:s.faehigkeitenListe().map(f => f.id) }; });
    console.log('orka', JSON.stringify(orka));
    await page.waitForTimeout(500);
    await page.screenshot({ path:`${aus}/orka.png` });
    await page.close();
  }
  // Koop: zwei Browser im selben Raum, getrenntes Geld
  {
    const a = await seite('koopA', { karte:'kreuz', stufe:'leicht', modus:'standard', held:'kiel' });
    const b = await seite('koopB', { karte:'scholle', stufe:'mittel', modus:'standard', held:'aurora' });
    await a.click('#reiterKoop');
    await a.fill('#koopName', 'Taddel');
    await a.click('#koopNeu');
    await a.waitForTimeout(600);
    const code = (await a.textContent('#raumCode')).trim();
    await b.click('#reiterKoop');
    await b.fill('#koopName', 'Lina');
    await b.fill('#koopCode', code);
    await b.click('#koopRein');
    await b.waitForTimeout(600);
    await a.click('#karten .kartenwahl:nth-child(3)');
    await a.click('#geldModi .stufe:nth-child(2)');
    await a.click('#stufen .stufe:nth-child(1)');
    await a.waitForTimeout(400);
    await b.screenshot({ path:`${aus}/koop-lobby.png`, fullPage:true });
    await a.click('#los');
    await a.waitForTimeout(1500);
    // jeder baut über die Oberfläche (Befehl an den Server)
    const bauen = async (page, typ, o) => page.evaluate(([t, o]) => {
      const s = window.__pt.spiel();
      for (let i = o; i < 3000; i++) {
        const w = s.wege[i % s.wege.length], p = w.pts[(i * 41) % w.pts.length];
        const x = p[0] + Math.cos(i) * 60, y = p[1] + Math.sin(i) * 60;
        if (s.platzFrei(t, x, y)) { window.__pt.tun({ t:'bau', typ:t, x, y }); return true; }
      }
      return false;
    }, [typ, o]);
    await bauen(a, 'zapfen', 0); await bauen(b, 'aurora', 700);
    await a.waitForTimeout(500);
    await bauen(a, 'kiel', 1400);
    await a.waitForTimeout(500);
    await a.click('#start');
    await a.waitForTimeout(5000);
    const stand = async p => p.evaluate(() => { const s = window.__pt.spiel(), n = window.__pt.netz(); return { n:n.n, ziel:n.ziel, tuerme:s.tuerme.map(t => t.typ + ':' + t.besitzer).sort().join(), spieler:s.spieler.map(x => x.name + ':' + Math.round(x.geld)).join(), runde:s.runde, laeuft:s.laeuft, summe:s.pruefsumme() }; });
    const sa = await stand(a), sb = await stand(b);
    console.log('koop A', JSON.stringify(sa));
    console.log('koop B', JSON.stringify(sb));
    if (sa.tuerme !== sb.tuerme || sa.tuerme.split(',').length !== 3) fehler.push('koop: Pinguine unterschiedlich ' + sa.tuerme + ' / ' + sb.tuerme);
    if (sa.spieler.split(',').length !== 2) fehler.push('koop: Spieler ' + sa.spieler);
    await a.screenshot({ path:`${aus}/koop-a.png` });
    await b.screenshot({ path:`${aus}/koop-b.png` });
    // B pausiert: beide stehen
    await b.click('#pauseKnopf');
    await a.waitForTimeout(600);
    const pa = await a.evaluate(() => !document.querySelector('#pause').hidden && document.querySelector('#pauseTitel').textContent);
    console.log('Pause bei A:', pa);
    if (!pa || !pa.includes('Lina')) fehler.push('koop: Pause kommt nicht bei A an');
    await a.screenshot({ path:`${aus}/koop-pause.png` });
    await a.close(); await b.close();
  }
  // Sandkasten und Handy
  {
    const page = await seite('handy', { karte:'erebus', stufe:'leicht', modus:'sandkasten', held:'frosti' }, { width:390, height:844 }, { hasTouch:true, isMobile:true });
    await page.screenshot({ path:`${aus}/handy-menue.png` });
    await page.click('#los');
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__pt.test([['zapfen', [2, 0, 0]], ['boot', [0, 2, 0]], ['fabrik', [3, 0, 0]], ['frosti', [0, 0, 0]]]));
    await page.click('[data-fisch="regen"]');
    await page.click('[data-fisch="krake"]');
    await page.waitForTimeout(4000);
    await page.screenshot({ path:`${aus}/handy-spiel.png` });
    console.log('handy', JSON.stringify(await page.evaluate(() => window.__pt.stand())));
    await page.close();
  }
  await browser.close();
  console.log(fehler.length ? 'FEHLER:\n' + [...new Set(fehler)].slice(0, 20).join('\n') : 'keine Fehler');
})();
