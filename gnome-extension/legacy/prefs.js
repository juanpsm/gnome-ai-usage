/* exported buildPrefsWidget */

var Gtk = imports.gi.Gtk;
var ExtensionUtils = imports.misc.extensionUtils;

function buildPrefsWidget() {
    var settings = ExtensionUtils.getSettings();
    var notebook = new Gtk.Notebook();

    // ── PAGE 1: PROVIDERS ──
    var providersBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 8, margin_top: 12, margin_bottom: 12, margin_start: 12, margin_end: 12});
    
    var providersList = [
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

    providersList.forEach(function (entry) {
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
        providersBox.append(row);
    });

    var providersScroll = new Gtk.ScrolledWindow({hscrollbar_policy: Gtk.PolicyType.NEVER, vscrollbar_policy: Gtk.PolicyType.AUTOMATIC});
    providersScroll.set_child(providersBox);
    notebook.append_page(providersScroll, new Gtk.Label({label: 'Proveedores'}));

    // ── PAGE 2: CREDENTIALS ──
    var credsBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin_top: 12, margin_bottom: 12, margin_start: 12, margin_end: 12});
    
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
        var row = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4});
        var label = new Gtk.Label({label: field[1], xalign: 0});
        var entry = new Gtk.Entry({text: settings.get_string(field[0]), visibility: false});
        entry.connect('changed', function () {
            settings.set_string(field[0], entry.text);
        });
        row.append(label);
        row.append(entry);
        credsBox.append(row);
    });

    var credsScroll = new Gtk.ScrolledWindow({hscrollbar_policy: Gtk.PolicyType.NEVER, vscrollbar_policy: Gtk.PolicyType.AUTOMATIC});
    credsScroll.set_child(credsBox);
    notebook.append_page(credsScroll, new Gtk.Label({label: 'Credenciales'}));

    // ── PAGE 3: ADVANCED OPTIONS ──
    var optsBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 12, margin_top: 12, margin_bottom: 12, margin_start: 12, margin_end: 12});

    // Refresh interval
    var intervalRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 12});
    intervalRow.append(new Gtk.Label({label: 'Intervalo de actualización (segundos)', xalign: 0, hexpand: true}));
    var interval = new Gtk.SpinButton({adjustment: new Gtk.Adjustment({lower: 60, upper: 1800, step_increment: 60, value: settings.get_uint('refresh-interval')}), numeric: true});
    interval.connect('value-changed', function () { settings.set_uint('refresh-interval', interval.value); });
    intervalRow.append(interval);
    optsBox.append(intervalRow);

    // Copilot quota
    var quotaRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 12});
    quotaRow.append(new Gtk.Label({label: 'Cuota de GitHub Copilot', xalign: 0, hexpand: true}));
    var quota = new Gtk.SpinButton({adjustment: new Gtk.Adjustment({lower: 1, upper: 100000, step_increment: 100, value: settings.get_int('copilot-quota')}), numeric: true});
    quota.connect('value-changed', function () { settings.set_int('copilot-quota', quota.value); });
    quotaRow.append(quota);
    optsBox.append(quotaRow);

    // Python Path
    var pythonRow = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4});
    pythonRow.append(new Gtk.Label({label: 'Ruta personalizada de Python', xalign: 0}));
    var pythonEntry = new Gtk.Entry({text: settings.get_string('python-path'), placeholder_text: 'Ej. /usr/bin/python3 o vacío'});
    pythonEntry.connect('changed', function () {
        settings.set_string('python-path', pythonEntry.text);
    });
    pythonRow.append(pythonEntry);
    optsBox.append(pythonRow);

    // Indicator mode
    var indicatorRow = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 12});
    indicatorRow.append(new Gtk.Label({label: 'Indicador del panel', xalign: 0, hexpand: true}));
    var indicatorCombo = new Gtk.ComboBoxText();
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
    modes.forEach(function (m) {
        indicatorCombo.append(m[0], m[1]);
    });
    indicatorCombo.set_active_id(settings.get_string('indicator-mode') || 'aggregate');
    indicatorCombo.connect('changed', function () {
        var id = indicatorCombo.get_active_id();
        if (id) {
            settings.set_string('indicator-mode', id);
        }
    });
    indicatorRow.append(indicatorCombo);
    optsBox.append(indicatorRow);

    var optsScroll = new Gtk.ScrolledWindow({hscrollbar_policy: Gtk.PolicyType.NEVER, vscrollbar_policy: Gtk.PolicyType.AUTOMATIC});
    optsScroll.set_child(optsBox);
    notebook.append_page(optsScroll, new Gtk.Label({label: 'Opciones'}));

    notebook.set_size_request(450, 400);
    return notebook;
}
