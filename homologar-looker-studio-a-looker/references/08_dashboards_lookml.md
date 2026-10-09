# 08 · Dashboards LookML (`.dashboard.lookml`)

## Decisiones de arquitectura (validadas en producción)

1. **Un dashboard por página de LS.** Looker no permite ocultar la barra de pestañas de un
   dashboard con pestañas, y LS no tiene esa barra. Un dashboard de una sola capa no la muestra.
2. **El LookML es la fuente oficial.** Va en `<carpeta>/dashboard/<pagina>.dashboard.lookml`, el
   modelo lo incluye y su id es `<modelo>::<pagina>`. Así queda en git, tiene rollback y se
   despliega junto con el modelo.
3. **Navegación con un banner HTML** en un mosaico de texto, con enlaces
   `/embed/dashboards/<modelo>::<pagina>` que abren en la misma pestaña. Una vis custom no sirve:
   su iframe sandbox no puede navegar la ventana principal.
   - Trade-off aceptado: el banner no arrastra los valores de los filtros entre páginas; cada
     página abre con sus defaults.
4. **Tablas y KPI con la vis custom del área**, no con `looker_grid`, salvo que el usuario diga lo
   contrario. Gráficos con vis nativas (`looker_column`, `looker_line`, …).

## Camino recomendado para crear el archivo

Opción A (más rápida y segura):
1. Arma el dashboard como UDD con el MCP: `make_dashboard`, `add_dashboard_filter`,
   `add_dashboard_element`, `update_dashboard_layout_component`. Corrige los `listen` por API
   interna.
2. Valida los valores (V2).
3. Exporta: `GET /api/internal/core/4.0/dashboards/lookml/<id>`.
4. Limpia el export:
   - cambia `- dashboard:` por el nombre corto (`<pagina>`);
   - quita `preferred_slug`;
   - los enlaces del banner apuntan a `<modelo>::<pagina>`;
   - aplica `title_hidden` y `filter_expression` (ver trampas).
5. Escribe el `.dashboard.lookml` por la API, valida, prueba en dev, haz commit y deploy.
6. Deja el UDD como legado (o bórralo, con OK del usuario).

Opción B: escribe el `.dashboard.lookml` a mano desde `templates/dashboard.template.dashboard.lookml`.

## Anatomía

```yaml
---
- dashboard: <pagina>                     # id final: <modelo>::<pagina>
  title: <Proyecto> — <Página>
  description: <qué muestra la página>   # revisar: el export puede heredar textos de otra página
  layout: newspaper
  layout_granularity: granular            # grilla fina (lo que exporta Looker)
  preferred_viewer: dashboards-next
  tabs:
  - name: <Página>
    label: <Página>
  elements:
  - name: nav_<pagina>                    # 1) banner de navegación (fila 0)
    type: text
    title_text: ''
    body_text: '<div …> … enlaces /embed/dashboards/<modelo>::<otra> … </div>'
    row: 0
    col: 0
    width: 72
    height: 3
    tab_name: <Página>
  - name: header_<pagina>                 # 2) encabezado: logos + nombre de la página
    type: text
    body_text: '…'
  - name: barra_<seccion>                 # 3) barra de sección (color propio de la sección)
    type: text
    body_text: '<div style="background:#224073;border-radius:8px;box-shadow:…;color:#fff;font-size:22px;text-align:center;text-shadow:…">Sección</div>'
  - title: <Título del mosaico>           # 4) tabla con vis custom
    name: <nombre_unico>
    model: <modelo>
    explore: <explore>
    type: <PROYECTO>::<vis_tabla>
    fields: [<vista>.<dim>, <vista>.<medida1>, …]
    filters:
      <vista>.<campo>: <valor fijo que no comparte campo con un filtro de dashboard>
    filter_expression: ${<vista>.<campo>} != "<excluido>" OR is_null(${<vista>.<campo>})
    sorts: [<vista>.<dim> asc]
    limit: 500
    total: true
    modo: tabla
    titulo: ''
    color_principal: "#224073"
    mostrar_total: true
    renombrar: <vista>.<medida1>=Etiqueta LS; …
    title_hidden: true                    # si en LS no tiene título
    listen:
      Selecciona un periodo: <vista>.<fecha>_date
      Clínica: <vista>.<clinica>
    row: 10
    col: 0
    width: 72
    height: 18
    tab_name: <Página>
  - title: <Gráfico>                      # 5) gráfico nativo
    name: <nombre_unico_2>
    model: <modelo>
    explore: <explore>
    type: looker_column
    fields: [<vista>.mes, <vista>.serie, <vista>.medida]
    pivots: [<vista>.serie]
    sorts: [<vista>.mes asc]
    filters:
      <vista>.<fecha>_date: 12 months
    stacking: normal                      # percent para 100 %
    series_colors:
      Socios Club - <vista>.medida: "#cc0000"
      Otros - <vista>.medida: "#3d85c6"
    advanced_vis_config: '{"plotOptions":{"series":{"animation":{"duration":1200}}}}'
    listen: {}
    row: 40
    col: 0
    width: 72
    height: 16
  filters:
  - name: Selecciona un periodo
    title: Selecciona un periodo
    type: date_filter
    default_value: 2025/01/01 to today
    allow_multiple_values: true
    required: false
    ui_config:
      type: advanced
      display: popover
      options: []
  - name: Clínica
    title: Clínica
    type: field_filter
    default_value: ''
    allow_multiple_values: true
    required: false
    ui_config:
      type: tag_list
      display: popover
    model: <modelo>
    explore: <explore que filtran los mosaicos>
    listens_to_filters: []
    field: <vista>.<clinica>
```

## Filtros e interacción

- **`listen` explícito por mosaico**, siguiendo qué componentes afecta cada control de LS. Si un
  mosaico en LS no responde al control (p. ej. "últimos 14 días" fijo, o un histórico completo),
  no le pongas `listen` a ese filtro.
- **Un filtro de dashboard que escucha el mismo campo que un filtro fijo del mosaico lo
  reemplaza, aunque esté vacío.** Pasa en LookML y también en UDD. Por eso las exclusiones fijas
  (`-06. IPV`, `NOT NULL`) van en `filter_expression`, no en `filters`:
  `filter_expression: ${v.nom_clinica} != "06. IPV" OR is_null(${v.nom_clinica})`.
  Si LS también excluye nulos, quita el `OR is_null(...)`.
- El `explore`/`field` del filtro de dashboard determina las **sugerencias** del desplegable.
  Apúntalo al mismo explore que los mosaicos. Si apunta a otro explore, ofrecerá valores que no
  calzan.
- Si un filtro existe en LS pero ningún mosaico lo escucha (por ejemplo, porque es histórico
  completo), consérvalo para mantener la misma interfaz y documenta que no afecta.
- Filtros de año o mes cuando la fuente no tiene una fecha real (enteros `ANIO`/`MES`): usa
  `field_filter` sobre esas dimensiones, con default (p. ej. `anio = 2026`).

## Grilla y tamaños

- Con `layout_granularity: granular`, el ancho total es **72** columnas. Las equivalencias con la
  grilla estándar de los UDD (24 columnas) son:
  - `col` granular = col UDD × 3;
  - `width` granular = width UDD × 3;
  - `row` y `height` granulares = valor UDD × 2.
- En la grilla estándar, el alto en px ≈ `unidades × 48 − 8` (h2 = 88 px, h4 = 184, h6 = 280).
  En granular, la mitad por unidad.
- Pasar desde LS (px):
  - `col = round(left / anchoLienzo × 72)` y `width = round(ancho / anchoLienzo × 72)`;
  - `row` y `height`: en proporción, ajustando para que nada quede cortado.
- Las tarjetas KPI necesitan al menos el equivalente a h3 estándar (h6 granular). Si son más bajas,
  la vis las corta.
- Looker **no tiene lienzo fijo**: la página crece hacia abajo. No intentes replicar el alto del
  lienzo de LS.
- El scroll horizontal que aparece con el panel lateral de Looker abierto es un artefacto del
  viewport, no un defecto.

## Banner de navegación (`templates/banner_navegacion.template.html`)

- Una fila con un ítem por página (ícono SVG + etiqueta). La página activa va como `<span>`
  resaltado, sin enlace. Las demás son `<a href="/embed/dashboards/<modelo>::<pagina>"
  target="_self">`.
- Looker **elimina los `<style>`** del `body_text`. Usa solo estilos inline. `::-webkit-scrollbar`
  no funciona.
- Para que no aparezca scroll vertical, el contenido debe medir menos que el alto útil del mosaico:
  - padding mínimo (`1px 10px`) y `overflow:hidden` en el contenedor;
  - ítems con `padding:2px 4px`;
  - márgenes del SVG de 1px.

  No uses `overflow-x:auto`: su scrollbar consume alto y vuelve a provocar el scroll vertical.
- Al cambiar el nombre de un dashboard, actualiza los **N−1 enlaces de cada uno de los N
  archivos**. Verifica con una búsqueda que no quede ningún id antiguo.

## Encabezado

- Logo del área (izquierda) y logo del producto (derecha), a la misma altura visual, con el nombre
  de la página debajo del logo derecho (p. ej. `#165089`, 30px, `white-space:nowrap`).
- Las imágenes van por URL pública (p. ej. un bucket GCS del área). No se pueden subir binarios al
  proyecto LookML.
- Si un logo trae márgenes blancos, recórtalo por CSS con un `div` con `background`:
  - `s = altoDeseado / altoContenido`;
  - `background-size = anchoImg·s`;
  - `background-position-y = −margenSuperior·s`.

## Gráficos

- Paleta corporativa en `series_colors` (las claves son `<valor pivot> - <campo>` o `<campo>`).
- **Animación** igual a la de otros dashboards del área:
  `advanced_vis_config: '{"plotOptions":{"series":{"animation":{"duration":1200}}}}'`.
- Leyendas: fíjalas con `series_labels` para que un cambio de `label` en LookML no las altere.
- Combos: `series_types: {<campo_linea>: line}`, con `y_axes` si hay eje secundario.
- 100 % apilado: `stacking: percent`. Apilado absoluto: `stacking: normal`.

## Textos estáticos (glosario, notas)

- Un mosaico de texto con HTML inline: títulos con el color de la sección, términos destacados y
  viñetas numeradas. Transcribe el texto de LS **literal**.

## Diferencias LookML vs UDD (resueltas)

| Síntoma | Causa | Solución |
|---|---|---|
| El mosaico muestra un título raro (" (4)") | En LookML, `title` vacío o nulo hace que se muestre el `name` interno | `title_hidden: true` |
| Aparece una entidad excluida (p. ej. "06. IPV") con el filtro vacío | El filtro de dashboard vacío reemplaza el filtro fijo del mosaico | `filter_expression` |
| La vis custom no aparece en dev | Las vis del manifest solo existen tras el deploy | Desplegar la vis primero |
| La descripción del dashboard es de otra página | El export copia la descripción del dashboard origen (copias) | Corregir `description` en cada archivo |
