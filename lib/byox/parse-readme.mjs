import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const readme = readFileSync(join(__dirname, '../../..', 'build-your-own-x/README.md'), 'utf8')

const tutorials = []
let currentCategory = ''

for (const line of readme.split('\n')) {
  const catMatch = line.match(/^####\s+Build your own [`'](.+?)[`']/) ||
                   line.match(/^####\s+(Uncategorized)/)
  if (catMatch) {
    currentCategory = catMatch[1]
    continue
  }

  const tutMatch = line.match(/^\*\s+\[\*\*(.+?)\*\*:\s+_(.+?)_\]\((.+?)\)(.*)/)
  if (tutMatch && currentCategory) {
    const [, language, title, url, trailing] = tutMatch
    // Stable ID from URL — base64 encoded, alphanumeric only, last 12 chars
    const id = Buffer.from(url).toString('base64').replace(/[^a-z0-9]/gi, '').slice(-12)
    tutorials.push({
      id,
      category: currentCategory,
      language: language.trim(),
      title: title.trim(),
      url: url.trim(),
      hasVideo: trailing.includes('[video]'),
      hasPdf: trailing.includes('[pdf]'),
    })
  }
}

const outPath = join(__dirname, 'data.json')
writeFileSync(outPath, JSON.stringify(tutorials, null, 2))
console.log(`Written ${tutorials.length} tutorials to lib/byox/data.json`)

// Print first 3 as sanity check
console.log('\nSample entries:')
tutorials.slice(0, 3).forEach(t => console.log(` [${t.id}] ${t.category} / ${t.language}: ${t.title}`))

// Category breakdown
const cats = {}
tutorials.forEach(t => { cats[t.category] = (cats[t.category] || 0) + 1 })
console.log(`\nCategories (${Object.keys(cats).length}):`)
Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${n.toString().padStart(3)}  ${c}`))
