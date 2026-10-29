const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/**
 * El correo es lo único que se conoce de quien se enrola. Si sigue el formato `nombre.apellido@dominio`
 * se separa en nombres y apellidos; si no, todo va en nombres. Es un dato provisional hasta contar con una
 * fuente de nombres de la institución.
 */
export function nombresDesdeCorreo(correo: string): { nombres: string; apellidos: string } {
  const local = correo.split('@')[0] ?? '';
  const partes = local
    .split(/[._-]+/)
    .map((p) => p.replace(/[0-9]+/g, ''))
    .filter(Boolean)
    .map(capitalizar);
  if (partes.length === 0) return { nombres: 'Usuario', apellidos: '' };
  if (partes.length === 1) return { nombres: partes[0].slice(0, 100), apellidos: '' };
  return { nombres: partes[0].slice(0, 100), apellidos: partes.slice(1).join(' ').slice(0, 100) };
}
