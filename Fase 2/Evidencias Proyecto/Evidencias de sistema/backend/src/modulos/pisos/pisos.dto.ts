import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ListarPisosDto {
  /** Muestra solo los pisos de este edificio. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  edificioId?: number;
}
