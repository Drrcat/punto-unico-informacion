// Deja con nombres genéricos (Sala 01, Sala 02…) las salas de un piso.
// Uso:  TOKEN=xxxx PISO=3 node renombrar-piso.js            (solo muestra qué haría)
//       TOKEN=xxxx PISO=3 node renombrar-piso.js --aplicar  (cambia de verdad)
const API = process.env.API ?? 'http://localhost:3000/api';
const PISO = Number(process.env.PISO ?? 3);
const APLICAR = process.argv.includes('--aplicar');
const CONSERVAR = []; // nombres que NO se tocan, por ejemplo ['Servicios Digitales']

const H = { Authorization: `Bearer ${process.env.TOKEN}`, 'Content-Type': 'application/json' };
const pedir = async (ruta, opciones) => {
  const r = await fetch(API + ruta, { headers: H, ...opciones });
  const cuerpo = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${cuerpo.codigo}: ${cuerpo.mensaje}`);
  return cuerpo;
};

(async () => {
  const piso = (await pedir('/pisos')).find((p) => p.numero === PISO);
  const sala = (await pedir('/salas/tipos')).find((t) => t.nombre === 'Sala');
  const { items } = await pedir(`/salas?pisoId=${piso.id}&tipoEspacioId=${sala.id}&limite=100&todas=true`);
  const salas = items.filter((s) => !CONSERVAR.includes(s.nombre)).sort((a, b) => a.id - b.id);

  for (const [i, s] of salas.entries()) {
    const n = String(i + 1).padStart(2, '0');
    const cambio = { nombre: `Sala ${n}`, codigo: `S${n}`, alias: [] };
    console.log(`${s.codigo.padEnd(16)} ${s.nombre.padEnd(22)} ->  ${cambio.codigo}  ${cambio.nombre}`);
    if (APLICAR) await pedir(`/salas/${s.id}`, { method: 'PUT', body: JSON.stringify(cambio) });
  }
  console.log(APLICAR ? `\nListo: ${salas.length} salas actualizadas.` : `\nSimulación: ${salas.length} salas. Agrega --aplicar para cambiarlas.`);
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
