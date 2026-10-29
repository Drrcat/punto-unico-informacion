-- =====================================================================
-- Migración inicial de OrientaSede: 32 tablas y 4 tipos enumerados.
-- Equivale a database/prisma/schema.prisma y es la misma que
-- database/sql/esquema_orientasede.sql (script de referencia).
-- Se aplica con: npx prisma migrate deploy
-- =====================================================================

BEGIN;

-- Tipos enumerados
CREATE TYPE "EstadoAutenticacion" AS ENUM ('PENDIENTE', 'VERIFICADA', 'EXPIRADA', 'RECHAZADA');
CREATE TYPE "EstadoEnrolamiento" AS ENUM ('INICIADO', 'FOTO_PENDIENTE', 'COMPLETADO', 'FALLIDO', 'CANCELADO');
CREATE TYPE "TipoConsulta" AS ENUM ('SALA', 'DIRECTORIO', 'FAQ', 'TRAMITE');
CREATE TYPE "ServicioExterno" AS ENUM ('GOOGLE_VISION', 'CORREO', 'ENROLAMIENTO');

CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "clave_hash" VARCHAR(100),
    "intentos_fallidos" SMALLINT NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT TRUE,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rol" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(255),
    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permiso" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(255),
    CONSTRAINT "permiso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rol_permiso" (
    "rol_id" INTEGER NOT NULL,
    "permiso_id" INTEGER NOT NULL,
    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("rol_id", "permiso_id")
);

CREATE TABLE "usuario_rol" (
    "usuario_id" INTEGER NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "asignado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("usuario_id", "rol_id")
);

CREATE TABLE "sesion_admin" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "revocada_en" TIMESTAMP(3),
    CONSTRAINT "sesion_admin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "escuela" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    CONSTRAINT "escuela_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "carrera" (
    "id" SERIAL NOT NULL,
    "escuela_id" INTEGER NOT NULL,
    "area_id" INTEGER,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "carrera_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "estudiante" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "carrera_id" INTEGER NOT NULL,
    "anio_ingreso" SMALLINT NOT NULL,
    CONSTRAINT "estudiante_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sede" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "direccion" VARCHAR(200),
    CONSTRAINT "sede_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "edificio" (
    "id" SERIAL NOT NULL,
    "sede_id" INTEGER NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    CONSTRAINT "edificio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "piso" (
    "id" SERIAL NOT NULL,
    "edificio_id" INTEGER NOT NULL,
    "numero" SMALLINT NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "plano_svg_ruta" VARCHAR(255),
    CONSTRAINT "piso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tipo_espacio" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "es_buscable" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "tipo_espacio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "espacio" (
    "id" SERIAL NOT NULL,
    "piso_id" INTEGER NOT NULL,
    "tipo_espacio_id" INTEGER NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(120),
    "svg_element_id" VARCHAR(80),
    "capacidad" SMALLINT,
    "activo" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "espacio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "espacio_alias" (
    "id" SERIAL NOT NULL,
    "espacio_id" INTEGER NOT NULL,
    "alias" VARCHAR(120) NOT NULL,
    CONSTRAINT "espacio_alias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipamiento" (
    "id" SERIAL NOT NULL,
    "espacio_id" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "cantidad" SMALLINT NOT NULL DEFAULT 1,
    "observacion" VARCHAR(200),
    CONSTRAINT "equipamiento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "area_institucional" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" VARCHAR(300),
    "espacio_id" INTEGER,
    "horario_atencion" VARCHAR(200),
    "correo_contacto" VARCHAR(150),
    "anexo" VARCHAR(20),
    CONSTRAINT "area_institucional_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tramite" (
    "id" SERIAL NOT NULL,
    "area_id" INTEGER NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "plazo_dias" SMALLINT,
    "activo" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "tramite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tramite_paso" (
    "id" SERIAL NOT NULL,
    "tramite_id" INTEGER NOT NULL,
    "orden" SMALLINT NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "descripcion" TEXT NOT NULL,
    CONSTRAINT "tramite_paso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tramite_requisito" (
    "id" SERIAL NOT NULL,
    "tramite_id" INTEGER NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "tramite_requisito_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "categoria_faq" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "orden" SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT "categoria_faq_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pregunta_frecuente" (
    "id" SERIAL NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "area_id" INTEGER,
    "pregunta" VARCHAR(300) NOT NULL,
    "respuesta" TEXT NOT NULL,
    "publicada" BOOLEAN NOT NULL DEFAULT FALSE,
    "creado_por_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pregunta_frecuente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "intento_autenticacion" (
    "id" SERIAL NOT NULL,
    "correo_ingresado" VARCHAR(150) NOT NULL,
    "codigo_hash" VARCHAR(128) NOT NULL,
    "intentos_fallidos" SMALLINT NOT NULL DEFAULT 0,
    "usuario_id" INTEGER,
    "totem_id" INTEGER NOT NULL,
    "estado" "EstadoAutenticacion" NOT NULL DEFAULT 'PENDIENTE',
    "solicitado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "resuelto_en" TIMESTAMP(3),
    CONSTRAINT "intento_autenticacion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enrolamiento" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "intento_autenticacion_id" INTEGER NOT NULL,
    "totem_id" INTEGER NOT NULL,
    "estado" "EstadoEnrolamiento" NOT NULL DEFAULT 'INICIADO',
    "iniciado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completado_en" TIMESTAMP(3),
    CONSTRAINT "enrolamiento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "captura_facial" (
    "id" SERIAL NOT NULL,
    "enrolamiento_id" INTEGER NOT NULL,
    "ruta_imagen" VARCHAR(255),
    "rostro_valido" BOOLEAN NOT NULL,
    "confianza" DECIMAL(4,3),
    "motivo_rechazo" VARCHAR(100),
    "capturada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminada_en" TIMESTAMP(3),
    CONSTRAINT "captura_facial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "totem" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "sede_id" INTEGER NOT NULL,
    "espacio_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT TRUE,
    "ultimo_latido_en" TIMESTAMP(3),
    CONSTRAINT "totem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aviso" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "contenido" TEXT NOT NULL,
    "vigente_desde" TIMESTAMP(3) NOT NULL,
    "vigente_hasta" TIMESTAMP(3),
    "prioridad" SMALLINT NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT TRUE,
    "creado_por_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "aviso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aviso_totem" (
    "aviso_id" INTEGER NOT NULL,
    "totem_id" INTEGER NOT NULL,
    CONSTRAINT "aviso_totem_pkey" PRIMARY KEY ("aviso_id", "totem_id")
);

CREATE TABLE "configuracion_sistema" (
    "clave" VARCHAR(80) NOT NULL,
    "valor" VARCHAR(255) NOT NULL,
    "descripcion" VARCHAR(255),
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "configuracion_sistema_pkey" PRIMARY KEY ("clave")
);

CREATE TABLE "registro_auditoria" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" INTEGER,
    "accion" VARCHAR(60) NOT NULL,
    "entidad" VARCHAR(60) NOT NULL,
    "entidad_id" VARCHAR(40),
    "detalle" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registro_auditoria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "registro_consulta" (
    "id" BIGSERIAL NOT NULL,
    "totem_id" INTEGER NOT NULL,
    "tipo" "TipoConsulta" NOT NULL,
    "termino" VARCHAR(200),
    "hubo_resultado" BOOLEAN NOT NULL,
    "espacio_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registro_consulta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "registro_error" (
    "id" BIGSERIAL NOT NULL,
    "servicio" "ServicioExterno" NOT NULL,
    "operacion" VARCHAR(60) NOT NULL,
    "codigo_http" SMALLINT,
    "mensaje" VARCHAR(300) NOT NULL,
    "totem_id" INTEGER,
    "enrolamiento_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registro_error_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario" ("correo");
CREATE UNIQUE INDEX "rol_nombre_key" ON "rol" ("nombre");
CREATE UNIQUE INDEX "permiso_codigo_key" ON "permiso" ("codigo");
CREATE UNIQUE INDEX "sesion_admin_token_hash_key" ON "sesion_admin" ("token_hash");
CREATE INDEX "sesion_admin_usuario_id_idx" ON "sesion_admin" ("usuario_id");
CREATE UNIQUE INDEX "escuela_nombre_key" ON "escuela" ("nombre");
CREATE UNIQUE INDEX "carrera_codigo_key" ON "carrera" ("codigo");
CREATE INDEX "carrera_escuela_id_idx" ON "carrera" ("escuela_id");
CREATE INDEX "carrera_area_id_idx" ON "carrera" ("area_id");
CREATE UNIQUE INDEX "estudiante_usuario_id_key" ON "estudiante" ("usuario_id");
CREATE INDEX "estudiante_carrera_id_idx" ON "estudiante" ("carrera_id");
CREATE UNIQUE INDEX "sede_nombre_key" ON "sede" ("nombre");
CREATE UNIQUE INDEX "edificio_sede_id_nombre_key" ON "edificio" ("sede_id", "nombre");
CREATE UNIQUE INDEX "piso_edificio_id_numero_key" ON "piso" ("edificio_id", "numero");
CREATE UNIQUE INDEX "tipo_espacio_nombre_key" ON "tipo_espacio" ("nombre");
CREATE UNIQUE INDEX "espacio_piso_id_codigo_key" ON "espacio" ("piso_id", "codigo");
CREATE INDEX "espacio_codigo_idx" ON "espacio" ("codigo");
CREATE INDEX "espacio_tipo_espacio_id_idx" ON "espacio" ("tipo_espacio_id");
CREATE UNIQUE INDEX "espacio_alias_espacio_id_alias_key" ON "espacio_alias" ("espacio_id", "alias");
CREATE INDEX "espacio_alias_alias_idx" ON "espacio_alias" ("alias");
CREATE UNIQUE INDEX "equipamiento_espacio_id_nombre_key" ON "equipamiento" ("espacio_id", "nombre");
CREATE UNIQUE INDEX "area_institucional_nombre_key" ON "area_institucional" ("nombre");
CREATE INDEX "tramite_area_id_idx" ON "tramite" ("area_id");
CREATE UNIQUE INDEX "tramite_paso_tramite_id_orden_key" ON "tramite_paso" ("tramite_id", "orden");
CREATE INDEX "tramite_requisito_tramite_id_idx" ON "tramite_requisito" ("tramite_id");
CREATE UNIQUE INDEX "categoria_faq_nombre_key" ON "categoria_faq" ("nombre");
CREATE INDEX "pregunta_frecuente_categoria_id_idx" ON "pregunta_frecuente" ("categoria_id");
CREATE INDEX "pregunta_frecuente_area_id_idx" ON "pregunta_frecuente" ("area_id");
CREATE INDEX "intento_autenticacion_usuario_id_idx" ON "intento_autenticacion" ("usuario_id");
CREATE INDEX "intento_autenticacion_totem_id_idx" ON "intento_autenticacion" ("totem_id");
CREATE UNIQUE INDEX "enrolamiento_intento_autenticacion_id_key" ON "enrolamiento" ("intento_autenticacion_id");
CREATE INDEX "enrolamiento_usuario_id_idx" ON "enrolamiento" ("usuario_id");
CREATE INDEX "enrolamiento_totem_id_idx" ON "enrolamiento" ("totem_id");
CREATE INDEX "captura_facial_enrolamiento_id_idx" ON "captura_facial" ("enrolamiento_id");
CREATE UNIQUE INDEX "totem_nombre_key" ON "totem" ("nombre");
CREATE INDEX "totem_sede_id_idx" ON "totem" ("sede_id");
CREATE INDEX "registro_auditoria_usuario_id_idx" ON "registro_auditoria" ("usuario_id");
CREATE INDEX "registro_auditoria_entidad_entidad_id_idx" ON "registro_auditoria" ("entidad", "entidad_id");
CREATE INDEX "registro_consulta_totem_id_creado_en_idx" ON "registro_consulta" ("totem_id", "creado_en");
CREATE INDEX "registro_consulta_tipo_idx" ON "registro_consulta" ("tipo");
CREATE INDEX "registro_error_servicio_creado_en_idx" ON "registro_error" ("servicio", "creado_en");

-- Claves foráneas
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permiso" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sesion_admin" ADD CONSTRAINT "sesion_admin_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carrera" ADD CONSTRAINT "carrera_escuela_id_fkey" FOREIGN KEY ("escuela_id") REFERENCES "escuela" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "carrera" ADD CONSTRAINT "carrera_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area_institucional" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "estudiante" ADD CONSTRAINT "estudiante_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "estudiante" ADD CONSTRAINT "estudiante_carrera_id_fkey" FOREIGN KEY ("carrera_id") REFERENCES "carrera" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "edificio" ADD CONSTRAINT "edificio_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sede" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "piso" ADD CONSTRAINT "piso_edificio_id_fkey" FOREIGN KEY ("edificio_id") REFERENCES "edificio" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "espacio" ADD CONSTRAINT "espacio_piso_id_fkey" FOREIGN KEY ("piso_id") REFERENCES "piso" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "espacio" ADD CONSTRAINT "espacio_tipo_espacio_id_fkey" FOREIGN KEY ("tipo_espacio_id") REFERENCES "tipo_espacio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "espacio_alias" ADD CONSTRAINT "espacio_alias_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "espacio" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipamiento" ADD CONSTRAINT "equipamiento_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "espacio" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "area_institucional" ADD CONSTRAINT "area_institucional_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "espacio" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tramite" ADD CONSTRAINT "tramite_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area_institucional" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tramite_paso" ADD CONSTRAINT "tramite_paso_tramite_id_fkey" FOREIGN KEY ("tramite_id") REFERENCES "tramite" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tramite_requisito" ADD CONSTRAINT "tramite_requisito_tramite_id_fkey" FOREIGN KEY ("tramite_id") REFERENCES "tramite" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pregunta_frecuente" ADD CONSTRAINT "pregunta_frecuente_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria_faq" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pregunta_frecuente" ADD CONSTRAINT "pregunta_frecuente_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area_institucional" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pregunta_frecuente" ADD CONSTRAINT "pregunta_frecuente_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "intento_autenticacion" ADD CONSTRAINT "intento_autenticacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "intento_autenticacion" ADD CONSTRAINT "intento_autenticacion_totem_id_fkey" FOREIGN KEY ("totem_id") REFERENCES "totem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrolamiento" ADD CONSTRAINT "enrolamiento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrolamiento" ADD CONSTRAINT "enrolamiento_intento_autenticacion_id_fkey" FOREIGN KEY ("intento_autenticacion_id") REFERENCES "intento_autenticacion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrolamiento" ADD CONSTRAINT "enrolamiento_totem_id_fkey" FOREIGN KEY ("totem_id") REFERENCES "totem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "captura_facial" ADD CONSTRAINT "captura_facial_enrolamiento_id_fkey" FOREIGN KEY ("enrolamiento_id") REFERENCES "enrolamiento" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "totem" ADD CONSTRAINT "totem_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sede" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "totem" ADD CONSTRAINT "totem_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "espacio" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "aviso" ADD CONSTRAINT "aviso_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aviso_totem" ADD CONSTRAINT "aviso_totem_aviso_id_fkey" FOREIGN KEY ("aviso_id") REFERENCES "aviso" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "aviso_totem" ADD CONSTRAINT "aviso_totem_totem_id_fkey" FOREIGN KEY ("totem_id") REFERENCES "totem" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registro_auditoria" ADD CONSTRAINT "registro_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registro_consulta" ADD CONSTRAINT "registro_consulta_totem_id_fkey" FOREIGN KEY ("totem_id") REFERENCES "totem" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registro_consulta" ADD CONSTRAINT "registro_consulta_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "espacio" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registro_error" ADD CONSTRAINT "registro_error_totem_id_fkey" FOREIGN KEY ("totem_id") REFERENCES "totem" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registro_error" ADD CONSTRAINT "registro_error_enrolamiento_id_fkey" FOREIGN KEY ("enrolamiento_id") REFERENCES "enrolamiento" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Descripciones de tablas y columnas
COMMENT ON TABLE "usuario" IS 'Persona con correo institucional (estudiante, docente o funcionario). Solo los administradores tienen contraseña.';
COMMENT ON COLUMN "usuario"."correo" IS 'Correo institucional. Su dominio debe estar entre los aceptados por la institución.';
COMMENT ON COLUMN "usuario"."clave_hash" IS 'Hash bcrypt de la contraseña. Nulo para quienes no administran el sistema.';
COMMENT ON COLUMN "usuario"."intentos_fallidos" IS 'Intentos fallidos consecutivos de inicio de sesión; vuelve a 0 al ingresar.';
COMMENT ON COLUMN "usuario"."bloqueado_hasta" IS 'Hasta cuándo permanece bloqueado el inicio de sesión tras demasiados intentos fallidos.';
COMMENT ON TABLE "rol" IS 'Perfil funcional del sistema (p. ej. Administrador, Editor, Solo lectura).';
COMMENT ON TABLE "permiso" IS 'Acción concreta que puede autorizarse (p. ej. sala.editar, faq.publicar).';
COMMENT ON TABLE "rol_permiso" IS 'Relación N:M entre roles y permisos.';
COMMENT ON TABLE "usuario_rol" IS 'Relación N:M entre usuarios y roles.';
COMMENT ON TABLE "sesion_admin" IS 'Sesión iniciada en la aplicación de escritorio administrativa (se puede revocar).';
COMMENT ON COLUMN "sesion_admin"."token_hash" IS 'Hash del token de sesión (nunca el token en claro).';
COMMENT ON TABLE "escuela" IS 'Escuela o unidad académica que agrupa carreras.';
COMMENT ON TABLE "carrera" IS 'Carrera o programa que se imparte en la institución.';
COMMENT ON COLUMN "carrera"."area_id" IS 'Área institucional que atiende a los estudiantes de la carrera (nula si aún no se asigna).';
COMMENT ON TABLE "estudiante" IS 'Datos académicos de un usuario que es estudiante (extensión 1:1 de usuario).';
COMMENT ON TABLE "sede" IS 'Sede o campus.';
COMMENT ON TABLE "edificio" IS 'Edificio o torre dentro de la sede.';
COMMENT ON TABLE "piso" IS 'Piso de un edificio, con referencia a su plano SVG.';
COMMENT ON COLUMN "piso"."plano_svg_ruta" IS 'Ruta del plano SVG exportado desde Figma.';
COMMENT ON TABLE "tipo_espacio" IS 'Catálogo de tipos de espacio (sala, baño, escalera, ascensor, terraza, oficina, etc.).';
COMMENT ON COLUMN "tipo_espacio"."es_buscable" IS 'Indica si el tipo puede ser resultado de una búsqueda del estudiante.';
COMMENT ON TABLE "espacio" IS 'Espacio físico del plano (sala, oficina, baño, etc.). Se vincula al elemento del SVG.';
COMMENT ON COLUMN "espacio"."codigo" IS 'Código visible de la sala (p. ej. el que busca el estudiante).';
COMMENT ON COLUMN "espacio"."svg_element_id" IS 'Id del elemento dentro del SVG del piso, para resaltar la sala en el mapa.';
COMMENT ON TABLE "espacio_alias" IS 'Nombres alternativos de un espacio, para que la búsqueda lo encuentre (p. ej. "pañol").';
COMMENT ON TABLE "equipamiento" IS 'Equipamiento disponible en un espacio (proyector, computadores, pizarra, etc.).';
COMMENT ON TABLE "area_institucional" IS 'Área institucional de atención (financiamiento, informática, asuntos estudiantiles, etc.). El directorio del tótem se organiza por áreas, no por personas.';
COMMENT ON COLUMN "area_institucional"."correo_contacto" IS 'Correo de contacto del área (casilla compartida, no personal).';
COMMENT ON COLUMN "area_institucional"."anexo" IS 'Anexo telefónico del área.';
COMMENT ON TABLE "tramite" IS 'Trámite administrativo que el estudiante puede consultar.';
COMMENT ON COLUMN "tramite"."plazo_dias" IS 'Plazo de resolución en días hábiles, si corresponde.';
COMMENT ON TABLE "tramite_paso" IS 'Paso ordenado de la guía de un trámite.';
COMMENT ON TABLE "tramite_requisito" IS 'Documento o requisito que el estudiante debe presentar en un trámite.';
COMMENT ON TABLE "categoria_faq" IS 'Categoría temática de las preguntas frecuentes.';
COMMENT ON TABLE "pregunta_frecuente" IS 'Pregunta frecuente y su respuesta, gestionada desde la app de escritorio.';
COMMENT ON COLUMN "pregunta_frecuente"."area_id" IS 'Área institucional que responde o resuelve la consulta (nula si es general).';
COMMENT ON TABLE "intento_autenticacion" IS 'Verificación de identidad por código de un solo uso enviado al correo institucional.';
COMMENT ON COLUMN "intento_autenticacion"."correo_ingresado" IS 'Correo que la persona escribió en el tótem.';
COMMENT ON COLUMN "intento_autenticacion"."codigo_hash" IS 'Hash del código de 6 dígitos enviado (nunca el código en claro).';
COMMENT ON COLUMN "intento_autenticacion"."intentos_fallidos" IS 'Códigos incorrectos ingresados; al superar el máximo configurado el intento queda RECHAZADA.';
COMMENT ON COLUMN "intento_autenticacion"."usuario_id" IS 'Usuario resuelto a partir del correo, si pertenece a un dominio aceptado.';
COMMENT ON TABLE "enrolamiento" IS 'Proceso de enrolamiento fotográfico de un usuario (estudiante, docente o funcionario). Módulo opcional.';
COMMENT ON COLUMN "enrolamiento"."intento_autenticacion_id" IS 'Verificación por código que habilitó este enrolamiento (1:1).';
COMMENT ON TABLE "captura_facial" IS 'Resultado de la validación de la fotografía con Google Vision AI. La imagen es un dato biométrico y se elimina; solo permanece el resultado.';
COMMENT ON COLUMN "captura_facial"."ruta_imagen" IS 'Ubicación temporal de la imagen. Nula una vez eliminada (de inmediato, o como máximo a las 24 horas si falló la carga).';
COMMENT ON COLUMN "captura_facial"."confianza" IS 'Confianza de detección entregada por Vision AI (0 a 1).';
COMMENT ON COLUMN "captura_facial"."motivo_rechazo" IS 'Motivo cuando la foto se rechaza (sin rostro, varios rostros, baja calidad).';
COMMENT ON COLUMN "captura_facial"."eliminada_en" IS 'Fecha y hora en que se eliminó la imagen.';
COMMENT ON TABLE "totem" IS 'Tótem físico instalado en la sede.';
COMMENT ON COLUMN "totem"."espacio_id" IS 'Espacio donde está instalado, para mostrar "usted está aquí" en el mapa.';
COMMENT ON TABLE "aviso" IS 'Aviso institucional publicado desde el panel administrativo.';
COMMENT ON TABLE "aviso_totem" IS 'Tótems en los que se muestra cada aviso (N:M).';
COMMENT ON TABLE "configuracion_sistema" IS 'Parámetros de la instalación: identidad de la institución (nombre, logo, colores, dominios de correo), módulo de enrolamiento y tiempos de operación.';
COMMENT ON TABLE "registro_auditoria" IS 'Bitácora de acciones realizadas en el panel administrativo.';
COMMENT ON TABLE "registro_consulta" IS 'Consultas hechas en el tótem; permite medir uso y detectar búsquedas sin resultado.';
COMMENT ON COLUMN "registro_consulta"."espacio_id" IS 'Espacio encontrado, cuando la consulta es de tipo SALA.';
COMMENT ON TABLE "registro_error" IS 'Fallas de los servicios externos (Google Vision AI, correo, sistema de enrolamiento); permite investigar incidentes sin bloquear el resto del tótem.';
COMMENT ON COLUMN "registro_error"."operacion" IS 'Operación que falló (p. ej. enviar_codigo, validar_foto, enviar_enrolamiento).';
COMMENT ON COLUMN "registro_error"."codigo_http" IS 'Código de estado HTTP devuelto por el servicio, si lo hubo.';

COMMIT;
