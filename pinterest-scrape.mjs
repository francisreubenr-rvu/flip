import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const SEARCHES = [
  'dark productivity app UI design',
  'focus timer app interface',
  'clock UI dark minimal',
  'pomodoro app design dark',
  'ambient music player UI',
  'terminal aesthetic web design',
  'brutalist dark web design',
  'minimal dashboard dark UI',
  'flip clock design interface',
  'focus app aesthetic',
];

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

mkdirSync('/tmp/pinterest', { recursive: true });

const allPins = [];
let pinCount = 0;

for (const query of SEARCHES) {
  if (pinCount >= 50) break;
  try {
    const page = await ctx.newPage();
    const encoded = encodeURIComponent(query);
    await page.goto(`https://in.pinterest.com/search/pins/?q=${encoded}&rs=typed`, {
      waitUntil: 'domcontentloaded', timeout: 25000
    });
    await page.waitForTimeout(4000);

    // Scroll to load more pins
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(1200);
    }

    // Screenshot the results grid
    const safeName = query.replace(/[^a-z0-9]/gi, '-').slice(0, 30);
    await page.screenshot({ path: `/tmp/pinterest/${safeName}.png`, fullPage: false });

    // Extract pin image URLs and titles
    const pins = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('[data-test-id="pin"] img, div[role="listitem"] img, img[src*="pinimg"]')]
        .slice(0, 8)
        .map(img => ({
          src: img.src || img.getAttribute('src'),
          alt: img.alt || '',
        }))
        .filter(p => p.src && p.src.includes('pinimg'));
      return pins;
    });

    allPins.push({ query, screenshot: `/tmp/pinterest/${safeName}.png`, pins });
    pinCount += pins.length;

    console.log(`✓ "${query}" → ${pins.length} pins (total: ${pinCount})`);
    await page.close();
  } catch (e) {
    console.log(`✗ "${query}" failed: ${e.message.slice(0, 80)}`);
  }
}

writeFileSync('/tmp/pinterest/manifest.json', JSON.stringify(allPins, null, 2));
console.log(`\nTotal pins captured: ${pinCount}`);
console.log('Screenshots saved to /tmp/pinterest/');
await browser.close();
