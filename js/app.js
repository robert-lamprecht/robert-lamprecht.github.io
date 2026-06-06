// ─── app.js — view routing, shared state, join flow ──────────────────────────

// RFC4122 v4 compliant fallback UUID generator for non-secure contexts (HTTP)
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const App = (() => {

  // ── Shared state ─────────────────────────────────────────────────────────────

  const state = {
    playerId:    null,
    playerName:  null,
    isHost:      false,
    isColin:     false,
    customHoles: [],   // extra holes added by host at runtime (beyond CONFIG.holes)
    unsubscribers: [],
  };

  // Returns CONFIG holes + any runtime holes added by the host, sorted by hole number.
  function allHoles() {
    return [...CONFIG.holes, ...state.customHoles].sort((a, b) => a.n - b.n);
  }

  // ── Pending join (lives across the name-conflict modal interaction) ───────────

  let _pendingName   = null;
  let _pendingIsHost = false;
  let _pendingReturn = null;
  let _sessionUnsub  = null;
  let _feedUnsub     = null;
  let _shuffledQuestions = [];
  let _questionIndex     = 0;

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

    const playerId = generateUUID();
    
    // Check if a Colin already exists to ensure exactly one player is flagged isColin
    const colinSnap = await DB.playersRef().where('isColin', '==', true).get();
    const isColin = name.toLowerCase() === CONFIG.colinName.toLowerCase() && colinSnap.empty;

    // Include any holes already added by the host before this player joined
    const sessionSnap = await DB.sessionRef().get();
    const existingCustom = sessionSnap.exists ? (sessionSnap.data().customHoles || []) : [];

    const holes = {};
    CONFIG.holes.forEach(h => { holes[h.n] = scoring.emptyHole(); });
    existingCustom.forEach(h => { holes[h.n] = scoring.emptyHole(); });

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

  function listenToSession() {
    if (_sessionUnsub) _sessionUnsub();
    _sessionUnsub = DB.sessionRef().onSnapshot(snap => {
      if (!snap.exists) return;
      const data = snap.data();
      const status = data.status;
      state.isLocked = (status === 'final');

      // Freeze/thaw UI
      if (typeof Scorecard !== 'undefined' && Scorecard.setLocked) {
        Scorecard.setLocked(state.isLocked);
      }
      if (typeof Penalty !== 'undefined' && Penalty.setLocked) {
        Penalty.setLocked(state.isLocked);
      }
    });
  }

  function afterJoin() {
    document.getElementById('player-name-header').textContent = state.playerName;
    if (state.isHost) document.getElementById('host-tab').hidden = false;
    document.getElementById('bottom-nav').hidden = false;
    showView('scorecard');

    listenToSession();

    Scorecard.init(state);
    Scoreboard.init(state);
    Penalty.init(state);
    if (state.isHost) Host.init(state);

    initShoutBox();
    listenToFeed();
  }

  // ── Live Shout Box Feed ──────────────────────────────────────────────────────

  function listenToFeed() {
    if (_feedUnsub) _feedUnsub();

    const feedEl = document.getElementById('shout-box-feed');
    if (!feedEl) return;

    _feedUnsub = DB.sessionRef().collection('feed')
      .orderBy('at', 'desc')
      .limit(15)
      .onSnapshot(snap => {
        if (snap.empty) {
          feedEl.innerHTML = '<p class="shout-empty">No shouts yet. Be the first to toast!</p>';
          return;
        }

        const shouts = [];
        snap.forEach(doc => {
          shouts.push(doc.data());
        });
        shouts.reverse(); // Display oldest at top, newest at bottom

        feedEl.innerHTML = '';
        shouts.forEach(shout => {
          const item = document.createElement('div');
          item.className = 'shout-item';

          const fromSpan = document.createElement('span');
          fromSpan.className = 'shout-from';
          fromSpan.textContent = (shout.from || 'Anon') + ':';

          const textSpan = document.createElement('span');
          textSpan.className = 'shout-text';
          textSpan.textContent = shout.text || '';

          const timeSpan = document.createElement('span');
          timeSpan.className = 'shout-at';
          if (shout.at) {
            const date = shout.at.toDate ? shout.at.toDate() : new Date(shout.at);
            timeSpan.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else {
            timeSpan.textContent = 'Just now';
          }

          item.appendChild(fromSpan);
          item.appendChild(textSpan);
          item.appendChild(timeSpan);
          feedEl.appendChild(item);
        });

        feedEl.scrollTop = feedEl.scrollHeight;
      });
  }

  function initShoutBox() {
    const form = document.getElementById('shout-form');
    if (!form) return;

    // Remove existing event listener if any by replacing form
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    const newInput = newForm.querySelector('#shout-input');

    newForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!newInput) return;
      const text = newInput.value.trim();
      if (!text) return;
      if (state.isLocked) {
        Animations.showToast('Scores are final. No more shouting!', 'info');
        return;
      }

      newInput.value = '';
      try {
        await DB.sessionRef().collection('feed').add({
          from: state.playerName,
          text: text,
          at: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        console.error('Error posting shout:', err);
        Animations.showToast('Failed to send shout.', 'error');
      }
    });
  }

  // ── Party Games Deck ─────────────────────────────────────────────────────────

  function shuffleQuestions() {
    const pool = CONFIG.partyQuestions || [];
    _shuffledQuestions = [...pool];
    for (let i = _shuffledQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [_shuffledQuestions[i], _shuffledQuestions[j]] = [_shuffledQuestions[j], _shuffledQuestions[i]];
    }
    _questionIndex = 0;
  }

  function getNextQuestion() {
    if (_shuffledQuestions.length === 0 || _questionIndex >= _shuffledQuestions.length) {
      shuffleQuestions();
    }
    return _shuffledQuestions[_questionIndex++];
  }

  function renderNextCard(cardEl) {
    const q = getNextQuestion();
    if (!q) return;

    const badge = cardEl.querySelector('#games-card-badge');
    const text = cardEl.querySelector('#games-card-text');

    if (badge && text) {
      badge.className = 'games-card-badge';
      badge.classList.add(q.cat);
      badge.textContent = q.cat === 'never' ? 'Never Have I Ever' : q.cat;
      text.textContent = q.q;
    }
  }

  function initGames() {
    const overlay = document.getElementById('party-games-overlay');
    const card = document.getElementById('games-card');
    const nextBtn = document.getElementById('games-next-btn');
    const closeBtn = document.getElementById('games-close-btn');
    const backdrop = document.getElementById('games-backdrop');

    const openDeck = () => {
      if (!overlay) return;
      if (_shuffledQuestions.length === 0) {
        shuffleQuestions();
      }
      renderNextCard(card);
      Animations.showGames(overlay);
    };

    document.getElementById('scorecard-games-btn')?.addEventListener('click', openDeck);
    document.getElementById('scoreboard-games-btn')?.addEventListener('click', openDeck);

    closeBtn?.addEventListener('click', () => {
      if (overlay) Animations.hideGames(overlay);
    });
    backdrop?.addEventListener('click', () => {
      if (overlay) Animations.hideGames(overlay);
    });

    nextBtn?.addEventListener('click', () => {
      if (!card) return;
      // Animate card Y-rotation flip
      gsap.to(card, {
        scale: 0.9,
        rotationY: 90,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          renderNextCard(card);
          gsap.fromTo(card,
            { rotationY: -90, scale: 0.9, opacity: 0 },
            { rotationY: 0, scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.2)' }
          );
        }
      });
    });
  }

  // ── Rules overlay wiring ──────────────────────────────────────────────────────

  function initRules() {
    const overlay = document.getElementById('rules-overlay');

    document.getElementById('scorecard-rules-btn')?.addEventListener('click', () => {
      if (overlay) Animations.showRules(overlay);
    });

    document.getElementById('scoreboard-rules-btn')?.addEventListener('click', () => {
      if (overlay) Animations.showRules(overlay);
    });

    document.getElementById('rules-close-btn')?.addEventListener('click', () => {
      if (overlay) Animations.hideRules(overlay);
    });

    document.getElementById('rules-host-login-btn')?.addEventListener('click', async () => {
      const code = prompt('Enter Host Code to elevate privileges:');
      if (!code) return;

      if (code.trim() === CONFIG.hostCode) {
        if (overlay) Animations.hideRules(overlay);

        state.isHost = true;
        localStorage.setItem('isHost', 'true');

        try {
          await DB.playerRef(state.playerId).update({ isHost: true });

          // Show the Host tab and initialize Host module
          const hostTab = document.getElementById('host-tab');
          if (hostTab) hostTab.hidden = false;

          if (typeof Host !== 'undefined') {
            Host.init(state);
          }

          // Open the Host panel immediately
          const hostPanel = document.getElementById('host-panel');
          if (hostPanel) hostPanel.hidden = false;

          Animations.showToast('Host access granted!', 'info');
        } catch (err) {
          console.error('Error elevating to host:', err);
          Animations.showToast('Failed to save host status.', 'error');
        }
      } else {
        Animations.showToast('Invalid host code.', 'error');
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    initNav();
    initJoin();   // async — returns a promise we don't need to await
    initRules();
    initGames();
  }

  return { init, state, showView, allHoles };
})();

// Boot
document.addEventListener('DOMContentLoaded', App.init);
