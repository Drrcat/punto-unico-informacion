import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { existsSync } from 'fs';
import * as path from 'path';
import { FiltroErrores } from './common/filtros/filtro-errores';
import { Entorno } from './config/entorno';

/**
 * Rutas que se atienden sin el prefijo /api: la aplicación de escritorio todavía llama a /faqs.
 * Las mismas rutas existen también como /api/faq.
 */
const RUTAS_SIN_PREFIJO = ['faqs', 'faqs/{*ruta}'];

/** Configuración común del backend, compartida entre el arranque real y las pruebas. */
export function configurarApp(app: INestApplication, entorno: Entorno): void {
  app.setGlobalPrefix('api', { exclude: RUTAS_SIN_PREFIJO });
  // Las cabeceras estrictas (incluida la política de contenido) protegen la API. La aplicación web del tótem
  // define las suyas, y el servidor puede estar detrás de HTTP simple en la red local, por eso se le quitan
  // las que solo tienen sentido con HTTPS o que impedirían usar scripts en línea.
  const paraApi = helmet({ crossOriginResourcePolicy: { policy: entorno.corsOrigenes.length ? 'cross-origin' : 'same-origin' } });
  const paraWeb = helmet({ contentSecurityPolicy: false, hsts: false, crossOriginOpenerPolicy: false, crossOriginResourcePolicy: false, originAgentCluster: false });
  app.use((req: { path: string }, res: unknown, next: () => void) => ((req.path.startsWith('/api') ? paraApi : paraWeb) as (a: unknown, b: unknown, c: () => void) => void)(req, res, next));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new FiltroErrores());
  if (entorno.corsOrigenes.length) app.enableCors({ origin: entorno.corsOrigenes });

  // Aplicación web del tótem, si está presente en la misma imagen.
  const publico = path.resolve(entorno.publicDir);
  if (existsSync(publico)) {
    (app as NestExpressApplication).useStaticAssets(publico);
    new Logger('Arranque').log(`Sirviendo la aplicación web desde ${publico}`);
  }
}
