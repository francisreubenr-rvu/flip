import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// Visit a few specific high-design sites from Godly's gallery
const sites = [
  { url: 'https://linear.app', name: 'linear' },
  { url: 'https://midnight.fm', name: 'midnight' },
  { url: 'https://poolsuite.net', name: 'poolsuite' },
];

for (const { url, name } of sites) {
  try {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `/tmp/ref-${name}.png` });
    console.log(`${name} done`);
    await page.close();
  } catch (e) {
    console.log(`${name} failed: ${e.message}`);
  }
}

await browser.close();
