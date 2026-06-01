import { chromium } from 'playwright';
const br = await chromium.launch();
const pg = await br.newPage();
await pg.setViewportSize({ width: 1440, height: 900 });
await pg.goto('http://localhost:3003', { waitUntil: 'networkidle', timeout: 30000 });
await pg.waitForTimeout(3000);
await pg.screenshot({ path: '/tmp/flip-now-01.png', fullPage: true });
console.log('full page done');

// Scroll to focus section
await pg.evaluate(() => document.querySelector('[data-section="focus"]')?.scrollIntoView({ block: 'start' }));
await pg.waitForTimeout(800);
await pg.screenshot({ path: '/tmp/flip-focus-02.png' });

// Scroll to sound section
await pg.evaluate(() => document.querySelector('[data-section="sound"]')?.scrollIntoView({ block: 'start' }));
await pg.waitForTimeout(800);
await pg.screenshot({ path: '/tmp/flip-sound-03.png' });

// Scroll to end for brand mark
await pg.evaluate(() => document.querySelector('[data-section="end"]')?.scrollIntoView({ block: 'start' }));
await pg.waitForTimeout(800);
await pg.screenshot({ path: '/tmp/flip-end-04.png' });

await br.close();
console.log('all done');
