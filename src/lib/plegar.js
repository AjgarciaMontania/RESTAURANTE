import { useState } from "react";
import { recordar } from "../firebase";

const PREFIJO = "restaurante.plegado.";

/**
 * Recuerda en este equipo si una sección quedó abierta o cerrada.
 *
 * Cada mesero trabaja distinto: el que vende muchas meriendas las quiere
 * siempre a la vista y el que casi no las usa prefiere no verlas. En vez de
 * decidir por ellos, la app se acuerda de cómo dejó cada uno su pantalla.
 *
 * @returns {[boolean, () => void]}
 */
export function usePlegado(clave, abiertoPorDefecto = false) {
  const k = PREFIJO + clave;

  const [abierto, setAbierto] = useState(() => {
    const v = recordar.leer(k);
    return v == null ? abiertoPorDefecto : v === "1";
  });

  const alternar = () =>
    setAbierto((a) => {
      recordar.guardar(k, a ? "0" : "1");
      return !a;
    });

  return [abierto, alternar];
}

/**
 * Lo mismo, pero para varias secciones a la vez (las categorías de la caja).
 *
 * @returns {[Set<string>, (clave: string) => void]}
 */
export function useVariosPlegados(clave) {
  const k = PREFIJO + clave;

  const [abiertos, setAbiertos] = useState(
    () => new Set((recordar.leer(k) || "").split(",").filter(Boolean))
  );

  const alternar = (id) =>
    setAbiertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      recordar.guardar(k, [...n].join(","));
      return n;
    });

  return [abiertos, alternar];
}
