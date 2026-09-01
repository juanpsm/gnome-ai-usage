#!/usr/bin/env bash
# Stage an installable extension tree into a target directory.
# Usage: stage.sh <variant: modern|legacy> <target-dir> [version-name]
set -eu

variant="$1"
target="$2"
version_name="${3:-}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"

case "$variant" in
    modern) source_dir="$repo_root/gnome-extension" ;;
    legacy) source_dir="$repo_root/gnome-extension/legacy" ;;
    *) echo "unknown variant: $variant" >&2; exit 1 ;;
esac

rm -rf "$target"
mkdir -p "$target/backend"
cp "$source_dir/metadata.json" "$source_dir/extension.js" "$source_dir/prefs.js" "$source_dir/stylesheet.css" "$target/"
cp "$source_dir/utils.js" "$target/"
cp -r "$repo_root/gnome-extension/schemas" "$target/"
cp -r "$repo_root/package/contents/icons" "$target/"
cp -r "$repo_root/package/contents/tools/." "$target/backend/"
find "$target/backend" -type d -name __pycache__ -prune -exec rm -rf {} +
chmod +x "$target/backend/sh/get-ai-usage" "$target/backend/sh/ai-usage-cli" \
         "$target/backend/sh/export-snapshot" "$target/backend/sh/history-io"
glib-compile-schemas "$target/schemas"

# EGO shows `version-name` verbatim; `version` stays an integer it can order.
if [ -n "$version_name" ]; then
    tmp="$target/metadata.json.tmp"
    sed -E "s/(\"version\"[[:space:]]*:[[:space:]]*[0-9]+)/\1,\n  \"version-name\": \"$version_name\"/" \
        "$target/metadata.json" > "$tmp"
    mv "$tmp" "$target/metadata.json"
fi
