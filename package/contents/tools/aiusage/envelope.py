"""Envelope assembly — fetch a set of providers, wrap them in the outer object.

Split out of __main__ so that every in-process consumer builds the identical
envelope: the JSON backend the QML frontends call, and the terminal frontend in
aiusage.cli. See docs/provider-contract.md for the shape produced here.
"""

import time
from concurrent.futures import ThreadPoolExecutor

from . import config
from .collect import collect
from .contract import SCHEMA_VERSION
from .normalize import normalize


def enabled(cfg):
    """Provider ids switched on in the shared settings file, in contract order."""
    return [id_ for id_ in config.ALL_PROVIDERS if config.provider_enabled(cfg, id_)]


def build(selected, now=None):
    """Fetch every id in `selected` concurrently and return a full envelope."""
    if now is None:
        now = time.time()

    def fetch_one(id_):
        try:
            return normalize(collect(id_, now))
        except Exception as exc:  # noqa: BLE001 - one provider's bug must not take down the rest
            return {
                "id": id_,
                "label": id_,
                "accent": "#888888",
                "icon": "",
                "ok": False,
                "stale": True,
                "error": str(exc),
                "updatedAt": int(now),
                "summary": {"pct": 0, "text": "unavailable", "detail": str(exc), "hasChart": False},
                "quotaWindows": [],
                "chartWindows": [],
                "slots": [],
                "historyValues": {},
                "details": {},
            }

    if selected:
        with ThreadPoolExecutor(max_workers=len(selected)) as pool:
            providers = list(pool.map(fetch_one, selected))
    else:
        providers = []

    # `active` is the first healthy provider; frontends fall back to it when the
    # tab they remembered is gone.
    active = ""
    for p in providers:
        if p.get("ok") is True:
            active = p.get("id") or ""
            break
    else:
        if providers:
            active = providers[0].get("id") or ""

    return {"schemaVersion": SCHEMA_VERSION, "updatedAt": int(now), "active": active, "providers": providers}
