#!/usr/bin/env bash
# Copies each app's .env.example to .env if it doesn't already exist.
# Safe to re-run — never overwrites an existing .env.
set -euo pipefail
cd "$(dirname "$0")/.."

for example in apps/*/.env.example; do
  target="${example%.example}"
  if [ -f "$target" ]; then
    echo "skip  $target (already exists)"
  else
    cp "$example" "$target"
    echo "wrote $target"
  fi
done
