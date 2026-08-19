/**
 * Reglas de cobro del restaurante.
 *
 *  - Caldo + proteína(s)  -> UN solo almuerzo (precio normal o especial)
 *  - Solo caldo           -> se cobra aparte
 *  - Solo proteína (seco) -> se cobra aparte
 *  - Adicional / Especial  -> línea propia con su precio
 *  - Merienda             -> línea propia con su precio, nunca entra al almuerzo
 *
 * Cada precio base tiene un interruptor "fijo":
 *   fijo = true  -> el precio queda bloqueado al tomar el pedido
 *   fijo = false -> el mesero puede digitarlo/cambiarlo en la línea
 */

export const PRECIOS_DEF = {
  // Campos opcionales del talonario. Cada uno se prende o apaga en Ajustes.
  /** Casilla de número de mesa. */
  usarMesas: true,
  /** Casilla de nombre del cliente. */
  usarCliente: false,
  /** Botón para marcar que la comida se empaca para llevar. */
  usarParaLlevar: true,
  /**
   * Minutos tras los cuales la comanda se marca sola como entregada y sale
   * del TV, para que la pantalla no se llene. 0 = nunca, solo a mano.
   */
  autoEntregarMin: 30,
  /** Permite marcar un pedido como fiado y llevar la cuenta del cliente. */
  usarFiados: true,
  /** Aparece al final de los mensajes de WhatsApp. */
  nombreNegocio: "Restaurante",
  almuerzoNormal: 10000,
  almuerzoNormalFijo: true,
  almuerzoEspecial: 13000,
  almuerzoEspecialFijo: true,
  soloCaldo: 5000,
  soloCaldoFijo: true,
  soloSeco: 8000,
  soloSecoFijo: true,
  /**
   * Empaque de "para llevar". Se cobra uno por recipiente: el almuerzo
   * completo son dos (el caldo o la sopa aparte del seco) y lo individual uno.
   */
  cobrarDesechable: true,
  desechable: 1000,
  desechableFijo: true,
};

/**
 * Zona horaria del restaurante.
 *
 * Se fija a propósito: si un celular o un TV Box tiene mal la hora o la zona,
 * la app seguiría mostrando la hora de Colombia y, sobre todo, los pedidos
 * seguirían cayendo en el día correcto.
 */
export const ZONA = "America/Bogota";

export const money = (n) =>
  "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");

export const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * Deja de un ítem del menú solo lo necesario para volver a armar el plato.
 *
 * Se guarda con el pedido para poder repetirlo o corregirlo después. Los
 * campos van siempre presentes porque Firestore no acepta `undefined`.
 */
export const soloDatos = (x) =>
  x ? { id: x.id ?? "", nombre: x.nombre ?? "", precio: Number(x.precio) || 0 } : null;

/** La receta de un renglón, para poder rearmarlo en el talonario. */
export const receta = ({ caldo, sopa, principio, proteinas = [], huevos = [], especial }) => ({
  caldo: soloDatos(caldo),
  sopa: soloDatos(sopa),
  principio: soloDatos(principio),
  proteinas: proteinas.map(soloDatos),
  huevos: huevos.map(soloDatos),
  especial: !!especial,
});

/**
 * Quita del nombre la palabra que el rótulo ya dice, para no repetirla:
 * "HUEVOS: HUEVOS FRITOS" o "SOPA DE SOPA DE VERDURAS".
 */
const sinPrefijo = (n, re) => n.trim().replace(re, "").trim() || n.trim();

export const soloPreparacion = (n) =>
  sinPrefijo(n, /^huevos?\s+(al\s+|a\s+la\s+|de\s+|con\s+)?/i);

export const soloSabor = (n) => sinPrefijo(n, /^(sopa|caldo|consom[eé])\s*(de\s+)?/i);

export const soloPrincipio = (n) => sinPrefijo(n, /^principio\s*(de\s+)?/i);

/**
 * Construye la línea del talonario a partir de lo seleccionado del menú.
 *
 * Los huevos se cobran como una proteína más, pero en la descripción van
 * aparte y con su rótulo: en la cocina, leer "RANCHEROS" suelto se presta
 * para confusiones.
 *
 * @returns {{tipo,descripcion,huevos,precioUnit,fijo}|null}
 */
export function armarLinea({
  caldo,
  sopa,
  principio,
  proteinas = [],
  huevos = [],
  especial,
  precios,
}) {
  const p = { ...PRECIOS_DEF, ...precios };

  // Caldo y sopa cumplen el mismo papel: el caldo es de desayuno y la sopa de
  // almuerzo, pero se cobran igual. Son excluyentes entre sí.
  const liquido = caldo || sopa || null;
  const esSopa = !caldo && !!sopa;

  const nombresProt = proteinas.map((x) => x.nombre).filter(Boolean);
  const nombresHuevo = huevos.map((x) => x.nombre).filter(Boolean);

  const hayLiquido = !!liquido;
  const hayProt = nombresProt.length > 0;
  const hayHuevo = nombresHuevo.length > 0;
  const hayPrincipio = !!principio?.nombre;

  if (!hayLiquido && !hayProt && !hayHuevo && !hayPrincipio) return null;

  const txtLiquido = hayLiquido
    ? `${esSopa ? "SOPA" : "CALDO"} DE ${soloSabor(liquido.nombre).toUpperCase()}`
    : "";
  const txtProt = nombresProt.join(", ").toUpperCase();
  const txtPrincipio = hayPrincipio
    ? `PRINCIPIO: ${soloPrincipio(principio.nombre).toUpperCase()}`
    : "";
  const txtHuevo = hayHuevo
    ? `HUEVOS: ${nombresHuevo.map(soloPreparacion).join(", ").toUpperCase()}`
    : "";

  /** El principio y los huevos hacen parte del plato, no se cobran aparte. */
  const acompanan = [...proteinas, ...huevos, ...(hayPrincipio ? [principio] : [])];
  const hayAcompanamiento = hayProt || hayHuevo || hayPrincipio;

  // Líquido + algo -> UN solo almuerzo
  if (hayLiquido && hayAcompanamiento) {
    return {
      tipo: especial ? "almuerzo_especial" : "almuerzo_normal",
      descripcion: [txtLiquido, txtProt, txtPrincipio, txtHuevo].filter(Boolean).join(" + "),
      principio: txtPrincipio,
      huevos: txtHuevo,
      precioUnit: especial ? p.almuerzoEspecial : p.almuerzoNormal,
      fijo: especial ? p.almuerzoEspecialFijo : p.almuerzoNormalFijo,
    };
  }

  // Solo el líquido (si trae precio propio en el menú, ese manda)
  if (hayLiquido) {
    const propio = Number(liquido.precio) > 0 ? Number(liquido.precio) : null;
    return {
      tipo: esSopa ? "solo_sopa" : "solo_caldo",
      descripcion: txtLiquido,
      principio: "",
      huevos: "",
      precioUnit: propio ?? p.soloCaldo,
      fijo: propio ? true : p.soloCaldoFijo,
    };
  }

  // Sin líquido: el seco, con lo que lo acompañe
  const propio =
    acompanan.length === 1 && Number(acompanan[0].precio) > 0
      ? Number(acompanan[0].precio)
      : null;

  return {
    tipo: "solo_seco",
    descripcion: [hayProt ? `SECO: ${txtProt}` : "", txtPrincipio, txtHuevo]
      .filter(Boolean)
      .join(" + "),
    principio: txtPrincipio,
    huevos: txtHuevo,
    precioUnit: propio ?? p.soloSeco,
    fijo: propio ? true : p.soloSecoFijo,
  };
}

export const TIPO_DESECHABLE = "desechable";

/**
 * Cuántos recipientes necesita cada renglón cuando el pedido va para llevar.
 *
 * El almuerzo va en dos: el caldo o la sopa no se puede echar encima del seco.
 * Los huevos y el principio viajan dentro del mismo plato, así que no suman.
 * Las meriendas y los adicionales van en bolsa y no cobran empaque.
 */
export const EMPAQUES = {
  almuerzo_normal: 2,
  almuerzo_especial: 2,
  solo_caldo: 1,
  solo_sopa: 1,
  solo_seco: 1,
  especial: 1,
  huevo: 0,
  adicional: 0,
  merienda: 0,
  desechable: 0,
};

export const empaquesDe = (i) => (EMPAQUES[i?.tipo] ?? 0) * (Number(i?.cant) || 0);

export const empaquesPedido = (items = []) => items.reduce((s, i) => s + empaquesDe(i), 0);

/**
 * El renglón de desechables del pedido, o null si no aplica.
 *
 * Va como una línea más para que quede el registro de cuánto entró por
 * empaques, y para que el cliente vea por qué paga de más.
 */
export function lineaDesechables(items, paraLlevar, precios) {
  const p = { ...PRECIOS_DEF, ...precios };
  if (!paraLlevar || !p.cobrarDesechable) return null;

  const cant = empaquesPedido(items);
  if (cant <= 0) return null;

  return {
    tipo: TIPO_DESECHABLE,
    descripcion: "DESECHABLES",
    cant,
    precioUnit: Number(p.desechable) || 0,
    fijo: !!p.desechableFijo,
  };
}

/** Etiquetas legibles por tipo de línea, usadas en el cierre de caja */
export const ETIQUETA_TIPO = {
  almuerzo_normal: "Almuerzos normales",
  almuerzo_especial: "Almuerzos especiales",
  solo_caldo: "Solo caldo",
  solo_sopa: "Solo sopa",
  solo_seco: "Solo seco",
  adicional: "Adicionales",
  especial: "Especiales",
  huevo: "Huevos",
  merienda: "Meriendas",
  desechable: "Desechables",
};

/** ¿La línea cuenta como almuerzo vendido? */
export const esAlmuerzo = (tipo) =>
  tipo === "almuerzo_normal" || tipo === "almuerzo_especial";

/**
 * Estado de cobro de un pedido.
 *
 * Un pedido nace "porCobrar": se sirve primero y se liquida cuando el cliente
 * termina. Los pedidos viejos, de antes de que existiera el cobro aparte, se
 * dan por pagados para no dañar el historial.
 */
export function estadoPago(p) {
  if (p.pago) return p.pago;
  if (p.fiado) return "fiado";
  return "pagado";
}

/** Lo que efectivamente entró a la caja por este pedido. */
export function entroACaja(p) {
  const e = estadoPago(p);
  if (e === "pagado") return p.total || 0;
  if (e === "parcial") return p.abonado || 0;
  return 0;
}

/** Lo que quedó debiendo este pedido. */
export function quedoDebiendo(p) {
  const e = estadoPago(p);
  if (e === "fiado") return p.total || 0;
  if (e === "parcial") return Math.max(0, (p.total || 0) - (p.abonado || 0));
  return 0;
}

export const totalLineas = (items) =>
  items.reduce((s, i) => s + i.cant * i.precioUnit, 0);

/**
 * La única categoría que no se abre: todos sus renglones se llaman igual,
 * así que el detalle repetiría la misma línea del total.
 */
const SIN_DETALLE = new Set(["desechable"]);

/**
 * Lo vendido en el día, agrupado por categoría y detallado por producto.
 *
 * @param {object[]} pedidos  Pedidos ya filtrados (sin anulados)
 * @returns {{tipo,etiqueta,cant,total,filas:{desc,cant,total}[]}[]}
 */
export function resumenProductos(pedidos = []) {
  const cats = new Map();

  for (const p of pedidos) {
    for (const i of p.items || []) {
      const t = i.tipo || "otro";
      if (!cats.has(t))
        cats.set(t, {
          tipo: t,
          etiqueta: ETIQUETA_TIPO[t] || "Otros",
          cant: 0,
          total: 0,
          filas: new Map(),
        });

      const c = cats.get(t);
      const cant = Number(i.cant) || 0;
      const valor = cant * (Number(i.precioUnit) || 0);
      c.cant += cant;
      c.total += valor;

      if (SIN_DETALLE.has(t)) continue;

      const clave = (i.descripcion || "Sin nombre").trim();
      const fila = c.filas.get(clave) || { desc: clave, cant: 0, total: 0 };
      fila.cant += cant;
      fila.total += valor;
      c.filas.set(clave, fila);
    }
  }

  return [...cats.values()]
    .map((c) => ({ ...c, filas: [...c.filas.values()].sort((a, b) => b.total - a.total) }))
    .sort((a, b) => b.total - a.total);
}
