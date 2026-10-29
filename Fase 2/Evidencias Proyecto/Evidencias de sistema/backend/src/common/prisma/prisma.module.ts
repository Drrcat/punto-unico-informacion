import { Global, Module } from '@nestjs/common';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { AuditoriaService } from '../registro/auditoria.service';
import { ConsultaService } from '../registro/consulta.service';
import { ErrorExternoService } from '../registro/error-externo.service';
import { Invalidador } from '../util/indice-cache';
import { PrismaService } from './prisma.service';

/** Servicios transversales (base de datos, configuración y bitácoras) disponibles en todos los módulos. */
@Global()
@Module({
  providers: [PrismaService, ConfiguracionService, AuditoriaService, ConsultaService, ErrorExternoService, Invalidador],
  exports: [PrismaService, ConfiguracionService, AuditoriaService, ConsultaService, ErrorExternoService, Invalidador],
})
export class NucleoModule {}
