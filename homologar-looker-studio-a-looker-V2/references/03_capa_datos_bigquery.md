# 03 · Capa de datos (BigQuery): vistas pasarela

## Principio

Looker debe leer **exactamente las mismas tablas que Looker Studio** y, a la vez, todo debe
quedar dentro del dataset del área (la "casa" de los datos). La solución es una **vista pasarela**
por cada fuente de LS, en el dataset destino:

```sql
CREATE VIEW `<proyecto>.<DATASET_DESTINO>.VW_<FUENTE>`
OPTIONS(description="<qué es>. Fuente del reporte Looker Studio <nombre>. Lee <proyecto.dataset.tabla>.")
AS SELECT * FROM `<proyecto_origen>.<dataset_origen>.<TABLA_ORIGEN>`;
```

- Al ser `SELECT *` sin lógica, la vista siempre está al día y no altera el valor. Toda la lógica
  va en LookML, donde queda documentada y validada.
- Nombre: `VW_` + nombre de la fuente en mayúsculas (`VW_INF_TPAGOS`, `VW_CUI_SINERGIA`).
- Sin tildes ni ñ en los nombres.
- Guarda el DDL en `sql/vistas_<proyecto>.sql` de la carpeta de trabajo (plantilla
  `templates/vistas_pasarela.template.sql`).

## Por qué no copiar tablas ni usar las que "ya existen"

- Las copias (`BASE_*`, snapshots) se congelan y pierden columnas nuevas. En el caso real, las
  `BASE_*` del dataset estaban congeladas desde semanas antes y les faltaban `FUENTE_INSCRIPCION`
  y `PILAR`.
- Si una tabla del dataset destino se llama parecido a la fuente LS, **no asumas que es la misma**.
  Compara esquema y conteo contra la tabla que LS realmente usa (la que da `getBlockDatasource`).

## Tablas pre-agregadas en origen

Si la fuente de LS ya viene agregada (p. ej. encuestas NPS por mes × clínica, con
`nps_final` calculado), la vista pasarela la expone igual. **En LookML no sumes la columna
final**: recalcula el índice desde los conteos sumados, para que agregue bien en totales y
gráficos "Global". Ver `05_capa_semantica_lookml.md`.

## Fuentes que no son BigQuery

| Fuente LS | Qué hacer |
|---|---|
| Google Sheets | Crear en BigQuery una tabla externa sobre la hoja (o pedir al dueño un proceso de carga) y luego la vista pasarela. Pedir OK al usuario |
| Fuente con *custom query* (SQL propio en LS) | La vista pasarela es ese mismo SQL (`CREATE VIEW … AS <sql de LS>`). Respeta los parámetros de fecha de LS (`@DS_START_DATE`/`@DS_END_DATE`): reemplázalos por un filtro de Looker o un `derived_table` con `{% condition %}` |
| Blend (combinación de fuentes) | Explore con `join` (mismas claves y tipo de join que el blend: left/inner/full) o `derived_table`. Validar que no haya *fan-out* (usar `relationship` correcto y medidas `count_distinct` o simétricas) |
| Conectores de terceros (GA4, Ads, CSV) | Fuera de alcance directo. Se necesita una carga a BigQuery primero. Informar al usuario |

## Pasos

1. Lista las fuentes LS con su tabla física (fase 1).
2. Por cada una, comprueba si ya existe una `VW_*` equivalente en el dataset destino. Reutilízala
   solo si su SQL es `SELECT *` de la misma tabla.
3. Pide **OK explícito** al usuario para crear las vistas que falten (es un objeto compartido).
4. Créalas con una de estas vías:
   - **REST BigQuery** con el token del usuario:
     `POST https://bigquery.googleapis.com/bigquery/v2/projects/<billing>/queries` y
     `{query: "<DDL>", useLegacySql: false}`, con header `Authorization: Bearer $(gcloud auth print-access-token)`.
     El usuario debe haber hecho `gcloud auth login`.
   - MCP de BigQuery (`execute_sql`).
   - Consola de BigQuery: el usuario pega el DDL.
   - La conexión de Looker (`sql_queries`), solo si su cuenta de servicio tiene permiso de creación.
     Normalmente no lo tiene.
5. Verifica, **por la conexión de Looker**:
   ```sql
   SELECT COUNT(*) FROM `<dataset_destino>.VW_<FUENTE>`;
   SELECT COUNT(*) FROM `<tabla_origen>`;
   ```
   Si da error de permisos, la cuenta de servicio de Looker no puede leer el origen: pide al
   administrador una vista autorizada o permisos de lectura.
6. Registra en el README la tabla "Vista → Lee → Fuente LS".

## Notas operativas

- `bq` CLI puede fallar en Windows (permisos sobre su `third_party`). La API REST con
  `gcloud auth print-access-token` es más robusta. El token expira en ~1 h; renovarlo es una
  acción del usuario si pide login.
- Los datos de origen **cambian durante la migración** (recargas). Si los totales saltan de un
  día para otro sin que cambie el LookML, revisa el conteo de filas de la fuente antes de buscar
  un bug. Revalida siempre contra LS en el mismo momento.
