# Copilot Instructions

## Build, Test & Lint

### Run all tests
```bash
make test
```

### Run individual test suites
```bash
# Provider contract tests (bash)
./tests/get-ai-usage.test.sh

# Terminal frontend tests (bash)
./tests/ai-usage-cli.test.sh

# Python interpreter tests (bash)
./tests/python-interp.test.sh

# Shared JavaScript code (Node.js)
node --test tests/*.test.js
```

### Python linting (requires ruff)
```bash
make lint-py
```
To use the dev environment with all tools, run `nix develop` first.

### Check billing/pricing drift
```bash
make check-pricing
```

### Preview the widget
```bash
# Planar layout (default)
make view

# Horizontal layout
make view-h
```

### Package for distribution
```bash
make pack
```

## High-Level Architecture

This project provides a **shared provider backend** that feeds three frontends:

```
Python Backend (package/contents/tools/aiusage)
  • Credential discovery from env vars & config files
  • HTTP calls to provider APIs
  • Normalization to a stable JSON contract
  • Local activity stats aggregation
         │
         ├─────────────────┼────────────────┐
         ▼                 ▼                ▼
    KDE Plasma          Quickshell      Terminal
    (QML UI)            (QML UI)        (ai-usage-cli)
    widgets             hyprland/       renders.py
```

**Key invariant**: No frontend performs network requests, parses provider responses, or computes quotas. All three map contract fields to their widgets and nothing else — this keeps logic out of duplicate implementations and is verified by contract tests.

### Provider Contract (docs/provider-contract.md)

Every provider returns this shape:
- `id`, `label`, `accent`, `icon` — metadata
- `ok`, `stale`, `error` — status flags
- `updatedAt` — epoch seconds, last fetch timestamp
- `summary` — aggregated view: `{pct, text, detail, hasChart}`
- `quotaWindows[]` — array of windows per provider (e.g., Claude has session & weekly windows)
- `chartWindows[]` — config for historical data visualization (granularity, period, reset rules)
- `slots` — panel indicators (one or more)
- `historyValues` — timeseries data keyed by chart window
- `details` — provider-specific breakdowns (e.g., Claude per-model usage, OpenAI per-plan)

### Backend Modules

| Module | Purpose |
|---|---|
| `collect.py` | Main orchestrator; calls each provider, aggregates results |
| `providers/` | One file per AI service; fetches raw data via HTTP |
| `normalize/` | One file per AI service; raw response → contract shape |
| `contract.py` | Shared primitives for constructing the contract (pct clamping, color thresholds, time arithmetic) |
| `cli.py` | Entry point for `aiusage` CLI; parses args like `--provider claude,openai` |
| `render.py` | Terminal table/compact output; uses contract to format rows |
| `billing.py` | Pricing tables for cost aggregation; validated against live pricing pages |
| `config.py` | Settings file discovery (`$XDG_CONFIG_HOME/ai-usage-widget/hyprland-settings.json`) |
| `envelope.py` | Envelope wrapping (adds schema version, active provider) |
| `http.py` | Shared HTTP + retry logic with rate-limit backoff |

### Frontend Code Paths

**KDE Plasma (package/contents/ui)**
- `main.qml` — Central component; fetches and routes data to tabs
- `*Tab.qml` — Individual provider panels (ClaudeTab, OpenAiTab, etc.)
- `SettingsPanel.qml` — Config UI; persists to plasmoid settings
- `PanelSlot.qml` — Taskbar indicator (percentage + sparkline)
- `Format.js` — Shared countdown / formatting logic

**GNOME Shell (gnome-extension/)**
- `extension.js` — Main entry point; fetches backend and wires popover
- `prefs.js` — Settings page for GNOME Extensions app
- `metadata.json` — Extension metadata; targets GNOME 46+
- `legacy/` — GNOME 42–44 implementation (uses synchronous GJS imports)

**Terminal (package/contents/tools/sh/ai-usage-cli)**
- Wrapper script that calls the Python backend
- Passes envelope to `aiusage/render.py` for table or compact output

### Entry Points

| Command | File | Role |
|---|---|---|
| `get-ai-usage` | `sh/get-ai-usage` | Bash launcher; sets PYTHONPATH, invokes Python backend |
| `ai-usage-cli` | `sh/ai-usage-cli` | Bash wrapper; calls backend, pipes to render |
| `python -m aiusage` | `aiusage/__main__.py` | Direct Python invocation (rarely used) |

## Key Conventions

### Python Backend

1. **No external dependencies** — Only stdlib (the whole backend is vendorable). Libraries like `requests` or `arrow` are forbidden; the backend must work on RHEL/openSUSE minimal environments.

2. **Contract first** — Every provider module normalizes into the same shape. The contract tests in `tests/get-ai-usage.test.sh` verify this — if you add a provider, you must pass the contract invariants (credentials never leak, reset times are valid epoch seconds, chart windows have all required fields, etc.).

3. **Pure normalization functions** — Functions in `normalize/` take raw API responses and return contract pieces. They have no side effects, no I/O, and must be deterministic so `--normalize` mode (replaying recorded responses) produces identical output.

4. **Credentials in env, never hardcoded** — Look for `os.environ.get("WIDGET_*")` or in the settings file under `.keys[provider_id]`. The widget launcher passes `WIDGET_CLAUDE`, `WIDGET_OPENAI`, etc. at runtime.

5. **Local activity stats** — Some providers (Claude, Grok) track activity on disk in `~/.cache/ai-usage-widget/`. This acts as a fallback when the API is offline and lets users estimate burn rate.

6. **Line length 150** — Ruff config sets this for readability in split-screen editors. Imports are sorted via isort (built into ruff format).

### Frontend Code (QML)

1. **Never parse responses** — The frontend reads from the contract. Example:
   ```qml
   // WRONG: parsing the raw response
   var pct = provider.quotaWindows[0].percentUsed * 100
   
   // RIGHT: using the contract
   var pct = provider.quotaWindows[0].pct
   ```

2. **Shared format logic** — Countdown arithmetic lives in `package/contents/code/Format.js` so both Plasma and Quickshell render identical timestamps. If you add a format function, add it there first, then import it in the QML.

3. **Color thresholds** — Defined in `render.py` and mirrored in QML:
   - 0–70%: theme accent (or brand color if enabled)
   - 70–90%: yellow (#f4a460)
   - 90–100%: red (#ff6b6b)

4. **Settings are per-frontend** — Plasma uses `plasmoid.configuration`, GNOME uses GSettings, Quickshell uses the shared JSON config. They don't share settings, but both read provider toggles from the shared config so CLI and Hyprland see the same enabled services.

### Testing

1. **Recorded fixtures** — Tests don't hit the live API. Instead, `tests/fixtures/` contains real provider responses captured at a point in time. Each test replays one through `--normalize` and asserts the contract shape. To add a new provider:
   - Capture a real response → `tests/fixtures/provider-name.json`
   - Add contract checks in `get-ai-usage.test.sh` using jq filters
   - Verify it passes: `./tests/get-ai-usage.test.sh`

2. **Contract invariants** — Every fixture must pass these (enforced in the test loop):
   - All required fields present (id, label, ok, error, summary, quotaWindows, etc.)
   - No credential strings leak (checked with regex on the JSON)
   - Reset timestamps are 0 or valid epoch seconds (> 1 billion)
   - Chart windows have all config fields (id, key, label, size, granularity, resets, periodMs, resetAt)

3. **Run single test** — Rerun just the schema checks for a fixture after editing it:
   ```bash
   ./tests/get-ai-usage.test.sh | grep claude
   ```

### Formatting & Rendering

1. **Measurement before color** — In `render.py`, column widths are measured on plain text first. ANSI color codes are applied last so they never shift alignment.

2. **Time in milliseconds (FE), epoch seconds (BE)** — QML uses `Date.now()` (milliseconds). The Python contract uses epoch seconds (Unix timestamps). Converters like `countdownFromEpoch()` in Format.js handle the difference.

3. **Spark-line trend** — The panel indicator shows a mini chart of recent usage. The data comes from `historyValues` and is rendered inline in QML or as a text-based bar in the terminal.

### File Organization

- **Provider-specific files** — One file per service in both `providers/` and `normalize/`. Don't mix two providers in one file.
- **Shared utilities** — Put generic quota math in `contract.py`, not in a provider module.
- **Icon assets** — All provider icons live under `package/contents/icons/`. The icon name is listed in `contract.py` / `PROVIDER_ICONS` so all three frontends can resolve it.

### Development Environment

Use `nix develop` to get:
- Python 3.9+ with ruff (linter/formatter)
- Node.js (for JS tests)
- plasmoidviewer (to preview the Plasma widget)
- jq (for contract test assertions)

Without Nix, you need ruff installed to run `make lint-py`; tests run on any POSIX shell + Node.

### Version Bumping

Run `make tag` to:
- Prompt for a new semantic version
- Update `package/metadata.json`
- Commit and tag the release
- Push to GitHub

The plasmoid `.plasmoid` archive is built via `make pack` and uploaded to the KDE Store and GitHub Releases.
