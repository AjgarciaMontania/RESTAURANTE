import { useEffect, useState } from "react";

/** Sello de la compilación que está corriendo ahora mismo. */
export const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "dev";

const CADA = 90_000; // cada minuto y medio

/**
 * Mantiene la pantalla al día sin que nadie la recargue a mano.
 *
 * El TV de la cocina queda prendido todo el día y su navegador se aferra a la
 * versión que cargó al principio. Esto revisa cada tanto si ya se publicó una
 * versión nueva y, si es así, recarga la página una sola vez.
 */
export function useAutoActualizar() {
  useEffect(() => {
    if (VERSION === "dev") return;

    let vivo = true;

    const revisar = async () => {
      try {
        const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`;
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return;
        const { v } = await r.json();
        if (!vivo || !v || v === VERSION) return;

        // Una sola recarga por versión, para no caer en un ciclo si algo falla
        const ya = sessionStorage.getItem("restaurante.recargado");
        if (ya === v) return;
        sessionStorage.setItem("restaurante.recargado", v);
        location.reload();
      } catch {
        /* sin conexión: se reintenta en la próxima vuelta */
      }
    };

    revisar();
    const t = setInterval(revisar, CADA);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);
}

/** Muestra el sello, para comparar de un vistazo qué versión tiene cada equipo. */
export function useVersionCorta() {
  const [v] = useState(() => (VERSION === "dev" ? "dev" : VERSION.slice(0, 7)));
  return v;
}
