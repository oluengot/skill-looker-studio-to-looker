# 05 · Capa semántica LookML

## Estructura de archivos en el proyecto

```
<carpeta>/                         p. ej. 01_DM/INF_CLUB_URGENCIA/
├─ <modelo>.model.lkml             conexión, includes, datagroup, explores
├─ <prefijo><fuente>.view.lkml     una vista por fuente LS (cu_pagos.view.lkml…)
├─ visualizaciones/<vis>.js        vis custom (registradas en manifest.lkml del proyecto)
├─ dashboard/<pagina>.dashboard.lookml   un dashboard por página LS
└─ INFORME_TECNICO.md              (opcional) documentación dentro del proyecto (type documentation)
```

## Modelo (`templates/modelo.template.model.lkml`)

```lookml
connection: "<conexion>"

include: "/<carpeta>/*.view.lkml"
## DASHBOARDS LookML (fuente oficial; el banner enlaza a <modelo>::<pagina>)
include: "/<carpeta>/dashboard/*.dashboard"

datagroup: actualizacion_<proyecto> {
  sql_trigger: SELECT MAX(<fecha_carga>) FROM `<dataset>.VW_<FUENTE_PRINCIPAL>` ;;
  max_cache_age: "1 hour"
}
persist_with: actualizacion_<proyecto>

explore: <prefijo><fuente> {
  label: "<Proyecto> - <Fuente>"
  description: "<qué responde este explore>. Fuente: <dataset>.VW_<FUENTE>."
  tags: ["dominio:<dominio>", "equipo:<equipo>", "<proyecto>"]
  group_label: "<Proyecto>"
}
```

- Un explore por vista (como cada fuente de LS). Usa `join` solo si LS hacía un *blend*.
- Todas las rutas de `include` son absolutas (`/carpeta/...`). En `manifest.lkml`, el `file:` de
  una vis va **sin** `/` inicial: una `/` inicial rompió todos los modelos en dev del caso real.

## Vista (`templates/vista.template.view.lkml`)

```lookml
view: <prefijo><fuente> {
  sql_table_name: `<dataset>.VW_<FUENTE>` ;;
  # Fuente Looker Studio: <nombre fuente> (páginas: …). Documentado según el estándar de capa
  # semántica para agentes IA. SQL/type/value_format validados 1:1 contra LS.

  dimension: ... { }
  dimension_group: ... { type: time  timeframes: [raw, date, week, month, quarter, year]
                         convert_tz: no  datatype: date  sql: ${TABLE}.FECHA ;; }
  measure: ... { }
}
```

Reglas:
- `convert_tz: no` y `datatype: date` en columnas `DATE`, para no correr el día por la zona
  horaria.
- Las columnas técnicas (RUT, ids, flags auxiliares) van con `hidden: yes` si no se exponen.
- `group_label` por página de LS (`"Venta URG"`, `"Actividad URG"`) para ordenar el selector de
  campos.
- **No reutilices una medida entre páginas si su fórmula difiere en LS.** Crea una variante con
  prefijo (`act_frecuencia_club` vs `frecuencia_club`). La medida ya validada no se toca.
- Ratios, porcentajes e índices se calculan desde medidas base (`SAFE_DIVIDE(${num}, ${den})`) con
  `required_fields`.
- Índices de encuesta (NPS/ISN):
  `SAFE_DIVIDE(${promotores} - ${detractores}, ${respuestas}) * 100`, a partir de las sumas.
  Valida que, a nivel fila, coincida con la columna final de origen.
- Barras negativas en combos (p. ej. % detractores hacia abajo): crea una **medida** negativa
  (`-SAFE_DIVIDE(...)*100`). No uses table calculations.
- Si un gráfico necesita el mismo índice con otro formato (entero en la tabla, % en la línea), crea
  otra medida con su `value_format` (`nps` vs `nps_pct`).
- Mes en español ordenado: dimensión `string` con `CASE` (`Ene`…`Dic`) + `' ' + año`, y
  `order_by_field` a una dimensión oculta `yyyymm`.

## Estándar de capa semántica para agentes de IA (obligatorio)

Todo campo **visible** (dimensión, dimension_group, medida) y todo explore lleva:

| Parámetro | Regla | Ejemplo |
|---|---|---|
| `label` | Nombre de negocio, único dentro de la vista (no repetir labels entre conteo y %) | `"% Promotores"` |
| `description` | **3 partes**: (1) qué es · (2) lógica/valores posibles/cómo se calcula · (3) cuándo usarlo. Las medidas **declaran la unidad o el formato** | "Cantidad de pacientes distintos atendidos… Se calcula como COUNT_DISTINCT(RUT)… El valor se expresa como número entero de pacientes." |
| `synonyms` | Al menos 3: español, inglés y acrónimos | `["pacientes club", "socios", "club patients"]` |
| `tags` | `dominio:<x>`, `tipo:dimension\|tiempo\|kpi`, `equipo:<x>`, `<proyecto>` | `["dominio:comercial","tipo:kpi","equipo:bi","club_urgencia"]` |
| `required_fields` | En medidas derivadas (tasas, %, restas) | `required_fields: [respuestas, promotores]` |
| `suggestions` | En dimensiones categóricas de pocos valores | `["01. CLC", "02. NCC"]` |

Prohibido:
- `label_short:` **no es un parámetro LookML válido** (rompe la validación y el deploy). El
  `label_short` que ve una vis se deriva del label. Para renombrar un encabezado, usa la opción de
  la vis (`renombrar`) o `series_labels`.
- Cambiar `sql`, `type`, `filters` o `value_format` al documentar. La documentación debe ser
  **neutral en números**: compara una query antes y después del cambio.

Auditoría rápida (una vista es apta para agentes si se cumple todo):
- [ ] Ningún campo visible sin `description`.
- [ ] No hay labels duplicados dentro de una vista.
- [ ] Las medidas declaran la unidad.
- [ ] Los ratios tienen `required_fields`.
- [ ] No quedan dimensiones muertas (sin uso y sin sentido de negocio).
- [ ] Los explores tienen `description` y `tags`.

## Visualización custom (tablas y KPI)

- Archivo JS en `<carpeta>/visualizaciones/`, registrado en `manifest.lkml`:
  ```lookml
  visualization: {
    id: "<vis_id>"
    label: "<Proyecto> - Tabla / KPI"
    file: "<carpeta>/visualizaciones/<vis_id>.js"
  }
  ```
  En los dashboards se referencia como `type: <PROYECTO>::<vis_id>`.
- **Solo existe después del deploy a producción**: en modo dev no aparece en el selector. Despliega
  la vis antes de armar los dashboards que la usan.
- Base reutilizable: `assets/vis_tabla_custom.js`. Copia el archivo y cambia `id`/`label`. Las
  opciones son las claves que van en el mosaico o en la `vis_config`:

  | Clave | Valores / uso |
  |---|---|
  | `modo` | `auto`, `tabla`, `kpi`, `tarjetas` (un KPI por valor de la dimensión), `matriz` |
  | `titulo`, `subtitulo` | Texto dentro de la vis |
  | `color_principal` | Color del encabezado (default `#224073`) |
  | `transponer` | `true` = medidas como filas, valores de la dimensión como columnas |
  | `mostrar_total` | Muestra la fila Total (la query necesita `total: true`) |
  | `orden_inicial` | `"total desc"`, `"2 desc"`, `"Inscritos asc"` |
  | `ocultar_pivot_nulo` | Oculta la columna nula del pivot |
  | `renombrar` | `"vista.campo=Etiqueta; …"`. Por nombre de campo, que es determinista; también acepta `"Label=Nuevo"` |
  | `tamano_fuente` | px (default 13) |
  | `mostrar_copiar` | Botón Copiar para Excel |
  | `jerarquia`, `jerarquia_expandida` | Drill down: 2 dimensiones con `subtotals: [dim1]` |
  | `kpi_estilo` | `area` o `studio` (como el scorecard de LS) |
  | `kpi_borde`, `kpi_tamano_valor` | Marco redondeado y tamaño del valor (px) |
  | `tarjetas_orden` | Orden fijo de las tarjetas |
  | `matriz_columnas`, `matriz_filas` | Matriz de KPI (`Grupo \| Etiqueta \| medida1 \| medida2 ; …`) |
- La vis usa el valor `rendered`, que respeta el `value_format` de LookML, y `html` para los
  totales.
- Se ejecuta dentro de un **iframe sandbox**: no puede navegar la ventana principal (solo abrir
  pestañas nuevas), ni medir su alto desde el dashboard. Por eso la navegación entre páginas va en
  un mosaico de texto, no en una vis.

## Subir a desarrollo y validar

Ver `07_api_interna_looker.md`. Resumen:

1. Crea el archivo con `POST /api/internal/projects/<P>/files {path, type}`.
2. Escríbelo con `PUT /api/internal/projects/<P>/files/<encodeURIComponent(ruta)>
   {file_contents, file_digest}`.
3. Relee el archivo y compara longitud o SHA-256 con el local.
4. Valida con `POST /api/internal/core/4.0/projects/<P>/validate` y filtra `severity === 'error'`.
5. Prueba en dev: abre el explore en la UI, o corre la query del mosaico. Recuerda que **el MCP va
   contra producción**.
6. Para ver el error real de un modelo roto en dev, abre el Explore en la UI: la API solo dice
   "Model Error".
