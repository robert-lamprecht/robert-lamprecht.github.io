# Beltline Bar Crawl Golf — Build Specification

A mobile-first, real-time scorecard web app for a 5-hole bar crawl scored by golf rules.
**Lowest score wins, and the lowest score belongs to whoever drank the most.** Built for
Colin's birthday on the Atlanta Beltline.

This document is the source of truth for the build. All tunable values live in one
`CONFIG` block (see §13) so behavior can be changed without hunting through the code.

---

## 1. Summary

- **Players** join with a name + course code (`Clynch`) and land on a personal scorecard.
- Each player tracks **drinks, shots, bonuses, and "drinks bought for Colin"** per hole.
- A **live scoreboard** ranks everyone in real time (lowest total wins).
- Any player can **file a penalty stroke** on another player; filings are attributed, and
  can be **disputed** — if enough players agree a filing was false, it's voided and the
  filer takes a penalty instead.
- One player is the **host** (the user building this) with reset / lock / adjudicate powers.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| App shell | **Single-page app**, vanilla JS | One `index.html`; views toggled via show/hide + GSAP transitions. No framework, no build step — keeps GitHub Pages deploy trivial. |
| Data / realtime | **Firebase Firestore** | Free tier. `onSnapshot` listeners for live updates. Enable offline persistence for spotty outdoor signal. |
| Animation | **GSAP 3.12+** core + `Flip` + `ScrollTrigger` | All plugins free since 3.12. Load via CDN. |
| Hosting | **GitHub Pages** | Static. Firebase web config is client-side (expected); protect with Firestore security rules (§10). |
| Identity | `crypto.randomUUID()` `playerId` in `localStorage` | Name is a display label only — fixes duplicate-name collisions. |

---

## 3. Game Rules

### 3.1 The Course

| Hole | Bar | Par | Signature challenge (−1 bonus) |
|---|---|---|---|
| 1 | Park Tavern | 1 | Group photo with Piedmont Park behind you |
| 2 | New Realm | 1 | Order a beer flight (counts as 1 drink) |
| 3 | Painted Park | 1 | Win a bar game — "The Turn" / halfway house |
| 4 | Lady Bird | 1 | Order a mezcal anything |
| 5 | Pour Taphouse | 1 | Give a closing toast — the championship 18th |

Par for the course is **5** before any offsets; the displayed total is relative-to-par.

### 3.2 Scoring scale (per hole)

| Drinks at the bar | Term | Score |
|---|---|---|
| 0 | Bogey | +1 |
| 1 | Par | E (0) |
| 2 | Birdie | −1 |
| 3 | Eagle | −2 |
| 4 | Albatross | −3 |
| 5+ | (keeps dropping) | −4, −5, … **uncapped** |

> **Decision (resolved):** Score is **uncapped** below −3. A 5th drink is −4, a 6th is −5,
> and so on, for the truly committed.

### 3.3 What counts as a drink

- Any beer, cocktail, or glass of wine.
- A **shot** (counts as a full drink).
- **Buying Colin a drink** — counts toward **the buyer's** score, fully stackable, no limit.

> **Decision (resolved): honest race.** Buying Colin a drink lowers **only the buyer's**
> score. It is **not** credited to Colin's own card. Colin is expected to win, but wins on
> his own merits. See the design note in §3.6.

### 3.4 Bonuses (−1 each)

- Talked a stranger into joining the group.
- Won a bar game.
- Gave a toast.
- Completed the hole's signature challenge (§3.1).

Each bonus is a per-hole boolean (earn once per hole).

### 3.5 Penalties (+1 each)

- Spilled a drink.
- Didn't finish a drink (shots included).
- Left a bar before the group.
- Passed on a round everyone else joined.
- **False filing** — applied automatically to a player whose penalty filing is voted false (§5).

Penalties are filed by *other* players (you cannot penalize yourself), are fully attributed,
and are disputable. A single hole can carry multiple penalties of the same type.

### 3.6 Design note — the "buy Colin a drink" tension

Because buying Colin a drink lowers the **buyer's** score (not Colin's), a generous player can
out-score Colin. This is intentional under the honest-race decision: Colin must drink the most
himself to win. If this ever feels wrong in playtesting, the single-line alternative is to also
increment Colin's own `drinks` on that hole (the previously-discussed "auto-credit"). It is
**off** by default; expose it as `CONFIG.colinAutoCredit = false` so it can be flipped without
restructuring anything.

---

## 4. Scoring Engine

Build this **first**, as a pure module (`scoring.js`) with **no UI and no Firebase**. Unit-test
it in the console against the table in §3.2 before wiring anything else.

```text
// ---- per-hole ----
effectiveDrinks = hole.drinks + hole.colinDrinks   // shots already folded into hole.drinks
                                                    // colinDrinks scores identically to a drink

drinkScore =
    effectiveDrinks === 0 ?  +1                     // Bogey
  : effectiveDrinks === 1 ?   0                     // Par
  :                          -(effectiveDrinks - 1) // 2 -> -1, 3 -> -2, ... uncapped

bonusStrokes   = countTrue(hole.bonuses) * -1       // stranger, barGame, toast, signature

activePenalties = hole.penalties.filter(p => p.status === "active")
penaltyStrokes  = activePenalties.length * +1       // includes any "falseFiling" penalties

holeScore = drinkScore + bonusStrokes + penaltyStrokes

// ---- totals ----
totalScore = sum(holeScore for holes 1..5)
ranking    = players sorted ascending by totalScore   // lowest wins; tiebreak: earliest joinedAt
```

`colinDrinks` is tracked separately **only** for display/flavor (e.g. a "Drinks bought for
Colin" stat). For scoring it is identical to a normal drink. (It exists as its own field so the
UI can show a distinct gold "Buy Colin a drink" button and a running gift tally.)

### 4.1 Worked example (one player)

| Hole | drinks | colinDrinks | bonuses | active penalties | holeScore |
|---|---|---|---|---|---|
| 1 Park Tavern | 2 | 0 | photo | — | −2 |
| 2 New Realm | 1 | 1 | — | — | −1 |
| 3 Painted Park | 1 | 0 | — | didn't finish | +1 |
| 4 Lady Bird | 3 | 2 | toast | — | −5 |
| 5 Pour Taphouse | 2 | 0 | — | — | −1 |
| **Total** | | | | | **−8** |

---

## 5. Penalty & Dispute System

### 5.1 Filing

Any player files a penalty on another player via the penalty flow (§8.4): pick player → pick
hole → pick foul → confirm. This appends a penalty object (§7) with `status: "active"`,
`byPlayerId`, `byName`, and a timestamp, and fires a toast to the penalized player.

### 5.2 Disputing (the false-filing rule)

- The penalized player — or anyone — can **open a dispute** on any `active` penalty.
- Other players register agreement; each adds an entry to the penalty's `disputes` array.
- When `disputes.length >= CONFIG.disputeQuorum` (default **2** distinct players other than the
  original filer), the dispute **succeeds**:
  1. The penalty's `status` is set to `"voided"` (it stops counting in scoring immediately).
  2. A new penalty of type `"falseFiling"` (`status: "active"`) is appended to the **original
     filer's** record on the **same hole**, attributed to `byPlayerId: "system"`.
- The **host** can void any penalty directly without a quorum (acts as adjudicator), and can
  void a `falseFiling` penalty if it was triggered in error.
- `falseFiling` penalties are **not** themselves disputable by quorum (host-only to remove),
  preventing dispute loops.

> This is deliberately lightweight — it's a game among friends. The quorum and the whole
> mechanic can be disabled with `CONFIG.disputesEnabled = false`.

---

## 6. Host Role

One player is the host (the person running the crawl).

- **Designation:** at join, an optional **Host Code** field. If it matches `CONFIG.hostCode`,
  that player is flagged `isHost: true`. Leave `CONFIG.hostCode` as a placeholder for the user
  to set (e.g. `"____"`). Anyone without it joins as a normal player.
- **Powers (host-only UI, hidden from others):**
  - **Reset round** — clear all `holes` data for every player; keep the player roster.
  - **Lock final scores** — set `session.status = "final"`, freeze all inputs, trigger the
    winner-reveal on the scoreboard.
  - **Adjudicate** — void or restore any penalty (including `falseFiling`) directly.

---

## 7. Firestore Data Model

```text
sessions/clynch
  createdAt : timestamp
  status    : "active" | "final"          // host can lock

  players/{playerId}
    name      : string
    isColin   : bool                       // exactly one player; drives the crown badge
    isHost    : bool                        // set when Host Code matched at join
    joinedAt  : timestamp                   // also the ranking tiebreaker

    holes/{1..5}
      drinks      : number                  // includes shots
      colinDrinks : number                  // drinks this player bought for Colin (display + scores as a drink)
      bonuses     : { stranger: bool, barGame: bool, toast: bool, signature: bool }
      penalties   : [
        {
          id         : string,              // uuid
          type       : "spilledDrink" | "didntFinish" | "leftEarly" | "passedOnRound" | "falseFiling",
          byPlayerId : string,              // filer, or "system" for falseFiling
          byName     : string,
          at         : timestamp,
          status     : "active" | "voided",
          disputes   : [ { byPlayerId, byName, at } ]
        }
      ]
```

Notes:
- Penalties are an **array of objects** (not counters) so every stroke has an audit trail and a
  dispute log. Scoring counts only `status === "active"`.
- `isColin` is set on exactly one player. If Colin needs to be assigned at join, gate it behind
  the host or a known name match — your call; simplest is to hardcode Colin's name in `CONFIG`
  and flag the matching join.

---

## 8. App Structure & Views

Single page, three primary views behind a fixed bottom nav. Everything sized for one-thumb use
outdoors.

### 8.1 Landing / Join
- Inputs: **Name**, **Course Code**, optional **Host Code**.
- Course code validated case-insensitively against `CONFIG.courseCode` (`"clynch"`).
- Wrong code → GSAP horizontal shake on the input + inline error.
- Correct → create `players/{playerId}` in Firestore, store `playerId` in `localStorage`, GSAP
  slide-out to scorecard.
- If a valid `playerId` already exists in `localStorage`, skip straight to the scorecard.

### 8.2 Scorecard (personal — the home view)
- Sticky header: player name + live running total.
- Five hole cards, each with:
  - **Drink counter** — large − / + with a big number (fat-finger safe).
  - **Shot toggle/button** — increments the drink count.
  - **Buy Colin a drink** — distinct gold button, stackable; increments `colinDrinks`.
  - **Bonus chips** — stranger · bar game · toast · signature (tap to toggle).
  - **Incoming penalties** — read-only list showing type + who filed it, with a **Dispute**
    affordance per penalty.
  - **Hole score badge** — Birdie / Eagle / etc.; cross-fades on change.
- When `session.status === "final"`, inputs are frozen.

### 8.3 Scoreboard (live)
- Real-time ranked list via `onSnapshot`; lowest total on top; tiebreak by earliest `joinedAt`.
- Row: rank · name · per-hole mini scores · large total · rel-to-par.
- Colin always carries the crown badge regardless of rank; the viewer's own row is highlighted.
- Rows reorder with **GSAP Flip** as scores change.
- On `status === "final"`: winner-reveal sequence.

### 8.4 File a Penalty (4-step flow)
- Step 1 — pick a player (cannot pick yourself).
- Step 2 — pick the hole (1–5, big number buttons).
- Step 3 — pick the foul (pills).
- Step 4 — confirm → append penalty + fire toast to the target.

### 8.5 Bottom nav (fixed)
```
[ My Card ]   [ Scoreboard ]   [ Penalty ]
```
~60px tall, safe-area padding for the iPhone home bar, active tab gets a gold underline.
Host controls surface as an extra hidden section/button visible only when `isHost`.

---

## 9. Realtime & Offline

- Enable Firestore offline persistence (`enableIndexedDbPersistence` / persistent cache) so
  dropped signal on the Beltline doesn't lose taps; writes sync when the connection returns.
- Scorecard view listens to the player's own document (incoming penalties → toast).
- Scoreboard listens to the whole `players` subcollection.
- All interactions write immediately on tap — no save button.
- The Colin-related write is now a **single** increment to the buyer's `colinDrinks` (no batch,
  since auto-credit is off). If `CONFIG.colinAutoCredit` is ever turned on, that becomes a
  two-write batch (buyer + Colin) — note this for future-proofing.

---

## 10. Security Rules (Firestore)

Lightweight, appropriate for a friends' game, but not wide open:

- Restrict reads/writes to the `sessions/clynch` path.
- Allow document creation/updates only with the expected field shapes (basic schema validation).
- Consider a write guard so a client can only **append** to another player's `penalties` array
  (not overwrite their drinks/bonuses). Full enforcement is hard with the array model; if it
  proves fiddly, accept honor-system writes (it's a party game) but keep reads/writes scoped to
  the one session. Document whichever choice is made.

---

## 11. Design Tokens (brief)

Clean, "serious golf scorecard" aesthetic — restraint is the joke.

- **Colors:** Augusta green `#1B4332`, fairway `#2D6A4F`, grass `#40916C`, gold/flag `#C99A2E`,
  cream scorecard `#F5F0E8`, penalty red `#8B1A1A`, ink `#1A1A1A`.
- **Type:** Playfair Display (headings, score terms), DM Mono (body, numerals). No
  Inter/Roboto/system fonts.
- **Texture:** subtle green grid on dark surfaces; thin ruled lines between holes; flag glyph
  used sparingly.

---

## 12. GSAP Motion Plan (brief)

| Surface | Animation |
|---|---|
| Landing load | Title drops from top; inputs stagger up |
| Wrong code | Horizontal shake on input |
| Scorecard load | Hole cards stagger in (ScrollTrigger on scroll) |
| Drink tap | Number scale-bounce; score badge cross-fade |
| Bonus earned | Green check pops in |
| Penalty received | Red badge shakes in from side + toast |
| Dispute resolved | Voided penalty fades/strikes through |
| Scoreboard | Flip reorders rows; Colin's crown pulses on loop |
| Final lock | Winner-reveal sequence |

---

## 13. CONFIG (single source of tunables)

Put all knobs in one object so behavior changes never require code spelunking.

```js
const CONFIG = {
  courseCode: "clynch",        // case-insensitive
  hostCode: "____",            // SET THIS — grants host powers at join
  colinName: "Colin",          // matched at join to set isColin
  colinAutoCredit: false,      // honest race; true also credits Colin's own card
  disputesEnabled: true,
  disputeQuorum: 2,            // distinct players (besides filer) needed to void a penalty
  holes: [
    { n: 1, bar: "Park Tavern",   par: 1, signature: "Group photo with Piedmont Park" },
    { n: 2, bar: "New Realm",     par: 1, signature: "Order a beer flight" },
    { n: 3, bar: "Painted Park",  par: 1, signature: "Win a bar game (The Turn)" },
    { n: 4, bar: "Lady Bird",     par: 1, signature: "Order a mezcal anything" },
    { n: 5, bar: "Pour Taphouse", par: 1, signature: "Give a closing toast" },
  ],
  bonusTypes:   ["stranger", "barGame", "toast", "signature"],
  penaltyTypes: ["spilledDrink", "didntFinish", "leftEarly", "passedOnRound"],
};
```

---

## 14. File Structure

```
index.html              // single page, all views
/css/styles.css
/js/config.js           // CONFIG (§13)
/js/firebase.js         // init + offline persistence
/js/scoring.js          // PURE logic — build & test first
/js/app.js              // view routing + shared state
/js/scorecard.js
/js/scoreboard.js       // onSnapshot + Flip
/js/penalty.js          // filing + dispute handling
/js/host.js             // reset / lock / adjudicate (host-only)
/js/animations.js       // GSAP helpers
```

---

## 15. Build Order

1. Firebase project + Firestore + GitHub Pages repo; enable offline persistence.
2. `config.js` + `scoring.js` (pure) — test in console against §3.2 and §4.1.
3. Landing view: code validation, host-code check, player creation, GSAP entrance + shake.
4. Scorecard view: layout → Firestore wiring → drink / shot / Colin / bonus controls.
5. Scoreboard: `onSnapshot` ranking → GSAP Flip reordering.
6. Penalty flow: 4-step filing → append + toast.
7. Dispute system: open dispute → quorum check → auto-void + falseFiling write (§5).
8. Host module: reset round, lock final + winner reveal, adjudicate disputes.
9. Full GSAP pass; mobile QA on a real iPhone (tap targets, safe areas, offline reconnect).

---

## 16. Resolved Decisions & Edge Cases

- **Honest race:** `colinAutoCredit = false`. Buying Colin a drink scores for the buyer only.
  Accepted tension documented in §3.6.
- **Uncapped scoring:** below −3 the score keeps dropping (§3.2 / §4).
- **Attributed penalties:** every filing shows who filed it.
- **False filing:** quorum-based void + automatic +1 to the filer; host can override (§5).
- **Host:** the user, designated by `hostCode` at join (§6).
- **Identity:** UUID `playerId` in `localStorage`; names are display labels (handles duplicates).
- **Offline:** persistence on; writes queue and sync (§9).
- **Final state:** host lock freezes inputs and triggers winner reveal — the round has an end.
- **Single Colin:** exactly one player flagged `isColin`; if two people share the name, host
  resolves it (or assign via host UI).
- **Empty/early scoreboard:** before anyone scores, all players sit at par (0); render gracefully.
```
