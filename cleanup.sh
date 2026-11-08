#!/bin/bash
# MaykTop cleanup: moves (does NOT delete) already-applied patch files into _cleanup-DATE/
cd "$(dirname "$0")"
[ -f PROJECT.md ] || { echo "Run this inside the project folder (where PROJECT.md is)"; exit 1; }
D="_cleanup-$(date +%Y%m%d)"
mkdir -p "$D"
shopt -s nullglob
for f in patch-*.zip mayktop-*-patch.zip README-patch-*.txt apply-*.mjs fix-social-*.mjs \
         FEED-SEPARATION-PATCH-README.txt MAYKTOP-NEWS-RSS-PATCH-README.txt social-appeal-edits.json \
         i18n-social-* docs-social-* web-backup-* backups \
         dev.db.backup-before-* web/dev.db.* ; do
  [ -e "$f" ] && mv "$f" "$D"/"$(echo "$f" | tr '/' '_')" && echo "moved: $f"
done
echo; echo "Kept: web/dev.db, dev.db, .md files, TODO.md, check-todo.mjs, 7-mayktop.zip"
echo "After build + tests pass:  rm -rf $D"
