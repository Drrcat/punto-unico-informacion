import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { EstadoEnrolamiento, Prisma } from '@prisma/client';
import { claveCodigos } from '../../common/auth/tokens';
import { TokenEnrolamientoService } from '../../common/auth/token-enrolamiento.service';
import { ConfiguracionService } from '../../common/configuracion/configuracion.service';
import { conflicto, ErrorNegocio, invalido, noDisponible, noEncontrado, prohibido } from '../../common/filtros/errores';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ErrorExternoService } from '../../common/registro/error-externo.service';
import { detectarTipo, dimensiones } from '../../common/util/fotos';
import { ENTORNO, Entorno } from '../../config/entorno';
import { ConectorEnrolamiento } from '../../integraciones/conector/conector-enrolamiento';
import { ConectoresService } from '../../integraciones/conector/conectores.service';
import { CorreoProvider } from '../../integraciones/correo/correo.provider';
import { ErrorServicioExterno } from '../../integraciones/errores';
import { ValidadorRostros } from '../../integraciones/vision/validador-rostros';
import { codigoCorrecto, enmascararCorreo, generarCodigo, hashCodigo } from './codigo';
import { EstadoSolicitud, ListarSolicitudesDto } from './enrolamiento.dto';
import { exigirTransicion, origenesPosibles } from './estados';
import { FotosStore } from './fotos.store';
import { evaluarRostro } from './rostro';
import { RetencionService } from './retencion.service';
import { nombresDesdeCorreo } from './usuarios.util';

const MOTIVO_ERROR_VISION = 'ERROR_VISION';

@Injectable()
export class EnrolamientoService {
  private readonly log = new Logger('Enrolamiento');
  /** Solicitudes cuya fotografía se está procesando ahora; evita enviar dos veces la misma. */
  private readonly enProceso = new Set<number>();
  private readonly claveCodigos: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracionService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
    private readonly correo: CorreoProvider,
    private readonly vision: ValidadorRostros,
    private readonly conectores: ConectoresService,
    private readonly tokens: TokenEnrolamientoService,
    private readonly fotos: FotosStore,
    private readonly retencion: RetencionService,
    private readonly errores: ErrorExternoService,
  ) {
    this.claveCodigos = claveCodigos(entorno.jwtSecret);
  }

  // ------------------------------------------------------------------ estado del módulo

  /** Lo que el tótem necesita saber antes de ofrecer el enrolamiento. */
  async estadoModulo() {
    if (!(await this.config.booleano('modulo_enrolamiento_activo'))) return { activo: false };
    return {
      activo: true,
      dominiosAceptados: await this.config.lista('dominios_correo'),
      codigoVigenciaMin: await this.config.entero('codigo_vigencia_min'),
      codigoMaxIntentos: await this.config.entero('codigo_max_intentos'),
      fotoMaxIntentos: await this.config.entero('foto_max_intentos'),
    };
  }

  private async exigirModuloActivo(): Promise<void> {
    if (!(await this.config.booleano('modulo_enrolamiento_activo'))) {
      throw prohibido('MODULO_INACTIVO', 'El enrolamiento fotográfico no está habilitado en esta sede.');
    }
  }

  // ------------------------------------------------------------------ 1. verificar el correo

  /** Envía un código de un solo uso al correo institucional. */
  async iniciarVerificacion(correoCrudo: string) {
    await this.exigirModuloActivo();
    const correo = correoCrudo.trim().toLowerCase();
    const dominio = correo.split('@')[1] ?? '';
    const dominios = await this.config.lista('dominios_correo');
    if (!dominios.includes(dominio)) {
      throw invalido('DOMINIO_NO_PERMITIDO', `Ese correo no pertenece a un dominio aceptado. Usa un correo ${dominios.map((d) => `@${d}`).join(' o ')}.`, { dominiosAceptados: dominios });
    }

    // Tope de códigos por correo en una ventana de tiempo: evita usar el tótem para llenar una casilla de correos.
    const ventanaMin = await this.config.entero('codigo_ventana_min');
    const maxSolicitudes = await this.config.entero('codigo_max_solicitudes');
    const desde = new Date(Date.now() - ventanaMin * 60_000);
    const recientes = await this.prisma.intento_autenticacion.findMany({ where: { correo_ingresado: correo, solicitado_en: { gte: desde } }, orderBy: { solicitado_en: 'asc' }, select: { solicitado_en: true } });
    if (recientes.length >= maxSolicitudes) {
      const libre = recientes[recientes.length - maxSolicitudes].solicitado_en.getTime() + ventanaMin * 60_000;
      throw new ErrorNegocio(HttpStatus.TOO_MANY_REQUESTS, 'DEMASIADAS_SOLICITUDES', 'Ya se enviaron varios códigos a ese correo. Espera unos minutos antes de pedir otro.', {
        reintentarEnSeg: Math.max(1, Math.ceil((libre - Date.now()) / 1000)),
      });
    }

    const vigenciaMin = await this.config.entero('codigo_vigencia_min');
    const codigo = generarCodigo();
    const expiraEn = new Date(Date.now() + vigenciaMin * 60_000);
    const intento = await this.prisma.$transaction(async (tx) => {
      // Un código nuevo anula los anteriores que siguieran pendientes.
      await tx.intento_autenticacion.updateMany({ where: { correo_ingresado: correo, estado: 'PENDIENTE' }, data: { estado: 'EXPIRADA', resuelto_en: new Date() } });
      return tx.intento_autenticacion.create({
        data: { correo_ingresado: correo, codigo_hash: hashCodigo(this.claveCodigos, correo, codigo), totem_id: this.entorno.totemId, expira_en: expiraEn },
      });
    });

    try {
      await this.correo.enviarCodigo({ para: correo, codigo, vigenciaMin, institucion: await this.config.texto('institucion_nombre') });
    } catch (e) {
      const err = e as ErrorServicioExterno;
      await this.errores.registrar({ servicio: 'CORREO', operacion: 'enviar_codigo', mensaje: err.message, codigoHttp: err.codigoHttp });
      // El código nunca llegó a la persona: se descarta el intento para no gastar su cupo de solicitudes.
      await this.prisma.intento_autenticacion.delete({ where: { id: intento.id } }).catch(() => undefined);
      throw noDisponible('CORREO_NO_DISPONIBLE', 'No pudimos enviar el código a tu correo en este momento. Intenta de nuevo en unos minutos.');
    }

    return {
      intentoId: intento.id,
      correo: enmascararCorreo(correo),
      expiraEn: expiraEn.toISOString(),
      vigenciaMin,
      intentosMax: await this.config.entero('codigo_max_intentos'),
    };
  }

  /** Valida el código. Si es correcto crea la solicitud de enrolamiento y entrega el token para enviar la foto. */
  async validarCodigo(intentoId: number, codigo: string) {
    await this.exigirModuloActivo();
    const intento = await this.prisma.intento_autenticacion.findUnique({ where: { id: intentoId } });
    if (!intento) throw noEncontrado('VERIFICACION_NO_ENCONTRADA', 'No existe esa verificación. Pide un código nuevo.');

    if (intento.estado === 'VERIFICADA') throw conflicto('CODIGO_YA_USADO', 'Ese código ya fue usado.');
    if (intento.estado === 'RECHAZADA') throw this.agotado();
    if (intento.estado === 'EXPIRADA' || intento.expira_en <= new Date()) {
      await this.prisma.intento_autenticacion.updateMany({ where: { id: intentoId, estado: 'PENDIENTE' }, data: { estado: 'EXPIRADA', resuelto_en: new Date() } });
      throw new ErrorNegocio(HttpStatus.GONE, 'CODIGO_EXPIRADO', 'El código venció. Pide uno nuevo.');
    }

    const max = await this.config.entero('codigo_max_intentos');
    if (!codigoCorrecto(this.claveCodigos, intento.correo_ingresado, codigo, intento.codigo_hash)) {
      // El contador se suma de forma atómica y solo mientras queden intentos: varias pruebas simultáneas no lo evitan.
      const sumado = await this.prisma.intento_autenticacion.updateMany({
        where: { id: intentoId, estado: 'PENDIENTE', intentos_fallidos: { lt: max } },
        data: { intentos_fallidos: { increment: 1 } },
      });
      const actual = await this.prisma.intento_autenticacion.findUniqueOrThrow({ where: { id: intentoId } });
      if (sumado.count === 0 || actual.intentos_fallidos >= max) {
        await this.prisma.intento_autenticacion.updateMany({ where: { id: intentoId, estado: 'PENDIENTE' }, data: { estado: 'RECHAZADA', resuelto_en: new Date() } });
        throw this.agotado();
      }
      throw new ErrorNegocio(HttpStatus.UNAUTHORIZED, 'CODIGO_INCORRECTO', 'El código no es correcto.', { intentosRestantes: max - actual.intentos_fallidos });
    }

    const vigenciaMin = await this.config.entero('enrolamiento_vigencia_min');
    const { enrolamiento, usuario, copiasACancelar } = await this.prisma.$transaction(async (tx) => {
      // La marca de "verificada" se hace con una condición: si dos solicitudes usan el mismo código, solo una lo consigue.
      const marcado = await tx.intento_autenticacion.updateMany({
        where: { id: intentoId, estado: 'PENDIENTE', expira_en: { gt: new Date() }, intentos_fallidos: { lt: max } },
        data: { estado: 'VERIFICADA', resuelto_en: new Date() },
      });
      if (marcado.count === 0) throw conflicto('CODIGO_YA_USADO', 'Ese código ya no está disponible. Pide uno nuevo.');

      const usuario = await tx.usuario.upsert({
        where: { correo: intento.correo_ingresado },
        update: {},
        create: { correo: intento.correo_ingresado, ...nombresDesdeCorreo(intento.correo_ingresado) },
      });
      if (!usuario.activo) throw prohibido('USUARIO_INACTIVO', 'Tu usuario está deshabilitado. Acércate a la oficina de atención.');
      await tx.intento_autenticacion.update({ where: { id: intentoId }, data: { usuario_id: usuario.id } });

      // Una persona tiene a lo más una solicitud en curso: las anteriores sin terminar se cancelan.
      const previas = await tx.enrolamiento.findMany({ where: { usuario_id: usuario.id, estado: { in: ['INICIADO', 'FOTO_PENDIENTE', 'FALLIDO'] } }, select: { id: true, estado: true } });
      for (const p of previas) exigirTransicion(p.estado, 'CANCELADO');
      if (previas.length) await tx.enrolamiento.updateMany({ where: { id: { in: previas.map((p) => p.id) } }, data: { estado: 'CANCELADO' } });

      const creado = await tx.enrolamiento.create({ data: { usuario_id: usuario.id, intento_autenticacion_id: intentoId, totem_id: this.entorno.totemId } });
      exigirTransicion(creado.estado, 'FOTO_PENDIENTE');
      const enrolamiento = await tx.enrolamiento.update({ where: { id: creado.id }, data: { estado: 'FOTO_PENDIENTE' } });
      return { enrolamiento, usuario, copiasACancelar: previas.map((p) => p.id) };
    });
    await this.retencion.eliminarCopiasDe(copiasACancelar);

    return {
      enrolamientoId: enrolamiento.id,
      estado: enrolamiento.estado,
      token: await this.tokens.emitir(enrolamiento.id, vigenciaMin),
      vigenciaMin,
      usuario: { correo: usuario.correo, nombres: usuario.nombres, apellidos: usuario.apellidos },
      fotoMaxIntentos: await this.config.entero('foto_max_intentos'),
    };
  }

  private agotado(): ErrorNegocio {
    return new ErrorNegocio(HttpStatus.TOO_MANY_REQUESTS, 'INTENTOS_AGOTADOS', 'Se agotaron los intentos con este código. Pide uno nuevo.');
  }

  // ------------------------------------------------------------------ 2. fotografía

  /**
   * Valida la fotografía con Google Vision AI y, si es buena, la envía al sistema de enrolamiento.
   * Sin archivo, reintenta con la copia que se conservó tras una falla técnica.
   */
  async procesarFoto(enrolamientoId: number, archivo: Buffer | null) {
    await this.exigirModuloActivo();
    if (this.enProceso.has(enrolamientoId)) throw conflicto('EN_PROCESO', 'Ya se está procesando una fotografía de esta solicitud.');
    this.enProceso.add(enrolamientoId);
    try {
      return await this.flujoFoto(enrolamientoId, archivo);
    } finally {
      this.enProceso.delete(enrolamientoId);
    }
  }

  private async flujoFoto(id: number, archivo: Buffer | null) {
    const enr = await this.prisma.enrolamiento.findUnique({
      where: { id },
      include: { usuario: true, captura_rel: { orderBy: { id: 'asc' } } },
    });
    if (!enr) throw noEncontrado('ENROLAMIENTO_NO_ENCONTRADO', 'No existe la solicitud de enrolamiento.');

    let captura = enr.captura_rel.find((c) => c.ruta_imagen && !c.eliminada_en) ?? null;
    // Tras una falla solo se puede continuar si quedó guardada la copia de la foto (falla técnica).
    if (enr.estado === 'FALLIDO' && !captura) {
      throw conflicto('ENROLAMIENTO_FINALIZADO', 'Esta solicitud terminó con un error y ya no se puede continuar. Vuelve a empezar.');
    }
    if (enr.estado === 'COMPLETADO' || enr.estado === 'CANCELADO') {
      throw conflicto('ENROLAMIENTO_FINALIZADO', enr.estado === 'COMPLETADO' ? 'Esta solicitud ya fue completada.' : 'Esta solicitud fue cancelada. Vuelve a empezar.');
    }

    // Se comprueba que haya a dónde enviar antes de guardar ni analizar nada.
    const conector = await this.conectores.obtener();

    let imagen: Buffer;
    if (archivo) {
      if (!detectarTipo(archivo) || !dimensiones(archivo)) throw invalido('IMAGEN_INVALIDA', 'El archivo no es una fotografía válida. Se aceptan imágenes JPG o PNG.');
      // Una foto nueva reemplaza a la que se había conservado para reintentar.
      if (captura) {
        await this.retencion.eliminarCopia(captura);
        captura = null;
      }
      imagen = archivo;
    } else {
      if (!captura) throw new ErrorNegocio(HttpStatus.BAD_REQUEST, 'FOTO_REQUERIDA', 'Falta la fotografía (campo "foto").');
      const guardada = await this.fotos.leer(captura.ruta_imagen as string);
      if (!guardada) throw new ErrorNegocio(HttpStatus.GONE, 'FOTO_NO_DISPONIBLE', 'La fotografía guardada ya no está disponible. Toma una nueva.');
      imagen = guardada;
    }
    const tipo = detectarTipo(imagen) as 'jpeg' | 'png';
    const dim = dimensiones(imagen) as { ancho: number; alto: number };

    if (enr.estado === 'FALLIDO') await this.cambiarEstado(id, 'FOTO_PENDIENTE');

    // 1) Validación del rostro. Si Vision AI rechaza la foto, nunca se guarda en disco.
    const yaValidada = !archivo && captura?.rostro_valido === true;
    if (!yaValidada) {
      let rostros;
      try {
        rostros = await this.vision.analizar(imagen);
      } catch (e) {
        const err = e as ErrorServicioExterno;
        await this.errores.registrar({ servicio: 'GOOGLE_VISION', operacion: 'validar_foto', mensaje: err.message, codigoHttp: err.codigoHttp, enrolamientoId: id });
        // La copia se conserva como máximo `foto_retencion_horas` para poder reintentar.
        if (!captura) {
          const nombre = await this.fotos.guardar(id, imagen, tipo);
          await this.prisma.captura_facial.create({ data: { enrolamiento_id: id, ruta_imagen: nombre, rostro_valido: false, motivo_rechazo: MOTIVO_ERROR_VISION } });
        }
        await this.marcarFallido(id);
        throw noDisponible('VISION_NO_DISPONIBLE', 'No pudimos revisar la fotografía en este momento. Intenta más tarde.', { puedeReintentar: true });
      }

      const evaluacion = evaluarRostro(rostros, dim);
      if (!evaluacion.valido) {
        const datos = { rostro_valido: false, confianza: evaluacion.confianza, motivo_rechazo: evaluacion.motivo, ruta_imagen: null, eliminada_en: new Date() };
        if (captura) {
          await this.retencion.eliminarCopia(captura);
          await this.prisma.captura_facial.update({ where: { id: captura.id }, data: datos });
        } else {
          await this.prisma.captura_facial.create({ data: { enrolamiento_id: id, ...datos } });
        }
        const max = await this.config.entero('foto_max_intentos');
        const rechazos = await this.prisma.captura_facial.count({ where: { enrolamiento_id: id, rostro_valido: false, NOT: { motivo_rechazo: MOTIVO_ERROR_VISION } } });
        const restantes = Math.max(0, max - rechazos);
        if (restantes === 0) await this.marcarFallido(id);
        throw invalido('FOTO_RECHAZADA', restantes === 0 ? `${evaluacion.mensaje} Se agotaron los intentos: vuelve a empezar.` : (evaluacion.mensaje as string), {
          motivo: evaluacion.motivo,
          intentosRestantes: restantes,
        });
      }

      // Foto válida: recién ahora se guarda, porque el conector necesita el archivo.
      const nombre = captura?.ruta_imagen ?? (await this.fotos.guardar(id, imagen, tipo));
      const datos = { rostro_valido: true, confianza: evaluacion.confianza, motivo_rechazo: null, ruta_imagen: nombre };
      captura = captura
        ? await this.prisma.captura_facial.update({ where: { id: captura.id }, data: datos })
        : await this.prisma.captura_facial.create({ data: { enrolamiento_id: id, ...datos } });
    }

    // 2) Envío al sistema de enrolamiento.
    const registro = captura as NonNullable<typeof captura>;
    try {
      await this.enviarAlConector(conector, id, enr.usuario, registro.ruta_imagen as string);
    } catch (e) {
      const err = e instanceof ErrorServicioExterno ? e : new ErrorServicioExterno((e as Error).message);
      await this.errores.registrar({ servicio: 'ENROLAMIENTO', operacion: 'enviar_enrolamiento', mensaje: err.message, codigoHttp: err.codigoHttp, enrolamientoId: id });
      await this.marcarFallido(id);
      if (!err.reintentable) {
        await this.retencion.eliminarCopia(registro);
        throw invalido('ENROLAMIENTO_RECHAZADO', err.mensajeUsuario ?? 'El sistema de enrolamiento no aceptó la solicitud. Acércate a la oficina de atención.');
      }
      throw new ErrorNegocio(HttpStatus.BAD_GATEWAY, 'ENROLAMIENTO_NO_DISPONIBLE', 'No pudimos completar el enrolamiento en este momento. Intenta más tarde.', { puedeReintentar: true });
    }

    // 3) Confirmado: la imagen se elimina y la solicitud queda completada.
    await this.retencion.eliminarCopia(registro);
    const completadoEn = new Date();
    await this.cambiarEstado(id, 'COMPLETADO', { completado_en: completadoEn });
    return { enrolamientoId: id, estado: 'COMPLETADO' as const, completadoEn: completadoEn.toISOString() };
  }

  private enviarAlConector(conector: ConectorEnrolamiento, id: number, usuario: { correo: string; nombres: string; apellidos: string }, nombreArchivo: string) {
    return conector.enviar({
      enrolamientoId: id,
      usuario: { correo: usuario.correo, nombres: usuario.nombres, apellidos: usuario.apellidos },
      rutaFoto: this.fotos.ruta(nombreArchivo),
    });
  }

  /** La persona abandona el proceso (por ejemplo, por inactividad en el tótem): se cancela y se borra la foto. */
  async cancelar(id: number) {
    if (this.enProceso.has(id)) throw conflicto('EN_PROCESO', 'Se está procesando la fotografía de esta solicitud.');
    const enr = await this.prisma.enrolamiento.findUnique({ where: { id }, select: { estado: true } });
    if (!enr) throw noEncontrado('ENROLAMIENTO_NO_ENCONTRADO', 'No existe la solicitud de enrolamiento.');
    exigirTransicion(enr.estado, 'CANCELADO');
    await this.cambiarEstado(id, 'CANCELADO');
    await this.retencion.eliminarCopiasDe([id]);
    return { enrolamientoId: id, estado: 'CANCELADO' as const };
  }

  /** Cambia el estado solo si la transición es válida desde el estado actual, en una única operación en la base. */
  private async cambiarEstado(id: number, hacia: EstadoEnrolamiento, extra: Prisma.enrolamientoUpdateManyMutationInput = {}): Promise<void> {
    const r = await this.prisma.enrolamiento.updateMany({ where: { id, estado: { in: origenesPosibles(hacia) } }, data: { estado: hacia, ...extra } });
    if (r.count === 0) {
      const actual = await this.prisma.enrolamiento.findUnique({ where: { id }, select: { estado: true } });
      throw conflicto('TRANSICION_INVALIDA', `La solicitud está en estado ${actual?.estado ?? 'desconocido'} y no puede pasar a ${hacia}.`);
    }
  }

  private async marcarFallido(id: number): Promise<void> {
    try {
      await this.cambiarEstado(id, 'FALLIDO');
    } catch (e) {
      this.log.warn(`No se pudo marcar como fallida la solicitud ${id}: ${(e as Error).message}`);
    }
  }

  // ------------------------------------------------------------------ administración

  /**
   * Solicitudes para el panel administrativo. Cada fila es una verificación de correo; si llegó a crear
   * un enrolamiento, trae su estado y el resultado de la validación de la foto. Nunca incluye la imagen.
   */
  async solicitudes(f: ListarSolicitudesDto) {
    const ahora = new Date();
    const filtros: Prisma.intento_autenticacionWhereInput[] = [];
    if (f.correo) filtros.push({ correo_ingresado: { contains: f.correo, mode: 'insensitive' } });
    if (f.desde) filtros.push({ solicitado_en: { gte: f.desde } });
    if (f.hasta) filtros.push({ solicitado_en: { lte: f.hasta } });
    switch (f.estado) {
      case undefined:
        break;
      case 'VERIFICACION_PENDIENTE':
        filtros.push({ estado: 'PENDIENTE', expira_en: { gt: ahora }, enrolamiento_rel: null });
        break;
      case 'VERIFICACION_EXPIRADA':
        filtros.push({ enrolamiento_rel: null, OR: [{ estado: 'EXPIRADA' }, { estado: 'PENDIENTE', expira_en: { lte: ahora } }] });
        break;
      case 'VERIFICACION_RECHAZADA':
        filtros.push({ estado: 'RECHAZADA', enrolamiento_rel: null });
        break;
      default:
        filtros.push({ enrolamiento_rel: { is: { estado: f.estado } } });
    }
    const where: Prisma.intento_autenticacionWhereInput = filtros.length ? { AND: filtros } : {};
    const limite = f.limite ?? 25;
    const [total, filas] = await Promise.all([
      this.prisma.intento_autenticacion.count({ where }),
      this.prisma.intento_autenticacion.findMany({
        where,
        orderBy: { solicitado_en: 'desc' },
        skip: f.desplazamiento ?? 0,
        take: limite,
        include: {
          totem: { select: { nombre: true } },
          enrolamiento_rel: { include: { captura_rel: { orderBy: { id: 'asc' } }, registro_error_rel: { orderBy: { id: 'asc' } } } },
        },
      }),
    ]);

    return {
      total,
      items: filas.map((i) => {
        const e = i.enrolamiento_rel;
        const estado: EstadoSolicitud = e
          ? e.estado
          : i.estado === 'RECHAZADA'
            ? 'VERIFICACION_RECHAZADA'
            : i.estado === 'EXPIRADA' || i.expira_en <= ahora
              ? 'VERIFICACION_EXPIRADA'
              : 'VERIFICACION_PENDIENTE';
        return {
          id: i.id,
          solicitadoEn: i.solicitado_en.toISOString(),
          correo: i.correo_ingresado,
          estado,
          totem: i.totem.nombre,
          verificacion: {
            estado: i.estado,
            codigosFallidos: i.intentos_fallidos,
            expiraEn: i.expira_en.toISOString(),
            resueltoEn: i.resuelto_en?.toISOString() ?? null,
          },
          enrolamiento: e && {
            id: e.id,
            estado: e.estado,
            iniciadoEn: e.iniciado_en.toISOString(),
            completadoEn: e.completado_en?.toISOString() ?? null,
            capturas: e.captura_rel.map((c) => ({
              capturadaEn: c.capturada_en.toISOString(),
              rostroValido: c.rostro_valido,
              confianza: c.confianza === null ? null : Number(c.confianza),
              motivoRechazo: c.motivo_rechazo,
              imagenEliminadaEn: c.eliminada_en?.toISOString() ?? null,
            })),
            errores: e.registro_error_rel.map((r) => ({ servicio: r.servicio, operacion: r.operacion, codigoHttp: r.codigo_http, mensaje: r.mensaje, creadoEn: r.creado_en.toISOString() })),
          },
        };
      }),
    };
  }
}
