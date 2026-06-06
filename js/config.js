// ─── CONFIG — single source of all tunables ───────────────────────────────────
// Change behaviour here, never in other files.

const CONFIG = {
  courseCode:       'clynch',       // case-insensitive join validation
  hostCode:         'robert92499',  // grants isHost at join — keep private
  colinName:        'Colin',        // name match sets isColin crown badge
  colinAutoCredit:  false,          // honest race: buying Colin a drink scores for buyer only
  disputesEnabled:  true,
  disputeQuorum:    2,              // distinct players (excl. filer) needed to void a penalty

  holes: [
    { n: 1, bar: 'Park Tavern',   par: 1, signature: 'Group photo with Piedmont Park behind you' },
    { n: 2, bar: 'New Realm',     par: 1, signature: 'Order a beer flight (counts as 1 drink)'   },
    { n: 3, bar: 'Painted Park',  par: 1, signature: 'Win a bar game — "The Turn"'                },
    { n: 4, bar: 'Lady Bird',     par: 1, signature: 'Order a mezcal anything'                    },
    { n: 5, bar: 'Pour Taphouse', par: 1, signature: 'Give a closing toast'                       },
  ],

  bonusTypes:   ['stranger', 'barGame', 'toast', 'signature'],
  penaltyTypes: ['spilledDrink', 'didntFinish', 'leftEarly', 'passedOnRound'],

  // Human-readable labels for UI display
  bonusLabels: {
    stranger:  'Recruited a stranger',
    barGame:   'Won a bar game',
    toast:     'Gave a toast',
    signature: 'Signature challenge',
  },
  penaltyLabels: {
    spilledDrink:  'Spilled a drink',
    didntFinish:   "Didn't finish a drink",
    leftEarly:     'Left before the group',
    passedOnRound: 'Passed on a round',
    falseFiling:   'False filing (auto)',
  },

  // Score term labels (relative to effectiveDrinks per hole)
  scoreTerm(holeScore) {
    if (holeScore >=  2) return 'Double Bogey+';
    if (holeScore ===  1) return 'Bogey';
    if (holeScore ===  0) return 'Par';
    if (holeScore === -1) return 'Birdie';
    if (holeScore === -2) return 'Eagle';
    if (holeScore === -3) return 'Albatross';
    return `−${Math.abs(holeScore)} (Legendary)`;
  },
};
