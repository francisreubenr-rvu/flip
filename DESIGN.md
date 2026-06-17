# DESIGN.md — flip design system

All tokens live in `app/globals.css` as CSS custom properties. Never hardcode colors or font names; always use the vars.

## Surfaces (warm ivory paper)

- `--page` oklch(96% .013 82) — base paper
- `--page-cream` / `--page-buff` / `--page-deep` — progressively warmer/deeper sheets (page 2, 3, 4 backgrounds)
- `--desk` oklch(28% .025 40) — the dark desk behind the notebook (body background)
- Grid: `--grid-minor` / `--grid-major` rgba(62,92,185, .09/.18), 20px cell, 5-cell major rule — Rhodia blue graph paper

## Ink scale (blue-black iron gall)

`--ink-100` (12%) → `--ink-80` → `--ink-60` → `--ink-40` → `--ink-25` (62%). Body text is ink-80; whispers/marginalia are ink-40/25.

## Accents

- `--accent` structural red oklch(52% .22 22) (+ hover/quiet/urgent/ember/dim/glow ladder, `--red-100…25` rubrication scale). Used for active states, the margin line, primary actions.
- `--accent-gold` warm amber oklch(68% .15 72) — sound/folio second accent.
- Semantic: `--danger`, `--warn`, `--work-color` (red), `--break-color` (green), `--rest-color`.
- Flip panels: `--panel-bg` (near-black blue), `--panel-text` (paper), `--panel-seam`.

## Typography

- `--serif`: Instrument Serif (italic for intentions/heroes; weight 400 only, bold via CSS). Display sizes use fluid clamp(), tracking −0.02 to −0.04em, line-height ≤1.15 at display sizes.
- `--mono`: IBM Plex Mono 400/500/700. Labels are 10–13px, uppercase, letter-spacing 0.10–0.16em.
- Hierarchy = enormous italic serif vs tiny tracked mono labels. No middle-size sans anywhere.

## Motion

- `--ease-out-expo` cubic-bezier(.16,1,.3,1) — default for entrances
- `--ease-out-quart` — micro-interactions
- `--ease-flip` — flip-clock panel rotation
- Durations: 150–300ms product surfaces; landing/brand surfaces may orchestrate longer ink/stamp/page-turn choreography. Respect `prefers-reduced-motion`.

## Component vocabulary

- `.notebook` — the page container with grid background + red margin line (::before at left 60px) + paper grain (::after)
- `.topbar` — brand "flip", folio, ambient clock, user chip
- `.btn-circle`, `.intent-input`, `.theme-toggle`, `.intent-edit-btn` — existing controls; reuse rather than invent
- Dark theme via `html[data-theme="dark"]` token overrides (night desk, lamplight)

## Theme rule

Light = day desk with aquarium (OceanWorld boids). Dark = night desk with Kepler rocket orbit (RocketOrbit). Theme persisted in `localStorage('flip-theme')`, applied pre-paint by inline script in `app/layout.tsx`.
