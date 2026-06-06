// ─── firebase.js — Firebase init + Firestore offline persistence ──────────────
//
// SETUP: Paste your firebaseConfig object from the Firebase Console below.
// Get it at: Firebase Console → Project Settings → Your apps → SDK setup and config
//
// The config is intentionally client-side — Firebase security rules (see SPEC §10)
// scope what any client can actually read or write.

const firebaseConfig = {
  apiKey:            'AIzaSyDDLijWwrvsXaY5sI3JWragI6rSifwzS2g',
  authDomain:        'beltline-bar-crawl.firebaseapp.com',
  projectId:         'beltline-bar-crawl',
  storageBucket:     'beltline-bar-crawl.firebasestorage.app',
  messagingSenderId: '531380195547',
  appId:             '1:531380195547:web:5251757d3e62f8f43cbcfe',
};

// ── Init ───────────────────────────────────────────────────────────────────────
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

// Enable offline persistence so dropped signal on the Beltline doesn't lose taps.
// Writes queue locally and sync when connection returns.
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open — persistence only works in one tab at a time in this mode.
      console.warn('Firestore persistence unavailable: multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      // Browser doesn't support persistence.
      console.warn('Firestore persistence not supported in this browser.');
    }
  });

// ── Session helpers ────────────────────────────────────────────────────────────

const SESSION_ID = 'clynch';

const sessionRef  = () => db.collection('sessions').doc(SESSION_ID);
const playersRef  = () => sessionRef().collection('players');
const playerRef   = (id) => playersRef().doc(id);
const holesRef    = (playerId) => playerRef(playerId).collection('holes');
const holeRef     = (playerId, n) => holesRef(playerId).doc(String(n));

// ── Exports ────────────────────────────────────────────────────────────────────
// Use these throughout the app — never build paths manually elsewhere.

const DB = { db, sessionRef, playersRef, playerRef, holesRef, holeRef, SESSION_ID };
