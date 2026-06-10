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

  partyQuestions: [
    { cat: 'trivia', q: "How long is the entire Atlanta Beltline loop when completed? (Answer: 22 miles)" },
    { cat: 'trivia', q: "What style of beer was traditionally brewed to survive the long sea voyage from England to India? (Answer: IPA)" },
    { cat: 'trivia', q: "Which golfer has won the most Masters Tournaments at Augusta National? (Answer: Jack Nicklaus - 6 times)" },
    { cat: 'trivia', q: "What Atlanta landmark was originally built for the 1996 Summer Olympic Games? (Answer: Centennial Olympic Park)" },
    { cat: 'trivia', q: "What does 'OG' stand for in craft beer terms? (Answer: Original Gravity)" },
    { cat: 'trivia', q: "Which Atlanta neighborhood is famous for the Krog Street Tunnel street art? (Answer: Cabbagetown)" },
    { cat: 'trivia', q: "What is the term for scoring 3 strokes under par on a single hole in golf? (Answer: Albatross)" },
    { cat: 'trivia', q: "Which ingredient is responsible for adding bitterness and aroma to beer? (Answer: Hops)" },
    { cat: 'trivia', q: "What year was Atlanta founded? (Answer: 1847 - originally Terminus in 1837)" },
    { cat: 'trivia', q: "How many holes are on a standard golf course? (Answer: 18)" },
    { cat: 'never',  q: "Never have I ever lied about my score on a scorecard." },
    { cat: 'never',  q: "Never have I ever ordered a drink I couldn't finish." },
    { cat: 'never',  q: "Never have I ever spilled a full drink on the Beltline." },
    { cat: 'never',  q: "Never have I ever taken a shot of fernet." },
    { cat: 'never',  q: "Never have I ever lost a phone during a bar crawl." },
    { cat: 'never',  q: "Never have I ever bought a stranger a drink to get a golf bonus." },
    { cat: 'never',  q: "Never have I ever tried to cheat on a penalty dispute." },
    { cat: 'never',  q: "Never have I ever ordered a non-alcoholic drink and claimed it had alcohol." },
    { cat: 'never',  q: "Never have I ever fallen down on the Beltline." },
    { cat: 'never',  q: "Never have I ever finished someone else's left-behind drink." },
    { cat: 'truth',  q: "What is the worst drink you have ever ordered just to look cool?" },
    { cat: 'truth',  q: "Who in the group would you trust least to manage the scoreboard?" },
    { cat: 'truth',  q: "What is your go-to excuse when you want to leave a bar crawl early?" },
    { cat: 'truth',  q: "Which bar on today's crawl is your absolute favorite, and why?" },
    { cat: 'truth',  q: "Have you ever secretly voided a penalty filed against yourself when no one was looking?" },
    { cat: 'truth',  q: "What is the most embarrassing thing you've done after having too many drinks?" },
    { cat: 'truth',  q: "If you had to swap scores with anyone on the leaderboard right now, who would it be?" },
    { cat: 'truth',  q: "Who is the most competitive person on this crawl?" },
    { cat: 'truth',  q: "What is the absolute maximum number of drinks you've ever had in a single day?" },
    { cat: 'truth',  q: "Which player in this game is currently the biggest threat to win?" },
    { cat: 'dare',   q: "Propose a toast to the next stranger you make eye contact with." },
    { cat: 'dare',   q: "Speak with a fake British accent until we reach the next bar." },
    { cat: 'dare',   q: "Let the person to your left rewrite one of your scorecard bonuses." },
    { cat: 'dare',   q: "Balance a coaster on your head for the next 2 minutes without it falling." },
    { cat: 'dare',   q: "High-five three people you don't know who are wearing green." },
    { cat: 'dare',   q: "Order your next drink while talking like a golf commentator." },
    { cat: 'dare',   q: "Do a dramatic slow-motion golf swing right now." },
    { cat: 'dare',   q: "Find someone not in our group and convince them to toast your group." },
    { cat: 'dare',   q: "Take a photo with a dog on the Beltline (must ask owner first!)." },
    { cat: 'dare',   q: "Serenade a drink of your choice with a short love song." }
  ],
};
