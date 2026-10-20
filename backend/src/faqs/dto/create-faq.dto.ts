import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// Datos que se deben enviar para CREAR una FAQ (POST /faqs).
// Siguen las columnas de la tabla pregunta_frecuente.
// Si falta un campo obligatorio, viene vacío o mandan uno que no existe,
// la API responde 400 automáticamente (ver configurar-app.ts).
// Ojo: class-validator revisa los decoradores de abajo hacia arriba, y como
// usamos stopAtFirstError, el de más abajo es el mensaje que se ve primero.
export class CreateFaqDto {
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

  // Opcional: null o ausente = pregunta general, sin área responsable
  @IsOptional()
  @Min(1, { message: 'area_id no es válido' })
  @IsInt({ message: 'area_id debe ser un número entero' })
  area_id?: number | null;

  // Opcional: si no se envía, la base la deja en false (no visible en el tótem)
  @IsOptional()
  @IsBoolean({ message: 'publicada debe ser true o false' })
  publicada?: boolean;

  @Min(1, { message: 'creado_por_id no es válido' })
  @IsInt({ message: 'creado_por_id es obligatorio y debe ser un número entero' })
  creado_por_id: number;
}
