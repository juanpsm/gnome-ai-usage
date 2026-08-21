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

var PROVIDERS = ['claude', 'openai', 'copilot', 'antigravity'];

var METER_COLORS = {
    '': [0.384, 0.627, 0.918],
    warning: [0.898, 0.647, 0.039],
    danger: [0.929, 0.2, 0.231],
};

function paintMeter(area, pct) {
    var [width, height] = area.get_surface_size();
    var cr = area.get_context();
    cr.setSourceRGBA(1, 1, 1, 0.18);
    cr.rectangle(0, 0, width, height);
    cr.fill();

    var fillWidth = width * Math.max(0, Math.min(100, pct)) / 100;
    if (fillWidth > 0) {
        var color = METER_COLORS[UsageUtils.meterClass(pct)];
        cr.setSourceRGB(color[0], color[1], color[2]);
        cr.rectangle(0, 0, fillWidth, height);
        cr.fill();
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
        var meter = new St.DrawingArea({style_class: 'ai-usage-meter', x_expand: true});
        meter.connect('repaint', function (area) { paintMeter(area, pct); });
        this.add_child(meter);
        var reset = UsageUtils.formatReset(window.resetAt);
        this.add_child(new St.Label({text: reset.relative + (reset.absolute ? ' · ' + reset.absolute : ''), style_class: 'ai-usage-reset'}));
    }
});

var ProviderItem = GObject.registerClass(class ProviderItem extends PopupMenu.PopupBaseMenuItem {
    _init(provider) {
        super._init({reactive: false, can_focus: false, style_class: 'ai-usage-provider'});
        var box = new St.BoxLayout({vertical: true, x_expand: true});
        var header = new St.BoxLayout();
        header.add_child(new St.Label({text: provider.label || provider.id, x_expand: true, style_class: 'ai-usage-provider-name'}));
        header.add_child(new St.Label({text: provider.ok ? 'Conectado' : (provider.error || 'No disponible'), style_class: 'ai-usage-status'}));
        box.add_child(header);

        var windows = provider.quotaWindows || [];
        if (windows.length) {
            windows.forEach(function (window) { box.add_child(new UsageMeter(window)); });
        } else {
            box.add_child(new St.Label({text: provider.error || 'Sin datos de cuota', style_class: 'ai-usage-status'}));
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
            proc = Gio.Subprocess.new([backend.get_path(), '--provider', enabled.join(',')], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        } catch (error) {
            this._renderError(error.message);
            return;
        }
        proc.communicate_utf8_async(null, null, function (process, result) {
            try {
                var communicated = process.communicate_utf8_finish(result);
                var output = communicated[1];
                var stderr = communicated[2];
                var envelope = output ? JSON.parse(output) : null;
                if (!envelope)
                    throw new Error(stderr ? stderr.trim() : 'respuesta vacía del backend');
                this._render(envelope);
            } catch (error) {
                this._renderError(error.message);
            }
        }.bind(this));
    }

    _render(envelope) {
        if (!envelope)
            return;
        this._providers = envelope.providers || [];
        var mode = this._settings.get_string('indicator-mode');
        var selected = mode === 'aggregate' ? null : this._providers.find(function (provider) { return provider.id === mode; });
        var value = selected ? UsageUtils.providerPercent(selected) : Math.max.apply(null, [0].concat(this._providers.map(UsageUtils.providerPercent)));
        this._indicatorLabel.text = (selected ? selected.label : 'AI') + ' ' + Math.round(value) + '%';
        this._indicator.menu.removeAll();
        this._providers.forEach(function (provider) { this._indicator.menu.addMenuItem(new ProviderItem(provider)); }.bind(this));
        var refresh = new PopupMenu.PopupMenuItem('Actualizar');
        refresh.connect('activate', this._refresh.bind(this));
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addMenuItem(refresh);
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
