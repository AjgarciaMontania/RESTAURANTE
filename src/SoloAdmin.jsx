import { useState } from "react";
import { useAdmin } from "./lib/admin.jsx";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

/**
 * Envuelve las pantallas del administrador.
 *
 * @param {boolean} permanente  En el TV de la cocina: recuerda el equipo para
 *                              siempre, así no se bloquea al reiniciarse.
 * @param {boolean} pantalla    Presentación a pantalla completa (TV).
 */
export default function SoloAdmin({ titulo, permanente, pantalla, children }) {
  const { cargando, esAdmin, equipoCocina, entrar } = useAdmin();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [sacudir, setSacudir] = useState(false);

  const autorizado = permanente ? esAdmin || equipoCocina : esAdmin;

  if (cargando)
    return pantalla ? <div className="tv-cargando">Cargando…</div> : <p className="empty">Cargando…</p>;
  if (autorizado) return children;

  const marcar = async (nuevo) => {
    setPin(nuevo);
    setError("");
    if (nuevo.length < 4) return;

    if (await entrar(nuevo, permanente)) return;

    setError("PIN incorrecto");
    setSacudir(true);
    setTimeout(() => {
      setSacudir(false);
      setPin("");
    }, 400);
  };

  const tecla = (t) => {
    if (t === "⌫") return marcar(pin.slice(0, -1));
    if (t && pin.length < 4) marcar(pin + t);
  };

  const caja = (
    <div className={"card bloqueo" + (sacudir ? " error" : "")}>
      <div className="candado">🔒</div>
      <h3>{titulo}</h3>
      <p>
        {permanente
          ? "Digita el PIN una sola vez. Este equipo queda autorizado."
          : "Esta sección es solo del administrador"}
      </p>

      <div className="puntos">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={"punto" + (pin.length > i ? " on" : "")} />
        ))}
      </div>

      <p className="msg">{error}</p>

      <div className="teclado">
        {TECLAS.map((t, i) => (
          <button key={i} className={t ? "" : "vacio"} disabled={!t} onClick={() => tecla(t)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );

  return pantalla ? <div className="pantalla-bloqueo">{caja}</div> : caja;
}
