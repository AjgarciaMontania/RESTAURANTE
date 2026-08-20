/**
 * Secciones del menú, en el orden en que se arma el plato.
 *
 * `siempre: true` marca las secciones que no se eligen día por día: lo que
 * esté escrito en el catálogo se ofrece todos los días sin tener que marcarlo.
 */
export const SECCIONES = [
  { key: "caldos", titulo: "Caldos", icono: "🍲", ph: "Ej: Pescado", nota: "desayuno", conFoto: true },
  { key: "sopas", titulo: "Sopas", icono: "🥣", ph: "Ej: Verduras", nota: "almuerzo", conFoto: true },
  { key: "principios", titulo: "Principios", icono: "🫘", ph: "Ej: Frijoles", nota: "va incluido" },
  { key: "proteinas", titulo: "Proteínas", icono: "🍗", ph: "Ej: Pechuga", conFoto: true },
  { key: "huevos", titulo: "Huevos", icono: "🍳", ph: "Ej: Revueltos" },
  { key: "adicionales", titulo: "Adicional", icono: "➕", ph: "Ej: Porción de arroz", conPrecio: true },
  {
    key: "especiales",
    titulo: "Especiales",
    icono: "⭐",
    ph: "Ej: Bandeja paisa",
    conPrecio: true,
    conFoto: true,
  },
  {
    key: "meriendas",
    titulo: "Meriendas",
    icono: "🥟",
    ph: "Ej: Empanada",
    nota: "siempre disponible",
    conPrecio: true,
    siempre: true,
  },
];

export const CLAVES = SECCIONES.map((s) => s.key);

/** Secciones que se ofrecen todos los días, sin pasar por el menú de hoy. */
export const CLAVES_SIEMPRE = SECCIONES.filter((s) => s.siempre).map((s) => s.key);

/** Secciones que sí se marcan cada mañana. */
export const CLAVES_DIARIAS = SECCIONES.filter((s) => !s.siempre).map((s) => s.key);

/** El catálogo completo: lo que el restaurante sabe hacer. */
export const MENU_ID = "fijo";

/** La disponibilidad de un día concreto, dentro de la misma colección. */
export const idDiario = (fecha) => `dia-${fecha}`;

export const MENU_VACIO = Object.fromEntries(CLAVES.map((k) => [k, []]));

const vacioEn = (m, claves) =>
  claves.every((k) => !Array.isArray(m?.[k]) || m[k].length === 0);

export const menuVacio = (m) => vacioEn(m, CLAVES);

/** ¿Está sin armar el menú de hoy? Las meriendas no cuentan: van siempre. */
export const diarioVacio = (m) => vacioEn(m, CLAVES_DIARIAS);

/**
 * Las presentaciones de un plato del catálogo.
 *
 * Un mismo arroz con pollo se sirve con aguacate, con plátano o solo: es el
 * mismo plato, no tres. Cada presentación guarda su foto y, si hace falta, su
 * propio precio.
 *
 * Las filas viejas traían una sola `foto` suelta: se leen como una
 * presentación sin nombre, para no perder nada de lo ya subido.
 *
 * @returns {{id,nombre,foto,precio}[]}
 */
export function presentacionesDe(fila) {
  const lista = (fila?.presentaciones || []).filter((p) => p && (p.foto || p.nombre?.trim()));
  if (lista.length)
    return lista.map((p) => ({
      id: p.id || "",
      nombre: (p.nombre || "").trim(),
      foto: p.foto || "",
      precio: Number(p.precio) || 0,
    }));

  return fila?.foto ? [{ id: "base", nombre: "", foto: fila.foto, precio: 0 }] : [];
}

/** La foto que representa al plato en las listas. */
export const fotoDe = (fila) => presentacionesDe(fila)[0]?.foto || "";

/** Solo las filas que alcanzaron a tener nombre. */
export const conNombre = (arr) => (arr || []).filter((x) => x?.nombre?.trim());

/**
 * Deja del catálogo únicamente lo marcado como disponible hoy.
 *
 * Las meriendas son la excepción: son fijas, se ofrecen siempre, así que
 * pasan completas del catálogo al talonario sin que nadie las marque.
 *
 * Si no se marcó nada del resto, devuelve el catálogo completo: es preferible
 * que el mesero pueda trabajar a que el talonario lo deje parado en plena
 * mañana.
 *
 * @returns {{menu: object, sinSeleccion: boolean}}
 */
export function menuDelDia(fijo, diario) {
  const sinSeleccion = diarioVacio(diario);

  const menu = Object.fromEntries(
    CLAVES.map((k) => {
      const todo = fijo?.[k] || [];
      if (sinSeleccion || CLAVES_SIEMPRE.includes(k)) return [k, todo];
      const activos = new Set(diario?.[k] || []);
      return [k, todo.filter((f) => activos.has(f.id))];
    })
  );

  return { menu, sinSeleccion };
}
