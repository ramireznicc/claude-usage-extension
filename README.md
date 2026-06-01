# Claude Usage — GNOME Shell extension

> See your Claude usage limits right in the GNOME top bar, without opening the browser.

Shows your **current session** (5-hour window) and your **weekly limit** in the panel, each with
an icon and a progress bar, plus a dropdown menu with the details and reset times.

These are the same numbers you see at [`claude.ai/settings/usage`](https://claude.ai/settings/usage)
— the limits are shared across claude.ai web, Claude Desktop, and Claude Code.

![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-48%20%7C%2049-4A86CF)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- **Zero configuration**: if Claude Code is installed and signed in, it just works.
- **5-hour session and weekly limit** in the panel, with color-coded progress bars.
- **Dropdown menu** with exact percentages and when each limit resets.
- **Automatic OAuth token refresh** — keeps working even if you don't open Claude Code for days.
- **Preferences** for the polling interval, what to show in the panel, and the credentials path.

## 🔧 How it works

It queries `https://api.anthropic.com/api/oauth/usage` (the endpoint Claude Code uses)
with the OAuth token from `~/.claude/.credentials.json`. No need to copy cookies by hand.

From the response it uses the `five_hour.{utilization,resets_at}` and
`seven_day.{utilization,resets_at}` fields.

### Automatic token refresh

If the `accessToken` is about to expire (60s margin) or already expired, the extension renews it
on its own using the `refreshToken` against `https://claude.ai/v1/oauth/token` (with Claude Code's
`client_id`) and rewrites `~/.claude/.credentials.json` while preserving the rest of the file.
If there's no `refreshToken`, it falls back to the current token and, if that fails, shows
**"Token expired — open Claude Code"**.

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
- Compatible with GNOME Shell 48 and 49.

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
