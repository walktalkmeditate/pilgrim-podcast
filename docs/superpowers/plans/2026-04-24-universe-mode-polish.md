# Universe Mode Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seven layered visual effects to the constellation easter egg (triple-click theme toggle): bloom-breathing parallax stars, shooting stars, milky-way journey path, cursor comet trail, hover bloom, and click ripples.

**Architecture:** A single `<canvas id="universe-canvas">` (z-index 0, fixed) animates all moving effects via one RAF loop. The milky-way path stays SVG: `renderJourney` emits three stacked `<path>` elements (glow / mid / core). New module `js/universe.js` exposes `Universe.activate()` / `Universe.deactivate()`; `main.js` calls those when toggling `body.constellation`. The existing `::before` static stars are replaced.

**Tech Stack:** Vanilla JS (ES5 to match project style), Canvas 2D API, SVG, CSS. No build, no deps. Project is a static site served via local HTTP (e.g. `python3 -m http.server 8000` from project root).

**Design spec:** `docs/superpowers/specs/2026-04-24-universe-mode-polish-design.md`

**Verification approach:** This is a vanilla static site with no test framework. Each task ends with a **manual browser-verification checklist** + a commit. To verify any task, run `python3 -m http.server 8000` from the project root, open `http://localhost:8000`, triple-click the theme toggle (the moon/sun icon, top-right) to enter constellation mode, and check the listed observations.

---

### Task 1: Universe module skeleton + lifecycle wiring

**Files:**
- Create: `js/universe.js`
- Modify: `index.html` (line 59–61, script tags block)
- Modify: `js/main.js:1245-1248` (constellation toggle)
- Modify: `css/styles.css` (append at end)

- [ ] **Step 1: Create the universe module**

Create `js/universe.js`:

```javascript
(function () {
  'use strict';

  var canvas = null;
  var ctx = null;
  var rafId = null;
  var listeners = [];
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var lastFrameTime = 0;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'universe-canvas';
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d');
    sizeCanvas();
  }

  function sizeCanvas() {
    if (!canvas) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function on(target, ev, fn, opts) {
    target.addEventListener(ev, fn, opts);
    listeners.push({ target: target, ev: ev, fn: fn, opts: opts });
  }

  function offAll() {
    for (var i = 0; i < listeners.length; i++) {
      var l = listeners[i];
      l.target.removeEventListener(l.ev, l.fn, l.opts);
    }
    listeners = [];
  }

  function loop(t) {
    rafId = requestAnimationFrame(loop);
    lastFrameTime = t;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    // layers added in later tasks
  }

  function onVisibility() {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!rafId) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function activate() {
    ensureCanvas();
    canvas.style.display = 'block';
    on(window, 'resize', sizeCanvas);
    on(document, 'visibilitychange', onVisibility);
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function deactivate() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    offAll();
    if (canvas) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      canvas.style.display = 'none';
    }
  }

  window.Universe = {
    activate: activate,
    deactivate: deactivate
  };
})();
```

- [ ] **Step 2: Wire script into index.html**

In `index.html`, change lines 59–61 from:

```html
  <script src="js/moon.js"></script>
  <script src="js/seal.js"></script>
  <script src="js/main.js"></script>
```

to:

```html
  <script src="js/moon.js"></script>
  <script src="js/seal.js"></script>
  <script src="js/universe.js"></script>
  <script src="js/main.js"></script>
```

- [ ] **Step 3: Hook the constellation toggle in main.js**

In `js/main.js`, replace lines 1245–1248:

```javascript
      if (clickCount >= 3) {
        clickCount = 0;
        document.body.classList.toggle('constellation');
      }
```

with:

```javascript
      if (clickCount >= 3) {
        clickCount = 0;
        document.body.classList.toggle('constellation');
        if (window.Universe) {
          if (document.body.classList.contains('constellation')) {
            window.Universe.activate();
          } else {
            window.Universe.deactivate();
          }
        }
      }
```

- [ ] **Step 4: Add canvas CSS**

Append to `css/styles.css`:

```css
/* --- Universe Mode Canvas --- */

#universe-canvas {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  display: none;
}
```

- [ ] **Step 5: Verify in browser**

Run `python3 -m http.server 8000` from project root. Open `http://localhost:8000`. Triple-click the theme toggle (top-right icon).

**Checklist:**
- Page enters constellation mode (purple/blue tint, dotted journey line still visible from existing CSS).
- A `<canvas id="universe-canvas">` element exists in the DOM (inspect element).
- Canvas is sized to the viewport, fixed-positioned, behind content.
- Triple-click again → canvas hides, no errors in console.
- No regressions in normal mode.

- [ ] **Step 6: Commit**

```bash
git add js/universe.js index.html js/main.js css/styles.css
git commit -m "feat(universe): canvas lifecycle skeleton

Adds Universe module with activate/deactivate, full-viewport canvas,
RAF loop, resize + visibility handlers. Wired to constellation toggle.
No effects yet."
```

---

### Task 2: Star field generation + static render

**Files:**
- Modify: `js/universe.js` (extend module)

- [ ] **Step 1: Add star generation, sprite cache, and render**

In `js/universe.js`, add the following module-scope state near the top (after `var lastFrameTime = 0;`):

```javascript
  var stars = [];
  var sprites = {};

  var LAYERS = [
    { name: 'far',  count: 150, rMin: 0.5, rMax: 1.0, depth: 0.2 },
    { name: 'mid',  count: 80,  rMin: 1.0, rMax: 1.5, depth: 0.5 },
    { name: 'near', count: 30,  rMin: 1.5, rMax: 2.5, depth: 1.0 }
  ];

  var TINT_COOL = [232, 224, 255];
  var TINT_WARM = [255, 232, 220];

  function makeStarSprite(maxRadius, rgb) {
    var size = Math.ceil(maxRadius * 4);
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var sctx = c.getContext('2d');
    var center = size / 2;
    var grad = sctx.createRadialGradient(center, center, 0, center, center, maxRadius * 2);
    var rgbStr = rgb[0] + ',' + rgb[1] + ',' + rgb[2];
    grad.addColorStop(0, 'rgba(' + rgbStr + ',1)');
    grad.addColorStop(0.3, 'rgba(' + rgbStr + ',0.6)');
    grad.addColorStop(1, 'rgba(' + rgbStr + ',0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, size, size);
    return c;
  }

  function buildSprites() {
    sprites = {};
    for (var i = 0; i < LAYERS.length; i++) {
      var L = LAYERS[i];
      sprites[L.name + '_cool'] = makeStarSprite(L.rMax, TINT_COOL);
      sprites[L.name + '_warm'] = makeStarSprite(L.rMax, TINT_WARM);
    }
  }

  function buildStars() {
    stars = [];
    for (var i = 0; i < LAYERS.length; i++) {
      var L = LAYERS[i];
      for (var j = 0; j < L.count; j++) {
        stars.push({
          layer: L.name,
          depth: L.depth,
          xNorm: Math.random(),
          yNorm: Math.random(),
          baseAlpha: 0.4 + Math.random() * 0.5,
          warm: Math.random() < 0.1
        });
      }
    }
  }

  function drawStars() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sprite = sprites[s.layer + (s.warm ? '_warm' : '_cool')];
      var x = s.xNorm * w - sprite.width / 2;
      var y = s.yNorm * h - sprite.height / 2;
      ctx.globalAlpha = s.baseAlpha;
      ctx.drawImage(sprite, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
```

- [ ] **Step 2: Initialize on activate, render in loop**

In `js/universe.js`, change `activate()` to build stars/sprites once:

```javascript
  function activate() {
    ensureCanvas();
    canvas.style.display = 'block';
    if (!stars.length) buildStars();
    if (!sprites.far_cool) buildSprites();
    on(window, 'resize', sizeCanvas);
    on(document, 'visibilitychange', onVisibility);
    if (!rafId) rafId = requestAnimationFrame(loop);
  }
```

And replace the `loop` body:

```javascript
  function loop(t) {
    rafId = requestAnimationFrame(loop);
    lastFrameTime = t;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    drawStars();
  }
```

- [ ] **Step 3: Verify in browser**

Reload `http://localhost:8000`. Triple-click theme toggle.

**Checklist:**
- ~260 stars visible, distributed across the viewport.
- Stars have soft glow (radial-gradient bloom), not hard pixels.
- About 1 in 10 stars looks slightly warmer (ivory/peach) vs cool (lavender-white).
- Three apparent size classes — most small, some medium, a few larger.
- No flicker, no jank — stars are static at this stage.
- The original `::before` CSS stars are also still visible (we'll remove them in Task 10).

- [ ] **Step 4: Commit**

```bash
git add js/universe.js
git commit -m "feat(universe): static star field with bloom sprites

Three layers (far/mid/near, 150/80/30), cool + warm tints, per-layer
pre-rendered radial-gradient sprites, additive composite. Stars stored
in normalized coords."
```

---

### Task 3: Bloom-breathing animation

**Files:**
- Modify: `js/universe.js`

- [ ] **Step 1: Add per-star breath state**

In `buildStars()`, add `phase` and `period` to each star. Replace the `stars.push({...})` block with:

```javascript
        stars.push({
          layer: L.name,
          depth: L.depth,
          xNorm: Math.random(),
          yNorm: Math.random(),
          baseAlpha: 0.4 + Math.random() * 0.5,
          warm: Math.random() < 0.1,
          phase: Math.random() * Math.PI * 2,
          period: 3000 + Math.random() * 4000
        });
```

- [ ] **Step 2: Modulate alpha by breath in drawStars**

Replace `drawStars()` with:

```javascript
  function drawStars() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var t = lastFrameTime;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sprite = sprites[s.layer + (s.warm ? '_warm' : '_cool')];
      var breath = 0.6 + 0.4 * Math.sin((t / s.period) * Math.PI * 2 + s.phase);
      var x = s.xNorm * w - sprite.width / 2;
      var y = s.yNorm * h - sprite.height / 2;
      ctx.globalAlpha = s.baseAlpha * breath;
      ctx.drawImage(sprite, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
```

- [ ] **Step 3: Verify in browser**

Reload, enter constellation mode. Watch the sky for 10 seconds.

**Checklist:**
- Stars breathe in/out smoothly — each at its own rate, out of sync.
- No pulsing in unison (would mean phases aren't randomized).
- Breath cycle feels slow and meditative (3–7s per star), not strobe-like.
- No frame drops; animation is smooth.

- [ ] **Step 4: Commit**

```bash
git add js/universe.js
git commit -m "feat(universe): per-star breath animation

Each star carries random phase + 3-7s period. Alpha modulates 0.6-1.0
of base via sine, producing out-of-sync breathing across the field."
```

---

### Task 4: Parallax depth (mouse + scroll)

**Files:**
- Modify: `js/universe.js`

- [ ] **Step 1: Track mouse + scroll, compute per-layer offset**

Add module-scope state (near `lastFrameTime`):

```javascript
  var mouseRatioX = 0;
  var mouseRatioY = 0;
  var scrollY = 0;
```

Add handler functions (with the other helpers):

```javascript
  function onMouseMoveParallax(e) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    mouseRatioX = (e.clientX - w / 2) / (w / 2);
    mouseRatioY = (e.clientY - h / 2) / (h / 2);
  }

  function onScrollParallax() {
    scrollY = window.scrollY || window.pageYOffset || 0;
  }
```

In `activate()`, add (alongside the existing listeners):

```javascript
    on(window, 'mousemove', onMouseMoveParallax);
    on(window, 'scroll', onScrollParallax, { passive: true });
```

- [ ] **Step 2: Apply offset per-layer in drawStars**

Replace `drawStars()` with:

```javascript
  function drawStars() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var t = lastFrameTime;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sprite = sprites[s.layer + (s.warm ? '_warm' : '_cool')];
      var breath = 0.6 + 0.4 * Math.sin((t / s.period) * Math.PI * 2 + s.phase);
      var offsetX = mouseRatioX * s.depth * 12;
      var offsetY = mouseRatioY * s.depth * 12 + scrollY * s.depth * 0.05;
      var x = s.xNorm * w - sprite.width / 2 + offsetX;
      var y = s.yNorm * h - sprite.height / 2 + offsetY;
      ctx.globalAlpha = s.baseAlpha * breath;
      ctx.drawImage(sprite, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
```

- [ ] **Step 3: Verify in browser**

Reload, enter constellation mode.

**Checklist:**
- Move mouse to far-left vs far-right: near-layer (largest) stars shift visibly (~12px), mid stars slightly, far stars almost imperceptibly. Effect is subtle — it should feel like depth, not motion.
- Scroll the page slowly: near stars drift down slightly relative to far stars (which look almost still). Stars don't visibly "scroll out" of the viewport — they hold position because the canvas is fixed.
- Movement is smooth, no jitter.

- [ ] **Step 4: Commit**

```bash
git add js/universe.js
git commit -m "feat(universe): mouse + scroll parallax across 3 layers

Mouse ratio (-1..1) and scrollY drive per-layer offsets weighted by
depth. Near layer max ~12px mouse offset; far layer ~2.4px."
```

---

### Task 5: Shooting star

**Files:**
- Modify: `js/universe.js`

- [ ] **Step 1: Add shooting-star state and scheduler**

Add module-scope state:

```javascript
  var shootingStar = null;
  var nextShootingStarAt = 0;
```

Add helpers:

```javascript
  function scheduleShootingStar(now) {
    nextShootingStarAt = now + 18000 + Math.random() * 17000;
  }

  function spawnShootingStar(now) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var fromLeft = Math.random() < 0.5;
    var startX = fromLeft ? -50 : w + 50;
    var startY = Math.random() * h * 0.5;
    var dx = (fromLeft ? 1 : -1) * (w * 0.6);
    var dy = h * 0.4;
    shootingStar = {
      x0: startX,
      y0: startY,
      dx: dx,
      dy: dy,
      tStart: now,
      duration: 700
    };
  }

  function drawShootingStar() {
    if (!shootingStar) return;
    var t = lastFrameTime - shootingStar.tStart;
    if (t < 0) return;
    var progress = t / shootingStar.duration;
    if (progress >= 1) {
      shootingStar = null;
      return;
    }
    var eased = 1 - Math.pow(1 - progress, 3);
    var hx = shootingStar.x0 + shootingStar.dx * eased;
    var hy = shootingStar.y0 + shootingStar.dy * eased;
    var len = 120;
    var ang = Math.atan2(shootingStar.dy, shootingStar.dx);
    var tx = hx - Math.cos(ang) * len;
    var ty = hy - Math.sin(ang) * len;
    var fade = 1 - progress;
    var grad = ctx.createLinearGradient(hx, hy, tx, ty);
    grad.addColorStop(0, 'rgba(255,255,255,' + (0.9 * fade) + ')');
    grad.addColorStop(1, 'rgba(232,224,255,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * fade) + ')';
    ctx.beginPath();
    ctx.arc(hx, hy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
```

- [ ] **Step 2: Schedule on activate, run in loop**

In `activate()`, add at the end (after the listener block):

```javascript
    scheduleShootingStar(performance.now());
```

In `loop`, after `drawStars()`, add:

```javascript
    if (!shootingStar && t >= nextShootingStarAt) {
      spawnShootingStar(t);
      scheduleShootingStar(t);
    }
    drawShootingStar();
```

- [ ] **Step 3: Verify in browser**

Reload, enter constellation mode. To confirm without waiting 18+s, temporarily set `nextShootingStarAt = now + 1000;` in `scheduleShootingStar` (or open devtools console and run `Universe` — you can't reach internals, so easier: shorten the timing in `scheduleShootingStar` to `2000 + Math.random() * 2000` for the test).

**Checklist:**
- A bright streak crosses ~half the viewport diagonally over ~700ms.
- Has a tapered tail (head bright, tail fading).
- After the shooting star completes, a new one is scheduled 18–35s later.
- No visual artifacts (no leftover trail, no stuck shooting star).

**Restore the timing to `18000 + Math.random() * 17000` after verifying.**

- [ ] **Step 4: Commit**

```bash
git add js/universe.js
git commit -m "feat(universe): shooting stars every 18-35s

Random off-screen entry, ~700ms ease-out diagonal travel, head dot +
120px tapered fading tail."
```

---

### Task 6: Cursor comet trail

**Files:**
- Modify: `js/universe.js`

- [ ] **Step 1: Add particle state + distance-based spawning**

Add module-scope state:

```javascript
  var trailParticles = [];
  var lastMouseX = -1;
  var lastMouseY = -1;
  var TRAIL_MAX = 60;
  var TRAIL_SPAWN_DIST = 10;
```

Add helpers:

```javascript
  function onMouseMoveTrail(e) {
    if (lastMouseX < 0) {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      return;
    }
    var dx = e.clientX - lastMouseX;
    var dy = e.clientY - lastMouseY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < TRAIL_SPAWN_DIST) return;
    var steps = Math.min(Math.floor(dist / TRAIL_SPAWN_DIST), 5);
    for (var i = 0; i < steps; i++) {
      var k = (i + 1) / steps;
      trailParticles.push({
        x: lastMouseX + dx * k,
        y: lastMouseY + dy * k,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife: 600 + Math.random() * 600,
        r: 1 + Math.random()
      });
    }
    while (trailParticles.length > TRAIL_MAX) trailParticles.shift();
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  function drawTrail(dt) {
    if (!trailParticles.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = trailParticles.length - 1; i >= 0; i--) {
      var p = trailParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        trailParticles.splice(i, 1);
        continue;
      }
      var k = p.life / p.maxLife;
      p.x += p.vx;
      p.y += p.vy;
      var alpha = (1 - k) * 0.6;
      var r = p.r * (1 - k * 0.5);
      ctx.fillStyle = 'rgba(232,224,255,' + alpha + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
```

- [ ] **Step 2: Wire listener and loop**

In `activate()`, add to the listener block:

```javascript
    on(window, 'mousemove', onMouseMoveTrail);
```

Update `loop` to compute `dt`:

```javascript
  function loop(t) {
    rafId = requestAnimationFrame(loop);
    var dt = lastFrameTime ? t - lastFrameTime : 16;
    lastFrameTime = t;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    drawStars();
    if (!shootingStar && t >= nextShootingStarAt) {
      spawnShootingStar(t);
      scheduleShootingStar(t);
    }
    drawShootingStar();
    drawTrail(dt);
  }
```

In `deactivate()`, after `offAll();` add:

```javascript
    trailParticles = [];
    lastMouseX = -1;
    lastMouseY = -1;
```

- [ ] **Step 3: Verify in browser**

Reload, enter constellation mode.

**Checklist:**
- Move cursor slowly: a thin dust trail follows, particles fade out within ~1s.
- Move cursor fast: trail is denser (more particles spawned per pixel of travel).
- Particles slightly diverge (random outward velocity) — feels like dust, not a hard line.
- Trail count is bounded — fast circles don't crash perf.
- Leave constellation mode → no leftover particles when re-entering.

- [ ] **Step 4: Commit**

```bash
git add js/universe.js
git commit -m "feat(universe): cursor comet trail

Distance-based particle spawn (every ~10px of travel), 60-particle
cap, fade + shrink over 600-1200ms, slight divergence for dust feel."
```

---

### Task 7: Star bloom on hover

**Files:**
- Modify: `js/universe.js`

- [ ] **Step 1: Track cursor for hover bloom**

Add module-scope state:

```javascript
  var hoverX = -9999;
  var hoverY = -9999;
  var HOVER_RADIUS = 80;
```

Add helper:

```javascript
  function onMouseMoveHover(e) {
    hoverX = e.clientX;
    hoverY = e.clientY;
  }
```

In `activate()`, add to the listener block:

```javascript
    on(window, 'mousemove', onMouseMoveHover);
```

In `deactivate()`, after the trail reset, add:

```javascript
    hoverX = -9999;
    hoverY = -9999;
```

- [ ] **Step 2: Apply hover modulation in drawStars**

Replace `drawStars()` with:

```javascript
  function drawStars() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var t = lastFrameTime;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sprite = sprites[s.layer + (s.warm ? '_warm' : '_cool')];
      var breath = 0.6 + 0.4 * Math.sin((t / s.period) * Math.PI * 2 + s.phase);
      var offsetX = mouseRatioX * s.depth * 12;
      var offsetY = mouseRatioY * s.depth * 12 + scrollY * s.depth * 0.05;
      var x = s.xNorm * w + offsetX;
      var y = s.yNorm * h + offsetY;
      var dx = x - hoverX;
      var dy = y - hoverY;
      var hoverDist = Math.sqrt(dx * dx + dy * dy);
      var hoverBoost = 1;
      if (hoverDist < HOVER_RADIUS) {
        hoverBoost = 1 + (1 - hoverDist / HOVER_RADIUS) * 1.5;
      }
      ctx.globalAlpha = Math.min(s.baseAlpha * breath * hoverBoost, 1);
      ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
```

- [ ] **Step 3: Verify in browser**

Reload, enter constellation mode.

**Checklist:**
- Move cursor slowly across the sky: stars within ~80px of cursor brighten.
- Brightening is smooth and proportional to proximity (closest star is brightest).
- When cursor leaves a region, those stars return to their breathing baseline.
- Effect is subtle — no harsh "spotlight." Cursor should feel like it's coaxing stars to reveal themselves.

- [ ] **Step 4: Commit**

```bash
git add js/universe.js
git commit -m "feat(universe): star bloom on hover

Stars within 80px of cursor get brightness boost scaling with
proximity (1 + (1 - dist/radius) * 1.5)."
```

---

### Task 8: Click-a-star ripple

**Files:**
- Modify: `js/universe.js`

- [ ] **Step 1: Add ripple state + spawn handler**

Add module-scope state (star-burst is added dynamically as a `burstUntil` field on each star object inside the click handler — no separate array needed):

```javascript
  var ripples = [];
```

Add helpers:

```javascript
  function onClickRipple(e) {
    var x = e.clientX;
    var y = e.clientY;
    ripples.push({
      x: x,
      y: y,
      tStart: lastFrameTime,
      duration: 700
    });
    var w = window.innerWidth;
    var h = window.innerHeight;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sx = s.xNorm * w + mouseRatioX * s.depth * 12;
      var sy = s.yNorm * h + mouseRatioY * s.depth * 12 + scrollY * s.depth * 0.05;
      var dx = sx - x;
      var dy = sy - y;
      if (dx * dx + dy * dy < 400) {
        s.burstUntil = lastFrameTime + 1000;
      }
    }
  }

  function drawRipples() {
    if (!ripples.length) return;
    for (var i = ripples.length - 1; i >= 0; i--) {
      var r = ripples[i];
      var t = lastFrameTime - r.tStart;
      if (t >= r.duration) {
        ripples.splice(i, 1);
        continue;
      }
      var progress = t / r.duration;
      var radius = 80 * progress;
      var alpha = (1 - progress) * 0.4;
      ctx.strokeStyle = 'rgba(232,224,255,' + alpha + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
```

- [ ] **Step 2: Apply burst boost in drawStars**

Replace `drawStars()` with the version that includes burst handling:

```javascript
  function drawStars() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var t = lastFrameTime;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sprite = sprites[s.layer + (s.warm ? '_warm' : '_cool')];
      var breath = 0.6 + 0.4 * Math.sin((t / s.period) * Math.PI * 2 + s.phase);
      var offsetX = mouseRatioX * s.depth * 12;
      var offsetY = mouseRatioY * s.depth * 12 + scrollY * s.depth * 0.05;
      var x = s.xNorm * w + offsetX;
      var y = s.yNorm * h + offsetY;
      var dx = x - hoverX;
      var dy = y - hoverY;
      var hoverDist = Math.sqrt(dx * dx + dy * dy);
      var hoverBoost = 1;
      if (hoverDist < HOVER_RADIUS) {
        hoverBoost = 1 + (1 - hoverDist / HOVER_RADIUS) * 1.5;
      }
      var burstBoost = 1;
      if (s.burstUntil && s.burstUntil > t) {
        var burstK = (s.burstUntil - t) / 1000;
        burstBoost = 1 + burstK * 1.5;
      }
      ctx.globalAlpha = Math.min(s.baseAlpha * breath * hoverBoost * burstBoost, 1);
      ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
```

- [ ] **Step 3: Wire listener + loop call**

In `activate()`, add to the listener block:

```javascript
    on(window, 'click', onClickRipple);
```

In `loop`, after `drawTrail(dt);`, add:

```javascript
    drawRipples();
```

In `deactivate()`, after the hover reset, add:

```javascript
    ripples = [];
```

- [ ] **Step 4: Verify in browser**

Reload, enter constellation mode.

**Checklist:**
- Click anywhere on the page: a soft ring expands from click point and fades out over ~700ms.
- Stars within 20px of the click flash brighter for ~1s, then fade back.
- Clicking a play button still plays/pauses (ripple is decorative — doesn't break click behavior).
- Clicking a journey trail marker still expands the episode card.
- Multiple rapid clicks → multiple ripples, no errors, no stuck rings.

- [ ] **Step 5: Commit**

```bash
git add js/universe.js
git commit -m "feat(universe): click ripple + nearby star burst

Click spawns a 0->80px expanding ring (700ms fade). Stars within 20px
of click flash to full brightness for 1s. Listener is decorative, does
not preventDefault — play buttons + episode toggles unaffected."
```

---

### Task 9: Milky-way path (SVG, three stacked strokes)

**Files:**
- Modify: `js/main.js:685` (renderJourney path emission)
- Modify: `css/styles.css:1199-1203` (replace constellation winding-path rule) and append new rules

- [ ] **Step 1: Emit three stacked paths in renderJourney**

In `js/main.js`, replace line 685:

```javascript
    svg += '<path class="winding-path" d="' + d + '"/>';
```

with:

```javascript
    svg += '<path class="winding-path-glow" d="' + d + '"/>';
    svg += '<path class="winding-path-mid" d="' + d + '"/>';
    svg += '<path class="winding-path" d="' + d + '"/>';
```

- [ ] **Step 2: Replace constellation winding-path CSS + add glow/mid rules**

In `css/styles.css`, replace lines 1199–1203:

```css
.constellation .journey-path .winding-path {
  stroke: rgba(180, 180, 255, 0.15);
  stroke-width: 1;
  stroke-dasharray: 2 4;
}
```

with:

```css
.winding-path-glow,
.winding-path-mid {
  display: none;
  fill: none;
}

.constellation .journey-path .winding-path-glow {
  display: block;
  stroke: rgba(200, 192, 255, 0.05);
  stroke-width: 12;
}

.constellation .journey-path .winding-path-mid {
  display: block;
  stroke: rgba(200, 192, 255, 0.12);
  stroke-width: 4;
}

.constellation .journey-path .winding-path {
  stroke: rgba(200, 192, 255, 0.4);
  stroke-width: 1.2;
  stroke-dasharray: none;
}
```

- [ ] **Step 3: Verify in browser**

Reload `http://localhost:8000`.

**Checklist (default mode, no constellation):**
- Journey path looks identical to before — single thin line, no glow, no extra strokes visible. (Inspect element confirms three paths are in the SVG, but the glow + mid are `display: none`.)

**Checklist (triple-click → constellation mode):**
- Journey path is now a soft glowing band: thicker hazy halo, mid glow, bright thin core. No more dashed/dotted look.
- Color is consistent purple-violet matching the rest of constellation mode.
- Trail markers (the small twinkling dots) still appear on top of the path — unchanged.

- [ ] **Step 4: Commit**

```bash
git add js/main.js css/styles.css
git commit -m "feat(universe): milky-way journey path

renderJourney emits 3 stacked paths (glow/mid/core). Default mode
hides glow + mid via CSS. Constellation mode shows all three for a
soft glowing band that replaces the dotted line."
```

---

### Task 10: Reduced-motion + touch detection + cleanup

**Files:**
- Modify: `js/universe.js`
- Modify: `css/styles.css:1346-1366` (remove old `::before` stars)

- [ ] **Step 1: Detect reduced-motion + touch at activate time**

In `js/universe.js`, add module-scope state:

```javascript
  var reducedMotion = false;
  var touchDevice = false;
```

Add helper:

```javascript
  function detectEnv() {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    touchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  }
```

Replace `activate()` with the full version that gates listeners and density:

```javascript
  function activate() {
    ensureCanvas();
    canvas.style.display = 'block';
    detectEnv();
    if (!stars.length) buildStars();
    if (!sprites.far_cool) buildSprites();
    on(window, 'resize', sizeCanvas);
    on(document, 'visibilitychange', onVisibility);
    if (!touchDevice) {
      on(window, 'mousemove', onMouseMoveHover);
      if (!reducedMotion) {
        on(window, 'mousemove', onMouseMoveParallax);
        on(window, 'mousemove', onMouseMoveTrail);
      }
    }
    if (!reducedMotion) {
      on(window, 'scroll', onScrollParallax, { passive: true });
    }
    on(window, 'click', onClickRipple);
    if (!reducedMotion) scheduleShootingStar(performance.now());
    if (!rafId) rafId = requestAnimationFrame(loop);
  }
```

- [ ] **Step 2: Halve density on touch devices in buildStars**

Replace `buildStars()` with:

```javascript
  function buildStars() {
    stars = [];
    var densityMul = touchDevice ? 0.5 : 1;
    for (var i = 0; i < LAYERS.length; i++) {
      var L = LAYERS[i];
      var n = Math.round(L.count * densityMul);
      for (var j = 0; j < n; j++) {
        stars.push({
          layer: L.name,
          depth: L.depth,
          xNorm: Math.random(),
          yNorm: Math.random(),
          baseAlpha: 0.4 + Math.random() * 0.5,
          warm: Math.random() < 0.1,
          phase: Math.random() * Math.PI * 2,
          period: 3000 + Math.random() * 4000
        });
      }
    }
  }
```

- [ ] **Step 3: Disable breath + shooting-star draw under reduced motion**

In `drawStars()`, replace the `breath` line with:

```javascript
      var breath = reducedMotion ? 1 : (0.6 + 0.4 * Math.sin((t / s.period) * Math.PI * 2 + s.phase));
```

In `loop`, gate the shooting-star spawn:

```javascript
  function loop(t) {
    rafId = requestAnimationFrame(loop);
    var dt = lastFrameTime ? t - lastFrameTime : 16;
    lastFrameTime = t;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    drawStars();
    if (!reducedMotion && !shootingStar && t >= nextShootingStarAt) {
      spawnShootingStar(t);
      scheduleShootingStar(t);
    }
    drawShootingStar();
    drawTrail(dt);
    drawRipples();
  }
```

- [ ] **Step 4: Reduced-motion ripple — flash, no expansion**

Replace `drawRipples()` with:

```javascript
  function drawRipples() {
    if (!ripples.length) return;
    for (var i = ripples.length - 1; i >= 0; i--) {
      var r = ripples[i];
      var t = lastFrameTime - r.tStart;
      if (t >= r.duration) {
        ripples.splice(i, 1);
        continue;
      }
      var progress = t / r.duration;
      var alpha = (1 - progress) * 0.4;
      if (reducedMotion) {
        ctx.fillStyle = 'rgba(232,224,255,' + alpha + ')';
        ctx.beginPath();
        ctx.arc(r.x, r.y, 12, 0, Math.PI * 2);
        ctx.fill();
      } else {
        var radius = 80 * progress;
        ctx.strokeStyle = 'rgba(232,224,255,' + alpha + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
```

- [ ] **Step 5: Remove old `::before` star block**

In `css/styles.css`, delete lines 1346–1366 (the entire `/* Stars background */` block, from `.constellation::before { ... }` through the closing brace and following blank line). Specifically remove:

```css
/* Stars background */
.constellation::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 25% 45%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 40% 15%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 55% 60%, rgba(255,255,255,0.3), transparent),
    radial-gradient(1px 1px at 70% 30%, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 85% 55%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 15% 75%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 50% 85%, rgba(255,255,255,0.3), transparent),
    radial-gradient(1px 1px at 90% 10%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 35% 90%, rgba(255,255,255,0.4), transparent),
    radial-gradient(2px 2px at 60% 40%, rgba(255,255,255,0.7), transparent),
    radial-gradient(2px 2px at 20% 60%, rgba(255,255,255,0.5), transparent);
  pointer-events: none;
  z-index: 0;
}
```

- [ ] **Step 6: Verify in browser (full integration check)**

Reload, enter constellation mode.

**Checklist (normal user):**
- All seven effects from previous tasks still work as before.
- No leftover stars from the old `::before` rule (canvas stars are the only ones now).
- Default mode visuals are completely unchanged.

**Checklist (touch device or DevTools touch emulation):**
- Open DevTools → Toggle Device Toolbar (mobile mode) → reload → triple-tap toggle.
- Star density is visibly lower (~half).
- No cursor trail, no hover bloom (no mouse).
- Tap → ripple appears at tap point. Stars near tap flash.
- Shooting stars still appear, parallax via scroll still works.

**Checklist (reduced motion):**
- In DevTools → Rendering panel → "Emulate CSS prefers-reduced-motion: reduce".
- Reload, enter constellation mode.
- Stars are visible but not breathing (steady alpha).
- No parallax on mouse move or scroll.
- No shooting stars appear (wait 30s+ to confirm).
- No cursor comet trail.
- Hover bloom still works (cursor brightens nearby stars).
- Click ripple shows a brief opacity flash, no expanding ring.

**Checklist (lifecycle hygiene):**
- Toggle constellation off then on multiple times: no duplicate canvases (inspect DOM), no stuck listeners (check via `getEventListeners(window)` in DevTools — the count should stabilize).
- Tab away (switch tabs), come back: animation resumes smoothly, no time jump.
- Resize the window: stars redistribute proportionally (since they're in normalized coords), no regeneration glitch.

- [ ] **Step 7: Commit**

```bash
git add js/universe.js css/styles.css
git commit -m "feat(universe): reduced-motion + touch + cleanup

Touch devices halve density and skip mouse-driven effects.
prefers-reduced-motion disables breath, parallax, shooting stars,
cursor trail; ripple becomes a brief flash. Hover bloom kept (static).
Removes the old ::before radial-gradient stars now replaced by canvas."
```

---

## Self-Review

**Spec coverage check** (each spec section → task that implements it):
- Bloom-breathing stars (3 layers) → Tasks 2 + 3
- Parallax depth (mouse + scroll) → Task 4
- Shooting star → Task 5
- Milky-way path (SVG, 3 stacked strokes) → Task 9
- Cursor comet trail → Task 6
- Star bloom on hover → Task 7
- Click ripple → Task 8
- Lifecycle (activate/deactivate, RAF, resize, visibility) → Task 1
- Mobile/touch behavior (×0.5 density, no mouse effects) → Task 10
- Reduced-motion behavior (per-effect gating) → Task 10
- Z-index layering → Task 1 (canvas at z-index 0; existing rules unchanged)
- Default mode untouched → Tasks 9 + 10 (CSS hides extras outside constellation; old `::before` removed only)
- Color palette (cool + ~10% warm stars) → Task 2

No gaps.

**Type / API consistency:**
- `Universe.activate` / `Universe.deactivate` — signatures match throughout.
- Module-scope state names (`stars`, `sprites`, `shootingStar`, `trailParticles`, `ripples`, `mouseRatioX`, `scrollY`, `hoverX`, `reducedMotion`, `touchDevice`) introduced once and consistently referenced.
- Star object fields (`layer`, `depth`, `xNorm`, `yNorm`, `baseAlpha`, `warm`, `phase`, `period`, `burstUntil`) — `burstUntil` is added dynamically in Task 8 and read-checked there + in `drawStars` (Task 8 version). Consistent.
- `drawStars` is rewritten in Tasks 2 → 3 → 4 → 7 → 8. Each rewrite includes everything from the previous version. The Task 10 step modifies the `breath` line inline rather than rewriting, which is a targeted edit. Consistent.
- `loop` body grows across Tasks 2, 5, 6, 8, 10. Each version includes everything before. Final loop in Task 10 is the canonical one.

**Placeholder scan:** No "TBD", "TODO", "implement later," or vague handwaving. Every step has full code or exact CSS. Verification checklists are concrete (specific observations, not "test it").

**Note on `burstUntil`:** It's a transient field added dynamically to star objects inside `onClickRipple` (Task 8). Read-guarded in `drawStars` via `if (s.burstUntil && s.burstUntil > t)`. No separate state array needed.
