#!/usr/bin/env bash
# Bumps the integer "version" in both GNOME metadata.json files, commits,
# tags gnome-v<N>, and pushes — pushing that tag is what triggers
# .github/workflows/gnome-release.yml to build and publish the archives.
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
METADATA_PATHS=("$HERE/metadata.json" "$HERE/legacy/metadata.json")

read_version() {
    grep -oE '"version"[[:space:]]*:[[:space:]]*[0-9]+' "$1" | head -1 | grep -oE '[0-9]+$'
}

CURRENT="$(read_version "${METADATA_PATHS[0]}")"
if [ -z "$CURRENT" ]; then
    echo "Error: could not read \"version\" from ${METADATA_PATHS[0]}" >&2
    exit 1
fi
NEW=$((CURRENT + 1))
TAG="gnome-v${NEW}"

if git -C "$HERE" rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
    echo "Error: tag $TAG already exists" >&2
    exit 1
fi

for path in "${METADATA_PATHS[@]}"; do
    sed -i -E "s/(\"version\"[[:space:]]*:[[:space:]]*)${CURRENT}/\1${NEW}/" "$path"
done

echo "Bumped GNOME extension version: ${CURRENT} → ${NEW}"
git -C "$HERE/.." diff -- gnome-extension/metadata.json gnome-extension/legacy/metadata.json

if [ "${1:-}" != "--yes" ]; then
    read -r -p "Commit, tag ${TAG}, and push? [y/N] " reply
    case "$reply" in
        [yY]*) ;;
        *) echo "Left the version bump uncommitted — revert with git checkout -- gnome-extension/metadata.json gnome-extension/legacy/metadata.json"; exit 0 ;;
    esac
fi

git -C "$HERE/.." add gnome-extension/metadata.json gnome-extension/legacy/metadata.json
git -C "$HERE/.." commit -m "gnome-extension: bump version to ${NEW}"
git -C "$HERE/.." tag "$TAG"
git -C "$HERE/.." push
git -C "$HERE/.." push origin "$TAG"
echo "Pushed ${TAG} — .github/workflows/gnome-release.yml will build and publish the archives."
