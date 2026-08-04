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

  function wrapChunk(chunk, italic) {
    if (chunk.trim() === '') return chunk;
    const letters = chunk
      .split('')
      .map((ch) => `<span class="sw">${ch}</span>`)
      .join('');
    const word = `<span class="sw-word">${letters}</span>`;
    return italic ? `<em>${word}</em>` : word;
  }

  function wrapParagraph(p) {
    let html = '';
    p.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        html += node.textContent.split(/(\s+)/).map((c) => wrapChunk(c, false)).join('');
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'EM') {
        html += node.textContent.split(/(\s+)/).map((c) => wrapChunk(c, true)).join('');
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        html += node.textContent.split(/(\s+)/).map((c) => wrapChunk(c, false)).join('');
      }
    });
    p.innerHTML = html;
  }

  const blocks = Array.from(containers).map((container) => {
    container.querySelectorAll('p').forEach(wrapParagraph);
    return { container, letters: Array.from(container.querySelectorAll('.sw')) };
  });

  let ticking = false;

  function update() {
    ticking = false;
    // Reading line near the bottom of the viewport so the sweep starts as soon
    // as the paragraph enters view — by the time the statement section is
    // framed, a solid chunk of the body has already filled in.
    const readLine = window.innerHeight * 0.9;
    blocks.forEach(({ container, letters }) => {
      const rect = container.getBoundingClientRect();
      // Modest lead-in so reveal begins before the top hits the reading line,
      // with a longer travel so the fill sweeps more gradually through scroll.
      const lead = window.innerHeight * 0.15;
      const travel = Math.max(rect.height * 1.05, 1);
      const progress = Math.min(1, Math.max(0, (readLine + lead - rect.top) / (travel + lead)));
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

// Statement → Community → Creator cards (fooror-style sticky parade).
// Phase 1: statement fades, polaroids rearrange into a linear row.
// Phase 2: community copy fades in and stays pinned.
// Phase 3: creator cards float up over the copy one by one; after the last
// card exits, the section unpins into the next page section.
(function communityScrollStory() {
  const story = document.querySelector('.story');
  const copy = document.querySelector('.story-copy');
  const communityCopy = document.querySelector('.community-copy');
  const polaroidLayer = document.querySelector('.community-polaroids');
  const polaroids = Array.from(document.querySelectorAll('.comm-polaroid'));
  const creatorCards = Array.from(document.querySelectorAll('.creator-card'));
  if (!story || !copy || !polaroids.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Share of the runway spent on the polaroid intro before cards take over.
  const INTRO_END = 0.28;
  const COPY_IN_START = 0.18;
  const CARDS_START = 0.30;

  // from = peeking along the bottom edge (never overlapping the statement);
  // to = linear scattered row across the top once the copy has faded.
  const desktop = [
    { from: { x: -2, y: 82, w: 13, rot: -8 }, to: { x: -1, y: 8, w: 14, rot: -5 }, ar: '1 / 0.95', z: 3 },
    { from: { x: 12, y: 88, w: 15, rot: 4 }, to: { x: 14, y: 18, w: 13, rot: 3 }, ar: '0.85 / 1', z: 5 },
    { from: { x: 28, y: 80, w: 12, rot: -3 }, to: { x: 29, y: 6, w: 15, rot: -4 }, ar: '1 / 0.8', z: 2 },
    { from: { x: 42, y: 90, w: 14, rot: 6 }, to: { x: 46, y: 16, w: 12, rot: 2.5 }, ar: '0.82 / 1', z: 6 },
    { from: { x: 56, y: 83, w: 13, rot: -5 }, to: { x: 60, y: 7, w: 14, rot: -3 }, ar: '1 / 0.9', z: 4 },
    { from: { x: 70, y: 89, w: 14, rot: 3 }, to: { x: 75, y: 20, w: 12, rot: 4 }, ar: '0.88 / 1', z: 3 },
    { from: { x: 84, y: 81, w: 12, rot: -6 }, to: { x: 88, y: 10, w: 13, rot: -2 }, ar: '1 / 0.85', z: 5 },
  ];
  const mobile = [
    { from: { x: -4, y: 84, w: 30, rot: -6 }, to: { x: -2, y: 6, w: 34, rot: -4 }, ar: '1 / 0.95', z: 3 },
    { from: { x: 28, y: 90, w: 34, rot: 5 }, to: { x: 36, y: 10, w: 32, rot: 3 }, ar: '0.85 / 1', z: 5 },
    { from: { x: 62, y: 85, w: 32, rot: -3 }, to: { x: 68, y: 8, w: 30, rot: -3.5 }, ar: '1 / 0.8', z: 2 },
    { from: { x: 8, y: 96, w: 28, rot: 4 }, to: { x: 4, y: 36, w: 32, rot: 2 }, ar: '0.82 / 1', z: 4 },
    { from: { x: 42, y: 98, w: 30, rot: -5 }, to: { x: 40, y: 40, w: 30, rot: -2 }, ar: '1 / 0.9', z: 6 },
    { from: { x: 72, y: 94, w: 28, rot: 3 }, to: { x: 70, y: 38, w: 28, rot: 4 }, ar: '0.88 / 1', z: 3 },
    { from: { x: 20, y: 102, w: 26, rot: -4 }, to: { x: 18, y: 58, w: 28, rot: -3 }, ar: '1 / 0.85', z: 5 },
  ];

  // Slight left/right drift + tilt so the parade doesn't feel like a slot machine.
  const cardMotion = [
    { x: -6, rot: -3 },
    { x: 7, rot: 2.5 },
    { x: -4, rot: -2 },
    { x: 8, rot: 3 },
  ];

  const state = polaroids.map((el) => ({ el, from: null, to: null }));

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function layout() {
    const keyframes = window.innerWidth < 900 ? mobile : desktop;
    state.forEach((s, i) => {
      const k = keyframes[i];
      if (!k) return;
      s.from = k.from;
      s.to = k.to;
      s.el.style.aspectRatio = k.ar;
      s.el.style.zIndex = String(k.z);
    });
  }

  function apply(progress) {
    const introT = easeInOut(clamp(progress / INTRO_END, 0, 1));

    // Statement fades across the intro.
    const copyOpacity = 1 - clamp(progress / (INTRO_END * 0.85), 0, 1);
    copy.style.opacity = String(copyOpacity);
    copy.style.filter = copyOpacity < 1 ? `blur(${(1 - copyOpacity) * 6}px)` : 'none';

    // Polaroids rearrange during intro, then dim while cards parade.
    state.forEach(({ el, from, to }) => {
      if (!from || !to) return;
      const x = lerp(from.x, to.x, introT);
      const y = lerp(from.y, to.y, introT);
      const w = lerp(from.w, to.w, introT);
      const rot = lerp(from.rot, to.rot, introT);
      el.style.width = w + '%';
      el.style.transform = `translate(${x}vw, ${y}vh) rotate(${rot}deg)`;
    });
    if (polaroidLayer) {
      const dim = progress > INTRO_END ? clamp(1 - (progress - INTRO_END) / 0.12, 0.25, 1) : 1;
      polaroidLayer.style.opacity = String(dim);
    }

    // Community copy fades in near the end of the intro and stays pinned.
    const headT = clamp((progress - COPY_IN_START) / (INTRO_END - COPY_IN_START), 0, 1);
    if (communityCopy) {
      communityCopy.style.opacity = String(headT);
      communityCopy.style.transform = `translateY(calc(-50% + ${(1 - headT) * 28}px))`;
    }

    // Creator cards: each rides from below the fold, through center, off the top.
    const n = creatorCards.length;
    if (n) {
      const cardRun = Math.max(1 - CARDS_START, 0.001);
      // Travel window per card — shorter = snappier pass-through.
      const windowSize = cardRun / (n * 0.75);
      // Start the next card while the previous is still mid-screen (~40% through).
      const stagger = windowSize * 0.4;

      creatorCards.forEach((card, i) => {
        const start = CARDS_START + i * stagger;
        const local = clamp((progress - start) / windowSize, 0, 1);
        const eased = easeInOut(local);
        const motion = cardMotion[i % cardMotion.length];
        // Enter just under the fold so the gap to the copy isn't a huge empty band.
        const y = lerp(92, -42, eased);
        const x = motion.x;
        const rot = motion.rot;
        const fade = local < 0.06 ? local / 0.06 : local > 0.94 ? (1 - local) / 0.06 : 1;
        card.style.opacity = String(clamp(fade, 0, 1));
        card.style.transform = `translate(calc(-50% + ${x}vw), ${y}vh) rotate(${rot}deg)`;
        card.style.zIndex = String(10 + i);
      });
    }
  }

  let ticking = false;
  function update() {
    ticking = false;
    const rect = story.getBoundingClientRect();
    const travel = story.offsetHeight - window.innerHeight;
    if (travel <= 0) {
      apply(1);
      return;
    }
    const progress = clamp(-rect.top / travel, 0, 1);
    apply(progress);
  }

  layout();

  if (prefersReducedMotion) {
    apply(1);
    creatorCards.forEach((card, i) => {
      card.style.opacity = i === creatorCards.length - 1 ? '1' : '0';
      card.style.transform = 'translate(-50%, 28vh) rotate(0deg)';
    });
    return;
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
  window.addEventListener('resize', () => {
    layout();
    update();
  });
  update();
})();

// This is Polaris: vertical carousel with clock-like ticks.
// Smooth eased glide between seats. Only the center word is fully filled —
// opacity falls off continuously above/below (no font-weight jumps).
(function polarisVerticalCarousel() {
  const list = document.getElementById('access-list');
  const carousel = document.querySelector('.access-carousel');
  if (!list || !carousel) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const labels = Array.from(list.querySelectorAll('.access-item')).map((el) => el.textContent.trim());
  const n = labels.length;
  if (!n) return;

  const GLIDE_MS = 850;
  const PAUSE_MS = 1300;

  list.innerHTML = '';
  for (let copy = 0; copy < 3; copy++) {
    labels.forEach((label) => {
      const li = document.createElement('li');
      li.className = 'access-item';
      li.textContent = label;
      list.appendChild(li);
    });
  }

  const nodes = Array.from(list.querySelectorAll('.access-item'));
  let offset = n;
  let animating = false;
  let pauseTimer = 0;
  let raf = 0;
  let itemH = 80;
  let active = true; // false while off-screen or reduced-motion

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function alphaForDistance(dist) {
    if (dist < 0.15) return 1;
    if (dist < 1) return 0.72 - (dist - 0.15) * 0.28;
    if (dist < 2) return 0.48 - (dist - 1) * 0.22;
    return Math.max(0.14, 0.26 - (dist - 2) * 0.1);
  }

  function measure() {
    itemH = nodes[0] ? nodes[0].getBoundingClientRect().height : 80;
  }

  function paint(pos) {
    const centerY = (carousel.clientHeight - itemH) / 2;
    list.style.transform = `translateY(${centerY - pos * itemH}px)`;
    nodes.forEach((el, i) => {
      el.style.color = `rgba(22, 21, 27, ${alphaForDistance(Math.abs(i - pos))})`;
    });
  }

  function snapIfNeeded() {
    if (offset >= n * 2) {
      offset -= n;
      paint(offset);
    }
  }

  function clearTimers() {
    clearTimeout(pauseTimer);
    pauseTimer = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function glideToNext() {
    if (!active || animating) return;
    animating = true;
    const start = offset;
    const end = offset + 1;
    const t0 = performance.now();

    function frame(now) {
      if (!active) {
        animating = false;
        return;
      }
      const p = Math.min(1, (now - t0) / GLIDE_MS);
      offset = start + (end - start) * easeInOutCubic(p);
      paint(offset);

      if (p < 1) {
        raf = requestAnimationFrame(frame);
        return;
      }

      offset = end;
      animating = false;
      snapIfNeeded();
      paint(offset);
      // Always queue the next tick — this is what keeps the loop alive.
      pauseTimer = window.setTimeout(glideToNext, PAUSE_MS);
    }

    raf = requestAnimationFrame(frame);
  }

  function startLoop() {
    active = true;
    clearTimers();
    animating = false;
    offset = Math.round(offset);
    snapIfNeeded();
    paint(offset);
    pauseTimer = window.setTimeout(glideToNext, PAUSE_MS);
  }

  function stopLoop() {
    active = false;
    clearTimers();
    animating = false;
    offset = Math.round(offset);
    snapIfNeeded();
    paint(offset);
  }

  measure();
  paint(offset);
  window.addEventListener('resize', () => {
    measure();
    paint(offset);
  });

  if (prefersReducedMotion) return;

  // Run only while the section is on screen; always restart when it re-enters.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) startLoop();
          else stopLoop();
        });
      },
      { threshold: 0.2 }
    );
    io.observe(carousel);
  } else {
    startLoop();
  }

  // If the tab was backgrounded mid-glide, kick the loop again on return.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && active && !animating && !pauseTimer) {
      pauseTimer = window.setTimeout(glideToNext, 200);
    }
  });
})();

// Belong CTA: as the user scrolls the blue runway, creators → founders →
// thinkers → dreamers fill from shaded to solid white, one after another.
// While this section is on screen, hide the fixed header apply link so only
// the in-section CTA remains.
(function belongScrollFill() {
  const section = document.querySelector('.belong');
  const words = Array.from(document.querySelectorAll('#belong-words .belong-word'));
  const header = document.querySelector('.site-header');
  if (!section || !words.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DIM = 'rgba(255, 250, 245, 0.2)';
  const FULL = 'rgba(255, 250, 245, 1)';

  function lerpColor(t) {
    const a = 0.2 + (1 - 0.2) * t;
    return `rgba(255, 250, 245, ${a})`;
  }

  function paint(progress) {
    const n = words.length;
    words.forEach((el, i) => {
      const start = i / n;
      const end = (i + 1) / n;
      let t = (progress - start) / (end - start);
      t = Math.min(1, Math.max(0, t));
      el.style.color = t <= 0 ? DIM : t >= 1 ? FULL : lerpColor(t);
    });
  }

  function update() {
    const rect = section.getBoundingClientRect();
    const travel = section.offsetHeight - window.innerHeight;
    if (travel <= 0) {
      paint(1);
    } else {
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      paint(progress);
    }

    // Hide header apply while the blue section owns the viewport.
    if (header) {
      const covering = rect.top < window.innerHeight * 0.35 && rect.bottom > window.innerHeight * 0.55;
      header.classList.toggle('is-hidden', covering);
    }
  }

  if (prefersReducedMotion) {
    paint(1);
  }

  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          update();
        });
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

// Scroll reveal
const revealTargets = document.querySelectorAll(
  '.path-card, .work-card, .service-col, .stat, .section-heading, .company-copy, .cta-headline, .statement-heading, .reach-heading, .reach-metric'
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

// Footer back-to-top: jump above the fold
document.querySelectorAll('.finale-top-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

