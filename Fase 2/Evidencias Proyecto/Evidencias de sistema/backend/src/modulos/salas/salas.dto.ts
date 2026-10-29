import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BooleanoDeUrl, Recortar } from '../../common/util/dto';

export class ListarSalasDto {
  /** Texto a buscar: código, nombre, alias, área que funciona allí o tipo de espacio. Ignora tildes y mayúsculas. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Recortar()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pisoId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tipoEspacioId?: number;

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

  /** Solo administradores: incluye también los espacios inactivos y los tipos no buscables. */
  @IsOptional()
  @BooleanoDeUrl()
  @IsBoolean()
  todas?: boolean;
}

export class EquipamientoDto {
  @IsString()
  @Recortar()
  @Length(1, 100)
  nombre!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32767)
  cantidad?: number;

  @IsOptional()
  @IsString()
  @Recortar()
  @MaxLength(200)
  observacion?: string | null;
}

export class CrearSalaDto {
  @IsInt()
  @Min(1)
  pisoId!: number;

  @IsInt()
  @Min(1)
  tipoEspacioId!: number;

  /** Código visible, único dentro del piso (p. ej. "S01" o "PA-323"). */
  @IsString()
  @Recortar()
  @Length(1, 30)
  codigo!: string;

  @IsOptional()
  @IsString()
  @Recortar()
  @MaxLength(120)
  nombre?: string | null;

  /** Id del elemento del plano SVG que se resalta al mostrar la sala. */
  @IsOptional()
  @IsString()
  @Recortar()
  @MaxLength(80)
  svgElementId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32767)
  capacidad?: number | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  /** Nombres alternativos con los que también se debe encontrar la sala. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Length(1, 120, { each: true })
  alias?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EquipamientoDto)
  equipamiento?: EquipamientoDto[];
}

/** Todos los campos son opcionales: solo se cambian los que se envían. `alias` y `equipamiento` reemplazan la lista completa. */
export class ActualizarSalaDto extends PartialType(CrearSalaDto) {}
