/* =====================================================================
   DMC Contingencia · migración 044 — varios roles por cuenta (1 de 2)
   Microsoft SQL Server 2022 · esquema dmc

   Hasta ahora cada cuenta tenía un solo rol (dmc.usuario.rol). Desde esta
   migración los roles viven en dmc.usuario_rol, una fila por rol, y una misma
   persona puede ser, con el mismo correo y la misma clave, administradora (o
   coordinadora) y técnica a la vez.

   Combinaciones válidas:  ADMIN · COORDINADOR · TECNICO
                           ADMIN + TECNICO · COORDINADOR + TECNICO
   (ADMIN y COORDINADOR juntos no: son dos maneras de entrar al mismo panel.)

   Qué hace:

     1. dmc.usuario_rol ......... (usuario_id, rol). Se llena con el rol que
                                  hoy tiene cada cuenta: nadie gana ni pierde
                                  acceso al aplicarla.
     2. Las reglas que antes eran CHECK de dmc.usuario cruzan ahora dos tablas
        y pasan a dos triggers (tg_usuario_rol_coherente y
        tg_usuario_roles_coherentes):
          · toda cuenta tiene al menos un rol ........ ck_usuario_roles_alguno
          · no ADMIN y COORDINADOR a la vez ........... ck_usuario_roles_panel
          · el rol TECNICO exige tecnico_id ........... ck_usuario_roles_tecnico
          · rol_id solo con el rol COORDINADOR ........ ck_usuario_roles_rol_id
     3. Se quitan ck_usuario_rol, ck_usuario_rol_id y ck_usuario_tecnico, y la
        columna dmc.usuario.rol queda NULL-able. La app nueva ya no la lee ni
        la escribe; la borra la migración 045, que se aplica DESPUÉS de
        desplegar la app nueva. Mientras tanto la app anterior sigue
        funcionando contra esta base (lee la columna, que conserva su valor).
     4. uq_usuario_tecnico pasa a valer solo entre cuentas ACTIVAS: así quien
        tenía una cuenta de técnico aparte puede desactivarla (con su motivo)
        y vincular ese técnico a su cuenta del panel. Dos cuentas activas
        siguen sin poder compartir técnico.

   Ojo entre la 044 y el despliegue: no crees ni edites usuarios con la app
   anterior; lo que guarde no pasa a dmc.usuario_rol. (La 045 rellena las
   cuentas que hayan quedado sin rol.)

   Requisito: tener aplicada la migración 043.
   Es idempotente: se puede correr varias veces sin romper nada.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-044-roles-por-usuario.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 43)
    THROW 50044, 'Falta aplicar la migración 043 antes que esta.', 1;
GO

-- ── 1. La tabla de roles ──────────────────────────────────────────────────
IF OBJECT_ID('dmc.usuario_rol', 'U') IS NULL
BEGIN
    CREATE TABLE dmc.usuario_rol (
        usuario_id  bigint        NOT NULL,
        rol         varchar(12)   NOT NULL,
        creado_en   datetime2(0)  NOT NULL CONSTRAINT df_usuario_rol_creado DEFAULT (SYSDATETIME()),
        CONSTRAINT pk_usuario_rol         PRIMARY KEY (usuario_id, rol),
        CONSTRAINT fk_usuario_rol_usuario FOREIGN KEY (usuario_id) REFERENCES dmc.usuario (id) ON DELETE CASCADE,
        CONSTRAINT ck_usuario_rol_valor   CHECK (rol IN ('ADMIN', 'COORDINADOR', 'TECNICO'))
    );
    CREATE INDEX ix_usuario_rol_rol ON dmc.usuario_rol (rol) INCLUDE (usuario_id);
END
GO

-- Cada cuenta conserva el rol que tenía. Solo las que todavía no tienen
-- ninguno: correrla otra vez no duplica ni pisa nada.
INSERT INTO dmc.usuario_rol (usuario_id, rol)
SELECT u.id, u.rol
  FROM dmc.usuario u
 WHERE u.rol IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dmc.usuario_rol r WHERE r.usuario_id = u.id);
GO

-- ── 2. Las reglas, ahora entre dos tablas ─────────────────────────────────
CREATE OR ALTER TRIGGER dmc.tg_usuario_rol_coherente ON dmc.usuario_rol AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    -- Las cuentas tocadas que siguen existiendo: al borrar una cuenta, el
    -- ON DELETE CASCADE se lleva sus roles y no hay nada que revisar.
    DECLARE @cuentas TABLE (id bigint PRIMARY KEY);
    INSERT INTO @cuentas (id)
    SELECT x.usuario_id
      FROM (SELECT usuario_id FROM inserted UNION SELECT usuario_id FROM deleted) x
      JOIN dmc.usuario u ON u.id = x.usuario_id;

    IF EXISTS (SELECT 1 FROM @cuentas c
                WHERE NOT EXISTS (SELECT 1 FROM dmc.usuario_rol r WHERE r.usuario_id = c.id))
        THROW 51044, 'ck_usuario_roles_alguno: toda cuenta necesita al menos un rol.', 1;

    IF EXISTS (SELECT 1 FROM @cuentas c
                WHERE (SELECT COUNT(*) FROM dmc.usuario_rol r
                        WHERE r.usuario_id = c.id AND r.rol IN ('ADMIN', 'COORDINADOR')) > 1)
        THROW 51045, 'ck_usuario_roles_panel: una cuenta no puede ser ADMIN y COORDINADOR a la vez.', 1;

    IF EXISTS (SELECT 1 FROM @cuentas c
                 JOIN dmc.usuario u ON u.id = c.id
                 JOIN dmc.usuario_rol r ON r.usuario_id = c.id AND r.rol = 'TECNICO'
                WHERE u.tecnico_id IS NULL)
        THROW 51046, 'ck_usuario_roles_tecnico: el rol TECNICO necesita un técnico vinculado.', 1;

    IF EXISTS (SELECT 1 FROM @cuentas c
                 JOIN dmc.usuario u ON u.id = c.id
                WHERE u.rol_id IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM dmc.usuario_rol r WHERE r.usuario_id = c.id AND r.rol = 'COORDINADOR'))
        THROW 51047, 'ck_usuario_roles_rol_id: solo una cuenta COORDINADOR lleva un rol del panel.', 1;
END;
GO

-- Lo mismo mirado desde dmc.usuario: no se puede soltar el técnico de quien
-- tiene el rol TECNICO, ni darle un rol del panel a quien no es COORDINADOR.
-- Solo en UPDATE: una cuenta recién insertada todavía no tiene roles, y es el
-- alta de sus roles la que dispara el trigger de arriba.
CREATE OR ALTER TRIGGER dmc.tg_usuario_roles_coherentes ON dmc.usuario AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT (UPDATE(tecnico_id) OR UPDATE(rol_id)) RETURN;

    IF EXISTS (SELECT 1 FROM inserted i
                 JOIN dmc.usuario_rol r ON r.usuario_id = i.id AND r.rol = 'TECNICO'
                WHERE i.tecnico_id IS NULL)
        THROW 51046, 'ck_usuario_roles_tecnico: el rol TECNICO necesita un técnico vinculado.', 1;

    IF EXISTS (SELECT 1 FROM inserted i
                WHERE i.rol_id IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM dmc.usuario_rol r WHERE r.usuario_id = i.id AND r.rol = 'COORDINADOR'))
        THROW 51047, 'ck_usuario_roles_rol_id: solo una cuenta COORDINADOR lleva un rol del panel.', 1;
END;
GO

-- ── 3. Fuera las restricciones de un solo rol ─────────────────────────────
IF OBJECT_ID('dmc.ck_usuario_tecnico', 'C') IS NOT NULL ALTER TABLE dmc.usuario DROP CONSTRAINT ck_usuario_tecnico;
IF OBJECT_ID('dmc.ck_usuario_rol_id', 'C') IS NOT NULL  ALTER TABLE dmc.usuario DROP CONSTRAINT ck_usuario_rol_id;
IF OBJECT_ID('dmc.ck_usuario_rol', 'C') IS NOT NULL     ALTER TABLE dmc.usuario DROP CONSTRAINT ck_usuario_rol;
GO
IF COL_LENGTH('dmc.usuario', 'rol') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns
                WHERE object_id = OBJECT_ID('dmc.usuario') AND name = 'rol' AND is_nullable = 0)
    ALTER TABLE dmc.usuario ALTER COLUMN rol varchar(12) NULL;
GO

-- ── 4. Un técnico, una sola cuenta activa ─────────────────────────────────
IF EXISTS (SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID('dmc.usuario') AND name = 'uq_usuario_tecnico'
              AND filter_definition NOT LIKE '%activo%')
    DROP INDEX uq_usuario_tecnico ON dmc.usuario;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dmc.usuario') AND name = 'uq_usuario_tecnico')
    CREATE UNIQUE INDEX uq_usuario_tecnico ON dmc.usuario (tecnico_id) WHERE tecnico_id IS NOT NULL AND activo = 1;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 44)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (44, N'Varios roles por cuenta: dmc.usuario_rol');
GO

PRINT 'Migración 044 aplicada. Despliega la app nueva y después aplica la 045.';
GO
