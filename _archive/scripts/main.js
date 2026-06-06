'use strict';

// ─── Accordion ────────────────────────────────────────────────────────────────

document.querySelectorAll('.accordion-trigger').forEach(btn =>
    btn.addEventListener('click', () =>
        btn.closest('.accordion-item').classList.toggle('open')
    )
);

// ─── SVG helpers ──────────────────────────────────────────────────────────────

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
}

const stage     = document.getElementById('stage');
const figLayer  = svgEl('g'); stage.appendChild(figLayer);  // figures behind hole
const holeLayer = svgEl('g'); stage.appendChild(holeLayer); // hole in front

// ─── Hole ─────────────────────────────────────────────────────────────────────

// Two ellipses: shadow (slightly lower, semi-transparent) + face (solid dark)
const holeShadow = svgEl('ellipse', { fill: 'rgba(0,0,0,0.18)' });
const holeFace   = svgEl('ellipse', { fill: '#0A0A0A' });
holeLayer.append(holeShadow, holeFace);
gsap.set([holeShadow, holeFace], { attr: { rx: 0, ry: 0 } });

function openHole(cx, cy) {
    gsap.set(holeShadow, { attr: { cx, cy: cy + 6 } });
    gsap.set(holeFace,   { attr: { cx, cy } });
    return gsap.to([holeShadow, holeFace], {
        attr: { rx: 38, ry: 16 },
        duration: 0.42,
        ease: 'back.out(2)',
        stagger: 0.06,
    });
}

function closeHole(delay = 0) {
    gsap.to([holeFace, holeShadow], {
        attr: { rx: 0, ry: 0 },
        duration: 0.3,
        ease: 'power2.in',
        delay,
        stagger: 0.05,
    });
}

// ─── Figure ───────────────────────────────────────────────────────────────────
//
// Local coordinate system:
//   origin (0, 0) = feet / floor contact point
//   upward        = negative Y  (head at cy ≈ -32)
//
// GSAP moves the <g> in screen space; limb endpoints are animated via attr:{}.

class Figure {
    constructor() {
        this.g = svgEl('g');
        this.g.setAttribute('stroke',         '#1a1a1a');
        this.g.setAttribute('stroke-width',   '1.5');
        this.g.setAttribute('stroke-linecap', 'round');
        this.g.setAttribute('stroke-linejoin','round');
        this.g.setAttribute('fill',           'none');

        this.head  = this._add('circle', { r: 5.5, cx: 0, cy: -32 });
        this.torso = this._add('line',   { x1: 0, y1: -26, x2: 0,  y2: -14 });
        this.armL  = this._add('line',   { x1: 0, y1: -22, x2: -9, y2: -15 });
        this.armR  = this._add('line',   { x1: 0, y1: -22, x2:  9, y2: -15 });
        this.legL  = this._add('line',   { x1: 0, y1: -14, x2: -5, y2:   0 });
        this.legR  = this._add('line',   { x1: 0, y1: -14, x2:  5, y2:   0 });

        // All transforms (scale, rotation) pivot at feet (0, 0)
        gsap.set(this.g, { transformOrigin: '0px 0px' });
        figLayer.appendChild(this.g);
    }

    _add(tag, attrs) {
        const e = svgEl(tag, attrs);
        this.g.appendChild(e);
        return e;
    }

    // Set all four limb endpoints in one call
    // Each arg is [x2, y2] for that limb
    _pose(al, ar, ll, lr) {
        gsap.set(this.armL, { attr: { x2: al[0], y2: al[1] } });
        gsap.set(this.armR, { attr: { x2: ar[0], y2: ar[1] } });
        gsap.set(this.legL, { attr: { x2: ll[0], y2: ll[1] } });
        gsap.set(this.legR, { attr: { x2: lr[0], y2: lr[1] } });
    }

    drop(holeX, holeY) {
        // Land on the first <hr class="rule"> — it's a natural floor line
        const rule   = document.querySelector('.rule');
        const rRect  = rule?.getBoundingClientRect();
        const groundY = (rRect && rRect.top > 80 && rRect.top < window.innerHeight - 80)
            ? rRect.top
            : window.innerHeight * 0.2;

        const dir    = Math.random() > 0.5 ? 1 : -1;
        const walkTo = dir > 0 ? window.innerWidth + 90 : -90;

        // Start just inside the hole, below its top edge
        gsap.set(this.g, { x: holeX, y: holeY + 14, scaleX: 1, scaleY: 1, rotation: 0 });

        // Falling pose: arms flung up, legs splayed
        this._pose([-14, -28], [14, -28], [-8, 6], [8, 6]);

        const tl = gsap.timeline({ onComplete: () => this._destroy() });

        // ── Fall ──────────────────────────────────────────────────────────────
        tl.to(this.g, {
            y: groundY,
            duration: 0.65,
            ease: 'power3.in',
        });

        // ── Impact squash ─────────────────────────────────────────────────────
        tl.to(this.g, { scaleY: 0.32, scaleX: 1.7,  duration: 0.06, ease: 'none' });
        tl.to(this.g, { scaleY: 1.12, scaleX: 0.88, duration: 0.11, ease: 'power1.out' });
        tl.to(this.g, { scaleY: 1,    scaleX: 1,    duration: 0.18, ease: 'power1.inOut' });

        // Snap limbs to upright before rotating prone
        tl.add(() => this._pose([-9, -15], [9, -15], [-5, 0], [5, 0]));

        // ── Topple flat (rotate 88° around feet) ──────────────────────────────
        tl.to(this.g, { rotation: 88, duration: 0.35, ease: 'power2.in' });

        // ── Lie still ─────────────────────────────────────────────────────────
        tl.to({}, { duration: 0.6 });

        // ── Get up ────────────────────────────────────────────────────────────
        tl.to(this.g, { rotation: 0, duration: 0.55, ease: 'back.out(1.6)' });

        // Brief pause before dusting off
        tl.to({}, { duration: 0.18 });

        // ── Dust off (right arm pats shoulder 3×) ─────────────────────────────
        for (let i = 0; i < 3; i++) {
            tl.to(this.armR, { attr: { x2: 4,  y2: -21 }, duration: 0.12, ease: 'power1.inOut' });
            tl.to(this.armR, { attr: { x2: 9,  y2: -15 }, duration: 0.12, ease: 'power1.out'  });
        }

        // ── Short pause, then walk ─────────────────────────────────────────────
        tl.to({}, { duration: 0.28 });

        tl.add(() => {
            gsap.set(this.g, { scaleX: dir }); // flip to face walking direction
            this._walk();
        });

        tl.to(this.g, {
            x: walkTo,
            duration: 4.5 + Math.random() * 2,
            ease: 'none',
        }, '<');

        return tl;
    }

    _walk() {
        // Opposite-phase arm/leg swing — start each pair at opposing positions
        // so they immediately look mid-stride rather than snapping from rest
        const p = 0.25;
        gsap.fromTo(this.armL,
            { attr: { x2: -11, y2: -17 } },
            { attr: { x2:   9, y2: -14 }, duration: p, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        gsap.fromTo(this.armR,
            { attr: { x2:   9, y2: -14 } },
            { attr: { x2: -11, y2: -17 }, duration: p, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        gsap.fromTo(this.legL,
            { attr: { x2:  -9, y2: 0 } },
            { attr: { x2:   4, y2: 0 },  duration: p, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        gsap.fromTo(this.legR,
            { attr: { x2:   4, y2: 0 } },
            { attr: { x2:  -9, y2: 0 },  duration: p, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    }

    _destroy() {
        gsap.killTweensOf([this.g, this.armL, this.armR, this.legL, this.legR]);
        this.g.remove();
    }
}

// ─── Do Not Push ──────────────────────────────────────────────────────────────

document.getElementById('do-not-push').addEventListener('click', () => {
    // Random horizontal position, near the top of the page
    const holeX = window.innerWidth  * (0.28 + Math.random() * 0.44);
    const holeY = 88 + Math.random() * 38;

    openHole(holeX, holeY);

    // Slight delay so the hole is open before the figure drops through
    gsap.delayedCall(0.34, () => {
        new Figure().drop(holeX, holeY);
        closeHole(1.1); // close once figure has cleared the hole
    });
});
