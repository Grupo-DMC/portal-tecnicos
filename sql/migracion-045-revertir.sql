/* =====================================================================
   DMC Contingencia · revierte la migración 045 — devuelve dmc.usuario.rol
   Vuelve a crear la columna (NULL-able, como la dejó la 044) y la llena con
   el rol principal de cada cuenta: el del panel si tiene uno, si no TECNICO.
   dmc.usuario_rol no se toca: no se pierde ningún rol.

   La app nueva sigue funcionando después de esto (no lee la columna). Para
   volver del todo a un rol por cuenta, sigue con sql/migracion-044-revertir.sql.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-045-revertir.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF COL_LENGTH('dmc.usuario', 'rol') IS NULL
    ALTER TABLE dmc.usuario ADD rol varchar(12) NULL;
GO

UPDATE u
   SET rol = COALESCE(
       (SELECT TOP 1 r.rol FROM dmc.usuario_rol r
         WHERE r.usuario_id = u.id AND r.rol IN ('ADMIN', 'COORDINADOR')),
       (SELECT TOP 1 r.rol FROM dmc.usuario_rol r WHERE r.usuario_id = u.id))
  FROM dmc.usuario u;
GO

DELETE FROM dmc.schema_version WHERE version = 45;
GO

PRINT 'Migración 045 revertida: la columna rol volvió con el rol principal de cada cuenta.';
GO
