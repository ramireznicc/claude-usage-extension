import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ClaudeUsagePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        window.add(page);

        const group = new Adw.PreferencesGroup({title: _('Claude Usage')});
        page.add(group);

        // Polling interval
        const interval = new Adw.SpinRow({
            title: _('Polling interval (seconds)'),
            subtitle: _('Minimum 60s to avoid rate limits'),
            adjustment: new Gtk.Adjustment({
                lower: 60,
                upper: 3600,
                step_increment: 30,
            }),
        });
        group.add(interval);
        settings.bind('poll-interval', interval, 'value', Gio.SettingsBindFlags.DEFAULT);

        // Show % in the panel
        const showLabel = new Adw.SwitchRow({
            title: _('Show % next to the icon'),
        });
        group.add(showLabel);
        settings.bind('show-percent-label', showLabel, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Show weekly bar in the panel
        const showWeekly = new Adw.SwitchRow({
            title: _('Show weekly bar in the panel'),
        });
        group.add(showWeekly);
        settings.bind('show-weekly-in-panel', showWeekly, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Credentials path
        const credPath = new Adw.EntryRow({
            title: _('Credentials path (empty = default)'),
        });
        group.add(credPath);
        settings.bind('credentials-path', credPath, 'text', Gio.SettingsBindFlags.DEFAULT);
    }
}
