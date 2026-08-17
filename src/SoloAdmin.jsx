import { useState } from "react";
import { useAdmin } from "./lib/admin.jsx";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

/** Envuelve las pantallas que solo puede abrir el administrador. */
export default function SoloAdmin({ titulo, children }) {
  const { cargando, esAdmin, entrar } = useAdmin();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [sacudir, setSacudir] = useState(false);

  if (cargando) return <p className="empty">Cargando…</p>;
  if (esAdmin) return children;

  const marcar = async (nuevo) => {
    setPin(nuevo);
    setError("");
    if (nuevo.length < 4) return;

    if (await entrar(nuevo)) return;

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

  return (
    <div className={"card bloqueo" + (sacudir ? " error" : "")}>
      <div className="candado">🔒</div>
      <h3>{titulo}</h3>
      <p>Esta sección es solo del administrador</p>

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
}
