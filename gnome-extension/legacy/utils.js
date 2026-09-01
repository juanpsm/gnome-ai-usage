/* exported formatReset, meterClass, providerPercent, PROVIDER_USAGE_URLS, PROVIDER_KEY_HELP_URLS */

var formatReset = function (resetAt, now) {
    now = now || Math.floor(Date.now() / 1000);
    if (!resetAt || resetAt <= 0)
        return {relative: 'Sin fecha de reset', absolute: ''};

    var seconds = Math.max(0, resetAt - now);
    var days = Math.floor(seconds / 86400);
    var hours = Math.floor((seconds % 86400) / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    var parts = [];
    if (days)
        parts.push(days + ' d');
    if (hours || days)
        parts.push(hours + ' h');
    if (!days && !hours)
        parts.push(minutes + ' min');

    var date = new Date(resetAt * 1000);
    var absolute = new Intl.DateTimeFormat(undefined, {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
    }).format(date);
    return {relative: 'Faltan ' + parts.join(' '), absolute: 'Reinicia ' + absolute};
};

var meterClass = function (pct) {
    if (pct >= 90)
        return 'danger';
    if (pct >= 70)
        return 'warning';
    return '';
};

var providerPercent = function (provider) {
    var windows = (provider && provider.quotaWindows || []).filter(function (window) {
        return window.available !== false;
    });
    if (!windows.length)
        return Number(provider && provider.summary && provider.summary.pct || 0);
    return Math.max.apply(null, windows.map(function (window) {
        return Number(window.pct || 0);
    }));
};

// Where clicking a provider's row should send you. Verified against each
// provider's own docs/pages (not guessed) as of 2026-08 — still worth
// re-checking occasionally, since these sites redesign.
var PROVIDER_USAGE_URLS = {
    claude: 'https://claude.ai/settings/usage',
    openai: 'https://platform.openai.com/settings/organization/usage',
    copilot: 'https://github.com/settings/billing',
    mistral: 'https://console.mistral.ai',
    openrouter: 'https://openrouter.ai/activity',
    deepseek: 'https://platform.deepseek.com/usage',
    // moonshot.ai's website redirects to kimi.ai now; the API (api.moonshot.ai)
    // that get-antigravity-usage/moonshot.py actually calls hasn't moved.
    kimi: 'https://platform.kimi.ai/console/account',
    grok: 'https://console.x.ai',
    zai: 'https://z.ai/manage-apikey/apikey-list',
    // antigravity: no web usage page — it's shown inside the IDE itself
    // (Settings > Advanced Settings > Models).
    // kiro: no web usage page either — it's a local desktop IDE state snapshot.
};

// Where to get an API key for each provider that needs one pasted into
// settings. Same verified-as-of-2026-08 caveat as PROVIDER_USAGE_URLS.
var PROVIDER_KEY_HELP_URLS = {
    openai: 'https://platform.openai.com/settings/organization/api-keys',
    mistral: 'https://console.mistral.ai/home?workspace_dialog=apiKeys',
    openrouter: 'https://openrouter.ai/settings/keys',
    grok: 'https://console.x.ai/team/default/api-keys',
    zai: 'https://z.ai/manage-apikey/apikey-list',
    copilot: 'https://github.com/settings/personal-access-tokens/new',
    deepseek: 'https://platform.deepseek.com/api_keys',
    kimi: 'https://platform.kimi.ai/console/api-keys',
    // claude, antigravity, kiro: no pasted key — nothing to link here.
};
