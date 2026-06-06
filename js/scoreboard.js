// ─── scoreboard.js — live scoreboard with GSAP Flip reordering ────────────────

const Scoreboard = (() => {

  let _state  = null;
  let _unsub  = null;
  let _players = [];

  function init(state) {
    _state = state;
    listenToPlayers();
    listenToSession();
  }

  // ── Firestore listener ───────────────────────────────────────────────────────

  function listenToPlayers() {
    // Holes are stored as a map field on the player doc, so one snapshot gives us
    // everything we need — no per-player subcollection fetches required.
    _unsub = DB.playersRef().onSnapshot(snap => {
      const players = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _players = scoring.rankPlayers(players);
      render();
    });
  }

  // ── Session status listener (winner reveal + input freeze) ──────────────────

  function listenToSession() {
    DB.sessionRef().onSnapshot(snap => {
      if (!snap.exists) return;
      const data = snap.data();
      const { status } = data;

      // Keep shared custom holes state current so App.allHoles() is accurate
      App.state.customHoles = data.customHoles || [];

      if (status === 'final') {
        // Show winner reveal after a tick so scoreboard has rendered
        setTimeout(() => {
          const winner = _players[0];
          if (!winner) return;
          const total  = scoring.totalScore(winner.holes || {});
          const relPar = total === 0 ? 'E' : (total > 0 ? `+${total}` : `${total}`);
          App.showView('scoreboard');
          Animations.winnerReveal(winner.name, relPar);
        }, 600);
      }
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  function render() {
    const container = document.getElementById('scoreboard-rows');
    if (!container) return;

    // Capture state before DOM change (for GSAP Flip)
    const flipState = container.children.length > 0
      ? Flip.getState('.scoreboard-row')
      : null;

    container.innerHTML = '';

    _players.forEach((player, idx) => {
      const total     = scoring.totalScore(player.holes || {});
      const relPar    = total === 0 ? 'E' : (total > 0 ? `+${total}` : `${total}`);
      const isMe      = player.id === _state.playerId;
      const isColin   = player.isColin;

      const row = document.createElement('div');
      row.className = `scoreboard-row ${isMe ? 'scoreboard-row--me' : ''} ${isColin ? 'scoreboard-row--colin' : ''}`;
      row.dataset.id = player.id;

      // Per-hole mini scores — includes custom holes added at runtime
      const holeScores = App.allHoles().map(h => {
        const hd = player.holes?.[h.n];
        if (!hd) return '<span class="mini-score mini-score--empty">—</span>';
        const s = scoring.holeScore(hd);
        return `<span class="mini-score ${miniScoreClass(s)}">${s === 0 ? 'E' : (s > 0 ? `+${s}` : s)}</span>`;
      }).join('');

      row.innerHTML = `
        <span class="rank">${idx + 1}</span>
        <span class="sb-name">
          ${isColin ? '<span class="crown-badge" id="crown-badge">👑</span>' : ''}
          ${player.name}
        </span>
        <div class="mini-scores">${holeScores}</div>
        <span class="sb-total">${relPar}</span>
      `;
      container.appendChild(row);
    });

    // Animate reordering with GSAP Flip
    if (flipState) {
      Flip.from(flipState, {
        duration: 0.45,
        ease: 'power2.inOut',
        targets: '.scoreboard-row',
        absolute: true,
      });
    } else {
      Animations.staggerIn(document.querySelectorAll('.scoreboard-row'));
    }

    // Pulse Colin's crown on loop
    const crown = document.getElementById('crown-badge');
    if (crown) Animations.pulseLoop(crown);
  }

  function miniScoreClass(s) {
    if (s > 0)  return 'mini-score--over';
    if (s < -1) return 'mini-score--under';
    return '';
  }

  return { init };
})();
