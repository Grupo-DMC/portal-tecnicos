/* =====================================================================
   DMC Contingencia · migración 034 — «Mi cuenta»: nombre, teléfono y foto
   Microsoft SQL Server 2022 · esquema dmc

   Qué hace:

     dmc.usuario gana dos columnas opcionales que la propia persona llena
     desde el panel (Administración › Mi cuenta):
       - nombre    nvarchar(120)  cómo se la muestra en el panel
       - telefono  nvarchar(30)

     La foto de perfil va en su propia tabla, dmc.usuario_foto (una fila por
     cuenta), para que la lectura de la sesión —que corre en cada petición—
     no arrastre los bytes. Igual que las fotos del acta, vive en la base:
     no hay almacenamiento de archivos contratado.

   Requisito: tener aplicada la migración 032 (o el esquema base que la trae).
   Es idempotente. Para volver atrás: migracion-034-revertir.sql.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-034-mi-cuenta.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version >= 32)
    THROW 50034, 'Falta aplicar la migración 032 antes que esta.', 1;
GO

IF COL_LENGTH('dmc.usuario', 'nombre') IS NULL
    ALTER TABLE dmc.usuario ADD nombre nvarchar(120) NULL;
GO

IF COL_LENGTH('dmc.usuario', 'telefono') IS NULL
    ALTER TABLE dmc.usuario ADD telefono nvarchar(30) NULL;
GO

IF OBJECT_ID('dmc.usuario_foto', 'U') IS NULL
    CREATE TABLE dmc.usuario_foto (
        usuario_id     bigint          NOT NULL,
        mime           varchar(40)     NOT NULL,
        contenido      varbinary(max)  NOT NULL,
        actualizado_en datetime2(0)    NOT NULL CONSTRAINT df_usuario_foto_actualizado DEFAULT (SYSDATETIME()),
        CONSTRAINT pk_usuario_foto         PRIMARY KEY (usuario_id),
        CONSTRAINT fk_usuario_foto_usuario FOREIGN KEY (usuario_id) REFERENCES dmc.usuario (id) ON DELETE CASCADE,
        CONSTRAINT ck_usuario_foto_mime    CHECK (mime IN ('image/jpeg','image/png','image/webp')),
        -- 1 MB sobra: el navegador la recorta a 512 px antes de subirla.
        CONSTRAINT ck_usuario_foto_tamano  CHECK (DATALENGTH(contenido) BETWEEN 1 AND 1048576)
    );
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 34)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (34, N'Mi cuenta: nombre, teléfono y foto de perfil del usuario');
GO

PRINT 'Migración 034 aplicada.';
GO
