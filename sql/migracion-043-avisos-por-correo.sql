/* =====================================================================
   DMC Contingencia · migración 043 — avisos por correo y preferencias por canal
   Microsoft SQL Server 2022 · esquema dmc

   Qué agrega, y para qué:

     1. dmc.notificacion_canal ..... por cuenta y tipo: push sí/no y correo
                                     NUNCA / MOMENTO / RESUMEN. Solo se guarda
                                     lo que la persona cambió; NULL vale el
                                     defecto de la app (lib/notificaciones.ts).
     2. dmc.notificacion_correo .... por cuenta: el interruptor general del
                                     correo y la hora del resumen diario.
     3. dmc.correo_aviso_lote ...... cada correo de avisos que se intentó
                                     mandar: a quién, cuántas novedades, cómo
                                     terminó. Sirve también de tope anti-spam
                                     (cuántos salieron en la última hora).
     4. dmc.correo_aviso ........... la cola: una fila por cuenta y actividad
                                     que tiene que llegar por correo, con desde
                                     cuándo puede salir. Al salir queda unida a
                                     su lote.

   Las tablas existen aunque el envío esté apagado: la app solo las usa con
   AVISOS_CORREO_ACTIVO=true (ver .env.example). Sin llaves foráneas a
   dmc.usuario ni a dmc.actividad, como el resto de la campanita.

   Requisito: tener aplicada la migración 042.
   Es idempotente: se puede correr varias veces sin romper nada.

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-043-avisos-por-correo.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 42)
    THROW 50043, 'Falta aplicar la migración 042 antes que esta.', 1;
GO

IF OBJECT_ID('dmc.notificacion_canal', 'U') IS NULL
    CREATE TABLE dmc.notificacion_canal (
        usuario_id  bigint       NOT NULL,
        tipo        varchar(40)  NOT NULL,
        push        bit          NULL,         -- NULL: lo que diga el nivel (AVISAR = sí)
        correo      varchar(8)   NULL,         -- NULL: el defecto del tipo
        CONSTRAINT pk_notificacion_canal PRIMARY KEY (usuario_id, tipo),
        CONSTRAINT ck_notificacion_canal_correo CHECK (correo IS NULL OR correo IN ('NUNCA', 'MOMENTO', 'RESUMEN'))
    );
GO

IF OBJECT_ID('dmc.notificacion_correo', 'U') IS NULL
    CREATE TABLE dmc.notificacion_correo (
        usuario_id      bigint        NOT NULL,
        activo          bit           NOT NULL CONSTRAINT df_notif_correo_activo DEFAULT (1),
        hora_resumen    tinyint       NOT NULL CONSTRAINT df_notif_correo_hora DEFAULT (18),
        actualizado_en  datetime2(0)  NOT NULL CONSTRAINT df_notif_correo_act DEFAULT (SYSDATETIME()),
        CONSTRAINT pk_notificacion_correo PRIMARY KEY (usuario_id),
        CONSTRAINT ck_notificacion_correo_hora CHECK (hora_resumen BETWEEN 0 AND 23)
    );
GO

IF OBJECT_ID('dmc.correo_aviso_lote', 'U') IS NULL
    CREATE TABLE dmc.correo_aviso_lote (
        id            bigint         IDENTITY(1,1) NOT NULL,
        usuario_id    bigint         NOT NULL,
        modo          varchar(8)     NOT NULL,
        estado        varchar(10)    NOT NULL CONSTRAINT df_correo_aviso_lote_estado DEFAULT ('ENVIANDO'),
        cantidad      int            NOT NULL CONSTRAINT df_correo_aviso_lote_cantidad DEFAULT (0),
        proveedor_id  varchar(100)   NULL,
        error         nvarchar(400)  NULL,
        creado_en     datetime2(0)   NOT NULL CONSTRAINT df_correo_aviso_lote_creado DEFAULT (SYSDATETIME()),
        cerrado_en    datetime2(0)   NULL,
        CONSTRAINT pk_correo_aviso_lote PRIMARY KEY (id),
        CONSTRAINT ck_correo_aviso_lote_modo CHECK (modo IN ('MOMENTO', 'RESUMEN')),
        CONSTRAINT ck_correo_aviso_lote_estado CHECK (estado IN ('ENVIANDO', 'ENVIADO', 'ERROR', 'DESCARTADO'))
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_correo_aviso_lote_usuario' AND object_id = OBJECT_ID('dmc.correo_aviso_lote'))
    CREATE INDEX ix_correo_aviso_lote_usuario ON dmc.correo_aviso_lote (usuario_id, modo, creado_en DESC) INCLUDE (estado);
GO

IF OBJECT_ID('dmc.correo_aviso', 'U') IS NULL
    CREATE TABLE dmc.correo_aviso (
        id            bigint        IDENTITY(1,1) NOT NULL,
        usuario_id    bigint        NOT NULL,
        actividad_id  bigint        NOT NULL,
        modo          varchar(8)    NOT NULL,
        creado_en     datetime2(0)  NOT NULL CONSTRAINT df_correo_aviso_creado DEFAULT (SYSDATETIME()),
        enviar_desde  datetime2(0)  NOT NULL,
        lote_id       bigint        NULL,      -- NULL: todavía en la cola
        intentos      tinyint       NOT NULL CONSTRAINT df_correo_aviso_intentos DEFAULT (0),
        CONSTRAINT pk_correo_aviso PRIMARY KEY (id),
        CONSTRAINT uq_correo_aviso UNIQUE (usuario_id, actividad_id),
        CONSTRAINT ck_correo_aviso_modo CHECK (modo IN ('MOMENTO', 'RESUMEN'))
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_correo_aviso_cola' AND object_id = OBJECT_ID('dmc.correo_aviso'))
    CREATE INDEX ix_correo_aviso_cola ON dmc.correo_aviso (enviar_desde) INCLUDE (usuario_id, modo) WHERE lote_id IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_correo_aviso_lote' AND object_id = OBJECT_ID('dmc.correo_aviso'))
    CREATE INDEX ix_correo_aviso_lote ON dmc.correo_aviso (lote_id) WHERE lote_id IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 43)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (43, N'Avisos por correo: preferencias por canal y cola de envío');
GO

PRINT 'Migración 043 aplicada.';
GO
