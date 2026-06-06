// ─── app.js — view routing, shared state, join flow ──────────────────────────

const App = (() => {

  // ── Shared state ────────────────────────────────────────────────────────────

  const state = {
    playerId:   null,
    playerName: null,
    isHost:     false,
    isColin:    false,
    unsubscribers: [],  // active Firestore listeners to clean up
  };

  // ── View routing ─────────────────────────────────────────────────────────────

  const views = ['landing', 'scorecard', 'scoreboard', 'penalty'];

  function showView(name) {
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (!el) return;
      const isTarget = v === name;
      el.hidden   = !isTarget;
      el.classList.toggle('active', isTarget);
    });

    // Sync bottom nav active tab
    document.querySelectorAll('.nav-tab[data-view]').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === name);
    });

    // Per-view hooks
    if (name === 'penalty' && typeof Penalty !== 'undefined') Penalty.onShow();
  }

  // ── Bottom nav ───────────────────────────────────────────────────────────────

  function initNav() {
    document.querySelectorAll('.nav-tab[data-view]').forEach(tab => {
      tab.addEventListener('click', () => showView(tab.dataset.view));
    });

    document.getElementById('host-tab')?.addEventListener('click', () => {
      document.getElementById('host-panel').hidden = false;
    });
  }

  // ── Join flow ────────────────────────────────────────────────────────────────

  function initJoin() {
    // If returning player, skip landing
    const savedId = localStorage.getItem('playerId');
    if (savedId) {
      state.playerId = savedId;
      state.playerName = localStorage.getItem('playerName') || '';
      state.isHost     = localStorage.getItem('isHost') === 'true';
      state.isColin    = localStorage.getItem('isColin') === 'true';
      afterJoin();
      return;
    }

    Animations.landingEntrance();

    document.getElementById('join-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const name     = document.getElementById('input-name').value.trim();
      const code     = document.getElementById('input-code').value.trim();
      const hostCode = document.getElementById('input-host').value.trim();
      const errEl    = document.getElementById('code-error');

      // Validate course code
      if (code.toLowerCase() !== CONFIG.courseCode.toLowerCase()) {
        errEl.hidden = false;
        Animations.shake(document.getElementById('input-code'));
        return;
      }
      errEl.hidden = true;

      const playerId = crypto.randomUUID();
      const isHost   = hostCode === CONFIG.hostCode;
      const isColin  = name.toLowerCase() === CONFIG.colinName.toLowerCase();

      // Build empty holes map (stored flat inside the player doc)
      const holes = {};
      CONFIG.holes.forEach(h => { holes[h.n] = scoring.emptyHole(); });

      const playerData = {
        name,
        isColin,
        isHost,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        holes,   // flat map — no subcollection needed
      };

      try {
        // Ensure session doc exists
        await DB.sessionRef().set(
          { createdAt: firebase.firestore.FieldValue.serverTimestamp(), status: 'active' },
          { merge: true }
        );

        // Create player doc (holes included — one write, no batch)
        await DB.playerRef(playerId).set(playerData);

        // Persist locally
        localStorage.setItem('playerId',   playerId);
        localStorage.setItem('playerName', name);
        localStorage.setItem('isHost',     String(isHost));
        localStorage.setItem('isColin',    String(isColin));

        state.playerId   = playerId;
        state.playerName = name;
        state.isHost     = isHost;
        state.isColin    = isColin;

        afterJoin();
      } catch (err) {
        console.error('Join error:', err);
        Animations.showToast('Could not join — check connection.', 'error');
      }
    });
  }

  function afterJoin() {
    // Show name in header
    document.getElementById('player-name-header').textContent = state.playerName;

    // Show host tab if applicable
    if (state.isHost) {
      document.getElementById('host-tab').hidden = false;
    }

    // Show nav + switch to scorecard
    document.getElementById('bottom-nav').hidden = false;
    showView('scorecard');

    // Boot modules
    Scorecard.init(state);
    Scoreboard.init(state);
    Penalty.init(state);
    if (state.isHost) Host.init(state);
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    initNav();
    initJoin();
  }

  return { init, state, showView };
})();

// Boot
document.addEventListener('DOMContentLoaded', App.init);
