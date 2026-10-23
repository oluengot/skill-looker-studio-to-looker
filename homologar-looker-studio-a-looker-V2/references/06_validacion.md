# 06 · Validación numérica 1:1

La validación se hace **tres veces** por página. En las tres, el valor de referencia es lo que
muestra LS.

| Momento | Qué se compara | Puerta |
|---|---|---|
| V1 (fase 3) | SQL directo sobre la vista pasarela vs valores de LS | Antes de escribir LookML |
| V2 (fase 4–6, dev) | Query del explore/mosaico en dev vs SQL de V1 | Antes de commit |
| V3 (fase 8, prod) | Dashboard en producción (MCP `run_dashboard`) vs V2 | Antes de cerrar |

## Correr SQL por la conexión de Looker (recomendado)

Usa la misma conexión, la misma cuenta de servicio y los mismos permisos que usará el dashboard:

```js
const tok=document.querySelector('meta[name=csrf-token]').content;
window.__sql=async(sql,conn='<conexion>')=>{
  let r=await fetch('/api/internal/core/4.0/sql_queries',{method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-Token':tok},
    body:JSON.stringify({connection_name:conn,sql})});
  const j=await r.json(); if(!j.slug) return ['create',r.status,j];
  r=await fetch('/api/internal/core/4.0/sql_queries/'+j.slug+'/run/json',{method:'POST',
    headers:{'Accept':'application/json','X-CSRF-Token':tok}});
  return [r.status, await r.text()]};
await window.__sql("SELECT 1");
```

- El MCP `query_sql` **no sirve** para SQL crudo: pide modelo, explore y campos.
- Alternativa: MCP de BigQuery `execute_sql`, o REST BigQuery con token de `gcloud`.

## Cómo armar la consulta de validación de un mosaico

1. Toma la fuente de la spec y aplica **todos** los filtros del mosaico:
   - filtros propios;
   - filtros de página y de reporte;
   - el rango de fechas por defecto, sobre el **campo de fecha correcto** (`dateRangeDimension`).
2. Agrupa por las mismas dimensiones que el mosaico.
3. Calcula cada métrica con la fórmula traducida.
4. Si el mosaico muestra fila Total, agrega una fila de total calculada sin agrupar. Las métricas
   `COUNT_DISTINCT` **no se suman**.
5. Compara celda por celda. Para ratios, compara a precisión completa y no solo el redondeo
   visible.

Ejemplo (tabla por clínica con lanzamiento y exclusión):
```sql
SELECT NOM_CLINICA,
  COUNT(DISTINCT IF(FLAG_SOCIO=1 AND <lanzamiento>, RUT, NULL)) AS pacientes_club,
  SUM(IF(FLAG_ATENCION_CLUB=1,1,0))                            AS atenciones_club
FROM `<dataset>.VW_<FUENTE>`
WHERE FECHA >= '2025-01-01' AND FECHA <= CURRENT_DATE('America/Santiago')
  AND NOM_CLINICA != '06. IPV'
GROUP BY ROLLUP(NOM_CLINICA) ORDER BY 1
```
Ojo: `ROLLUP` sirve para sumas. Para `COUNT DISTINCT`, la fila total de `ROLLUP` sí deduplica,
porque se recalcula sobre el grupo total.

## Validación en dev (V2)

- Opción A, UI: abre `/dashboards/<modelo>::<pagina>` con el modo desarrollo activo.
- Opción B, API interna:
  1. crea la query (`POST /api/internal/core/4.0/queries` con model, view, fields, filters,
     sorts, total, limit);
  2. ejecútala (`GET …/queries/<id>/run/json`). Se ejecuta en el workspace dev del usuario
     logueado.
- Compara contra V1. Prueba también con un filtro aplicado (una clínica o un pilar): así detectas
  `listen` mal conectados y filtros que pisan exclusiones.

## Validación en producción (V3)

- MCP: `run_dashboard` con `dashboard_id = "<modelo>::<pagina>"` (dashboard LookML) o el id
  numérico (UDD). Devuelve los datos de cada mosaico.
- MCP: `get_dashboard` para revisar filtros y defaults.
- Justo después del deploy, el MCP puede servir la versión anterior durante unos segundos. Espera
  ~20 s y confirma que `master.remote_ref` es tu commit (ver `09_deploy.md`).

## Tolerancias y diferencias aceptables

| Situación | ¿Aceptable? | Acción |
|---|---|---|
| Diferencia exacta 0 | Sí | — |
| Diferencia mínima (±1–2) en un conteo, con LS cacheado | Sí, si se explica | Anotar la hora de caché de LS y la hora del SQL. Revalidar más tarde |
| Diferencia en el total, pero no en las filas | **No** | Revisar si la medida es `count_distinct` o `sum`, y la fila total |
| Diferencia constante por entidad | **No** | Revisar los umbrales por entidad (fechas de lanzamiento, `>` vs `>=`) |
| Valores ~10x en todo | Probablemente la fuente se recargó | Comparar el conteo de filas de la fuente y revalidar contra LS en el mismo momento |
| Una entidad aparece en Looker y no en LS | **No** | Exclusión no aplicada o pisada por un filtro de dashboard (usar `filter_expression`) |
| Datos anteriores al rango que LS no muestra | **No** | Fijar `default_value` del rango de fechas |

## Matriz de validación (`templates/validacion_pagina.template.md`)

Por página, guarda `validacion_<pagina>.md` con:
- fuente, filtros y rango usados;
- la tabla Entidad × Métrica con los valores de LS, SQL y Looker;
- el veredicto;
- las diferencias a propósito (formato, decisiones del usuario).

Esto es lo que respalda la afirmación "1:1" ante el usuario.
