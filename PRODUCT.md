# PRODUCT.md — flip

register: both
(product register for the authenticated app surfaces; brand register for the public landing page and auth pages)

## What flip is

A focus instrument. A single-page web app styled as a paper notebook spread open on a desk: graph-paper grid, iron-gall ink, one red margin line. Five vertically scroll-snapped pages — Daily (intention + session log), Focus (pomodoro), Sound (generative ambient + brown noise), Rest (box breathing), Play (mini-games unlocked after work). Companion surfaces: a personal finance ledger (bank statement parsing), and byox (a "build your own X" tutorial index).

## Users

One person, really: a university student / maker who lives in their terminal and notebook, dislikes dopamine-engineered productivity apps, and wants a calm, analog-feeling instrument that runs all day on a desk display. Secondary: friends invited via Supabase auth. Sessions are long-lived ambient dwell, not quick transactional visits.

## Brand voice (three physical words)

Inked, deliberate, unhurried. The app should feel like good stationery: a Rhodia pad, a fountain pen, a library date-stamp. Never like a SaaS dashboard.

## Strategic principles

1. **Everything is ink on paper.** New UI must read as something that could exist on a desk: stamps, rules, marginalia, folios, flip-clock panels. No floating glass, no neon, no purple gradients.
2. **Motion is physical.** Page turns, ink bleeds, stamp thunks, pendulum easing. Exponential ease-out. Nothing bouncy, nothing decorative without a physical metaphor.
3. **Calm over conversion.** The app never nags. Stats whisper from the margins. The landing page may be ambitious and theatrical, but in the voice of print and paper, not growth-hacking.
4. **Privacy by architecture.** Day data lives in localStorage; the server only sees auth and explicitly-uploaded ledger files.

## Anti-references (never look like)

- Generic SaaS landing slop: centered hero, gradient text, three icon-cards, hero-metric stats.
- Notion/Linear-clone minimalism, glassmorphism, dark-neon "developer aesthetic".
- Habit-tracker gamification (streak fire, confetti, badges).

## Existing identity (locked, identity-preservation wins)

Instrument Serif (display, italic) + IBM Plex Mono (labels/data) on warm ivory paper with Rhodia-blue grid and a structural red accent, amber-gold second accent. Dark theme = night desk: same notebook under lamplight, with a Kepler-orbit rocket toy; light theme has an aquarium boid simulation. These fonts and surfaces are committed brand identity, not reflex defaults.
