/** Genera `openapi.json` con el contrato de la API, para quien la consume (aplicación de escritorio, tótem). No necesita base de datos. */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { AppModule } from './app.module';
import { configurarApp } from './app.setup';
import { cargarEntorno } from './config/entorno';

async function main(): Promise<void> {
  const entorno = cargarEntorno({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://x@localhost/x', JWT_SECRET: 'solo-para-generar-la-documentacion', TAREAS: 'off', PUBLIC_DIR: '/nonexistent' });
  const app = await NestFactory.create(AppModule.forRoot(entorno), { logger: false });
  configurarApp(app, entorno);
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('OrientaSede API').setVersion('0.1.0').addBearerAuth().build());
  const salida = process.argv[2] ?? 'openapi.json';
  writeFileSync(salida, JSON.stringify(doc, null, 2));
  console.log(`Contrato escrito en ${salida} (${Object.keys(doc.paths).length} rutas)`);
  await app.close();
}

void main();
