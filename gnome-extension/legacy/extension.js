/* exported init */

var Gio = imports.gi.Gio;
var GLib = imports.gi.GLib;
var GObject = imports.gi.GObject;
var St = imports.gi.St;
var Clutter = imports.gi.Clutter;

var Main = imports.ui.main;
var PanelMenu = imports.ui.panelMenu;
var PopupMenu = imports.ui.popupMenu;
var ExtensionUtils = imports.misc.extensionUtils;
var Me = ExtensionUtils.getCurrentExtension();
var UsageUtils = Me.imports.utils;

var PROVIDERS = ['claude', 'antigravity', 'openai', 'kiro', 'mistral', 'openrouter', 'grok', 'zai', 'copilot', 'deepseek', 'kimi'];

// EGO review guidelines require external processes to be "spawned carefully
// and exit cleanly" — this bounds how long a hung backend can block a refresh.
var REFRESH_TIMEOUT_SECONDS = 30;

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
    var details = provider.details || {};
    if (provider.id === 'openrouter')
        return Number(details.usageUSD || 0);
    return Number((details.organizationUsage && details.organizationUsage.totalCostUSD) || 0);
}

var METER_COLORS = {
    '': [0.384, 0.627, 0.918],
    warning: [0.898, 0.647, 0.039],
    danger: [0.929, 0.2, 0.231],
};

function paintMeter(area, pct) {
    var [width, height] = area.get_surface_size();
    var cr = area.get_context();
    
    var y = height / 2;
    var radius = height / 2;
    
    // Draw background bar with rounded caps
    cr.setLineWidth(height);
    cr.setLineCap(1); // 1 = CAIRO_LINE_CAP_ROUND
    cr.setSourceRGBA(1, 1, 1, 0.18);
    cr.moveTo(radius, y);
    cr.lineTo(width - radius, y);
    cr.stroke();

    // Draw active fill bar with rounded caps
    var fillWidth = (width - 2 * radius) * Math.max(0, Math.min(100, pct)) / 100;
    if (fillWidth > 0) {
        var color = METER_COLORS[UsageUtils.meterClass(pct)];
        cr.setSourceRGB(color[0], color[1], color[2]);
        cr.moveTo(radius, y);
        cr.lineTo(radius + fillWidth, y);
        cr.stroke();
    }
    cr.$dispose();
}

// St.LevelBar does not exist before GNOME Shell 43, so the meter is drawn by
// hand on a Cairo surface to stay compatible with GNOME Shell 42-44.
var UsageMeter = GObject.registerClass(class UsageMeter extends St.Widget {
    _init(window) {
        super._init({layout_manager: new Clutter.BoxLayout({orientation: Clutter.Orientation.VERTICAL})});
        var header = new St.BoxLayout({style_class: 'ai-usage-menu-item'});
        header.add_child(new St.Label({text: window.label || window.key, x_expand: true, style_class: 'ai-usage-window-label'}));
        header.add_child(new St.Label({text: Math.round(window.pct || 0) + '%', style_class: 'ai-usage-window-value'}));
        this.add_child(header);

        var pct = window.pct || 0;
        var meter = new St.DrawingArea({style_class: 'ai-usage-meter', x_expand: true, height: 8});
        meter.connect('repaint', function (area) { paintMeter(area, pct); });
        this.add_child(meter);
        var reset = UsageUtils.formatReset(window.resetAt);
        this.add_child(new St.Label({text: reset.relative + (reset.absolute ? ' · ' + reset.absolute : ''), style_class: 'ai-usage-reset'}));
    }
});

var ProviderItem = GObject.registerClass(class ProviderItem extends PopupMenu.PopupBaseMenuItem {
    _init(provider) {
        var usageUrl = UsageUtils.PROVIDER_USAGE_URLS[provider.id];
        var styleClass = usageUrl ? 'ai-usage-provider ai-usage-provider-clickable' : 'ai-usage-provider';
        super._init({reactive: !!usageUrl, can_focus: !!usageUrl, style_class: styleClass});
        if (usageUrl) {
            this.connect('activate', function () {
                Gio.AppInfo.launch_default_for_uri(usageUrl, null);
            });
        }

        var box = new St.BoxLayout({vertical: true, x_expand: true});
        var header = new St.BoxLayout({x_expand: true, style_class: 'ai-usage-provider-header'});

        var iconFile = Gio.File.new_for_path(GLib.build_filenamev([Me.path, 'icons', provider.icon || 'codex.svg']));
        if (iconFile.query_exists(null)) {
            var gicon = new Gio.FileIcon({file: iconFile});
            var icon = new St.Icon({
                gicon: gicon,
                icon_size: 16,
                style_class: 'ai-usage-provider-icon'
            });
            header.add_child(icon);
        }

        header.add_child(new St.Label({text: provider.label || provider.id, x_expand: true, style_class: 'ai-usage-provider-name'}));
        header.add_child(new St.Widget({style_class: statusDotClass(provider), y_align: Clutter.ActorAlign.CENTER}));
        box.add_child(header);

        var windows = provider.quotaWindows || [];
        if (windows.length) {
            windows.forEach(function (window) { box.add_child(new UsageMeter(window)); });
        } else {
            box.add_child(new St.Label({text: provider.error || 'Sin datos de cuota', style_class: 'ai-usage-status'}));
        }

        // Per-model cost breakdown, when the backend has priced any models
        // for this provider (currently Claude and OpenAI).
        var models = provider.details && provider.details.organizationUsage && provider.details.organizationUsage.models;
        if (models && typeof models === 'object') {
            Object.keys(models)
                .map(function (name) { return [name, models[name]]; })
                .filter(function (entry) { return entry[1] && entry[1].priced && Number(entry[1].cost_usd) > 0; })
                .sort(function (a, b) { return Number(b[1].cost_usd) - Number(a[1].cost_usd); })
                .forEach(function (entry) {
                    var text = entry[0] + ' — $' + Number(entry[1].cost_usd).toFixed(2);
                    box.add_child(new St.Label({text: text, style_class: 'ai-usage-model-row'}));
                });
        }
        this.add_child(box);
    }
});

var AiUsageExtension = class {
    constructor() {
        this._settings = ExtensionUtils.getSettings();
        this._providers = [];
    }

    enable() {
        this._indicator = new PanelMenu.Button(0.0, 'AI Usage', false);
        this._indicatorLabel = new St.Label({text: 'AI —', y_align: Clutter.ActorAlign.CENTER});
        this._indicator.add_child(this._indicatorLabel);
        this._indicator.menu.connect('open-state-changed', function (_menu, open) {
            if (open && !this._providers.length)
                this._refresh();
        }.bind(this));

        this._settingsChangedId = this._settings.connect('changed::enabled-providers', this._refresh.bind(this));
        this._indicatorModeChangedId = this._settings.connect('changed::indicator-mode', function () {
            this._render(this._lastEnvelope);
        }.bind(this));

        this._refreshId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._settings.get_uint('refresh-interval'), function () {
            this._refresh();
            return true;
        }.bind(this));
        Main.panel.addToStatusArea('ai-usage', this._indicator);
        this._refresh();
    }

    disable() {
        if (this._refreshId)
            GLib.Source.remove(this._refreshId);
        this._refreshId = 0;
        if (this._refreshTimeoutId)
            GLib.Source.remove(this._refreshTimeoutId);
        this._refreshTimeoutId = 0;
        if (this._refreshCancellable)
            this._refreshCancellable.cancel();
        this._refreshCancellable = null;
        if (this._settingsChangedId)
            this._settings.disconnect(this._settingsChangedId);
        if (this._indicatorModeChangedId)
            this._settings.disconnect(this._indicatorModeChangedId);
        if (this._indicator)
            this._indicator.destroy();
        this._indicator = null;
    }

    _refresh() {
        var backend = Gio.File.new_for_path(GLib.build_filenamev([Me.path, 'backend', 'sh', 'get-ai-usage']));
        var enabled = this._settings.get_strv('enabled-providers').filter(function (id) { return PROVIDERS.indexOf(id) !== -1; });
        if (!enabled.length) {
            this._render({providers: []});
            return;
        }

        var proc;
        try {
            var launcher = Gio.SubprocessLauncher.new(Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            
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

            var pythonPath = this._settings.get_string('python-path').trim();
            if (pythonPath)
                launcher.setenv('PYTHON3', pythonPath, true);

            proc = launcher.spawnv([backend.get_path(), '--provider', enabled.join(',')]);
        } catch (error) {
            this._renderError(error.message);
            return;
        }

        if (this._refreshCancellable)
            this._refreshCancellable.cancel();
        var cancellable = new Gio.Cancellable();
        this._refreshCancellable = cancellable;
        if (this._refreshTimeoutId)
            GLib.Source.remove(this._refreshTimeoutId);
        this._refreshTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, REFRESH_TIMEOUT_SECONDS, function () {
            this._refreshTimeoutId = 0;
            cancellable.cancel();
            return GLib.SOURCE_REMOVE;
        }.bind(this));

        proc.communicate_utf8_async(null, cancellable, function (process, result) {
            if (this._refreshTimeoutId) {
                GLib.Source.remove(this._refreshTimeoutId);
                this._refreshTimeoutId = 0;
            }
            if (this._refreshCancellable === cancellable)
                this._refreshCancellable = null;
            if (!this._indicator)
                return;
            try {
                var communicated = process.communicate_utf8_finish(result);
                var output = communicated[1];
                var stderr = communicated[2];
                var envelope = output ? JSON.parse(output) : null;
                if (!envelope)
                    throw new Error(stderr ? stderr.trim() : 'respuesta vacía del backend');
                this._render(envelope);
            } catch (error) {
                if (error.matches && error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    this._renderError('el backend no respondió a tiempo');
                else
                    this._renderError(error.message);
            }
        }.bind(this));
    }

    _render(envelope) {
        if (!envelope)
            return;
        this._lastEnvelope = envelope;
        this._providers = envelope.providers || [];
        var mode = this._settings.get_string('indicator-mode');
        var selected = mode === 'aggregate' ? null : this._providers.find(function (provider) { return provider.id === mode; });
        var value = selected ? UsageUtils.providerPercent(selected) : Math.max.apply(null, [0].concat(this._providers.map(UsageUtils.providerPercent)));
        this._indicatorLabel.text = (selected ? selected.label : 'AI') + ' ' + Math.round(value) + '%';
        this._indicator.menu.removeAll();
        this._providers.forEach(function (provider) { this._indicator.menu.addMenuItem(new ProviderItem(provider)); }.bind(this));
        var totalCost = this._providers.reduce(function (sum, p) { return sum + providerCostUSD(p); }, 0);
        if (totalCost > 0)
            this._indicator.menu.addMenuItem(this._buildCostFooter(totalCost));
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addMenuItem(this._buildToolbar());
    }

    _buildCostFooter(totalCost) {
        var item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false, style_class: 'ai-usage-cost-footer-item'});
        item.add_child(new St.Label({text: 'Total: $' + totalCost.toFixed(2), style_class: 'ai-usage-cost-footer', x_expand: true}));
        return item;
    }

    _buildToolbar() {
        var row = new St.BoxLayout({style_class: 'ai-usage-toolbar', x_expand: true});
        row.add_child(new St.Widget({x_expand: true}));
        row.add_child(this._makeIconButton('view-refresh-symbolic', this._refresh.bind(this)));
        row.add_child(this._makeIconButton('preferences-system-symbolic', this._openSettings.bind(this)));

        var item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false, style_class: 'ai-usage-toolbar-item'});
        item.add_child(row);
        return item;
    }

    _makeIconButton(iconName, onClick) {
        var button = new St.Button({
            style_class: 'ai-usage-icon-button',
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            child: new St.Icon({icon_name: iconName, icon_size: 16}),
        });
        button.connect('clicked', onClick);
        return button;
    }

    _openSettings() {
        try {
            Gio.Subprocess.new(['gnome-extensions', 'prefs', Me.metadata.uuid], Gio.SubprocessFlags.NONE);
        } catch (error) {
            logError(error);
        }
    }

    _renderError(message) {
        this._indicatorLabel.text = 'AI —';
        this._indicator.menu.removeAll();
        this._indicator.menu.addMenuItem(new PopupMenu.PopupMenuItem('No se pudo actualizar: ' + message));
    }
};

function init() {
    return new AiUsageExtension();
}
