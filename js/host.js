// ─── host.js — host-only controls: reset · lock · adjudicate ─────────────────

const Host = (() => {

  let _state   = null;
  let _unsub   = null;

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init(state) {
    _state = state;
    bindControls();
    listenToPlayers();
  }

  function bindControls() {
    document.getElementById('host-reset-btn')?.addEventListener('click', resetRound);
    document.getElementById('host-lock-btn')?.addEventListener('click', lockFinal);
    document.getElementById('host-close-btn')?.addEventListener('click', closePanel);
  }

  function closePanel() {
    document.getElementById('host-panel').hidden = true;
  }

  // ── Live listener for penalty adjudication list ──────────────────────────────

  function listenToPlayers() {
    // Holes are on the player doc — no N+1 subcollection fetches needed
    _unsub = DB.playersRef().onSnapshot(snap => {
      const players = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderPenalties(players);
    });
  }

  // ── Reset round ──────────────────────────────────────────────────────────────

  async function resetRound() {
    if (!confirm('Reset all hole data for every player? The player roster stays intact.')) return;

    try {
      const snap = await DB.playersRef().get();
      const batch = DB.db.batch();
      // Build a clean empty holes map
      const emptyHoles = {};
      CONFIG.holes.forEach(h => { emptyHoles[h.n] = scoring.emptyHole(); });
      // Overwrite the holes map on each player doc in one batch
      snap.docs.forEach(playerDoc => {
        batch.update(DB.playerRef(playerDoc.id), { holes: emptyHoles });
      });
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

  // ── Adjudication panel ───────────────────────────────────────────────────────

  function renderPenalties(playersWithHoles) {
    const container = document.getElementById('host-penalties');
    if (!container) return;

    const items = [];
    playersWithHoles.forEach(player => {
      CONFIG.holes.forEach(h => {
        const penalties = player.holes?.[h.n]?.penalties || [];
        penalties
          .filter(p => p.status === 'active')
          .forEach(p => items.push({ player, holeN: h.n, penalty: p }));
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
        <button
          class="btn btn-ghost btn-xs hp-void-btn"
          data-player="${player.id}"
          data-hole="${holeN}"
          data-penalty="${penalty.id}">
          Void
        </button>
      `;
      container.appendChild(row);
    });

    // Bind void buttons
    container.querySelectorAll('.hp-void-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        voidPenalty(btn.dataset.player, Number(btn.dataset.hole), btn.dataset.penalty)
      );
    });
  }

  async function voidPenalty(playerId, holeN, penaltyId) {
    try {
      const snap = await DB.playerRef(playerId).get();
      if (!snap.exists) return;

      const holeData = snap.data()?.holes?.[holeN] || {};
      const penalties = (holeData.penalties || []).map(p =>
        p.id === penaltyId ? { ...p, status: 'voided' } : p
      );
      await DB.playerRef(playerId).update({ [`holes.${holeN}.penalties`]: penalties });
      Animations.showToast('Penalty voided by host.', 'info');
    } catch (e) {
      console.error('Void error:', e);
      Animations.showToast('Void failed — check connection.', 'error');
    }
  }

  return { init };
})();
