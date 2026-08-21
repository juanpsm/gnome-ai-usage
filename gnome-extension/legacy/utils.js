/* exported formatReset, meterClass, providerPercent */

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
