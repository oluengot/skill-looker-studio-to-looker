# Validación · <Página> (Looker Studio → Looker)

- Página LS `<pageId>` · Dashboard `<modelo>::<pagina>`
- Fuente: `<FUENTE LS>` → `<DATASET>.VW_<FUENTE>` → explore `<explore>`
- Filtros aplicados: `<rango de fecha sobre CAMPO>`, `<exclusiones>`, `<zona/pilar>`
- Hora de los datos: LS (caché) `<fecha hora>` · SQL `<fecha hora>` · Looker `<fecha hora>`

## Matriz
| Entidad | Métrica | LS | SQL (V1) | Looker dev (V2) | Looker prod (V3) | OK |
|---|---|---|---|---|---|---|
| 01. … | | | | | | ✅ |
| **Total** | | | | | | ✅ |

## Pruebas de interacción
| Prueba | Resultado |
|---|---|
| Sin filtros | |
| Filtros por defecto | |
| Filtro <Entidad>=<valor> | |
| Navegación banner (→ cada página) | |

## Diferencias a propósito / pendientes
- 

Veredicto: **1:1** / pendiente (<motivo>)
