import {
  armarLinea,
  soloPreparacion,
  soloPrincipio,
  soloSabor,
} from "./negocio.js";

/**
 * La carta del día: los platos que se muestran al cliente en el TV.
 *
 * Un "plato" es la misma combinación del talonario (caldo o sopa, principio,
 * proteínas, huevos) más una o dos fotos. Se guarda con la fecha, así que la
 * carta de mañana amanece vacía sin borrar la de hoy.
 */

export const PLATO_VACIO = {
  caldo: null,
  sopa: null,
  principio: null,
  proteinas: [],
  huevos: [],
  /** Marcado como almuerzo especial: cambia el precio. */
  especial: false,
  /** Plato de la sección ⭐ Especiales, con su propio precio. Va solo. */
  deLaCasa: null,
  nota: "",
  fotos: [],
};

/** Los dos bloques en que se parte la carta del comedor. */
export const BLOQUES = [
  { clave: "corriente", titulo: "Menú del día" },
  { clave: "especial", titulo: "Especiales de la casa" },
];

/** Máximo de fotos por plato: la del seco y la del caldo o la sopa. */
export const MAX_FOTOS = 2;

export const ROTULOS_FOTO = [
  { titulo: "Foto del plato", pista: "El seco servido, como llega a la mesa" },
  { titulo: "Foto del caldo o la sopa", pista: "Opcional" },
];

/** ¿Tiene al menos una cosa escogida? */
export const hayPlato = (p) =>
  !!(
    p?.deLaCasa ||
    p?.caldo ||
    p?.sopa ||
    p?.principio ||
    p?.proteinas?.length ||
    p?.huevos?.length
  );

/**
 * ¿Va en el bloque de especiales?
 *
 * Cuentan los dos: el plato de la sección ⭐ Especiales y el almuerzo que se
 * marcó como Especial. Para el cliente son lo mismo: lo de más categoría.
 */
export const esEspecial = (p) => !!p?.deLaCasa || !!p?.especial;

/** Parte la carta en los dos bloques que se proyectan. */
export const separarPlatos = (platos = []) => ({
  corriente: platos.filter((p) => !esEspecial(p)),
  especial: platos.filter(esEspecial),
});

/** Mayúscula solo en la primera letra, sin gritarle al cliente. */
export const capitalizar = (t) => {
  const s = (t || "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
};

/**
 * Lo que se lee en la tarjeta del TV.
 *
 * El título es la proteína, que es lo que el cliente realmente escoge. Si el
 * plato no lleva proteína, manda el principio y, en última instancia, el
 * caldo. Lo demás baja a los renglones de detalle, cada uno con su ícono.
 *
 * @returns {{titulo: string, detalles: {ic: string, txt: string}[]}}
 */
export function resumenPlato(p) {
  // El plato de la casa se anuncia con su nombre y ya: es un plato completo.
  if (p?.deLaCasa?.nombre)
    return { titulo: capitalizar(p.deLaCasa.nombre), detalles: [] };

  const prot = (p?.proteinas || []).map((x) => capitalizar(x?.nombre)).filter(Boolean);
  const huevos = (p?.huevos || [])
    .map((x) => capitalizar(soloPreparacion(x?.nombre || "")))
    .filter(Boolean);

  const liquido = p?.caldo || p?.sopa || null;
  const esSopa = !p?.caldo && !!p?.sopa;
  const txtLiquido = liquido ? capitalizar(soloSabor(liquido.nombre || "")) : "";
  const txtPrincipio = p?.principio
    ? capitalizar(soloPrincipio(p.principio.nombre || ""))
    : "";

  const partes = [
    prot.length && { clave: "prot", ic: "🍗", txt: prot.join(" · ") },
    txtLiquido && {
      clave: "liquido",
      ic: esSopa ? "🥣" : "🍲",
      txt: `${esSopa ? "Sopa" : "Caldo"} de ${txtLiquido.toLowerCase()}`,
    },
    txtPrincipio && { clave: "principio", ic: "🫘", txt: txtPrincipio },
    huevos.length && {
      clave: "huevos",
      ic: "🍳",
      txt: `Huevos ${huevos.join(", ").toLowerCase()}`,
    },
  ].filter(Boolean);

  // El primero que exista, en este orden, es el nombre del plato; el resto
  // baja a los renglones de detalle.
  const orden = ["prot", "principio", "liquido", "huevos"];
  const clave = orden.find((k) => partes.some((x) => x.clave === k));
  const cabeza = partes.find((x) => x.clave === clave);

  return {
    titulo: cabeza?.txt || "Plato del día",
    detalles: partes.filter((x) => x !== cabeza).map(({ ic, txt }) => ({ ic, txt })),
  };
}

/**
 * Precio del plato, con las mismas reglas de cobro del talonario.
 *
 * El plato de la casa manda con su propio precio; si en el menú quedó sin
 * precio, se cobra como almuerzo especial para no anunciar un plato en $0.
 */
export function precioPlato(p, precios) {
  if (p?.deLaCasa) {
    const propio = Number(p.deLaCasa.precio) || 0;
    return propio > 0 ? propio : Number(precios?.almuerzoEspecial) || 0;
  }
  return armarLinea({ ...p, precios })?.precioUnit ?? 0;
}

/** Deja el plato listo para guardar en Firestore (sin `undefined`). */
export const limpiarPlato = (p) => ({
  deLaCasa: p.deLaCasa || null,
  caldo: p.caldo || null,
  sopa: p.sopa || null,
  principio: p.principio || null,
  proteinas: p.proteinas || [],
  huevos: p.huevos || [],
  especial: !!p.especial,
  nota: (p.nota || "").trim(),
  fotos: (p.fotos || []).filter(Boolean).slice(0, MAX_FOTOS),
});
