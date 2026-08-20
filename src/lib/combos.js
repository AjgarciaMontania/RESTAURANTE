import { capitalizar } from "./carta.js";

/**
 * Fotos de combinaciones: el plato servido, no el ingrediente.
 *
 * Una foto de la pechuga sola no es lo que el cliente ve; lo que ve es
 * "frijoles + pechuga" en el plato. Aquí se guarda la foto de esa mezcla, y
 * vuelve a salir sola cada vez que se arme lo mismo.
 *
 * La llave la forma **solo el seco** —principio, proteínas y huevos— porque el
 * caldo o la sopa van en su propia foto aparte. Así la misma foto sirve con
 * caldo, con sopa o sin nada, y no hay que fotografiar cada mezcla posible.
 *
 * Viven en `menus/combos`, dentro de la colección que ya está autorizada.
 */
export const COMBOS_ID = "combos";

/** Solo lo que va en el plato del seco, en orden estable. */
const partesDelSeco = (sel) =>
  [
    sel?.principio || null,
    ...(sel?.proteinas || []),
    ...(sel?.huevos || []),
  ].filter((x) => x?.id);

/**
 * La llave de la combinación: los ids del seco, ordenados.
 *
 * Se ordenan para que "frijoles + pechuga" y "pechuga + frijoles" sean la
 * misma cosa: el orden en que el mesero toca los chips no debería importar.
 *
 * @returns {string} "" si no hay seco
 */
export const claveCombo = (sel) =>
  partesDelSeco(sel)
    .map((x) => x.id)
    .sort()
    .join("|");

/** Cómo se lee la combinación en la lista del menú fijo. */
export const nombreCombo = (sel) =>
  partesDelSeco(sel)
    .map((x) => capitalizar(x.nombre))
    .filter(Boolean)
    .join(" + ");

/** La combinación guardada que corresponde a lo que se está armando. */
export const buscarCombo = (sel, lista = []) => {
  const clave = claveCombo(sel);
  return clave ? lista.find((c) => c.clave === clave) || null : null;
};

/** La foto guardada de esa mezcla, o "" si no hay. */
export const fotoDelCombo = (sel, lista) => buscarCombo(sel, lista)?.foto || "";

/**
 * Deja la combinación guardada con esa foto, reemplazando la anterior.
 *
 * Sin foto no se guarda nada: una combinación sin imagen no aporta.
 *
 * @returns {object[]|null} la lista nueva, o null si no hay nada que cambiar
 */
export function conCombo(lista = [], sel, foto) {
  const clave = claveCombo(sel);
  if (!clave || !foto) return null;

  const anterior = lista.find((c) => c.clave === clave);
  if (anterior?.foto === foto) return null;

  const nuevo = { clave, nombre: nombreCombo(sel), foto };
  return anterior
    ? lista.map((c) => (c.clave === clave ? { ...c, ...nuevo } : c))
    : [...lista, nuevo];
}

/** Quita una combinación de la lista. */
export const sinCombo = (lista = [], clave) => lista.filter((c) => c.clave !== clave);
