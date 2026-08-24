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

// Where clicking a provider's row should send you. Best-effort — some of
// these are guesses at the current URL for that provider's usage page and
// may need correcting as providers redesign their sites.
export const PROVIDER_USAGE_URLS = {
    claude: 'https://claude.ai/settings/usage',
    openai: 'https://platform.openai.com/usage',
    antigravity: 'https://aistudio.google.com/usage',
    copilot: 'https://github.com/settings/billing/summary',
    mistral: 'https://console.mistral.ai/usage',
    openrouter: 'https://openrouter.ai/activity',
    deepseek: 'https://platform.deepseek.com/usage',
    kimi: 'https://platform.moonshot.ai/console/account',
    grok: 'https://console.x.ai',
    zai: 'https://z.ai/manage-apikey/apikey-list',
    // kiro: no web usage page — it's a local desktop IDE state snapshot.
};

// Where to get an API key for each provider that needs one pasted into
// settings. Same best-effort caveat as PROVIDER_USAGE_URLS.
export const PROVIDER_KEY_HELP_URLS = {
    openai: 'https://platform.openai.com/api-keys',
    mistral: 'https://console.mistral.ai/api-keys',
    openrouter: 'https://openrouter.ai/keys',
    grok: 'https://console.x.ai',
    zai: 'https://z.ai/manage-apikey/apikey-list',
    copilot: 'https://github.com/settings/personal-access-tokens/new',
    deepseek: 'https://platform.deepseek.com/api_keys',
    kimi: 'https://platform.moonshot.ai/console/api-keys',
    // claude, antigravity, kiro: no pasted key — nothing to link here.
};
