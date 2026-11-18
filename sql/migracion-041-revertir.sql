/* =====================================================================
   DMC Contingencia · revierte la migración 041
   Quita el correo del responsable de tienda (actas y personas del local) y el
   índice de contactos por sucursal. Se pierden los correos anotados.
   Los contactos y sus cargos no se tocan: son de la migración 029.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-041-revertir.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_contacto_cargo_sucursal' AND object_id = OBJECT_ID('dmc.contacto_cargo'))
    DROP INDEX ix_contacto_cargo_sucursal ON dmc.contacto_cargo;
IF OBJECT_ID('dmc.ck_ejecucion_responsable_email', 'C') IS NOT NULL
    ALTER TABLE dmc.visita_ejecucion DROP CONSTRAINT ck_ejecucion_responsable_email;
IF OBJECT_ID('dmc.ck_persona_local_email', 'C') IS NOT NULL
    ALTER TABLE dmc.persona_local DROP CONSTRAINT ck_persona_local_email;
GO

IF COL_LENGTH('dmc.visita_ejecucion', 'responsable_email') IS NOT NULL
    ALTER TABLE dmc.visita_ejecucion DROP COLUMN responsable_email;
IF COL_LENGTH('dmc.persona_local', 'email') IS NOT NULL
    ALTER TABLE dmc.persona_local DROP COLUMN email;
GO

DELETE FROM dmc.schema_version WHERE version = 41;
GO

PRINT 'Migración 041 revertida.';
GO
