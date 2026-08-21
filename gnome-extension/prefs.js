import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AiUsagePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'AI Usage', icon_name: 'applications-science-symbolic'});
        const providers = new Adw.PreferencesGroup({title: 'Proveedores'});
        for (const [id, label] of [['claude', 'Claude'], ['openai', 'OpenAI / Codex'], ['copilot', 'GitHub Copilot'], ['antigravity', 'Gemini / Antigravity']]) {
            const row = new Adw.SwitchRow({title: label});
            row.set_active(settings.get_strv('enabled-providers').includes(id));
            row.connect('notify::active', () => {
                const enabled = settings.get_strv('enabled-providers').filter(value => value !== id);
                if (row.active)
                    enabled.push(id);
                settings.set_strv('enabled-providers', enabled);
            });
            providers.add(row);
        }

        const behavior = new Adw.PreferencesGroup({title: 'Comportamiento'});
        const interval = new Adw.SpinRow({title: 'Intervalo de actualización', subtitle: 'Segundos', adjustment: new Gtk.Adjustment({lower: 60, upper: 1800, step_increment: 60, value: settings.get_uint('refresh-interval')})});
        settings.bind('refresh-interval', interval, 'value', 1);
        behavior.add(interval);

        const indicator = new Adw.ComboRow({title: 'Indicador del panel', model: Gtk.StringList.new(['Resumen', 'Claude', 'OpenAI / Codex', 'GitHub Copilot', 'Gemini / Antigravity'])});
        const ids = ['aggregate', 'claude', 'openai', 'copilot', 'antigravity'];
        indicator.set_selected(Math.max(0, ids.indexOf(settings.get_string('indicator-mode'))));
        indicator.connect('notify::selected', () => settings.set_string('indicator-mode', ids[indicator.selected]));
        behavior.add(indicator);

        page.add(providers);
        page.add(behavior);
        window.add(page);
    }
}
