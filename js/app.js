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
  let _pendingReturn = null;   // existing player doc, set when name conflict found

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

    // Per-view hooks
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

  function initJoin() {
    // Returning player — already stored locally, skip landing entirely
    const savedId = localStorage.getItem('playerId');
    if (savedId) {
      state.playerId   = savedId;
      state.playerName = localStorage.getItem('playerName') || '';
      state.isHost     = localStorage.getItem('isHost') === 'true';
      state.isColin    = localStorage.getItem('isColin') === 'true';
      afterJoin();
      return;
    }

    Animations.landingEntrance();

    // ── Host toggle — reveal host-code input inline ───────────────────────────
    let _hostMode = false;
    document.getElementById('host-btn').addEventListener('click', () => {
      _hostMode = !_hostMode;
      document.getElementById('host-code-wrap').hidden = !_hostMode;
      document.getElementById('host-btn').classList.toggle('btn--active', _hostMode);
      if (_hostMode) document.getElementById('input-host')?.focus();
    });

    // ── Primary join (Enter key or Join button) ───────────────────────────────
    document.getElementById('join-form').addEventListener('submit', e => {
      e.preventDefault();
      handleJoin(false);
    });

    // ── Host confirm ─────────────────────────────────────────────────────────
    document.getElementById('host-confirm-btn').addEventListener('click', () => {
      handleJoin(true);
    });

    // ── Name-conflict modal buttons ───────────────────────────────────────────
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
      const code = hostInput?.value.trim() || '';
      if (code !== CONFIG.hostCode) {
        Animations.shake(hostInput);
        Animations.showToast('Wrong host code.', 'error');
        return;
      }
    }

    _pendingName   = name;
    _pendingIsHost = isHost;

    // Check for an existing player with this name (case-insensitive, full roster read —
    // tiny list for a party game, no index needed)
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
      await joinAsNew(name, isHost);  // fall back to fresh join on read error
    }
  }

  async function joinAsNew(name, isHost) {
    hideConflict();

    const playerId = crypto.randomUUID();
    const isColin  = name.toLowerCase() === CONFIG.colinName.toLowerCase();

    const holes = {};
    CONFIG.holes.forEach(h => { holes[h.n] = scoring.emptyHole(); });

    const playerData = {
      name,
      isColin,
      isHost,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      holes,
    };

    try {
      await DB.sessionRef().set(
        { createdAt: firebase.firestore.FieldValue.serverTimestamp(), status: 'active' },
        { merge: true }
      );
      await DB.playerRef(playerId).set(playerData);

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
  }

  function joinAsReturning(existingPlayer) {
    hideConflict();

    localStorage.setItem('playerId',   existingPlayer.id);
    localStorage.setItem('playerName', existingPlayer.name);
    localStorage.setItem('isHost',     String(existingPlayer.isHost  ?? false));
    localStorage.setItem('isColin',    String(existingPlayer.isColin ?? false));

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
    gsap.fromTo(el,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' }
    );
  }

  function hideConflict() {
    const el = document.getElementById('name-conflict');
    if (el.hidden) return;
    gsap.to(el, {
      opacity: 0, y: 10, duration: 0.18, ease: 'power2.in',
      onComplete: () => { el.hidden = true; },
    });
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
    initJoin();
  }

  return { init, state, showView };
})();

// Boot
document.addEventListener('DOMContentLoaded', App.init);
