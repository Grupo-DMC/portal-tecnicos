/* =====================================================================
   DMC Contingencia · migración 035 — campanita de notificaciones
   Microsoft SQL Server 2022 · esquema dmc

   Qué agrega, y para qué:

     1. dmc.actividad ................. una fila por cada cosa que se hace en
                                        el sistema: el técnico cierra un acta,
                                        coordinación agenda o elimina visitas,
                                        alguien edita una sucursal… Es lo que
                                        lista la campanita del panel.
     2. dmc.notificacion_usuario ...... por cuenta: hasta qué actividad ya vio
                                        (lo que hay después es «nuevo») y si
                                        quiere ver sus propios cambios.
     3. dmc.notificacion_preferencia .. por cuenta y tipo: AVISAR, MOSTRAR u
                                        OCULTAR. Solo se guarda lo que la
                                        persona cambió; lo demás vale el
                                        defecto que define la app
                                        (lib/notificaciones.ts).

   dmc.actividad no reemplaza a dmc.auditoria: aquella es el registro formal
   de lo sensible; esta es el aviso del día a día. La app solo lee los
   últimos 30 días; las filas viejas se pueden borrar sin perder nada que
   importe. Sin llave foránea a dmc.usuario a propósito, como la auditoría.

   Requisito: tener aplicada la migración 034 (el nombre de la cuenta, para
   mostrar quién hizo cada cosa).
   Es idempotente: se puede correr varias veces sin romper nada.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-035-notificaciones.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 34)
    THROW 50035, 'Falta aplicar la migración 034 antes que esta.', 1;
GO

IF OBJECT_ID('dmc.actividad', 'U') IS NULL
    CREATE TABLE dmc.actividad (
        id                bigint         IDENTITY(1,1) NOT NULL,
        creado_en         datetime2(0)   NOT NULL CONSTRAINT df_actividad_creado DEFAULT (SYSDATETIME()),
        tipo              varchar(40)    NOT NULL,       -- 'tecnico.cierre', 'visita.alta'… (lib/notificaciones.ts)
        actor_usuario_id  bigint         NULL,           -- quién; NULL si no hay cuenta (pedir contraseña)
        actor_nombre      nvarchar(160)  NULL,           -- su nombre en ese momento
        de_tecnico        bit            NOT NULL CONSTRAINT df_actividad_tecnico DEFAULT (0),
        texto             nvarchar(300)  NOT NULL,       -- la frase sin el sujeto
        detalle           nvarchar(300)  NULL,           -- la sucursal, el nombre del registro…
        enlace            nvarchar(200)  NULL,           -- a dónde lleva el clic
        CONSTRAINT pk_actividad PRIMARY KEY (id)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_actividad_creado' AND object_id = OBJECT_ID('dmc.actividad'))
    CREATE INDEX ix_actividad_creado ON dmc.actividad (creado_en DESC) INCLUDE (tipo, actor_usuario_id);
GO

IF OBJECT_ID('dmc.notificacion_usuario', 'U') IS NULL
    CREATE TABLE dmc.notificacion_usuario (
        usuario_id      bigint        NOT NULL,
        leido_hasta     bigint        NOT NULL CONSTRAINT df_notif_usuario_leido DEFAULT (0),
        ver_propios     bit           NOT NULL CONSTRAINT df_notif_usuario_propios DEFAULT (1),
        actualizado_en  datetime2(0)  NOT NULL CONSTRAINT df_notif_usuario_act DEFAULT (SYSDATETIME()),
        CONSTRAINT pk_notificacion_usuario PRIMARY KEY (usuario_id)
    );
GO

IF OBJECT_ID('dmc.notificacion_preferencia', 'U') IS NULL
    CREATE TABLE dmc.notificacion_preferencia (
        usuario_id  bigint       NOT NULL,
        tipo        varchar(40)  NOT NULL,
        nivel       varchar(8)   NOT NULL,
        CONSTRAINT pk_notificacion_preferencia PRIMARY KEY (usuario_id, tipo),
        CONSTRAINT ck_notificacion_preferencia_nivel CHECK (nivel IN ('AVISAR', 'MOSTRAR', 'OCULTAR'))
    );
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 35)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (35, N'Campanita de notificaciones: actividad y preferencias por cuenta');
GO

PRINT 'Migración 035 aplicada.';
GO
