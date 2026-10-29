import { Injectable } from '@nestjs/common';
import { Indexado } from './buscador';

/** Avisa a los índices de búsqueda que los datos cambiaron (lo llaman las rutas de administración). */
@Injectable()
export class Invalidador {
  private readonly oyentes = new Set<() => void>();
  suscribir(fn: () => void): void {
    this.oyentes.add(fn);
  }
  invalidar(): void {
    for (const fn of this.oyentes) fn();
  }
}

/** Índice de búsqueda en memoria que se reconstruye al vencer su vigencia o cuando se invalida. */
export class IndiceCache<T> {
  private datos: Indexado<T>[] | null = null;
  private cargadoEn = 0;
  private cargando: Promise<Indexado<T>[]> | null = null;

  constructor(
    private readonly cargar: () => Promise<Indexado<T>[]>,
    private readonly vigenciaMs = 30_000,
  ) {}

  invalidar(): void {
    this.datos = null;
  }

  async obtener(): Promise<Indexado<T>[]> {
    if (this.datos && Date.now() - this.cargadoEn < this.vigenciaMs) return this.datos;
    // Si varias solicitudes llegan a la vez con el índice vencido, comparten una sola carga.
    this.cargando ??= this.cargar()
      .then((d) => {
        this.datos = d;
        this.cargadoEn = Date.now();
        return d;
      })
      .finally(() => {
        this.cargando = null;
      });
    return this.cargando;
  }
}
