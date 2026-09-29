'use strict';
// Rauchtest im echten Browser: Menü, Spiel starten, Pinguine bauen, Runden spielen, Screenshots.
// Server vorher starten (npm start), dann: node test/browser.js [ausgabeordner]
const { chromium } = require('playwright');
const aus = process.argv[2] || '.';
const URL = process.env.URL || 'http://localhost:10700/';

(async () => {
  const browser = await chromium.launch({ args:['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const fehler = [];
  for (const [name, vp] of [['desktop', { width:1400, height:860 }], ['handy', { width:390, height:844 }]]) {
    const page = await browser.newPage({ viewport:vp, deviceScaleFactor:1, hasTouch:name === 'handy' });
    page.on('pageerror', e => fehler.push(`${name}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') fehler.push(`${name} console: ${m.text()}`); });
    await page.goto(URL);
    await page.waitForTimeout(1500);
    await page.screenshot({ path:`${aus}/${name}-menue.png`, fullPage:name === 'desktop' });
    await page.click('#los');
    await page.waitForTimeout(1200);
    // Pinguine setzen: über die Logik direkt (Klickpositionen hängen von der Kamera ab)
    const gebaut = await page.evaluate(() => {
      const w = window.__pt;
      return w ? w.test() : 'kein Testzugang';
    });
    console.log(name, 'gebaut:', gebaut);
    await page.waitForTimeout(500);
    await page.screenshot({ path:`${aus}/${name}-spiel.png` });
    // Mit der Maus einen Pinguin platzieren
    if (name === 'desktop') {
      await page.keyboard.press('1');
      const box = await page.locator('#welt').boundingBox();
      await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.62);
      await page.waitForTimeout(300);
      await page.screenshot({ path:`${aus}/${name}-vorschau.png` });
      await page.mouse.down(); await page.mouse.up();
      await page.waitForTimeout(300);
    }
    await page.click('#start');
    await page.waitForTimeout(400);
    await page.click('#start'); await page.click('#start');   // 3×
    await page.waitForTimeout(4000);
    await page.screenshot({ path:`${aus}/${name}-runde.png` });
    const stand = await page.evaluate(() => window.__pt && window.__pt.stand());
    console.log(name, 'Stand:', JSON.stringify(stand));
    await page.close();
  }
  await browser.close();
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'keine Fehler');
})();
