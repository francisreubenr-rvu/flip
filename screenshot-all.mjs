import { chromium } from 'playwright';

const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });

async function shot(url, path, waitMs = 2500) {
  const pg = await ctx.newPage();
  await pg.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await pg.waitForTimeout(waitMs);
  await pg.screenshot({ path });
  await pg.close();
  console.log(path);
}

const base = 'http://localhost:3002';

// Clock tab (default)
await shot(base, '/tmp/flip2-clock.png');

// Focus tab
await shot(`${base}?t=focus`, '/tmp/flip2-focus-pre.png');

// Manually click tab 2 (Focus) via JS
const pg = await ctx.newPage();
await pg.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
await pg.waitForTimeout(2000);
await pg.keyboard.press('2');
await pg.waitForTimeout(800);
await pg.screenshot({ path: '/tmp/flip2-focus.png' });
console.log('/tmp/flip2-focus.png');

await pg.keyboard.press('3');
await pg.waitForTimeout(800);
await pg.screenshot({ path: '/tmp/flip2-sound.png' });
console.log('/tmp/flip2-sound.png');

await pg.keyboard.press('4');
await pg.waitForTimeout(800);
await pg.screenshot({ path: '/tmp/flip2-play.png' });
console.log('/tmp/flip2-play.png');

await pg.close();
await br.close();
