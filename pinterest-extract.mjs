import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const SEARCHES = [
  'dark UI app design 2024',
  'focus productivity app interface',
  'minimal clock app design',
  'pomodoro timer UI dark',
  'ambient sound app interface',
  'terminal aesthetic website',
  'brutalist web design dark',
  'dashboard dark minimal UI',
  'split flap display design',
  'music player dark UI',
  'typographic web design dark',
  'retro futuristic interface',
  'monospace font website design',
  'gameboy aesthetic UI design',
  'neon dark interface design',
];

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

mkdirSync('/tmp/pins', { recursive: true });

const results = [];

for (const query of SEARCHES) {
  try {
    const page = await ctx.newPage();
    const url = `https://in.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;
    console.log(`→ ${query}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3500);

    // Scroll to load more
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollBy(0, 700));
      await page.waitForTimeout(900);
    }

    const safeName = query.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
    const screenshotPath = `/tmp/pins/${safeName}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Extract visible images
    const pins = await page.evaluate(() => {
      return [...document.querySelectorAll('img')]
        .filter(img => img.src && (img.src.includes('pinimg') || img.src.includes('pinterest')))
        .filter(img => img.naturalWidth > 100 && img.naturalHeight > 100)
        .slice(0, 6)
        .map(img => ({ src: img.src, alt: img.alt || '', w: img.naturalWidth, h: img.naturalHeight }));
    });

    results.push({ query, screenshot: screenshotPath, pins });
    console.log(`  ✓ ${pins.length} images, screenshot saved`);
    await page.close();
  } catch (e) {
    console.log(`  ✗ failed: ${e.message.slice(0,60)}`);
  }
}

writeFileSync('/tmp/pins/manifest.json', JSON.stringify(results, null, 2));
console.log(`\nDone. ${results.length} searches, screenshots in /tmp/pins/`);
await browser.close();
