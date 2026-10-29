import { Transform } from 'class-transformer';

/** Quita espacios al inicio y al final de los textos; los vacíos quedan como `null`. */
export const Recortar = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t === '' ? null : t;
  });

/** Convierte "true"/"false" de la URL en booleano. */
export const BooleanoDeUrl = () =>
  Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value));
