// Carga las variables del archivo .env (conexión a Supabase, JWT_SECRET, etc.) antes que todo lo demás.
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configurarApp } from './app.setup';
import { PrismaService } from './common/prisma/prisma.service';
import { cargarEntorno, EntornoInvalido } from './config/entorno';

async function arrancar(): Promise<void> {
  const log = new Logger('Arranque');
  let entorno;
  try {
    entorno = cargarEntorno();
  } catch (e) {
    if (e instanceof EntornoInvalido) {
      log.error(e.message);
      process.exit(1);
    }
    throw e;
  }
  entorno.advertencias.forEach((a) => log.warn(a));

  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(entorno));
  configurarApp(app, entorno);
  app.enableShutdownHooks();

  if (entorno.docs) {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('OrientaSede API').setVersion('0.1.0').addBearerAuth().build());
    SwaggerModule.setup('api/docs', app, doc);
  }

  // El tótem de esta instalación debe existir: las verificaciones y consultas se registran a su nombre.
  const totem = await app.get(PrismaService).totem.findUnique({ where: { id: entorno.totemId }, select: { nombre: true } });
  if (totem) log.log(`Tótem: ${totem.nombre} (id ${entorno.totemId})`);
  else log.warn(`No existe el tótem con id ${entorno.totemId}. Ejecuta la carga inicial ("npx prisma db seed") o ajusta TOTEM_ID.`);

  await app.listen(entorno.puerto, entorno.host);
  log.log(`Backend escuchando en http://${entorno.host}:${entorno.puerto}/api`);
}

void arrancar();
