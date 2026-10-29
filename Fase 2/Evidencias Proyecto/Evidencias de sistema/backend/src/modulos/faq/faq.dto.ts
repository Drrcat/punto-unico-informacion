import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Datos para crear una pregunta frecuente (POST /api/faq). Siguen las columnas de `pregunta_frecuente`.
 * El autor no se envía: lo fija el backend con FAQ_CREATED_BY_ID.
 * class-validator revisa los decoradores de abajo hacia arriba: el más básico va al final para que su
 * mensaje sea el primero de la respuesta.
 */
export class CrearFaqDto {
  @MaxLength(300, { message: 'La pregunta no puede superar 300 caracteres' })
  @IsString({ message: 'La pregunta debe ser texto' })
  @IsNotEmpty({ message: 'La pregunta no puede estar vacía' })
  pregunta: string;

  @MaxLength(5000, { message: 'La respuesta no puede superar 5000 caracteres' })
  @IsString({ message: 'La respuesta debe ser texto' })
  @IsNotEmpty({ message: 'La respuesta no puede estar vacía' })
  respuesta: string;

  @Min(1, { message: 'categoria_id no es válido' })
  @IsInt({ message: 'categoria_id es obligatorio y debe ser un número entero' })
  categoria_id: number;

  /** Nulo o ausente: pregunta general, sin área responsable. */
  @IsOptional()
  @Min(1, { message: 'area_id no es válido' })
  @IsInt({ message: 'area_id debe ser un número entero' })
  area_id?: number | null;

  /** Si no se envía, la base la deja en false (no se muestra en el tótem). */
  @IsOptional()
  @IsBoolean({ message: 'publicada debe ser true o false' })
  publicada?: boolean;
}

/** Edición parcial (PUT o PATCH /api/faq/:id): solo cambian los campos enviados. */
export class ActualizarFaqDto extends PartialType(CrearFaqDto) {}
