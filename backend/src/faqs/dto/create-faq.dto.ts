import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Datos que se deben enviar para CREAR una FAQ (POST /faqs).
// Si falta un campo o viene vacío, la API responde 400 automáticamente.
export class CreateFaqDto {
  @IsString({ message: 'La pregunta debe ser texto' })
  @IsNotEmpty({ message: 'La pregunta no puede estar vacía' })
  @MaxLength(200, { message: 'La pregunta no puede superar 200 caracteres' })
  pregunta: string;

  @IsString({ message: 'La respuesta debe ser texto' })
  @IsNotEmpty({ message: 'La respuesta no puede estar vacía' })
  @MaxLength(2000, { message: 'La respuesta no puede superar 2000 caracteres' })
  respuesta: string;
}
