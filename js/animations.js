// ─── animations.js — reusable GSAP helpers ────────────────────────────────────

const Animations = (() => {

  // Shake an element horizontally (wrong code, etc.)
  function shake(el) {
    gsap.fromTo(el,
      { x: 0 },
      { x: 10, duration: 0.07, repeat: 5, yoyo: true, ease: 'power1.inOut',
        onComplete: () => gsap.set(el, { x: 0 }) }
    );
  }

  // Stagger a list of elements up from below
  function staggerIn(els, delay = 0) {
    gsap.from(els, {
      y: 24, opacity: 0, duration: 0.4,
      stagger: 0.07, delay, ease: 'power2.out',
    });
  }

  // Scale-bounce a number element on change
  function scoreBounce(el) {
    gsap.fromTo(el,
      { scale: 1.45 },
      { scale: 1, duration: 0.35, ease: 'back.out(2.5)' }
    );
  }

  // Cross-fade a score badge (swap text then fade in)
  function badgeCrossFade(el, newText) {
    gsap.to(el, {
      opacity: 0, duration: 0.12,
      onComplete: () => {
        el.textContent = newText;
        gsap.to(el, { opacity: 1, duration: 0.18 });
      },
    });
  }

  // Slide in from the right (view transition)
  function slideIn(el) {
    gsap.fromTo(el,
      { x: '100%', opacity: 0 },
      { x: 0, opacity: 1, duration: 0.32, ease: 'power2.out' }
    );
  }

  // Slide out to the left
  function slideOut(el, onComplete) {
    gsap.to(el, {
      x: '-30%', opacity: 0, duration: 0.22, ease: 'power2.in', onComplete,
    });
  }

  // Penalty badge shakes in from the right
  function penaltyShakeIn(el) {
    gsap.fromTo(el,
      { x: 60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.28, ease: 'back.out(2)',
        onComplete: () => shake(el) }
    );
  }

  // Pulse loop (crown badge)
  function pulseLoop(el) {
    gsap.to(el, {
      scale: 1.18, duration: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut',
    });
  }

  // Toast notification
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    gsap.fromTo(toast,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out',
        onComplete: () => {
          gsap.to(toast, {
            opacity: 0, y: -10, duration: 0.3, delay: 3,
            onComplete: () => toast.remove(),
          });
        },
      }
    );
  }

  // Landing entrance sequence
  function landingEntrance() {
    const flag   = document.querySelector('.landing-flag');
    const title  = document.querySelector('.landing-title');
    const sub    = document.querySelector('.landing-subtitle');
    const form   = document.querySelector('.join-form');

    const tl = gsap.timeline();
    tl.from(flag,  { y: -40, opacity: 0, duration: 0.5, ease: 'bounce.out' })
      .from(title, { y: -20, opacity: 0, duration: 0.45, ease: 'power2.out' }, '-=0.1')
      .from(sub,   { y: 12,  opacity: 0, duration: 0.35, ease: 'power2.out' }, '-=0.1')
      .from('.field-wrap', { y: 16, opacity: 0, stagger: 0.1, duration: 0.35, ease: 'power2.out' }, '-=0.1')
      .from('.join-actions', { y: 12, opacity: 0, duration: 0.3, ease: 'back.out(1.5)' }, '-=0.05');
    return tl;
  }

  // Winner reveal sequence
  function winnerReveal(name, score) {
    const el = document.getElementById('winner-reveal');
    el.hidden = false;
    document.getElementById('winner-name').textContent  = name;
    document.getElementById('winner-score').textContent = score;

    gsap.fromTo(el,
      { opacity: 0, scale: 0.85 },
      { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(1.5)' }
    );
  }

  return {
    shake, staggerIn, scoreBounce, badgeCrossFade,
    slideIn, slideOut, penaltyShakeIn, pulseLoop,
    showToast, landingEntrance, winnerReveal,
  };
})();
