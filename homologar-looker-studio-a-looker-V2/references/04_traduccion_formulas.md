# 04 · Traducción Looker Studio → SQL BigQuery → LookML

## Funciones de LS y su equivalente

| Looker Studio | BigQuery SQL | LookML / nota |
|---|---|---|
| `SUM(x)` | `SUM(x)` | `type: sum`, `sql: ${x}` |
| `COUNT(x)` | `COUNT(x)` | `type: count` (filas) o `type: number` con `COUNT(...)` |
| `COUNT_DISTINCT(x)` | `COUNT(DISTINCT x)` | `type: count_distinct`, `sql: ${x}`. En los totales Looker **deduplica**: el total no es la suma de las filas, igual que en LS |
| `COUNT_DISTINCT(CASE WHEN c THEN x END)` | `COUNT(DISTINCT IF(c, x, NULL))` | `type: count_distinct`, `sql: CASE WHEN c THEN ${x} END` (sin ELSE) |
| `SUM(CASE WHEN c THEN 1 ELSE 0 END)` | igual | `type: sum`, `sql: CASE WHEN c THEN 1 ELSE 0 END` |
| `AVG(x)` | `AVG(x)` | `type: average` |
| `MAX/MIN(x)` | igual | `type: max/min` (en fechas: `type: date` con `sql: MAX(...)`) |
| Ratio `SUM(a)/SUM(b)` | `SAFE_DIVIDE(SUM(a), SUM(b))` | `type: number`, `sql: SAFE_DIVIDE(${a_m}, ${b_m})`, `required_fields: [a_m, b_m]`. **Nunca** `SUM(ratio)` ni `AVG(ratio)` |
| `REGEXP_MATCH(x, 're')` | `REGEXP_CONTAINS(x, r'^(?:re)$')` | **Trampa:** en LS, `REGEXP_MATCH` exige que calce la cadena **completa**. `REGEXP_CONTAINS` busca subcadenas. Para "contiene", LS usa `REGEXP_MATCH(x, '.*re.*')`. Traduce con anclas o con `.*` explícito |
| `REGEXP_CONTAINS(x,'re')` (LS) | `REGEXP_CONTAINS(x, r're')` | idéntico |
| `REGEXP_EXTRACT(x,'re')` | `REGEXP_EXTRACT(x, r're')` | idéntico |
| `CONTAINS_TEXT(x,'t')` | `STRPOS(x,'t') > 0` | |
| `STARTS_WITH/ENDS_WITH` | `STARTS_WITH/ENDS_WITH` | |
| `LOWER/UPPER/TRIM/CONCAT/SUBSTR/LENGTH/REPLACE` | igual | `CONCAT` en LS acepta 2+ args, en BQ también |
| `IFNULL(x,y)` / `COALESCE` | igual | |
| `CASE WHEN … END` | igual | En LS `IN (…)` es válido dentro de CASE; en BQ también |
| `IF(c, a, b)` | `IF(c, a, b)` | |
| `NARY_MAX(a,b)` / `NARY_MIN` | `GREATEST(a,b)` / `LEAST` | En BQ, `GREATEST` devuelve NULL si cualquier argumento es NULL. Usa `COALESCE` si LS lo trataba distinto |
| `TODAY()` / `CURRENT_DATE()` | `CURRENT_DATE('<zona>')` | Usa la zona horaria del reporte LS (p. ej. `America/Santiago`) |
| `DATE_DIFF(a,b)` | `DATE_DIFF(a, b, DAY)` | |
| `DATETIME_TRUNC(x, MONTH)` | `DATE_TRUNC(x, MONTH)` | En LookML preferir `dimension_group` timeframes |
| `MONTH(x)`, `YEAR(x)` | `EXTRACT(MONTH FROM x)` | |
| `FORMAT_DATETIME('%b %Y', x)` | `FORMAT_DATE('%b %Y', x)` | Las etiquetas de mes en español no son nativas: usa un `CASE` (`Ene`, `Feb`, …) más una dimensión `yyyymm` oculta como `order_by_field` |
| `PARSE_DATE('%Y%m%d', x)` | `PARSE_DATE('%Y%m%d', x)` | |
| `CAST(x AS NUMBER)` | `SAFE_CAST(x AS FLOAT64)` / `INT64` | |
| `ROUND(x, n)` | `ROUND(x, n)` | Mejor **no** redondear en SQL: usa `value_format` |
| `PERCENT_OF_TOTAL` / "Cálculo de comparación: porcentaje del total" | ventana `x / SUM(x) OVER ()` | En el mosaico: `table_calculation` o, para un gráfico 100 %, `stacking: percent` |
| "Running sum" | ventana | `table_calculation running_total(...)` |
| Métrica con agregación "Auto" | depende del tipo del campo | Lee `aggregation` en `conceptDefs` |

## Patrones de negocio frecuentes

- **Umbral por entidad (p. ej. fecha de lanzamiento por clínica)**: crea una dimensión `yesno`
  con un OR por entidad: `(${TABLE}.CLINICA = 1 AND ${TABLE}.FINGRESO >= DATE '2026-02-20') OR …`.
  Verifica en cada página:
  - el operador (`>` o `>=`);
  - la **columna de fecha** que compara (`FECHA` o `FINGRESO`);
  - qué entidades incluye (una página puede omitir alguna).

  Si las páginas difieren, crea una dimensión por variante. No las unifiques.
- **Clasificación de paciente o cliente sobre todo el historial** (p. ej. `TIPO_PACIENTE_UNIVOCO`):
  si existe en origen, úsala tal cual. No la recalcules por mes.
- **Medidas "Otros = Total − Club"** en gráficos apilados: valida que LS no usara otra métrica.
- **Atenciones con clave compuesta**: `COUNT(DISTINCT CONCAT(CLINICA,'_',CARGO_CAJA))`. Revisa si la
  clave incluye la clínica o el RUT. Puede cambiar el resultado si el id no es único entre entidades.
- **Mismo nombre, distinta regla**: en el caso real, `#Ley URG` de la tabla usaba
  `REGEXP '(?i)ley'`, mientras que el gráfico usaba una lista explícita de 5 convenios. Son dos
  campos distintos en LookML, con nombres distintos.

## Mapeo de componentes

| Componente LS | Looker (dashboard LookML) | Notas |
|---|---|---|
| Tabla (`simple-table`) | Vis custom de tabla (`<PROYECTO>::<vis_tabla>`, `modo: tabla`) o `looker_grid` | Preferir la vis custom del área para tener encabezado de color, fila Total, orden por clic y copiar a Excel. Fila Total: `total: true` en la query |
| Tabla dinámica (`simple-pivottable`) | Vis custom con `pivots:` o `looker_grid` con pivot | `transponer: true` en la vis custom para métricas en filas y dimensión en columnas |
| Tabla con drill down / árbol | Vis custom con 2 dimensiones y `subtotals: [dim1]` | |
| Scorecard (`simple-scorecard`) | Vis custom `modo: kpi` (estilo "studio") o `single_value` | Si LS usa números compactos (`compactNumbers`), replica con `value_format` (`0.0,,"M"`) |
| Barras / columnas | `looker_column` (vertical) / `looker_bar` (horizontal) | Apilado: `stacking: normal`. 100 %: `stacking: percent` |
| Combo (barras + línea) | `looker_column` con `series_types: {medida_linea: line}` | Eje secundario con `y_axes`. Para barras negativas (p. ej. detractores) crea una **medida** negativa; los `table_calculation` en combos pueden renderizar mal |
| Serie temporal | `looker_line` / `looker_area` | Dimensión de mes con `order_by_field` |
| Torta / dona | `looker_pie` (`inner_radius` para dona) | |
| Geo | `looker_google_map` / `looker_geo_choropleth` | Requiere `map_layer` o lat/long |
| Texto (`simple-description`) | Mosaico `type: text` con `body_text` HTML | Looker **elimina las etiquetas `<style>`**: usa solo estilos inline |
| Imagen / logo | Mosaico de texto con `<img>` o `<div>` con `background` (URL pública, p. ej. bucket GCS) | |
| Rectángulos / líneas decorativas | Barras de sección HTML (div con color de la sección) u omitir | |
| Control de fechas (`simple-daterangepicker`) | `type: date_filter` con `default_value` | Mapear el rango por defecto (ver abajo) y `listen` al campo de fecha de cada mosaico (`dateRangeDimension`) |
| Lista desplegable (`dimension-filter`) | `type: field_filter`, `ui_config: {type: tag_list \| checkboxes \| dropdown_menu, display: popover}` | El `explore`/`field` del filtro debe ser el **mismo** que filtran los mosaicos, para que las sugerencias calcen |
| Filtro de página / reporte | `filters:` del mosaico o `filter_expression` | Si comparte campo con un filtro de dashboard → `filter_expression` (ver trampas) |
| Navegación entre páginas | Un dashboard por página + banner HTML de enlaces | Ver `08_dashboards_lookml.md` |

## Rangos de fecha por defecto (LS → `default_value` de Looker)

| LS | Looker |
|---|---|
| Fijo "desde AAAA-MM-DD hasta hoy" | `AAAA/MM/DD to today` |
| Este año | `this year` |
| Este mes | `this month` |
| Últimos N días (incluye hoy) | `N days` (validar el borde con SQL) |
| Últimos N días (excluye hoy) | `N days ago for N days` |
| Últimos 12 meses | `12 months` |
| Automático (todo) | vacío (sin default). Si los datos tienen historia anterior que LS no mostraba, fija el rango explícito |

Valida siempre el borde con SQL. "Últimos 14 días" en LS puede significar hoy−13 → hoy.

## Formatos (LS → `value_format` / `value_format_name`)

| LS | LookML |
|---|---|
| Número entero con separador | `value_format_name: decimal_0` |
| 1 decimal | `decimal_1` |
| Porcentaje sin decimales (valor 0–1) | `value_format_name: percent_0` |
| Porcentaje cuando el valor ya es 0–100 | `value_format: "0\%"` (o `"0.0\%"`) |
| Moneda CLP | `value_format: "\"$\"#,##0"` |
| Millones con 1 decimal | `value_format: "#,##0.0,,\" M\""` |
| Compacto LS ("11,5 M") | `value_format: "0.0,,\" M\""`. Decide con el usuario si se replica exacto |
| Año sin separador | `value_format: "0"` |

La vis custom usa el valor `rendered` de Looker, así que el formato se controla **solo** desde
LookML.
