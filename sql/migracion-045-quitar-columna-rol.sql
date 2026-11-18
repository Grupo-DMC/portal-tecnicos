/* =====================================================================
   DMC Contingencia · migración 045 — varios roles por cuenta (2 de 2)
   Microsoft SQL Server 2022 · esquema dmc

   Borra la columna dmc.usuario.rol, que desde la 044 ya no lee nadie: los
   roles viven en dmc.usuario_rol.

   Aplícala DESPUÉS de desplegar la app nueva (la que lee dmc.usuario_rol) y de
   comprobar que se entra bien al panel. Con la app anterior todavía
   desplegada, nadie podría iniciar sesión.

   Antes de borrar, cualquier cuenta que haya quedado sin roles —creada con la
   app anterior entre la 044 y el despliegue— recibe el que dice la columna.

   Requisito: tener aplicada la migración 044.
   Es idempotente: se puede correr varias veces sin romper nada.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-045-quitar-columna-rol.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 44)
    THROW 50045, 'Falta aplicar la migración 044 antes que esta.', 1;
GO

IF COL_LENGTH('dmc.usuario', 'rol') IS NOT NULL
    EXEC (N'
        INSERT INTO dmc.usuario_rol (usuario_id, rol)
        SELECT u.id, u.rol
          FROM dmc.usuario u
         WHERE u.rol IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM dmc.usuario_rol r WHERE r.usuario_id = u.id);');
GO

IF EXISTS (SELECT 1 FROM dmc.usuario u WHERE NOT EXISTS (SELECT 1 FROM dmc.usuario_rol r WHERE r.usuario_id = u.id))
BEGIN
    SELECT u.id, u.email FROM dmc.usuario u
     WHERE NOT EXISTS (SELECT 1 FROM dmc.usuario_rol r WHERE r.usuario_id = u.id);
    THROW 50046, 'Hay cuentas sin ningún rol (listadas arriba): asígnales uno antes de borrar la columna.', 1;
END
GO

IF COL_LENGTH('dmc.usuario', 'rol') IS NOT NULL
    ALTER TABLE dmc.usuario DROP COLUMN rol;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 45)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (45, N'Fuera dmc.usuario.rol: los roles viven en dmc.usuario_rol');
GO

PRINT 'Migración 045 aplicada.';
GO
