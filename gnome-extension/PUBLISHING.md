# Publishing the GNOME Shell extension

## Release artifacts (GitHub)

Tagging with `./tag.sh` bumps `package/metadata.json` (the plasmoid version
string) and, in lockstep, the integer `version` in both GNOME
`metadata.json` files. CI then runs `make gnome-pack` and attaches two
archives to the GitHub release:

| Archive | GNOME Shell |
|---|---|
| `ai-usage@juanpsm-<v>-modern.shell-extension.zip` | 45+ |
| `ai-usage@juanpsm-<v>-legacy.shell-extension.zip` | 42–44 |

Users install with `gnome-extensions install --force <zip>`, no `make` and no
clone required.

## extensions.gnome.org (EGO)

EGO is optional — the GitHub release above already gives a one-command
install. Submitting to EGO buys browser-based install and automatic updates,
at the cost of a manual review per upload.

Before uploading, check:

- **One variant per submission.** A zip carries a single `metadata.json`, and
  the two variants use incompatible module systems (ESM vs `imports.gi`).
  Upload the `modern` archive; keep `legacy` as a GitHub-only download.
- **`version` must be strictly greater** than the published one. `tag.sh`
  handles this; do not hand-edit it out of order.
- **`shell-version` must list only released GNOME versions.** EGO rejects
  unknown ones. Re-check this list each GNOME cycle.
- **No downloaded or generated code.** The backend (`backend/sh` +
  `backend/aiusage`) ships inside the archive and is never fetched at runtime,
  which is what the rule requires. Expect reviewers to ask about it anyway:
  the extension spawns `backend/sh/get-ai-usage`, which `exec`s the system
  `python3` on the bundled `aiusage` package. Nothing is written outside the
  extension directory and no code is evaluated at runtime.
- **`python3` is a runtime dependency** not expressible in `metadata.json`.
  Mention it in the EGO description; the path is user-overridable in the
  extension preferences.
