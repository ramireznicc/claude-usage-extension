import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import Clutter from 'gi://Clutter';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const BETA_HEADER = 'oauth-2025-04-20';
const USER_AGENT = 'claude-code/1.0';

// This extension is read-only: it never refreshes the OAuth token. Anthropic's
// refresh tokens are single-use/rotating, and the credentials file is shared
// with Claude Code — if both refreshed, one would revoke the other's token and
// leave stale (revoked) credentials on disk. So Claude Code stays the sole owner
// of the refresh flow; we only read the current accessToken.
const TOKEN_MARGIN_MS = 60000; // treat as expired 60s before the real expiry

const PANEL_BAR_WIDTH = 42;
const POPUP_BAR_WIDTH = 220;

// Returns the color CSS class based on the usage percentage.
function levelClass(pct) {
    if (pct >= 80)
        return 'claude-level-high';
    if (pct >= 50)
        return 'claude-level-mid';
    return 'claude-level-low';
}

// Builds a reusable progress bar (track + fill).
// We use a horizontal BoxLayout: St.Bin would stretch the fill to full width
// (ignoring its width), so the bar would always look full.
function makeBar(width, heightClass) {
    const track = new St.BoxLayout({
        vertical: false,
        style_class: `claude-bar-track ${heightClass}`,
        x_align: Clutter.ActorAlign.START,
        y_align: Clutter.ActorAlign.CENTER,
        style: `width: ${width}px;`,
    });
    const fill = new St.Widget({
        style_class: 'claude-bar-fill',
        x_expand: false,
        y_expand: true,
    });
    track.add_child(fill);

    track.setValue = pct => {
        const clamped = Math.max(0, Math.min(100, pct));
        const w = Math.max(0, Math.round((clamped / 100) * width));
        fill.style = `width: ${w}px;`;
        fill.style_class = `claude-bar-fill ${levelClass(clamped)}`;
    };
    return track;
}

// Formats the time remaining until an ISO date ("4h 1min").
function formatResetIn(isoString) {
    const target = new Date(isoString).getTime();
    let diff = Math.max(0, target - Date.now());
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0)
        return `${hours} h ${mins} min`;
    return `${mins} min`;
}

// Formats an ISO date as a readable date/time (in English).
function formatResetAt(isoString) {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

// A popup row: label + % + bar + reset text.
const UsageSection = GObject.registerClass(
class UsageSection extends PopupMenu.PopupBaseMenuItem {
    _init(title) {
        super._init({reactive: false, can_focus: false});

        const box = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'claude-section',
        });

        const header = new St.BoxLayout({x_expand: true});
        this._title = new St.Label({
            text: title,
            style_class: 'claude-section-title',
            x_expand: true,
        });
        this._percent = new St.Label({
            text: '—',
            style_class: 'claude-section-percent',
            x_align: Clutter.ActorAlign.END,
        });
        header.add_child(this._title);
        header.add_child(this._percent);

        this._bar = makeBar(POPUP_BAR_WIDTH, 'claude-bar-tall');
        this._reset = new St.Label({
            text: '',
            style_class: 'claude-section-reset',
        });

        box.add_child(header);
        box.add_child(this._bar);
        box.add_child(this._reset);
        this.add_child(box);
    }

    update(pct, resetText) {
        this._percent.text = `${Math.round(pct)}%`;
        this._bar.setValue(pct);
        this._reset.text = resetText;
    }
});

const ClaudeIndicator = GObject.registerClass(
class ClaudeIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Claude Usage');
        this._extension = extension;
        this._settings = extension.getSettings();
        this._cancellable = null;
        this._timeoutId = 0;

        this._session = new Soup.Session();
        this._session.timeout = 15;

        // --- Panel: icono + barra(s) ---
        const panelBox = new St.BoxLayout({style_class: 'claude-panel-box'});

        this._icon = new St.Icon({
            gicon: Gio.icon_new_for_string(`${extension.path}/icons/claude-color.svg`),
            style_class: 'claude-panel-icon',
        });
        panelBox.add_child(this._icon);

        this._panelLabel = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'claude-panel-label',
        });
        panelBox.add_child(this._panelLabel);

        this._panelBar = makeBar(PANEL_BAR_WIDTH, 'claude-bar-short');
        panelBox.add_child(this._panelBar);

        this._panelWeeklyBar = makeBar(PANEL_BAR_WIDTH, 'claude-bar-short');
        panelBox.add_child(this._panelWeeklyBar);

        this.add_child(panelBox);

        // --- Popup ---
        this._sessionSection = new UsageSection(_('Current session'));
        this.menu.addMenuItem(this._sessionSection);

        this._weeklySection = new UsageSection(_('Weekly limit'));
        this.menu.addMenuItem(this._weeklySection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._statusItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._statusItem.label.add_style_class_name('claude-status');
        this.menu.addMenuItem(this._statusItem);

        const refreshItem = new PopupMenu.PopupMenuItem(_('Refresh now'));
        refreshItem.connect('activate', () => this._refresh());
        this.menu.addMenuItem(refreshItem);

        // React to preference changes.
        this._settingsChangedId = this._settings.connect('changed', () => {
            this._applySettings();
            this._restartTimer();
        });

        this._applySettings();
        this._refresh();
        this._restartTimer();
    }

    _applySettings() {
        const showLabel = this._settings.get_boolean('show-percent-label');
        const showWeekly = this._settings.get_boolean('show-weekly-in-panel');
        this._panelLabel.visible = showLabel;
        this._panelWeeklyBar.visible = showWeekly;
    }

    _restartTimer() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }
        const interval = this._settings.get_int('poll-interval');
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _credentialsPath() {
        const custom = this._settings.get_string('credentials-path');
        if (custom && custom.length > 0)
            return custom;
        return GLib.build_filenamev([GLib.get_home_dir(), '.claude', '.credentials.json']);
    }

    _readCreds() {
        try {
            const file = Gio.File.new_for_path(this._credentialsPath());
            const [ok, contents] = file.load_contents(null);
            if (!ok)
                return {error: _('Could not read credentials')};
            const json = JSON.parse(new TextDecoder().decode(contents));
            const oauth = json.claudeAiOauth;
            if (!oauth || !oauth.accessToken)
                return {error: _('No Claude Code token found')};
            return {
                token: oauth.accessToken,
                expiresAt: oauth.expiresAt,
            };
        } catch (e) {
            return {error: _('No credentials (is Claude Code installed?)')};
        }
    }

    // Reads the current accessToken without refreshing it. If it looks expired,
    // Claude Code is responsible for refreshing it — we just prompt the user.
    _ensureToken(callback) {
        const creds = this._readCreds();
        if (creds.error && !creds.token) {
            this._setError(creds.error);
            return;
        }
        const expired = creds.expiresAt &&
            Date.now() >= creds.expiresAt - TOKEN_MARGIN_MS;
        if (expired) {
            this._setError(_('Token expired — open Claude Code'));
            return;
        }
        callback(creds.token);
    }

    _refresh() {
        this._ensureToken(token => this._fetchUsage(token));
    }

    _fetchUsage(token) {
        if (this._cancellable)
            this._cancellable.cancel();
        this._cancellable = new Gio.Cancellable();

        const message = Soup.Message.new('GET', USAGE_URL);
        const headers = message.get_request_headers();
        headers.append('Authorization', `Bearer ${token}`);
        headers.append('anthropic-beta', BETA_HEADER);
        headers.append('User-Agent', USER_AGENT);

        this._session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            this._cancellable,
            (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);
                    const status = message.get_status();
                    if (status === 429) {
                        this._setError(_('Rate limit (429) — will retry later'));
                        return;
                    }
                    if (status === 401 || status === 403) {
                        this._setError(_('Token invalid — open Claude Code'));
                        return;
                    }
                    if (status !== 200) {
                        this._setError(_('HTTP error %d').format(status));
                        return;
                    }
                    const text = new TextDecoder().decode(bytes.get_data());
                    const data = JSON.parse(text);
                    this._updateUI(data);
                } catch (e) {
                    if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        this._setError(_('Network error'));
                }
            }
        );
    }

    _updateUI(data) {
        const five = data.five_hour ?? {};
        const week = data.seven_day ?? {};
        const sessionPct = five.utilization ?? 0;
        const weekPct = week.utilization ?? 0;

        this.remove_style_class_name('claude-dimmed');

        this._panelBar.setValue(sessionPct);
        this._panelWeeklyBar.setValue(weekPct);
        this._panelLabel.text = `${Math.round(sessionPct)}%`;

        this._sessionSection.update(
            sessionPct,
            five.resets_at
                ? _('Resets in %s').format(formatResetIn(five.resets_at))
                : ''
        );
        this._weeklySection.update(
            weekPct,
            week.resets_at
                ? _('Resets %s').format(formatResetAt(week.resets_at))
                : ''
        );

        const now = new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
        this._statusItem.label.text = _('Updated %s').format(now);
    }

    _setError(msg) {
        this.add_style_class_name('claude-dimmed');
        this._panelLabel.text = '!';
        this._statusItem.label.text = msg || _('Error');
    }

    destroy() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }
        if (this._session) {
            this._session.abort();
            this._session = null;
        }
        super.destroy();
    }
});

export default class ClaudeUsageExtension extends Extension {
    enable() {
        this._indicator = new ClaudeIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
