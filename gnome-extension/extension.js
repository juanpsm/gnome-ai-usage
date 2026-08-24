import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {formatReset, meterClass, providerPercent, PROVIDER_USAGE_URLS} from './utils.js';

const PROVIDERS = ['claude', 'antigravity', 'openai', 'kiro', 'mistral', 'openrouter', 'grok', 'zai', 'copilot', 'deepseek', 'kimi'];

function statusDotClass(provider) {
    if (!provider.ok)
        return 'ai-usage-status-dot-error';
    if (provider.stale)
        return 'ai-usage-status-dot-stale';
    return 'ai-usage-status-dot';
}

// OpenRouter reports spend as details.usageUSD; Claude/OpenAI report it as
// details.organizationUsage.totalCostUSD — same aggregate-cost idea, two
// different contract shapes (see docs/provider-contract.md).
function providerCostUSD(provider) {
    if (!provider.ok)
        return 0;
    if (provider.id === 'openrouter')
        return Number(provider.details?.usageUSD || 0);
    return Number(provider.details?.organizationUsage?.totalCostUSD || 0);
}

const UsageMeter = GObject.registerClass(class UsageMeter extends St.Widget {
    _init(window) {
        super._init({layout_manager: new Clutter.BoxLayout({orientation: Clutter.Orientation.VERTICAL})});
        
        // Header: Label + Percentage with better spacing
        const header = new St.BoxLayout({style_class: 'ai-usage-menu-item', x_expand: true});
        header.add_child(new St.Label({text: window.label || window.key, x_expand: true, style_class: 'ai-usage-window-label'}));
        const pctLabel = new St.Label({text: `${Math.round(window.pct || 0)}%`, style_class: 'ai-usage-window-value'});
        header.add_child(pctLabel);
        this.add_child(header);

        // Progress bar with improved styling
        const meter = new St.LevelBar({value: Math.max(0, Math.min(1, (window.pct || 0) / 100)), style_class: `ai-usage-meter ${meterClass(window.pct || 0)}`});
        this.add_child(meter);
        
        // Reset countdown with better formatting
        const reset = formatReset(window.resetAt);
        const resetLabel = new St.Label({text: `${reset.relative}${reset.absolute ? ` · ${reset.absolute}` : ''}`, style_class: 'ai-usage-reset'});
        this.add_child(resetLabel);
    }
});

const ProviderItem = GObject.registerClass(class ProviderItem extends PopupMenu.PopupBaseMenuItem {
    _init(provider) {
        const usageUrl = PROVIDER_USAGE_URLS[provider.id];
        const styleClass = usageUrl ? 'ai-usage-provider ai-usage-provider-clickable' : 'ai-usage-provider';
        super._init({reactive: !!usageUrl, can_focus: !!usageUrl, style_class: styleClass});
        if (usageUrl)
            this.connect('activate', () => Gio.AppInfo.launch_default_for_uri(usageUrl, null));

        const box = new St.BoxLayout({vertical: true, x_expand: true});

        // Provider header with better styling and hierarchy
        const header = new St.BoxLayout({x_expand: true, style_class: 'ai-usage-provider-header'});
        const nameLabel = new St.Label({text: provider.label || provider.id, x_expand: true, style_class: 'ai-usage-provider-name'});
        header.add_child(nameLabel);
        header.add_child(new St.Widget({style_class: statusDotClass(provider), y_align: Clutter.ActorAlign.CENTER}));
        box.add_child(header);

        // Quota windows with better spacing
        const windows = provider.quotaWindows || [];
        if (windows.length) {
            for (const window of windows)
                box.add_child(new UsageMeter(window));
        } else {
            const emptyLabel = new St.Label({text: provider.error || 'Sin datos de cuota', style_class: 'ai-usage-status'});
            box.add_child(emptyLabel);
        }

        // Per-model cost breakdown, when the backend has priced any models
        // for this provider (currently Claude and OpenAI).
        const models = provider.details?.organizationUsage?.models;
        if (models && typeof models === 'object') {
            const priced = Object.entries(models)
                .filter(([, m]) => m?.priced && Number(m.cost_usd) > 0)
                .sort(([, a], [, b]) => Number(b.cost_usd) - Number(a.cost_usd));
            for (const [name, m] of priced)
                box.add_child(new St.Label({text: `${name} — $${Number(m.cost_usd).toFixed(2)}`, style_class: 'ai-usage-model-row'}));
        }
        this.add_child(box);
    }
});

export default class AiUsageExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._providers = [];
        this._settingsChangedId = this._settings.connect('changed::enabled-providers', () => this._refresh());
        this._indicatorModeChangedId = this._settings.connect('changed::indicator-mode', () => this._render(this._lastEnvelope));
        this._indicator = new PanelMenu.Button(0.0, 'AI Usage', false);
        this._indicatorLabel = new St.Label({text: 'AI —', y_align: Clutter.ActorAlign.CENTER});
        this._indicator.add_child(this._indicatorLabel);
        this._indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open && !this._providers.length)
                this._refresh();
        });
        this._refreshId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._settings.get_uint('refresh-interval'), () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
        Main.panel.addToStatusArea('ai-usage', this._indicator);
        this._refresh();
    }

    disable() {
        if (this._refreshId)
            GLib.Source.remove(this._refreshId);
        this._refreshId = 0;
        if (this._settingsChangedId)
            this._settings.disconnect(this._settingsChangedId);
        if (this._indicatorModeChangedId)
            this._settings.disconnect(this._indicatorModeChangedId);
        this._indicator?.destroy();
        this._indicator = null;
    }

    _refresh() {
        const backend = Gio.File.new_for_path(`${this.path}/backend/sh/get-ai-usage`);
        const enabled = this._settings.get_strv('enabled-providers').filter(id => PROVIDERS.includes(id));
        if (!enabled.length) {
            this._render({providers: []});
            return;
        }
        let proc;
        try {
            const launcher = Gio.SubprocessLauncher.new(Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            
            launcher.setenv('WIDGET_CLAUDE_ADMIN_KEY', this._settings.get_string('claude-admin-api-key'), true);
            launcher.setenv('WIDGET_OPENAI_API_KEY', this._settings.get_string('openai-api-key'), true);
            launcher.setenv('WIDGET_MISTRAL_API_KEY', this._settings.get_string('mistral-api-key'), true);
            launcher.setenv('WIDGET_OPENROUTER_API_KEY', this._settings.get_string('openrouter-api-key'), true);
            launcher.setenv('WIDGET_GROK_API_KEY', this._settings.get_string('grok-api-key'), true);
            launcher.setenv('WIDGET_ZAI_TOKEN', this._settings.get_string('zai-token'), true);
            launcher.setenv('WIDGET_GITHUB_TOKEN', this._settings.get_string('github-token'), true);
            launcher.setenv('WIDGET_DEEPSEEK_API_KEY', this._settings.get_string('deepseek-api-key'), true);
            launcher.setenv('WIDGET_MOONSHOT_API_KEY', this._settings.get_string('moonshot-api-key'), true);
            launcher.setenv('WIDGET_COPILOT_QUOTA', String(this._settings.get_int('copilot-quota')), true);

            const pythonPath = this._settings.get_string('python-path').trim();
            if (pythonPath)
                launcher.setenv('PYTHON3', pythonPath, true);

            proc = launcher.spawnv([backend.get_path(), '--provider', enabled.join(',')]);
        } catch (error) {
            this._renderError(error.message);
            return;
        }
        proc.communicate_utf8_async(null, null, (_proc, result) => {
            try {
                const [, stdout, stderr] = proc.communicate_utf8_finish(result);
                const envelope = stdout ? JSON.parse(stdout) : null;
                if (!envelope)
                    throw new Error(stderr ? stderr.trim() : 'respuesta vacía del backend');
                this._render(envelope);
            } catch (error) {
                this._renderError(error.message);
            }
        });
    }

    _render(envelope) {
        if (!envelope)
            return;
        this._lastEnvelope = envelope;
        this._providers = envelope.providers || [];
        const mode = this._settings.get_string('indicator-mode');
        const selected = mode === 'aggregate' ? null : this._providers.find(provider => provider.id === mode);
        const value = selected ? providerPercent(selected) : Math.max(0, ...this._providers.map(providerPercent));
        this._indicatorLabel.text = `${selected?.label || 'AI'} ${Math.round(value)}%`;
        this._indicator.menu.removeAll();
        for (const provider of this._providers)
            this._indicator.menu.addMenuItem(new ProviderItem(provider));
        const totalCost = this._providers.reduce((sum, p) => sum + providerCostUSD(p), 0);
        if (totalCost > 0)
            this._indicator.menu.addMenuItem(this._buildCostFooter(totalCost));
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addMenuItem(this._buildToolbar());
    }

    _buildCostFooter(totalCost) {
        const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false, style_class: 'ai-usage-cost-footer-item'});
        item.add_child(new St.Label({text: `Total: $${totalCost.toFixed(2)}`, style_class: 'ai-usage-cost-footer', x_expand: true}));
        return item;
    }

    _buildToolbar() {
        const row = new St.BoxLayout({style_class: 'ai-usage-toolbar', x_expand: true});
        row.add_child(new St.Widget({x_expand: true}));
        row.add_child(this._makeIconButton('view-refresh-symbolic', () => this._refresh()));
        row.add_child(this._makeIconButton('preferences-system-symbolic', () => this.openPreferences()));

        const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false, style_class: 'ai-usage-toolbar-item'});
        item.add_child(row);
        return item;
    }

    _makeIconButton(iconName, onClick) {
        const button = new St.Button({
            style_class: 'ai-usage-icon-button',
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            child: new St.Icon({icon_name: iconName, icon_size: 16}),
        });
        button.connect('clicked', onClick);
        return button;
    }

    _renderError(message) {
        this._indicatorLabel.text = 'AI —';
        this._indicator.menu.removeAll();
        this._indicator.menu.addMenuItem(new PopupMenu.PopupMenuItem(`No se pudo actualizar: ${message}`));
    }
}
