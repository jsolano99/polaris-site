# Hero marquee ribbon — restore kit

Removed from the live site so we could compare the hero without it.
Drop each block back into the file noted below to restore exactly.

## What it looked like

- Thick accent-blue (`#4275D2`) curved SVG stroke across the lower hero
- Cream lowercase Inter text traveling along the curve via `<textPath>`
- Copy loop: `polaris society ★ launching soon ★ for new york ★ for the daydreamers ★ for the trailblazers ★ for the optimists ★ for connection ★`
- Auto-advances at ~34 path-units/sec; respects `prefers-reduced-motion`
- Path is extended both ways with Catmull-Rom-derived relative tiles so the loop never shows a seam or dead edge
- Desktop: ribbon starts ~`58vh` down; mobile: ~`68vh`, thinner type

## 1. `index.html` — inside `.hero`, after `.hero-gallery`, before `.hero-center`

```html
    <div class="hero-marquee" aria-hidden="true">
      <svg class="marquee-svg" viewBox="0 0 2400 700" preserveAspectRatio="xMidYMid slice">
        <path id="marqueePath" d="M -300,630 C -100,555 183.3,540 400,530 C 616.7,520 800,596.7 1000,570 C 1200,543.3 1400,393.3 1600,370 C 1800,346.7 2016.7,478.3 2200,430 C 2383.3,381.7 2500,155 2700,80" fill="none" />
        <path class="marquee-ribbon" d="M -300,630 C -100,555 183.3,540 400,530 C 616.7,520 800,596.7 1000,570 C 1200,543.3 1400,393.3 1600,370 C 1800,346.7 2016.7,478.3 2200,430 C 2383.3,381.7 2500,155 2700,80" fill="none" stroke="#4275D2" stroke-width="140" stroke-linecap="round" stroke-linejoin="round"/>
        <text class="marquee-text" fill="#FFFAF5">
          <textPath id="marqueeTextPath" href="#marqueePath" startOffset="0" dominant-baseline="middle">polaris society ★ launching soon ★ for new york ★ for the daydreamers ★ for the trailblazers ★ for the optimists ★ for connection ★ polaris society ★ launching soon ★ for new york ★ for the daydreamers ★ for the trailblazers ★ for the optimists ★ for connection ★ </textPath>
        </text>
      </svg>
    </div>
```

## 2. `css/style.css` — after `.wordmark-logo` rules

```css
/* ---------- Hero marquee ribbon ---------- */
.hero-marquee {
  position: absolute;
  z-index: 1;
  left: 0;
  width: 100%;
  top: 58vh;
  bottom: 0;
  min-height: 220px;
  overflow: hidden;
  pointer-events: none;
}
.marquee-svg { width: 100%; height: 100%; display: block; }
.marquee-ribbon { opacity: 0.96; }
.marquee-text {
  font-family: var(--body);
  font-weight: 400;
  font-size: 34px;
  letter-spacing: 0;
  text-transform: lowercase;
}
```

And inside the existing `@media (max-width: 900px)` block (with other `.hero` rules):

```css
  .hero-marquee { top: 68vh; bottom: 0; min-height: 170px; }
```

## 3. `js/script.js` — before the Scroll reveal block

```js
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
```
