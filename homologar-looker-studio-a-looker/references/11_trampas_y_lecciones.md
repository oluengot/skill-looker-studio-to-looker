# 11 · Trampas reales y su solución

Todas ocurrieron en la migración de referencia (Club Urgencia, 8 páginas). Revisa esta lista al
empezar cada página.

## Datos y fórmulas
1. **Copias congeladas en el dataset destino** (`BASE_*`) con columnas faltantes → no se usan. Se
   leen las tablas que usa LS por medio de vistas pasarela `VW_*`.
2. **La fuente se recarga durante la migración** (los valores saltaron ~10x de un día a otro) →
   antes de buscar un bug, mira el conteo de filas de la fuente y revalida contra LS en el mismo
   momento.
3. **Umbrales distintos por página**: las fechas de lanzamiento por clínica eran distintas entre
   KPI de Éxito (`>=`) y Venta URG (`>` estricto, sin la clínica 7). Además, una métrica comparaba
   sobre `FECHA` y otras sobre `FINGRESO` → una dimensión por variante.
4. **Mismo concepto, dos reglas**: "#Ley URG" en la tabla (`REGEXP '(?i)ley'`) frente al gráfico
   (lista explícita de 5 convenios) → dos campos distintos. Replica LS, no lo "corrijas".
5. **`COUNT_DISTINCT` frente a `SUM` de flag**: "Atenciones Club" era `SUM(FLAG_ATENCION_CLUB)` y
   no un conteo distinto. Lee siempre la agregación del `conceptDef`.
6. **Totales que deduplican**: con `count_distinct`, el total no es la suma de las filas. LS y
   Looker coinciden si la medida es `count_distinct`.
7. **Índices pre-agregados** (NPS/ISN): recalcúlalos desde conteos sumados, nunca con
   `SUM(nps_final)`.
8. **Medida "corregida" que nunca llegó a producción**: el repo local divergía de producción.
   Antes de editar, toma la versión **actual** del archivo desde el proyecto (GET), no desde la
   copia local.
9. **El diseñador cambió LS a mitad de camino**: quitó un filtro fijo `ZONA='U'`, agregó un control
   Pilar y una columna nueva en origen → re-extrae, crea medidas `act_*` nuevas y deja intactas
   las de otras páginas.
10. **Rango por defecto**: sin filtro de fecha, la tabla incluía datos anteriores a 2025 que LS no
    mostraba (52.282 vs 52.038) → fija `default_value`.

## LookML
11. **`label_short:` no existe en LookML** → rompe el deploy.
12. **`/` inicial en el `file:` del manifest** → rompe **todos** los modelos en dev.
13. **Labels duplicados** (conteo vs %) → los agentes de IA se confunden. Usa labels únicos
    ("% Promotores").
14. **Las vis del manifest solo existen tras el deploy** → despliega la vis antes de usarla.
15. **El error real de un modelo roto** solo se ve abriendo el Explore en la UI. La API dice
    "Model Error".

## Dashboards
16. **Filtro de dashboard vacío pisa el filtro fijo del mosaico** si comparten campo →
    `filter_expression`. Pasaba también en el UDD en producción.
17. **`title` vacío en LookML muestra el `name`** (" (4)") → `title_hidden: true`.
18. **El MCP guarda solo el primer `listen`** → PATCH de `filterables[0].listen` por API interna.
19. **`vis_config` vive en la query (inmutable)** → crea una query nueva y haz PATCH de `query_id` y
    `result_maker`. Un PATCH de `result_maker.vis_config` no hace nada.
20. **Table calculations en combos** se renderizaban horizontales o rotas → usa medidas reales
    (p. ej. `pct_detractores_neg`).
21. **No se puede ocultar la barra de pestañas** → un dashboard por página.
22. **Una vis custom no puede navegar la ventana** (iframe sandbox) → banner en un mosaico de
    texto.
23. **`<style>` se elimina en los mosaicos de texto** → solo estilos inline. El scrollbar del
    mosaico se evita achicando el contenido y usando `overflow:hidden`.
24. **Tarjetas KPI cortadas** con poco alto → mínimo h3 estándar (h6 granular).
25. **Filtro de dashboard apuntando a otro explore** → sugerencias que no calzan. Usa el explore de
    los mosaicos.
26. **El export de LookML copia `preferred_slug` y la descripción del dashboard original** →
    limpia ambos.
27. **La ruta del export** es `dashboards/lookml/<id>`. `dashboards/<id>/lookml` da 404.

## API, sesión y deploy
28. **PUT con `contents`/`digest`** da 400 "modified from another tab". Los nombres correctos son
    `file_contents`/`file_digest`.
29. **Rutas sin `encodeURIComponent` completo** dan 404.
30. **`type:'file'` al crear** produce `.file.lkml`. Usa el tipo correcto (`view`, `dashboard`,
    `documentation`, …).
31. **El proyecto no acepta binarios** (PDF). La documentación va como `.md` (type
    `documentation`) y el PDF queda en el repo de trabajo.
32. **Workspace dev compartido con otros equipos**: sus errores bloquean tu commit. Hay que
    reportarlos y no tocarlos sin OK.
33. **"Pull & Merge" repetido** cuando otros despliegan en paralelo: merge, validate y deploy de
    inmediato.
34. **El MCP muestra la versión anterior justo después del deploy** → espera ~20 s y verifica
    `remote_ref`.
35. **La sesión del navegador expira** (401). Volver a iniciar sesión es acción del usuario. El MCP
    sigue funcionando con su API key.
36. **`bq` CLI roto en Windows** → usa REST BigQuery con `gcloud auth print-access-token`, o la
    conexión de Looker (`sql_queries`).
37. **Los clasificadores de seguridad del agente** pueden bloquear escrituras a recursos
    compartidos aunque el usuario esté logueado → no los esquives. Entrega el archivo al usuario
    para que lo pegue.

## Formato
38. **Formato compacto de LS** ("11,5 M") frente a millones con decimal ("11.490,6 M"): decide con
    el usuario. El valor es el mismo.
39. **Super-encabezados de grupo** (columnas agrupadas sin pivot): `looker_grid` no los dibuja.
    Necesitas una vis custom o HTML, o acordarlo como diferencia.
40. **El mismo índice con formatos distintos** (entero en la tabla, % en la línea del gráfico) →
    dos medidas con su `value_format`.
