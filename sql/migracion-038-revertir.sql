/* =====================================================================
   DMC Contingencia · revierte la migración 038 — problemas desde el panel
   Quita dmc.problema.registrado_en_panel. Los problemas siguen ahí; solo se
   pierde la marca de cuáles los anotó coordinación, y el próximo cierre de
   acta volvería a borrar los que no agarró nadie más.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-038-revertir.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF COL_LENGTH('dmc.problema', 'registrado_en_panel') IS NOT NULL
BEGIN
    ALTER TABLE dmc.problema DROP CONSTRAINT df_problema_en_panel;
    ALTER TABLE dmc.problema DROP COLUMN registrado_en_panel;
END
GO

DELETE FROM dmc.schema_version WHERE version = 38;
GO

PRINT 'Migración 038 revertida.';
GO
