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

// Letter-by-letter scroll reveal: each character starts faint and darkens as a
// fixed "reading line" sweeps down through the paragraph on scroll (matches
// ranomi.nl, which reveals per-letter rather than per-word — the much finer
// granularity is what makes the sweep read as smooth instead of stepped).
// Each word is wrapped so it still can't break mid-word.
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
    // Reading line mid-viewport so the sweep starts as the paragraph enters,
    // and finishes while the statement is still the focus — before polaroids
    // take over the sticky runway.
    const readLine = window.innerHeight * 0.7;
    const story = document.querySelector('.story');
    // Once .story pins (top <= 0), polaroids are in motion — force a full fill
    // so no letters are left faint under the photos.
    const pinActive = story ? story.getBoundingClientRect().top <= 0 : false;

    blocks.forEach(({ container, letters }) => {
      if (pinActive) {
        letters.forEach((l) => l.classList.add('is-revealed'));
        return;
      }
      const rect = container.getBoundingClientRect();
      // Early lead-in + short travel so the body is fully dark by the time
      // the section end / polaroid phase begins.
      const lead = window.innerHeight * 0.35;
      const travel = Math.max(rect.height * 0.7, 1);
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

// Statement → Community (sticky scroll story).
// Phase 1: statement fades, polaroids rearrange into a linear row.
// Phase 2: community copy fades in and stays pinned for the rest of the runway.
(function communityScrollStory() {
  const story = document.querySelector('.story');
  const copy = document.querySelector('.story-copy');
  const communityCopy = document.querySelector('.community-copy');
  const polaroids = Array.from(document.querySelectorAll('.comm-polaroid'));
  if (!story || !copy || !polaroids.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Share of the runway spent rearranging polaroids. The copy only starts
  // fading in once they've settled, so it never lands on top of a moving photo.
  // Tuned for a shorter story runway so one continuous scroll carries through.
  const INTRO_END = 0.55;
  const COPY_IN_START = 0.56;
  const COPY_IN_END = 0.78;

  // from = peeking along the bottom edge (never overlapping the statement);
  // to = a compact scattered band in the top of the viewport, leaving the
  // lower half clear for the community copy.
  const desktop = [
    { from: { x: -2, y: 82, w: 11, rot: -8 }, to: { x: -1, y: 3, w: 11, rot: -5 }, ar: '1 / 1', z: 3 },
    { from: { x: 12, y: 88, w: 16, rot: 4 }, to: { x: 12, y: 10, w: 14.5, rot: 3 }, ar: '1.2 / 1', z: 5 },
    { from: { x: 28, y: 80, w: 12, rot: -3 }, to: { x: 27, y: 1, w: 14, rot: -4 }, ar: '1 / 1', z: 2 },
    { from: { x: 42, y: 90, w: 20, rot: 6 }, to: { x: 39, y: 4, w: 20.5, rot: 2.5 }, ar: '1.25 / 1', z: 10 },
    { from: { x: 56, y: 83, w: 13, rot: -5 }, to: { x: 58, y: 2, w: 13, rot: -3 }, ar: '1 / 1', z: 4 },
    { from: { x: 70, y: 89, w: 14, rot: 3 }, to: { x: 73, y: 11, w: 11.5, rot: 4 }, ar: '1 / 1', z: 3 },
    { from: { x: 84, y: 81, w: 14, rot: -6 }, to: { x: 85, y: 3, w: 15, rot: -2 }, ar: '1.2 / 1', z: 5 },
  ];
  const mobile = [
    { from: { x: -4, y: 84, w: 26, rot: -6 }, to: { x: -3, y: 1, w: 24, rot: -4 }, ar: '1 / 1', z: 3 },
    { from: { x: 28, y: 90, w: 36, rot: 5 }, to: { x: 23, y: 7, w: 30, rot: 3 }, ar: '1.2 / 1', z: 5 },
    { from: { x: 62, y: 85, w: 32, rot: -3 }, to: { x: 52, y: 1, w: 28, rot: -3.5 }, ar: '1 / 1', z: 2 },
    { from: { x: 8, y: 96, w: 38, rot: 4 }, to: { x: 66, y: 4, w: 37, rot: 2 }, ar: '1.25 / 1', z: 10 },
    { from: { x: 42, y: 98, w: 30, rot: -5 }, to: { x: 4, y: 15, w: 24, rot: -2 }, ar: '1 / 1', z: 4 },
    { from: { x: 72, y: 94, w: 28, rot: 3 }, to: { x: 35, y: 17, w: 23, rot: 4 }, ar: '1 / 1', z: 3 },
    { from: { x: 20, y: 102, w: 30, rot: -4 }, to: { x: 64, y: 14, w: 27, rot: -3 }, ar: '1.2 / 1', z: 5 },
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

  // How much clear space to keep between the settled polaroids and the copy.
  const BAND_GAP_VH = 7;

  function layout() {
    const keyframes = window.innerWidth < 900 ? mobile : desktop;
    state.forEach((s, i) => {
      const k = keyframes[i];
      if (!k) return;
      s.from = k.from;
      s.to = { ...k.to };
      s.el.style.aspectRatio = k.ar;
      s.el.style.zIndex = String(k.z);
    });

    // Polaroid widths are in vw but the gap to the copy reads in vh, so the
    // band's resting height changes with the window's aspect ratio. Slide the
    // whole band to land a fixed distance above the copy instead.
    const vh = window.innerHeight / 100;
    const vw = window.innerWidth / 100;
    if (!communityCopy || !vh || !vw) return;

    let bandBottom = -Infinity;
    let bandTop = Infinity;
    state.forEach((s, i) => {
      const k = keyframes[i];
      if (!k || !s.to) return;
      const [w, h] = k.ar.split('/').map(parseFloat);
      const heightVh = ((k.to.w * vw) / (w / h)) / vh;
      bandBottom = Math.max(bandBottom, k.to.y + heightVh);
      bandTop = Math.min(bandTop, k.to.y);
    });
    if (!isFinite(bandBottom)) return;

    const copyBottomVh = (parseFloat(getComputedStyle(communityCopy).bottom) || 0) / vh;
    const copyTopVh = 100 - copyBottomVh - communityCopy.offsetHeight / vh;
    // Never drag the band so far up that its first row leaves the viewport.
    const shift = Math.max(copyTopVh - BAND_GAP_VH - bandBottom, -bandTop);
    state.forEach((s) => {
      if (s.to) s.to.y += shift;
    });
  }

  function apply(progress) {
    const introT = easeInOut(clamp(progress / INTRO_END, 0, 1));

    // Statement fades across the intro — opacity only (blur was laggy on scroll).
    const copyOpacity = 1 - clamp(progress / (INTRO_END * 0.85), 0, 1);
    copy.style.opacity = String(copyOpacity);

    // Polaroids travel from the bottom edge up into their settled band.
    state.forEach(({ el, from, to }) => {
      if (!from || !to) return;
      const x = lerp(from.x, to.x, introT);
      const y = lerp(from.y, to.y, introT);
      const w = lerp(from.w, to.w, introT);
      const rot = lerp(from.rot, to.rot, introT);
      el.style.width = w + '%';
      el.style.transform = `translate(${x}vw, ${y}vh) rotate(${rot}deg)`;
    });
    // Community copy fades in after the polaroids land, then stays pinned.
    const headT = clamp((progress - COPY_IN_START) / (COPY_IN_END - COPY_IN_START), 0, 1);
    if (communityCopy) {
      communityCopy.style.opacity = String(headT);
      communityCopy.style.transform = `translateY(${(1 - headT) * 28}px)`;
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

  function relayout() {
    layout();
    update();
  }

  layout();

  // The band is placed relative to the copy's measured height, so remeasure
  // once the display font has swapped in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(relayout);
  }

  if (prefersReducedMotion) {
    apply(1);
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
  window.addEventListener('resize', relayout);
  update();
})();

// Creator carousel: a constant-speed marquee. Three identical sets mean
// Jacob is always followed by Sangavi — the wrap hops back by one set
// on an identical frame, so the strip never runs out.
(function creatorCarousel() {
  const track = document.getElementById('creators-track');
  if (!track) return;

  const originals = Array.from(track.querySelectorAll('.creator-card'));
  if (!originals.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const N = originals.length;
  for (let copy = 0; copy < 2; copy++) {
    originals.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      const img = clone.querySelector('img');
      if (img) img.alt = '';
      track.appendChild(clone);
    });
  }

  const SPEED = 64;
  let offset = 0;
  let setWidth = 0;
  let last = performance.now();

  function measure() {
    const first = track.children[0];
    const loop = track.children[N];
    if (!first || !loop) return;
    setWidth = loop.offsetLeft - first.offsetLeft;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (setWidth > 0) {
      offset += SPEED * dt;
      if (offset >= setWidth) offset -= setWidth;
      track.style.transform = `translate3d(${-offset}px,0,0)`;
    }
    requestAnimationFrame(frame);
  }

  measure();
  window.addEventListener('resize', measure);
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
  });
  requestAnimationFrame(frame);
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

