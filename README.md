# Claude Usage — GNOME Shell extension

> See your Claude usage limits right in the GNOME top bar, without opening the browser.

Shows your **current session** (5-hour window) and your **weekly limit** in the panel, each with
an icon and a progress bar, plus a dropdown menu with the details and reset times.

These are the same numbers you see at [`claude.ai/settings/usage`](https://claude.ai/settings/usage)
— the limits are shared across claude.ai web, Claude Desktop, and Claude Code.

![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-48%20%7C%2049%20%7C%2050-4A86CF)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- **Zero configuration**: if Claude Code is installed and signed in, it just works.
- **5-hour session and weekly limit** in the panel, with color-coded progress bars.
- **Dropdown menu** with exact percentages and when each limit resets.
- **Automatic OAuth token refresh** — keeps working even if you never open Claude Code.
- **Preferences** for the polling interval, what to show in the panel, and the credentials path.

## 🔧 How it works

It queries `https://api.anthropic.com/api/oauth/usage` (the endpoint Claude Code uses)
with the OAuth token from `~/.claude/.credentials.json`. No need to copy cookies by hand.

From the response it uses the `five_hour.{utilization,resets_at}` and
`seven_day.{utilization,resets_at}` fields.

### Token refresh

If the `accessToken` is expired (or within 60s of expiring), the extension renews it using the
`refreshToken` against `https://claude.ai/v1/oauth/token` with Claude Code's `client_id`, then
rewrites `~/.claude/.credentials.json` preserving every other key in the file.

This matters if you use the **Claude desktop app** rather than the `claude` CLI: the desktop app
keeps its session elsewhere and never touches `.credentials.json`, so without this the file goes
stale within hours and the panel stops updating until you manually run the CLI.

Anthropic's refresh tokens are single-use and rotating, and the file is shared with Claude Code, so
spending a stale one revokes the token the other side holds. Three safeguards keep that from
happening:

1. **One refresh in flight at a time** — two concurrent refreshes would spend the same rotating
   token twice, and the second would revoke the token the first just obtained.
2. **Re-read immediately before spending it** — Claude Code may have rotated the token since the
   poll that triggered the refresh, leaving our copy stale.
3. **Treat a rejection as a race, not an error** — if the server turns the refresh token down, the
   file is re-read first; if it now holds a valid token, Claude Code simply got there first and
   there is nothing to report.

If the refresh genuinely fails, the panel shows **"Could not refresh token — open Claude Code"**.
Note the `refreshToken` itself also expires (around 30 days); past that, a real sign-in is needed.

## 📦 Installation

> Requires Claude Code installed and signed in (`~/.claude/.credentials.json`).

```sh
git clone https://github.com/ramireznicc/claude-usage-extension.git \
  ~/.local/share/gnome-shell/extensions/claude-usage@ramireznicc

# Compile the settings schema
glib-compile-schemas ~/.local/share/gnome-shell/extensions/claude-usage@ramireznicc/schemas/
```

Then:

1. **Log out and back in** (on Wayland the shell does not hot-reload).
2. Enable it:
   ```sh
   gnome-extensions enable claude-usage@ramireznicc
   ```
   …or from the **Extensions** app.

## ⚙️ Preferences

```sh
gnome-extensions prefs claude-usage@ramireznicc
```

| Option | Description | Default |
| --- | --- | --- |
| Polling interval | How often usage is queried (minimum 60s) | `300s` |
| Show % next to the icon | Shows the session percentage in the panel | `on` |
| Show weekly bar in the panel | Adds a second bar for the weekly limit | `off` |
| Credentials path | Custom path to `.credentials.json` | `~/.claude/.credentials.json` |

## 🎨 Bar colors

| Usage | Color |
| --- | --- |
| `< 50%` | 🟢 Green |
| `50–80%` | 🟡 Yellow |
| `≥ 80%` | 🔴 Red |

## 📝 Notes

- The usage endpoint is internal to Claude Code (undocumented). It's isolated in a single
  function in `extension.js` in case it changes.
- Respects rate limits: uses `User-Agent: claude-code/*` and an interval ≥ 60s.
- Compatible with GNOME Shell 48, 49 and 50.

## 📂 Structure

```
claude-usage-extension/
├── extension.js     # Main logic: panel, menu, usage fetch, and token refresh
├── prefs.js         # Preferences window (Adwaita)
├── metadata.json    # Extension metadata
├── stylesheet.css   # Bar and menu styles
├── schemas/         # GSettings schema
└── icons/           # Panel icons (color and symbolic)
```

## 📄 License

[MIT](LICENSE) © ramireznicc
