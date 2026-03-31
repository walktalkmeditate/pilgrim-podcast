# Podcast Journey Page Design

Redesign podcast.pilgrimapp.org from a flat episode listing into an interactive pilgrimage — a vertical path of goshuin seals that you walk through by scrolling.

## Page Structure

### Top Bar
Minimal nav replacing the hero section. Title "Pilgrim on the Path" on the left, RSS + pilgrimapp.org links on the right. No logo, no tagline, no CTA button. The journey is the page.

### Journey Path
A gently **curving SVG path** (not straight) running vertically down the center of the page. Episodes sit at bends in the path. The path is rendered as a thin dashed line in `--parchment-tertiary`, quiet and structural.

**Episode order: oldest at top, newest at bottom.** The path goes forward in time. You scroll down to reach the frontier. The newest episode is at the bottom where the path trails off into nothing.

### Episode Stops
Each episode is a stop on the path: a goshuin seal centered on the path line, with the episode title and minimal metadata below it.

**Collapsed state:** Seal + title + one-line meta (location, duration, guide name, date).

**Expanded state:** Clicking a seal expands the episode card **inline below the seal**, pushing the path down. The card contains: episode number badge, title, full metadata row, guide's intro summary (italic), audio player, "View the walk" link, "Read transcript" toggle. Clicking the seal again or an X collapses it.

### Captions Between Episodes
Between each episode stop, a short italic caption reflecting the real time gap. Computed from the date difference between adjacent episodes:

- 0 days: "the same day"
- 1 day: "a day passed"
- 2-6 days: "N days passed"
- 7-13 days: "a week passed"
- 14-29 days: "N weeks passed"
- 30-59 days: "a month passed"
- 60+ days: "N months passed"

If the season changes between episodes (based on month), append the new season: "...and spring arrived." Seasons: spring (Mar-May), summer (Jun-Aug), autumn (Sep-Nov), winter (Dec-Feb).

### Path Ending
The path trails off below the last episode — fading opacity, no ghost/placeholder. The emptiness is the invitation. No "coming soon."

### Footer
Minimal: pilgrimapp.org, App Store, GitHub, RSS links. "crafted with intention."

## Goshuin Seal Design

Each seal is an SVG generated from episode data, colored by the voice guide.

### Guide Color Mapping
The seal stroke/fill color comes from each guide's logo mark:

| Guide | Seal Color | Hex |
|-------|-----------|-----|
| Breeze | Navy | `#1B3A4B` |
| Drift | Warm cream | `#C2A68C` |
| Dusk | Silver blue | `#A8B8C0` |
| Ember | Gold | `#C8A050` |
| River | Mint | `#A8D8D0` |
| Sage | Sage gold | `#C8B888` |
| Stone | Copper | `#B8956A` |

### Data-Driven Elements
Each visual element of the seal encodes real episode data:

- **Rings:** Count driven by episode duration (more rings = longer episode). Ring spacing and dash patterns vary per episode.
- **Lines:** Count driven by number of voice recordings in the episode.
- **Dots:** Placed from a hash of the episode data, making each seal's dot pattern unique.
- **Center:** Episode number displayed prominently (large Cormorant Garamond, light weight). "EPISODE" label below in small Lato caps.
- **Rotation:** Derived from a hash of episode metadata, so each seal sits at a unique angle.

### Weather Influence
The episode's weather data affects how the seal renders:

- **Clear sky:** Crisp, sharp strokes. Normal opacity.
- **Cloudy/overcast:** Slightly softer strokes (lower opacity, gentler turbulence filter).
- **Rain:** Watercolor bleed effect — increased displacement map scale, slightly blurred edges.
- **Snow/cold:** Cooler color temperature shift on the guide color.

Weather is available in `episodes.json` as a string like "clear, 27°C".

### Seal Animation
Each seal draws itself as it scrolls into view (IntersectionObserver):
1. Rings draw in via stroke-dashoffset animation (outermost first)
2. Lines fade in with staggered delay
3. Dots appear last
4. Episode number fades in after all geometric elements

Same pattern as the landing page seal animation. Respects `prefers-reduced-motion`.

## Bell on Expand
When a seal is clicked to expand, the guide's bell sound plays quietly (volume ~0.3). Bell audio files are already on R2 at `pilgrimapp/audio/bell/{bell-id}.aac`. The bell ID is mapped per guide:

| Guide | Bell |
|-------|------|
| Breeze | echo-chime |
| Drift | gentle-harp |
| Dusk | temple-bell |
| Ember | warm-guitar |
| River | burma-bell |
| Sage | yoga-chime |
| Stone | clear-ring |

The bell file URL: `https://pub-c72c34fbaa6c1041a47d15961d16f398.r2.dev/audio/bell/{bell-id}.aac`

## Time-of-Day Palette Shift
The page subtly shifts its color palette based on the visitor's local time:

- **Dawn (5-8am):** Slightly cooler parchment, blue-shifted fog
- **Day (8am-5pm):** Default palette (no shift)
- **Dusk (5-8pm):** Warmer parchment, golden-shifted stone
- **Night (8pm-5am):** Darker parchment tones, warmer fog, reduced contrast

Implemented via CSS custom property overrides applied to `:root` by JavaScript on page load. Subtle — not a full theme change, just a 5-10% hue/lightness shift.

## Dark Mode
Inherits the same dark mode toggle and palette from the landing page (already implemented in the current podcast CSS). Time-of-day shift applies on top of both light and dark modes.

## Data Source

Everything renders from `episodes/episodes.json`. Each episode object has:

```json
{
  "number": 1,
  "title": "Austin, Texas",
  "date": "2026-03-30",
  "location": "Austin, Texas",
  "weather": "clear, 27°C",
  "distance_km": 3.1,
  "duration": 1479,
  "guide": "drift",
  "summary": "...",
  "audioUrl": "https://...",
  "fileSize": 30328251,
  "walkPage": "https://...",
  "transcript": "...",
  "reflection": "first podcast let's go"
}
```

Guide-to-color and guide-to-bell mappings are defined in the JavaScript as lookup tables.

## Responsive
- Desktop: seals centered on path, expanded cards are 520px max width
- Mobile (<600px): seals smaller (80px), path still centered, expanded cards full width with padding
- Expanded cards stack naturally since they're inline

## Files Changed
All changes are in the `pilgrim-podcast` repo:

- `index.html` — replace hero + episode list with journey structure
- `css/styles.css` — rewrite episode styles for journey layout, add seal/path/caption/expand styles, add time-of-day shifts
- `js/main.js` — rewrite episode rendering for journey layout, add seal SVG generator, add expand/collapse interaction, add bell playback, add time-of-day detection, add scroll-reveal for seals
- `js/seal.js` — new file: goshuin seal generator adapted from the landing page `seal.js`, parameterized for episode data + guide colors + weather

## What This Does NOT Include
- Individual episode pages (single-page only)
- RSS feed changes (unchanged)
- `episodes.json` schema changes (unchanged — all data is already there)
- Podcast publish command changes (unchanged)
