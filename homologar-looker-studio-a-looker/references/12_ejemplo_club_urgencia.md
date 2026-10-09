# 12 · Caso de referencia: "Club Urgencia Interclínica" (resultado a igualar)

Este caso sirve para calibrar el nivel de detalle y de resultado que se espera en cualquier
migración nueva.

## Datos del caso
- LS: reporte `622b3191-04ce-439a-b88a-65e8707fd020`, con 8 páginas de negocio (de 12 páginas en
  total).
- Looker: instancia `interclinica.cloud.looker.com`, proyecto `BI`, carpeta
  `01_DM/INF_CLUB_URGENCIA/`, modelo `club_urgencia`, conexión `bigquery_bi-icsa`.
- Vistas pasarela: `bi-icsa.INF_CLUB_URGENCIA.VW_*`, que leen `analisis-red.acatalan.*` y
  `analisis-red.fvargas.*`.

## Mapa final

| Página LS | Fuente → vista pasarela → explore | Dashboard LookML | Contenido |
|---|---|---|---|
| Inscripciones | INSCRIPCIONES_ATENCIONES, CUI_Captacion → `VW_INSCRIPCIONES_ATENCIONES`, `VW_CUI_CAPTACION` → `cu_inscripciones`, `cu_captacion` | `club_urgencia::inscripciones` | KPI, tabla resumen transpuesta, tabla con drill down Clínica/Pilar, columnas |
| KPI de Éxito | INF_tPAGOS, CUI_Sinergia → `cu_pagos`, `cu_sinergia` | `club_urgencia::kpi_de_exito` | Matriz de KPI Club vs No Club (vis custom, modos `tarjetas`/`matriz`) |
| Venta URG | INF_tPAGOS → `cu_pagos` | `club_urgencia::venta_urg` | 3 KPI, tabla por clínica, 2 columnas apiladas |
| Actividad URG | INF_tPAGOS → `cu_pagos` (medidas `act_*`) | `club_urgencia::actividad_urg` | Tabla transpuesta y gráfico 100 % "Recompra" |
| Sinergia | CUI_Sinergia → `cu_sinergia` | `club_urgencia::sinergia` | Tabla de 8 métricas y 2 columnas apiladas |
| Sinergia UPC | CUI_SINERGIA_URG_UPC → `cu_sinergia_upc` | `club_urgencia::sinergia_upc` | 3 KPI y tabla; histórico completo (sin `listen`) |
| KPI de Servicio | NPS/ISN/VOLVERIA pre-agregadas → `cu_nps_urg`, `cu_isn_urg`, `cu_volveria_urg` | `club_urgencia::kpi_de_servicio` | 3 secciones: tabla, combo "Global" y combo "Socios vs No Socios"; filtros Clínica/Año/Mes |
| Glosario | — | `club_urgencia::glosario` | Texto estático literal |

## Decisiones clave que se repiten en cualquier migración
1. Un dashboard por página y un banner embed, en lugar de pestañas.
2. Los `.dashboard.lookml` son la fuente oficial; los UDD quedan como legado.
3. Vista pasarela `SELECT *` por fuente, dentro del dataset del área.
4. Variantes de medida por página cuando LS difiere (`act_*`), sin tocar las validadas.
5. Exclusiones con `filter_expression` y `title_hidden: true` en mosaicos sin título.
6. Período por defecto `2025/01/01 to today`, igual que LS ("Desde 2025 a la fecha").
7. Índices de encuesta recalculados desde conteos. Medida negativa para barras hacia abajo.
8. Animación Highcharts de 1200 ms en todos los gráficos nativos.
9. Capa semántica con el estándar para agentes IA (auditada: 0 labels duplicados).

## Ejemplos de valores validados (para dimensionar la precisión exigida)
- Sinergia, totales:
  - Pacientes en URG: 166.403
  - Atenciones a URG: 248.427
  - #Sinergia: 15.091
  - #Ley URG: 7.117
  - Pacientes Club: 22.562
  - Atenciones a URG Club: 29.136
  - #Sinergia Club: 2.514
  - #Ley URG Club: 1.525
- Sinergia UPC, totales (con deduplicación de RUT):
  - Pacientes URG: 408.534
  - Atenciones URG: 806.479
  - #Ley de Urgencia UPC: 11.611
  - Pacientes Club: 22.577
  - Atenciones Club: 30.623
  - #Ley de Urgencia UPC Club: 1.505
- KPI de Servicio, CLC enero 2026:
  - NPS 47 (promotores 68 %, detractores −21 %);
  - ISN 57 %;
  - Volvería 81,6 %.
- KPI de Éxito, Inscritos Totales con el período 2025/01/01→hoy: 301.244 (con "este año": 286.048).
- Actividad URG: SQL = LS en 60/60 celdas, y Looker = SQL en 100/100 (sin filtro y con
  Pilar=URGENCIAS).

## Tiempo y orden que funcionó
1. Inscripciones (define el modelo, las vistas base, la vis custom y el estilo).
2. KPI de Éxito (la fuente grande, `cu_pagos`).
3. Venta URG, Actividad URG, Sinergia y Sinergia UPC (reutilizan vistas).
4. KPI de Servicio (fuentes nuevas pre-agregadas).
5. Glosario.
6. Auditoría semántica.
7. Conversión a `.dashboard.lookml` y banner embed.
8. Ajustes de defaults.
