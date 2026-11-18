/* =====================================================================
   DMC Contingencia · revierte la migración 042 — secciones obligatorias del acta
   Borra la configuración de secciones obligatorias: el acta vuelve a pedir solo
   lo de siempre (responsable, motivo y trabajo, firma). Las actas y visitas no
   se tocan.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-042-revertir.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF OBJECT_ID('dmc.acta_seccion_config', 'U') IS NOT NULL
    DROP TABLE dmc.acta_seccion_config;
GO

DELETE FROM dmc.schema_version WHERE version = 42;
GO

PRINT 'Migración 042 revertida.';
GO
