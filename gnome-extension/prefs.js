import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {PROVIDER_KEY_HELP_URLS} from './utils.js';

// Settings-key -> "where do I get this" URL. Most of these mirror
// PROVIDER_KEY_HELP_URLS (keyed by provider id); claude-admin-api-key is its
// own thing (the org-wide admin key, not a regular Claude login).
const CREDENTIAL_HELP_URLS = {
    'claude-admin-api-key': 'https://console.anthropic.com/settings/admin-keys',
    'openai-api-key': PROVIDER_KEY_HELP_URLS.openai,
    'mistral-api-key': PROVIDER_KEY_HELP_URLS.mistral,
    'openrouter-api-key': PROVIDER_KEY_HELP_URLS.openrouter,
    'grok-api-key': PROVIDER_KEY_HELP_URLS.grok,
    'zai-token': PROVIDER_KEY_HELP_URLS.zai,
    'github-token': PROVIDER_KEY_HELP_URLS.copilot,
    'deepseek-api-key': PROVIDER_KEY_HELP_URLS.deepseek,
    'moonshot-api-key': PROVIDER_KEY_HELP_URLS.kimi,
};

export default class AiUsagePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // ── PAGE 1: PROVIDERS ──
        const providersPage = new Adw.PreferencesPage({
            title: 'Proveedores',
            icon_name: 'dialog-information-symbolic'
        });
        const providersGroup = new Adw.PreferencesGroup({title: 'Servicios Activos'});
        
        const providersList = [
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

        providersList.forEach(([id, label]) => {
            const row = new Adw.SwitchRow({title: label});
            row.set_active(settings.get_strv('enabled-providers').includes(id));
            row.connect('notify::active', () => {
                const enabled = settings.get_strv('enabled-providers').filter(v => v !== id);
                if (row.active)
                    enabled.push(id);
                settings.set_strv('enabled-providers', enabled);
            });
            providersGroup.add(row);
        });
        providersPage.add(providersGroup);
        window.add(providersPage);

        // ── PAGE 2: CREDENTIALS ──
        const credsPage = new Adw.PreferencesPage({
            title: 'Credenciales',
            icon_name: 'dialog-password-symbolic'
        });
        const credsGroup = new Adw.PreferencesGroup({title: 'API Keys y Tokens'});

        const credentialsFields = [
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

        credentialsFields.forEach(([key, title]) => {
            const row = new Adw.EntryRow({title, visibility: false});
            row.set_text(settings.get_string(key));
            row.connect('changed', () => {
                settings.set_string(key, row.get_text());
            });
            const helpUrl = CREDENTIAL_HELP_URLS[key];
            if (helpUrl) {
                const helpButton = new Gtk.Button({
                    icon_name: 'web-browser-symbolic',
                    valign: Gtk.Align.CENTER,
                    has_frame: false,
                    tooltip_text: 'Obtener esta key',
                });
                helpButton.connect('clicked', () => Gio.AppInfo.launch_default_for_uri(helpUrl, null));
                row.add_suffix(helpButton);
            }
            credsGroup.add(row);
        });
        credsPage.add(credsGroup);
        window.add(credsPage);

        // ── PAGE 3: ADVANCED OPTIONS ──
        const advPage = new Adw.PreferencesPage({
            title: 'Opciones',
            icon_name: 'emblem-system-symbolic'
        });
        const behaviorGroup = new Adw.PreferencesGroup({title: 'Comportamiento'});

        // Refresh interval
        const intervalRow = new Adw.SpinRow({
            title: 'Intervalo de actualización',
            subtitle: 'Segundos',
            adjustment: new Gtk.Adjustment({lower: 60, upper: 1800, step_increment: 60, value: settings.get_uint('refresh-interval')})
        });
        settings.bind('refresh-interval', intervalRow, 'value', Adw.UtilityBindingsFlags ? Adw.UtilityBindingsFlags.DEFAULT : 1);
        behaviorGroup.add(intervalRow);

        // Copilot Quota
        const quotaRow = new Adw.SpinRow({
            title: 'Cuota de GitHub Copilot',
            subtitle: 'Límite de tokens/requests',
            adjustment: new Gtk.Adjustment({lower: 1, upper: 100000, step_increment: 100, value: settings.get_int('copilot-quota')})
        });
        quotaRow.connect('notify::value', () => {
            settings.set_int('copilot-quota', quotaRow.get_value());
        });
        behaviorGroup.add(quotaRow);

        // Python path
        const pythonRow = new Adw.EntryRow({
            title: 'Ruta de Python personalizada',
            placeholder_text: 'Dejar vacío para auto-detectar'
        });
        pythonRow.set_text(settings.get_string('python-path'));
        pythonRow.connect('changed', () => {
            settings.set_string('python-path', pythonRow.get_text());
        });
        behaviorGroup.add(pythonRow);

        // Panel mode
        const modes = [
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
        const indicatorRow = new Adw.ComboRow({
            title: 'Indicador del panel',
            model: Gtk.StringList.new(modes.map(m => m[1]))
        });
        const currentMode = settings.get_string('indicator-mode') || 'aggregate';
        const selectIdx = Math.max(0, modes.findIndex(m => m[0] === currentMode));
        indicatorRow.set_selected(selectIdx);
        indicatorRow.connect('notify::selected', () => {
            settings.set_string('indicator-mode', modes[indicatorRow.selected][0]);
        });
        behaviorGroup.add(indicatorRow);

        advPage.add(behaviorGroup);
        window.add(advPage);
    }
}
