# iOS Safari Audio Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix scroll sound and audio preview bugs on iOS Safari by migrating scroll sound to Web Audio API and guarding preview behind hover media query.

**Architecture:** Replace `HTMLAudioElement` scroll sound (lines 777-871 of `js/main.js`) with `AudioContext` + `GainNode` + `AudioBufferSourceNode`. Add `(hover: hover)` media query guard to `setupAudioPreview`. Episode player unchanged.

**Tech Stack:** Vanilla JS, Web Audio API (`AudioContext`, `GainNode`, `AudioBufferSourceNode`)

---

### Task 1: Add hover-only guard to audio preview

**Files:**
- Modify: `js/main.js:488-535`

This is the simplest fix — a one-line guard that disables the preview feature on touch-only devices.

- [ ] **Step 1: Add the media query guard**

At the top of `setupAudioPreview`, before the indicator element is created, add the hover check. The entire function becomes a no-op on touch devices — no DOM elements created, no listeners attached.

In `js/main.js`, replace:

```js
  function setupAudioPreview(sealWrap, ep) {
    var indicator = document.createElement('div');
```

with:

```js
  function setupAudioPreview(sealWrap, ep) {
    if (!window.matchMedia('(hover: hover)').matches) return;
    var indicator = document.createElement('div');
```

- [ ] **Step 2: Remove the userHasInteracted machinery**

The `userHasInteracted` guard (lines 482-486) was a workaround for autoplay policy. With the hover guard in place, only hover-capable devices reach this code, and they already satisfy autoplay via the mouseenter user gesture. Remove the redundant listeners and variable.

In `js/main.js`, replace the block:

```js
  var userHasInteracted = false;

  document.addEventListener('click', function () { userHasInteracted = true; }, { once: true });
  document.addEventListener('keydown', function () { userHasInteracted = true; }, { once: true });
  document.addEventListener('touchstart', function () { userHasInteracted = true; }, { once: true });
```

with:

```js
  var userHasInteracted = false;
  document.addEventListener('click', function () { userHasInteracted = true; }, { once: true });
  document.addEventListener('keydown', function () { userHasInteracted = true; }, { once: true });
```

This removes the `touchstart` listener (which was only needed for touch devices that will now skip the function entirely) but keeps `click` and `keydown` for desktop — the `userHasInteracted` check on line 494 still prevents preview from firing before any interaction on desktop.

- [ ] **Step 3: Verify**

Open the site on a desktop browser. Hover over a seal for 2+ seconds — preview audio should play and fade out as before. On iOS Safari (or Chrome DevTools mobile emulation with touch simulation), tap a seal — no preview audio should play, card should expand normally.

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "fix: guard audio preview behind hover media query for iOS Safari"
```

---

### Task 2: Rewrite scroll sound with Web Audio API — state and loading

**Files:**
- Modify: `js/main.js:777-864`

Replace the scroll sound state variables and `loadScrollAudio` function with Web Audio API equivalents.

- [ ] **Step 1: Replace state variables**

In `js/main.js`, replace:

```js
  // --- Scroll Sound ---

  var scrollAudio = null;
  var scrollSoundEnabled = false;
  var lastScrollY = 0;
  var scrollVelocity = 0;
  var scrollDecay = null;
  var maxScrollVolume = 0.08;

  var SCROLL_SOUNDS = {
    spring: 'https://cdn.pilgrimapp.org/audio/scroll/spring.aac',
    summer: 'https://cdn.pilgrimapp.org/audio/scroll/summer.aac',
    autumn: 'https://cdn.pilgrimapp.org/audio/scroll/autumn.aac',
    winter: 'https://cdn.pilgrimapp.org/audio/scroll/winter.aac'
  };
```

with:

```js
  // --- Scroll Sound (Web Audio API) ---

  var scrollCtx = null;
  var scrollGain = null;
  var scrollSource = null;
  var scrollSoundEnabled = false;
  var lastScrollY = 0;
  var scrollVelocity = 0;
  var scrollDecay = null;
  var maxScrollVolume = 0.08;

  var SCROLL_SOUNDS = {
    spring: 'https://cdn.pilgrimapp.org/audio/scroll/spring.aac',
    summer: 'https://cdn.pilgrimapp.org/audio/scroll/summer.aac',
    autumn: 'https://cdn.pilgrimapp.org/audio/scroll/autumn.aac',
    winter: 'https://cdn.pilgrimapp.org/audio/scroll/winter.aac'
  };
```

- [ ] **Step 2: Replace `loadScrollAudio` with Web Audio version**

In `js/main.js`, replace:

```js
  function loadScrollAudio(season) {
    var url = SCROLL_SOUNDS[season];
    if (!url) return;
    if (scrollAudio) { scrollAudio.pause(); }
    scrollAudio = new Audio(url);
    scrollAudio.loop = true;
    scrollAudio.volume = 0;
    scrollAudio.play().catch(function () {});
  }
```

with:

```js
  function loadScrollAudio(season) {
    var url = SCROLL_SOUNDS[season];
    if (!url || !scrollCtx) return;
    fetch(url)
      .then(function (res) { return res.arrayBuffer(); })
      .then(function (buf) { return scrollCtx.decodeAudioData(buf); })
      .then(function (audioBuffer) {
        if (scrollSource) {
          try { scrollSource.stop(); } catch (e) {}
          scrollSource.disconnect();
        }
        scrollSource = scrollCtx.createBufferSource();
        scrollSource.buffer = audioBuffer;
        scrollSource.loop = true;
        scrollSource.connect(scrollGain);
        scrollSource.start();
      })
      .catch(function () {});
  }
```

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "refactor: replace scroll sound HTMLAudioElement with Web Audio API state and loader"
```

---

### Task 3: Rewrite scroll sound — init, enable, and handle

**Files:**
- Modify: `js/main.js` (the `initScrollSound`, `enableScrollSound`, `handleScrollSound` functions, and the season-cycle caller)

- [ ] **Step 1: Replace `initScrollSound`**

The key fix: create and resume the `AudioContext` inside the user gesture handler, not deferred to scroll.

In `js/main.js`, replace:

```js
  function initScrollSound() {
    var invite = document.getElementById('scroll-sound-invite');
    if (!invite) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (localStorage.getItem('scroll-sound') === 'on') {
      invite.classList.add('hidden');
      var scrollSoundReady = false;
      var scrollSoundStarted = false;

      function markReady() { scrollSoundReady = true; }
      document.addEventListener('click', markReady);
      document.addEventListener('touchstart', markReady);

      function tryStartScrollSound() {
        if (scrollSoundStarted || !scrollSoundReady) return;
        scrollSoundStarted = true;
        enableScrollSound();
        document.removeEventListener('click', markReady);
        document.removeEventListener('touchstart', markReady);
        window.removeEventListener('scroll', tryStartScrollSound);
      }
      window.addEventListener('scroll', tryStartScrollSound, { passive: true });
      return;
    }

    invite.addEventListener('click', function () {
      enableScrollSound();
      invite.classList.add('hidden');
      localStorage.setItem('scroll-sound', 'on');
    });
  }
```

with:

```js
  function initScrollSound() {
    var invite = document.getElementById('scroll-sound-invite');
    if (!invite) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (localStorage.getItem('scroll-sound') === 'on') {
      invite.classList.add('hidden');
      var scrollSoundStarted = false;

      function startOnGesture() {
        if (scrollSoundStarted) return;
        scrollSoundStarted = true;
        enableScrollSound();
        document.removeEventListener('click', startOnGesture);
        document.removeEventListener('touchstart', startOnGesture);
      }
      document.addEventListener('click', startOnGesture);
      document.addEventListener('touchstart', startOnGesture);
      return;
    }

    invite.addEventListener('click', function () {
      enableScrollSound();
      invite.classList.add('hidden');
      localStorage.setItem('scroll-sound', 'on');
    });
  }
```

The returning-visitor path no longer waits for scroll after click. It creates the `AudioContext` directly inside the click/touchstart gesture handler, which satisfies iOS Safari's autoplay policy.

- [ ] **Step 2: Replace `enableScrollSound`**

In `js/main.js`, replace:

```js
  function enableScrollSound() {
    var season = document.documentElement.getAttribute('data-season') || 'spring';
    loadScrollAudio(season);
    scrollSoundEnabled = true;

    var mute = document.createElement('button');
    mute.className = 'scroll-sound-mute';
    mute.textContent = '\uD83D\uDD0A';
    mute.setAttribute('aria-label', 'Mute scroll sound');
    mute.addEventListener('click', function () {
      scrollSoundEnabled = !scrollSoundEnabled;
      mute.textContent = scrollSoundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
      if (!scrollSoundEnabled && scrollAudio) {
        scrollAudio.volume = 0;
      }
      localStorage.setItem('scroll-sound', scrollSoundEnabled ? 'on' : 'off');
    });
    document.body.appendChild(mute);

    lastScrollY = window.scrollY;
    window.addEventListener('scroll', handleScrollSound, { passive: true });

    scrollDecay = setInterval(function () {
      scrollVelocity *= 0.75;
      if (scrollAudio && scrollSoundEnabled) {
        scrollAudio.volume = Math.min(scrollVelocity, maxScrollVolume);
      }
    }, 50);
  }
```

with:

```js
  function enableScrollSound() {
    scrollCtx = new (window.AudioContext || window.webkitAudioContext)();
    scrollGain = scrollCtx.createGain();
    scrollGain.gain.value = 0;
    scrollGain.connect(scrollCtx.destination);

    if (scrollCtx.state === 'suspended') {
      scrollCtx.resume();
    }

    var season = document.documentElement.getAttribute('data-season') || 'spring';
    loadScrollAudio(season);
    scrollSoundEnabled = true;

    var mute = document.createElement('button');
    mute.className = 'scroll-sound-mute';
    mute.textContent = '\uD83D\uDD0A';
    mute.setAttribute('aria-label', 'Mute scroll sound');
    mute.addEventListener('click', function () {
      scrollSoundEnabled = !scrollSoundEnabled;
      mute.textContent = scrollSoundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
      if (!scrollSoundEnabled && scrollGain) {
        scrollGain.gain.value = 0;
      }
      localStorage.setItem('scroll-sound', scrollSoundEnabled ? 'on' : 'off');
    });
    document.body.appendChild(mute);

    lastScrollY = window.scrollY;
    window.addEventListener('scroll', handleScrollSound, { passive: true });

    scrollDecay = setInterval(function () {
      scrollVelocity *= 0.75;
      if (scrollGain && scrollSoundEnabled) {
        scrollGain.gain.value = Math.min(scrollVelocity, maxScrollVolume);
      }
    }, 50);
  }
```

- [ ] **Step 3: `handleScrollSound` is unchanged**

The existing `handleScrollSound` function only updates `scrollVelocity` from scroll deltas — it doesn't touch any audio objects directly. No changes needed. Confirm it still reads:

```js
  function handleScrollSound() {
    var currentY = window.scrollY;
    var delta = Math.abs(currentY - lastScrollY);
    lastScrollY = currentY;
    scrollVelocity = Math.min(scrollVelocity + delta * 0.0008, maxScrollVolume);
  }
```

- [ ] **Step 4: Update the season-cycle caller**

In `js/main.js`, the season cycle click handler (around line 928) calls `loadScrollAudio(next)`. This still works because `loadScrollAudio` now fetches and decodes via the existing `scrollCtx`. No change needed — just verify the line still reads:

```js
        if (scrollSoundEnabled) loadScrollAudio(next);
```

- [ ] **Step 5: Verify**

Test these scenarios:

1. **First-time visitor (any browser):** Click the scroll-sound invite. Scroll — ambient sound should respond to scroll velocity. Mute button works.
2. **Returning visitor on iOS Safari:** Page loads with invite hidden. Tap anywhere on page. Scroll — ambient sound should play and respond to velocity.
3. **Season cycling:** While scroll sound is active, cycle seasons — sound should switch to new season.
4. **Mute toggle:** Click mute — sound silences. Click again — sound resumes responding to scroll.
5. **Reduced motion:** With `prefers-reduced-motion: reduce` set, scroll sound should not initialize at all.

- [ ] **Step 6: Commit**

```bash
git add js/main.js
git commit -m "fix: migrate scroll sound to Web Audio API for iOS Safari compatibility"
```
