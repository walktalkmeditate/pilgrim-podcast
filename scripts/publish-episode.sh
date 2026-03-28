#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${BOLD}-> $1${NC}"; }
pass() { echo -e "  ${GREEN}ok${NC} $1"; }
fail() { echo -e "  ${RED}xx${NC} $1"; exit 1; }

SLUG=""

while [ $# -gt 0 ]; do
    case "$1" in
        --slug) SLUG="$2"; shift ;;
        *) fail "Unknown option: $1" ;;
    esac
    shift
done

[ -z "$SLUG" ] && fail "Missing --slug"

OUTPUT_FILE="$PROJECT_DIR/output/$SLUG.mp3"
[ ! -f "$OUTPUT_FILE" ] && fail "Episode file not found: $OUTPUT_FILE"

# --- Check R2 credentials ---

R2_ENDPOINT="${R2_ENDPOINT:-}"
R2_ACCESS_KEY="${R2_ACCESS_KEY:-}"
R2_SECRET_KEY="${R2_SECRET_KEY:-}"
R2_BUCKET="${R2_BUCKET:-pilgrim-walks}"

if [ -z "$R2_ENDPOINT" ] || [ -z "$R2_ACCESS_KEY" ] || [ -z "$R2_SECRET_KEY" ]; then
    if [ -f "$PROJECT_DIR/.env" ]; then
        source "$PROJECT_DIR/.env"
    fi
fi

[ -z "$R2_ENDPOINT" ] && fail "R2_ENDPOINT not set. Export it or add to .env"
[ -z "$R2_ACCESS_KEY" ] && fail "R2_ACCESS_KEY not set"
[ -z "$R2_SECRET_KEY" ] && fail "R2_SECRET_KEY not set"

# --- Upload to R2 ---

step "Uploading to R2: podcast/$SLUG/episode.mp3"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_KEY"

aws s3 cp "$OUTPUT_FILE" \
    "s3://$R2_BUCKET/podcast/$SLUG/episode.mp3" \
    --endpoint-url "$R2_ENDPOINT" \
    --content-type "audio/mpeg" \
    --no-sign-request 2>/dev/null || \
aws s3 cp "$OUTPUT_FILE" \
    "s3://$R2_BUCKET/podcast/$SLUG/episode.mp3" \
    --endpoint-url "$R2_ENDPOINT" \
    --content-type "audio/mpeg"

pass "Uploaded to CDN: https://cdn.pilgrimapp.org/podcast/$SLUG/episode.mp3"

# --- Commit and push ---

step "Committing site updates"

cd "$PROJECT_DIR"
git add episodes/episodes.json feed.xml
git commit -m "episode: $SLUG" || pass "Nothing to commit"
git push origin main || fail "Push failed"

pass "Site deployed"

echo -e "\n${GREEN}${BOLD}Episode published!${NC}"
echo "  Audio: https://cdn.pilgrimapp.org/podcast/$SLUG/episode.mp3"
echo "  Site:  https://podcast.pilgrimapp.org"
