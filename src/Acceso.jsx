import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, hashPin } from "./firebase";

const CLAVE_LOCAL = "restaurante.acceso";
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

/**
 * Puerta de entrada. Si no hay PIN configurado deja pasar directo, para que
 * el dueño pueda entrar la primera vez y ponerlo desde Ajustes.
 *
 * El PIN se guarda hasheado (nunca en texto plano) y el dispositivo queda
 * recordado: en el TV se digita una sola vez y no vuelve a pedirlo.
 */
export default function Acceso({ children }) {
  const [hashGuardado, setHashGuardado] = useState(undefined); // undefined = cargando
  const [autorizado, setAutorizado] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [sacudir, setSacudir] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "config", "acceso"),
        (s) => setHashGuardado(s.exists() ? s.data().pinHash || null : null),
        () => setHashGuardado(null)
      ),
    []
  );

  // ¿Este dispositivo ya fue autorizado con el PIN vigente?
  useEffect(() => {
    if (hashGuardado === undefined) return;
    if (!hashGuardado) return setAutorizado(true);
    setAutorizado(localStorage.getItem(CLAVE_LOCAL) === hashGuardado);
  }, [hashGuardado]);

  const marcar = async (nuevo) => {
    setPin(nuevo);
    setError("");
    if (nuevo.length < 4) return;

    if ((await hashPin(nuevo)) === hashGuardado) {
      localStorage.setItem(CLAVE_LOCAL, hashGuardado);
      setAutorizado(true);
    } else {
      setError("PIN incorrecto");
      setSacudir(true);
      setTimeout(() => {
        setSacudir(false);
        setPin("");
      }, 400);
    }
  };

  const tecla = (t) => {
    if (t === "⌫") return marcar(pin.slice(0, -1));
    if (t && pin.length < 4) marcar(pin + t);
  };

  if (hashGuardado === undefined)
    return <div className="acceso"><div className="caja"><p style={{ margin: 0 }}>Cargando…</p></div></div>;

  if (autorizado) return children;

  return (
    <div className={"acceso" + (sacudir ? " error" : "")}>
      <div className="caja">
        <div className="marca">🍽️</div>
        <h1>RESTAURANTE</h1>
        <p>Digita el PIN para entrar</p>

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
    </div>
  );
}
