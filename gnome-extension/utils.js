export function formatReset(resetAt, now = Math.floor(Date.now() / 1000)) {
    if (!resetAt || resetAt <= 0)
        return {relative: 'Sin fecha de reset', absolute: ''};

    const seconds = Math.max(0, resetAt - now);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (days)
        parts.push(`${days} d`);
    if (hours || days)
        parts.push(`${hours} h`);
    if (!days && !hours)
        parts.push(`${minutes} min`);

    const date = new Date(resetAt * 1000);
    const absolute = new Intl.DateTimeFormat(undefined, {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
    }).format(date);
    return {relative: `Faltan ${parts.join(' ')}`, absolute: `Reinicia ${absolute}`};
}

export function meterClass(pct) {
    if (pct >= 90)
        return 'danger';
    if (pct >= 70)
        return 'warning';
    return '';
}

export function providerPercent(provider) {
    const windows = (provider?.quotaWindows || []).filter(w => w.available !== false);
    if (!windows.length)
        return Number(provider?.summary?.pct || 0);
    return Math.max(...windows.map(w => Number(w.pct || 0)));
}
