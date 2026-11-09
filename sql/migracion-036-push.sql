/* =====================================================================
   DMC Contingencia · migración 036 — avisos push (navegador cerrado)
   Microsoft SQL Server 2022 · esquema dmc

   Agrega dmc.push_suscripcion: un registro por navegador donde alguien
   activó «Avisos del navegador». Con él el servidor puede mandar el aviso
   aunque no haya ninguna pestaña abierta. La app solo lo usa si están
   definidas VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (ver .env.example).

   Sin llave foránea a dmc.usuario, como el resto de la campanita. Las
   suscripciones que el servicio de push da por muertas (404/410) las borra
   la propia app.

   Requisito: tener aplicada la migración 035.
   Es idempotente: se puede correr varias veces sin romper nada.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-036-push.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 35)
    THROW 50036, 'Falta aplicar la migración 035 antes que esta.', 1;
GO

IF OBJECT_ID('dmc.push_suscripcion', 'U') IS NULL
    CREATE TABLE dmc.push_suscripcion (
        id          bigint         IDENTITY(1,1) NOT NULL,
        usuario_id  bigint         NOT NULL,
        endpoint    nvarchar(450)  NOT NULL,   -- la dirección que da el navegador; única por navegador
        p256dh      varchar(200)   NOT NULL,
        auth        varchar(100)   NOT NULL,
        creado_en   datetime2(0)   NOT NULL CONSTRAINT df_push_suscripcion_creado DEFAULT (SYSDATETIME()),
        CONSTRAINT pk_push_suscripcion PRIMARY KEY (id),
        CONSTRAINT uq_push_suscripcion_endpoint UNIQUE (endpoint)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_push_suscripcion_usuario' AND object_id = OBJECT_ID('dmc.push_suscripcion'))
    CREATE INDEX ix_push_suscripcion_usuario ON dmc.push_suscripcion (usuario_id);
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 36)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (36, N'Avisos push: suscripciones por navegador');
GO

PRINT 'Migración 036 aplicada.';
GO
