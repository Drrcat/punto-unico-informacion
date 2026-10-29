import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Cliente } from '../prisma/prisma.service';

export interface DatosAuditoria {
  usuarioId: number | null;
  accion: 'crear' | 'editar' | 'eliminar' | string;
  entidad: string;
  entidadId: number | string | null;
  detalle?: Prisma.InputJsonValue;
}

/** Bitácora de acciones del panel administrativo. Se escribe dentro de la misma transacción que el cambio. */
@Injectable()
export class AuditoriaService {
  async registrar(cliente: Cliente, d: DatosAuditoria): Promise<void> {
    await cliente.registro_auditoria.create({
      data: {
        usuario_id: d.usuarioId,
        accion: d.accion,
        entidad: d.entidad,
        entidad_id: d.entidadId === null ? null : String(d.entidadId),
        detalle: d.detalle ?? Prisma.JsonNull,
      },
    });
  }
}
