// ─── scoring.js — PURE scoring logic ─────────────────────────────────────────
// No UI. No Firebase. No side effects.
// Build and test this first against SPEC_1.md §4.1 before wiring anything else.
//
// Test in the browser console:
//   scoring.runTests()   → should log all PASS

const scoring = (() => {

  // ── Per-hole score ──────────────────────────────────────────────────────────
  //
  // effectiveDrinks = hole.drinks + hole.colinDrinks
  //   0 drinks → +1  (Bogey)
  //   1 drink  →  0  (Par)
  //   2+       → -(effectiveDrinks - 1)  (uncapped below -3)
  //
  // bonusStrokes   = count of true bonuses × -1
  // penaltyStrokes = count of active penalties × +1
  // holeScore      = drinkScore + bonusStrokes + penaltyStrokes

  function holeScore(hole) {
    const effectiveDrinks = (hole.drinks || 0) + (hole.colinDrinks || 0);

    const drinkScore =
      effectiveDrinks === 0 ?  1
    : effectiveDrinks === 1 ?  0
    :                         -(effectiveDrinks - 1);

    const bonuses = hole.bonuses || {};
    const bonusStrokes = Object.values(bonuses).filter(Boolean).length * -1;

    const penalties = hole.penalties || [];
    const penaltyStrokes = penalties.filter(p => p.status === 'active').length;

    return drinkScore + bonusStrokes + penaltyStrokes;
  }

  // ── Total score across all holes ────────────────────────────────────────────

  function totalScore(holesMap) {
    // holesMap: { 1: holeData, 2: holeData, ... } or an array
    const values = Array.isArray(holesMap) ? holesMap : Object.values(holesMap);
    return values.reduce((sum, h) => sum + holeScore(h), 0);
  }

  // ── Rank players ────────────────────────────────────────────────────────────
  // Returns players sorted ascending by totalScore; tiebreak: earliest joinedAt.

  function rankPlayers(players) {
    return [...players].sort((a, b) => {
      const scoreDiff = totalScore(a.holes || {}) - totalScore(b.holes || {});
      if (scoreDiff !== 0) return scoreDiff;
      // tiebreak: earlier joinedAt wins
      const aTime = a.joinedAt?.toMillis?.() ?? a.joinedAt ?? 0;
      const bTime = b.joinedAt?.toMillis?.() ?? b.joinedAt ?? 0;
      return aTime - bTime;
    });
  }

  // ── Empty hole template ─────────────────────────────────────────────────────

  function emptyHole() {
    return {
      drinks:      0,
      colinDrinks: 0,
      bonuses:     { stranger: false, barGame: false, toast: false, signature: false },
      penalties:   [],
    };
  }

  // ── Tests — run against SPEC_1.md §4.1 worked example ─────────────────────

  function runTests() {
    let passed = 0;
    let failed = 0;

    function assert(label, actual, expected) {
      if (actual === expected) {
        console.log(`  PASS  ${label}: ${actual}`);
        passed++;
      } else {
        console.error(`  FAIL  ${label}: expected ${expected}, got ${actual}`);
        failed++;
      }
    }

    console.group('scoring.runTests()');

    // § 3.2 drink score table
    assert('0 drinks → +1 (Bogey)',    holeScore({ drinks: 0, colinDrinks: 0, bonuses: {}, penalties: [] }),  1);
    assert('1 drink  →  0 (Par)',       holeScore({ drinks: 1, colinDrinks: 0, bonuses: {}, penalties: [] }),  0);
    assert('2 drinks → -1 (Birdie)',    holeScore({ drinks: 2, colinDrinks: 0, bonuses: {}, penalties: [] }), -1);
    assert('3 drinks → -2 (Eagle)',     holeScore({ drinks: 3, colinDrinks: 0, bonuses: {}, penalties: [] }), -2);
    assert('4 drinks → -3 (Albatross)',holeScore({ drinks: 4, colinDrinks: 0, bonuses: {}, penalties: [] }), -3);
    assert('5 drinks → -4 (uncapped)', holeScore({ drinks: 5, colinDrinks: 0, bonuses: {}, penalties: [] }), -4);
    assert('6 drinks → -5 (uncapped)', holeScore({ drinks: 6, colinDrinks: 0, bonuses: {}, penalties: [] }), -5);

    // Colin drinks score as drinks for the buyer
    assert('1 drink + 1 colinDrink → -1 (Birdie)',
      holeScore({ drinks: 1, colinDrinks: 1, bonuses: {}, penalties: [] }), -1);

    // Bonus strokes
    assert('1 drink + 1 bonus → -1',
      holeScore({ drinks: 1, colinDrinks: 0, bonuses: { stranger: true }, penalties: [] }), -1);
    assert('1 drink + 2 bonuses → -2',
      holeScore({ drinks: 1, colinDrinks: 0, bonuses: { stranger: true, barGame: true }, penalties: [] }), -2);

    // Penalty strokes
    assert('1 drink + 1 active penalty → +1',
      holeScore({ drinks: 1, colinDrinks: 0, bonuses: {},
        penalties: [{ status: 'active' }] }), 1);
    assert('voided penalty not counted',
      holeScore({ drinks: 1, colinDrinks: 0, bonuses: {},
        penalties: [{ status: 'voided' }] }), 0);

    // § 4.1 worked example — exact values
    const workedExample = [
      // Hole 1: 2 drinks, 0 colin, photo bonus → -2
      { drinks: 2, colinDrinks: 0, bonuses: { signature: true }, penalties: [] },
      // Hole 2: 1 drink, 1 colin → effectiveDrinks=2 → -1
      { drinks: 1, colinDrinks: 1, bonuses: {}, penalties: [] },
      // Hole 3: 1 drink, 0 colin, 1 active penalty → +1
      { drinks: 1, colinDrinks: 0, bonuses: {}, penalties: [{ status: 'active' }] },
      // Hole 4: 3 drinks, 2 colin → effectiveDrinks=5 → -4, + toast bonus → -5
      { drinks: 3, colinDrinks: 2, bonuses: { toast: true }, penalties: [] },
      // Hole 5: 2 drinks, 0 colin → -1
      { drinks: 2, colinDrinks: 0, bonuses: {}, penalties: [] },
    ];

    assert('§4.1 Hole 1', holeScore(workedExample[0]), -2);
    assert('§4.1 Hole 2', holeScore(workedExample[1]), -1);
    assert('§4.1 Hole 3', holeScore(workedExample[2]),  1);
    assert('§4.1 Hole 4', holeScore(workedExample[3]), -5);
    assert('§4.1 Hole 5', holeScore(workedExample[4]), -1);
    assert('§4.1 Total',  totalScore(workedExample),   -8);

    console.log(`\n${passed} passed, ${failed} failed`);
    console.groupEnd();
    return failed === 0;
  }

  return { holeScore, totalScore, rankPlayers, emptyHole, runTests };
})();
