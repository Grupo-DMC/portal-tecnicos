/* =====================================================================
   DMC Contingencia · revierte la migración 036 — avisos push
   Borra dmc.push_suscripcion: cada quien tendría que volver a activar los
   avisos del navegador.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-036-revertir.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF OBJECT_ID('dmc.push_suscripcion', 'U') IS NOT NULL
    DROP TABLE dmc.push_suscripcion;
GO

DELETE FROM dmc.schema_version WHERE version = 36;
GO

PRINT 'Migración 036 revertida.';
GO
