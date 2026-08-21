#!/usr/bin/env bash
set -eu

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
target="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/ai-usage@juanpsm"

rm -rf "$target"
mkdir -p "$target/backend"
cp -r "$repo_root/gnome-extension/." "$target/"
cp -r "$repo_root/package/contents/tools/." "$target/backend/"
find "$target/backend" -type d -name __pycache__ -prune -exec rm -rf {} +
glib-compile-schemas "$target/schemas"
printf 'Installed AI Usage to %s\n' "$target"
