connection: "<conexion>"

## VISTAS (leen <proyecto>.<DATASET>.VW_*)
include: "/<carpeta>/*.view.lkml"

## DASHBOARDS LookML (fuente oficial; el banner enlaza a <modelo>::<pagina>)
include: "/<carpeta>/dashboard/*.dashboard"

## Las vistas VW_* leen tablas que se actualizan durante el día; caché de 1 hora
## o hasta que cambie la última fecha de carga.
datagroup: actualizacion_<proyecto> {
  sql_trigger: SELECT MAX(<FECHA_CARGA>) FROM `<proyecto>.<DATASET>.VW_<FUENTE_PRINCIPAL>` ;;
  max_cache_age: "1 hour"
}

persist_with: actualizacion_<proyecto>

# =================================================================================
# EXPLORES: <NOMBRE DEL REPORTE>
# Traspaso 1:1 del reporte Looker Studio "<nombre>". Un explore por fuente de LS.
# =================================================================================

explore: <prefijo><fuente> {
  label: "<Proyecto> - <Fuente>"
  description: "<Qué preguntas responde>. <Granularidad: una fila por …>. Fuente: <proyecto>.<DATASET>.VW_<FUENTE>."
  tags: ["dominio:<dominio>", "equipo:<equipo>", "<proyecto>"]
  group_label: "<Proyecto>"
}

# Si la fuente LS era un BLEND:
# explore: <prefijo><fuente_a> {
#   join: <prefijo><fuente_b> {
#     type: left_outer            # mismo tipo de unión que el blend
#     relationship: many_to_one   # evitar fan-out; validar totales
#     sql_on: ${<prefijo><fuente_a>.clave} = ${<prefijo><fuente_b>.clave} ;;
#   }
# }
