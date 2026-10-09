# 10 · Checklists

## A. Inicio del proyecto
- [ ] Ficha del proyecto completa (`templates/ficha_proyecto.template.md`).
- [ ] Accesos probados (`01_herramientas_y_accesos.md`, prueba de humo).
- [ ] Autorizaciones registradas: crear vistas BQ (sí/no), deploy por el agente (sí/no).
- [ ] Carpeta de trabajo local creada, con `README.md`, `specs/`, `sql/`, `lookml/` y `validacion/`.
- [ ] Inventario de páginas LS → tabla página → dashboard LookML → URL embed.
- [ ] Orden de trabajo acordado: una página a la vez, empezando por la más simple o la que define
  las vistas base.

## B. Por página (repetir)
**Extracción**
- [ ] Spec con todos los componentes, controles, filtros, rangos y estilos.
- [ ] Fórmulas de fuente y de gráfico capturadas (incluido `calculatedField` del request).
- [ ] Valores LS anotados con los filtros por defecto, más una captura de pantalla.

**Datos**
- [ ] Vistas pasarela existentes o creadas (con OK del usuario) y conteo verificado por la
  conexión de Looker.

**Validación SQL (V1)**
- [ ] Cada métrica × entidad cuadra, incluida la fila Total.
- [ ] `validacion_<pagina>.md` escrito.

**LookML**
- [ ] Campos nuevos con el estándar IA (label, descripción en 3 partes, synonyms, tags,
  required_fields, unidad).
- [ ] Ningún campo existente cambió de `sql`, `type`, `filters` o `value_format`.
- [ ] Subido a dev, verificado byte a byte, y validate con 0 errores.

**Dashboard**
- [ ] `<pagina>.dashboard.lookml` con banner (página activa sin enlace), encabezado, barras,
  mosaicos y filtros.
- [ ] Defaults de los filtros = LS.
- [ ] `listen` por mosaico = LS.
- [ ] Exclusiones en `filter_expression`.
- [ ] `title_hidden` donde corresponde.
- [ ] Tablas con la vis custom; gráficos con colores, animación y `series_labels`.
- [ ] Tamaños sin recortes ni scroll interno.

**Validación dashboard (V2)**
- [ ] Sin filtros, con defaults y con un filtro aplicado: valores = V1.
- [ ] Navegación del banner, orden y totales verificados.

**Cierre de página**
- [ ] Re-extracción rápida de LS para detectar cambios del diseñador durante el trabajo.
- [ ] README actualizado (estado de la página, diferencias a propósito).

## C. Deploy
- [ ] Validate con 0 errores en todo el proyecto.
- [ ] Archivos ajenos identificados y avisados.
- [ ] Commit con mensaje descriptivo y deploy (o pasos entregados al usuario).
- [ ] `remote_ref` = commit; `run_dashboard` en producción = V2 (V3).

## D. QA final del reporte completo
- [ ] Todas las páginas existen como `<modelo>::<pagina>` y abren por la URL embed.
- [ ] El banner de cada página enlaza a las N−1 restantes y no quedan ids antiguos.
- [ ] Ninguna página muestra la barra de pestañas nativa.
- [ ] Defaults de fecha coherentes con LS en todas las páginas.
- [ ] Formatos (enteros, %, moneda, compactos) = LS, o la diferencia está decidida con el usuario.
- [ ] Descripciones de dashboards propias de cada página (no heredadas).
- [ ] Capa semántica auditada (sin labels duplicados, todo descrito).
- [ ] UDD de borrador: retirados o marcados como legado, con decisión del usuario.

## E. Entregables
- [ ] Proyecto LookML: vistas, modelo, manifest (vis), dashboards, y opcionalmente
  `INFORME_TECNICO.md`.
- [ ] Carpeta de trabajo con:
  - README (arquitectura, estado, mapa de URLs, cómo modificar);
  - `sql/` (DDL de las vistas);
  - `lookml/` (copia);
  - `validacion_*.md`;
  - `specs/`.
- [ ] Opcional: informe técnico PDF (HTML + Chrome headless).
- [ ] Resumen al usuario:
  - qué quedó en producción;
  - los valores clave validados;
  - las diferencias a propósito;
  - los pendientes y las preguntas abiertas.

## F. Mantenimiento (cambio puntual sobre un dashboard publicado)
- [ ] GET del `.dashboard.lookml` (contents + digest), edición mínima, y PUT con verificación.
- [ ] Validate con 0 errores, prueba en dev y valores sin cambios no deseados.
- [ ] Commit, deploy y verificación en producción.
- [ ] README y memoria actualizados.
