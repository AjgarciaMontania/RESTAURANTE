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
  almuerzoNormal: 10000,
  almuerzoNormalFijo: true,
  almuerzoEspecial: 13000,
  almuerzoEspecialFijo: true,
  soloCaldo: 5000,
  soloCaldoFijo: true,
  soloSeco: 8000,
  soloSecoFijo: true,
};

export const money = (n) =>
  "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");

export const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * Construye la línea del talonario a partir de lo seleccionado del menú.
 * @returns {{tipo,descripcion,precioUnit,fijo}|null}
 */
export function armarLinea({ caldo, proteinas, especial, precios }) {
  const p = { ...PRECIOS_DEF, ...precios };
  const nombresProt = proteinas.map((x) => x.nombre).filter(Boolean);
  const hayCaldo = !!caldo;
  const hayProt = nombresProt.length > 0;

  if (!hayCaldo && !hayProt) return null;

  // Combinado -> un solo almuerzo
  if (hayCaldo && hayProt) {
    return {
      tipo: especial ? "almuerzo_especial" : "almuerzo_normal",
      descripcion: `CALDO DE ${caldo.nombre.toUpperCase()} + ${nombresProt
        .join(", ")
        .toUpperCase()}`,
      precioUnit: especial ? p.almuerzoEspecial : p.almuerzoNormal,
      fijo: especial ? p.almuerzoEspecialFijo : p.almuerzoNormalFijo,
    };
  }

  // Solo caldo (si el caldo trae precio propio en el menú, ese manda)
  if (hayCaldo) {
    const propio = Number(caldo.precio) > 0 ? Number(caldo.precio) : null;
    return {
      tipo: "solo_caldo",
      descripcion: `CALDO DE ${caldo.nombre.toUpperCase()}`,
      precioUnit: propio ?? p.soloCaldo,
      fijo: propio ? true : p.soloCaldoFijo,
    };
  }

  // Solo seco
  const propio =
    proteinas.length === 1 && Number(proteinas[0].precio) > 0
      ? Number(proteinas[0].precio)
      : null;
  return {
    tipo: "solo_seco",
    descripcion: `SECO: ${nombresProt.join(", ").toUpperCase()}`,
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
};

/** ¿La línea cuenta como almuerzo vendido? */
export const esAlmuerzo = (tipo) =>
  tipo === "almuerzo_normal" || tipo === "almuerzo_especial";

export const totalLineas = (items) =>
  items.reduce((s, i) => s + i.cant * i.precioUnit, 0);
