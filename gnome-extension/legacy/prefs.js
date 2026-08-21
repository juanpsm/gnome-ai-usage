/* exported init, buildPrefsWidget */

var Gtk = imports.gi.Gtk;
var ExtensionUtils = imports.misc.extensionUtils;

function init() {
    // Preferences initialization (unused in this extension but required by GNOME Shell < 45)
}

function createListBoxPage() {
    var listBox = new Gtk.ListBox({
        selection_mode: Gtk.SelectionMode.NONE,
        show_separators: true,
        margin_top: 12,
        margin_bottom: 12,
        margin_start: 12,
        margin_end: 12
    });
    return listBox;
}

function wrapInScroll(child) {
    var scroll = new Gtk.ScrolledWindow({
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
    });
    scroll.set_child(child);
    return scroll;
}

function addSwitchRow(listBox, labelText, active, callback) {
    var row = new Gtk.ListBoxRow({
        activatable: false
    });
    var box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 12,
        margin_end: 12
    });
    var label = new Gtk.Label({label: labelText, xalign: 0, hexpand: true});
    var toggle = new Gtk.Switch({active: active, valign: Gtk.Align.CENTER});
    toggle.connect('notify::active', callback);
    
    box.append(label);
    box.append(toggle);
    row.set_child(box);
    listBox.append(row);
}

function addEntryRow(listBox, labelText, text, visibility, placeholder, callback) {
    var row = new Gtk.ListBoxRow({
        activatable: false
    });
    var box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 12,
        margin_end: 12
    });
    var label = new Gtk.Label({label: labelText, xalign: 0, hexpand: true});
    var entry = new Gtk.Entry({text: text, visibility: visibility, placeholder_text: placeholder || '', valign: Gtk.Align.CENTER, width_request: 220});
    entry.connect('changed', callback);
    
    box.append(label);
    box.append(entry);
    row.set_child(box);
    listBox.append(row);
}

function addSpinRow(listBox, labelText, adjustment, callback) {
    var row = new Gtk.ListBoxRow({
        activatable: false
    });
    var box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 12,
        margin_end: 12
    });
    var label = new Gtk.Label({label: labelText, xalign: 0, hexpand: true});
    var spin = new Gtk.SpinButton({adjustment: adjustment, numeric: true, valign: Gtk.Align.CENTER});
    spin.connect('value-changed', callback);
    
    box.append(label);
    box.append(spin);
    row.set_child(box);
    listBox.append(row);
}

function addComboRow(listBox, labelText, modes, activeId, callback) {
    var row = new Gtk.ListBoxRow({
        activatable: false
    });
    var box = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 12,
        margin_end: 12
    });
    var label = new Gtk.Label({label: labelText, xalign: 0, hexpand: true});
    var combo = new Gtk.ComboBoxText({valign: Gtk.Align.CENTER});
    modes.forEach(function (m) {
        combo.append(m[0], m[1]);
    });
    combo.set_active_id(activeId);
    combo.connect('changed', callback);
    
    box.append(label);
    box.append(combo);
    row.set_child(box);
    listBox.append(row);
}

function buildPrefsWidget() {
    var settings = ExtensionUtils.getSettings();
    var notebook = new Gtk.Notebook({
        hexpand: true,
        vexpand: true
    });
    notebook.set_show_border(false);

    // ── PAGE 1: PROVIDERS ──
    var providersList = createListBoxPage();
    var providers = [
        ['claude', 'Claude'],
        ['antigravity', 'Gemini / Antigravity'],
        ['openai', 'OpenAI / Codex'],
        ['kiro', 'Kiro'],
        ['mistral', 'Mistral AI'],
        ['openrouter', 'OpenRouter'],
        ['grok', 'Grok'],
        ['zai', 'Z.AI'],
        ['copilot', 'GitHub Copilot'],
        ['deepseek', 'DeepSeek'],
        ['kimi', 'Kimi / Moonshot AI']
    ];

    providers.forEach(function (entry) {
        addSwitchRow(providersList, entry[1], settings.get_strv('enabled-providers').indexOf(entry[0]) !== -1, function (toggle) {
            var enabled = settings.get_strv('enabled-providers').filter(function (id) { return id !== entry[0]; });
            if (toggle.active)
                enabled.push(entry[0]);
            settings.set_strv('enabled-providers', enabled);
        });
    });
    notebook.append_page(wrapInScroll(providersList), new Gtk.Label({label: 'Proveedores'}));

    // ── PAGE 2: CREDENTIALS ──
    var credsList = createListBoxPage();
    var credentialsFields = [
        ['claude-admin-api-key', 'Claude Admin API Key'],
        ['openai-api-key', 'OpenAI API Key'],
        ['mistral-api-key', 'Mistral API Key'],
        ['openrouter-api-key', 'OpenRouter API Key'],
        ['grok-api-key', 'Grok API Key'],
        ['zai-token', 'Z.AI Token'],
        ['github-token', 'GitHub Token (Copilot)'],
        ['deepseek-api-key', 'DeepSeek API Key'],
        ['moonshot-api-key', 'Moonshot / Kimi API Key']
    ];

    credentialsFields.forEach(function (field) {
        addEntryRow(credsList, field[1], settings.get_string(field[0]), false, 'Ingresa la clave o token', function (entry) {
            settings.set_string(field[0], entry.text);
        });
    });
    notebook.append_page(wrapInScroll(credsList), new Gtk.Label({label: 'Credenciales'}));

    // ── PAGE 3: ADVANCED OPTIONS ──
    var optsList = createListBoxPage();

    // Refresh interval
    addSpinRow(optsList, 'Intervalo de actualización (segundos)', new Gtk.Adjustment({lower: 60, upper: 1800, step_increment: 60, value: settings.get_uint('refresh-interval')}), function (spin) {
        settings.set_uint('refresh-interval', spin.value);
    });

    // Copilot quota
    addSpinRow(optsList, 'Cuota de GitHub Copilot', new Gtk.Adjustment({lower: 1, upper: 100000, step_increment: 100, value: settings.get_int('copilot-quota')}), function (spin) {
        settings.set_int('copilot-quota', spin.value);
    });

    // Python Path
    addEntryRow(optsList, 'Ruta de Python personalizada', settings.get_string('python-path'), true, 'Ej. /usr/bin/python3 o vacío', function (entry) {
        settings.set_string('python-path', entry.text);
    });

    // Indicator mode
    var modes = [
        ['aggregate', 'Resumen'],
        ['claude', 'Claude'],
        ['antigravity', 'Gemini / Antigravity'],
        ['openai', 'OpenAI / Codex'],
        ['kiro', 'Kiro'],
        ['mistral', 'Mistral AI'],
        ['openrouter', 'OpenRouter'],
        ['grok', 'Grok'],
        ['zai', 'Z.AI'],
        ['copilot', 'GitHub Copilot'],
        ['deepseek', 'DeepSeek'],
        ['kimi', 'Kimi / Moonshot AI']
    ];
    addComboRow(optsList, 'Indicador del panel', modes, settings.get_string('indicator-mode') || 'aggregate', function (combo) {
        var id = combo.get_active_id();
        if (id) {
            settings.set_string('indicator-mode', id);
        }
    });

    notebook.append_page(wrapInScroll(optsList), new Gtk.Label({label: 'Opciones'}));

    notebook.set_size_request(500, 480);
    return notebook;
}
