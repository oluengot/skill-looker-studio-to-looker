# 01 · Herramientas, MCP y accesos

La migración necesita **cinco capacidades**. Cada plataforma de agentes las cubre con
herramientas distintas. Si falta alguna, el agente debe decirlo al inicio y proponer la
alternativa de la columna "Plan B".

| # | Capacidad | Para qué | Imprescindible |
|---|---|---|---|
| C1 | **Navegador controlable con JavaScript** (sesión del usuario) | Leer la definición de LS (API interna), usar la API interna de Looker (archivos, validate, SQL, dashboards), ver los dashboards renderizados, hacer commit y deploy en el IDE | Sí |
| C2 | **MCP de Looker** (API con credenciales propias) | Explorar modelos y explores, correr queries y dashboards **contra producción**, crear y editar dashboards de usuario | Muy recomendado |
| C3 | **Ejecución de SQL en BigQuery** | Validar fórmulas y crear las vistas pasarela | Sí (vía C1 o vía MCP) |
| C4 | **Sistema de archivos + shell** | Carpeta de trabajo, copias de LookML, specs, validaciones, scripts | Sí |
| C5 | **Git** (opcional) | Versionar la carpeta de trabajo local | No |

## Tabla de equivalencias por plataforma

| Capacidad | Claude Code (CLI / desktop) | Google Antigravity 2.0 | Otro agente (Cursor, Codex, Gemini CLI…) | Plan B |
|---|---|---|---|---|
| C1 navegador | `mcp__Claude_Browser__*` (navegador integrado de la app de escritorio) o `mcp__claude-in-chrome__*` (Chrome real del usuario). Herramientas clave: `navigate`, `javascript_tool` (`javascript_exec`), `read_network_requests`, `computer` (screenshot/click), `get_page_text` | **Browser subagent** integrado de Antigravity (Chrome controlado por el agente, con su propio perfil: el usuario inicia sesión una vez ahí). Para ejecutar JS usar la acción de ejecutar script/consola del browser agent; para red, las capturas/registros del agente | MCP **Chrome DevTools** (`chrome-devtools-mcp`: `evaluate_script`, `list_network_requests`, `get_network_request`, `take_screenshot`) o **Playwright MCP** (`@playwright/mcp`: `browser_evaluate`, `browser_network_requests`) | El usuario pega los snippets de `scripts/` en la consola DevTools (F12) y devuelve el resultado |
| C2 MCP Looker | servidor `looker` (MCP Toolbox prebuilt): `mcp__looker__get_models`, `get_explores`, `get_dimensions`, `get_measures`, `query`, `query_sql`, `query_url`, `get_dashboards`, `get_dashboard`, `run_dashboard`, `make_dashboard`, `add_dashboard_element`, `add_dashboard_filter`, `update_dashboard_element`, `update_dashboard_layout_component`, `create_dashboard_layout`, `generate_embed_url`, `get_looks`, `run_look`, `make_look`, `get_field_value_suggestions` | Mismo servidor (MCP Toolbox `--prebuilt looker`) registrado en `mcp_config.json` de Antigravity (Agent panel → MCP Servers → Manage → View raw config) | Mismo servidor en la config MCP de la herramienta | API REST de Looker con `curl` + client_id/secret (leídos de variables de entorno) |
| C3 SQL | Vía C1: `POST /api/internal/core/4.0/sql_queries` (usa la conexión de Looker, **recomendado**: valida exactamente lo que Looker verá). Alternativa: MCP Toolbox `--prebuilt bigquery` o REST BigQuery con `gcloud auth print-access-token` | Igual: vía browser agent, o MCP Toolbox `--prebuilt bigquery` | Igual | SQL Runner de Looker en la UI (el usuario pega la consulta) |
| C4 archivos/shell | Read/Write/Edit/Bash/PowerShell | Editor + terminal integrados del agente | Nativo | — |

> Nota: el MCP de Looker **no tiene** herramientas para: escribir archivos LookML, validar el
> proyecto, commit/deploy, borrar mosaicos, ni guardar más de un `listen` por mosaico. Todo eso va
> por la API interna desde el navegador (C1). Ver `07_api_interna_looker.md`.

## Configuración del MCP de Looker (MCP Toolbox for Databases)

Paquete: `@toolbox-sdk/server` (Google "MCP Toolbox for Databases"), modo `--prebuilt looker`.
Fija la versión (p. ej. `@1.13.1`) para que no cambie sola.

Variables de entorno:

| Variable | Valor |
|---|---|
| `LOOKER_BASE_URL` | `https://<instancia>.cloud.looker.com` |
| `LOOKER_CLIENT_ID` | API3 client id del usuario (Looker → Admin → Users → Edit → API Keys) |
| `LOOKER_CLIENT_SECRET` | API3 client secret |
| `LOOKER_VERIFY_SSL` | `true` |

**Nunca** escribas el client id/secret en archivos versionados. Ponlos en variables de entorno
del sistema o en la config local del agente, que no se versiona.

### Claude Code (`~/.claude.json` → `mcpServers`, o `.mcp.json` del proyecto sin secretos)
```json
{
  "mcpServers": {
    "looker": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@toolbox-sdk/server@1.13.1", "--prebuilt", "looker", "--stdio"],
      "env": { "LOOKER_BASE_URL": "https://<instancia>.cloud.looker.com", "LOOKER_VERIFY_SSL": "true" }
    }
  }
}
```
En macOS/Linux: `"command": "npx", "args": ["-y", "@toolbox-sdk/server@1.13.1", "--prebuilt", "looker", "--stdio"]`.
`LOOKER_CLIENT_ID` y `LOOKER_CLIENT_SECRET` se heredan de las variables de entorno del sistema.

### Google Antigravity (`mcp_config.json`, desde Agent panel → … → MCP Servers → Manage MCP Servers → View raw config)
```json
{
  "mcpServers": {
    "looker": {
      "command": "npx",
      "args": ["-y", "@toolbox-sdk/server@1.13.1", "--prebuilt", "looker", "--stdio"],
      "env": {
        "LOOKER_BASE_URL": "https://<instancia>.cloud.looker.com",
        "LOOKER_CLIENT_ID": "${LOOKER_CLIENT_ID}",
        "LOOKER_CLIENT_SECRET": "${LOOKER_CLIENT_SECRET}",
        "LOOKER_VERIFY_SSL": "true"
      }
    },
    "bigquery": {
      "command": "npx",
      "args": ["-y", "@toolbox-sdk/server@1.13.1", "--prebuilt", "bigquery", "--stdio"],
      "env": { "BIGQUERY_PROJECT": "<proyecto-gcp-de-facturacion>" }
    }
  }
}
```
En Windows, si `npx` no se resuelve, usa `"command": "cmd", "args": ["/c", "npx", ...]`. Si la
plataforma no expande `${VAR}`, define las variables en el entorno del sistema y omite esas
claves. Verifica la sintaxis exacta en la documentación vigente de Antigravity.

### MCP de BigQuery (opcional)
`--prebuilt bigquery` usa Application Default Credentials (`gcloud auth application-default login`,
que lo hace **el usuario**). Herramientas: `execute_sql`, `list_dataset_ids`, `list_table_ids`,
`get_table_info`, etc.

### MCP de navegador (si la plataforma no trae uno)
- Chrome DevTools MCP: `npx -y chrome-devtools-mcp@latest` (controla un Chrome; el usuario inicia
  sesión en LS y Looker en esa ventana).
- Playwright MCP: `npx -y @playwright/mcp@latest`.

## Permisos necesarios

### Looker (usuario que opera el navegador)
- Rol con `develop`, `see_lookml`, `see_lookml_dashboards`, `deploy` (si el agente desplegará),
  `use_sql_runner` (para `sql_queries`), `explore`, `save_content`, `manage_spaces` en la carpeta
  destino.
- Acceso al proyecto LookML y a la conexión (p. ej. `bigquery_bi-icsa`).
- Modo desarrollo activable. El workspace dev del usuario es su rama personal
  (`dev-<nombre>-<hash>`).

### Looker (credenciales del MCP)
- API3 key de un usuario con, al menos, `access_data`, `see_lookml_dashboards`, `explore` sobre el
  modelo. El MCP consulta **producción**: no ve cambios en dev hasta el deploy.

### Looker Studio
- El usuario debe tener acceso de **edición** al reporte (la extracción usa el modo edición:
  `…/reporting/<reportId>/page/<pageId>/edit`) y acceso de lectura a sus fuentes de datos.

### BigQuery
- Lectura (`roles/bigquery.dataViewer`) de las tablas origen que usa LS.
- Para crear las vistas pasarela: `roles/bigquery.dataEditor` en el dataset destino y
  `roles/bigquery.jobUser` en un proyecto de facturación.
- **La cuenta de servicio de la conexión de Looker** debe poder leer el dataset destino **y las
  tablas origen**. Una vista normal se evalúa con los permisos de quien consulta. Si no los tiene,
  pide al administrador que autorice la vista (*authorized view*) o que otorgue la lectura.

## Reglas de seguridad y autorización

| Acción | Quién | Condición |
|---|---|---|
| Iniciar sesión en LS, Looker, Google, gcloud | **Usuario** | Siempre. El agente nunca escribe contraseñas ni cierra sesión |
| Leer definiciones, correr SELECT de validación | Agente | Libre |
| Crear o reemplazar vistas en BigQuery | Agente | **OK explícito del usuario** en esa sesión |
| Escribir archivos en el workspace dev de Looker | Agente | Libre (es su rama dev), avisando |
| Commit + deploy a producción | Agente o usuario | Solo si el usuario autorizó al agente; si no, lo hace el usuario |
| Tocar archivos de otros equipos en el workspace | Agente | Solo con OK explícito, mínimo cambio y avisando |
| Ejecutar DDL pegado por el usuario "como referencia" | — | **No**: solo si lo pide explícitamente |

Si la plataforma bloquea una escritura (clasificadores de seguridad, permisos), no la reintentes
por otra vía. Entrega el archivo al usuario para que lo pegue en el IDE y continúa.

## Prueba de humo de accesos (fase 0)

1. MCP Looker: `get_models` lista los modelos.
2. Navegador en Looker: en la consola, `document.querySelector('meta[name=csrf-token]').content`
   devuelve un token.
3. Navegador en LS (modo edición): `scripts/ls_extraer_reporte.js` paso 1 captura el XSRF, y
   `getReport` responde 200.
4. SQL: `sql_queries` con `SELECT 1` responde por la conexión.
5. Si algo falla por sesión expirada (401 o redirección a login), pide al usuario que inicie sesión
   de nuevo. No lo hagas tú.
