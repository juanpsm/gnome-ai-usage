# Publishing the GNOME Shell extension

## Cutting a release (GitHub)

```sh
make gnome-release
```

Bumps the integer `version` in `gnome-extension/metadata.json` and
`legacy/metadata.json`, commits, tags `gnome-v<N>`, and pushes. Pushing that
tag triggers `.github/workflows/gnome-release.yml`, which runs
`make gnome-pack` and publishes a GitHub release with both archives
attached:

| Archive | GNOME Shell |
|---|---|
| `ai-usage@juanpsm-<v>-modern.shell-extension.zip` | 45+ |
| `ai-usage@juanpsm-<v>-legacy.shell-extension.zip` | 42–44 |

Users install either with `gnome-extensions install --force <zip>` — no
`make`, no clone.

To build the archives locally without cutting a release (e.g. to test one
before tagging), run `make gnome-pack` directly.

## extensions.gnome.org (EGO)

EGO is optional — the GitHub release above already gives a one-command
install. Submitting to EGO buys browser-based install and automatic updates,
at the cost of a manual review per upload.

Before uploading, check:

- **One variant per submission.** A zip carries a single `metadata.json`, and
  the two variants use incompatible module systems (ESM vs `imports.gi`).
  Upload the `modern` archive; keep `legacy` as a GitHub-only download.
- **`version` must be strictly greater** than the published one.
  `release.sh` guarantees this for GitHub releases; EGO tracks its own
  counter separately, so check its last accepted version before uploading.
- **`shell-version` must list only released GNOME versions.** EGO rejects
  unknown ones. Re-check this list each GNOME cycle.
- **No downloaded or generated code.** The backend (`backend/sh` +
  `backend/aiusage`) ships inside the archive and is never fetched at runtime,
  which is what the rule requires. Expect reviewers to ask about it anyway:
  the extension spawns `backend/sh/get-ai-usage`, which `exec`s the system
  `python3` on the bundled `aiusage` package. Nothing is written outside the
  extension directory and no code is evaluated at runtime.
- **Processes are spawned carefully and exit cleanly**, per the review
  guideline on external scripts: the spawn has a 30-second bounded timeout
  (`REFRESH_TIMEOUT_SECONDS` in `extension.js`) that cancels the subprocess
  if the backend hangs, and `disable()` cancels any in-flight refresh instead
  of leaving it to call back into a destroyed indicator. One provider raising
  an unexpected exception can't crash the whole backend process either — it
  degrades to an error entry for that provider while the rest of the envelope
  still comes back (`envelope.py`'s `fetch_one`).
- **`python3` is a runtime dependency** not expressible in `metadata.json`.
  Mention it in the EGO description; the path is user-overridable in the
  extension preferences.
- **The MIT `LICENSE` is bundled** into both archives (`stage.sh` copies it
  from the repo root), satisfying EGO's requirement for an OSI-approved
  license inside the upload.
