/* =====================================================================
   DMC Contingencia · revierte la migración 034 — «Mi cuenta»
   Borra la foto de perfil y las columnas nombre y teléfono de dmc.usuario.
   Lo que la gente haya escrito ahí se pierde.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-034-revertir.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF OBJECT_ID('dmc.usuario_foto', 'U') IS NOT NULL
    DROP TABLE dmc.usuario_foto;
GO

IF COL_LENGTH('dmc.usuario', 'telefono') IS NOT NULL
    ALTER TABLE dmc.usuario DROP COLUMN telefono;
GO

IF COL_LENGTH('dmc.usuario', 'nombre') IS NOT NULL
    ALTER TABLE dmc.usuario DROP COLUMN nombre;
GO

DELETE FROM dmc.schema_version WHERE version = 34;
GO

PRINT 'Migración 034 revertida.';
GO
