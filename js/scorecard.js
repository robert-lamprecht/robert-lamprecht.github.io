// ─── scorecard.js — personal scorecard view ───────────────────────────────────
//
// Schema note: holes are stored as a map on the player document:
//   players/{playerId}.holes = { "1": holeData, "2": holeData, ... }
// All reads/writes go through DB.playerRef() with dot-notation field paths.

const Scorecard = (() => {

  let _state          = null;
  let _holeData       = {};      // { 1: holeDoc, 2: holeDoc, ... } local cache
  let _unsubs         = [];
  let _initialized    = false;   // true after the first snapshot — prevents spurious toasts on load
  let _renderedHoleNs = new Set(); // hole numbers that have a built card

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init(state) {
    _state = state;
    buildCards();
    listenToPlayer();
    listenToSession();
  }

  // ── Build static hole cards ──────────────────────────────────────────────────

  function buildCards() {
    const container = document.getElementById('hole-cards');
    container.innerHTML = '';
    _renderedHoleNs.clear();

    CONFIG.holes.forEach(hole => {
      _renderedHoleNs.add(hole.n);
      const card = document.createElement('div');
      card.className = 'hole-card';
      card.id        = `hole-card-${hole.n}`;
      card.innerHTML = buildCardHTML(hole);
      container.appendChild(card);
    });

    Animations.staggerIn(document.querySelectorAll('.hole-card'), 0.1);
    // Bind events for all CONFIG holes at once
    CONFIG.holes.forEach(hole => bindCardForHole(hole.n));
  }

  // ── Card HTML template (shared by buildCards + appendCard) ───────────────────

  function buildCardHTML(hole) {
    return `
      <div class="hole-header">
        <span class="hole-number">Hole ${hole.n}</span>
        <span class="hole-bar">${hole.bar}</span>
        <span class="hole-score-badge" id="score-badge-${hole.n}">Par</span>
      </div>
      ${hole.signature ? `<p class="hole-signature">★ ${hole.signature}</p>` : ''}

      <div class="drink-row">
        <span class="drink-label">Drinks</span>
        <div class="counter">
          <button class="counter-btn counter-minus" data-hole="${hole.n}" data-field="drinks" aria-label="Remove drink">−</button>
          <span class="counter-val" id="drinks-val-${hole.n}">0</span>
          <button class="counter-btn counter-plus"  data-hole="${hole.n}" data-field="drinks" aria-label="Add drink">+</button>
        </div>
      </div>

      <div class="drink-row">
        <button class="btn btn-gold btn-sm btn-block" data-hole="${hole.n}" data-action="colin">
          🍺 Buy Colin a drink
        </button>
        <span class="colin-count" id="colin-val-${hole.n}" hidden>×0</span>
      </div>

      <div class="bonus-row">
        <span class="bonus-label">Bonuses</span>
        <div class="bonus-chips" id="bonuses-${hole.n}">
          ${CONFIG.bonusTypes.map(b => `
            <button class="chip chip--bonus" data-hole="${hole.n}" data-bonus="${b}">
              ${CONFIG.bonusLabels[b]}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="penalty-row" id="penalties-${hole.n}">
        <!-- Incoming penalties rendered here -->
      </div>
    `;
  }

  // ── Event binding — scoped to a single hole card ─────────────────────────────

  function bindCardForHole(n) {
    const card = document.getElementById(`hole-card-${n}`);
    if (!card) return;

    card.querySelectorAll('.counter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const delta = btn.classList.contains('counter-plus') ? 1 : -1;
        incrementField(n, field, delta);
      });
    });

    const colinBtn = card.querySelector('[data-action="colin"]');
    if (colinBtn) colinBtn.addEventListener('click', () => incrementField(n, 'colinDrinks', 1));

    card.querySelectorAll('.chip--bonus').forEach(chip => {
      chip.addEventListener('click', () => toggleBonus(n, chip.dataset.bonus, chip));
    });
  }

  // ── Session listener — watch for new holes added by host ─────────────────────

  function listenToSession() {
    const unsub = DB.sessionRef().onSnapshot(snap => {
      if (!snap.exists) return;
      const customHoles = snap.data().customHoles || [];

      // Update shared state so allHoles() is current everywhere
      App.state.customHoles = customHoles;

      // Append a card for each hole not yet rendered
      customHoles.forEach(hole => {
        if (!_renderedHoleNs.has(hole.n)) {
          appendCard(hole);
          _renderedHoleNs.add(hole.n);
        }
      });
    });
    _unsubs.push(unsub);
  }

  // Append a single hole card for a dynamically-added hole
  function appendCard(hole) {
    const container = document.getElementById('hole-cards');
    const card = document.createElement('div');
    card.className = 'hole-card';
    card.id        = `hole-card-${hole.n}`;
    card.innerHTML = buildCardHTML(hole);
    container.appendChild(card);
    bindCardForHole(hole.n);
    Animations.staggerIn([card]);

    // Render immediately with any data already cached
    if (_holeData[hole.n]) renderHole(hole.n, _holeData[hole.n]);
  }

  // ── Firestore writes — use dot-notation on the player doc ────────────────────

  async function incrementField(holeN, field, delta) {
    const current = _holeData[holeN]?.[field] ?? 0;
    const next    = Math.max(0, current + delta);
    if (next === current) return;

    try {
      await DB.playerRef(_state.playerId).update({
        [`holes.${holeN}.${field}`]: next,
      });
    } catch (e) {
      console.error('Write error:', e);
      Animations.showToast('Write failed — check connection.', 'error');
    }
  }

  async function toggleBonus(holeN, bonusKey, chipEl) {
    const current = _holeData[holeN]?.bonuses?.[bonusKey] ?? false;
    try {
      await DB.playerRef(_state.playerId).update({
        [`holes.${holeN}.bonuses.${bonusKey}`]: !current,
      });
      Animations.scoreBounce(chipEl);
    } catch (e) {
      console.error('Write error:', e);
    }
  }

  // ── Firestore listener — single snapshot on the player doc ──────────────────
  //
  // Because holes are a map field on the player document, any hole update triggers
  // this listener immediately — no subcollection polling needed.

  function listenToPlayer() {
    const unsub = DB.playerRef(_state.playerId).onSnapshot(snap => {
      if (!snap.exists) return;

      const { holes = {} } = snap.data();

      // Process all holes present in the player doc (CONFIG + any custom ones added at runtime)
      const allNs = new Set([
        ...CONFIG.holes.map(h => h.n),
        ...Object.keys(holes).map(Number),
      ]);

      allNs.forEach(n => {
        const hole = { n };   // minimal stub — renderHole only needs the hole number
        const prev = _holeData[n];
        const curr = holes[n] || scoring.emptyHole();

        // ── Detect new incoming penalties and fire toast + shake ────────────
        if (_initialized && prev) {
          const prevIds = new Set((prev.penalties || []).map(p => p.id));
          const newActive = (curr.penalties || []).filter(
            p => p.status === 'active' && !prevIds.has(p.id)
          );
          newActive.forEach(p => {
            const label = CONFIG.penaltyLabels[p.type] || p.type;
            Animations.showToast(`🚩 Penalty: ${label} (by ${p.byName})`, 'error');
            setTimeout(() => {
              const rows = document.querySelectorAll(`#penalties-${n} .penalty-row-item`);
              const last = rows[rows.length - 1];
              if (last) Animations.penaltyShakeIn(last);
            }, 60);
          });
        }

        _holeData[n] = curr;
        renderHole(n, curr);
      });

      _initialized = true;
      renderRunningTotal();
    });

    _unsubs.push(unsub);
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

  function renderHole(n, data) {
    // Drinks counter
    const drinksEl = document.getElementById(`drinks-val-${n}`);
    if (drinksEl) {
      const prev = Number(drinksEl.textContent);
      drinksEl.textContent = data.drinks ?? 0;
      if ((data.drinks ?? 0) !== prev) Animations.scoreBounce(drinksEl);
    }

    // Colin drinks
    const colinEl = document.getElementById(`colin-val-${n}`);
    if (colinEl) {
      const cd = data.colinDrinks ?? 0;
      colinEl.hidden      = cd === 0;
      colinEl.textContent = `×${cd}`;
    }

    // Bonus chips
    const bonuses = data.bonuses || {};
    document.querySelectorAll(`#bonuses-${n} .chip--bonus`).forEach(chip => {
      chip.classList.toggle('chip--active', !!bonuses[chip.dataset.bonus]);
    });

    // Score badge
    const hScore  = scoring.holeScore(data);
    const badgeEl = document.getElementById(`score-badge-${n}`);
    if (badgeEl) {
      Animations.badgeCrossFade(badgeEl, CONFIG.scoreTerm(hScore));
      badgeEl.dataset.score = hScore;
      badgeEl.className     = `hole-score-badge ${scoreBadgeClass(hScore)}`;
    }

    // Penalties
    renderPenalties(n, data.penalties || []);
  }

  function renderPenalties(holeN, penalties) {
    const container = document.getElementById(`penalties-${holeN}`);
    if (!container) return;
    container.innerHTML = '';

    penalties.forEach(p => {
      const isActive = p.status === 'active';
      const isVoided = p.status === 'voided';

      // Determine what action/badge to show on the right
      let actionHTML = '';
      if (isVoided) {
        actionHTML = '<span class="badge badge--voided">Voided</span>';
      } else if (isActive && p.disputed) {
        actionHTML = '<span class="badge badge--pending">⏳ Host reviewing</span>';
      } else if (isActive && p.disputeDenied) {
        actionHTML = '<span class="badge badge--denied">✗ Stands</span>';
      } else if (isActive && CONFIG.disputesEnabled) {
        actionHTML = `<button class="btn btn-ghost btn-xs dispute-btn" data-penalty-id="${p.id}" data-hole="${holeN}">Dispute</button>`;
      }

      const row = document.createElement('div');
      row.className = `penalty-row-item ${isVoided ? 'penalty-row-item--voided' : ''}`;
      row.innerHTML = `
        <span class="penalty-type">${CONFIG.penaltyLabels[p.type] || p.type}</span>
        <span class="penalty-by">filed by ${p.byName || 'unknown'}</span>
        ${actionHTML}
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.dispute-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        Penalty.openDispute(_state.playerId, btn.dataset.hole, btn.dataset.penaltyId)
      );
    });
  }

  function renderRunningTotal() {
    const total = scoring.totalScore(_holeData);
    const el    = document.getElementById('running-total');
    if (!el) return;
    el.textContent = total === 0 ? 'E' : (total > 0 ? `+${total}` : `${total}`);
    Animations.scoreBounce(el);
  }

  function scoreBadgeClass(score) {
    if (score >= 2)  return 'badge--double-bogey';
    if (score === 1) return 'badge--bogey';
    if (score === 0) return 'badge--par';
    if (score === -1) return 'badge--birdie';
    if (score === -2) return 'badge--eagle';
    return 'badge--albatross';
  }

  return { init };
})();
