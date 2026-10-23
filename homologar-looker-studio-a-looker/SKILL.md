---
name: homologar-looker-studio-a-looker
description: Migra (homologa 1:1) cualquier reporte de Looker Studio a Looker (Looker Platform / Looker Core) con valores idénticos, misma interacción y mismo formato. Cubre extracción de la definición del reporte de Looker Studio, linaje y vistas pasarela en BigQuery, traducción de campos calculados a LookML, capa semántica apta para agentes de IA, dashboards LookML (.dashboard.lookml) con filtros, banner de navegación y visualizaciones personalizadas, validación por SQL, commit y deploy. Usar cuando el usuario pida migrar, homologar, traspasar, replicar o rehacer un dashboard o reporte de Looker Studio (Data Studio) en Looker, o continuar/ajustar una migración ya hecha.
---

# Homologar Looker Studio → Looker (1:1)

Este skill describe, paso a paso, cómo llevar **cualquier** reporte de Looker Studio (LS) a Looker
con el **mismo resultado**: los mismos números, la misma interacción (filtros, navegación,
drill down) y el mismo formato. Está escrito para que lo siga **cualquier agente de IA** (Claude
Code, Google Antigravity, Gemini CLI, Cursor, Codex, etc.). Lo único que cambia entre plataformas
es el nombre de las herramientas; ver `references/01_herramientas_y_accesos.md`.

Se obtuvo de una migración real terminada: "Club Urgencia Interclínica" (8 páginas, 9 vistas
LookML, 8 dashboards LookML, todos los valores cuadrados 1:1). Ese caso aparece como **ejemplo**
en todo el skill; los nombres concretos (`club_urgencia`, `bi-icsa`, `cu_*`) son ilustrativos y se
reemplazan por los parámetros del proyecto nuevo.

## Prioridades (no negociables)

1. **Valores** idénticos a LS (cada número de cada mosaico, totales incluidos).
2. **Interacción**: filtros, valores por defecto, qué mosaico escucha qué filtro, navegación
   entre páginas, drill down, orden.
3. **Formato**: colores, títulos, formato numérico, posición y tamaño.

Si una mejora de formato pone en riesgo un valor, **gana el valor**. Nada se da por terminado sin
una validación numérica documentada (fase 7).

## Reglas de oro

- **Validar antes de escribir y después de publicar.** Primero se cuadra la fórmula con SQL contra
  los valores que muestra LS. Recién entonces se escribe el LookML. Al final se vuelve a validar el
  dashboard renderizado.
- **La fuente de verdad del dashboard es el archivo `.dashboard.lookml`** (versionado en git del
  proyecto). No dejes la versión final como dashboard de usuario (UDD). Los UDD sirven solo como
  borrador o legado.
- **Una página de LS = un dashboard LookML** (sin pestañas nativas). Se navega con un banner HTML
  que enlaza a `/embed/dashboards/<modelo>::<dashboard>`.
- **No cambiar `sql`, `type`, `filters` ni `value_format` de un campo ya validado** al documentar
  o refactorizar. Si hace falta otra variante, crea un campo nuevo (p. ej. `act_*`) y deja intacto
  el que ya usa otra página.
- **Los datos quedan en el dataset destino del área.** Se crean vistas pasarela
  `VW_*` que leen las mismas tablas que LS. No se usan copias congeladas.
- **Acciones del usuario**: iniciar sesión (Looker, LS, Google, gcloud) lo hace siempre el usuario.
  Crear objetos en BigQuery y hacer commit+deploy requieren su **autorización explícita**.
  Nunca escribas credenciales en archivos versionados.
- **El workspace de desarrollo puede estar compartido.** Antes de commitear, revisa qué archivos
  están modificados y avisa al usuario de los que no son de esta migración. No toques trabajo ajeno
  sin su OK.

## Parámetros del proyecto (llenar al inicio)

Copia `templates/ficha_proyecto.template.md` como `ficha_proyecto.md` en la carpeta de trabajo y
complétala con el usuario. No avances a la fase 2 con parámetros vacíos.

| Parámetro | Ejemplo (Club Urgencia) |
|---|---|
| URL del reporte LS + `reportId` | `lookerstudio.google.com/reporting/622b3191-…` |
| Instancia Looker | `https://interclinica.cloud.looker.com` |
| Proyecto LookML | `BI` (repo git `Interclinica-LookerPlatform/Capa_Semantica_Oficial`) |
| Carpeta en el proyecto | `01_DM/INF_CLUB_URGENCIA/` |
| Modelo nuevo | `club_urgencia` |
| Conexión Looker | `bigquery_bi-icsa` |
| Dataset destino (vistas pasarela) | `bi-icsa.INF_CLUB_URGENCIA` |
| Prefijo de vistas/explores | `cu_` |
| Visualización custom de tablas/KPI | `BI::club_urgencia_tabla` |
| Paleta / brand | `#224073`, `#34ACB0`, `#75AD17`, `#AAD1D5`, `#165089` |
| Autorizaciones | deploy por el agente: sí/no · crear vistas BQ: sí/no |

## Flujo (10 fases con puertas de control)

Cada fase termina en una **puerta**. No pases a la siguiente sin cumplirla. El detalle operativo de
cada fase está en `references/`.

### Fase 0. Preparación y accesos → `references/01_herramientas_y_accesos.md`
- Verifica que tienes: navegador controlable con sesión en LS y en Looker, MCP de Looker (API key
  propia) y forma de ejecutar SQL (conexión de Looker vía `sql_queries`, MCP de BigQuery o REST).
- **Pregunta al usuario qué equipo usar**: `/equipo` (costo-eficiente), `/equipo-max` (máxima calidad) o sin equipo (ver sección "Equipo de agentes").
- Navegador: en Antigravity y otros agentes sin navegador propio, instala la extensión `open-claude-in-chrome` (ver `references/01_herramientas_y_accesos.md`); en Claude Code usa `mcp__claude-in-chrome__*`.
- Llena la ficha del proyecto. Crea la carpeta de trabajo local (`<Nombre>/` con `README.md`).
- **Puerta:** `get_models` del MCP responde. La pestaña de Looker tiene `meta[name=csrf-token]`.
  La pestaña de LS (modo edición) responde `getReport`.

### Fase 1. Inventario del reporte LS → `references/02_extraccion_looker_studio.md`
- Extrae con `scripts/ls_extraer_reporte.js`:
  - las páginas (pageId, nombre, orden);
  - los componentes por página (tipo, posición y tamaño, dimensiones, métricas, filtros, rango de
    fechas, orden, estilo);
  - los controles (fecha, listas) con sus valores por defecto;
  - los filtros de reporte y de página;
  - las fuentes de datos (tabla física BigQuery + campos calculados con su fórmula).
- Captura los **valores que LS muestra** de cada mosaico. Puedes leer las respuestas
  `batchedDataV2` con las herramientas de red o tomar capturas de pantalla.
- Escribe una **spec por página** (`specs/<pagina>.md`, plantilla `templates/spec_pagina.template.md`).
- **Puerta:** cada mosaico de cada página tiene, en su spec, fuente, fórmula, filtros, rango de
  fechas y valor esperado.

### Fase 2. Capa de datos (BigQuery) → `references/03_capa_datos_bigquery.md`
- Por cada fuente LS, identifica la tabla física. Crea en el dataset destino una vista pasarela:
  `CREATE VIEW <dataset>.VW_<FUENTE> AS SELECT * FROM <tabla origen>` (`templates/vistas_pasarela.template.sql`).
- **Requiere OK explícito del usuario** (es crear objetos compartidos). Verifica que la cuenta de
  servicio de la conexión de Looker puede leer la tabla origen.
- **Puerta:** `SELECT COUNT(*)` por la conexión de Looker devuelve lo mismo que la tabla origen.

### Fase 3. Traducción de fórmulas y validación SQL → `references/04_traduccion_formulas.md` + `references/06_validacion.md`
- Traduce cada campo calculado de LS a SQL BigQuery. Cuidado con las trampas: `REGEXP_MATCH` es
  de cadena completa, distinguir `COUNT_DISTINCT` de `SUM` de flags, condiciones de lanzamiento por
  entidad, `>` vs `>=`, y sobre qué fecha se compara.
- Para cada mosaico, escribe la consulta SQL equivalente (mismos filtros y rango) y compárala con
  el valor de LS.
- **Puerta:** 100 % de los valores cuadran (diferencias solo explicables por refresco de datos y
  documentadas). Guarda la matriz en `validacion_<pagina>.md`.

### Fase 4. Capa semántica LookML → `references/05_capa_semantica_lookml.md`
- Una vista por fuente (`<prefijo><fuente>.view.lkml`) y un explore por vista en el modelo nuevo,
  con datagroup de caché.
- Cada campo visible sigue el **estándar para agentes de IA**:
  - `label`;
  - `description` en 3 partes;
  - `synonyms` (al menos 3);
  - `tags` (dominio/tipo/equipo/proyecto);
  - `required_fields` en las medidas derivadas;
  - unidad declarada.
- Las medidas replican la fórmula validada en la fase 3. Los ratios se recalculan desde sumas
  (nunca `SUM(ratio)`).
- **Puerta:** `validate` del proyecto da 0 errores en tus archivos. Las queries de los explores en
  modo dev devuelven los valores de la fase 3.

### Fase 5. Subida a desarrollo → `references/07_api_interna_looker.md`
- Crea o actualiza los archivos en el workspace dev del proyecto con la API interna del IDE
  (`POST/PUT /api/internal/projects/<P>/files`) o pegándolos en el IDE.
- Verifica que lo guardado es idéntico byte a byte (longitud o SHA-256).
- **Puerta:** archivo guardado = archivo local, y validate da 0 errores.

### Fase 6. Dashboards LookML → `references/08_dashboards_lookml.md`
- Un archivo `<pagina>.dashboard.lookml` por página, en `<carpeta>/dashboard/`. El modelo lo
  incluye con `include: "/<carpeta>/dashboard/*.dashboard"`. El id queda como `<modelo>::<pagina>`.
- Cada archivo lleva:
  - banner de navegación (mosaico de texto HTML con enlaces embed);
  - encabezado con logo y nombre de la página;
  - barras de sección;
  - mosaicos con la vis custom para tablas y KPI, y vis nativas para gráficos;
  - filtros con los mismos valores por defecto que LS y `listen` explícito por mosaico.
- Usa `filter_expression` para las exclusiones fijas que comparten campo con un filtro de dashboard.
- Usa `title_hidden: true` para los mosaicos sin título.
- **Puerta:** validate da 0 errores, y el dashboard en dev (`/dashboards/<modelo>::<pagina>`)
  renderiza sin errores de mosaico.

### Fase 7. Validación 1:1 del dashboard → `references/06_validacion.md`
- Compara cada mosaico renderizado (dev) contra la matriz de la fase 3:
  - sin filtros;
  - con los filtros por defecto;
  - con al menos un filtro aplicado (p. ej. una clínica o un pilar).
- Revisa la interacción: qué escucha cada filtro, la navegación del banner, el orden y los totales.
- **Puerta:** checklist `references/10_checklists.md` completo, sin pendientes de valor.

### Fase 8. Commit + deploy → `references/09_deploy.md`
- Hazlo solo si el usuario autorizó al agente. Si no, entrégale la lista exacta de archivos y los
  pasos.
- Secuencia:
  1. validate con 0 errores en **todo** el proyecto;
  2. revisar los archivos modificados (avisar de los ajenos);
  3. Commit & Push con un mensaje descriptivo;
  4. Deploy to Production. Si aparece *Pull & Merge*, hazlo, revalida y despliega de inmediato.
- Verifica en producción con el MCP (`run_dashboard <modelo>::<pagina>`, que usa la API de
  producción) y confirma que `master.remote_ref` es tu commit.
- **Puerta:** los valores en producción son iguales a los de la fase 7.

### Fase 9. Documentación y cierre → `references/10_checklists.md`
- Deja en la carpeta local:
  - un README con estado por página, arquitectura, mapa página→dashboard→URL y diferencias
    a propósito;
  - las matrices de validación;
  - el DDL de las vistas;
  - una copia del LookML.
- Opcional: un informe técnico en PDF. Puedes generarlo con un HTML y Chrome headless
  (`--print-to-pdf`).
- Reporta al usuario qué quedó, qué valores se validaron y qué queda pendiente o decidido distinto.

## Mantenimiento posterior (cambios sobre una migración ya hecha)

- **Todo cambio se hace en el `.dashboard.lookml`**:
  1. `GET` del archivo (`contents` + `digest`);
  2. editar;
  3. `PUT` (`file_contents` + `file_digest`);
  4. validate;
  5. probar en dev;
  6. commit + deploy;
  7. verificar en producción.
- Si LS cambia (el diseñador modifica una página), re-extrae solo esa página, actualiza la spec,
  revalida por SQL y crea medidas nuevas en lugar de modificar las que ya usan otras páginas.
- Si cambias el `label` de una medida usada en gráficos, fija `series_labels` en esos mosaicos para
  que la leyenda no cambie.

## Equipo de agentes: preguntar al usuario antes de empezar

**Al iniciar la fase 0, pregunta SIEMPRE una vez** (Claude Code: `AskUserQuestion`; Antigravity: `ask_question`)
cómo quiere trabajar, explicando la diferencia en una línea cada opción:

| Opción | Cuándo conviene |
|---|---|
| **`/equipo`** (costo-eficiente) | Migraciones normales o de muchas páginas parecidas; el modelo caro solo planifica y revisa, el barato construye |
| **`/equipo-max`** (máxima calidad, sin importar costo) | Reportes críticos, fórmulas complejas, valores que deben cuadrar sí o sí, o cuando ya hubo errores en una pasada anterior |
| **Sin equipo** (el agente principal hace todo) | Ajustes chicos sobre una migración ya hecha (mantenimiento de 1–2 archivos) |

No elijas por tu cuenta ni asumas la respuesta anterior: pregunta en cada migración. Una vez elegido,
sigue el protocolo de esa skill (plan en `.equipo/<slug>/`). Si el comando no está instalado, indícalo y
ofrece instalarlo desde su repo (ver tabla) antes de seguir.

Una migración de varias páginas se reparte bien entre agentes: una **página de LS = una tarea**
(spec → vistas/medidas → dashboard → validación), y las tareas de páginas distintas no comparten archivos.
Los archivos comunes (modelo, banner de navegación, ficha) van a una tarea de integración al final.

| Plataforma | Costo-eficiente | Máxima calidad (sin importar costo) |
|---|---|---|
| Claude Code | `/equipo` (jefe Opus, constructores Haiku, supervisor Sonnet) o `/dividir` | `/equipo-max` (todo Opus: `jefe`, constructores y `revisor`) |
| Antigravity | `/equipo` (jefe Pro, constructores Flash) | `/equipo-max` (todos Pro: `jefe-max`, `constructor-max`, `revisor-max`) |

Plantillas: repos `oluengot/equipo-agentes-claude`, `oluengot/equipo-agentes-antigravity` y
`oluengot/equipo-agentes-antigravity-max`. Reglas: el jefe planifica con la ficha del proyecto como pedido; los
constructores nunca autorizan por sí mismos acciones de la sección "Reglas de oro" (crear vistas en BigQuery,
commit y deploy requieren OK del usuario); el revisor repite la validación numérica de la fase 3/7 en vez de
confiar en el reporte del constructor.

### Despliegue: `tools/looker_deploy.py` (camino por defecto de la fase 8)

Aplica los archivos LookML y los lleva a producción **por git + API pública con API key**, sin UI, sin
cookie/CSRF y sin tocar el workspace dev compartido. Siempre parte de `origin/<producción>` recién traído
(no existe "Pull & Merge"), valida la rama (separa errores propios de ajenos), despliega con
`deploy_to_production` (sobre la rama temporal), verifica que producción quedó en el commit y reintenta solo si producción
avanzó. Detalle y fallas en `references/09_deploy.md`.

```bash
python tools/looker_deploy.py doctor --deep          # una vez por PC: credenciales, permisos, git, circuito completo
python tools/looker_deploy.py plan --map "<lookml local>=<ruta en el repo>" --file "<manifest local>=manifest.lkml"
python tools/looker_deploy.py ship --map ... -m "mensaje" --yes   # sin --yes solo muestra el plan
python tools/looker_deploy.py status | validate | rollback --commit <sha> --yes
```
Requisitos: Python 3.9+, git, `LOOKER_BASE_URL`/`LOOKER_CLIENT_ID`/`LOOKER_CLIENT_SECRET` (las del MCP) y
acceso de escritura al repo git del proyecto (Git Credential Manager o `LOOKER_GIT_TOKEN`). Sin `pip install`.
`--yes` = autorización explícita del usuario (regla de oro de la fase 8). La UI del IDE queda solo como
plan B si `doctor` no pasa.

## Mapa de archivos del skill

| Archivo | Para qué |
|---|---|
| `references/01_herramientas_y_accesos.md` | Herramientas/MCP por plataforma (Claude Code, Antigravity, genérico), permisos Looker/BigQuery/LS, configuración MCP |
| `references/02_extraccion_looker_studio.md` | Cómo leer la definición completa de un reporte LS (API interna `getReport`, `getBlockDatasource`, `batchedDataV2`) |
| `references/03_capa_datos_bigquery.md` | Vistas pasarela, linaje, permisos, verificación |
| `references/04_traduccion_formulas.md` | Equivalencias LS → BigQuery SQL → LookML, mapeo de componentes y controles |
| `references/05_capa_semantica_lookml.md` | Estructura de vistas, explores, modelo y el estándar de capa semántica para agentes IA |
| `references/06_validacion.md` | Método de validación numérica, SQL por la conexión de Looker, tolerancias, matriz |
| `references/07_api_interna_looker.md` | Endpoints de la API interna de Looker (archivos, validate, git, queries, dashboards) con código |
| `references/08_dashboards_lookml.md` | Anatomía del `.dashboard.lookml`, filtros, `listen`, grilla, banner, encabezado, vis custom, gráficos |
| `references/09_deploy.md` | Commit, deploy, Pull & Merge, verificación en producción, rollback |
| `references/10_checklists.md` | Checklists por página, QA final, entregables |
| `references/11_trampas_y_lecciones.md` | Catálogo de trampas reales y su solución |
| `references/12_ejemplo_club_urgencia.md` | Caso de referencia completo: mapa final, decisiones y valores validados |
| `templates/` | Ficha de proyecto, spec de página, vista, modelo, dashboard, SQL pasarela, matriz de validación, banner |
| `scripts/ls_extraer_reporte.js` | Extracción del reporte LS desde la consola del navegador |
| `scripts/looker_api_helpers.js` | Helpers de la API interna de Looker (archivos, validate, SQL, queries, git) |
| `assets/vis_tabla_custom.js` | Visualización custom de tabla/KPI/drill down (reutilizable, cambiar id/label) |
| `assets/vis_navegacion.js` | Barra de navegación como vis (solo referencia; se prefirió banner de texto) |
| `tools/looker_deploy.py` | Aplicar y desplegar LookML a producción por git + API pública (doctor/plan/ship/rollback) |

Lee las referencias **a medida que entras a cada fase**, no todas de una vez.
