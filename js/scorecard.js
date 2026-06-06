// ─── scorecard.js — personal scorecard view ───────────────────────────────────

const Scorecard = (() => {

  let _state = null;
  let _holeData = {};   // { 1: holeDoc, 2: holeDoc, ... }
  let _unsubs  = [];

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init(state) {
    _state = state;
    buildCards();
    listenToHoles();
    listenForIncomingPenalties();
  }

  // ── Build static hole cards ──────────────────────────────────────────────────

  function buildCards() {
    const container = document.getElementById('hole-cards');
    container.innerHTML = '';

    CONFIG.holes.forEach(hole => {
      const card = document.createElement('div');
      card.className = 'hole-card';
      card.id        = `hole-card-${hole.n}`;
      card.innerHTML = `
        <div class="hole-header">
          <span class="hole-number">Hole ${hole.n}</span>
          <span class="hole-bar">${hole.bar}</span>
          <span class="hole-score-badge" id="score-badge-${hole.n}">Par</span>
        </div>
        <p class="hole-signature">★ ${hole.signature}</p>

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
      container.appendChild(card);
    });

    Animations.staggerIn(document.querySelectorAll('.hole-card'), 0.1);
    bindCardEvents();
  }

  // ── Event binding ────────────────────────────────────────────────────────────

  function bindCardEvents() {
    // Drink +/−
    document.querySelectorAll('.counter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const n     = Number(btn.dataset.hole);
        const field = btn.dataset.field;
        const delta = btn.classList.contains('counter-plus') ? 1 : -1;
        incrementField(n, field, delta);
      });
    });

    // Buy Colin a drink
    document.querySelectorAll('[data-action="colin"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = Number(btn.dataset.hole);
        incrementField(n, 'colinDrinks', 1);
      });
    });

    // Bonus chips
    document.querySelectorAll('.chip--bonus').forEach(chip => {
      chip.addEventListener('click', () => {
        const n     = Number(chip.dataset.hole);
        const bonus = chip.dataset.bonus;
        toggleBonus(n, bonus, chip);
      });
    });
  }

  // ── Firestore writes ─────────────────────────────────────────────────────────

  async function incrementField(holeN, field, delta) {
    const current = _holeData[holeN]?.[field] ?? 0;
    const next    = Math.max(0, current + delta);
    if (next === current) return;

    try {
      await DB.holeRef(_state.playerId, holeN).update({
        [field]: next,
      });
    } catch (e) {
      console.error('Write error:', e);
      Animations.showToast('Write failed — check connection.', 'error');
    }
  }

  async function toggleBonus(holeN, bonusKey, chipEl) {
    const current = _holeData[holeN]?.bonuses?.[bonusKey] ?? false;
    try {
      await DB.holeRef(_state.playerId, holeN).update({
        [`bonuses.${bonusKey}`]: !current,
      });
      Animations.scoreBounce(chipEl);
    } catch (e) {
      console.error('Write error:', e);
    }
  }

  // ── Firestore listeners ──────────────────────────────────────────────────────

  function listenToHoles() {
    CONFIG.holes.forEach(hole => {
      const unsub = DB.holeRef(_state.playerId, hole.n).onSnapshot(snap => {
        if (!snap.exists) return;
        const data = snap.data();
        _holeData[hole.n] = data;
        renderHole(hole.n, data);
        renderRunningTotal();
      });
      _unsubs.push(unsub);
    });
  }

  // Watch own player doc for incoming penalties
  function listenForIncomingPenalties() {
    CONFIG.holes.forEach(hole => {
      // Already captured in listenToHoles — penalties are on the hole doc
    });
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
    const hScore   = scoring.holeScore(data);
    const badgeEl  = document.getElementById(`score-badge-${n}`);
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
      const row = document.createElement('div');
      row.className = `penalty-row-item ${p.status === 'voided' ? 'penalty-row-item--voided' : ''}`;
      row.innerHTML = `
        <span class="penalty-type">${CONFIG.penaltyLabels[p.type] || p.type}</span>
        <span class="penalty-by">filed by ${p.byName || 'unknown'}</span>
        ${p.status === 'active' && CONFIG.disputesEnabled
          ? `<button class="btn btn-ghost btn-xs dispute-btn" data-penalty-id="${p.id}" data-hole="${holeN}">Dispute</button>`
          : ''}
        ${p.status === 'voided' ? '<span class="badge badge--voided">Voided</span>' : ''}
      `;
      container.appendChild(row);
    });

    // Bind dispute buttons
    container.querySelectorAll('.dispute-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Penalty.openDispute(_state.playerId, btn.dataset.hole, btn.dataset.penaltyId);
      });
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
    if (score >= 2) return 'badge--double-bogey';
    if (score === 1) return 'badge--bogey';
    if (score === 0) return 'badge--par';
    if (score === -1) return 'badge--birdie';
    if (score === -2) return 'badge--eagle';
    return 'badge--albatross';
  }

  return { init };
})();
