// Cambia el nombre de una sala (y, si se indican, sus alias) para comprobar que el mapa del tótem lo muestra.
//
// Uso:
//   TOKEN=xxxx node herramientas/renombrar-sala.js "Sala 03" "Laboratorio de Redes"
//   TOKEN=xxxx node herramientas/renombrar-sala.js "Sala 03" "Laboratorio de Redes" "Sala 03"   (con alias: se sigue encontrando)
//   TOKEN=xxxx node herramientas/renombrar-sala.js "Laboratorio de Redes" "Sala 03" --sin-alias  (devuelve el nombre y borra los alias)
//
// La sala se busca por su nombre, código, alias o id del plano actual. Si el nombre se repite en dos pisos, se indica el
// piso con PISO=2. El token se obtiene con:  npm run token:admin -- correo@del.administrador
// Con otra dirección del backend:  API=http://servidor:3000/api
const API = process.env.API ?? 'http://localhost:3000/api';
const TOKEN = process.env.TOKEN;
const args = process.argv.slice(2);
const sinAlias = args.includes('--sin-alias');
const [actual, nuevo, ...alias] = args.filter((a) => a !== '--sin-alias');

if (!TOKEN || !actual || !nuevo) {
  console.error('Uso: TOKEN=xxxx node herramientas/renombrar-sala.js "nombre actual" "nombre nuevo" [alias...] [--sin-alias]');
  process.exit(1);
}

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const pedir = async (ruta, opciones = {}) => {
  const r = await fetch(API + ruta, { ...opciones, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } });
  const cuerpo = r.status === 204 ? null : await r.json();
  if (!r.ok) throw new Error(`${r.status} ${cuerpo?.codigo ?? ''}: ${cuerpo?.mensaje ?? 'respuesta inesperada'}`);
  return cuerpo;
};

(async () => {
  const { items } = await pedir(`/salas?q=${encodeURIComponent(actual)}&limite=100&todas=true`);
  const exactas = items.filter(
    (s) => [s.nombre, s.codigo, s.svgElementId, ...s.alias].some((c) => sinTildes(c) === sinTildes(actual)) && (!process.env.PISO || s.piso.numero === Number(process.env.PISO)),
  );
  if (exactas.length !== 1) {
    const lista = (exactas.length ? exactas : items.slice(0, 8)).map((s) => `  piso ${s.piso.numero}  ${s.codigo.padEnd(10)} ${s.nombre}`).join('\n');
    console.error(exactas.length ? `Hay ${exactas.length} salas con ese nombre; indica el piso con PISO=2:\n${lista}` : `No encontré una sala llamada "${actual}". Parecidas:\n${lista || '  (ninguna)'}`);
    process.exit(1);
  }
  const sala = exactas[0];
  const cambio = { nombre: nuevo, ...(sinAlias ? { alias: [] } : alias.length ? { alias } : {}) };
  await pedir(`/salas/${sala.id}`, { method: 'PUT', body: JSON.stringify(cambio) });
  console.log(`Piso ${sala.piso.numero}, ${sala.codigo}: "${sala.nombre}" -> "${nuevo}"${cambio.alias ? `  (alias: ${cambio.alias.join(', ') || 'ninguno'})` : ''}`);
  console.log('El mapa lo muestra en unos segundos (se actualiza solo).');
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
