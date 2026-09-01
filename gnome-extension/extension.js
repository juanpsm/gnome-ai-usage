import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {formatReset, meterClass, providerPercent} from './utils.js';

const PROVIDERS = ['claude', 'antigravity', 'openai', 'kiro', 'mistral', 'openrouter', 'grok', 'zai', 'copilot', 'deepseek', 'kimi'];

const METER_COLORS = {
    '': [0.384, 0.627, 0.918],
    warning: [0.898, 0.647, 0.039],
    danger: [0.929, 0.2, 0.231],
};

// St exposes no level-bar widget, so the meter is drawn by hand on a Cairo
// surface, mirroring the legacy variant.
function paintMeter(area, pct) {
    const [width, height] = area.get_surface_size();
    const cr = area.get_context();
    cr.setSourceRGBA(1, 1, 1, 0.18);
    cr.rectangle(0, 0, width, height);
    cr.fill();

    const fillWidth = width * Math.max(0, Math.min(100, pct)) / 100;
    if (fillWidth > 0) {
        const color = METER_COLORS[meterClass(pct)];
        cr.setSourceRGB(color[0], color[1], color[2]);
        cr.rectangle(0, 0, fillWidth, height);
        cr.fill();
    }
    cr.$dispose();
}

const UsageMeter = GObject.registerClass(class UsageMeter extends St.Widget {
    _init(window) {
        super._init({layout_manager: new Clutter.BoxLayout({orientation: Clutter.Orientation.VERTICAL})});
        const header = new St.BoxLayout({style_class: 'ai-usage-menu-item'});
        header.add_child(new St.Label({text: window.label || window.key, x_expand: true, style_class: 'ai-usage-window-label'}));
        header.add_child(new St.Label({text: `${Math.round(window.pct || 0)}%`, style_class: 'ai-usage-window-value'}));
        this.add_child(header);

        const pct = window.pct || 0;
        const meter = new St.DrawingArea({style_class: 'ai-usage-meter', x_expand: true});
        meter.connect('repaint', area => paintMeter(area, pct));
        this.add_child(meter);
        const reset = formatReset(window.resetAt);
        this.add_child(new St.Label({text: `${reset.relative}${reset.absolute ? ` · ${reset.absolute}` : ''}`, style_class: 'ai-usage-reset'}));
    }
});

const ProviderItem = GObject.registerClass(class ProviderItem extends PopupMenu.PopupBaseMenuItem {
    _init(provider) {
        super._init({reactive: false, can_focus: false, style_class: 'ai-usage-provider'});
        const box = new St.BoxLayout({vertical: true, x_expand: true});
        const header = new St.BoxLayout({x_expand: true});
        header.add_child(new St.Label({text: provider.label || provider.id, x_expand: true, style_class: 'ai-usage-provider-name'}));
        header.add_child(new St.Label({text: provider.ok ? 'Conectado' : (provider.error || 'No disponible'), style_class: 'ai-usage-status'}));
        box.add_child(header);

        const windows = provider.quotaWindows || [];
        if (windows.length) {
            for (const window of windows)
                box.add_child(new UsageMeter(window));
        } else {
            box.add_child(new St.Label({text: provider.error || 'Sin datos de cuota', style_class: 'ai-usage-status'}));
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
        const refresh = new PopupMenu.PopupMenuItem('Actualizar');
        refresh.connect('activate', () => this._refresh());
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addMenuItem(refresh);
    }

    _renderError(message) {
        this._indicatorLabel.text = 'AI —';
        this._indicator.menu.removeAll();
        this._indicator.menu.addMenuItem(new PopupMenu.PopupMenuItem(`No se pudo actualizar: ${message}`));
    }
}
