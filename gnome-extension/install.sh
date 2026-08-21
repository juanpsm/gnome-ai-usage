#!/usr/bin/env bash
set -eu

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
target="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/ai-usage@juanpsm"
shell_version="$(gnome-shell --version 2>/dev/null | sed -n 's/.* \([0-9][0-9]*\)\..*/\1/p')"

if [ -n "$shell_version" ] && [ "$shell_version" -lt 45 ]; then
    source_dir="$repo_root/gnome-extension/legacy"
    variant="legacy"
else
    source_dir="$repo_root/gnome-extension"
    variant="modern"
fi

rm -rf "$target"
mkdir -p "$target/backend"
cp "$source_dir/metadata.json" "$source_dir/extension.js" "$source_dir/prefs.js" "$source_dir/stylesheet.css" "$target/"
cp "$source_dir/utils.js" "$target/"
cp -r "$repo_root/gnome-extension/schemas" "$target/"
cp -r "$repo_root/package/contents/tools/." "$target/backend/"
find "$target/backend" -type d -name __pycache__ -prune -exec rm -rf {} +
glib-compile-schemas "$target/schemas"
printf 'Installed AI Usage (%s) to %s\n' "$variant" "$target"
