import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ENTORNO, Entorno } from '../../config/entorno';
import { TipoImagen } from '../../common/util/fotos';

/**
 * Almacenamiento temporal de fotografías (dato biométrico). Solo lo usa el backend: los archivos no se
 * sirven por ninguna ruta, se guardan con permisos de lectura solo para el propio proceso y en la base
 * solo queda el nombre del archivo mientras exista.
 */
@Injectable()
export class FotosStore {
  private readonly dir: string;

  constructor(@Inject(ENTORNO) entorno: Entorno) {
    this.dir = path.resolve(entorno.fotosDir);
  }

  async guardar(enrolamientoId: number, imagen: Buffer, tipo: TipoImagen): Promise<string> {
    await fs.mkdir(this.dir, { recursive: true, mode: 0o700 });
    const nombre = `enr-${enrolamientoId}-${randomBytes(8).toString('hex')}.${tipo === 'jpeg' ? 'jpg' : 'png'}`;
    await fs.writeFile(path.join(this.dir, nombre), imagen, { mode: 0o600 });
    return nombre;
  }

  /** Ruta absoluta de un archivo guardado; rechaza cualquier nombre que intente salir de la carpeta. */
  ruta(nombre: string): string {
    if (nombre !== path.basename(nombre)) throw new Error('Nombre de archivo no permitido');
    return path.join(this.dir, nombre);
  }

  async leer(nombre: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.ruta(nombre));
    } catch {
      return null;
    }
  }

  /** Elimina el archivo; no falla si ya no existe. */
  async eliminar(nombre: string): Promise<void> {
    try {
      await fs.unlink(this.ruta(nombre));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }

  /** Archivos de la carpeta modificados antes de `antesDe` (para limpiar los que quedaron sin registro). */
  async listarAntiguos(antesDe: Date): Promise<string[]> {
    let nombres: string[];
    try {
      nombres = await fs.readdir(this.dir);
    } catch {
      return [];
    }
    const viejos: string[] = [];
    for (const n of nombres) {
      const st = await fs.stat(path.join(this.dir, n)).catch(() => null);
      if (st?.isFile() && st.mtime < antesDe) viejos.push(n);
    }
    return viejos;
  }
}
