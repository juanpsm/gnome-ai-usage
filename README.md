<p align="center">
  <img src="./readme/icon.svg?v=7" width="120" alt="AI Usage logo">
</p>

<h1 align="center">AI Usage</h1>

<p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License: MIT" />
  </a>
</p>

A GNOME Shell extension to see at a glance how much usage quota you have left
across several AI services (Claude, OpenAI/Codex, GitHub Copilot,
Antigravity, etc.), without opening each site.

This project is a fork of another one for KDE Plasma (see
[Credits](#credits)).

---

## GNOME Shell extension

Lives in [`gnome-extension/`](gnome-extension/). It's the only part of this
repo we actively use and test. What it does today, verified:

- A panel indicator with the usage percentage, and a popover with one row
  per enabled provider.
- A status dot per row: green (ok), red (error), or amber (the last refresh
  failed but cached data is still shown).
- A meter per quota window (percentage, time remaining, exact reset date).
- Clicking a row opens that provider's usage page in the browser (the URLs
  are checked against each provider's real docs, not guessed).
- Preferences (gear button at the bottom of the popover, or
  `gnome-extensions prefs ai-usage@juanpsm`): enable/disable each provider,
  enter credentials with a link to where to get each one, refresh interval,
  GitHub Copilot quota, Python path, and which provider to show in the panel
  indicator.
- Per-model cost breakdown and an aggregate total, which only shows up if
  you configure a key with admin/organization permissions (Claude Admin API
  Key, OpenAI organization API Key). Without that, there's simply no data to
  show; it's not a bug.
- Claude's OAuth token refreshes itself before it expires, instead of
  showing "token expired" until you open the Claude CLI again.

What it doesn't have yet: usage history chart, burn-rate, comparison against
the previous period, spark-lines, theme accent color, or provider pinning.
Those are features of the Quickshell/Hyprland panel (see below) that haven't
been ported to GNOME.

Requirements: GNOME Shell 42+, GJS, GLib schemas, and Python 3.8+. Install
from this checkout with:

```bash
make gnome-install
```

Then enable **AI Usage** from GNOME Extensions.

You can also build an installable `.shell-extension.zip` (one per variant,
modern and legacy) without cloning the repo every time:

```bash
make gnome-pack
```

See [`gnome-extension/PUBLISHING.md`](gnome-extension/PUBLISHING.md) for
what each archive includes and the checklist for uploading to
extensions.gnome.org.

---

## Quickshell / Hyprland

[`hyprland/`](hyprland/) carries the Quickshell panel inherited from the
original project, with more features than the GNOME extension on paper
(history chart, burn-rate, period comparison, spark-lines, history
export/import, accent colors). We don't actively use or test this in this
fork: the code is still there and should work, but we can't guarantee
everything the original project promises still holds up as-is. If you try
it and find something broken, let us know.

```bash
nix run .#hyprland
```

---

## Terminal

`ai-usage-cli` prints the same data as a table, with no need for GNOME
Shell or Quickshell: it's for other desktops, over SSH, or in a status bar.
This one does have tests (`tests/ai-usage-cli.test.sh`).

```bash
export PATH="$PWD/package/contents/tools/sh:$PATH"
ai-usage-cli                        # every enabled provider
ai-usage-cli --compact              # one line, for status bars
ai-usage-cli --provider claude,zai  # a specific subset
```

```
PROVIDER  PLAN          WINDOW             USAGE                NOTE                      RESET
────────────────────────────────────────────────────────────────────────────────────────────────────────
Claude    max           5-hour session     [██░░░░░░░░]  23%    120000 / 500000 tokens    Jul 19, 17:00
Claude    max           7-day window       [██████░░░░]  61%    3000000 / 5000000 tokens  Jul 25, 17:00
────────────────────────────────────────────────────────────────────────────────────────────────────────
Copilot   —             —                  Copilot: no token configured
```

Without a graphical frontend running, configuration is written by hand at
`~/.config/ai-usage-widget/hyprland-settings.json` (or under
`$XDG_CONFIG_HOME`; `AI_USAGE_CONFIG` changes the path). See
[Supported services](#supported-services) for what each one needs.

---

## Supported services

This table is the one the original project already had: it describes what
each API exposes, not how well-tested it is in this specific fork.

| Service | What it shows | Status |
|---|---|---|
| Claude (Anthropic) | Subscription windows, reset times, local activity stats | Supported |
| Antigravity / Google AI Studio | Overall quota, per-model Gemini usage, reset times | Supported |
| OpenAI | 30-day API token/cost usage + Codex/ChatGPT plan limits and account status | Supported |
| Grok (xAI) | CLI billing credits, free-tier exhaustion, local session totals | Free tier tested; paid plans unverified |
| Kiro | Monthly credits, remaining balance, reset date, overage, inferred plan | Supported |
| Mistral AI | Key status, available models, local vibe CLI cost/token stats | Supported |
| OpenRouter | Spend, credit limit, usage percentage, account label | Untested |
| Z.AI | 5-hour token quota, monthly tools quota, reset countdowns, per-model detail | Untested |
| GitHub Copilot | Monthly premium request usage against a configurable quota | Personal billing supported; org/enterprise not yet |
| DeepSeek | Available balance with granted/topped-up breakdown | Untested |
| Kimi / Moonshot AI | Available balance with voucher/cash breakdown | Untested |

Provider APIs don't all expose the same thing: Codex/ChatGPT limits are
independent from OpenAI API usage, DeepSeek reports a balance instead of a
usage window, and Grok's free tier doesn't expose progressive usage before
it's exhausted. See [How it works](#how-it-works) for the detail on each
provider.

---

## Requirements

| Dependency | Notes |
|---|---|
| Python 3.8+ | Runs the shared backend (standard library only, no `pip install`). Auto-detected as `python3`, a suffixed version, or bare `python`. To pin a specific interpreter, export `$PYTHON3` or set it in the extension's preferences |

Enable only the services you use. Each one needs its own thing:

| Service | What you need |
|---|---|
| Claude | Claude Code, signed in locally |
| Antigravity | Node.js 18+, the `antigravity-usage` CLI with `antigravity-usage login`, or the Antigravity IDE open |
| OpenAI | An OpenAI API key for organization usage; a Codex CLI session gives Codex/ChatGPT plan limits |
| Grok | Grok CLI authenticated with `grok --oauth`; an xAI API key is optional |
| Kiro | The Kiro IDE, signed in at least once |
| Mistral AI | A Mistral API key; vibe CLI is optional and adds local session stats |
| OpenRouter | An OpenRouter API key entered in preferences |
| Z.AI | A Z.AI token in preferences, `$ZAI_TOKEN`, or `~/.config/zai/token` |
| GitHub Copilot | A GitHub token in preferences, `$GITHUB_TOKEN`, or `~/.config/github-copilot/token`, with fine-grained **Plan: read** permission; personal billing only |
| DeepSeek | A DeepSeek API key in preferences, `$DEEPSEEK_API_KEY`, or `~/.config/deepseek/api-key` |
| Kimi / Moonshot AI | A Moonshot API key in preferences, `$MOONSHOT_API_KEY`, `$KIMI_API_KEY`, or `~/.config/moonshot/api-key` |

---

## How it works

### Shared backend

All three ways of using this (the GNOME extension, the Quickshell/Hyprland
panel, and the terminal) get all their data from one executable,
`package/contents/tools/sh/get-ai-usage`. It handles credential resolution,
hitting each provider's API, parsing the response, computing percentages
and reset times, and returns a versioned, frontend-neutral JSON:

```bash
get-ai-usage --provider claude   # one specific provider
get-ai-usage --all               # every enabled one
```

The backend is a Python package with no external dependencies
(`package/contents/tools/aiusage`); `get-ai-usage` is a bash launcher that
runs it. Normalization is pure (no side effects), so `get-ai-usage
--normalize` can replay a recorded response without touching the network;
that's how the tests run. The full schema is documented in
[`docs/provider-contract.md`](docs/provider-contract.md).

No frontend makes network requests, parses a raw response, or computes a
percentage: all of that lives in the backend. The GNOME extension is
written in plain GJS (no QML); Quickshell uses QML and shares
time/history-formatting logic via `package/contents/code/` (`Format.js`,
`UsageHistory.js`).

### Claude
On every refresh, the backend reads `~/.claude/.credentials.json` for the
OAuth token and calls Anthropic's subscription usage endpoint. If the token
is about to expire, it refreshes it using the refresh token without
touching that file (which belongs to the `claude` CLI), and caches the
result separately. The refresh endpoint and client id aren't officially
documented by Anthropic (they're known from community reverse engineering);
if anything fails, the behavior is just the usual error message, nothing
gets corrupted.

### Antigravity
Reads credentials from the `antigravity-usage` CLI config (in
`~/.config/antigravity-usage/`), or otherwise probes directly against a
locally running Antigravity IDE process. Either way it ends up calling the
Google Cloud Code API for per-model quota.

### OpenAI
Two independent parts: organization API usage (last 30 days, needs an API
key), and Codex/ChatGPT plan limits (via Codex's local app-server, with an
authenticated web fallback).

### Grok *(free tier tested; paid plans unverified)*
Reads the Grok CLI session from `~/.grok/auth.json` and summarizes local
sessions from `~/.grok/sessions`. On the free tier, the CLI only reports the
exact exhausted amount after the quota runs out, so progressive usage can't
be shown before that.

### Kiro
Reads the usage state Kiro caches locally
(`~/.config/Kiro/User/globalStorage/state.vscdb`). No API key needed.

### Mistral AI
Validates the key against the Mistral API and lists available models.
Mistral exposes no public billing API, so spend comes from local vibe CLI
logs (`~/.vibe/logs/session/*/meta.json`) when it's installed.

### OpenRouter *(untested)*
Fetches spend and credit limit from the OpenRouter API with the configured
key.

### Z.AI *(untested)*
Calls the Z.AI quota endpoint with the configured token.

### GitHub Copilot
Reads monthly premium request usage from GitHub's billing API. Needs a
fine-grained token with **Plan: read** permission. Only covers personal
billing, not organization/enterprise yet.

### DeepSeek *(untested)*
Calls `GET https://api.deepseek.com/user/balance` with the configured key.

### Kimi / Moonshot AI *(untested)*
Calls `GET https://api.moonshot.ai/v1/users/me/balance`. Moonshot's website
now redirects to `platform.kimi.ai`, but this API endpoint hasn't changed.

**Privacy:** credentials you enter stay stored locally in the extension's
configuration (GSettings) and are only sent to the corresponding provider's
endpoint. The JSON any frontend receives never includes the credential
itself, only presence flags (`hasApiKey`, `keyValid`, …); a contract test
verifies this automatically.

---

## Tests

```bash
make test
```

`tests/get-ai-usage.test.sh` replays the fixtures in `tests/fixtures/` in
`--normalize` mode (success, missing credentials, malformed responses,
offline, rate-limited) for every provider, without touching the network.
`tests/ai-usage-cli.test.sh` renders those same fixtures through the
terminal frontend. `tests/gnome-extension.test.js` covers the pure
functions in `gnome-extension/utils.js`. `tests/shared-code.test.js` covers
the JS Quickshell uses (`Format.js`, `UsageHistory.js`).

---

## Credits

This repo is a fork of
[Muddyblack/kde-ai-usage](https://github.com/Muddyblack/kde-ai-usage),
which did all the original work: the Python backend design, the
integration with each provider, and the KDE Plasma widget we started from.
Here we dropped the Plasma widget and built the GNOME Shell extension on
top of that same backend.
