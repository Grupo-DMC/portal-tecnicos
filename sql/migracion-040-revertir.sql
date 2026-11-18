/* =====================================================================
   DMC Contingencia · revierte la migración 040 — categorías de problema
   Quita la categoría de los tipos de problema y las secciones de tipo
   PROBLEMA. Los tipos de problema y las visitas no se tocan: la lista vuelve
   a ser plana.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-040-revertir.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF COL_LENGTH('dmc.catalogo_problema', 'seccion_id') IS NOT NULL
BEGIN
    BEGIN TRANSACTION;
    ALTER TABLE dmc.catalogo_problema DROP CONSTRAINT fk_cat_problema_seccion;
    ALTER TABLE dmc.catalogo_problema DROP COLUMN seccion_id;
    COMMIT TRANSACTION;
END
GO

DELETE FROM dmc.catalogo_seccion WHERE tipo = 'PROBLEMA';
GO

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
     WHERE name = 'ck_catalogo_seccion_tipo' AND definition LIKE '%PROBLEMA%')
BEGIN
    BEGIN TRANSACTION;
    ALTER TABLE dmc.catalogo_seccion DROP CONSTRAINT ck_catalogo_seccion_tipo;
    ALTER TABLE dmc.catalogo_seccion ADD CONSTRAINT ck_catalogo_seccion_tipo
        CHECK (tipo IN ('MOTIVO', 'TRABAJO'));
    COMMIT TRANSACTION;
END
GO

DELETE FROM dmc.schema_version WHERE version = 40;
GO

PRINT 'Migración 040 revertida.';
GO
