/* =====================================================================
   DMC Contingencia · revierte la migración 044 — varios roles por cuenta
   Vuelve a un rol por cuenta en dmc.usuario.rol y borra dmc.usuario_rol.

   No borra datos a ciegas: si alguna cuenta tiene más de un rol, o si dos
   cuentas comparten técnico (una activa y otra inactiva), se detiene y las
   lista. Hay que dejarlas con un solo rol, y desvincular el técnico de la
   cuenta inactiva, antes de revertir.

   Antes de revertir:
     · si aplicaste la 045, revierte primero la 045 (devuelve la columna rol);
     · vuelve a desplegar la app anterior a la 044 — la nueva lee dmc.usuario_rol.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-044-revertir.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 45)
    THROW 50144, 'La migración 045 está aplicada: reviértela primero (sql/migracion-045-revertir.sql).', 1;
GO

IF OBJECT_ID('dmc.usuario_rol', 'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT usuario_id FROM dmc.usuario_rol GROUP BY usuario_id HAVING COUNT(*) > 1)
    BEGIN
        SELECT u.id, u.email, STRING_AGG(r.rol, ', ') AS roles
          FROM dmc.usuario u JOIN dmc.usuario_rol r ON r.usuario_id = u.id
         GROUP BY u.id, u.email
        HAVING COUNT(*) > 1;
        THROW 50145, 'Hay cuentas con más de un rol (listadas arriba). Déjalas con uno solo desde el panel antes de revertir.', 1;
    END
END
GO

IF EXISTS (SELECT tecnico_id FROM dmc.usuario WHERE tecnico_id IS NOT NULL GROUP BY tecnico_id HAVING COUNT(*) > 1)
BEGIN
    SELECT u.tecnico_id, u.id, u.email, u.activo
      FROM dmc.usuario u
     WHERE u.tecnico_id IN (SELECT tecnico_id FROM dmc.usuario WHERE tecnico_id IS NOT NULL
                             GROUP BY tecnico_id HAVING COUNT(*) > 1)
     ORDER BY u.tecnico_id, u.activo DESC;
    THROW 50146, 'Hay técnicos vinculados a más de una cuenta (listadas arriba). Deja uno por técnico antes de revertir.', 1;
END
GO

-- Las cuentas creadas con la app nueva tienen la columna en NULL: se copia el
-- único rol que tienen. Las demás ya lo tenían y no cambia.
IF OBJECT_ID('dmc.usuario_rol', 'U') IS NOT NULL
    UPDATE u SET rol = r.rol
      FROM dmc.usuario u JOIN dmc.usuario_rol r ON r.usuario_id = u.id
     WHERE u.rol IS NULL OR u.rol <> r.rol;
GO
-- Las reglas viejas: un TECNICO sin técnico o un no-técnico con técnico no
-- caben. Con un solo rol por cuenta y los triggers de la 044, no debería haber.
IF EXISTS (SELECT 1 FROM dmc.usuario
            WHERE rol IS NULL
               OR (rol = 'TECNICO' AND tecnico_id IS NULL)
               OR (rol <> 'TECNICO' AND tecnico_id IS NOT NULL)
               OR (rol_id IS NOT NULL AND rol <> 'COORDINADOR'))
BEGIN
    SELECT id, email, rol, tecnico_id, rol_id FROM dmc.usuario
     WHERE rol IS NULL
        OR (rol = 'TECNICO' AND tecnico_id IS NULL)
        OR (rol <> 'TECNICO' AND tecnico_id IS NOT NULL)
        OR (rol_id IS NOT NULL AND rol <> 'COORDINADOR');
    THROW 50147, 'Hay cuentas que no cumplen las reglas de un solo rol (listadas arriba).', 1;
END
GO

DROP TRIGGER IF EXISTS dmc.tg_usuario_roles_coherentes;
DROP TRIGGER IF EXISTS dmc.tg_usuario_rol_coherente;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dmc.usuario') AND name = 'rol' AND is_nullable = 1)
    ALTER TABLE dmc.usuario ALTER COLUMN rol varchar(12) NOT NULL;
GO
IF OBJECT_ID('dmc.ck_usuario_rol', 'C') IS NULL
    ALTER TABLE dmc.usuario WITH CHECK ADD CONSTRAINT ck_usuario_rol CHECK (rol IN ('ADMIN','COORDINADOR','TECNICO'));
IF OBJECT_ID('dmc.ck_usuario_rol_id', 'C') IS NULL
    ALTER TABLE dmc.usuario WITH CHECK ADD CONSTRAINT ck_usuario_rol_id CHECK (rol_id IS NULL OR rol = 'COORDINADOR');
IF OBJECT_ID('dmc.ck_usuario_tecnico', 'C') IS NULL
    ALTER TABLE dmc.usuario WITH CHECK ADD CONSTRAINT ck_usuario_tecnico CHECK (
        (rol =  'TECNICO' AND tecnico_id IS NOT NULL) OR
        (rol <> 'TECNICO' AND tecnico_id IS NULL));
GO

IF EXISTS (SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID('dmc.usuario') AND name = 'uq_usuario_tecnico'
              AND filter_definition LIKE '%activo%')
    DROP INDEX uq_usuario_tecnico ON dmc.usuario;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dmc.usuario') AND name = 'uq_usuario_tecnico')
    CREATE UNIQUE INDEX uq_usuario_tecnico ON dmc.usuario (tecnico_id) WHERE tecnico_id IS NOT NULL;
GO

IF OBJECT_ID('dmc.usuario_rol', 'U') IS NOT NULL DROP TABLE dmc.usuario_rol;
GO

DELETE FROM dmc.schema_version WHERE version = 44;
GO

PRINT 'Migración 044 revertida.';
GO
