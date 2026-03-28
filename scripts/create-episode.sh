#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CACHE_DIR="$PROJECT_DIR/.cache"
WORK_DIR="$PROJECT_DIR/.work"

CDN_BASE="https://cdn.pilgrimapp.org/audio"
DHYAMA_DIR="${DHYAMA_DIR:-$PROJECT_DIR/../../dhyama}"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${BOLD}-> $1${NC}"; }
pass() { echo -e "  ${GREEN}ok${NC} $1"; }
warn() { echo -e "  ${YELLOW}!!${NC} $1"; }
fail() { echo -e "  ${RED}xx${NC} $1"; exit 1; }

usage() {
    echo "Usage: scripts/create-episode.sh [options]"
    echo ""
    echo "Options:"
    echo "  --title TEXT         Episode title (required)"
    echo "  --walker TEXT        Walker name or 'Anonymous' (default: Anonymous)"
    echo "  --location TEXT      Where the walk happened (required)"
    echo "  --weather TEXT       Weather description (e.g. 'Light rain, 12C')"
    echo "  --intention TEXT     The walker's intention"
    echo "  --guide NAME         Voice guide: breeze|drift|dusk|ember|river|sage|stone"
    echo "  --bell ID            Bell sound ID (default: temple-bell)"
    echo "  --soundscape ID      Soundscape ID (default: gentle-stream)"
    echo "  --recordings PATH    Path to recording files (glob or directory)"
    echo "  --number N           Episode number (auto-incremented if omitted)"
    echo "  --summary TEXT       Episode summary"
    echo "  --skip-narration     Skip TTS narration, use recordings only"
    echo ""
    echo "Example:"
    echo "  scripts/create-episode.sh \\"
    echo "    --title 'Walking with Rain' \\"
    echo "    --location 'Portland, Oregon' \\"
    echo "    --weather 'Light rain, 12C' \\"
    echo "    --intention 'Letting go' \\"
    echo "    --guide breeze \\"
    echo "    --recordings ./recordings/2026-03-28/"
    exit 1
}

# --- Parse Args ---

TITLE=""
WALKER="Anonymous"
LOCATION=""
WEATHER=""
INTENTION=""
GUIDE=""
BELL="temple-bell"
SOUNDSCAPE="gentle-stream"
RECORDINGS_PATH=""
EPISODE_NUMBER=""
SUMMARY=""
SKIP_NARRATION=false

GUIDES=(breeze drift dusk ember river sage stone)
BELLS=(echo-chime gentle-harp clear-ring temple-bell warm-guitar burma-bell yoga-chime)
SOUNDSCAPES=(ocean-waves morning-birds crackling-fire evening-crickets deep-forest rain-forest gentle-stream)

while [ $# -gt 0 ]; do
    case "$1" in
        --title) TITLE="$2"; shift ;;
        --walker) WALKER="$2"; shift ;;
        --location) LOCATION="$2"; shift ;;
        --weather) WEATHER="$2"; shift ;;
        --intention) INTENTION="$2"; shift ;;
        --guide) GUIDE="$2"; shift ;;
        --bell) BELL="$2"; shift ;;
        --soundscape) SOUNDSCAPE="$2"; shift ;;
        --recordings) RECORDINGS_PATH="$2"; shift ;;
        --number) EPISODE_NUMBER="$2"; shift ;;
        --summary) SUMMARY="$2"; shift ;;
        --skip-narration) SKIP_NARRATION=true ;;
        -h|--help) usage ;;
        *) fail "Unknown option: $1" ;;
    esac
    shift
done

[ -z "$TITLE" ] && fail "Missing --title"
[ -z "$LOCATION" ] && fail "Missing --location"
[ -z "$RECORDINGS_PATH" ] && fail "Missing --recordings"

if [ -z "$GUIDE" ]; then
    GUIDE="${GUIDES[$RANDOM % ${#GUIDES[@]}]}"
    pass "Randomly selected guide: $GUIDE"
fi

# --- Derive slug ---

SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
DATE=$(date +%Y-%m-%d)

if [ -z "$EPISODE_NUMBER" ]; then
    EPISODES_FILE="$PROJECT_DIR/episodes/episodes.json"
    if [ -f "$EPISODES_FILE" ]; then
        EPISODE_NUMBER=$(python3 -c "
import json
with open('$EPISODES_FILE') as f:
    eps = json.load(f)
print(max([e.get('number', 0) for e in eps], default=0) + 1)
")
    else
        EPISODE_NUMBER=1
    fi
fi

step "Creating Episode $EPISODE_NUMBER: $TITLE"
echo "  Guide: $GUIDE | Bell: $BELL | Soundscape: $SOUNDSCAPE"
echo "  Slug: $SLUG | Date: $DATE"

# --- Collect recordings ---

step "Collecting recordings"
mkdir -p "$WORK_DIR"
rm -rf "$WORK_DIR"/*

RECORDING_FILES=()
if [ -d "$RECORDINGS_PATH" ]; then
    while IFS= read -r f; do
        RECORDING_FILES+=("$f")
    done < <(find "$RECORDINGS_PATH" -type f \( -name "*.m4a" -o -name "*.mp3" -o -name "*.aac" -o -name "*.wav" \) | sort)
else
    for f in $RECORDINGS_PATH; do
        [ -f "$f" ] && RECORDING_FILES+=("$f")
    done
fi

[ ${#RECORDING_FILES[@]} -eq 0 ] && fail "No recording files found at $RECORDINGS_PATH"
pass "Found ${#RECORDING_FILES[@]} recording(s)"

# --- Download bell + soundscape ---

step "Downloading audio assets"
mkdir -p "$CACHE_DIR"

BELL_FILE="$CACHE_DIR/$BELL.aac"
SOUNDSCAPE_FILE="$CACHE_DIR/$SOUNDSCAPE.aac"

if [ ! -f "$BELL_FILE" ]; then
    curl -sL "$CDN_BASE/bell/$BELL.aac" -o "$BELL_FILE"
    pass "Downloaded bell: $BELL"
else
    pass "Bell cached: $BELL"
fi

if [ ! -f "$SOUNDSCAPE_FILE" ]; then
    curl -sL "$CDN_BASE/soundscape/$SOUNDSCAPE.aac" -o "$SOUNDSCAPE_FILE"
    pass "Downloaded soundscape: $SOUNDSCAPE"
else
    pass "Soundscape cached: $SOUNDSCAPE"
fi

# --- Generate narration ---

INTRO_FILE="$WORK_DIR/intro.wav"
OUTRO_FILE="$WORK_DIR/outro.wav"

if [ "$SKIP_NARRATION" = true ]; then
    warn "Skipping narration (--skip-narration)"
    INTRO_FILE=""
    OUTRO_FILE=""
else
    step "Generating narration with guide: $GUIDE"

    INTRO_TEXT="This walk was recorded in $LOCATION."
    [ -n "$WEATHER" ] && INTRO_TEXT="$INTRO_TEXT $WEATHER."
    [ -n "$INTENTION" ] && INTRO_TEXT="$INTRO_TEXT The walker carried a question: $INTENTION."
    INTRO_TEXT="$INTRO_TEXT Walk with them."

    OUTRO_TEXT="Thank you for walking along. Find Pilgrim at pilgrimapp.org."

    if [ -d "$DHYAMA_DIR" ] && [ -f "$DHYAMA_DIR/tools/pyproject.toml" ]; then
        cd "$DHYAMA_DIR/tools"

        if [ ! -d ".venv" ]; then
            warn "Dhyama venv not found. Run: cd $DHYAMA_DIR/tools && python -m venv .venv && pip install -e ."
            SKIP_NARRATION=true
        else
            source .venv/bin/activate

            python3 -c "
from dhyama.tts import generate_speech
generate_speech('$GUIDE', '''$INTRO_TEXT''', '$INTRO_FILE')
print('Intro generated')
generate_speech('$GUIDE', '''$OUTRO_TEXT''', '$OUTRO_FILE')
print('Outro generated')
" 2>/dev/null && pass "Narration generated" || {
                warn "TTS failed, skipping narration"
                SKIP_NARRATION=true
                INTRO_FILE=""
                OUTRO_FILE=""
            }

            deactivate
        fi
        cd "$PROJECT_DIR"
    else
        warn "Dhyama not found at $DHYAMA_DIR, skipping narration"
        SKIP_NARRATION=true
        INTRO_FILE=""
        OUTRO_FILE=""
    fi
fi

# --- Stitch episode ---

step "Stitching episode with ffmpeg"

OUTPUT_DIR="$PROJECT_DIR/output"
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/$SLUG.mp3"

FILTER_PARTS=()
INPUT_FILES=()
INPUT_INDEX=0

add_input() {
    INPUT_FILES+=("-i" "$1")
    echo $INPUT_INDEX
    INPUT_INDEX=$((INPUT_INDEX + 1))
}

CONCAT_PARTS=""

# Bell
BELL_IDX=$(add_input "$BELL_FILE")
CONCAT_PARTS="[$BELL_IDX:a]"

# Intro narration (if available)
if [ -n "$INTRO_FILE" ] && [ -f "$INTRO_FILE" ]; then
    INTRO_IDX=$(add_input "$INTRO_FILE")
    CONCAT_PARTS="$CONCAT_PARTS[$INTRO_IDX:a]"

    BELL2_IDX=$(add_input "$BELL_FILE")
    CONCAT_PARTS="$CONCAT_PARTS[$BELL2_IDX:a]"
fi

# Recordings with bells between
for i in "${!RECORDING_FILES[@]}"; do
    REC_IDX=$(add_input "${RECORDING_FILES[$i]}")
    CONCAT_PARTS="$CONCAT_PARTS[$REC_IDX:a]"

    if [ $i -lt $((${#RECORDING_FILES[@]} - 1)) ]; then
        BETWEEN_IDX=$(add_input "$BELL_FILE")
        CONCAT_PARTS="$CONCAT_PARTS[$BETWEEN_IDX:a]"
    fi
done

# Outro bell
OUTRO_BELL_IDX=$(add_input "$BELL_FILE")
CONCAT_PARTS="$CONCAT_PARTS[$OUTRO_BELL_IDX:a]"

# Outro narration (if available)
if [ -n "$OUTRO_FILE" ] && [ -f "$OUTRO_FILE" ]; then
    OUTRO_IDX=$(add_input "$OUTRO_FILE")
    CONCAT_PARTS="$CONCAT_PARTS[$OUTRO_IDX:a]"

    FINAL_BELL_IDX=$(add_input "$BELL_FILE")
    CONCAT_PARTS="$CONCAT_PARTS[$FINAL_BELL_IDX:a]"
fi

TOTAL_INPUTS=$INPUT_INDEX

ffmpeg -y \
    "${INPUT_FILES[@]}" \
    -filter_complex "${CONCAT_PARTS}concat=n=${TOTAL_INPUTS}:v=0:a=1[mixed];[mixed]loudnorm=I=-16:LRA=11:TP=-1.5[out]" \
    -map "[out]" \
    -codec:a libmp3lame -b:a 128k -ar 44100 -ac 2 \
    "$OUTPUT_FILE" 2>/dev/null

pass "Episode created: $OUTPUT_FILE"

# --- Calculate duration ---

DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUTPUT_FILE" | cut -d. -f1)
pass "Duration: $(printf '%d:%02d' $((DURATION / 60)) $((DURATION % 60)))"

# --- Update episodes.json ---

step "Updating episodes.json"

EPISODES_FILE="$PROJECT_DIR/episodes/episodes.json"

python3 -c "
import json

ep = {
    'slug': '$SLUG',
    'number': $EPISODE_NUMBER,
    'title': '''$TITLE''',
    'walker': '''$WALKER''',
    'location': '''$LOCATION''',
    'weather': '''${WEATHER:-}''',
    'intention': '''${INTENTION:-}''',
    'guide': '$GUIDE',
    'soundscape': '$SOUNDSCAPE',
    'duration': $DURATION,
    'date': '$DATE',
    'audioUrl': 'https://cdn.pilgrimapp.org/podcast/$SLUG/episode.mp3',
    'summary': '''${SUMMARY:-A walk in $LOCATION.}'''
}

with open('$EPISODES_FILE', 'r') as f:
    episodes = json.load(f)

episodes.append(ep)

with open('$EPISODES_FILE', 'w') as f:
    json.dump(episodes, f, indent=2)

print('Added episode $EPISODE_NUMBER to episodes.json')
"

pass "episodes.json updated"

# --- Regenerate RSS feed ---

step "Regenerating RSS feed"
python3 "$SCRIPT_DIR/generate-feed.py" "$EPISODES_FILE" "$PROJECT_DIR/feed.xml"
pass "feed.xml updated"

echo -e "\n${GREEN}${BOLD}Episode $EPISODE_NUMBER ready!${NC}"
echo ""
echo "  Output: $OUTPUT_FILE"
echo "  Duration: $(printf '%d:%02d' $((DURATION / 60)) $((DURATION % 60)))"
echo ""
echo "Next steps:"
echo "  1. Listen to the episode: open $OUTPUT_FILE"
echo "  2. Upload to R2: scripts/publish-episode.sh --slug $SLUG"
echo "  3. Commit and push to deploy the site"
