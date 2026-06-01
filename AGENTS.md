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
