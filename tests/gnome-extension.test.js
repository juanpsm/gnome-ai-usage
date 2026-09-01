import test from 'node:test';
import assert from 'node:assert/strict';
import {formatReset, meterClass, providerPercent, PROVIDER_USAGE_URLS, PROVIDER_KEY_HELP_URLS} from '../gnome-extension/utils.js';

// gnome-extension/utils.js is plain ESM with no GJS-specific imports, unlike
// package/contents/code/Format.js and UsageHistory.js (which stay dual
// CommonJS/GJS-loadable for the Quickshell side) — see tests/shared-code.test.js
// for those. This only covers what the GNOME extension actually uses.

const PROVIDERS = ['claude', 'antigravity', 'openai', 'kiro', 'mistral', 'openrouter', 'grok', 'zai', 'copilot', 'deepseek', 'kimi'];

test('formats a countdown with days, hours or minutes', () => {
    const now = 1785000000;
    assert.equal(formatReset(now + 3 * 3600, now).relative, 'Faltan 3 h');
    assert.equal(formatReset(now + 45 * 60, now).relative, 'Faltan 45 min');
    assert.equal(formatReset(0, now).relative, 'Sin fecha de reset');
});

test('classifies meter color by percentage threshold', () => {
    assert.equal(meterClass(50), '');
    assert.equal(meterClass(70), 'warning');
    assert.equal(meterClass(90), 'danger');
});

test('picks the highest available quota window, or the summary pct with none', () => {
    assert.equal(providerPercent({quotaWindows: [{pct: 10}, {pct: 40, available: false}, {pct: 25}]}), 25);
    assert.equal(providerPercent({quotaWindows: [], summary: {pct: 7}}), 7);
    assert.equal(providerPercent({}), 0);
});

test('every known provider has a deliberate usage-URL and key-help entry', () => {
    // antigravity/kiro have no web usage page (IDE-only) — deliberate skip.
    const usageUrlSkips = new Set(['antigravity', 'kiro']);
    // claude/antigravity/kiro need no pasted key — deliberate skip.
    const keyHelpSkips = new Set(['claude', 'antigravity', 'kiro']);

    for (const id of PROVIDERS) {
        if (!usageUrlSkips.has(id))
            assert.match(PROVIDER_USAGE_URLS[id] || '', /^https:\/\//, `${id} should have a usage URL`);
        if (!keyHelpSkips.has(id))
            assert.match(PROVIDER_KEY_HELP_URLS[id] || '', /^https:\/\//, `${id} should have a key-help URL`);
    }
});
