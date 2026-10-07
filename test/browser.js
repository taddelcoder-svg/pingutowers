'use strict';
// Rauchtest im echten Browser (Server muss laufen: npm start).
// Menü, alle Karten mit allen Pinguinen auf Stufe 5, Fähigkeiten, Fische aus der Nähe, Sandkasten, Handy.
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
    await page.close();
  }
  // Alle Karten, voll ausgebaut, eine späte Runde
  for (const [karte, held] of [['scholle', 'kiel'], ['bucht', 'aurora'], ['spalte', 'frosti'], ['erebus', 'kiel'], ['nacht', 'aurora'], ['doppel', 'frosti']]) {
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
