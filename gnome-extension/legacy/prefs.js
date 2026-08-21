/* exported buildPrefsWidget */

var Gtk = imports.gi.Gtk;
var ExtensionUtils = imports.misc.extensionUtils;

function buildPrefsWidget() {
    var settings = ExtensionUtils.getSettings();
    var box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 12, margin_top: 18, margin_bottom: 18, margin_start: 18, margin_end: 18});
    var title = new Gtk.Label({label: '<b>AI Usage</b>', use_markup: true, halign: Gtk.Align.START});
    box.append(title);

    [['claude', 'Claude'], ['openai', 'OpenAI / Codex'], ['copilot', 'GitHub Copilot'], ['antigravity', 'Gemini / Antigravity']].forEach(function (entry) {
        var row = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 12});
        var label = new Gtk.Label({label: entry[1], xalign: 0, hexpand: true});
        var toggle = new Gtk.Switch({active: settings.get_strv('enabled-providers').indexOf(entry[0]) !== -1});
        toggle.connect('notify::active', function () {
            var enabled = settings.get_strv('enabled-providers').filter(function (id) { return id !== entry[0]; });
            if (toggle.active)
                enabled.push(entry[0]);
            settings.set_strv('enabled-providers', enabled);
        });
        row.append(label);
        row.append(toggle);
        box.append(row);
    });

    var interval = new Gtk.SpinButton({adjustment: new Gtk.Adjustment({lower: 60, upper: 1800, step_increment: 60, value: settings.get_uint('refresh-interval')}), numeric: true});
    interval.connect('value-changed', function () { settings.set_uint('refresh-interval', interval.value); });
    var intervalRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 12});
    intervalRow.append(new Gtk.Label({label: 'Intervalo (segundos)', xalign: 0, hexpand: true}));
    intervalRow.append(interval);
    box.append(intervalRow);
    return box;
}
