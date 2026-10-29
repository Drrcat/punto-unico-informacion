import { PartialType } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';
import { Recortar } from '../../common/util/dto';

export class ListarAreasDto {
  /** Busca por nombre del área, lo que atiende, sus trámites o las carreras que atiende. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Recortar()
  q?: string;
}

export class CrearAreaDto {
  @IsString()
  @Recortar()
  @Length(1, 120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @Recortar()
  @MaxLength(300)
  descripcion?: string | null;

  /** Sala u oficina donde atiende el área. */
  @IsOptional()
  @IsInt()
  @Min(1)
  espacioId?: number | null;

  @IsOptional()
  @IsString()
  @Recortar()
  @MaxLength(200)
  horarioAtencion?: string | null;

  /** Casilla compartida del área, no un correo personal. */
  @IsOptional()
  @Recortar()
  @IsEmail()
  @MaxLength(150)
  correoContacto?: string | null;

  @IsOptional()
  @IsString()
  @Recortar()
  @MaxLength(20)
  anexo?: string | null;
}

export class ActualizarAreaDto extends PartialType(CrearAreaDto) {}
