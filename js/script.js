// Intro reveal: a full-screen color panel swipes off to the left on load,
// then the wordmark fades in behind it.
(function introReveal() {
  const overlay = document.getElementById('intro-overlay');
  const logo = document.querySelector('.wordmark-logo');
  if (!overlay) return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.add('intro-locked');

  function unlock() {
    overlay.remove();
    document.documentElement.classList.remove('intro-locked');
    if (logo) {
      setTimeout(() => logo.classList.add('is-visible'), prefersReducedMotion ? 0 : 150);
    }
  }

  if (prefersReducedMotion) {
    unlock();
    return;
  }

  setTimeout(() => {
    requestAnimationFrame(() => overlay.classList.add('intro-hide'));
    overlay.addEventListener('transitionend', unlock, { once: true });
  }, 450);
})();

// Letter-by-letter scroll reveal: each character starts dim/thin and opaques
// + bolds up as a fixed "reading line" sweeps down through the paragraph on
// scroll (matches ranomi.nl, which reveals per-letter rather than per-word —
// the much finer granularity is what makes the sweep read as smooth instead
// of stepped). Each word is wrapped so it still can't break mid-word.
(function initScrollTextReveal() {
  const containers = document.querySelectorAll('.statement-body');
  if (!containers.length) return;

  const blocks = Array.from(containers).map((container) => {
    container.querySelectorAll('p').forEach((p) => {
      const text = p.textContent;
      p.innerHTML = text
        .split(/(\s+)/)
        .map((chunk) => {
          if (chunk.trim() === '') return chunk;
          const letters = chunk
            .split('')
            .map((ch) => `<span class="sw">${ch}</span>`)
            .join('');
          return `<span class="sw-word">${letters}</span>`;
        })
        .join('');
    });
    return { container, letters: Array.from(container.querySelectorAll('.sw')) };
  });

  let ticking = false;

  function update() {
    ticking = false;
    const readLine = window.innerHeight * 0.6;
    blocks.forEach(({ container, letters }) => {
      const rect = container.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (readLine - rect.top) / rect.height));
      const revealCount = Math.round(progress * letters.length);
      letters.forEach((l, i) => l.classList.toggle('is-revealed', i < revealCount));
    });
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  window.addEventListener('resize', update);
  update();
})();

// Hero polaroids fade in one at a time, in a random order, on load
(function heroPhotoReveal() {
  const cards = Array.from(document.querySelectorAll('.hero-gallery .sky-card'));
  if (!cards.length) return;
  cards.forEach((card) => card.classList.add('photo-reveal'));

  const shuffled = cards
    .map((card) => ({ card, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ card }) => card);

  shuffled.forEach((card, i) => {
    setTimeout(() => card.classList.add('is-visible'), 400 + i * 420);
  });
})();

// Hero marquee: curved, seamless, scroll-reactive ribbon of text
(function heroMarquee() {
  const wrap = document.querySelector('.hero-marquee');
  const svg = wrap ? wrap.querySelector('.marquee-svg') : null;
  const path = document.getElementById('marqueePath');
  const ribbon = wrap ? wrap.querySelector('.marquee-ribbon') : null;
  const textPath = document.getElementById('marqueeTextPath');
  const textEl = wrap ? wrap.querySelector('.marquee-text') : null;
  if (!wrap || !svg || !path || !ribbon || !textPath || !textEl) return;

  const UNIT =
    'polaris society ★ launching soon ★ for new york ★ for the daydreamers ★ for the trailblazers ★ for the optimists ★ for connection ★ ';
  const VIEWBOX_WIDTH = 2400;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // <textPath> only draws forward from startOffset — nothing before it, and
  // nothing past the path's own total length, no matter how much text is
  // queued up. So the path needs slack on BOTH sides of the visible window:
  // forward slack so a long phrase never runs off the end, and backward
  // slack so startOffset (which only grows, wrapping within one phrase's
  // length) never lands close enough to the visible window to expose the
  // "nothing drawn before this point" edge. Each tile is written as relative
  // ("c") commands so repeating it just continues the pen from wherever the
  // previous tile left off; the visible tile is the one matching the static
  // 'd' already in the HTML (kept as the no-JS fallback). Control points are
  // derived via Catmull-Rom so the tangent matches exactly at every joint —
  // including the seam between repeated tiles — leaving no sharp kinks.
  const TILE =
    'c 200,-75 483.3,-90 700,-100 c 216.7,-10 400,66.7 600,40 c 200,-26.7 400,-176.7 600,-200 ' +
    'c 200,-23.3 416.7,108.3 600,60 c 183.3,-48.3 300,-275 500,-350 ';
  const TILE_DX = 3000;
  const TILE_DY = -550;
  const VISIBLE_START = { x: -300, y: 630 };
  const BACKWARD_TILES = 9;
  const FORWARD_TILES = 9; // includes the visible tile itself
  const backStartX = VISIBLE_START.x - TILE_DX * BACKWARD_TILES;
  const backStartY = VISIBLE_START.y - TILE_DY * BACKWARD_TILES;
  const EXTENDED_D = `M ${backStartX},${backStartY} ` + TILE.repeat(BACKWARD_TILES + FORWARD_TILES);
  path.setAttribute('d', EXTENDED_D);
  ribbon.setAttribute('d', EXTENDED_D);

  let unitLength = 0;

  function setFontSize() {
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const scale = rect.width / VIEWBOX_WIDTH;
    const targetPx = window.innerWidth < 700 ? 22 : window.innerWidth < 1100 ? 30 : 38;
    textEl.style.fontSize = targetPx / scale + 'px';
  }

  function buildText() {
    const pathLength = path.getTotalLength();
    textPath.textContent = UNIT.repeat(24);
    const total = textPath.getComputedTextLength() || 1;
    unitLength = total / 24;
    // belt and suspenders: if this path/unit combo somehow still isn't covered
    // twice over, add more repeats until it comfortably is.
    if (unitLength > 0) {
      const needed = Math.max(24, Math.ceil((pathLength * 2) / unitLength) + 4);
      if (needed > 24) {
        textPath.textContent = UNIT.repeat(needed);
        unitLength = textPath.getComputedTextLength() / needed;
      }
    }
  }

  function layout() {
    setFontSize();
    buildText();
  }

  layout();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 150);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(layout);
  }

  if (prefersReducedMotion) return;

  // Scroll belongs entirely to the page now — the marquee just animates on
  // its own at a constant speed and never touches wheel/touch/scroll events.
  const baseSpeed = 34; // path units per second
  let offset = 0;
  let lastTime = null;

  function frame(now) {
    if (lastTime === null) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (unitLength > 0) {
      // increasing startOffset shifts each glyph to a larger path-position, i.e. rightward,
      // since this path's own parametrization runs left-to-right
      offset = (offset + baseSpeed * dt) % unitLength;
    }
    textPath.setAttribute('startOffset', String(offset));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

// Scroll reveal
const revealTargets = document.querySelectorAll(
  '.path-card, .work-card, .service-col, .stat, .section-heading, .company-copy, .cta-headline, .statement-heading'
);
revealTargets.forEach((el) => el.classList.add('reveal'));

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
revealTargets.forEach((el) => io.observe(el));

