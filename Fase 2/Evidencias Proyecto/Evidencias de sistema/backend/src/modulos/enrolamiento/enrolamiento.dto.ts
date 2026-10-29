import { Type } from 'class-transformer';
import { IsDate, IsEmail, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { Recortar } from '../../common/util/dto';

export class IniciarVerificacionDto {
  /** Correo institucional de la persona. */
  @Recortar()
  @IsEmail()
  @MaxLength(150)
  correo!: string;
}

export class ValidarCodigoDto {
  /** Código de seis dígitos recibido por correo. */
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'El código debe tener 6 dígitos.' })
  codigo!: string;
}

export const ESTADOS_SOLICITUD = [
  'INICIADO',
  'FOTO_PENDIENTE',
  'COMPLETADO',
  'FALLIDO',
  'CANCELADO',
  'VERIFICACION_PENDIENTE',
  'VERIFICACION_EXPIRADA',
  'VERIFICACION_RECHAZADA',
] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export class ListarSolicitudesDto {
  /** Estado de la solicitud. Los `VERIFICACION_*` son solicitudes que no pasaron la verificación del correo. */
  @IsOptional()
  @IsEnum(ESTADOS_SOLICITUD)
  estado?: EstadoSolicitud;

  /** Texto contenido en el correo. */
  @IsOptional()
  @IsString()
  @Recortar()
  @Length(1, 150)
  correo?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  desde?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  hasta?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desplazamiento?: number;
}
