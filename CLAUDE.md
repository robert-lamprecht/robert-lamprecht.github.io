# CLAUDE.md — Agent Working Rules for Beltline Bar Crawl Golf

This file governs how AI agents should work on this project.
**Read this file and `Instructions/SPEC_1.md` before making any changes.**

---

## Project Identity

- **What:** Mobile-first real-time golf scorecard for a bar crawl on the Atlanta Beltline.
- **Event:** Colin's birthday. This is time-sensitive — built to be used, not perfected.
- **Hosted:** GitHub Pages (static). Firebase Firestore for realtime data.
- **Stack:** Vanilla JS, no framework, no build step. GSAP 3.12+ for all animation.

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
- **Update this file** when new decisions are made, new files are added, or scope changes.

### Never
- Do not use a JS framework (React, Vue, etc.) — vanilla JS only.
- Do not add a build step — the site deploys directly from the repo root.
- Do not commit Firebase credentials as a placeholder value. Use a comment block.
- Do not change scoring logic without re-running the §4.1 worked example to verify.
- Do not let a player penalize themselves (enforced in `penalty.js`).
- Do not make `falseFiling` penalties disputable by quorum (host-only to remove).
- Do not use Inter, Roboto, or system fonts — use Playfair Display + DM Mono only.

---

## Key Decisions (resolved — do not re-litigate without user approval)

| Decision | Value |
|---|---|
| Colin auto-credit | OFF (`colinAutoCredit: false`). Buying Colin a drink scores for the buyer only. |
| Scoring floor | None. Below −3 keeps dropping (5th drink = −4, 6th = −5, uncapped). Inactive holes score 0. |
| Penalty attribution | Every penalty records who filed it (`byPlayerId`, `byName`). |
| False filing | Quorum void → auto +1 on filer. Host can override. falseFiling not quorum-disputable. |
| Identity | UUID in `localStorage`. Verified on load against Firestore. |
| Offline | Firestore persistence enabled. Writes queue and sync when connection returns. |
| Host designation | Matched at join via `CONFIG.hostCode`. |
| Dispute visibility | Publicly listed in Penalty tab to allow voting. |

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
index.html          — all views, one file
css/styles.css      — all styles
js/config.js        — CONFIG (tunables)
js/firebase.js      — Firebase init (PASTE CONFIG HERE when available)
js/scoring.js       — PURE logic, no UI, build first
js/app.js           — routing, shared state
js/scorecard.js     — personal scorecard
js/scoreboard.js    — live board + GSAP Flip
js/penalty.js       — filing + dispute
js/host.js          — host powers
js/animations.js    — GSAP helpers
Instructions/SPEC_1.md  — source of truth
```

---

## Firebase Setup Status

- [x] Firebase project created (`beltline-bar-crawl`)
- [ ] Firestore database enabled (us-central1, production mode)  ← verify in console
- [x] Web app registered, `firebaseConfig` pasted into `js/firebase.js`
- [x] Offline persistence enabled in `js/firebase.js`
- [ ] Firestore security rules deployed (see SPEC §10)  ← deploy before going live

---

## Current Build Status

Track progress against `SPEC_1.md §15`:

- [x] 1. Firebase + Firestore + offline persistence
- [x] 2. `config.js` + `scoring.js` (pure) — verified against §4.1
- [x] 3. Landing view — validation, join, GSAP entrance
- [x] 4. Scorecard view — layout + Firestore wiring + controls
- [x] 5. Scoreboard — `onSnapshot` + GSAP Flip + session listener
- [x] 6. Penalty flow — 4-step filing + toast
- [x] 7. Dispute system — quorum + auto-void + falseFiling
- [x] 8. Host module — reset / lock / winner reveal / adjudicate
- [x] 9. `css/styles.css` — design tokens, mobile layout, all components
- [ ] 10. Mobile QA on real iPhone + offline reconnect test

---

## Open Questions (update as resolved)

- Firebase `firebaseConfig` object: **waiting on user to paste from Firebase Console**
