// ─── host.js — host-only controls: reset · lock · holes · players · disputes ──

const Host = (() => {

  let _state   = null;
  let _unsub   = null;
  let _controlsBound = false;

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init(state) {
    _state = state;
    bindControls();
    listenToPlayers();
  }

  function bindControls() {
    if (_controlsBound) return;
    document.getElementById('host-reset-btn')?.addEventListener('click', resetRound);
    document.getElementById('host-lock-btn')?.addEventListener('click', lockFinal);
    document.getElementById('host-close-btn')?.addEventListener('click', closePanel);
    document.getElementById('host-add-hole-btn')?.addEventListener('click', addHole);
    _controlsBound = true;
  }

  function closePanel() {
    document.getElementById('host-panel').hidden = true;
  }

  // ── Live listener — drives all three live sections ───────────────────────────

  function listenToPlayers() {
    if (_unsub) _unsub();
    _unsub = DB.playersRef().onSnapshot(snap => {
      const players = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderDisputeQueue(players);
      renderActivePenalties(players);
      renderPlayerRoster(players);
    });
  }

  // ── Reset round ──────────────────────────────────────────────────────────────

  async function resetRound() {
    if (!confirm('Reset all hole data for every player? The player roster stays intact.')) return;

    try {
      const snap = await DB.playersRef().get();
      const batch = DB.db.batch();
      const emptyHoles = {};
      App.allHoles().forEach(h => { emptyHoles[h.n] = scoring.emptyHole(); });
      snap.docs.forEach(playerDoc => {
        batch.update(DB.playerRef(playerDoc.id), { holes: emptyHoles });
      });
      // Reset session status back to active
      batch.update(DB.sessionRef(), { status: 'active' });

      await batch.commit();
      Animations.showToast('⛳ Round reset — all scores cleared.', 'info');
      closePanel();
    } catch (e) {
      console.error('Reset error:', e);
      Animations.showToast('Reset failed — check connection.', 'error');
    }
  }

  // ── Lock final scores ────────────────────────────────────────────────────────

  async function lockFinal() {
    if (!confirm('Lock final scores? This ends the round for everyone.')) return;

    try {
      await DB.sessionRef().update({ status: 'final' });
      Animations.showToast('🏆 Scores locked — round over!', 'info');
      closePanel();
    } catch (e) {
      console.error('Lock error:', e);
      Animations.showToast('Lock failed — check connection.', 'error');
    }
  }

  // ── Add a hole at runtime ────────────────────────────────────────────────────

  async function addHole() {
    const barInput = document.getElementById('host-new-bar');
    const sigInput = document.getElementById('host-new-sig');
    const bar       = barInput.value.trim();
    const signature = sigInput.value.trim();

    if (!bar) { Animations.shake(barInput); return; }

    try {
      // Determine next hole number from base holes + already-stored custom holes
      const sessionSnap = await DB.sessionRef().get();
      const customHoles = sessionSnap.exists ? (sessionSnap.data().customHoles || []) : [];
      const allNums     = [...App.baseHoles(), ...customHoles].map(h => h.n);
      const nextN       = Math.max(...allNums) + 1;

      const newHole = { n: nextN, bar, signature };

      // Batch: append to session + add empty hole to every player doc
      const playerSnap = await DB.playersRef().get();
      const batch = DB.db.batch();

      batch.update(DB.sessionRef(), {
        customHoles: firebase.firestore.FieldValue.arrayUnion(newHole),
      });
      playerSnap.docs.forEach(doc => {
        batch.update(DB.playerRef(doc.id), {
          [`holes.${nextN}`]: scoring.emptyHole(),
        });
      });

      await batch.commit();

      barInput.value = '';
      sigInput.value = '';
      Animations.showToast(`⛳ Hole ${nextN} — ${bar} added!`, 'info');
    } catch (e) {
      console.error('Add hole error:', e);
      Animations.showToast('Failed to add hole — check connection.', 'error');
    }
  }

  // ── Remove a player ──────────────────────────────────────────────────────────

  async function removePlayer(playerId, playerName) {
    if (!confirm(`Remove ${playerName} from the game? This can't be undone.`)) return;

    try {
      await DB.playerRef(playerId).delete();
      Animations.showToast(`${playerName} removed.`, 'info');
    } catch (e) {
      console.error('Remove player error:', e);
      Animations.showToast('Remove failed — check connection.', 'error');
    }
  }

  // ── Dispute queue (host approves or denies) ──────────────────────────────────

  function renderDisputeQueue(players) {
    const container = document.getElementById('host-disputes');
    if (!container) return;

    const disputed = [];
    players.forEach(player => {
      App.allHoles().forEach(h => {
        (player.holes?.[h.n]?.penalties || []).forEach(p => {
          if (p.status === 'active' && p.disputed) {
            disputed.push({ player, holeN: h.n, penalty: p });
          }
        });
      });
    });

    if (disputed.length === 0) {
      container.innerHTML = '<p class="host-empty">No pending disputes.</p>';
      return;
    }

    container.innerHTML = '';
    disputed.forEach(({ player, holeN, penalty }) => {
      const row = document.createElement('div');
      row.className = 'host-penalty-item';
      row.innerHTML = `
        <span class="hp-who">${player.name}</span>
        <span class="hp-hole">H${holeN}</span>
        <span class="hp-type">${CONFIG.penaltyLabels[penalty.type] || penalty.type}</span>
        <span class="hp-by">filed by ${penalty.byName}${penalty.disputedBy ? ` · disputed by ${penalty.disputedBy.name}` : ''}</span>
        <div class="hp-actions">
          <button class="btn btn-danger btn-xs hp-approve-btn"
            data-player="${player.id}" data-hole="${holeN}" data-penalty="${penalty.id}">
            Void ✓
          </button>
          <button class="btn btn-ghost btn-xs hp-deny-btn"
            data-player="${player.id}" data-hole="${holeN}" data-penalty="${penalty.id}">
            Keep ✗
          </button>
        </div>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.hp-approve-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        approveDispute(btn.dataset.player, Number(btn.dataset.hole), btn.dataset.penalty)
      );
    });
    container.querySelectorAll('.hp-deny-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        denyDispute(btn.dataset.player, Number(btn.dataset.hole), btn.dataset.penalty)
      );
    });
  }

  async function approveDispute(playerId, holeN, penaltyId) {
    const playerRef = DB.playerRef(playerId);
    try {
      await DB.db.runTransaction(async (transaction) => {
        const snap = await transaction.get(playerRef);
        if (!snap.exists) return;
        const penalties = JSON.parse(JSON.stringify(snap.data()?.holes?.[holeN]?.penalties || []));
        const idx = penalties.findIndex(p => p.id === penaltyId);
        if (idx === -1) return;
        penalties[idx].status   = 'voided';
        penalties[idx].disputed = false;
        transaction.update(playerRef, { [`holes.${holeN}.penalties`]: penalties });
      });
      Animations.showToast('Dispute approved — penalty voided.', 'info');
    } catch (e) {
      console.error('Approve error:', e);
      Animations.showToast('Failed — check connection.', 'error');
    }
  }

  async function denyDispute(playerId, holeN, penaltyId) {
    const playerRef = DB.playerRef(playerId);
    try {
      await DB.db.runTransaction(async (transaction) => {
        const snap = await transaction.get(playerRef);
        if (!snap.exists) return;
        const penalties = JSON.parse(JSON.stringify(snap.data()?.holes?.[holeN]?.penalties || []));
        const idx = penalties.findIndex(p => p.id === penaltyId);
        if (idx === -1) return;
        penalties[idx].disputed     = false;
        penalties[idx].disputeDenied = true;    // prevents re-disputing
        transaction.update(playerRef, { [`holes.${holeN}.penalties`]: penalties });
      });
      Animations.showToast('Dispute denied — penalty stands.', 'info');
    } catch (e) {
      console.error('Deny error:', e);
      Animations.showToast('Failed — check connection.', 'error');
    }
  }

  // ── Active penalties (non-disputed — host can void directly) ─────────────────

  function renderActivePenalties(players) {
    const container = document.getElementById('host-penalties');
    if (!container) return;

    const items = [];
    players.forEach(player => {
      App.allHoles().forEach(h => {
        (player.holes?.[h.n]?.penalties || []).forEach(p => {
          if (p.status === 'active' && !p.disputed) {
            items.push({ player, holeN: h.n, penalty: p });
          }
        });
      });
    });

    if (items.length === 0) {
      container.innerHTML = '<p class="host-empty">No active penalties.</p>';
      return;
    }

    container.innerHTML = '';
    items.forEach(({ player, holeN, penalty }) => {
      const row = document.createElement('div');
      row.className = 'host-penalty-item';
      row.innerHTML = `
        <span class="hp-who">${player.name}</span>
        <span class="hp-hole">H${holeN}</span>
        <span class="hp-type">${CONFIG.penaltyLabels[penalty.type] || penalty.type}</span>
        <span class="hp-by">by ${penalty.byName}</span>
        <button class="btn btn-ghost btn-xs hp-void-btn"
          data-player="${player.id}" data-hole="${holeN}" data-penalty="${penalty.id}">
          Void
        </button>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.hp-void-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        voidPenalty(btn.dataset.player, Number(btn.dataset.hole), btn.dataset.penalty)
      );
    });
  }

  async function voidPenalty(playerId, holeN, penaltyId) {
    const playerRef = DB.playerRef(playerId);
    try {
      await DB.db.runTransaction(async (transaction) => {
        const snap = await transaction.get(playerRef);
        if (!snap.exists) return;
        const penalties = JSON.parse(JSON.stringify(snap.data()?.holes?.[holeN]?.penalties || []));
        const idx = penalties.findIndex(p => p.id === penaltyId);
        if (idx === -1) return;
        penalties[idx].status = 'voided';
        transaction.update(playerRef, { [`holes.${holeN}.penalties`]: penalties });
      });
      Animations.showToast('Penalty voided by host.', 'info');
    } catch (e) {
      console.error('Void error:', e);
      Animations.showToast('Void failed — check connection.', 'error');
    }
  }

  // ── Player roster ─────────────────────────────────────────────────────────────

  function renderPlayerRoster(players) {
    const container = document.getElementById('host-players');
    if (!container) return;

    if (players.length === 0) {
      container.innerHTML = '<p class="host-empty">No players yet.</p>';
      return;
    }

    container.innerHTML = '';
    players.forEach(player => {
      const row = document.createElement('div');
      row.className = 'host-player-item';
      row.innerHTML = `
        <span class="hp-who">${player.name}${player.isHost ? ' <span class="badge-host">HOST</span>' : ''}</span>
        <button class="btn btn-ghost btn-xs hp-remove-btn"
          data-player="${player.id}" data-name="${player.name}">
          Remove
        </button>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.hp-remove-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        removePlayer(btn.dataset.player, btn.dataset.name)
      );
    });
  }

  return { init };
})();
