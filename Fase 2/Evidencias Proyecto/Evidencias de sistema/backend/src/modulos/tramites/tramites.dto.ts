import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Recortar } from '../../common/util/dto';

export class ListarTramitesDto {
  /** Busca por nombre, descripción o área que resuelve el trámite. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Recortar()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  areaId?: number;
}
