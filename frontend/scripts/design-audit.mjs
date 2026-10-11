import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const directory = `qa/refinement/${process.argv[2] || 'before'}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const capture = async name => {
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
};
await page.goto('http://127.0.0.1:5173/');
await page.locator('.hero-actions').waitFor();
await page.waitForTimeout(1800);
await capture('landing');
await page.screenshot({path: `${directory}/landing-hero.png`, fullPage: false});
await page.goto('http://127.0.0.1:5173/#workspace');
await page.locator('.score-value').waitFor();
await page.waitForFunction(() => document.querySelector('.map-canvas')?.dataset.geographyReady === 'true');
await capture('workspace');
if (process.argv[2] !== 'before') {
  await page.locator('.control-disclosure > summary').first().click();
  await capture('controls-expanded');
  await page.locator('.contribution-section > summary').click();
  await page.locator('.provenance-section > summary').click();
  await capture('analysis-expanded');
}
await page.goto('http://127.0.0.1:5173/#analytics');
await page.getByRole('heading', { name: 'Village scenario scores' }).waitFor();
await page.waitForTimeout(800);
await capture('analytics');
await page.goto('http://127.0.0.1:5173/#methodology');
await page.locator('.source-register').waitFor();
await capture('methodology');
for (const [name, width, height] of [['mobile', 390, 844], ['tablet', 768, 1024]]) {
  await page.setViewportSize({ width, height });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.hero-actions').waitFor();
  await page.waitForTimeout(800);
  await capture(`landing-${name}`);
  await page.goto('http://127.0.0.1:5173/#workspace');
  await page.locator('.score-value').waitFor();
  await page.waitForFunction(() => document.querySelector('.map-canvas')?.dataset.geographyReady === 'true');
  await capture(`workspace-${name}`);
  await page.goto('http://127.0.0.1:5173/#analytics');
  await page.getByRole('heading', {name:'Village scenario scores'}).waitFor();
  await page.waitForTimeout(800);
  await capture(`analytics-${name}`);
}
await browser.close();
console.log(`Screenshots saved to ${directory}`);
