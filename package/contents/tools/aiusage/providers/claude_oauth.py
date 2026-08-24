"""Refreshes an expired Claude Code OAuth access token using its refresh
token, without ever touching ~/.claude/.credentials.json — that file is
written by the `claude` CLI itself (see the comment in collect.py), so a
refreshed token is cached separately under this project's own cache dir
instead, and re-used until it too expires.

The client id below is not officially documented by Anthropic — it is the
value the open-source community has reverse-engineered for the Claude Code
CLI's own OAuth app. If it turns out to be wrong, or the token endpoint
shape has changed, refresh simply fails closed (falls back to whatever the
caller already had); nothing on disk is corrupted either way.
"""

import json
import os

from .. import config
from ..http import as_json, post_json

TOKEN_URL = "https://console.anthropic.com/v1/oauth/token"
CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
EXPIRY_BUFFER_MS = 60_000


def _cache_path():
    return os.path.join(config.cache_dir(), "claude-oauth-refresh.json")


def _read_cache():
    path = _cache_path()
    if not os.path.isfile(path):
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _write_cache(access_token, expires_at_ms):
    try:
        os.makedirs(config.cache_dir(), exist_ok=True)
        with open(_cache_path(), "w") as f:
            json.dump({"accessToken": access_token, "expiresAt": expires_at_ms}, f)
    except OSError:
        pass


def _is_valid(token, expires_at, now_ms):
    return bool(token) and isinstance(expires_at, (int, float)) and expires_at - EXPIRY_BUFFER_MS > now_ms


def refresh(refresh_token, now_ms):
    """POSTs a refresh_token grant and caches the result. Returns the new
    access token, or None on any failure (network, bad shape, wrong client
    id, ...) — the caller keeps using whatever token it already had."""
    if not refresh_token:
        return None
    body = json.dumps({"grant_type": "refresh_token", "refresh_token": refresh_token, "client_id": CLIENT_ID}).encode()
    result = post_json(
        TOKEN_URL,
        headers={"Content-Type": "application/json"},
        body=body,
        timeout=10,
        fixture_path=os.environ.get("CLAUDE_OAUTH_REFRESH_RESPONSE_FILE"),
    )
    if result.status != 200:
        return None
    data = as_json(result.body)
    if not isinstance(data, dict):
        return None
    access_token = data.get("access_token")
    expires_in = data.get("expires_in")
    if not access_token or not isinstance(expires_in, (int, float)):
        return None
    _write_cache(access_token, now_ms + int(expires_in) * 1000)
    return access_token


def get_access_token(oauth, now_ms):
    """Picks the best access token available for `oauth` (the
    `claudeAiOauth` dict from ~/.claude/.credentials.json): the file's own
    token if it's not near expiry, else a still-valid cached refresh, else a
    freshly refreshed one. Returns "" if nothing usable is available."""
    file_token = str(oauth.get("accessToken") or "")
    if _is_valid(file_token, oauth.get("expiresAt"), now_ms):
        return file_token

    cached = _read_cache()
    if cached and _is_valid(cached.get("accessToken"), cached.get("expiresAt"), now_ms):
        return cached["accessToken"]

    refreshed = refresh(str(oauth.get("refreshToken") or ""), now_ms)
    if refreshed:
        return refreshed

    # Nothing valid to refresh with, or the refresh attempt failed — fall
    # back to the file's token even if it looks expired, so the caller still
    # gets today's honest "token expired" if that's genuinely the case.
    return file_token
