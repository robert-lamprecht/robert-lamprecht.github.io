# Beltline Bar Crawl Golf

A mobile-first, real-time scorecard web app for a 5-hole bar crawl scored by golf rules.
**Lowest score wins — the lowest score belongs to whoever drank the most.**
Built for Colin's birthday on the Atlanta Beltline.

---

## What This Is

A single-page web app (no framework, no build step) hosted on GitHub Pages with Firebase
Firestore for real-time multiplayer scoring. Players join with a name + course code, track
drinks/shots/bonuses/penalties per hole, and a live scoreboard ranks everyone in real time.

Full game rules, scoring engine, and data model are documented in `Instructions/SPEC_1.md`.
**That file is the source of truth.** Always read it before making changes to game logic.

---

## Quick Start (for developers / agents)

1. Read `Instructions/SPEC_1.md` completely before touching game logic.
2. Read `CLAUDE.md` for agent-specific working rules.
3. Firebase config goes in `js/firebase.js` — **never commit real credentials** (they are
   intentionally client-side public, but Firestore security rules scope access).
4. Build order follows `SPEC_1.md §15` — scoring engine first, UI second.
5. Test scoring logic in the browser console against the worked example in `SPEC_1.md §4.1`
   before wiring Firebase.

---

## File Structure

```
index.html              — single page, all views (landing / scorecard / scoreboard / penalty)
css/
  styles.css            — design tokens, layout, components
js/
  config.js             — CONFIG object (all tunables, see SPEC §13)
  firebase.js           — Firebase init + Firestore offline persistence
  scoring.js            — PURE scoring logic, no UI, no Firebase (build + test first)
  app.js                — view routing, shared state, nav
  scorecard.js          — personal scorecard view
  scoreboard.js         — live scoreboard, onSnapshot, GSAP Flip
  penalty.js            — 4-step penalty filing + dispute handling
  host.js               — host-only: reset / lock / adjudicate
  animations.js         — reusable GSAP helpers
Instructions/
  SPEC_1.md             — full game spec (source of truth)
_archive/               — old portfolio files (ignore)
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Shell | Vanilla JS SPA, one `index.html`, views toggled via show/hide + GSAP |
| Realtime | Firebase Firestore, `onSnapshot` listeners, offline persistence enabled |
| Animation | GSAP 3.12+ core + Flip plugin (CDN) |
| Hosting | GitHub Pages (static, deploys from `main` branch root) |
| Identity | `crypto.randomUUID()` stored in `localStorage` |

---

## Design Tokens

"Serious golf scorecard" aesthetic — restraint is the joke.

| Token | Value |
|---|---|
| Augusta green | `#1B4332` |
| Fairway | `#2D6A4F` |
| Grass | `#40916C` |
| Gold / flag | `#C99A2E` |
| Cream scorecard | `#F5F0E8` |
| Penalty red | `#8B1A1A` |
| Ink | `#1A1A1A` |
| Fonts | Playfair Display (headings/score terms), DM Mono (body/numerals) |

---

## CONFIG Values (set before first use)

See `js/config.js`. Key fields:

| Key | Value | Notes |
|---|---|---|
| `courseCode` | `"clynch"` | Case-insensitive join validation |
| `hostCode` | *(set in code)* | Grants host powers at join — keep private |
| `colinName` | `"Colin"` | Name match sets `isColin` crown |
| `colinAutoCredit` | `false` | Honest race — buying Colin a drink scores for buyer only |
| `disputeQuorum` | `2` | Players needed to void a penalty |

---

## Deployment

Push to `main` → GitHub Pages serves `index.html` automatically.
No build step required.
