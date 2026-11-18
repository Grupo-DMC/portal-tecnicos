/* =====================================================================
   DMC Contingencia · migración 042 — secciones obligatorias del acta
   Microsoft SQL Server 2022 · esquema dmc

   El acta del técnico tiene seis secciones. Tres ya eran obligatorias por
   fuerza (responsable, motivo y trabajo, firma); las otras tres (problemas
   detectados, comentario interno, fotos y video del trabajo) eran opcionales y
   había técnicos que llenaban una sola y dejaban las demás vacías.

   Qué agrega:

     1. dmc.acta_seccion_config ......... una fila por sección configurable del
                                          acta, con su marca «obligatoria». El
                                          panel (Checklist) la cambia; el celular
                                          y el servidor la leen al cerrar el
                                          acta.
     2. Valores iniciales ............... fotos = obligatoria (al menos una foto
                                          y un video del trabajo); problemas e
                                          interno = no obligatorias, como hasta
                                          hoy.

   No toca ninguna acta ni visita existente: la regla se aplica al cerrar un
   acta nueva, no a las ya cerradas ni a su corrección.

   Requisito: tener aplicada la migración 041.
   Es idempotente: se puede correr varias veces sin romper nada.
   Para deshacerla: sql/migracion-042-revertir.sql

   Uso:  sqlcmd -S servidor -d DMC_Contingencia -i sql/migracion-042-secciones-obligatorias-del-acta.sql
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

USE DMC_Contingencia;
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 41)
    THROW 50042, 'Falta aplicar la migración 041 antes que esta.', 1;
GO

-- ── 1. La tabla ─────────────────────────────────────────────────────────────
IF OBJECT_ID('dmc.acta_seccion_config', 'U') IS NULL
BEGIN
    CREATE TABLE dmc.acta_seccion_config (
        clave           varchar(12)   NOT NULL,     -- problemas | interno | fotos
        obligatoria     bit           NOT NULL CONSTRAINT df_acta_seccion_obligatoria DEFAULT (0),
        actualizado_en  datetime2(0)  NOT NULL CONSTRAINT df_acta_seccion_actualizado DEFAULT (SYSDATETIME()),
        actualizado_por bigint        NULL,
        CONSTRAINT pk_acta_seccion_config PRIMARY KEY (clave),
        CONSTRAINT ck_acta_seccion_clave CHECK (clave IN ('problemas', 'interno', 'fotos')),
        CONSTRAINT fk_acta_seccion_usuario FOREIGN KEY (actualizado_por) REFERENCES dmc.usuario (id)
    );
END
GO

-- ── 2. Valores iniciales: solo las filas que faltan, nunca pisa lo cambiado ─
INSERT INTO dmc.acta_seccion_config (clave, obligatoria)
SELECT v.clave, v.obligatoria
  FROM (VALUES ('problemas', 0), ('interno', 0), ('fotos', 1)) AS v (clave, obligatoria)
 WHERE NOT EXISTS (SELECT 1 FROM dmc.acta_seccion_config c WHERE c.clave = v.clave);
GO

IF NOT EXISTS (SELECT 1 FROM dmc.schema_version WHERE version = 42)
    INSERT INTO dmc.schema_version (version, descripcion)
    VALUES (42, N'Secciones obligatorias del acta del técnico');
GO

PRINT 'Migración 042 aplicada.';
GO
