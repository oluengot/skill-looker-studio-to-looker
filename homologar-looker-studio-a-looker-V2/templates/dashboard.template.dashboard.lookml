---
# Plantilla: un archivo por página de Looker Studio.
# Ruta: <carpeta>/dashboard/<pagina>.dashboard.lookml · id final: <modelo>::<pagina>
# Grilla granular: ancho total 72 (col/width = estándar×3; row/height = estándar×2).
- dashboard: <pagina>
  title: <Proyecto> — <Página>
  description: <Qué muestra esta página (propia, no heredada)>.
  layout: newspaper
  layout_granularity: granular
  preferred_viewer: dashboards-next
  tabs:
  - name: <Página>
    label: <Página>
  elements:

  # 1) Banner de navegación (ver templates/banner_navegacion.template.html; HTML en UNA línea)
  - name: nav_<pagina>
    type: text
    title_text: ''
    subtitle_text: ''
    body_text: '<div style="display:flex;justify-content:center;gap:18px;padding:1px 10px;overflow:hidden;">…<a href="/embed/dashboards/<modelo>::<otra_pagina>" target="_self" style="…">Otra</a>…<span style="…">Página activa</span>…</div>'
    row: 0
    col: 0
    width: 72
    height: 3
    tab_name: <Página>

  # 2) Encabezado (logos + nombre de página)
  - name: header_<pagina>
    type: text
    title_text: ''
    body_text: '<div style="…">…</div>'
    row: 3
    col: 0
    width: 72
    height: 7
    tab_name: <Página>

  # 3) Barra de sección
  - name: barra_<seccion>
    type: text
    title_text: ''
    body_text: '<div style="background:#224073;border-radius:8px;color:#fff;font-size:22px;text-align:center;">Sección</div>'
    row: 10
    col: 0
    width: 72
    height: 3
    tab_name: <Página>

  # 4) KPI (scorecard) con vis custom
  - title: <Título KPI>
    name: kpi_<nombre>
    model: <modelo>
    explore: <explore>
    type: <PROYECTO>::<vis_id>
    fields: [<vista>.<medida>]
    limit: 1
    modo: kpi
    kpi_estilo: studio
    kpi_borde: true
    titulo: <Título como en LS>
    title_hidden: true
    listen:
      Selecciona un periodo: <vista>.<fecha>_date
      Clínica: <vista>.<entidad>
    row: 13
    col: 0
    width: 24
    height: 8
    tab_name: <Página>

  # 5) Tabla con vis custom (fila Total, exclusión fija con filter_expression)
  - title: <Título tabla>
    name: tabla_<nombre>
    model: <modelo>
    explore: <explore>
    type: <PROYECTO>::<vis_id>
    fields: [<vista>.<entidad>, <vista>.<medida_1>, <vista>.<medida_2>]
    filter_expression: ${<vista>.<entidad>} != "<valor_excluido>" OR is_null(${<vista>.<entidad>})
    sorts: [<vista>.<entidad>]
    limit: 500
    total: true
    modo: tabla
    titulo: ''
    color_principal: "#224073"
    transponer: false
    mostrar_total: true
    renombrar: <vista>.<medida_1>=<Etiqueta LS 1>; <vista>.<medida_2>=<Etiqueta LS 2>
    title_hidden: true
    listen:
      Selecciona un periodo: <vista>.<fecha>_date
      Clínica: <vista>.<entidad>
    row: 21
    col: 0
    width: 72
    height: 18
    tab_name: <Página>

  # 6) Gráfico de columnas apiladas (nativo) con colores, leyendas fijas y animación
  - title: <Título gráfico>
    name: graf_<nombre>
    model: <modelo>
    explore: <explore>
    type: looker_column
    fields: [<vista>.<fecha>_mes, <vista>.<serie>, <vista>.<medida>]
    pivots: [<vista>.<serie>]
    sorts: [<vista>.<fecha>_mes, <vista>.<serie>]
    filters:
      <vista>.<fecha>_date: 12 months
    limit: 500
    x_axis_gridlines: false
    y_axis_gridlines: true
    show_view_names: false
    show_x_axis_label: false
    show_y_axis_labels: true
    legend_position: center
    stacking: normal
    show_value_labels: false
    series_colors:
      <Valor serie A> - <vista>.<medida>: "#cc0000"
      <Valor serie B> - <vista>.<medida>: "#3d85c6"
    series_labels:
      <Valor serie A> - <vista>.<medida>: <Leyenda A>
      <Valor serie B> - <vista>.<medida>: <Leyenda B>
    advanced_vis_config: '{"plotOptions":{"series":{"animation":{"duration":1200}}}}'
    listen:
      Clínica: <vista>.<entidad>
    row: 39
    col: 0
    width: 72
    height: 16
    tab_name: <Página>

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
    explore: <explore>          # el MISMO explore que filtran los mosaicos (sugerencias correctas)
    listens_to_filters: []
    field: <vista>.<entidad>
