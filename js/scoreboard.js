// ─── scoreboard.js — live scoreboard with GSAP Flip reordering ────────────────

const Scoreboard = (() => {

  let _state  = null;
  let _unsubPlayers = null;
  let _unsubSession = null;
  let _players = [];

  function init(state) {
    _state = state;
    listenToPlayers();
    listenToSession();
  }

  // ── Firestore listener ───────────────────────────────────────────────────────

  function listenToPlayers() {
    if (_unsubPlayers) _unsubPlayers();
    
    // Holes are stored as a map field on the player doc, so one snapshot gives us
    // everything we need — no per-player subcollection fetches required.
    _unsubPlayers = DB.playersRef().onSnapshot(snap => {
      const players = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _players = scoring.rankPlayers(players);
      render();
    });
  }

  // ── Session status listener (winner reveal + input freeze) ──────────────────

  function listenToSession() {
    if (_unsubSession) _unsubSession();

    _unsubSession = DB.sessionRef().onSnapshot(snap => {
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
      } else {
        // Hide winner reveal overlay when round is active/reset
        const revealEl = document.getElementById('winner-reveal');
        if (revealEl) revealEl.hidden = true;
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

    // Kill running tweens on elements that are about to be destroyed to prevent memory leaks
    container.querySelectorAll('.crown-badge, .scoreboard-row, .sb-trophy').forEach(el => gsap.killTweensOf(el));

    container.innerHTML = '';

    // Compute stats for trophies in real time
    let maxDrinks = 0, maxColinDrinks = 0, maxPenalties = 0, maxBonuses = 0;
    const playerStats = _players.map(p => {
      let drinks = 0;
      let colinDrinks = 0;
      let activePenalties = 0;
      let bonuses = 0;

      if (p.holes) {
        Object.values(p.holes).forEach(h => {
          drinks += (h.drinks || 0);
          colinDrinks += (h.colinDrinks || 0);
          activePenalties += (h.penalties || []).filter(pen => pen.status === 'active').length;
          bonuses += Object.values(h.bonuses || {}).filter(Boolean).length;
        });
      }

      if (drinks > maxDrinks) maxDrinks = drinks;
      if (colinDrinks > maxColinDrinks) maxColinDrinks = colinDrinks;
      if (activePenalties > maxPenalties) maxPenalties = activePenalties;
      if (bonuses > maxBonuses) maxBonuses = bonuses;

      return { id: p.id, drinks, colinDrinks, activePenalties, bonuses };
    });

    const trophiesMap = {};
    _players.forEach(p => { trophiesMap[p.id] = []; });

    if (_players.length > 0) {
      const bestScore = scoring.totalScore(_players[0].holes || {});
      _players.forEach(p => {
        if (scoring.totalScore(p.holes || {}) === bestScore) {
          trophiesMap[p.id].push({ char: '🏆', title: 'Leader' });
        }
      });
    }

    _players.forEach(p => {
      const stats = playerStats.find(s => s.id === p.id);
      if (!stats) return;

      if (maxDrinks > 0 && stats.drinks === maxDrinks) {
        trophiesMap[p.id].push({ char: '🍺', title: 'Thirst Champ' });
      }
      if (maxColinDrinks > 0 && stats.colinDrinks === maxColinDrinks) {
        trophiesMap[p.id].push({ char: '💸', title: 'Sponsor' });
      }
      if (maxPenalties > 0 && stats.activePenalties === maxPenalties) {
        trophiesMap[p.id].push({ char: '🚩', title: 'Troublemaker' });
      }
      if (maxBonuses > 0 && stats.bonuses === maxBonuses) {
        trophiesMap[p.id].push({ char: '🎯', title: 'Challenge Champ' });
      }
    });

    _players.forEach((player, idx) => {
      const total     = scoring.totalScore(player.holes || {});
      const relPar    = total === 0 ? 'E' : (total > 0 ? `+${total}` : `${total}`);
      const isMe      = player.id === _state.playerId;
      const isColin   = player.isColin;

      const row = document.createElement('div');
      row.className = `scoreboard-row ${isMe ? 'scoreboard-row--me' : ''} ${isColin ? 'scoreboard-row--colin' : ''}`;
      row.dataset.id = player.id;
      row.dataset.flipId = player.id; // Correct flip-id for GSAP Flip plugin to track element

      // Per-hole mini scores — includes custom holes added at runtime
      const holeScores = App.allHoles().map(h => {
        const hd = player.holes?.[h.n];
        if (!hd || scoring.isHoleEmpty(hd)) return '<span class="mini-score mini-score--empty">—</span>';
        const s = scoring.holeScore(hd);
        return `<span class="mini-score ${miniScoreClass(s)}">${s === 0 ? 'E' : (s > 0 ? `+${s}` : s)}</span>`;
      }).join('');

      const playerTrophies = (trophiesMap[player.id] || [])
        .map(t => `<span class="sb-trophy" title="${t.title}">${t.char}</span>`)
        .join('');

      row.innerHTML = `
        <span class="rank">${idx + 1}</span>
        <span class="sb-name">
          ${isColin ? '<span class="crown-badge">👑</span>' : ''}
          ${player.name}
          <span class="sb-trophies">${playerTrophies}</span>
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
    container.querySelectorAll('.crown-badge').forEach(el => Animations.pulseLoop(el));
  }

  function miniScoreClass(s) {
    if (s > 0)  return 'mini-score--over';
    if (s < 0)  return 'mini-score--under'; // Corrected: s < 0 instead of s < -1 so Birdies (-1) are styled gold
    return '';
  }

  return { init };
})();
