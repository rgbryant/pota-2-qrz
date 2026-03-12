#!/usr/bin/env bash
# Fail if any source file exceeds 350 lines.
set -euo pipefail

MAX=350
FAILED=0

while IFS= read -r -d '' file; do
  lines=$(wc -l < "$file")
  if [ "$lines" -gt "$MAX" ]; then
    echo "FAIL: $file has $lines lines (max $MAX)"
    FAILED=1
  fi
done < <(find . \
  -not \( -path './node_modules/*' -o -path './dist/*' -o -path './.git/*' \) \
  \( -name '*.js' -o -name '*.css' -o -name '*.html' \) \
  -print0)

if [ "$FAILED" -eq 1 ]; then
  echo "One or more files exceed the $MAX-line limit. Split them before committing."
  exit 1
fi

echo "Line length check passed."
