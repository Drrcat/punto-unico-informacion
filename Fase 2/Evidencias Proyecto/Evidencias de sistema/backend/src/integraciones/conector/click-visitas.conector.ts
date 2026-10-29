import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENTORNO, Entorno } from '../../config/entorno';
import { ErrorServicioExterno } from '../errores';
import { ConectorEnrolamiento, DatosEnrolamiento } from './conector-enrolamiento';

/**
 * Selectores de la plataforma Click Visitas.
 *
 * ⚠ PENDIENTE: los valores que empiezan con "__CONFIRMAR__" son marcadores. Hay que reemplazarlos por los
 * selectores reales de la plataforma (inspeccionando las pantallas con una cuenta de prueba, por ejemplo con
 * `npx playwright codegen <url>`). Mientras queden marcadores, el conector se niega a ejecutarse y lo informa.
 */
export const SELECTORES = {
  /** Ruta, relativa a ENROLAMIENTO_URL, de la pantalla de inicio de sesión. */
  rutaLogin: '/__CONFIRMAR__/login',
  campoUsuario: '__CONFIRMAR__ campo usuario',
  campoClave: '__CONFIRMAR__ campo clave',
  botonIngresar: '__CONFIRMAR__ boton ingresar',
  /** Elemento que solo existe con la sesión iniciada. */
  sesionIniciada: '__CONFIRMAR__ indicador de sesion',
  /** Ruta de la pantalla donde se registra o actualiza a la persona con su foto. */
  rutaRegistro: '/__CONFIRMAR__/registro',
  campoNombre: '__CONFIRMAR__ campo nombre',
  campoCorreo: '__CONFIRMAR__ campo correo',
  campoFoto: '__CONFIRMAR__ input de archivo (foto)',
  botonGuardar: '__CONFIRMAR__ boton guardar',
  mensajeExito: '__CONFIRMAR__ mensaje de exito',
  mensajeError: '__CONFIRMAR__ mensaje de error',
};

const TIEMPO_MAX_MS = 25_000;

export const selectoresPendientes = (s: Record<string, string> = SELECTORES): string[] =>
  Object.entries(s)
    .filter(([, v]) => v.includes('__CONFIRMAR__'))
    .map(([k]) => k);

/**
 * Conector de demostración: carga la fotografía en Click Visitas automatizando el navegador con Playwright.
 * Se ejecuta en el servidor, hace una sola cosa (cargar la fotografía de la solicitud) y procesa de a una
 * solicitud por vez. Las credenciales salen de ENROLAMIENTO_USUARIO y ENROLAMIENTO_CLAVE y no se registran.
 */
@Injectable()
export class ConectorClickVisitas implements ConectorEnrolamiento {
  readonly nombre = 'click_visitas';
  private readonly log = new Logger('ConectorClickVisitas');
  private cola: Promise<unknown> = Promise.resolve();

  constructor(@Inject(ENTORNO) private readonly entorno: Entorno) {}

  enviar(d: DatosEnrolamiento): Promise<void> {
    const turno = this.cola.then(() => this.cargar(d));
    this.cola = turno.catch(() => undefined);
    return turno;
  }

  private async cargar(d: DatosEnrolamiento): Promise<void> {
    const { url, usuario, clave } = this.entorno.enrolamiento;
    if (!url || !usuario || !clave) {
      throw new ErrorServicioExterno('Faltan ENROLAMIENTO_URL, ENROLAMIENTO_USUARIO o ENROLAMIENTO_CLAVE.', undefined, false);
    }
    const pendientes = selectoresPendientes();
    if (pendientes.length) {
      throw new ErrorServicioExterno(`El conector Click Visitas no tiene configurados estos selectores: ${pendientes.join(', ')}.`, undefined, false);
    }

    const { chromium } = await import('playwright');
    const navegador = await chromium.launch({ headless: true, chromiumSandbox: false });
    try {
      const pagina = await (await navegador.newContext({ locale: 'es-CL' })).newPage();
      pagina.setDefaultTimeout(TIEMPO_MAX_MS);
      const destino = (ruta: string) => new URL(ruta, url).toString();

      await pagina.goto(destino(SELECTORES.rutaLogin));
      await pagina.fill(SELECTORES.campoUsuario, usuario);
      await pagina.fill(SELECTORES.campoClave, clave);
      await pagina.click(SELECTORES.botonIngresar);
      await pagina.waitForSelector(SELECTORES.sesionIniciada);

      await pagina.goto(destino(SELECTORES.rutaRegistro));
      await pagina.fill(SELECTORES.campoNombre, `${d.usuario.nombres} ${d.usuario.apellidos}`.trim());
      await pagina.fill(SELECTORES.campoCorreo, d.usuario.correo);
      await pagina.setInputFiles(SELECTORES.campoFoto, d.rutaFoto);
      await pagina.click(SELECTORES.botonGuardar);

      const resultado = await pagina.waitForSelector(`${SELECTORES.mensajeExito}, ${SELECTORES.mensajeError}`);
      if (await resultado.evaluate((el, sel) => el.matches(sel), SELECTORES.mensajeError)) {
        const texto = ((await resultado.textContent()) ?? '').trim().slice(0, 150);
        throw new ErrorServicioExterno(`Click Visitas rechazó el registro: ${texto}`, undefined, false);
      }
      this.log.log(`Enrolamiento ${d.enrolamientoId} cargado en Click Visitas.`);
    } catch (e) {
      if (e instanceof ErrorServicioExterno) throw e;
      // Tiempo de espera agotado, cambio en las pantallas, sin red: falla técnica, se puede reintentar.
      throw new ErrorServicioExterno(`Falló la automatización de Click Visitas: ${(e as Error).message.split('\n')[0]}`);
    } finally {
      await navegador.close().catch(() => undefined);
    }
  }
}
