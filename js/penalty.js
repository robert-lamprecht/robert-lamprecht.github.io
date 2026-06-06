// ─── penalty.js — 4-step penalty filing flow + dispute handling ───────────────

const Penalty = (() => {

  let _state           = null;
  let _players         = [];       // live roster (for step 1)
  let _targetPlayerId  = null;
  let _targetName      = null;
  let _selectedHole    = null;
  let _selectedFoul    = null;
  let _buttonsBound    = false;
  let _unsub           = null;
  let _isLocked        = false;

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init(state) {
    _state = state;
    listenToPlayers();
    bindStaticButtons();
  }

  function listenToPlayers() {
    if (_unsub) _unsub();
    _unsub = DB.playersRef().onSnapshot(snap => {
      _players = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // If step 1 is currently visible, refresh it
      if (!document.getElementById('penalty-step-1').hidden) {
        renderStep1();
      }
    });
  }

  function bindStaticButtons() {
    if (_buttonsBound) return;
    document.getElementById('penalty-confirm-btn')?.addEventListener('click', fileIt);
    document.getElementById('penalty-cancel-btn')?.addEventListener('click', reset);
    _buttonsBound = true;
  }

  // ── Called when penalty tab is switched to ───────────────────────────────────

  function onShow() {
    reset();
  }

  // ── Step navigation ──────────────────────────────────────────────────────────

  function goToStep(n) {
    [1, 2, 3, 4].forEach(i => {
      const el = document.getElementById(`penalty-step-${i}`);
      if (el) el.hidden = (i !== n);
    });
    if (n === 1) renderStep1();
    if (n === 2) renderStep2();
    if (n === 3) renderStep3();
    if (n === 4) renderStep4();
  }

  // ── Step renderers ───────────────────────────────────────────────────────────

  function renderStep1() {
    const list = document.getElementById('penalty-player-list');
    if (!list) return;
    list.innerHTML = '';

    const others = _players.filter(p => p.id !== _state.playerId);
    if (others.length === 0) {
      list.innerHTML = '<p class="empty-msg">No other players yet.</p>';
      return;
    }

    others.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'pill pill--player';
      btn.textContent = p.name;
      btn.addEventListener('click', () => {
        _targetPlayerId = p.id;
        _targetName     = p.name;
        goToStep(2);
      });
      list.appendChild(btn);
    });
  }

  function renderStep2() {
    const grid = document.getElementById('penalty-hole-grid');
    if (!grid) return;
    grid.innerHTML = '';

    App.allHoles().forEach(h => {
      const btn = document.createElement('button');
      btn.className = 'hole-btn';
      btn.innerHTML = `
        <span class="hole-btn-n">${h.n}</span>
        <span class="hole-btn-bar">${h.bar}</span>
      `;
      btn.addEventListener('click', () => {
        _selectedHole = h.n;
        goToStep(3);
      });
      grid.appendChild(btn);
    });
  }

  function renderStep3() {
    const list = document.getElementById('penalty-foul-list');
    if (!list) return;
    list.innerHTML = '';

    CONFIG.penaltyTypes.forEach(type => {
      const btn = document.createElement('button');
      btn.className = 'pill pill--foul';
      btn.textContent = CONFIG.penaltyLabels[type];
      btn.addEventListener('click', () => {
        _selectedFoul = type;
        goToStep(4);
      });
      list.appendChild(btn);
    });
  }

  function renderStep4() {
    const summary = document.getElementById('penalty-summary');
    if (!summary) return;
    const holeInfo = App.allHoles().find(h => h.n === _selectedHole);
    summary.innerHTML = `
      <div class="summary-line">
        <span class="summary-label">Player</span>
        <span class="summary-val">${_targetName}</span>
      </div>
      <div class="summary-line">
        <span class="summary-label">Hole</span>
        <span class="summary-val">${_selectedHole} — ${holeInfo?.bar || ''}</span>
      </div>
      <div class="summary-line">
        <span class="summary-label">Foul</span>
        <span class="summary-val">${CONFIG.penaltyLabels[_selectedFoul]}</span>
      </div>
      <p class="summary-note">This adds +1 stroke to ${_targetName}'s score.</p>
    `;
  }

  // ── File the penalty ─────────────────────────────────────────────────────────

  async function fileIt() {
    if (_isLocked) return;
    if (!_targetPlayerId || !_selectedHole || !_selectedFoul) return;

    const penalty = {
      id:           generateUUID(),
      type:         _selectedFoul,
      byPlayerId:   _state.playerId,
      byName:       _state.playerName,
      at:           new Date().toISOString(),
      status:       'active',
      disputed:     false,     // true when a player disputes — host then approves/denies
      disputeDenied: false,    // true when host denies — prevents re-disputing
    };

    const btn = document.getElementById('penalty-confirm-btn');
    if (btn) btn.disabled = true;

    try {
      // Holes live on the player doc — use dot-notation to append to the array
      await DB.playerRef(_targetPlayerId).update({
        [`holes.${_selectedHole}.penalties`]: firebase.firestore.FieldValue.arrayUnion(penalty),
      });
      Animations.showToast(`⛳ Penalty filed against ${_targetName}.`, 'info');
      reset();
      App.showView('scoreboard');
    } catch (e) {
      console.error('Penalty write error:', e);
      Animations.showToast('Failed to file penalty — check connection.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function reset() {
    _targetPlayerId = null;
    _targetName     = null;
    _selectedHole   = null;
    _selectedFoul   = null;
    goToStep(1);
  }

  // ── Dispute handling — flags the penalty for host review ─────────────────────
  // No quorum. Host sees it in the panel and approves (void) or denies (keep).

  async function openDispute(targetPlayerId, holeN, penaltyId) {
    if (_isLocked) return;
    if (!CONFIG.disputesEnabled) {
      Animations.showToast('Disputes are disabled.', 'info');
      return;
    }

    const playerRef = DB.playerRef(targetPlayerId);

    try {
      await DB.db.runTransaction(async (transaction) => {
        const snap = await transaction.get(playerRef);
        if (!snap.exists) return;

        const holeData  = snap.data()?.holes?.[holeN] || {};
        const penalties = JSON.parse(JSON.stringify(holeData.penalties || []));
        const idx       = penalties.findIndex(p => p.id === penaltyId);
        if (idx === -1) return;

        const penalty = penalties[idx];

        if (penalty.status !== 'active') {
          throw new Error('This penalty is already resolved.');
        }
        if (penalty.type === 'falseFiling') {
          throw new Error('False filing penalties cannot be disputed.');
        }
        if (penalty.disputed) {
          throw new Error('Dispute already filed — waiting on the host.');
        }
        if (penalty.disputeDenied) {
          throw new Error('Host already reviewed this one — penalty stands.');
        }
        if (penalty.byPlayerId === _state.playerId) {
          throw new Error("You can't dispute your own filing.");
        }

        // Mark as disputed; the host will see it in their panel
        penalties[idx].disputed   = true;
        penalties[idx].disputedBy = {
          playerId: _state.playerId,
          name:     _state.playerName,
          at:       new Date().toISOString(),
        };

        transaction.update(playerRef, {
          [`holes.${holeN}.penalties`]: penalties,
        });
      });

      Animations.showToast('Dispute filed — the host will review it.', 'info');
    } catch (e) {
      console.error('Dispute error:', e);
      Animations.showToast(e.message || 'Dispute failed — check connection.', 'error');
    }
  }

  function setLocked(isLocked) {
    _isLocked = isLocked;
  }

  return { init, onShow, openDispute, setLocked };
})();
