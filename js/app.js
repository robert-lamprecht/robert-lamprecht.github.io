// ─── app.js — view routing, shared state, join flow ──────────────────────────

const App = (() => {

  // ── Shared state ─────────────────────────────────────────────────────────────

  const state = {
    playerId:   null,
    playerName: null,
    isHost:     false,
    isColin:    false,
    unsubscribers: [],
  };

  // ── Pending join (lives across the name-conflict modal interaction) ───────────

  let _pendingName   = null;
  let _pendingIsHost = false;
  let _pendingReturn = null;

  // ── localStorage helpers ──────────────────────────────────────────────────────

  function saveLocalPlayer(id, name, isHost, isColin) {
    localStorage.setItem('playerId',   id);
    localStorage.setItem('playerName', name);
    localStorage.setItem('isHost',     String(isHost));
    localStorage.setItem('isColin',    String(isColin));
  }

  function clearLocalPlayer() {
    ['playerId', 'playerName', 'isHost', 'isColin'].forEach(k => localStorage.removeItem(k));
  }

  // ── View routing ─────────────────────────────────────────────────────────────

  const views = ['landing', 'scorecard', 'scoreboard', 'penalty'];

  function showView(name) {
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (!el) return;
      el.hidden = v !== name;
      el.classList.toggle('active', v === name);
    });

    document.querySelectorAll('.nav-tab[data-view]').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === name);
    });

    if (name === 'penalty' && typeof Penalty !== 'undefined') Penalty.onShow();
  }

  // ── Bottom nav ────────────────────────────────────────────────────────────────

  function initNav() {
    document.querySelectorAll('.nav-tab[data-view]').forEach(tab => {
      tab.addEventListener('click', () => showView(tab.dataset.view));
    });
    document.getElementById('host-tab')?.addEventListener('click', () => {
      document.getElementById('host-panel').hidden = false;
    });
  }

  // ── Join flow ─────────────────────────────────────────────────────────────────

  async function initJoin() {
    // ?reset in URL → clear localStorage and force landing (useful for recovery/testing)
    if (new URLSearchParams(location.search).has('reset')) {
      clearLocalPlayer();
      history.replaceState(null, '', location.pathname);
    }

    const savedId = localStorage.getItem('playerId');

    if (savedId) {
      // Verify the saved player doc still exists in Firestore before auto-joining.
      // Handles stale test data, schema changes, and host resets.
      try {
        const snap = await DB.playerRef(savedId).get();
        if (snap.exists) {
          const data = snap.data();
          state.playerId   = savedId;
          state.playerName = data.name                              || localStorage.getItem('playerName') || '';
          state.isHost     = data.isHost  ?? (localStorage.getItem('isHost')  === 'true');
          state.isColin    = data.isColin ?? (localStorage.getItem('isColin') === 'true');
          // Keep localStorage in sync with Firestore truth
          saveLocalPlayer(savedId, state.playerName, state.isHost, state.isColin);
          afterJoin();
          return;
        }
        // Doc not found — player was reset or never created. Clear + show landing.
        clearLocalPlayer();
        Animations.showToast('Session expired — please rejoin.', 'info');
      } catch (e) {
        if (!navigator.onLine) {
          // Offline: trust localStorage optimistically
          state.playerId   = savedId;
          state.playerName = localStorage.getItem('playerName') || '';
          state.isHost     = localStorage.getItem('isHost')  === 'true';
          state.isColin    = localStorage.getItem('isColin') === 'true';
          afterJoin();
          return;
        }
        // Online error: something unexpected — fall through to landing
        clearLocalPlayer();
      }
    }

    showLanding();
  }

  function showLanding() {
    // Landing is already visible in the initial HTML — just wire up events
    Animations.landingEntrance();

    let _hostMode = false;

    document.getElementById('host-btn').addEventListener('click', () => {
      _hostMode = !_hostMode;
      document.getElementById('host-code-wrap').hidden = !_hostMode;
      document.getElementById('host-btn').classList.toggle('btn--active', _hostMode);
      if (_hostMode) document.getElementById('input-host')?.focus();
    });

    document.getElementById('join-form').addEventListener('submit', e => {
      e.preventDefault();
      handleJoin(false);
    });

    document.getElementById('host-confirm-btn').addEventListener('click', () => handleJoin(true));

    document.getElementById('conflict-return-btn').addEventListener('click', () => {
      if (_pendingReturn) joinAsReturning(_pendingReturn);
    });
    document.getElementById('conflict-new-btn').addEventListener('click', () => {
      joinAsNew(_pendingName, _pendingIsHost);
    });
    document.getElementById('conflict-cancel-btn').addEventListener('click', hideConflict);
  }

  // ── Join handlers ─────────────────────────────────────────────────────────────

  async function handleJoin(isHost) {
    const nameInput = document.getElementById('input-name');
    const name = nameInput.value.trim();

    if (!name) {
      Animations.shake(nameInput);
      return;
    }

    if (isHost) {
      const hostInput = document.getElementById('input-host');
      if ((hostInput?.value.trim() || '') !== CONFIG.hostCode) {
        Animations.shake(hostInput);
        Animations.showToast('Wrong host code.', 'error');
        return;
      }
    }

    _pendingName   = name;
    _pendingIsHost = isHost;

    // Check for an existing player with this name (case-insensitive full roster read —
    // fine for a party game with < 20 players)
    try {
      const snap = await DB.playersRef().get();
      const existing = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(p => p.name.toLowerCase() === name.toLowerCase());

      if (existing) {
        _pendingReturn = existing;
        showConflict(existing.name);
      } else {
        await joinAsNew(name, isHost);
      }
    } catch (e) {
      console.error('Name check error:', e);
      await joinAsNew(name, isHost);
    }
  }

  async function joinAsNew(name, isHost) {
    hideConflict();

    const playerId = crypto.randomUUID();
    const isColin  = name.toLowerCase() === CONFIG.colinName.toLowerCase();

    const holes = {};
    CONFIG.holes.forEach(h => { holes[h.n] = scoring.emptyHole(); });

    const playerData = { name, isColin, isHost, joinedAt: firebase.firestore.FieldValue.serverTimestamp(), holes };

    try {
      await DB.sessionRef().set(
        { createdAt: firebase.firestore.FieldValue.serverTimestamp(), status: 'active' },
        { merge: true }
      );
      await DB.playerRef(playerId).set(playerData);

      saveLocalPlayer(playerId, name, isHost, isColin);
      state.playerId   = playerId;
      state.playerName = name;
      state.isHost     = isHost;
      state.isColin    = isColin;

      afterJoin();
    } catch (err) {
      console.error('Join error:', err);
      Animations.showToast('Could not join — check connection.', 'error');
    }
  }

  function joinAsReturning(existingPlayer) {
    hideConflict();
    saveLocalPlayer(
      existingPlayer.id,
      existingPlayer.name,
      existingPlayer.isHost  ?? false,
      existingPlayer.isColin ?? false
    );
    state.playerId   = existingPlayer.id;
    state.playerName = existingPlayer.name;
    state.isHost     = existingPlayer.isHost  ?? false;
    state.isColin    = existingPlayer.isColin ?? false;
    afterJoin();
  }

  // ── Name-conflict overlay ─────────────────────────────────────────────────────

  function showConflict(name) {
    document.getElementById('conflict-name-display').textContent = name;
    const el = document.getElementById('name-conflict');
    el.hidden = false;
    gsap.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' });
  }

  function hideConflict() {
    const el = document.getElementById('name-conflict');
    if (el.hidden) return;
    gsap.to(el, { opacity: 0, y: 10, duration: 0.18, ease: 'power2.in', onComplete: () => { el.hidden = true; } });
    _pendingReturn = null;
  }

  // ── After join ────────────────────────────────────────────────────────────────

  function afterJoin() {
    document.getElementById('player-name-header').textContent = state.playerName;
    if (state.isHost) document.getElementById('host-tab').hidden = false;
    document.getElementById('bottom-nav').hidden = false;
    showView('scorecard');

    Scorecard.init(state);
    Scoreboard.init(state);
    Penalty.init(state);
    if (state.isHost) Host.init(state);
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    initNav();
    initJoin();   // async — returns a promise we don't need to await
  }

  return { init, state, showView };
})();

// Boot
document.addEventListener('DOMContentLoaded', App.init);
