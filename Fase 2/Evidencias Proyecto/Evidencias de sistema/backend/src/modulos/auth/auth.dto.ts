import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Recortar } from '../../common/util/dto';

/** Credenciales del personal administrativo (POST /api/auth/login). */
export class LoginDto {
  @MaxLength(150, { message: 'El correo no puede superar 150 caracteres' })
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @Recortar()
  correo!: string;

  /** No se recorta: los espacios forman parte de la contraseña. */
  @MaxLength(200, { message: 'La contraseña no puede superar 200 caracteres' })
  @IsString({ message: 'La contraseña debe ser texto' })
  @IsNotEmpty({ message: 'Ingresa la contraseña' })
  clave!: string;
}
