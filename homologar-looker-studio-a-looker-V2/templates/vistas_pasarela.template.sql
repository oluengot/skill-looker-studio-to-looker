-- Vistas pasarela en <proyecto>.<DATASET> (conexión Looker <conexion>).
-- Leen las MISMAS tablas que usa el reporte Looker Studio "<nombre>", así siempre están al día
-- y cuadran 1:1. Sin lógica: toda la lógica vive en LookML.
-- Creadas el <fecha> con autorización de <usuario>. NO ejecutar sin OK del usuario.

CREATE VIEW `<proyecto>.<DATASET>.VW_<FUENTE>`
OPTIONS(description="<Qué contiene>. Fuente del reporte Looker Studio <nombre> (páginas <…>). Lee <proyecto_origen>.<dataset_origen>.<TABLA>.")
AS SELECT * FROM `<proyecto_origen>.<dataset_origen>.<TABLA>`;

-- Verificación (correr por la conexión de Looker):
-- SELECT COUNT(*) FROM `<proyecto>.<DATASET>.VW_<FUENTE>`;
-- SELECT COUNT(*) FROM `<proyecto_origen>.<dataset_origen>.<TABLA>`;
