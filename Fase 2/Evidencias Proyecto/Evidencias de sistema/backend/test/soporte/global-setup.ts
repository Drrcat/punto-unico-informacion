import { readFileSync } from 'fs';
import * as path from 'path';
import { Client } from 'pg';

export const URL_PRUEBAS = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@localhost:5433/orientasede_test';

/**
 * Deja la base de pruebas vacía y con el esquema de la migración inicial. Por seguridad solo opera sobre
 * bases cuyo nombre contiene "test": nunca toca una base de verdad.
 */
export default async function globalSetup(): Promise<void> {
  const url = new URL(URL_PRUEBAS);
  const nombre = decodeURIComponent(url.pathname.slice(1));
  if (!/test/i.test(nombre)) throw new Error(`TEST_DATABASE_URL debe apuntar a una base de pruebas (el nombre debe contener "test"): ${nombre}`);

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const c = new Client({ connectionString: admin.toString() });
  await c.connect();
  if (!(await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre])).rowCount) await c.query(`CREATE DATABASE "${nombre.replace(/"/g, '')}"`);
  await c.end();

  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await db.query(readFileSync(path.resolve(__dirname, '../../../database/prisma/migrations/0001_init/migration.sql'), 'utf8'));
  await db.end();
  process.env.TEST_DATABASE_URL = url.toString();
}
