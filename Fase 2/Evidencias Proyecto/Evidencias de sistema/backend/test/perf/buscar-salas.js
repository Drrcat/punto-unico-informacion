#!/usr/bin/env node
/**
 * Prueba de rendimiento de la búsqueda de salas (requisito: responder en menos de 2 segundos).
 *
 * Uso (con el backend ya levantado y con datos cargados):
 *     LIMITES=off node dist/main.js          # en otra terminal: sin el límite de solicitudes por minuto
 *     npm run perf:salas                     # o: BASE_URL=http://localhost:3000 DURACION=15 CONEXIONES=20 npm run perf:salas
 *
 * Termina con código 1 si hay respuestas con error o si el percentil 99 supera el umbral (UMBRAL_MS, 2000 por defecto).
 */
const autocannon = require('autocannon');

const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const duracion = Number(process.env.DURACION || 10);
const conexiones = Number(process.env.CONEXIONES || 10);
const umbral = Number(process.env.UMBRAL_MS || 2000);

const consultas = ['laboratorio', 'bano', 'escalera', 's05', 'oficina', 'sala', 'ba', 'lab', 'piso 3', 'zzzz-sin-resultados'];
const peticiones = consultas.map((q) => ({ method: 'GET', path: `/api/salas?q=${encodeURIComponent(q)}&limite=20` }));
peticiones.push({ method: 'GET', path: '/api/salas?limite=50' }, { method: 'GET', path: '/api/pisos' });

async function main() {
  console.log(`Búsqueda de salas: ${conexiones} conexiones durante ${duracion} s contra ${base}`);
  const r = await autocannon({ url: base, connections: conexiones, duration: duracion, requests: peticiones });
  const l = r.latency;
  console.log(`Solicitudes: ${r.requests.total} (${Math.round(r.requests.average)}/s)`);
  console.log(`Latencia ms -> media ${l.average}, p50 ${l.p50}, p97.5 ${l.p97_5}, p99 ${l.p99}, máx ${l.max}`);
  console.log(`Respuestas no 2xx: ${r.non2xx}, errores de conexión: ${r.errors}, tiempos agotados: ${r.timeouts}`);
  const fallas = [];
  if (r.non2xx > 0) fallas.push(`${r.non2xx} respuestas no 2xx (¿está activo el límite de solicitudes? arranca con LIMITES=off)`);
  if (r.errors > 0 || r.timeouts > 0) fallas.push('errores de conexión o tiempos agotados');
  if (l.p99 >= umbral) fallas.push(`p99 de ${l.p99} ms supera el umbral de ${umbral} ms`);
  if (fallas.length) {
    console.error('FALLA: ' + fallas.join('; '));
    process.exit(1);
  }
  console.log(`OK: p99 de ${l.p99} ms, bajo el umbral de ${umbral} ms.`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
