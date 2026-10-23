# Skill · Homologar Looker Studio → Looker

Skill portable (formato **Agent Skills**: carpeta con `SKILL.md` + recursos) que guía a un agente de
IA para migrar **cualquier** reporte de Looker Studio a Looker con resultado 1:1 (valores,
interacción y formato). Destila el proceso completo del desarrollo
[`Club Urgencia Looker/`](../Club%20Urgencia%20Looker/README.md).

## Contenido

```
homologar-looker-studio-a-looker/
├─ SKILL.md                         flujo en 10 fases con puertas de control (punto de entrada)
├─ references/
│  ├─ 01_herramientas_y_accesos.md  MCP/herramientas por plataforma, config, permisos, seguridad
│  ├─ 02_extraccion_looker_studio.md   API interna de LS (getReport, getBlockDatasource, batchedDataV2)
│  ├─ 03_capa_datos_bigquery.md     vistas pasarela VW_*
│  ├─ 04_traduccion_formulas.md     funciones LS→SQL→LookML, componentes, rangos, formatos
│  ├─ 05_capa_semantica_lookml.md   vistas/explores/modelo + estándar para agentes IA + vis custom
│  ├─ 06_validacion.md              validación V1/V2/V3, SQL por conexión Looker, tolerancias
│  ├─ 07_api_interna_looker.md      archivos, validate, git, queries, UDD
│  ├─ 08_dashboards_lookml.md       anatomía .dashboard.lookml, filtros, grilla, banner, gráficos
│  ├─ 09_deploy.md                  commit/deploy/Pull & Merge/verificación/rollback
│  ├─ 10_checklists.md              checklists por fase, QA y entregables
│  ├─ 11_trampas_y_lecciones.md     40 trampas reales con solución
│  └─ 12_ejemplo_club_urgencia.md   caso de referencia y valores validados
├─ templates/                       ficha de proyecto, spec de página, vista, modelo, dashboard,
│                                   SQL pasarela, matriz de validación, banner/encabezado HTML
├─ tools/
│  └─ looker_deploy.py              aplicar y desplegar LookML por git + API pública (doctor/plan/ship/rollback)
├─ scripts/
│  ├─ ls_extraer_reporte.js         extracción del reporte LS desde la consola (window.LS)
│  └─ looker_api_helpers.js         API interna de Looker (window.LK): leer/escribir/validar/SQL
└─ assets/
   ├─ vis_tabla_custom.js           vis custom tabla/KPI/drill down reutilizable
   └─ vis_navegacion.js             (referencia) barra de navegación como vis
```

## Novedades (oct 2026)

- Pregunta al inicio si usar `/equipo`, `/equipo-max` o ningún equipo.
- Guía de la extensión `open-claude-in-chrome` para controlar tu Chrome real desde Antigravity (`references/01`).
- `tools/looker_deploy.py` para aplicar y desplegar sin la UI (primero `doctor --deep`).

## Instalación

La carpeta que se instala es **`homologar-looker-studio-a-looker/`** (no esta carpeta padre).

### Claude Code
Ya está instalada como skill personal en `~/.claude/skills/homologar-looker-studio-a-looker/`.
Se activa sola cuando pides migrar u homologar un Looker Studio a Looker. También puedes
nombrarla. Para reinstalarla después de editar el skill en el repo:

```bash
cp -r "/c/Users/oluengo/Desarrollos Cloude/Skill Homologar Looker Studio/homologar-looker-studio-a-looker" ~/.claude/skills/
```

### Google Antigravity 2.0
Antigravity usa el mismo formato de skills (`SKILL.md` con `name` y `description` en el
frontmatter):
- **Global** (todos los workspaces): copia la carpeta a `~/.gemini/antigravity/skills/`.
- **Por workspace**: copia la carpeta a `<workspace>/.agent/skills/`.

```bash
mkdir -p ~/.gemini/antigravity/skills && cp -r "/c/Users/oluengo/Desarrollos Cloude/Skill Homologar Looker Studio/homologar-looker-studio-a-looker" ~/.gemini/antigravity/skills/
```

Después registra los MCP en `mcp_config.json` (Agent panel → MCP Servers → Manage → View raw
config). Usa el bloque de `references/01_herramientas_y_accesos.md` (Looker y, opcionalmente,
BigQuery). En la primera sesión, inicia tú la sesión de Looker Studio y Looker en el navegador del
agente (browser subagent), que usa su propio perfil de Chrome.
Las rutas de skills de Antigravity pueden cambiar entre versiones: si no la detecta, revisa la
documentación vigente o pide al agente que lea `SKILL.md` directamente.

### Cualquier otro agente (Gemini CLI, Cursor, Codex, ChatGPT con herramientas…)
- Si soporta Agent Skills, copia la carpeta a su directorio de skills.
- Si no, agrega al prompt o a las reglas del proyecto (`AGENTS.md`, `.cursor/rules`, etc.):
  "Para migrar reportes de Looker Studio a Looker, sigue
  `<ruta>/homologar-looker-studio-a-looker/SKILL.md` y sus `references/`".
- Si el agente no controla un navegador, los scripts de `scripts/` se pegan en la consola de
  DevTools (F12) y el usuario devuelve el resultado.

## Requisitos (resumen; detalle en `references/01`)
- Navegador controlable con la sesión del usuario en Looker Studio (modo edición) y en Looker
  (modo desarrollo).
- MCP de Looker: `@toolbox-sdk/server --prebuilt looker`, con `LOOKER_BASE_URL`,
  `LOOKER_CLIENT_ID` y `LOOKER_CLIENT_SECRET` como **variables de entorno**, nunca en archivos
  versionados.
- Acceso de lectura a las tablas BigQuery origen. Crear vistas en el dataset destino requiere OK
  del usuario.
- Permisos Looker: develop, see_lookml, use_sql_runner y, si el agente despliega, deploy.

## Mantenimiento del skill
- Cuando una migración enseñe algo nuevo (una trampa, un endpoint, un patrón), agrégalo a
  `references/11_trampas_y_lecciones.md` o a la referencia que corresponda, y reinstala la copia.
- No pongas aquí datos sensibles: ni credenciales ni datos de pacientes. Los valores del ejemplo
  son agregados.
