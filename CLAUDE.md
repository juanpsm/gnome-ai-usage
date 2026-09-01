# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Test & Lint

```bash
make test              # run everything: bash contract tests, CLI tests, python-interp tests, JS tests
./tests/get-ai-usage.test.sh       # provider contract tests (bash) — replays fixtures via --normalize
./tests/ai-usage-cli.test.sh       # terminal frontend tests (bash)
./tests/python-interp.test.sh      # python interpreter discovery tests (bash)
./tests/get-codex-stats.test.sh
./tests/get-codex-rate-limits.test.sh
node --test tests/*.test.js        # shared JS code (Format.js, history merging)

make lint-py            # ruff check + format --check on package/contents/tools/aiusage (needs ruff, or `nix develop`)
make check-pricing       # diff billing.py pricing tables against live provider pricing pages
make gnome-install      # install the GNOME Shell extension locally (delegates to gnome-extension/Makefile)
make gnome-pack         # build ai-usage@juanpsm-<v>-{modern,legacy}.shell-extension.zip (see gnome-extension/PUBLISHING.md)
make gnome-release      # bump version, tag gnome-v<N>, push — triggers .github/workflows/gnome-release.yml

nix run .#hyprland      # run the Quickshell/Hyprland frontend
nix run .#cli           # run ai-usage-cli via the flake, no install needed
```

To re-check a single fixture after editing it: `./tests/get-ai-usage.test.sh | grep <provider>`.

Tests replay recorded fixtures from `tests/fixtures/` through `--normalize` mode — no network access is used or needed. To add a provider, capture a real response into `tests/fixtures/<provider>.json`, add jq-based contract assertions in `get-ai-usage.test.sh`, and verify.

## High-level architecture

One Python backend feeds three independent frontends. **No frontend does network I/O, response parsing, or quota math** — that's the whole point of the contract, and it's enforced by contract tests, not convention.

```
package/contents/tools/aiusage/     (Python, stdlib-only)
  providers/    one file per service — raw HTTP fetch
  normalize/    one file per service — raw response -> contract shape (pure, deterministic)
  collect.py    orchestrator: calls each provider, aggregates results
  contract.py   shared primitives (pct clamping, color thresholds, time arithmetic, PROVIDER_ICONS)
  cli.py        entry point, parses --provider/--all/--normalize
  render.py     terminal table/compact rendering + color thresholds
  billing.py    pricing tables for cost aggregation (validated by check-pricing.py)
  config.py     settings file discovery ($XDG_CONFIG_HOME/ai-usage-widget/hyprland-settings.json)
  envelope.py   wraps the collected result with schema version + active provider
  http.py       shared HTTP + retry/backoff (respects retry-after)
        │
        ├── gnome-extension/             GNOME Shell extension (JS/GJS) — legacy/ targets GNOME 42-44
        ├── hyprland/                    Quickshell/Hyprland shell (QML) + tray/ (C++ StatusNotifier)
        └── package/contents/tools/sh/   ai-usage-cli — terminal frontend, no compositor needed
```

Entry points: `get-ai-usage` (bash launcher, sets PYTHONPATH, execs the Python backend — used by all frontends) and `ai-usage-cli` (bash wrapper piping the envelope into `render.py`; also accepts a piped-in envelope: `get-ai-usage --all | ai-usage-cli`).

The provider contract shape is documented in `docs/provider-contract.md`: `id/label/accent/icon`, `ok/stale/error`, `updatedAt`, `summary {pct,text,detail,hasChart}`, `quotaWindows[]`, `chartWindows[]`, `slots`, `historyValues`, `details`.

### Conventions that matter

- **Stdlib-only backend.** No `requests`, no third-party deps anywhere in `aiusage/` — it must run unmodified on RHEL/openSUSE minimal images. `pyproject.toml`'s ruff/pyrefly config is dev-only tooling, not a runtime dependency declaration.
- **Pure normalization.** `normalize/*.py` functions take a raw API response and return contract pieces with no I/O and no side effects, so `--normalize` replay is byte-for-byte deterministic.
- **Credentials never leak past the backend.** Resolution order is widget settings → `$WIDGET_*` / provider-specific env var → local config file (e.g. `~/.config/zai/token`). The JSON contract only ever carries presence flags (`hasApiKey`, `keyValid`, …), never the credential itself — a contract test greps for this.
- **Frontends read the contract, never the raw response.** e.g. `provider.quotaWindows[0].pct`, not re-deriving a percentage from a raw field. Countdown/formatting logic that Quickshell's QML needs lives in `package/contents/code/Format.js`; the GNOME extension has its own minimal equivalent in `gnome-extension/utils.js` (GJS, no chart yet, so no history-merging logic to share).
- **Color thresholds** (0-70% accent, 70-90% amber `#f4a460`, 90-100% red `#ff6b6b`) are defined once in `render.py` and mirrored per-frontend.
- **Time units differ by layer**: QML/JS uses epoch milliseconds (`Date.now()`), the Python contract uses epoch seconds. Converters like `countdownFromEpoch()` in `Format.js` bridge the two — check which side you're on before doing arithmetic.
- **One file per provider** in both `providers/` and `normalize/`; don't mix providers in one module. Shared quota math belongs in `contract.py`.
- **Settings are per-frontend but share provider toggles**: GNOME uses GSettings, Quickshell/Hyprland uses the JSON file in `config.py`. They don't share full settings, but the CLI/Hyprland side reads provider on/off state from the same shared config so enabled services stay consistent.
- **Local activity stats** for some providers (Claude, Grok) are cached on disk under `~/.cache/ai-usage-widget/` as an offline fallback / burn-rate source.

### Dev environment

`nix develop` provides Python 3.9+/ruff, Node.js, Qt's QML tooling, and `jq` together. Without Nix: install `ruff` for `make lint-py` and `jq` for the contract tests; tests otherwise run on any POSIX shell + Node.
