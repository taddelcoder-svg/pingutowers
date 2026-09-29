'use strict';
// Nahaufnahme aller Fische (Server muss laufen): node test/fische.js [ausgabeordner]
const { chromium } = require('playwright');
const aus = process.argv[2] || '.';
(async () => {
  const browser = await chromium.launch({ args:['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport:{ width:1400, height:860 }, deviceScaleFactor:2 });
  page.on('pageerror', e => console.log('FEHLER', e.stack));
  await page.addInitScript(() => localStorage.setItem('pt-wahl', JSON.stringify({ karte:'scholle', stufe:'mittel' })));
  await page.goto('http://localhost:10700/?test=1');
  await page.waitForTimeout(1200);
  await page.click('#los');
  await page.waitForTimeout(800);
  console.log(await page.evaluate(() => window.__pt.fische()));
  await page.waitForTimeout(3000);
  await page.screenshot({ path:`${aus}/fische.png` });
  await browser.close();
})();
