# iOS Safari Audio Fixes

## Problem

Three audio bugs on iOS Safari, all stemming from two platform limitations:

1. **`HTMLAudioElement.volume` is read-only on iOS Safari** — always reflects hardware volume, programmatic sets are silently ignored.
2. **`play()` must be called synchronously within a user gesture's call stack** — deferred calls (e.g., from a scroll handler) are blocked.

### Affected features

| Feature | Symptom | Root cause |
|---------|---------|------------|
| Scroll sound (returning visitors) | Never plays | `play()` called from scroll handler, not user gesture |
| Scroll sound (all iOS) | Volume control broken | `volume` property is read-only |
| Audio preview | Plays at full volume, never fades out | `volume` read-only; fade-out loop condition never terminates |
| Audio preview | Fires on tap instead of hover | `mouseenter` simulated on touch devices |

## Solution

### 1. Scroll Sound — Web Audio API Migration

Replace `HTMLAudioElement` with `AudioContext` + `GainNode` for the scroll ambient sound.

**AudioContext lifecycle:**
- Create and `resume()` the `AudioContext` inside a user gesture handler (click/touchstart). For returning visitors (`localStorage scroll-sound === 'on'`), this happens on the first click/touchstart anywhere. For new visitors, on the invite element click.
- Once resumed on a gesture, the context can play audio at any time without further gestures.

**Loading audio:**
- `fetch()` the seasonal `.aac` URL.
- `audioContext.decodeAudioData()` to produce an `AudioBuffer`.
- Store the buffer for reuse.

**Playback chain:**
```
AudioBufferSourceNode (loop: true) → GainNode → audioContext.destination
```
- Start the source immediately at gain 0.
- `GainNode.gain.value` is writable on iOS — this is the fix for volume control.

**Scroll reactivity:**
- Same velocity calculation and decay interval as current code.
- Write to `gainNode.gain.value` instead of `audio.volume`.

**Season switching (`loadScrollAudio`):**
- Fetch + decode the new season's buffer.
- Stop the current source node, create a new one with the new buffer, connect to the same gain node, start it.

**Mute toggle:**
- Set `gainNode.gain.value = 0` on mute.
- Restore scroll-velocity-driven value on unmute.

**Returning visitor flow (fixed):**
```
1. Page load → localStorage says 'on' → register click/touchstart listener
2. User taps/clicks anywhere → create AudioContext, resume(), fetch + decode audio, start looping source at gain 0
3. User scrolls → handleScrollSound updates gainNode.gain.value via velocity
```
The key fix: `AudioContext` creation and `resume()` happen inside the gesture handler. Playback does not require a separate gesture.

### 2. Audio Preview — Hover-Only Guard

Add a media query guard at the top of `setupAudioPreview`:

```js
if (!matchMedia('(hover: hover)').matches) return;
```

On touch-only devices, no event listeners are attached — no `mouseenter`, no timers, no audio creation. The preview feature becomes desktop-only.

Desktop behavior is completely unchanged.

### 3. Episode Player — No Changes

The main play/pause player:
- Uses `HTMLAudioElement` for straightforward playback.
- Does not use programmatic volume control.
- `play()` is always triggered directly from a click handler.
- Works correctly on iOS Safari as-is.

## Files Modified

- `js/main.js` — scroll sound section (~lines 777-870) rewritten to use Web Audio API; `setupAudioPreview` gets hover guard.

## Testing

- **iOS Safari**: Scroll sound plays and responds to scroll velocity. Preview does not trigger on seal tap.
- **Desktop browsers**: Scroll sound works as before. Preview works on hover as before.
- **Returning visitor flow**: Sound resumes after first click + scroll on iOS.
- **Season cycling**: Scroll sound switches to new season's audio.
- **Mute toggle**: Silences and restores scroll sound.
- **Reduced motion**: Scroll sound still skipped when `prefers-reduced-motion: reduce` is set.
