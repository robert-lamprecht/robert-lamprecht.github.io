# CLAUDE.md — Agent Working Rules

This repo hosts **two sites** on GitHub Pages (user site, deploys from `main` root):

1. **Portfolio (root `/`)** — Robert Lamprecht's personal portfolio. Light Swiss minimal
   design. See "Portfolio" section below.
2. **Beltline Bar Crawl Golf (`/clynchgolf/`)** — real-time golf scorecard game.
   Unlisted: fully playable at its URL but never linked from the portfolio.
   **Read `Instructions/SPEC_1.md` before changing any game logic.**

Shared rules for both sites: vanilla JS only, no framework, no build step, GSAP for animation.

---

## Portfolio (root)

- **Files:** `index.html`, `css/main.css`, `js/main.js`
- **Design:** Light Swiss minimal — off-white paper (`#fafaf7`), ink (`#161613`),
  hairlines (`#d8d8d0`), single accent (`#e2421f`). Strict grid, numbered sections,
  sticky section titles, mono uppercase metadata.
- **Type:** Archivo (display) + IBM Plex Mono (metadata). Playfair Display / DM Mono
  belong to the game's identity — do not use them on the portfolio.
- **Animation:** GSAP 3.12 + ScrollTrigger (CDN). Signature moments only: masked hero
  line reveals, hairline `scaleX` draws, scroll reveals, contact-row hovers.
  All JS motion bails out under `prefers-reduced-motion`.
- **Sections:** 01 About · 02 Research · 03 Projects (placeholder) ·
  04 Studio (music — kids in the sand) · 05 Contact. Projects gets real content later.
- **Studio/music:** Robert's band is **kids in the sand** (Spotify artist
  `0inkPqTwKBJ5Cf64j5523w`). Presented as a Swiss-styled row that GSAP-expands to a
  lazy-loaded Spotify artist embed (iframe `src` set on first open only). The expand
  toggle must keep working under `prefers-reduced-motion` (it's bound before the
  reduced-motion early return in `js/main.js`). Cover art is hot-linked from
  Spotify's CDN via their oEmbed thumbnail.
- **Never link the game from the portfolio** without the user's say-so.

---

## Game: Beltline Bar Crawl Golf (`/clynchgolf/`)

- **What:** Mobile-first real-time golf scorecard for a bar crawl on the Atlanta Beltline.
- **Event:** Colin's birthday. This is time-sensitive — built to be used, not perfected.
- **Hosted:** GitHub Pages (static). Firebase Firestore for realtime data.
- **Stack:** Vanilla JS, no framework, no build step. GSAP 3.12+ for all animation.
- All game asset paths are relative, so the app works unchanged from the subdirectory.

---

## Source of Truth

`Instructions/SPEC_1.md` is the canonical game spec. When in doubt about rules, scoring,
data model, or feature behavior — check the spec first. Do not invent behavior that
contradicts it without flagging the conflict explicitly.

---

## Working Rules

### Always
- **Ask clarifying questions** before making ambiguous architectural decisions.
- **Build the scoring engine (`scoring.js`) first** and test it against `SPEC_1.md §4.1`
  before touching Firebase or UI. It must be a pure module with no side effects.
- **Follow the build order in `SPEC_1.md §15`** unless the user explicitly redirects.
- **Keep all tunables in `CONFIG`** (`js/config.js`). Never hardcode values that belong there.
- **Use GSAP for all animation** — no CSS transitions for interactive elements.
- **Size tap targets for one-thumb outdoor use** — minimum 48×48px, prefer larger.
- **Test scoring logic in the browser console** against the worked example before wiring UI.
- **Clean up active GSAP tweens** (`gsap.killTweensOf(el)`) before removing/replacing animated elements from the DOM to avoid memory leaks.
- **Check and unsubscribe active Firestore listeners** (`if (unsub) unsub()`) before re-subscribing on re-initialization or reconnect to prevent duplicate listener leaks.
- **Update this file** when new decisions are made, new files are added, or scope changes.

### Never
- Do not use a JS framework (React, Vue, etc.) — vanilla JS only.
- Do not add a build step — the site deploys directly from the repo root.
- Do not commit Firebase credentials as a placeholder value. Use a comment block.
- Do not change scoring logic without re-running the §4.1 worked example to verify.
- Do not let a player penalize themselves (enforced in `penalty.js`).
- Do not use Inter, Roboto, or system fonts — use Playfair Display + DM Mono only.

---

## Key Decisions (resolved — do not re-litigate without user approval)

| Decision | Value |
|---|---|
| Colin auto-credit | OFF (`colinAutoCredit: false`). Buying Colin a drink scores for the buyer only. |
| Scoring floor | None. Below −3 keeps dropping (5th drink = −4, 6th = −5, uncapped). Inactive holes score 0. |
| Penalty attribution | Every penalty records who filed it (`byPlayerId`, `byName`). |
| Dispute resolution | Host-mediated (no quorum). Penalties flagged as disputed on player card, reviewed and approved/denied in the host panel. |
| Dispute visibility | Pending disputes listed in Host panel only. |
| False filing | Disabled quorum voiding; falseFiling penalties not auto-appended (can be manually adjusted by host). |
| Identity | UUID in `localStorage`. Verified on load against Firestore. |
| Offline | Firestore persistence enabled. Writes queue and sync when connection returns. |
| Host designation | Matched at join via `CONFIG.hostCode`. |

---

## CONFIG Reference

```js
// js/config.js
const CONFIG = {
  courseCode: "clynch",
  hostCode: "robert92499",   // host designation at join
  colinName: "Colin",
  colinAutoCredit: false,
  disputesEnabled: true,
  disputeQuorum: 2,
  holes: [ /* see SPEC_1.md §13 */ ],
  bonusTypes:   ["stranger", "barGame", "toast", "signature"],
  penaltyTypes: ["spilledDrink", "didntFinish", "leftEarly", "passedOnRound"],
};
```

---

## File Map

```
index.html                — PORTFOLIO (hero/about/research/projects/studio/contact)
css/main.css              — portfolio styles
js/main.js                — portfolio GSAP (hero entrance, ScrollTrigger reveals)

clynchgolf/index.html     — GAME: all views, one file
clynchgolf/css/styles.css — game styles
clynchgolf/js/config.js   — CONFIG (tunables)
clynchgolf/js/firebase.js — Firebase init
clynchgolf/js/scoring.js  — PURE logic, no UI
clynchgolf/js/app.js      — routing, shared state
clynchgolf/js/scorecard.js  — personal scorecard
clynchgolf/js/scoreboard.js — live board + GSAP Flip
clynchgolf/js/penalty.js  — filing + dispute
clynchgolf/js/host.js     — host powers
clynchgolf/js/animations.js — GSAP helpers

Instructions/SPEC_1.md    — game source of truth
_archive/                 — earlier portfolio iteration (unused, kept for reference)
```

---

## Firebase Setup Status

- [x] Firebase project created (`beltline-bar-crawl`)
- [x] Firestore database enabled (us-central1, production mode)
- [x] Web app registered, `firebaseConfig` pasted into `js/firebase.js`
- [x] Offline persistence enabled in `js/firebase.js`
- [ ] Firestore security rules deployed (see SPEC §10)  ← deploy before going live

## Current Build Status

Track progress against `SPEC_1.md §15`:

- [x] 1. Firebase + Firestore + offline persistence
- [x] 2. `config.js` + `scoring.js` (pure) — verified against §4.1
- [x] 3. Landing view — validation, join, GSAP entrance
- [x] 4. Scorecard view — layout + Firestore wiring + controls (fixed listener leak)
- [x] 5. Scoreboard — `onSnapshot` + GSAP Flip + session listener (fixed memory leak on crown badge)
- [x] 6. Penalty flow — 4-step filing + toast
- [x] 7. Dispute system — host-mediated dispute review (no quorum, simplified to host adjudicating)
- [x] 8. Host module — reset / lock / winner reveal / adjudicate (fixed listener leak)
- [x] 9. `css/styles.css` — design tokens, mobile layout, all components
- [x] 10. Mobile QA on real iPhone + offline reconnect test (completed baseline audit)

---

## Audit Updates & Resolved Issues

The RealtimeAuditor completed the codebase audit on 2026-06-06 and resolved several critical items:
1. **Shoutbox Detached Input Bug**: Fixed `js/app.js` where cloning the form detached the cached input element, rendering the chat box inert. It now queries the active input from the cloned element.
2. **Duplicate Listener Registrations**: Added init flags (`_buttonsBound` in `js/penalty.js` and `_controlsBound` in `js/host.js`) to prevent multiple click listener registrations if screens or modules are re-initialized.
3. **One-Thumb Touch Targets**: Added a general pseudo-element touch target expander (`::after`) in `css/styles.css` for all `.btn`, `.chip`, `.top-bar-rules-btn`, `.rules-close-btn`, and `.btn-link` selectors to guarantee a minimum `48x48px` clickable zone without visual layout changes.
4. **Keyboard Confetti Coordinates**: Added safe fallbacks inside `Animations.confettiBlast` (`js/animations.js`) to target the screen center when `x` or `y` coordinates are not numbers (e.g. keyboard triggers).

---

## RealtimeAuditor Rules & Schedule

To ensure long-term code quality, lack of memory leaks, and seamless coordination between agents, the following guidelines and schedule are enforced by the RealtimeAuditor.

### Subagent Cooperation Rules
1. **No Frameworks or Bundlers**: All code must remain vanilla HTML/CSS/JS without React/Vue/etc. or Vite/Webpack/etc.
2. **GSAP Memory Leak Prevention**: Always check for infinite animation loops (e.g., `repeat: -1`). If elements with infinite animations are replaced or removed from the DOM, explicitly run `gsap.killTweensOf(el)` on those elements or their containers first.
3. **Firestore Listener Lifecycle**: To prevent duplicate events and slow performance, any module initializing a Firestore listener on a collection or document must store the unsubscribe function and check/call it before registering a new one (e.g., `if (unsub) unsub()`).
4. **Scoring Engine Purity**: The scoring engine in `js/scoring.js` must remain a pure utility module with zero side effects. Any updates must be verified against the test suite (`scoring.runTests()`).
5. **Event Listener Duplication Prevention**: Guard static event listeners inside setup/binding procedures (such as `bindControls()` or `init()`) using a stateful initialization flag (e.g., `_buttonsBound = true`) so listeners are not registered multiple times if the screen/module re-initializes.
6. **Touch Target Accessibility Compliance**: Ensure all interactive elements (buttons, chips, anchors) have a minimum touch target size of `48x48px`. Visual dimensions can be smaller if wrapped with a `position: relative` container and an absolute `::after` overlay matching `min-width: 48px; min-height: 48px;`.
7. **Safe Animation Coordinates**: Any animation helpers triggered by event coordinates (like confetti blasts or popup positions) must provide default screen-center coordinates to handle keyboard triggers safely without throwing JS errors.

### Audit Schedule
- **Baseline Audit**: Run at the start of any feature implementation.
- **Listener Audit**: Review every Firestore `onSnapshot` connection after modifying state management files.
- **GSAP Audit**: Verify that all animation tweens are properly terminated when UI elements transition or get destroyed.
- **Release Audit**: Check credentials safety and Firestore rules before final deployment.

---

## Open Questions (update as resolved)

- *(None - all initial setup questions resolved)*

