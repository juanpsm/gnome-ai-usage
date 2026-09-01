<p align="center">
  <img src="./readme/icon.svg?v=7" width="120" alt="Logo de AI Usage">
</p>

<h1 align="center">AI Usage</h1>

<p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/Licencia-MIT-yellow?style=for-the-badge" alt="Licencia: MIT" />
  </a>
</p>

Extensión de GNOME Shell para ver de un vistazo cuánta cuota de uso te queda
en varios servicios de IA (Claude, OpenAI/Codex, GitHub Copilot, Antigravity,
etc.), sin tener que entrar a cada sitio web.

Este proyecto es un fork de otro para KDE Plasma (ver [Créditos](#créditos)).

---

## Extensión de GNOME Shell

Vive en [`gnome-extension/`](gnome-extension/). Es lo único de este repo que
usamos y probamos activamente. Qué hace hoy, verificado:

- Indicador en el panel superior con el porcentaje de uso, y un popover con
  una fila por proveedor habilitado.
- Un punto de estado por fila: verde (ok), rojo (error) o ámbar (el último
  refresco falló pero se muestra el dato anterior en caché).
- Un medidor por cada ventana de cuota del proveedor (porcentaje, tiempo
  restante, fecha exacta de reset).
- Click en una fila abre la página de uso de ese proveedor en el navegador
  (las URLs están verificadas contra la documentación real de cada uno, no
  adivinadas).
- Preferencias (botón de engranaje al pie del popover, o
  `gnome-extensions prefs ai-usage@juanpsm`): habilitar/deshabilitar cada
  proveedor, cargar credenciales con un link a dónde conseguir cada una,
  intervalo de refresco, cuota de GitHub Copilot, ruta de Python, y qué
  proveedor mostrar en el indicador del panel.
- Desglose de costo por modelo y un total agregado, que solo aparece si
  configurás una key con permisos de administración/organización (Claude
  Admin API Key, OpenAI API Key de organización). Sin eso, el dato no existe
  y no se muestra nada; no es un bug.
- El token OAuth de Claude se renueva solo cuando está por vencer, en vez de
  mostrar "token expired" hasta que abrís el CLI de Claude de nuevo.

Lo que todavía no tiene: gráfico histórico de uso, burn-rate, comparación
contra el período anterior, spark-lines, acento de color por tema, ni pines de
proveedores. Esas son funciones del panel de Quickshell/Hyprland (ver abajo),
que no están portadas a GNOME.

Requisitos: GNOME Shell 42+, GJS, GLib schemas, y Python 3.8+. Instalación
desde este checkout:

```bash
make gnome-install
```

Después activá **AI Usage** desde GNOME Extensions.

También podés armar un `.shell-extension.zip` instalable (uno por variante,
moderna y legacy) sin clonar el repo cada vez:

```bash
make gnome-pack
```

Ver [`gnome-extension/PUBLISHING.md`](gnome-extension/PUBLISHING.md) para el
detalle de qué incluye cada archivo y el checklist para subirlo a
extensions.gnome.org.

---

## Quickshell / Hyprland

[`hyprland/`](hyprland/) trae el panel de Quickshell heredado del proyecto
original, con más funciones que la extensión de GNOME en el papel (gráfico de
historial, burn-rate, comparación de período, spark-lines, export/import de
historial, colores de acento). No lo usamos ni lo probamos activamente en
este fork: el código sigue ahí y en teoría funciona, pero no podemos
garantizar que todo lo que promete el proyecto original siga andando tal
cual. Si lo probás y encontrás algo roto, avisá.

```bash
nix run .#hyprland
```

---

## Terminal

`ai-usage-cli` imprime los mismos datos en una tabla, sin necesitar GNOME
Shell ni Quickshell: sirve para otros escritorios, por SSH, o en una barra de
estado. Este sí tiene tests (`tests/ai-usage-cli.test.sh`).

```bash
export PATH="$PWD/package/contents/tools/sh:$PATH"
ai-usage-cli                        # todos los proveedores habilitados
ai-usage-cli --compact              # una línea, para barras de estado
ai-usage-cli --provider claude,zai  # un subconjunto puntual
```

```
PROVIDER  PLAN          WINDOW             USAGE                NOTE                      RESET
────────────────────────────────────────────────────────────────────────────────────────────────────────
Claude    max           5-hour session     [██░░░░░░░░]  23%    120000 / 500000 tokens    Jul 19, 17:00
Claude    max           7-day window       [██████░░░░]  61%    3000000 / 5000000 tokens  Jul 25, 17:00
────────────────────────────────────────────────────────────────────────────────────────────────────────
Copilot   —             —                  Copilot: no token configured
```

Sin un frontend gráfico corriendo, la configuración se escribe a mano en
`~/.config/ai-usage-widget/hyprland-settings.json` (o bajo `$XDG_CONFIG_HOME`;
`AI_USAGE_CONFIG` cambia la ruta). Ver [Servicios soportados](#servicios-soportados)
para lo que necesita cada uno.

---

## Servicios soportados

Esta tabla es la que ya traía el proyecto original: describe qué expone
cada API, no qué tan probado está en este fork específico.

| Servicio | Qué muestra | Estado |
|---|---|---|
| Claude (Anthropic) | Ventanas de suscripción, horarios de reset, estadísticas locales de actividad | Soportado |
| Antigravity / Google AI Studio | Cuota general, uso por modelo de Gemini, horarios de reset | Soportado |
| OpenAI | Uso de tokens/costo de API (30 días) + límites de plan Codex/ChatGPT y estado de cuenta | Soportado |
| Grok (xAI) | Créditos de facturación de la CLI, agotamiento del tier gratuito, totales de sesión local | Tier gratuito probado; planes pagos sin verificar |
| Kiro | Créditos mensuales, saldo restante, fecha de reset, excedente, plan inferido | Soportado |
| Mistral AI | Estado de la key, modelos disponibles, estadísticas locales de costo/tokens de vibe CLI | Soportado |
| OpenRouter | Gasto, límite de crédito, porcentaje de uso, etiqueta de cuenta | Sin probar |
| Z.AI | Cuota de tokens de 5 horas, cuota mensual de herramientas, cuentas regresivas de reset, detalle por modelo | Sin probar |
| GitHub Copilot | Uso mensual de premium requests contra una cuota configurable | Facturación personal soportada; org/enterprise todavía no |
| DeepSeek | Saldo disponible con desglose de crédito otorgado/recargado | Sin probar |
| Kimi / Moonshot AI | Saldo disponible con desglose de voucher/efectivo | Sin probar |

Las APIs de cada proveedor no exponen lo mismo: los límites de Codex/ChatGPT
son independientes del uso de la API de OpenAI, DeepSeek reporta un saldo en
vez de una ventana de uso, y el tier gratuito de Grok no expone uso progresivo
antes de agotarse. Ver [Cómo funciona](#cómo-funciona) para el detalle de cada
proveedor.

---

## Requisitos

| Dependencia | Notas |
|---|---|
| Python 3.8+ | Corre el backend compartido (solo librería estándar, sin `pip install`). Se autodetecta como `python3`, una versión con sufijo, o `python` a secas. Para fijar un intérprete específico, exportá `$PYTHON3` o configuralo en las preferencias de la extensión |

Habilitá solo los servicios que uses. Cada uno necesita lo suyo:

| Servicio | Qué necesitás |
|---|---|
| Claude | Claude Code, con sesión iniciada localmente |
| Antigravity | Node.js 18+, la CLI `antigravity-usage` con `antigravity-usage login`, o la IDE de Antigravity abierta |
| OpenAI | Una API key de OpenAI para el uso de organización; una sesión de Codex CLI da los límites de plan Codex/ChatGPT |
| Grok | Grok CLI autenticado con `grok --oauth`; una API key de xAI es opcional |
| Kiro | La IDE de Kiro, con sesión iniciada al menos una vez |
| Mistral AI | Una API key de Mistral; vibe CLI es opcional y agrega estadísticas de sesión local |
| OpenRouter | Una API key de OpenRouter cargada en las preferencias |
| Z.AI | Un token de Z.AI en preferencias, `$ZAI_TOKEN`, o `~/.config/zai/token` |
| GitHub Copilot | Un token de GitHub en preferencias, `$GITHUB_TOKEN`, o `~/.config/github-copilot/token`, con permiso fine-grained **Plan: read**; solo facturación personal |
| DeepSeek | Una API key de DeepSeek en preferencias, `$DEEPSEEK_API_KEY`, o `~/.config/deepseek/api-key` |
| Kimi / Moonshot AI | Una API key de Moonshot en preferencias, `$MOONSHOT_API_KEY`, `$KIMI_API_KEY`, o `~/.config/moonshot/api-key` |

---

## Cómo funciona

### Backend compartido

Las tres formas de usar esto (la extensión de GNOME, el panel de
Quickshell/Hyprland y la terminal) obtienen todos los datos de un mismo
ejecutable, `package/contents/tools/sh/get-ai-usage`. Se encarga de resolver
credenciales, pegarle a la API de cada proveedor, parsear la respuesta,
calcular porcentajes y horarios de reset, y devuelve un JSON versionado y
neutral respecto al frontend:

```bash
get-ai-usage --provider claude   # un proveedor puntual
get-ai-usage --all               # todos los habilitados
```

El backend es un paquete de Python sin dependencias externas
(`package/contents/tools/aiusage`); `get-ai-usage` es un lanzador de bash que
lo ejecuta. La normalización es pura (sin efectos secundarios), así que
`get-ai-usage --normalize` puede reproducir una respuesta grabada sin tocar la
red; así corren los tests. El esquema completo está documentado en
[`docs/provider-contract.md`](docs/provider-contract.md).

Ningún frontend hace pedidos de red, parsea una respuesta cruda, ni calcula un
porcentaje: todo eso vive en el backend. La extensión de GNOME está escrita
en GJS puro (sin QML); Quickshell usa QML y comparte lógica de formato de
tiempo/historial vía `package/contents/code/` (`Format.js`, `UsageHistory.js`).

### Claude
En cada refresco, el backend lee `~/.claude/.credentials.json` para el token
OAuth y llama al endpoint de uso de suscripción de Anthropic. Si el token está
por vencer, lo renueva usando el refresh token sin tocar ese archivo (que es
propiedad del CLI de `claude`), y cachea el resultado aparte. El endpoint y
client id de renovación no están documentados oficialmente por Anthropic (son
conocidos por ingeniería inversa de la comunidad); si algo falla, el
comportamiento es simplemente el mensaje de error de siempre, nada se corrompe.

### Antigravity
Lee credenciales de la configuración de la CLI `antigravity-usage` (en
`~/.config/antigravity-usage/`), o si no, prueba directamente contra un
proceso de la IDE de Antigravity corriendo localmente. Cualquiera de las dos
formas termina llamando a la API de Google Cloud Code para traer la cuota por
modelo.

### OpenAI
Dos partes independientes: el uso de la API de organización (últimos 30 días,
requiere una API key), y los límites del plan Codex/ChatGPT (vía el
app-server local de Codex, con un fallback web autenticado).

### Grok *(tier gratuito probado; planes pagos sin verificar)*
Lee la sesión de la CLI de Grok desde `~/.grok/auth.json` y resume las
sesiones locales de `~/.grok/sessions`. En el tier gratuito, la CLI solo
informa el monto exacto agotado después de que la cuota se termina, así que no
se puede mostrar avance progresivo antes de eso.

### Kiro
Lee el estado de uso cacheado localmente por Kiro
(`~/.config/Kiro/User/globalStorage/state.vscdb`). No necesita API key.

### Mistral AI
Valida la key contra la API de Mistral y lista los modelos disponibles.
Mistral no expone una API de facturación pública, así que el gasto sale de
los logs locales de vibe CLI (`~/.vibe/logs/session/*/meta.json`) cuando está
instalada.

### OpenRouter *(sin probar)*
Trae gasto y límite de crédito de la API de OpenRouter con la key configurada.

### Z.AI *(sin probar)*
Llama al endpoint de cuota de Z.AI con el token configurado.

### GitHub Copilot
Lee el uso mensual de premium requests desde la API de facturación de GitHub.
Necesita un token fine-grained con permiso **Plan: read**. Solo cubre
facturación personal, no organización/enterprise todavía.

### DeepSeek *(sin probar)*
Llama a `GET https://api.deepseek.com/user/balance` con la key configurada.

### Kimi / Moonshot AI *(sin probar)*
Llama a `GET https://api.moonshot.ai/v1/users/me/balance`. El sitio web de
Moonshot redirige ahora a `platform.kimi.ai`, pero este endpoint de API no
cambió.

**Privacidad:** las credenciales que cargás quedan guardadas localmente en la
configuración de la extensión (GSettings) y solo se envían al endpoint del
proveedor correspondiente. El JSON que recibe cualquier frontend nunca incluye
la credencial en sí, solo indicadores de presencia (`hasApiKey`, `keyValid`,
…); un test de contrato lo verifica automáticamente.

---

## Tests

```bash
make test
```

`tests/get-ai-usage.test.sh` reproduce las fixtures de `tests/fixtures/` en
modo `--normalize` (éxito, credenciales faltantes, respuestas mal formadas,
offline, rate-limited) para cada proveedor, sin tocar la red.
`tests/ai-usage-cli.test.sh` renderiza esas mismas fixtures con la terminal.
`tests/gnome-extension.test.js` cubre las funciones puras de
`gnome-extension/utils.js`. `tests/shared-code.test.js` cubre el JS que usa
Quickshell (`Format.js`, `UsageHistory.js`).

---

## Créditos

Este repo es un fork de
[Muddyblack/kde-ai-usage](https://github.com/Muddyblack/kde-ai-usage), que
hizo todo el trabajo original: el diseño del backend en Python, la
integración con cada proveedor, y el widget de KDE Plasma del que partimos.
Acá sacamos el widget de Plasma y construimos la extensión de GNOME Shell
sobre ese mismo backend.
