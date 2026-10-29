import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Valores iniciales por si falta alguna clave en `configuracion_sistema`. */
export const CONFIG_DEFECTO: Record<string, string> = {
  modulo_enrolamiento_activo: 'false',
  conector_enrolamiento: 'ninguno',
  dominios_correo: '',
  codigo_vigencia_min: '5',
  codigo_max_intentos: '3',
  foto_retencion_horas: '24',
  foto_max_intentos: '5',
  enrolamiento_vigencia_min: '10',
  codigo_max_solicitudes: '3',
  codigo_ventana_min: '10',
  tiempo_inactividad_seg: '60',
};

const VIGENCIA_CACHE_MS = 15_000;

/** Lee `configuracion_sistema` con una caché corta, para no consultar la tabla en cada solicitud. */
@Injectable()
export class ConfiguracionService {
  private cache: Map<string, string> | null = null;
  private cargadoEn = 0;

  constructor(private readonly prisma: PrismaService) {}

  invalidar(): void {
    this.cache = null;
  }

  private async mapa(): Promise<Map<string, string>> {
    if (this.cache && Date.now() - this.cargadoEn < VIGENCIA_CACHE_MS) return this.cache;
    const filas = await this.prisma.configuracion_sistema.findMany();
    this.cache = new Map(filas.map((f) => [f.clave, f.valor]));
    this.cargadoEn = Date.now();
    return this.cache;
  }

  /** Valor guardado en la tabla, sin aplicar valores por defecto; `undefined` si la clave no existe. */
  async textoOpcional(clave: string): Promise<string | undefined> {
    const v = (await this.mapa()).get(clave);
    return v === undefined ? undefined : v.trim();
  }

  async texto(clave: string): Promise<string> {
    const m = await this.mapa();
    return (m.get(clave) ?? CONFIG_DEFECTO[clave] ?? '').trim();
  }

  async entero(clave: string): Promise<number> {
    const t = await this.texto(clave);
    const n = Number(t);
    if (Number.isFinite(n)) return Math.trunc(n);
    const def = Number(CONFIG_DEFECTO[clave]);
    return Number.isFinite(def) ? Math.trunc(def) : 0;
  }

  async booleano(clave: string): Promise<boolean> {
    return ['true', '1', 'si', 'sí'].includes((await this.texto(clave)).toLowerCase());
  }

  /** Lista separada por comas, en minúsculas y sin vacíos. */
  async lista(clave: string): Promise<string[]> {
    return (await this.texto(clave))
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
}
