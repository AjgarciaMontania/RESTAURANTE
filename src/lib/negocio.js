/**
 * Reglas de cobro del restaurante.
 *
 *  - Caldo + proteína(s)  -> UN solo almuerzo (precio normal o especial)
 *  - Solo caldo           -> se cobra aparte
 *  - Solo proteína (seco) -> se cobra aparte
 *  - Adicional / Especial  -> línea propia con su precio
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

/** Quita el "huevo/huevos" del nombre para no repetirlo: "HUEVOS: HUEVOS FRITOS". */
const soloPreparacion = (n) =>
  n.trim().replace(/^huevos?\s+(al\s+|a\s+la\s+|de\s+|con\s+)?/i, "").trim() || n.trim();

/**
 * Construye la línea del talonario a partir de lo seleccionado del menú.
 *
 * Los huevos se cobran como una proteína más, pero en la descripción van
 * aparte y con su rótulo: en la cocina, leer "RANCHEROS" suelto se presta
 * para confusiones.
 *
 * @returns {{tipo,descripcion,huevos,precioUnit,fijo}|null}
 */
export function armarLinea({ caldo, proteinas = [], huevos = [], especial, precios }) {
  const p = { ...PRECIOS_DEF, ...precios };
  const nombresProt = proteinas.map((x) => x.nombre).filter(Boolean);
  const nombresHuevo = huevos.map((x) => x.nombre).filter(Boolean);

  const hayCaldo = !!caldo;
  const hayProt = nombresProt.length > 0;
  const hayHuevo = nombresHuevo.length > 0;

  if (!hayCaldo && !hayProt && !hayHuevo) return null;

  const txtCaldo = hayCaldo ? `CALDO DE ${caldo.nombre.toUpperCase()}` : "";
  const txtProt = nombresProt.join(", ").toUpperCase();
  const txtHuevo = hayHuevo
    ? `HUEVOS: ${nombresHuevo.map(soloPreparacion).join(", ").toUpperCase()}`
    : "";

  /** Todas las proteínas juntas, para decidir el precio. */
  const todas = [...proteinas, ...huevos];

  // Caldo + algo -> UN solo almuerzo
  if (hayCaldo && (hayProt || hayHuevo)) {
    return {
      tipo: especial ? "almuerzo_especial" : "almuerzo_normal",
      descripcion: [txtCaldo, txtProt, txtHuevo].filter(Boolean).join(" + "),
      huevos: txtHuevo,
      precioUnit: especial ? p.almuerzoEspecial : p.almuerzoNormal,
      fijo: especial ? p.almuerzoEspecialFijo : p.almuerzoNormalFijo,
    };
  }

  // Solo caldo (si el caldo trae precio propio en el menú, ese manda)
  if (hayCaldo) {
    const propio = Number(caldo.precio) > 0 ? Number(caldo.precio) : null;
    return {
      tipo: "solo_caldo",
      descripcion: txtCaldo,
      huevos: "",
      precioUnit: propio ?? p.soloCaldo,
      fijo: propio ? true : p.soloCaldoFijo,
    };
  }

  // Sin caldo: el seco, los huevos, o ambos
  const propio =
    todas.length === 1 && Number(todas[0].precio) > 0 ? Number(todas[0].precio) : null;

  return {
    tipo: "solo_seco",
    descripcion: [hayProt ? `SECO: ${txtProt}` : "", txtHuevo].filter(Boolean).join(" + "),
    huevos: txtHuevo,
    precioUnit: propio ?? p.soloSeco,
    fijo: propio ? true : p.soloSecoFijo,
  };
}

/** Etiquetas legibles por tipo de línea, usadas en el cierre de caja */
export const ETIQUETA_TIPO = {
  almuerzo_normal: "Almuerzos normales",
  almuerzo_especial: "Almuerzos especiales",
  solo_caldo: "Solo caldo",
  solo_seco: "Solo seco",
  adicional: "Adicionales",
  especial: "Especiales",
  huevo: "Huevos",
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
