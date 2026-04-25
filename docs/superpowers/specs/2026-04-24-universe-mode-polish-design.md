# Universe Mode Polish — Design

**Date:** 2026-04-24
**Status:** Approved (pending spec review)
**Scope:** Visual polish on the existing constellation easter egg (triggered by triple-clicking the theme toggle, which adds `body.constellation`). Default (non-constellation) mode visuals are untouched.

## Goal

Turn the constellation mode from a flat, static starfield into a living sky that reacts subtly to the user. Layered stars that breathe, parallax depth, an occasional shooting star, a glowing milky-way path through the journey, a faint comet trail behind the cursor, soft hover bloom on nearby stars, and a satisfying ripple on click.

## Architecture

**One canvas + targeted SVG tweaks.**

A single full-viewport `<canvas id="universe-canvas">` (z-index 0, fixed) handles everything that breathes, drifts, or particles: layered stars, shooting stars, cursor comet trail, click ripples, hover bloom.

The milky-way path stays SVG — it's already an SVG path; we stack a few stroke layers underneath it for the glow.

A new module `js/universe.js` exposes `Universe.activate()` / `Universe.deactivate()`. `main.js` calls those when toggling `body.constellation`. The current CSS `::before` static stars (lines 1346–1366 of `styles.css`) get removed and replaced by the canvas.

## The seven effects

### 1. Bloom-breathing stars (3 parallax layers)

- **Layer far:** ~150 stars, radius 0.5–1px, dim, parallax depth 0.2
- **Layer mid:** ~80 stars, radius 1–1.5px, parallax depth 0.5
- **Layer near:** ~30 stars, radius 1.5–2.5px, brightest, parallax depth 1.0
- Each star has its own breath phase (random 0–2π) and period (random 3–7s), so stars breathe out of sync.
- Brightness modulates `0.6 → 1.0` of base via `0.8 + 0.2·sin(t/period + phase)` (subtle range so stars never disappear).
- **Color:** Mostly cool tint `rgba(232, 224, 255, α)`. ~1 in 10 stars is warm: `rgba(255, 232, 220, α)`. Adds variation without breaking the cool palette.
- **Coordinate space:** Stars stored as `{xNorm, yNorm}` in [0, 1]; multiplied by canvas dimensions in the render loop. Survives resize without regeneration.
- **Bloom rendering:** Pre-render one sprite per layer (a soft radial gradient on an offscreen canvas) at `activate()`. Per frame, `drawImage` each star's sprite at its position with `globalAlpha` set from breath × hover modulation. Avoids per-frame `shadowBlur` (jank-prone on mobile).

### 2. Parallax depth

- **Mouse offset:** `mouseRatio × depth × 12px`, where `mouseRatio = (mouseX − centerX) / (width/2)` ∈ [−1, 1]. Far layer max ≈ 2.4px, near layer max ≈ 12px. Subtle.
- **Scroll offset:** `scrollY × depth × 0.05`. Far stars barely move; near stars drift visibly as the user scrolls the journey.
- Both offsets applied as a global per-layer translate in the render loop.
- Disabled under `prefers-reduced-motion`.

### 3. Shooting star

- Scheduler: random interval 18–35s.
- Trajectory: random off-screen entry, travels diagonally across roughly half the viewport, ~700ms travel, ease-out.
- Render: head dot + 120px tapered fading tail (drawn as a line gradient, not shadowBlur).
- Disabled under `prefers-reduced-motion`.

### 4. Milky-way path (SVG)

- `renderJourney` in `main.js` emits **three** `<path>` elements with the same `d`:
  - `.winding-path-glow` — stroke-width 12, opacity 0.05 (broad halo)
  - `.winding-path-mid` — stroke-width 4, opacity 0.12 (mid glow)
  - `.winding-path` — stroke-width 1.2, opacity 0.4 (core)
- All three emitted always; CSS hides `.winding-path-glow` and `.winding-path-mid` outside `body.constellation`. Default mode visuals are untouched.
- In constellation mode, all three are visible in cool purple, no dasharray, producing a soft glowing band.

### 5. Cursor comet trail

- On mousemove (constellation only), emit particles based on **distance moved**, not per-event: spawn one particle for every ~10px of cursor travel. Trail thickness scales naturally with cursor speed.
- Each particle: small radius (1–2px), slight outward velocity, fades + shrinks over 600–1200ms.
- Cap at 60 particles (drop oldest).
- Skipped on touch devices and under `prefers-reduced-motion`.

### 6. Star bloom on hover

- Each frame, for each star, compute distance to cursor. If `dist < 80px`, multiply that star's brightness by `1 + (1 − dist/80) × 1.5`.
- Free side effect: cursor passing through a dense region softly lights it up.
- **Kept enabled under `prefers-reduced-motion`** — it's a static highlight following the cursor, same family as a CSS `:hover` state, not motion.

### 7. Click-a-star ripple

- On click anywhere (constellation only): expanding ring 0 → 80px radius over 700ms, opacity fades out.
- Stars within 20px of click position flash to full brightness for 1s.
- Color: `rgba(232, 224, 255, 0.4)` (matches star cool tint).
- **Listener is purely decorative** — does not `preventDefault`, does not stop propagation. Play buttons, links, koan cycler all keep working.
- Reduced-motion: brief opacity flash at click position, no expansion.

## Lifecycle

- `Universe.activate()`:
  - Lazy-create canvas if not present (DPR-aware, capped at 2).
  - Generate star field (normalized coords) if not already generated.
  - Pre-render bloom sprites if not already cached.
  - Attach listeners: `mousemove`, `click`, `scroll`, `resize`, `visibilitychange`.
  - Start RAF loop.
- `Universe.deactivate()`:
  - Stop RAF loop.
  - Detach listeners.
  - Clear canvas, hide it (or remove from DOM).
  - Leaving the easter egg costs nothing.
- **Resize:** canvas internal dimensions update; star positions are normalized so no regeneration needed.
- **Tab hidden:** pause RAF (resume on `visible`).
- **Reduced-motion check:** done at `activate()` time. No mid-session reaction to media query changes.

## Mobile / touch / hybrid behavior

Two independent capability checks (touch presence, precise-pointer presence) so hybrid devices (Surface, touchscreen laptops, iPad + trackpad) get the right experience:

- **Density:** Star count reduced (×0.5) on any device with touch capability (detected via `'ontouchstart' in window || navigator.maxTouchPoints > 0`). Acts as a perf safety margin even when the device also has a mouse.
- **Mouse-driven effects (cursor trail, hover bloom, mouse parallax):** Gated on `(hover: hover) and (pointer: fine)` media query. A pure-touch phone has no mouse effects; a hybrid device with both touch and a precise pointer gets full mouse effects (and halved density as a perf cushion).
- **Always active regardless of device:** stars (with breath), scroll-based parallax, shooting star, milky-way path, click/tap ripple.

## Z-index / layering

Already correct via existing rules (`styles.css` lines 1368–1372):
- Canvas at z-index 0 (background)
- `.constellation .journey` and `.constellation .footer` at z-index 1
- Expanded episode panels above

The existing `.trail-marker` twinkle CSS in constellation mode stays untouched. Those SVG circles are **episodes-as-stars**, distinct from canvas background stars — two intentional star concepts, no conflict.

## Files touched

- **New:** `js/universe.js` (~250 lines, vanilla JS, no deps)
- **Modify:** `index.html` — add `<script src="js/universe.js"></script>` before `main.js`
- **Modify:** `js/main.js` — call `Universe.activate()` / `deactivate()` from the constellation toggle; emit three stacked paths in `renderJourney`
- **Modify:** `css/styles.css`:
  - Remove `.constellation::before` star block (lines 1346–1366)
  - Replace `.constellation .winding-path` styling; add `.winding-path-glow` / `.winding-path-mid` rules
  - Add `#universe-canvas` positioning rules
  - Default mode hides `.winding-path-glow` and `.winding-path-mid`

## Out of scope

- No audio drone.
- No constellation lines between trail markers.
- No new dependencies — vanilla canvas, matches project style.
- No changes to default (non-constellation) mode visuals.
- No additional easter egg layers (no "triple-click again → galaxy zoom").

## Performance budget

- ~260 stars × `drawImage` per frame = trivial on modern hardware (sprites are small, no `shadowBlur`).
- Particle cap (60) keeps cursor trail bounded.
- Per-frame distance check on 260 stars for hover bloom = 260 cheap math ops, negligible.
- Tab-hidden RAF pause prevents background CPU drain.
- Touch-device density halved as a safety margin.
