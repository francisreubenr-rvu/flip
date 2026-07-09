<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Commands

```bash
bun dev          # start dev server (localhost:3000)
bun run build    # production build
bun start        # start production server
```

No lint, typecheck, or test scripts exist in this project.

---

## Stack

Next.js 16.2.6 · React 19.2.4 · TypeScript · Tailwind CSS 4 (`@tailwindcss/postcss`) · Framer Motion 12 · Lucide React · Playwright · Bun

---

## Architecture

App Router, but every component is `'use client'` — this is effectively a client SPA. Do not reach for Server Components or server actions; nothing here requires them.

Single entry: `app/page.tsx` orchestrates all 5 pages (Daily · Focus · Sound · Rest · Play) in one component. Pages are rendered as scroll-snap sections stacked vertically; `IntersectionObserver` syncs the `page` state as the user scrolls.

Persistence: localStorage only (`flip-day-YYYY-MM-DD` keys). No backend, no database.

---

## Design System

All design tokens live in `app/globals.css` as CSS custom properties:

- `--ink-100` → `--ink-25`: blue-black iron gall ink scale
- `--page`, `--page-cream`, `--page-buff`, `--page-deep`: warm ivory paper surfaces
- `--accent`: red margin colour (also used for active states)
- `--grid-minor`, `--grid-major`: Rhodia-blue graph lines
- `--font-serif` / `--font-mono`: mapped from `next/font/google` variables in `app/layout.tsx` (Instrument Serif, IBM Plex Mono)

Do not hardcode font names or colour values — always use the CSS vars.

---

## Component Library

`app/components/` has two tiers:

**Live** (imported by `page.tsx`):
- `InkStampClock` — compact ambient clock in the top bar
- `Pomodoro` — timer with mode chips and session tracking
- `MusicPlayer` — generative Web Audio channels
- `MiniGames` — games unlocked after work sessions
- `BreathingOrb` — box-breathing animation
- `Calendar` — full monthly calendar with localStorage session dots
- `Folio` — "page N of the day" ambient display

**Design alternatives** (not currently wired — do not delete):
`FlipClock`, `SerifClock`, `OrganicClock`, `LetterpressClock`, `ConstellationClock`, `SundialClock`, `CalendarClock`, `MiniCalendar`, `BreakScreen`

---

## Scrape / Screenshot Scripts

`scrape.mjs`, `scrape2.mjs`, `pinterest-scrape.mjs`, `pinterest-extract.mjs`, `screenshot-all.mjs`, `screenshot-tabs.mjs`, `shot.mjs`

All connect via `chromium.connectOverCDP('http://localhost:9222')`. They require Chrome already running with `--remote-debugging-port=9222` and fail silently if it isn't. Run them with `bun <script>.mjs`.

---

## Deploy & verification workflow

- Production is a static export on GitHub Pages, built with `output: 'export'` in `next.config.ts` and served at `https://francisreubenr-rvu.github.io/flip/`. The sanctioned deploy path is push to `main`, which triggers `.github/workflows/deploy.yml` (GitHub Actions → GitHub Pages, via `actions/configure-pages` / `actions/upload-pages-artifact` / `actions/deploy-pages`) — no manual deploy step, no server, no Vercel.
- **After any UI change, run the `verify-live` skill before reporting done**: screenshot desktop AND 390px mobile, exercise the interaction, read the console. Verify the *deployed* URL (`https://francisreubenr-rvu.github.io/flip/`) when the complaint mentions production.
- **iOS/iPadOS is a known trouble spot for the MusicPlayer** — WebAudio requires a user gesture to start an AudioContext, and autoplay is restricted. Any audio change must be reasoned against (and ideally tested at) mobile Safari constraints.
- Screenshot/Playwright scripts must run from this project (`bun <script>.mjs`), never from `/tmp` — module resolution fails there. Before starting `bun dev`, kill stale listeners: `lsof -ti:3000 | xargs kill` (orphaned dev servers accumulate on this machine).

## Working on this codebase

- Several simulation files (OceanWorld, RocketOrbit) use tabs + unicode glyphs (θ, box-drawing comment rulers) that defeat long exact-match edits — use short unique anchors, and avoid adding new unicode in comments.
- Long multi-phase work (audits, rebuilds): checkpoint progress to a `PLAN.md`/`ROAST.md` at the project root as items complete, so session-limit resets resume instead of restart. Default to sequential passes, not wide parallel fan-outs (see global CLAUDE.md quota rules). The `roast-loop` skill encodes the audit→fix→re-audit pipeline.
- Framework/stack questions: the answer is this file — do not re-derive the "framework matrix" by scanning the codebase each session.
