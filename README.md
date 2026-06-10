# robert-lamprecht.github.io

Personal site of Robert Lamprecht — Neuroscience PhD candidate at Emory University.

Two things live in this repo:

| Path | What | URL |
|---|---|---|
| `/` | Portfolio — light Swiss minimal, vanilla JS + GSAP | `robert-lamprecht.github.io` |
| `/clynchgolf/` | Beltline Bar Crawl Golf — real-time scorecard game (unlisted, not linked from the portfolio) | `robert-lamprecht.github.io/clynchgolf/` |

No framework, no build step. Push to `main` → GitHub Pages serves everything.

---

## Portfolio (root)

```
index.html        — single page: hero / about / research / projects / studio / contact
css/main.css      — design tokens, grid, hairlines, responsive layout
js/main.js        — GSAP hero entrance, ScrollTrigger reveals, hover micro-interactions
```

- **Type:** Archivo (display) + IBM Plex Mono (metadata)
- **Palette:** off-white paper `#fafaf7`, ink `#161613`, hairline `#d8d8d0`, accent `#e2421f`
- **Animation:** GSAP 3.12 + ScrollTrigger (CDN); respects `prefers-reduced-motion`

---

## Beltline Bar Crawl Golf (`/clynchgolf/`)

A mobile-first, real-time scorecard web app for bar crawls scored by golf rules.
**Lowest score wins — the lowest score belongs to whoever drank the most.**
Originally built for Colin's birthday on the Atlanta Beltline, now generalized:
anyone can create a game (custom bar stops, optional guest of honor) and gets a
shareable 5-char code + host PIN. Joining takes a name + game code; `?g=CODE`
invite links prefill the code.

Players track drinks/shots/bonuses/penalties per hole, and a live scoreboard
ranks everyone in real time via Firebase Firestore. Each game is a
`sessions/{gameCode}` doc; the legacy game lives on at `sessions/clynch`.

Full game rules, scoring engine, and data model are documented in `Instructions/SPEC_1.md`.
**That file is the source of truth** for game logic. Agent working rules are in `CLAUDE.md`.

```
clynchgolf/
  index.html            — single page, all views (landing / scorecard / scoreboard / penalty)
  css/styles.css        — design tokens, layout, components
  js/
    config.js           — CONFIG object (all tunables, see SPEC §13)
    firebase.js         — Firebase init + Firestore offline persistence
    scoring.js          — PURE scoring logic, no UI, no Firebase
    app.js              — view routing, shared state, nav
    scorecard.js        — personal scorecard view
    scoreboard.js       — live scoreboard, onSnapshot, GSAP Flip
    penalty.js          — 4-step penalty filing + dispute handling
    host.js             — host-only: reset / lock / adjudicate
    animations.js       — reusable GSAP helpers
```

| Layer | Choice |
|---|---|
| Shell | Vanilla JS SPA, views toggled via show/hide + GSAP |
| Realtime | Firebase Firestore, `onSnapshot` listeners, offline persistence |
| Animation | GSAP 3.12+ core + Flip plugin (CDN) |
| Identity | `crypto.randomUUID()` stored in `localStorage` |
| Fonts | Playfair Display + DM Mono |

---

## Repo extras

```
Instructions/SPEC_1.md  — game spec (source of truth for game logic)
_archive/               — earlier portfolio iteration (kept for reference, unused)
firebase.json           — Firestore rules deploy config
firestore.rules         — Firestore security rules
```
