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

    const tl = gsap.timeline();
    tl.from(flag,  { y: -40, opacity: 0, duration: 0.5, ease: 'bounce.out' })
      .from(title, { y: -20, opacity: 0, duration: 0.45, ease: 'power2.out' }, '-=0.1')
      .from(sub,   { y: 12,  opacity: 0, duration: 0.35, ease: 'power2.out' }, '-=0.1')
      .from('#landing-choice .btn', { y: 14, opacity: 0, stagger: 0.08, duration: 0.35, ease: 'back.out(1.5)' }, '-=0.05');
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

  // Show rules overlay
  function showRules(el) {
    el.hidden = false;
    gsap.fromTo(el,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' }
    );
  }

  // Hide rules overlay
  function hideRules(el) {
    gsap.to(el, {
      opacity: 0, y: 20, duration: 0.24, ease: 'power2.in',
      onComplete: () => { el.hidden = true; }
    });
  }

  // Show party games overlay
  function showGames(el) {
    el.hidden = false;
    gsap.fromTo(el.querySelector('.games-card-container'),
      { opacity: 0, scale: 0.8, y: 50 },
      { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)' }
    );
    gsap.fromTo(el.querySelector('.games-overlay-backdrop'),
      { opacity: 0 },
      { opacity: 1, duration: 0.3 }
    );
  }

  // Hide party games overlay
  function hideGames(el) {
    gsap.to(el.querySelector('.games-card-container'), {
      opacity: 0, scale: 0.8, y: 30, duration: 0.25, ease: 'power2.in'
    });
    gsap.to(el.querySelector('.games-overlay-backdrop'), {
      opacity: 0, duration: 0.25,
      onComplete: () => { el.hidden = true; }
    });
  }

  // GSAP Confetti Blast particle explosion
  function confettiBlast(x, y) {
    const colors = ['#1B4332', '#2D6A4F', '#40916C', '#C99A2E', '#F5F0E8', '#FF6B6B', '#4D96FF', '#FFD93D', '#FF8AAE'];
    const particleCount = 30;

    const startX = (typeof x === 'number') ? x : window.innerWidth / 2;
    const startY = (typeof y === 'number') ? y : window.innerHeight / 2;

    for (let i = 0; i < particleCount; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-particle';
      
      const size = gsap.utils.random(6, 12);
      const color = gsap.utils.random(colors);
      const isCircle = Math.random() > 0.5;

      gsap.set(el, {
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: isCircle ? '50%' : '2px',
        position: 'fixed',
        left: 0,
        top: 0,
        x: startX,
        y: startY,
        pointerEvents: 'none',
        zIndex: 9999
      });

      document.body.appendChild(el);

      // Random propulsion angle (upwards arc)
      const angle = gsap.utils.random(-120, -60); // Degrees, pointing mostly up
      const angleRad = angle * (Math.PI / 180);
      const velocity = gsap.utils.random(150, 280); // Speed in pixels per second

      // Calculate initial velocity vector components
      const vx = Math.cos(angleRad) * velocity;
      const vy = Math.sin(angleRad) * velocity;

      // Animate using independent x and y values for parabolic motion
      gsap.to(el, {
        x: `+=${vx * 0.8 + gsap.utils.random(-40, 40)}`,
        duration: gsap.utils.random(1.2, 1.8),
        ease: 'power1.out'
      });

      gsap.timeline()
        .to(el, {
          y: `+=${vy * 0.8}`,
          duration: 0.5,
          ease: 'power2.out'
        })
        .to(el, {
          y: `+=${gsap.utils.random(250, 450)}`,
          duration: gsap.utils.random(1.0, 1.5),
          ease: 'power2.in'
        });

      gsap.to(el, {
        rotation: gsap.utils.random(360, 1080),
        rotationX: gsap.utils.random(360, 1080),
        rotationY: gsap.utils.random(360, 1080),
        opacity: 0,
        scale: 0.2,
        duration: gsap.utils.random(1.5, 2.3),
        ease: 'power3.out',
        onComplete: () => el.remove()
      });
    }
  }

  return {
    shake, staggerIn, scoreBounce, badgeCrossFade,
    slideIn, slideOut, penaltyShakeIn, pulseLoop,
    showToast, landingEntrance, winnerReveal,
    showRules, hideRules, showGames, hideGames, confettiBlast
  };
})();
