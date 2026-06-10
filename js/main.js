/* ============================================================
   Robert Lamprecht — Portfolio
   GSAP signature moments: hero line reveals, hairline draws,
   scroll-triggered section reveals. Vanilla JS, no build step.
   ============================================================ */

(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INK = "#161613";
  const ACCENT = "#e2421f";

  /* ---------- Easter egg: console greeting ---------- */

  console.log(
    "%c\n" +
    "        /\\\n" +
    "       /  \\\n" +
    "  ____/    \\____/\\______ mV\n" +
    "                \\/\n",
    "color:#e2421f;font-family:monospace;font-size:12px;"
  );
  console.log(
    "%cRobert Lamprecht — neuroscience · neural engineering\n" +
    "%cYou inspect elements. I inspect spinal cords.\n" +
    "Say hi: rlamprechtd@gmail.com\n\n" +
    "P.S. Try pressing and holding my name. Every neuron has a threshold.\n" +
    "P.P.S. The course is open, if you can find the clubhouse.",
    "font-family:monospace;font-size:13px;font-weight:bold;color:#161613;",
    "font-family:monospace;font-size:12px;color:#55554f;"
  );

  /* ---------- Easter egg: the 19th hole door ---------- */
  /* Triggers: typing "game" anywhere, or double-clicking the R in Robert. */

  const hole19 = document.getElementById("hole19");
  const closeBtn = hole19.querySelector(".hole19-close");
  let doorOpen = false;

  function openDoor() {
    if (doorOpen) return;
    doorOpen = true;
    hole19.hidden = false;
    if (!reduceMotion) {
      gsap.killTweensOf(hole19);
      gsap.fromTo(hole19,
        { y: 90, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.7, ease: "back.out(1.4)" }
      );
    }
  }

  function closeDoor() {
    if (!doorOpen) return;
    doorOpen = false;
    if (reduceMotion) {
      hole19.hidden = true;
      return;
    }
    gsap.killTweensOf(hole19);
    gsap.to(hole19, {
      y: 90,
      autoAlpha: 0,
      duration: 0.45,
      ease: "power3.in",
      onComplete: () => { hole19.hidden = true; },
    });
  }

  let keyBuffer = "";
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeDoor(); return; }
    if (e.target instanceof Element && e.target.matches("input, textarea, select")) return;
    if (/^[a-z]$/i.test(e.key)) {
      keyBuffer = (keyBuffer + e.key.toLowerCase()).slice(-8);
      if (keyBuffer.endsWith("game")) openDoor();
    }
  });

  document.getElementById("r-trigger").addEventListener("dblclick", openDoor);
  closeBtn.addEventListener("click", closeDoor);

  /* ---------- Local time (ATL) ---------- */

  const clock = document.getElementById("local-time");
  function tick() {
    clock.textContent = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      timeZone: "America/New_York",
    });
  }
  tick();
  setInterval(tick, 1000);

  /* ---------- Studio: band player expand ---------- */
  /* Functional control — must work even with reduced motion. */

  const bandToggle = document.getElementById("band-toggle");
  if (bandToggle) {
    const player = document.getElementById("band-player");
    const iframe = player.querySelector("iframe");
    const indicator = bandToggle.querySelector(".band-indicator");
    let bandOpen = false;

    bandToggle.addEventListener("click", () => {
      bandOpen = !bandOpen;
      bandToggle.setAttribute("aria-expanded", String(bandOpen));

      // Lazy-load the Spotify embed on first open
      if (bandOpen && !iframe.src) iframe.src = iframe.dataset.src;

      if (reduceMotion) {
        player.hidden = !bandOpen;
        indicator.textContent = bandOpen ? "×" : "+";
        return;
      }

      gsap.killTweensOf([player, indicator]);
      gsap.to(indicator, {
        rotation: bandOpen ? 45 : 0,
        duration: 0.45,
        ease: "power3.out",
      });

      if (bandOpen) {
        player.hidden = false;
        gsap.fromTo(player,
          { height: 0, autoAlpha: 0 },
          {
            height: "auto",
            autoAlpha: 1,
            duration: 0.7,
            ease: "power3.inOut",
            onComplete: () => ScrollTrigger.refresh(),
          }
        );
      } else {
        gsap.to(player, {
          height: 0,
          autoAlpha: 0,
          duration: 0.55,
          ease: "power3.inOut",
          onComplete: () => {
            player.hidden = true;
            ScrollTrigger.refresh();
          },
        });
      }
    });
  }

  if (reduceMotion) {
    // Decorative motion only beyond this point; content is fully visible without it.
    return;
  }

  /* ---------- Hero entrance ---------- */

  const intro = gsap.timeline({ defaults: { ease: "power4.out" } });

  // On narrow screens the statement's line masks are inlined (CSS), so the
  // masked reveal only applies to the name; the statement fades as one block.
  const isNarrow = window.matchMedia("(max-width: 720px)").matches;

  intro
    .from(isNarrow ? ".hero-name .line" : ".hero .line", {
      yPercent: 110,
      duration: 1.1,
      stagger: 0.09,
    });

  if (isNarrow) {
    intro.from(".hero-statement", {
      autoAlpha: 0,
      y: 16,
      duration: 0.8,
      ease: "power2.out",
    }, "-=0.7");
  }

  intro
    .from(".reveal-meta", {
      autoAlpha: 0,
      y: 12,
      duration: 0.7,
      stagger: 0.06,
      ease: "power2.out",
    }, "-=0.6");

  /* ---------- Hairline rules draw in on scroll ---------- */

  gsap.utils.toArray("[data-draw]").forEach((rule) => {
    gsap.from(rule, {
      scaleX: 0,
      duration: 1.1,
      ease: "power3.inOut",
      scrollTrigger: { trigger: rule, start: "top 92%" },
    });
  });

  /* ---------- Section label + content reveals ---------- */

  gsap.utils.toArray("[data-section]").forEach((section) => {
    const label = section.querySelector(".section-label");
    gsap.from(label.children, {
      autoAlpha: 0,
      y: 24,
      duration: 0.8,
      stagger: 0.08,
      ease: "power3.out",
      scrollTrigger: { trigger: section, start: "top 78%" },
    });
  });

  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    gsap.from(el, {
      autoAlpha: 0,
      y: 32,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 86%" },
    });
  });

  /* ---------- Contact rows: tactile hover ---------- */

  document.querySelectorAll(".contact-link").forEach((link) => {
    const arrow = link.querySelector(".contact-arrow");
    const value = link.querySelector(".contact-value");

    link.addEventListener("mouseenter", () => {
      gsap.to(arrow, { x: 6, color: "#e2421f", duration: 0.35, ease: "power2.out" });
      gsap.to(value, { x: 8, duration: 0.35, ease: "power2.out" });
    });
    link.addEventListener("mouseleave", () => {
      gsap.to(arrow, { x: 0, color: "#55554f", duration: 0.4, ease: "power2.out" });
      gsap.to(value, { x: 0, duration: 0.4, ease: "power2.out" });
    });
  });

  /* ---------- Easter egg: action potential (hold the name to fire) ---------- */

  const heroName = document.getElementById("hero-name");
  let chargeTween = null;
  let refractory = false;

  function fireActionPotential() {
    chargeTween = null;
    refractory = true;

    // The waveform: rest → threshold → spike → repolarize → undershoot → rest
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "ap-overlay");
    svg.setAttribute("viewBox", "0 0 1200 300");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d",
      "M0,200 L420,200 C450,198 462,192 472,176 L502,30 L534,236 C552,244 570,236 592,212 L640,200 L1200,200"
    );
    svg.appendChild(path);
    document.body.appendChild(svg);

    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.killTweensOf([path, svg]);
        svg.remove();
      },
    });
    tl.to(path, { strokeDashoffset: 0, duration: 0.9, ease: "power1.in" })
      .to(svg, { autoAlpha: 0, duration: 0.5, ease: "power2.out" }, "+=0.15");

    // Jolt the name, then settle back to rest
    gsap.fromTo(heroName, { x: -5 }, { x: 0, duration: 0.6, ease: "elastic.out(1, 0.3)" });
    gsap.to(heroName, { color: INK, duration: 0.8, ease: "power2.out", delay: 0.25 });

    // Refractory period — no firing while the membrane recovers
    setTimeout(() => { refractory = false; }, 2000);
  }

  function beginCharge(e) {
    if (refractory || chargeTween) return;
    if (e.type === "mousedown" && e.button !== 0) return;
    chargeTween = gsap.to(heroName, {
      color: ACCENT,
      duration: 1.1,
      ease: "power2.in",
      onComplete: fireActionPotential,
    });
  }

  function cancelCharge() {
    if (!chargeTween) return;
    chargeTween.kill();
    chargeTween = null;
    // Subthreshold stimulus — decay back to resting potential
    gsap.to(heroName, { color: INK, duration: 0.5, ease: "power2.out" });
  }

  heroName.addEventListener("mousedown", beginCharge);
  heroName.addEventListener("touchstart", beginCharge, { passive: true });
  ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach((evt) =>
    heroName.addEventListener(evt, cancelCharge)
  );

  /* ---------- Tag chips: stagger pop on scroll ---------- */

  const tags = document.querySelectorAll(".tag-list li");
  if (tags.length) {
    gsap.from(tags, {
      autoAlpha: 0,
      scale: 0.85,
      duration: 0.5,
      stagger: 0.045,
      ease: "back.out(1.6)",
      scrollTrigger: { trigger: ".tag-list", start: "top 88%" },
    });
  }
})();
