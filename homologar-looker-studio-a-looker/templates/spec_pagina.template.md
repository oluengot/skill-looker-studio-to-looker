# Spec · Página "<Página>" (pageId `<p_xxx>`)

- Extraída: <fecha hora> · Dashboard destino: `<modelo>::<pagina>`
- Fuente(s) LS → tabla física → vista pasarela → explore:
  - `<Fuente>` (`<datasourceId>`) → `<proy.dataset.tabla>` → `VW_<FUENTE>` → `<prefijo><fuente>`

## Controles y filtros
| Control | Tipo | Campo | Default LS | Default Looker | Afecta a (componentes) |
|---|---|---|---|---|---|
| Selecciona un periodo | fecha | FECHA | Desde 2025 a la fecha | `2025/01/01 to today` | cd-…, cd-… |
| Clínica | lista | NOM_CLINICA | (todas) | `''` | … |

Filtros de página/reporte: `<nombre>: NOT CAMPO IN [...]` → aplicar como `filter_expression`.

## Componentes (orden top → left)
| # | id | Tipo LS | Título | Dims | Métricas (fórmula LS · agregación) | Filtros propios | Rango fecha | Orden/Total | Tipo Looker | Posición (row,col,w,h) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | cd-… | simple-table | | NOM_CLINICA | Pacientes = COUNT_DISTINCT(RUT) | ZONA='U' | FECHA (control) | Total sí | `<PROY>::<vis>` modo tabla | |

## Fórmulas traducidas (LS → SQL → campo LookML)
| Métrica LS | Fórmula LS | SQL BigQuery | Campo LookML (nuevo/reutilizado) |
|---|---|---|---|
| | | | |

## Valores esperados (LS, filtros por defecto)
| Entidad | Métrica 1 | Métrica 2 | … |
|---|---|---|---|
| Total | | | |

## Estilo
- Colores de barra/sección, colores de series, formato numérico, textos fijos (literal):

## Notas / dudas para el usuario
- 
