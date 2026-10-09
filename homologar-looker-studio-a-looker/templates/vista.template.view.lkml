view: <prefijo><fuente> {
  sql_table_name: `<proyecto>.<DATASET>.VW_<FUENTE>` ;;

  # Fuente Looker Studio: <nombre fuente LS> (páginas: <Página 1>, <Página 2>).
  # Documentado según el Estándar de Capa Semántica para Agentes de IA (label, description en
  # 3 partes, synonyms, tags dominio/tipo/equipo). sql/type/value_format validados 1:1 contra LS.

  # --------------------------------------------------------------------
  # DIMENSIONES
  # --------------------------------------------------------------------

  dimension: nom_entidad {
    label: "<Entidad>"
    description: "<Qué es>. Valores posibles: <v1>, <v2>, … Usar para <cuándo usarla>."
    synonyms: ["<sinónimo es>", "<sinónimo en>", "<acrónimo>"]
    tags: ["dominio:<dominio>", "tipo:dimension", "equipo:<equipo>", "<proyecto>"]
    suggestions: ["<v1>", "<v2>"]
    type: string
    sql: ${TABLE}.NOM_ENTIDAD ;;
  }

  dimension_group: fecha {
    label: "Fecha"
    description: "<Qué fecha es>. Granularidades: día, semana, mes, trimestre y año. Usar para <filtro de periodo / evolución>."
    synonyms: ["fecha", "dia", "date", "periodo"]
    tags: ["dominio:<dominio>", "tipo:tiempo", "equipo:<equipo>", "<proyecto>"]
    type: time
    timeframes: [raw, date, week, month, quarter, year]
    convert_tz: no
    datatype: date
    sql: ${TABLE}.FECHA ;;
  }

  # Mes en español ordenado cronológicamente (para ejes de gráficos)
  dimension: fecha_yyyymm {
    hidden: yes
    type: number
    sql: EXTRACT(YEAR FROM ${TABLE}.FECHA) * 100 + EXTRACT(MONTH FROM ${TABLE}.FECHA) ;;
  }

  dimension: fecha_mes {
    label: "Mes"
    description: "Mes-año de la fecha (ej. 'Nov 2025'), ordenado cronológicamente. Usar como eje de gráficos mensuales."
    synonyms: ["mes", "mes año", "month", "periodo mensual"]
    tags: ["dominio:<dominio>", "tipo:tiempo", "equipo:<equipo>", "<proyecto>"]
    type: string
    sql: CONCAT(
      CASE EXTRACT(MONTH FROM ${TABLE}.FECHA)
        WHEN 1 THEN 'Ene' WHEN 2 THEN 'Feb' WHEN 3 THEN 'Mar' WHEN 4 THEN 'Abr'
        WHEN 5 THEN 'May' WHEN 6 THEN 'Jun' WHEN 7 THEN 'Jul' WHEN 8 THEN 'Ago'
        WHEN 9 THEN 'Sep' WHEN 10 THEN 'Oct' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Dic' END,
      ' ', CAST(EXTRACT(YEAR FROM ${TABLE}.FECHA) AS STRING)) ;;
    order_by_field: fecha_yyyymm
  }

  # Umbral por entidad (p. ej. fecha de lanzamiento). Verificar operador (> / >=) y columna de fecha POR PÁGINA.
  dimension: en_periodo_x {
    hidden: yes
    description: "<regla>; replica la fórmula de LS de la página <Página>."
    type: yesno
    sql: (${TABLE}.ENTIDAD = 1 AND ${TABLE}.FECHA >= DATE '2026-01-01')
      OR (${TABLE}.ENTIDAD = 2 AND ${TABLE}.FECHA >= DATE '2025-08-20') ;;
  }

  dimension: id_persona {
    hidden: yes
    type: string
    sql: ${TABLE}.RUT ;;
  }

  # --------------------------------------------------------------------
  # MEDIDAS
  # --------------------------------------------------------------------

  measure: personas {
    group_label: "<Página LS>"
    label: "<Nombre de negocio>"
    description: "<Qué es>. Se calcula como COUNT_DISTINCT(<campo>) <condición>, igual que '<campo LS>' de Looker Studio. Usar para <cuándo>. El valor se expresa como número entero de <unidad>."
    synonyms: ["<es>", "<en>", "<acrónimo>"]
    tags: ["dominio:<dominio>", "tipo:kpi", "equipo:<equipo>", "<proyecto>"]
    type: count_distinct
    sql: CASE WHEN ${en_periodo_x} THEN ${id_persona} END ;;
    value_format_name: decimal_0
  }

  measure: monto {
    group_label: "<Página LS>"
    label: "Monto"
    description: "<Qué es>. Se calcula como SUM(<campo>). Usar para <cuándo>. El valor se expresa en pesos chilenos (CLP), en millones con 1 decimal."
    synonyms: ["monto", "venta", "importe", "amount"]
    tags: ["dominio:<dominio>", "tipo:kpi", "equipo:<equipo>", "<proyecto>"]
    type: sum
    sql: ${TABLE}.MONTO ;;
    value_format: "#,##0.0,,\" M\""
  }

  measure: pct_x {
    group_label: "<Página LS>"
    label: "% <Algo>"
    description: "<Qué es>. Se calcula como SAFE_DIVIDE(<numerador>, <denominador>) a partir de las medidas sumadas (nunca promedio de porcentajes). Usar para <cuándo>. El valor se expresa como porcentaje sin decimales."
    synonyms: ["porcentaje <algo>", "% <algo>", "<algo> rate"]
    tags: ["dominio:<dominio>", "tipo:kpi", "equipo:<equipo>", "<proyecto>"]
    type: number
    sql: SAFE_DIVIDE(${personas}, NULLIF(${monto}, 0)) ;;
    required_fields: [personas, monto]
    value_format_name: percent_0
  }
}
