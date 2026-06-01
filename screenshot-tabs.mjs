import { chromium } from 'playwright';

const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
const pg = await ctx.newPage();

await pg.goto('http://localhost:3002', { waitUntil: 'networkidle', timeout: 30000 });
await pg.waitForTimeout(2000);

await pg.screenshot({ path: '/tmp/flip3-clock.png' });
console.log('clock done');

// Nav tabs are the 4 .nav-tab buttons in the footer — click by index
const navTabs = pg.locator('.nav-tab');

// Focus (index 1)
await navTabs.nth(1).click();
await pg.waitForTimeout(500);
await pg.screenshot({ path: '/tmp/flip3-focus.png' });
console.log('focus done');

// Sound (index 2)
await navTabs.nth(2).click();
await pg.waitForTimeout(500);
await pg.screenshot({ path: '/tmp/flip3-sound.png' });
console.log('sound done');

// Play (index 3)
await navTabs.nth(3).click();
await pg.waitForTimeout(500);
await pg.screenshot({ path: '/tmp/flip3-play.png' });
console.log('play done');

await br.close();
