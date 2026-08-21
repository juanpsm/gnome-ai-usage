# GNOME AI Usage Extension Design

## Goal

Provide a GNOME Shell extension based on `Muddyblack/kde-ai-usage` that shows AI quota usage at a glance for Claude, OpenAI/Codex, GitHub Copilot, and Gemini/Antigravity.

The first release is a panel indicator and popover, not a standalone application. The existing Python provider backend remains the source of truth for credential discovery, provider requests, normalization, quota calculations, reset timestamps, history, and stale/error state.

## Architecture

- Fork the upstream repository and preserve the provider-neutral Python backend.
- Add a GNOME Shell extension written in GJS/JavaScript.
- Invoke `package/contents/tools/sh/get-ai-usage --all` with `Gio.Subprocess`.
- Keep credentials in their existing local stores; the extension receives only the normalized JSON model.
- Start with the four selected providers: Claude, OpenAI/Codex, GitHub Copilot, and Gemini/Antigravity.
- Refresh automatically every five minutes by default, with a manual refresh action.
- Store extension preferences in GSettings. Keep usage history compatible with the backend's existing local history format.

The extension owns presentation and shell lifecycle only. It does not contain provider URLs, response parsing, credential handling, percentage arithmetic, or reset-window inference.

## User interface

The panel indicator shows a compact aggregate or pinned-provider percentage and changes color at the existing backend thresholds. Clicking it opens a native GNOME Shell popover.

The popover contains one card per provider. A provider with multiple reported limits renders one row per limit. Each row contains:

- Window name, such as `5 horas` or `7 días`.
- Percentage used.
- A color-coded progress bar.
- Relative time remaining until reset.
- Absolute reset date and time.

Claude therefore displays separate five-hour and seven-day rows. OpenAI/Codex, Copilot, and Gemini/Antigravity display the windows or per-model limits actually reported by the backend. If a provider has no reset timestamp, the card displays `Sin fecha de reset` without inventing one.

The popover actions are `Actualizar`, `Abrir configuración`, and the standard extension/settings entry point. Preferences use GNOME's extension preferences window and cover provider enablement, pinned/aggregate indicator mode, and refresh interval.

## States and privacy

- Missing credentials remain visible with an actionable status instead of disappearing.
- Temporary failures show an inline error and use automatic retry with backend rate-limit information.
- Old data is marked as stale with the last successful update time.
- Offline and malformed responses are represented by the backend contract and rendered without crashing the shell extension.
- Provider tokens never cross the backend/frontend boundary.

## Testing

Reuse the upstream backend fixture suite for provider normalization and CLI output. Add GNOME-side tests or deterministic test helpers for:

- Rendering one provider with multiple windows.
- Rendering percentage, relative reset time, and absolute reset date.
- Missing credentials, offline, stale, and rate-limited states.
- Manual refresh and configured refresh intervals.
- A provider payload that omits reset information.

The extension should be testable without network access by replaying fixture JSON through a small parsing/rendering boundary rather than starting GNOME Shell for every test.

## Packaging and compatibility

Package the extension with a valid `metadata.json`, GSettings schema, preferences entry point, icons, and install instructions. Target the currently supported GNOME Shell release available in the development environment, keeping the extension code free of unnecessary desktop-specific dependencies beyond GJS/GNOME Shell APIs.

