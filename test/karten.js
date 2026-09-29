'use strict';
// Screenshots aller Karten mitten in einer späten Runde (Server muss laufen).
// node test/karten.js [ausgabeordner]
const { chromium } = require('playwright');
const aus = process.argv[2] || '.';
const URL = process.env.URL || 'http://localhost:10700/?test=1';

(async () => {
  const browser = await chromium.launch({ args:['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const fehler = [];
  for (const karte of ['scholle', 'spalte', 'nacht']) {
    const page = await browser.newPage({ viewport:{ width:1400, height:860 }, deviceScaleFactor:karte === 'scholle' ? 2 : 1 });
    page.on('pageerror', e => fehler.push(`${karte}: ${e.stack}`));
    page.on('console', m => { if (m.type() === 'error') fehler.push(`${karte} console: ${m.text()}`); });
    await page.addInitScript(k => localStorage.setItem('pt-wahl', JSON.stringify({ karte:k, stufe:'mittel' })), karte);
    await page.goto(URL);
    await page.waitForTimeout(1200);
    await page.click('#los');
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__pt.test());
    await page.click('#start');
    await page.waitForTimeout(5500);
    await page.screenshot({ path:`${aus}/karte-${karte}.png` });
    if (karte === 'scholle') await page.screenshot({ path:`${aus}/nah-${karte}.png`, clip:{ x:150, y:220, width:520, height:360 } });
    console.log(karte, JSON.stringify(await page.evaluate(() => window.__pt.stand())));
    await page.close();
  }
  await browser.close();
  console.log(fehler.length ? 'FEHLER:\n' + fehler.join('\n') : 'keine Fehler');
})();
