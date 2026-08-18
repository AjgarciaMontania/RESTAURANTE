/** Secciones del menú, en el orden en que se arma el plato. */
export const SECCIONES = [
  { key: "caldos", titulo: "Caldos", icono: "🍲", ph: "Ej: Pescado", nota: "desayuno" },
  { key: "sopas", titulo: "Sopas", icono: "🥣", ph: "Ej: Verduras", nota: "almuerzo" },
  { key: "principios", titulo: "Principios", icono: "🫘", ph: "Ej: Frijoles", nota: "va incluido" },
  { key: "proteinas", titulo: "Proteínas", icono: "🍗", ph: "Ej: Pechuga" },
  { key: "huevos", titulo: "Huevos", icono: "🍳", ph: "Ej: Revueltos" },
  { key: "adicionales", titulo: "Adicional", icono: "➕", ph: "Ej: Porción de arroz", conPrecio: true },
  { key: "especiales", titulo: "Especiales", icono: "⭐", ph: "Ej: Bandeja paisa", conPrecio: true },
];

export const CLAVES = SECCIONES.map((s) => s.key);

/** El catálogo completo: lo que el restaurante sabe hacer. */
export const MENU_ID = "fijo";

/** La disponibilidad de un día concreto, dentro de la misma colección. */
export const idDiario = (fecha) => `dia-${fecha}`;

export const MENU_VACIO = Object.fromEntries(CLAVES.map((k) => [k, []]));

export const menuVacio = (m) =>
  CLAVES.every((k) => !Array.isArray(m?.[k]) || m[k].length === 0);

/** Solo las filas que alcanzaron a tener nombre. */
export const conNombre = (arr) => (arr || []).filter((x) => x?.nombre?.trim());

/**
 * Deja del catálogo únicamente lo marcado como disponible hoy.
 *
 * Si no se marcó nada, devuelve el catálogo completo: es preferible que el
 * mesero pueda trabajar a que el talonario lo deje parado en plena mañana.
 *
 * @returns {{menu: object, sinSeleccion: boolean}}
 */
export function menuDelDia(fijo, diario) {
  const sinSeleccion = menuVacio(diario);
  if (sinSeleccion) return { menu: fijo, sinSeleccion: true };

  const menu = Object.fromEntries(
    CLAVES.map((k) => {
      const activos = new Set(diario?.[k] || []);
      return [k, (fijo?.[k] || []).filter((f) => activos.has(f.id))];
    })
  );
  return { menu, sinSeleccion: false };
}
