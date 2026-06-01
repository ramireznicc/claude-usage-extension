# Claude Usage — extensión de GNOME Shell

> Mira tus límites de uso de Claude directamente en la barra superior de GNOME, sin abrir el navegador.

Muestra en el panel tu **sesión actual** (ventana de 5 h) y tu **límite semanal**, cada uno con
icono y barra de progreso, más un menú desplegable con el detalle y los tiempos de reset.

Son los mismos números que ves en [`claude.ai/settings/usage`](https://claude.ai/settings/usage)
— los límites son compartidos entre claude.ai web, Claude Desktop y Claude Code.

![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-48%20%7C%2049-4A86CF)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Características

- **Cero configuración**: si tienes Claude Code con sesión iniciada, funciona solo.
- **Sesión de 5 h y límite semanal** en el panel, con barras de progreso codificadas por color.
- **Menú desplegable** con porcentajes exactos y cuándo se resetea cada límite.
- **Refresco automático del token OAuth** — sigue funcionando aunque no abras Claude Code en días.
- **Preferencias** para el intervalo de sondeo, qué mostrar en el panel y la ruta de credenciales.

## 🔧 Cómo funciona

Consulta `https://api.anthropic.com/api/oauth/usage` (el endpoint que usa Claude Code)
con el token OAuth de `~/.claude/.credentials.json`. No hay que copiar cookies a mano.

De la respuesta usa los campos `five_hour.{utilization,resets_at}` y
`seven_day.{utilization,resets_at}`.

### Refresco automático de token

Si el `accessToken` está a punto de expirar (margen de 60 s) o ya caducó, la extensión lo
renueva sola usando el `refreshToken` contra `https://claude.ai/v1/oauth/token` (con el
`client_id` de Claude Code) y reescribe `~/.claude/.credentials.json` preservando el resto del
archivo. Si no hay `refreshToken`, intenta con el token actual y, si falla, muestra
**"Token expirado — abre Claude Code"**.

## 📦 Instalación

> Requiere Claude Code instalado y con sesión iniciada (`~/.claude/.credentials.json`).

```sh
git clone https://github.com/ramireznicc/claude-usage-extension.git \
  ~/.local/share/gnome-shell/extensions/claude-usage@ramireznicc

# Compila el schema de configuración
glib-compile-schemas ~/.local/share/gnome-shell/extensions/claude-usage@ramireznicc/schemas/
```

Después:

1. **Cierra sesión y vuelve a entrar** (en Wayland el shell no recarga en caliente).
2. Habilítala:
   ```sh
   gnome-extensions enable claude-usage@ramireznicc
   ```
   …o desde la app **Extensiones**.

## ⚙️ Preferencias

```sh
gnome-extensions prefs claude-usage@ramireznicc
```

| Opción | Descripción | Default |
| --- | --- | --- |
| Intervalo de sondeo | Cada cuánto se consulta el uso (mínimo 60 s) | `300 s` |
| Mostrar % junto al icono | Muestra el porcentaje de la sesión en el panel | `on` |
| Mostrar barra semanal en el panel | Añade una segunda barra para el límite semanal | `off` |
| Ruta de credenciales | Ruta personalizada al `.credentials.json` | `~/.claude/.credentials.json` |

## 🎨 Colores de la barra

| Uso | Color |
| --- | --- |
| `< 50 %` | 🟢 Verde |
| `50–80 %` | 🟡 Amarillo |
| `≥ 80 %` | 🔴 Rojo |

## 📝 Notas

- El endpoint de uso es interno de Claude Code (no documentado). Está aislado en una sola
  función de `extension.js` por si cambia.
- Respeta los rate limits: usa `User-Agent: claude-code/*` e intervalo ≥ 60 s.
- Compatible con GNOME Shell 48 y 49.

## 📂 Estructura

```
claude-usage-extension/
├── extension.js     # Lógica principal: panel, menú, fetch de uso y refresh del token
├── prefs.js         # Ventana de preferencias (Adwaita)
├── metadata.json    # Metadatos de la extensión
├── stylesheet.css   # Estilos de las barras y el menú
├── schemas/         # Schema GSettings
└── icons/           # Iconos del panel (color y simbólico)
```

## 📄 Licencia

[MIT](LICENSE) © ramireznicc
