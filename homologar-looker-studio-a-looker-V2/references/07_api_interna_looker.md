# 07 · API interna de Looker (desde la pestaña logueada)

La API pública (`/api/4.0/...`) requiere un token OAuth y da 401 desde el navegador. La **API
interna** (`/api/internal/...`) usa la cookie de sesión más el header `X-CSRF-Token`, cuyo valor se
lee del meta tag. Hay que llamarla con `fetch` **desde una pestaña de Looker** donde el usuario
haya iniciado sesión. Así se opera en el **workspace dev** del usuario.

Helpers listos: `scripts/looker_api_helpers.js` (pégalo una vez por pestaña; queda en
`window.LK`).

```js
const csrf=document.querySelector('meta[name="csrf-token"]').content;
const H={'X-CSRF-Token':csrf,'Content-Type':'application/json','Accept':'application/json'};
const J=async r=>{const t=await r.text();try{return JSON.parse(t.replace(/^\)\]\}'\s*/,''))}catch(e){return t}};
```

Algunas respuestas traen el prefijo `)]}'`; quítalo siempre antes de parsear.

## Archivos del proyecto (workspace dev)

| Operación | Llamada | Notas |
|---|---|---|
| Listar proyecto y archivos | `GET /api/internal/projects/<P>` | `.files` agrupado por categoría (`model`, `view`, `dashboard`, `javascript`, `documentation`, …). Cada archivo trae `git_status.full_status` (para saber qué está modificado) |
| Leer archivo | `GET /api/internal/projects/<P>/files/<encodeURIComponent(ruta)>` | Devuelve `contents` (plural) y `digest` |
| Crear archivo | `POST /api/internal/projects/<P>/files` con `{path:"<carpeta>/<base>", type:"<tipo>"}` | Looker agrega la extensión según `type`: `view`→`.view.lkml`, `model`→`.model.lkml`, `dashboard`→`.dashboard.lookml`, `javascript`→`.js`, `documentation`→`.md`, `custom`→`.lkml`. Con `type:'file'` resulta `.file.lkml` (incorrecto) |
| Escribir archivo | `PUT /api/internal/projects/<P>/files/<encodeURIComponent(ruta)>` con `{file_contents, file_digest}` | Los nombres de campo son `file_contents` y `file_digest`. Si mandas `contents`/`digest`, da 400 "modified from another tab". El digest viene del GET previo |
| Tipos válidos | `GET /api/internal/projects/<P>/file_extensions` | No admite binarios (PDF, PNG). Para documentación, usa `.md` |
| Borrar archivo | `DELETE /api/internal/projects/<P>/files/<enc>` | Solo con OK del usuario |

**Codificación de rutas:** usa `encodeURIComponent` sobre la **ruta completa**, de modo que las
barras queden como `%2F`. Con barras literales da 404.

**Verificación tras escribir:** relee el archivo y compara `contents.length` o el SHA-256
(`crypto.subtle.digest`) con el contenido local. Los finales de línea deben ser `\n`.

**Archivos grandes desde el agente:** si el contenido es grande y la herramienta de JS tiene
límite de tamaño, pásalo por partes. Por ejemplo:
1. guarda trozos en base64 en `window.__parts`;
2. únelos;
3. decodifícalos con `TextDecoder('utf-8')`;
4. haz el PUT.

## Validación del proyecto

```js
const v=await fetch('/api/internal/core/4.0/projects/<P>/validate',{method:'POST',headers:H}).then(J);
const errores=(v.errors||[]).filter(e=>e.severity==='error').map(e=>[e.message,e.file_path,e.line_number]);
```

- Mira **todo** el proyecto, no solo tus archivos: un error en cualquier archivo bloquea el commit
  y el deploy.
- Los warnings de otros equipos no bloquean, pero repórtalos al usuario como ajenos.

## Git (estado)

| Operación | Llamada |
|---|---|
| Ramas y estado | `GET /api/internal/core/4.0/projects/<P>/git_branches`: la entrada de `master`/`main` trae `remote_ref` (el commit desplegado). La rama dev muestra `ahead_count`/`behind_count` |
| Rama activa | `GET /api/internal/core/4.0/projects/<P>/git_branch` |

Commit, push y deploy se hacen por la **UI del IDE** (ver `09_deploy.md`). Así se respetan los
hooks y validaciones de Looker.

## Queries y SQL

| Operación | Llamada |
|---|---|
| SQL crudo | `POST /api/internal/core/4.0/sql_queries {connection_name, sql}` → `slug`, luego `POST …/sql_queries/<slug>/run/json` |
| Crear query | `POST /api/internal/core/4.0/queries {model, view, fields, filters, filter_expression, sorts, pivots, total, row_total, limit, vis_config, dynamic_fields}` → `id` |
| Leer query | `GET /api/internal/core/4.0/queries/<id>` |
| Ejecutar | `GET /api/internal/core/4.0/queries/<id>/run/json` (o `json_detail`, que incluye `rendered`, totales y metadatos de campos) |

Las queries son **inmutables**. Para cambiar la `vis_config` de un mosaico de un UDD, crea otra
query y apunta el mosaico a ella (ver abajo).

## Dashboards de usuario (UDD): borradores y legado

Úsalos para prototipar rápido con el MCP o para mantener legado. La versión final va en
`.dashboard.lookml`.

| Operación | Llamada |
|---|---|
| Detalle | `GET /api/internal/core/4.0/dashboards/<id>?fields=dashboard_elements(...),dashboard_layouts(...),dashboard_filters(...)` |
| **Exportar a LookML** | `GET /api/internal/core/4.0/dashboards/lookml/<id>` → `{lookml}`. La ruta `dashboards/<id>/lookml` da 404 |
| Copiar | `POST /api/internal/core/4.0/dashboards/<id>/copy?folder_id=<f>` |
| Editar mosaico | `PATCH /api/internal/core/4.0/dashboard_elements/<id>` con `{title, title_hidden, body_text, query_id, result_maker:{query_id, filterables:[{model, view, listen:[{dashboard_filter_name, field}]}], sorts, total}}` |
| Posición | `PATCH /api/internal/core/4.0/dashboard_layout_components/<id>` con `{row, column, width, height}` |
| Borrar mosaico | `DELETE /api/internal/core/4.0/dashboard_elements/<id>` (el MCP no puede borrar) |

Limitaciones del MCP con UDD:
- `add_dashboard_element` y `update_dashboard_element` guardan **solo el primer** `listen`. Los
  demás se conectan con un PATCH de `result_maker.filterables[0].listen`, preservando `id`,
  `query_id`, `sorts` y `total`.
- Cambiar la `vis_config` de un mosaico requiere crear una query nueva (con
  `vis_config`/`series_labels`/`advanced_vis_config`) y luego hacer PATCH de `query_id` y
  `result_maker`, preservando los `filterables`.

## Estado de la app / sesión

- `GET /api/internal/app_state` sirve para comprobar, entre otras cosas, si una vis del manifest
  está cargada (busca su id en el texto).
- Si la sesión expira, todo devuelve 401 o redirige a login. El usuario debe iniciar sesión de
  nuevo. El MCP sigue funcionando con su API key.
