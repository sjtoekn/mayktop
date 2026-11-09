#!/bin/bash
# MaykTop hand-off ZIP maker.  Usage:  bash ~/Downloads/handoff.sh [docs | all | <keyword>]
#   docs      (default) docs + schema + config only, no source code   (smallest)
#   <keyword> docs + source files whose path contains the keyword (e.g. short, social, ads)
#   all       docs + all of web/src (other-language texts left out)
# Result: ~/Downloads/7-mayktop-HANDOFF.zip
set -eu

PARENT="${PARENT:-$HOME/Downloads}"      # folder that contains the project folder
NAME="${NAME:-7-mayktop}"                # project folder name
OUT="${OUT:-$HOME/Downloads/7-mayktop-HANDOFF.zip}"
ARG="${1:-docs}"

SRC="$PARENT/$NAME"
[ -d "$SRC" ] || { echo "ERROR: $SRC නැහැ. ෆයිල් එකේ ඉහළ PARENT / NAME බලන්න."; exit 1; }
mkdir -p "$(dirname "$OUT")"

STAGE="$(mktemp -d /tmp/handoff-XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT
DEST="$STAGE/$NAME"
mkdir -p "$DEST"

# 1 + 2. choose the files (tar is used, it works the same on every Mac)
SKIP='(^|/)(node_modules|\.next|\.git|\.turbo|storage|generated|coverage|\.vercel)/|^web-backup|\.(zip|tgz|db|db-journal|tsbuildinfo|log)$|\.db\.|\.sqlite|\.before-|(^|/)\.DS_Store$|(^|/)\.env($|\.)|package-lock\.json$'
NOISE='^(patch-|docs-)[^/]*/|^README-patch-|^(apply|fix|reapply)-[^/]*\.mjs$|^cleanup\.sh$|^add-news-sources\.ts$|^PROJECT-8j15\.txt$|^profile-security-|^web/public/|^web/prisma/migrations/|^web/scripts/|^web/src/'
LANGS='^web/src/i18n/messages/(ar|es|fr|hi|zh)\.ts$'

cd "$SRC"
find . -type f | sed 's#^\./##' | grep -vE "$SKIP" | grep -vE "$NOISE" > "$STAGE/list.txt" || true
if [ -d web/src ]; then
  if [ "$ARG" = "all" ]; then
    find web/src -type f | grep -vE "$SKIP" | grep -vE "$LANGS" >> "$STAGE/list.txt" || true
  elif [ "$ARG" != "docs" ]; then
    KEEP="$ARG|lib/prisma|config/site|lib/session|lib/rate-limit|lib/account-limits|i18n/messages/en\.ts"
    find web/src -type f | grep -vE "$SKIP" | grep -iE "$KEEP" | grep -vE "$LANGS" >> "$STAGE/list.txt" || true
  fi
fi
find . -name '.env.example' -not -path '*/node_modules/*' | sed 's#^\./##' >> "$STAGE/list.txt" || true
sort -u "$STAGE/list.txt" -o "$STAGE/list.txt"
tar -cf - -T "$STAGE/list.txt" | tar -xf - -C "$DEST"
cd "$STAGE"

# 3. keep only the newest part of CHANGELOG.md
if [ -f "$DEST/CHANGELOG.md" ]; then
  head -c 12000 "$DEST/CHANGELOG.md" > "$STAGE/cl.tmp"
  { cat "$STAGE/cl.tmp"; printf '\n\n[... older entries trimmed for size ...]\n'; } > "$DEST/CHANGELOG.md"
fi

# 4. HANDOFF.md
H="$DEST/HANDOFF.md"
{
  echo "# HANDOFF - MaykTop"
  echo
  echo "Generated: $(date '+%Y-%m-%d %H:%M')   Mode: $ARG"
  echo
  cat <<'PROMPT'
## Read me first (instructions for the AI)
- This ZIP is a LIGHT hand-off, not the whole project. Source files that are not in the ZIP exist; ASK for the exact file you need instead of guessing.
- Read PROJECT_CONTEXT.md and AI-INSTRUCTIONS.md first, then SHORTS_TODO.md / TODO.md for the current work.
- Code is the truth, docs are plans. If they disagree, say so.
- The owner writes in Sinhala; answer in Sinhala. Give changes as small patches (a zip or exact file contents), never rewrite whole files without a reason.
- Never ask the owner to paste secrets. No .env is included on purpose.

PROMPT
  if [ -f "$SRC/web/prisma/schema.prisma" ]; then
    echo "## Database models"
    grep -E '^model ' "$SRC/web/prisma/schema.prisma" | awk '{printf "%s ", $2}' || true
    echo; echo
  fi
  if [ -d "$SRC/web/prisma/migrations" ]; then
    echo "## Last 8 migrations"
    ls "$SRC/web/prisma/migrations" | grep -v lock | tail -8 | sed 's/^/- /' || true
    echo
  fi
  echo "## Patches already made"
  ls "$SRC" | grep '^README-patch-' | sed 's/^/- /' || true
  ls -d "$SRC"/patch-*/ 2>/dev/null | sed "s#$SRC/#- folder: #" || true
  echo
  if [ -f "$SRC/check-todo.mjs" ] && command -v node >/dev/null 2>&1; then
    echo "## TODO progress"
    echo '```'
    ( cd "$SRC" && for f in SHORTS_TODO.md PHOTO_TODO.md TODO.md; do
        [ -f "$f" ] && { node check-todo.mjs "$f" 2>&1 | sed -n 1,3p || true; }
      done ) || true
    echo '```'
  fi
  if [ -f "$SRC/shorts-status.mjs" ] && command -v node >/dev/null 2>&1; then
    echo
    echo "## Shorts status (auto check)"
    echo '```'
    ( cd "$SRC" && node shorts-status.mjs 2>&1 ) || true
    echo '```'
  fi
  echo
  echo "## All source files (paths only; not all are in this ZIP)"
  echo '```'
  ( cd "$SRC" && find web/src web/scripts -type f 2>/dev/null | sort ) || true
  echo '```'
} > "$H"

# 5. ZIP
TMP="$STAGE/out.zip"
( cd "$STAGE" && zip -r -9 -q -X "$TMP" "$NAME" )
unzip -tq "$TMP" >/dev/null
mv -f "$TMP" "$OUT"

# 6. report
BYTES=$(find "$DEST" -type f -exec cat {} + | wc -c | tr -d ' ')
FILES=$(find "$DEST" -type f | wc -l | tr -d ' ')
ZB=$(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT")
echo "===== HANDOFF READY ====="
echo "Saved in : $OUT"
echo "ZIP size : $((ZB / 1024)) KB    Files: $FILES"
echo "Approx. tokens when read: $((BYTES / 4 / 1000))k"
if [ $((BYTES / 4)) -gt 150000 ]; then
  echo "WARNING: ලොකුයි. 'docs' හෝ '<keyword>' mode එක පාවිච්චි කරන්න."
fi
command -v open >/dev/null 2>&1 && open -R "$OUT" 2>/dev/null || true
echo
echo "අලුත් chat එකේ පළමු පණිවිඩය:"
echo "  මේ MaykTop project එකේ හැන්ඩ්ඕෆ් ZIP එක. HANDOFF.md සහ PROJECT_CONTEXT.md මුලින් කියවන්න. ඉන්පසු SHORTS_TODO.md එකේ ඊළඟ පියවර කරමු. ඕන ෆයිල් මගෙන් ඉල්ලන්න."
