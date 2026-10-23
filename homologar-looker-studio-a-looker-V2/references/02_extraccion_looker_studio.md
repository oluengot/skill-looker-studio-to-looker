# 02 · Extracción de la definición del reporte de Looker Studio

Looker Studio no tiene una API pública para leer la definición de un reporte. La forma fiable es
usar la **API interna que usa el propio editor**, desde una pestaña del navegador con la sesión del
usuario y el reporte abierto **en modo edición**. Todo es lectura; no se modifica nada.

Script listo para usar: `scripts/ls_extraer_reporte.js`. Esta guía explica qué hace y cómo leer
el resultado.

## 1. Abrir el reporte en modo edición

`https://lookerstudio.google.com/u/0/reporting/<reportId>/page/<pageId>/edit`

- `reportId` sale de la URL del reporte.
- Si el usuario no tiene permiso de edición, pídeselo. Sin él, `getReport` falla.
- Si la sesión expiró, el usuario inicia sesión. El agente no.

## 2. Capturar el token XSRF

Las llamadas internas exigen el header `X-RAP-XSRF-TOKEN`. El editor lo envía en sus propios XHR, así
que se captura **parchando `setRequestHeader`** y forzando tráfico (cambiar de página o recargar
un gráfico):

```js
if(!window.__xsrfPatched){window.__xsrfPatched=true;
  const o=XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader=function(k,v){if(/xsrf/i.test(k))window.__xsrf=v;return o.apply(this,arguments);};}
window.__xsrf?'tengo':'esperando'   // si dice 'esperando': cambiar de página en el editor y volver a evaluar
```

El parche se pierde al recargar la pestaña. Navegar entre páginas dentro del editor no recarga.

`appVersion`: tómalo de una URL interna reciente:
```js
(performance.getEntriesByType('resource').map(e=>e.name).find(n=>/appVersion=/.test(n))||'').match(/appVersion=([^&]+)/)?.[1]
```

## 3. Llamadas internas (todas `POST /u/0/<metodo>?appVersion=<v>`)

Las respuestas empiezan con `)]}'`, que hay que quitar antes de `JSON.parse`.

```js
const H={'Content-Type':'application/json','X-RAP-XSRF-TOKEN':window.__xsrf};
const post=async(m,b)=>{const r=await fetch('/u/0/'+m+'?appVersion='+APPV,{method:'POST',credentials:'include',headers:H,body:JSON.stringify(b)});
  return JSON.parse((await r.text()).replace(/^\)\]\}'\s*/,''));};
window.__rep = await post('getReport',{reportId:'<reportId>'});
window.__ds  = {}; for (const id of DATASOURCE_IDS) window.__ds[id] = await post('getBlockDatasource',{datasourceId:id});
```

| Método | Cuerpo | Devuelve |
|---|---|---|
| `getReport` | `{reportId}` | `reportConfig` completo: páginas, componentes, filtros de reporte, temas |
| `getBlockDatasource` | `{datasourceId}` | Fuente de datos: tabla física (`tableId`/proyecto/dataset), **campos con fórmula**, tipo, agregación |
| `getSchema` | (lo usa el editor) | Esquema de la fuente; rara vez necesario |
| `batchedDataV2` | (lo emite cada gráfico) | **Valores** que LS muestra. Léelos de la red, no los reconstruyas |

## 4. Estructura de `getReport` (lo que importa)

```
reportConfig
├─ page[]                         ← una entrada por página, en orden
│   ├─ pageId                     ← p. ej. "p_nvq8f2521d"
│   └─ page
│       ├─ name                   ← nombre visible de la página
│       └─ componentConfig[]      ← componentes de la página
│           ├─ componentId        ← "cd-xxxxxxxx"
│           ├─ type               ← simple-table, simple-scorecard, simple-barchart, simple-combochart,
│           │                       simple-timeseries, simple-piechart, simple-pivottable,
│           │                       simple-daterangepicker, dimension-filter, simple-description (texto),
│           │                       image, shape/line …
│           ├─ datasourceId       ← fuente que usa (o propertyConfig.componentProperty.dataset.datasetId)
│           ├─ attributeConfig.componentAttribute {top,left,width,height}   ← posición en px
│           ├─ conceptDefs[]      ← campos usados: name → queryTimeTransformation
│           │     .dataTransformation {sourceFieldName, aggregation}
│           │     .displayTransformation {displayName}
│           └─ propertyConfig.componentProperty
│                 ├─ dimensions / metrics.labeledConcepts[]   ← referencias a conceptDefs
│                 ├─ filters[]          ← ids de filtros (ver report.resource.filter)
│                 ├─ dateRangeDimension ← campo fecha sobre el que aplica el control de fechas
│                 ├─ dateDuration       ← rango por defecto del componente
│                 ├─ sort, row (límite de filas)
│                 ├─ inheritFilters     ← si hereda filtros de página/reporte
│                 └─ kpiMetricProperty  ← scorecard: compareType, comparisonDateRange, compactNumbers
└─ report.resource.filter.entry[] ← filtros definidos (key → value.filterDefinition.filterExpression
                                       {include, filterConditionType, stringValues, numberValues,
                                        queryTimeTransformation.dataTransformation.sourceFieldName})
```

Algunos componentes también tienen **campos calculados a nivel de gráfico**, que no están en la
fuente. Aparecen en el cuerpo del request `batchedDataV2`, en
`dataRequest[].datasetSpec.calculatedField[].dataTransformation.textFormula` (o
`frontendTextFormula`). Captúralos parchando `XMLHttpRequest.send` (ver script, paso 5).

## 5. Fórmulas de la fuente (`getBlockDatasource`)

```js
const walk=(o,acc)=>{if(o&&typeof o==='object'){if(o.field&&o.field.name&&o.outputName)
  acc[o.field.name]={label:o.outputName,formula:(o.frontendTextFormula||o.textFormula||'').replace(/t0\./g,'')};
  for(const k in o)walk(o[k],acc)}return acc};
const campos = walk(window.__ds['<datasourceId>'],{});
const tabla  = (JSON.stringify(window.__ds['<datasourceId>']).match(/"(?:tableId|table)":"([^"]+)"/)||[])[1];
```

Alternativa: `draft.datasourceBlock.fields[]` con `{name,id,dataType,semanticType,aggregation,formula}`.

Para cada fuente anota: id, nombre, **tabla física** (`proyecto.dataset.tabla`), lista de campos
calculados con fórmula, y si es una *blend* (combinación de fuentes; ver
`04_traduccion_formulas.md`).

## 6. Resumen por página (lo que va a la spec)

`scripts/ls_extraer_reporte.js → resumenPagina(i)` devuelve, por componente:

- `id`, `type`, `top`, `left`, `width`, `height`;
- la tabla de la fuente;
- las métricas con su fórmula resuelta (`displayName=campo [fórmula] agg`);
- las dimensiones;
- el campo del rango de fechas y su rango por defecto;
- los filtros con su descripción (`nombre: [NOT] campo CONDICION [valores]`);
- si hereda filtros;
- la configuración de comparación del scorecard.

Para los textos (`simple-description`), extrae el HTML y conviértelo a texto plano.

Ordena los componentes por `top` y después por `left`. Ese orden es el que tendrá el dashboard.

## 7. Valores que muestra LS (la "verdad" a cuadrar)

1. Activa la captura de red (`read_network_requests` / DevTools / Playwright).
2. Navega a la página en modo **vista** o edición. Cada componente emite su `batchedDataV2`.
3. Lee los cuerpos de respuesta y asócialos al `componentId`
   (`dataRequest[].requestContext.reportContext.componentId`).
4. Además, toma una **captura de pantalla** de cada página con los filtros por defecto. Si cuesta
   leer las respuestas, transcribe los valores de la captura.
5. Anota el rango de fechas **efectivo** que muestra el control. "Desde 2025 a la fecha" o "Este
   año" cambian el resultado.

## 8. Qué registrar de cada página (checklist de extracción)

- [ ] Nombre, pageId y orden de la página.
- [ ] Controles: tipo, campo, valor por defecto, a qué componentes afecta.
- [ ] Filtros de página y de reporte: campo, condición, valores, include/exclude.
- [ ] Por componente:
  - [ ] tipo y posición;
  - [ ] fuente;
  - [ ] dimensiones (orden y formato de fecha);
  - [ ] métricas (fórmula, agregación y formato);
  - [ ] filtros propios;
  - [ ] rango de fechas propio;
  - [ ] orden y límite;
  - [ ] totales (fila Total: sí/no);
  - [ ] para gráficos: apilado o 100 %, ejes, colores por serie, series de línea en combos.
- [ ] Estilos: colores de encabezado, de barras y de títulos; tamaño y formato de números
  (compacto, decimales, %, moneda).
- [ ] Textos fijos (títulos de sección, notas, glosario).
- [ ] Navegación: botones o íconos entre páginas (si usa SVG propios, guárdalos para el banner).
- [ ] Valor esperado de cada mosaico con los filtros por defecto.

## Trampas de extracción

- Un mismo nombre de campo puede tener **fórmulas distintas en páginas distintas**: un campo
  calculado a nivel de gráfico tapa al de la fuente. Lee siempre `calculatedField` del request.
- Las "fechas de lanzamiento" u otros umbrales escritos en la fórmula pueden diferir entre
  páginas. Ejemplo real: Venta URG usaba `>` estricto y otra lista de fechas que KPI de Éxito.
- El diseñador puede cambiar LS durante la migración. Antes de cerrar una página, vuelve a
  extraerla y compárala con la spec.
- Componentes ocultos o fuera del lienzo: revisa `top`/`left` negativos o mayores que el lienzo.
- Hay controles con filtro propio que **no** aplican a todos los gráficos. Revisa qué componentes
  dependen de cada control. Si dudas, compáralo en LS cambiando el control y mirando qué cambia.
