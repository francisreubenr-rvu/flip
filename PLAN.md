# PLAN — Remove Supabase/auth from core flip, move hosting to GitHub Pages

Scope locked with user via AskUserQuestion:
- pumps: stays on Supabase, left completely untouched. Excluded from the GH Pages static export (Next.js private-folder convention: `app/pumps` → `app/_pumps`, files unmodified, just opted out of routing since its 4 dynamic `[id]`/`[username]` routes can't be statically pre-rendered).
- ledger (`app/api/ledger/*`, `app/ledger`): dropped from this migration, not rewritten. GitHub Pages can't run server API routes at all, so excluded the same way (`app/api` → `app/_api`, `app/ledger` → `app/_ledger`).
- signin/signup: only remaining consumer was the core app's auth gate (being removed) — no longer reachable from anything live, excluded the same way (`app/signin` → `app/_signin`, `app/signup` → `app/_signup`).
- Core flip app (`app/page.tsx`) and byox (`app/byox/page.tsx`, linked from core nav) converted off Supabase auth/DB to plain localStorage.
- `app/lib/auth.tsx`, `app/lib/supabase.ts`, `app/lib/authed-fetch.ts` left in place unmodified — pumps' internal imports still resolve even though pumps is unrouted.

## Steps

| # | Task | Status |
|---|------|--------|
| 1 | Exclude pumps/api/ledger/signin/signup from routing via `_`-prefix rename (mechanical, done inline) | done |
| 2 | `app/page.tsx` — remove auth guard + avatar/signout UI | done |
| 3 | `app/byox/page.tsx` — convert Supabase progress persistence to localStorage | done |
| 4 | `app/layout.tsx` — drop `AuthProvider` wrapper (dead weight, no live consumer left) | done |
| 5 | `next.config.ts` — static export config (`output: 'export'`, basePath `/flip`, unoptimized images) | done |
| 6 | `public/.nojekyll` + `.github/workflows/deploy.yml` — GitHub Pages deploy workflow | done |
| 7 | `AGENTS.md` deploy section — update to describe GH Pages flow instead of Vercel | done |
| 8 | Verify: `bun run build` produces a clean static `out/` with no Supabase env dependency for the live routes | done — verified via clean build + local static-server browser test of `/` and `/byox` (localStorage read/write confirmed to persist across reload) |

## Shipped
Committed (`b668ca6` migration, `4448b8d` bun.lock fix), pushed to `main`, GitHub Pages enabled via API (`build_type: workflow`), deploy workflow ran green. Live at https://francisreubenr-rvu.github.io/flip/ — verified `/` and `/byox` both 200, `/pumps` 404s as expected, screenshot confirms no auth gate.

Note: `bun.lock` was pre-existing stale (missing the `recharts` entry from an earlier commit, unrelated to this migration) and had to be regenerated to unblock CI's `--frozen-lockfile` install.

## Follow-up: strip remaining external-site links
User asked to remove any linkage to other websites from the live flip app. Removed 3 outbound link/button blocks from `app/page.tsx`: topbar "gpa" link (`http://localhost:5173`), topbar "pumps" badge link (`https://pumps-rho.vercel.app/dashboard`), and the "Chords · semantic recommender" link (`https://chords-sigma.vercel.app`) near the Sound page's MusicPlayer. `byox` link kept — it's an internal `/byox` route within flip itself, not an external site. No ledger button existed in the UI to begin with. Verified via clean rebuild + local static-server screenshot pass (topbar now shows only `byox` + theme toggle; Sound page shows no trailing link after MusicPlayer).
