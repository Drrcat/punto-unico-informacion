import { MensajeCodigo } from './correo.provider';

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function construirCorreoCodigo(m: MensajeCodigo): { asunto: string; texto: string; html: string } {
  const minutos = `${m.vigenciaMin} ${m.vigenciaMin === 1 ? 'minuto' : 'minutos'}`;
  const institucion = m.institucion.trim() || 'OrientaSede';
  const texto = [
    `Tu código de verificación es: ${m.codigo}`,
    '',
    `Es válido por ${minutos}. Ingrésalo en el tótem para continuar.`,
    'Si no fuiste tú quien lo pidió, ignora este mensaje: nadie podrá continuar sin el código.',
    '',
    institucion,
  ].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1b2430">
<p style="margin:0 0 12px">Tu código de verificación es:</p>
<p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:0 0 16px">${escapar(m.codigo)}</p>
<p style="margin:0 0 8px">Es válido por ${minutos}. Ingrésalo en el tótem para continuar.</p>
<p style="margin:0 0 20px;color:#5b6675;font-size:13px">Si no fuiste tú quien lo pidió, ignora este mensaje: nadie podrá continuar sin el código.</p>
<p style="margin:0;color:#5b6675;font-size:13px">${escapar(institucion)}</p>
</div>`;
  return { asunto: `${institucion}: tu código de verificación`, texto, html };
}
