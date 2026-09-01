#!/usr/bin/env bash
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
target="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/ai-usage@juanpsm"
shell_version="$(gnome-shell --version 2>/dev/null | sed -n 's/.* \([0-9][0-9]*\)\..*/\1/p')"

if [ -n "$shell_version" ] && [ "$shell_version" -lt 45 ]; then
    variant="legacy"
else
    variant="modern"
fi

"$here/stage.sh" "$variant" "$target"
printf 'Installed AI Usage (%s) to %s\n' "$variant" "$target"
