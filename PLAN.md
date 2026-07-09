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

## Not committed yet
All changes are in the working tree, uncommitted — user has not asked for a commit/push. `.github/workflows/deploy.yml` won't actually deploy until pushed to `main` on GitHub, and GitHub Pages must be enabled in the repo's Settings → Pages → Source: "GitHub Actions" (one-time manual step, cannot be done from the CLI).
