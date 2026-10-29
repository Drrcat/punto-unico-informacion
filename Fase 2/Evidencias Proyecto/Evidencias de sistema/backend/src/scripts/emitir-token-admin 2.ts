/**
 * Solo para desarrollo: emite un token de administrador válido sin pasar por el inicio de sesión, para probar
 * las rutas de administración antes de contar con `/api/auth/login`. Sigue el mismo contrato que ese módulo:
 * JWT HS256 firmado con JWT_SECRET y una fila en `sesion_admin` con el SHA-256 del token.
 *
 *   npm run build && JWT_SECRET=... DATABASE_URL=... node dist/scripts/emitir-token-admin.js admin@ejemplo.cl [horas]
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { hashToken } from '../common/auth/tokens';

async function main(): Promise<void> {
  const [correo, horasArg] = process.argv.slice(2);
  const { DATABASE_URL, JWT_SECRET, NODE_ENV } = process.env;
  if (!correo || !DATABASE_URL || !JWT_SECRET) throw new Error('Uso: node dist/scripts/emitir-token-admin.js <correo> [horas]  (requiere DATABASE_URL y JWT_SECRET)');
  if (NODE_ENV === 'production' && process.env.FORZAR !== 'si') throw new Error('Este script es solo para desarrollo. Con NODE_ENV=production hay que definir FORZAR=si.');
  const horas = Number(horasArg ?? 8);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
  try {
    const usuario = await prisma.usuario.findUnique({ where: { correo: correo.toLowerCase() } });
    if (!usuario?.activo) throw new Error(`No existe un usuario activo con el correo ${correo}.`);
    const token = await new JwtService().signAsync({ sub: String(usuario.id) }, { secret: JWT_SECRET, algorithm: 'HS256', expiresIn: `${horas}h` });
    await prisma.sesion_admin.create({ data: { usuario_id: usuario.id, token_hash: hashToken(token), expira_en: new Date(Date.now() + horas * 3_600_000) } });
    console.log(token);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
