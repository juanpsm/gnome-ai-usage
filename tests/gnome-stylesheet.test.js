import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// GNOME Shell 42+ loads either gnome-shell-light.css or gnome-shell-dark.css
// depending on org.gnome.desktop.interface color-scheme, and popup menus
// follow it (#282828 on light, #ffffff on dark). A stylesheet that hardcodes
// white text therefore renders invisible on a light session — so every
// theme-dependent color must be declared once per scheme, under the
// .ai-usage-light / .ai-usage-dark class the extension puts on the menu.
const SHEETS = ['gnome-extension/stylesheet.css', 'gnome-extension/legacy/stylesheet.css'];

// Fixed brand colors that mean the same thing in both schemes: the status
// dots and the meter fill are accents drawn on their own background.
const SCHEME_INDEPENDENT = /status-dot/;

const THEME_PROPS = ['color', 'background-color'];

function parseRules(css) {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [];
    for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selectors = match[1].split(',').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
        const props = match[2]
            .split(';')
            .map(d => d.split(':')[0].trim())
            .filter(Boolean);
        for (const selector of selectors)
            rules.push({selector, props});
    }
    return rules;
}

function scopeOf(selector) {
    if (selector.includes('.ai-usage-light'))
        return 'light';
    if (selector.includes('.ai-usage-dark'))
        return 'dark';
    return null;
}

for (const sheet of SHEETS) {
    const rules = parseRules(readFileSync(join(root, sheet), 'utf8'));

    test(`${sheet}: every theme-dependent color is scoped to a color scheme`, () => {
        for (const {selector, props} of rules) {
            const themed = props.filter(p => THEME_PROPS.includes(p));
            if (!themed.length || SCHEME_INDEPENDENT.test(selector))
                continue;
            assert.ok(scopeOf(selector),
                `${selector} sets ${themed.join('/')} outside .ai-usage-light/.ai-usage-dark — it will be wrong in one of the two shell themes`);
        }
    });

    test(`${sheet}: light and dark declare the same colors`, () => {
        const byScope = {light: new Set(), dark: new Set()};
        for (const {selector, props} of rules) {
            const scope = scopeOf(selector);
            if (!scope)
                continue;
            const bare = selector.replace(/\.ai-usage-(light|dark)\s*/, '');
            for (const prop of props.filter(p => THEME_PROPS.includes(p)))
                byScope[scope].add(`${bare} { ${prop} }`);
        }
        assert.ok(byScope.light.size > 0, 'no light-scheme colors declared at all');
        assert.deepEqual(
            [...byScope.dark].sort(),
            [...byScope.light].sort(),
            'a color declared for one scheme is missing from the other');
    });
}
