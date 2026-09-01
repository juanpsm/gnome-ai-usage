#!/usr/bin/env bash
# Build installable .shell-extension.zip archives (modern + legacy).
# Usage: pack.sh [output-dir]
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$here/.." && pwd)"
out_dir="$(cd "${1:-$repo_root}" && pwd)"
uuid="ai-usage@juanpsm"

version="$(grep -oE '"Version":[[:space:]]*"[^"]+"' "$repo_root/package/metadata.json" \
    | head -1 | sed -E 's/.*"([^"]+)"$/\1/')"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

for variant in modern legacy; do
    stage="$work/$variant"
    "$here/stage.sh" "$variant" "$stage" "$version"
    out="$out_dir/${uuid}-${version}-${variant}.shell-extension.zip"
    rm -f "$out"
    (cd "$stage" && zip -qr "$out" . -x '*.swp' '*~')
    echo "wrote $out"
done
