import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// ── Godly.website ───────────────────────────────────────────────────────────
console.log('Opening Godly...');
const godly = await ctx.newPage();
await godly.goto('https://godly.website', { waitUntil: 'domcontentloaded', timeout: 30000 });
await godly.waitForTimeout(3500);
await godly.screenshot({ path: '/tmp/godly-home.png' });
console.log('godly-home done');

await godly.evaluate(() => window.scrollBy(0, 900));
await godly.waitForTimeout(2000);
await godly.screenshot({ path: '/tmp/godly-scroll.png' });
console.log('godly-scroll done');

// ── Godly — specific curated sites ─────────────────────────────────────────
await godly.goto('https://godly.website/?tag=dark', { waitUntil: 'domcontentloaded', timeout: 30000 });
await godly.waitForTimeout(3000);
await godly.screenshot({ path: '/tmp/godly-dark.png' });
console.log('godly-dark done');

await godly.goto('https://godly.website/?tag=typography', { waitUntil: 'domcontentloaded', timeout: 30000 });
await godly.waitForTimeout(3000);
await godly.screenshot({ path: '/tmp/godly-type.png' });
console.log('godly-type done');

// ── Dribbble ────────────────────────────────────────────────────────────────
console.log('Opening Dribbble...');
const drb = await ctx.newPage();
await drb.goto('https://dribbble.com/shots/popular?timeframe=month&tag=productivity-app', { waitUntil: 'domcontentloaded', timeout: 30000 });
await drb.waitForTimeout(5000);
await drb.screenshot({ path: '/tmp/dribbble-prod.png' });
console.log('dribbble-prod done');

await drb.goto('https://dribbble.com/shots/popular?timeframe=month&tag=dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
await drb.waitForTimeout(5000);
await drb.screenshot({ path: '/tmp/dribbble-dash.png' });
console.log('dribbble-dash done');

await drb.goto('https://dribbble.com/shots/popular?timeframe=month&tag=clock+ui', { waitUntil: 'domcontentloaded', timeout: 30000 });
await drb.waitForTimeout(5000);
await drb.screenshot({ path: '/tmp/dribbble-clock.png' });
console.log('dribbble-clock done');

await browser.close();
console.log('all done');
