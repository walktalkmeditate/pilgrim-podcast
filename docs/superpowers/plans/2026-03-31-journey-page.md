# Journey Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign podcast.pilgrimapp.org from flat episode cards into an interactive pilgrimage — a winding path of goshuin seals with data-driven visuals, bell sounds, and time-of-day atmosphere.

**Architecture:** Static site (GitHub Pages). Four files: `seal.js` generates SVG seals from episode data, `main.js` renders the journey and handles interactions, `styles.css` defines the visual design, `index.html` provides the page structure. All data comes from `episodes/episodes.json` fetched at runtime.

**Tech Stack:** Vanilla HTML/CSS/JS, SVG generation, Web Audio API (bells), IntersectionObserver (scroll reveal), CSS custom properties (theming)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `js/seal.js` | Create: Pure SVG generator — takes episode data + guide config, returns SVG string. Encodes duration into rings, recordings into lines, hash into dots, weather into filter. Includes guide color/bell lookups and scroll-reveal animation helper. |
| `js/main.js` | Rewrite: Journey renderer, expand/collapse, audio player, bell playback, time-of-day detection, scroll-reveal animation, caption generation |
| `css/styles.css` | Rewrite: Journey path, episode stops, seal containers, expanded cards, captions, time-of-day palette shifts, responsive, transcript, audio player |
| `index.html` | Modify: Replace hero with top bar, replace episode list with journey container |

---

### Task 1: Seal SVG Generator

**Files:**
- Create: `/Users/rubberduck/GitHub/momentmaker/pilgrim-podcast/js/seal.js`

The seal generator is a pure function adapted from the landing page seal at `/Users/rubberduck/GitHub/momentmaker/pilgrim-landing/js/seal.js`. It takes an episode object and returns an SVG string.

- [ ] **Step 1: Create seal.js**

Create `/Users/rubberduck/GitHub/momentmaker/pilgrim-podcast/js/seal.js` with:

1. **GUIDE_COLORS** lookup: `{ breeze: '#1B3A4B', drift: '#C2A68C', dusk: '#A8B8C0', ember: '#C8A050', river: '#A8D8D0', sage: '#C8B888', stone: '#B8956A' }`
2. **GUIDE_BELLS** lookup: `{ breeze: 'echo-chime', drift: 'gentle-harp', dusk: 'temple-bell', ember: 'warm-guitar', river: 'burma-bell', sage: 'yoga-chime', stone: 'clear-ring' }`
3. **R2_BASE**: `'https://pub-c72c34fbaa6c1041a47d15961d16f398.r2.dev'`
4. **bellUrl(guideId)** — returns `R2_BASE + '/audio/bell/' + GUIDE_BELLS[guideId] + '.aac'`
5. **hashBytes(str)** — deterministic hash that returns a Uint8Array(32) from a string. Used to seed visual variation.
6. **parseWeather(weatherStr)** — returns 'clear', 'cloudy', 'rain', or 'snow' from weather strings like "clear, 27°C"
7. **generateSeal(ep, size)** — the core generator:
   - `size` defaults to 120
   - Color from `GUIDE_COLORS[ep.guide]`, fallback `'#B8AFA2'`
   - Hash from `ep.number + ':' + ep.title + ':' + ep.date + ':' + ep.guide`
   - Rotation from `bytes[0] / 255 * 360`
   - Weather affects filter displacement scale: clear=1.2, cloudy=1.8, rain=2.5 and base opacity: clear=0.7, cloudy=0.55, rain=0.5
   - **Rings**: count = `clamp(3, 6, floor(ep.duration / 300))`. Outermost ring is solid 1.5px, inner rings are dashed with byte-driven patterns. Opacity decreases inward.
   - **Lines**: count = `clamp(2, 6, recordingCount + bytes[8] % 3)` where recordingCount defaults to 2. Radial lines from inner to outer radius, byte-driven angles.
   - **Dots**: count = `3 + bytes[28] % 4`. Positioned by hash, fill color at lower opacity.
   - **Text**: Episode number centered (Cormorant Garamond, 22% of size, weight 300), "EPISODE" label below (Lato, 5.5% of size, uppercase, letter-spacing 2)
   - SVG includes a per-episode `<filter>` with feTurbulence + feDisplacementMap
   - Returns SVG string
8. **animateSeal(svgEl)** — sets up stroke-dashoffset animation on circles/lines, opacity 0 on dots and text. Returns a `reveal()` function that triggers the animation.
9. **Exports** as `window.PilgrimSeal` with methods: `generate`, `animate`, `guideColor`, `bellUrl`

The file should be wrapped in an IIFE: `(function(exports) { ... })(window);`

See `/Users/rubberduck/GitHub/momentmaker/pilgrim-landing/js/seal.js` for the animation pattern — stroke-dasharray/dashoffset for ring draw-in, staggered opacity transitions for dots, IntersectionObserver-triggered reveal.

- [ ] **Step 2: Verify in browser console**

Include seal.js in any HTML file. Run in console:
```
document.body.textContent = '';
var div = document.createElement('div');
div.style.cssText = 'display:flex;justify-content:center;padding:4rem';
var ep = {number:1, title:'Austin', date:'2026-03-30', guide:'drift', duration:1479, weather:'clear, 27°C'};
div.insertAdjacentHTML('beforeend', PilgrimSeal.generate(ep));
document.body.appendChild(div);
```
Expected: SVG seal in warm cream (#C2A68C), "1" centered, rings/lines/dots.

- [ ] **Step 3: Commit**

```bash
cd /Users/rubberduck/GitHub/momentmaker/pilgrim-podcast
git add js/seal.js
git commit -m "feat: add goshuin seal SVG generator with guide colors and weather"
```

---

### Task 2: Page Structure (index.html)

**Files:**
- Modify: `/Users/rubberduck/GitHub/momentmaker/pilgrim-podcast/index.html`

- [ ] **Step 1: Replace index.html**

Replace the full file. Key changes from current:
- Remove: hero section, subscribe bar, episodes section with episodes-inner/episodes-header/episodes-list
- Add: `.top-bar` nav with title + links
- Add: `.journey` container with `.journey-path` (the dashed line), `#journey-stops` (where episodes render), `.journey-fade` (trailing fade)
- Keep: theme toggle button, footer (simplified), script tags for seal.js + main.js
- Script order: seal.js before main.js (main.js depends on PilgrimSeal)

Structure:
```
body
  button.theme-toggle
  nav.top-bar
    span.top-bar-title "Pilgrim on the Path"
    div.top-bar-links
      a[href=feed.xml] "RSS"
      a[href=pilgrimapp.org] "pilgrimapp.org"
  div.journey#journey
    div.journey-path (decorative dashed line)
    div.journey-stops#journey-stops (episodes render here)
    div.journey-fade (gradient fade at bottom)
  footer.footer
    nav.footer-links (Pilgrim, App Store, GitHub, RSS)
    p.footer-craft "crafted with intention"
  script[src=js/seal.js]
  script[src=js/main.js]
```

- [ ] **Step 2: Commit**

```bash
cd /Users/rubberduck/GitHub/momentmaker/pilgrim-podcast
git add index.html
git commit -m "feat: replace hero with journey page structure"
```

---

### Task 3: Journey Styles (styles.css)

**Files:**
- Rewrite: `/Users/rubberduck/GitHub/momentmaker/pilgrim-podcast/css/styles.css`

- [ ] **Step 1: Rewrite styles.css**

The file must contain ALL of the following sections. Preserve the existing design tokens (`:root` variables, dark mode, fonts, radii) and working component styles (theme toggle, audio player, transcript, footer, reveal animation). Add the new journey-specific styles.

**Sections in order:**

1. **Reset** — `*, *::before, *::after { box-sizing; margin; padding }`
2. **Color system** — `:root` with all vars (parchment, ink, stone, moss, rust, dawn, fog, transitions, fonts, padding, radii, content-width). `[data-theme="dark"]` overrides.
3. **Time-of-day overrides** — `[data-time="dawn"]`, `[data-time="dusk"]`, `[data-time="night"]` with subtle shifts. Also dark mode variants: `[data-theme="dark"][data-time="dawn"]` etc.
   - dawn: `--parchment: #EEF0F0; --fog: #A0AAB8;`
   - dusk: `--parchment: #F8F0E4; --stone: #9A7E58;`
   - night: `--parchment: #E8E2D8; --fog: #A09888; --ink: #3A3228;`
   - dark+dawn: `--parchment: #181C20; --fog: #5A6470;`
   - dark+dusk: `--parchment: #201A14; --stone: #C4A070;`
   - dark+night: `--parchment: #161310; --fog: #585048;`
4. **Base** — html, body, a styles
5. **Theme toggle** — same as current (fixed position, SVG icon)
6. **Top bar** — flex row, title left, links right, max-width 720px
7. **Journey container** — relative positioned, max-width 720px, centered
8. **Journey path** — absolute positioned center line, dashed via repeating-linear-gradient (4px solid, 6px gap in parchment-tertiary)
9. **Journey fade** — absolute at bottom, gradient from parchment-tertiary to transparent, 120px tall
10. **Episode stop** — flex column, centered, padding
11. **Seal container** — 120px square, cursor pointer, hover scale(1.08), z-index 2
12. **Episode label** — centered text below seal (title in display font, meta in UI font/fog)
13. **Episode expanded card** — max-width 520px, bg parchment-secondary, rounded. Uses max-height 0 / opacity 0 for collapsed, max-height 4000px / opacity 1 for `.open`. Transition on max-height, opacity, padding, margin.
14. **Episode card contents** — number badge (tiny uppercase), title, meta row (location in stone, guide in moss, separators), summary (italic), walk link (arrow prefix)
15. **Audio player** — same as current: play button (circle border, play/pause SVG toggle), progress bar (3px track with fill), time display
16. **Transcript** — toggle button (border, small text), content div (max-height 0 to 100000px transition)
17. **Journey caption** — centered italic text in stone, low opacity
18. **Journey empty state** — centered italic for "first walk is being recorded"
19. **Footer** — same as current
20. **Reveal animation** — `.reveal { opacity: 0; transform: translateY(12px) }` `.reveal.visible { opacity: 1; transform: translateY(0) }` with prefers-reduced-motion override
21. **Responsive** — at max-width 600px: seal 80px, expanded card full width, top bar smaller

- [ ] **Step 2: Commit**

```bash
cd /Users/rubberduck/GitHub/momentmaker/pilgrim-podcast
git add css/styles.css
git commit -m "feat: journey page styles with path, seals, time-of-day shifts"
```

---

### Task 4: Journey Renderer (main.js)

**Files:**
- Rewrite: `/Users/rubberduck/GitHub/momentmaker/pilgrim-podcast/js/main.js`

- [ ] **Step 1: Rewrite main.js**

The file must be wrapped in an IIFE. It must contain ALL of these functions:

**Preserved from current main.js (copy exactly):**
- `initTheme()` — reads localStorage, sets data-theme, calls updateThemeIcon
- `toggleTheme()` — toggles light/dark, saves to localStorage
- `updateThemeIcon()` — creates sun/moon SVG in .theme-toggle button
- `handlePlay(btn)` — audio player: play/pause/resume, progress update, ended handler
- `formatDuration(seconds)` — returns "m:ss" or "h:mm:ss"
- `formatDate(dateStr)` — returns "Mon D, YYYY"
- `pad(n)` — zero-pad

**New functions:**

- `applyTimeOfDay()` — gets current hour, sets `data-time` attribute on documentElement. dawn=5-7, dusk=17-19, night=20-4, day=default (no attribute).

- `capitalize(str)` — uppercase first letter

- `generateCaption(date1, date2)` — computes day difference, returns natural language string per the spec rules (same day, a day, N days, a week, N weeks, a month, N months). Appends season change if month-based season differs.

- `renderJourney(episodes)` — the main renderer:
  1. Gets `#journey-stops` container, clears it
  2. If empty, shows "The first walk is being recorded."
  3. Sorts episodes by number ascending (oldest first)
  4. For each episode: if not first, insert a `.journey-caption` with `generateCaption` text. Then create `.episode-stop` with seal (via `PilgrimSeal.generate`), label (title + meta), and expanded card (via `buildExpandedCard`). Attach click handler on seal to `toggleExpand`.
  5. Calls `initScrollReveal()`

- `buildExpandedCard(ep)` — creates the expanded card DOM:
  1. `.episode-expanded` wrapper (starts without `.open` class)
  2. `.episode-number-badge` "Episode N"
  3. `.episode-expanded-title` ep.title
  4. `.episode-expanded-meta` with location (`.location`), duration, guide (`.guide` "guided by X"), date, separated by middots (`.sep`)
  5. `.episode-summary` with ep.summary (italic)
  6. Audio player: `.episode-player` wrapper, `.play-btn` with play/pause SVGs, `.progress-bar` with `.progress-fill`, `.player-time`
  7. Walk link if ep.walkPage exists
  8. Transcript toggle + content if ep.transcript exists (same pattern as current)
  9. Returns the wrapper element

- `toggleExpand(stop, card, ep)` — closes any open card, opens the clicked one (toggle). Plays bell via `playBell(ep.guide)`.

- `playBell(guideId)` — creates Audio from `PilgrimSeal.bellUrl(guideId)`, volume 0.3, plays. Stops previous bell if playing.

- `initScrollReveal()` — IntersectionObserver on `.reveal` elements. When visible: add `.visible` class, call `PilgrimSeal.animate(svg)()` if seal SVG present. Respects prefers-reduced-motion (add visible immediately, trigger reveal immediately).

- `init()` — calls applyTimeOfDay, initTheme, fetches episodes.json, calls renderJourney. Attaches theme toggle click. Attaches delegated click for .play-btn and .progress-bar.

- Boot: `if (document.readyState === 'loading') DOMContentLoaded → init; else init()`

**Audio player state** (module-level vars): `currentAudio`, `currentBtn`, `currentBellAudio`

Use `textContent` for all text insertion. Use `insertAdjacentHTML` only for the seal SVG (which is generated by our own seal.js, not user content). Use `createElement` + `appendChild` for all other DOM construction.

- [ ] **Step 2: Verify locally**

```bash
cd /Users/rubberduck/GitHub/momentmaker/pilgrim-podcast && python3 -m http.server 8080
```

Open http://localhost:8080. Verify:
- Top bar shows title and links
- Dashed path runs down center
- Episode 1 seal renders in Drift warm cream with "1"
- Seal animates on scroll (rings draw in, dots appear, number fades)
- Click seal → card expands, gentle-harp bell plays
- Audio player works (play/pause/seek)
- Transcript toggle works
- Path fades at bottom
- Dark mode toggle works
- No console errors

- [ ] **Step 3: Commit**

```bash
cd /Users/rubberduck/GitHub/momentmaker/pilgrim-podcast
git add js/main.js
git commit -m "feat: journey renderer with expand, bells, time-of-day, scroll reveal"
```

---

### Task 5: Visual Polish and Deploy

**Files:**
- Possibly modify: all files for adjustments

- [ ] **Step 1: Test dark mode**

Toggle dark mode. Verify: seals visible, expanded card bg correct, path visible, text readable.

- [ ] **Step 2: Test mobile**

Dev tools → 375px viewport. Verify: seals 80px, card full width, top bar fits, player tappable.

- [ ] **Step 3: Test time-of-day**

Temporarily hardcode `var hour = 18;` in applyTimeOfDay. Verify warmer palette. Reset.

- [ ] **Step 4: Test weather**

In episodes.json, temporarily change weather to "rain, 15°C". Reload. Verify seal has more displacement/blur. Reset.

- [ ] **Step 5: Push to GitHub Pages**

```bash
cd /Users/rubberduck/GitHub/momentmaker/pilgrim-podcast
git add -A
git commit -m "polish: visual fixes from testing"
git push
```

Verify: https://podcast.pilgrimapp.org shows the journey page.
