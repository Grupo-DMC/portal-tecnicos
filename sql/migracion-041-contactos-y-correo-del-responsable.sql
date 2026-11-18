/* =====================================================================
   DMC Contingencia · migración 041 — contactos por cliente y por sucursal,
                                      correo del responsable de tienda
   Microsoft SQL Server 2022 · esquema dmc

   El esquema de contactos NO cambia: sigue siendo una sola tabla de personas
   (dmc.contacto) y sus cargos con alcance (dmc.contacto_cargo, migración 029).
   «Los contactos del cliente» son los cargos con alcance CLIENTE o MARCA; «los
   de la sucursal», los cargos con alcance SUCURSAL. La separación la hace el
   alcance, no una tabla aparte:
     - una misma persona puede ser contacto de la marca y de dos tiendas sin
       duplicar su nombre, correo y teléfono;
     - un dueño nuevo (zona, mall…) es ampliar un CHECK, no otra tabla;
     - las tiendas siguen heredando los contactos de su marca, región y cliente.

   Lo que esta migración agrega:

     1. dmc.visita_ejecucion.responsable_email
                               el correo de quien recibe y firma en la tienda.
                               Opcional, como ya lo es el teléfono.
     2. dmc.persona_local.email
                               el mismo dato en la lista de personas de la
                               tienda, para ofrecerlo en la próxima visita.
     3. ck_*_email ........... si viene, tiene que tener forma de correo.
     4. ix_contacto_cargo_sucursal
                               índice para traer rápido los contactos propios
                               de una tienda (se piden en cada acta).

   No toca ninguna fila: los contactos, cargos, personas y actas existentes
   quedan tal cual. Las columnas nuevas nacen en NULL.

   Requisito: tener aplicada la migración 040.
   Es idempotente: se puede correr varias veces sin romper nada.
   Para deshacerla: sql/migracion-041-revertir.sql

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-041-contactos-y-correo-del-responsable.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 40)
    THROW 50041, 'Falta aplicar la migración 040 antes que esta.', 1;
GO

-- ── 1 y 2. Columnas ─────────────────────────────────────────────────────────
IF COL_LENGTH('dmc.visita_ejecucion', 'responsable_email') IS NULL
    ALTER TABLE dmc.visita_ejecucion ADD responsable_email nvarchar(160) NULL;
IF COL_LENGTH('dmc.persona_local', 'email') IS NULL
    ALTER TABLE dmc.persona_local ADD email nvarchar(160) NULL;
GO

-- ── 3. Forma de correo ──────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_ejecucion_responsable_email')
    ALTER TABLE dmc.visita_ejecucion ADD CONSTRAINT ck_ejecucion_responsable_email
        CHECK (responsable_email IS NULL OR responsable_email LIKE N'%_@_%');
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_persona_local_email')
    ALTER TABLE dmc.persona_local ADD CONSTRAINT ck_persona_local_email
        CHECK (email IS NULL OR email LIKE N'%_@_%');
GO

-- ── 4. Contactos propios de una tienda ─────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_contacto_cargo_sucursal' AND object_id = OBJECT_ID('dmc.contacto_cargo'))
    CREATE INDEX ix_contacto_cargo_sucursal ON dmc.contacto_cargo (alcance_id)
        INCLUDE (contacto_id, cargo) WHERE alcance_tipo = 'SUCURSAL';
GO

-- ── Versión ─────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 41)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (41, N'Contactos de cliente y de sucursal; correo del responsable de tienda');
GO

PRINT 'Migración 041 aplicada.';
GO
