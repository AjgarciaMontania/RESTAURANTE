import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { COMBOS_ID, sinCombo } from "../lib/combos";
import CampoFoto from "./CampoFoto.jsx";
import MiniFoto from "./MiniFoto.jsx";

/**
 * Las fotos de combinaciones que la app fue aprendiendo.
 *
 * No se arman aquí: se guardan solas al publicar un plato en la Carta con su
 * foto. Esta lista existe para verlas todas juntas, cambiarles la imagen
 * cuando la comida se vea mejor otro día, o borrar la que quedó mal.
 */
export default function Combinaciones() {
  const [lista, setLista] = useState([]);
  const [abierta, setAbierta] = useState("");

  useEffect(
    () =>
      onSnapshot(doc(db, "menus", COMBOS_ID), (s) =>
        setLista(s.exists() ? s.data().lista || [] : [])
      ),
    []
  );

  const guardar = async (siguiente) => {
    setLista(siguiente);
    try {
      await setDoc(doc(db, "menus", COMBOS_ID), { lista: siguiente }, { merge: true });
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar. Revisa la conexión.");
    }
  };

  const cambiarFoto = (clave, foto) =>
    guardar(lista.map((c) => (c.clave === clave ? { ...c, foto } : c)));

  const borrar = (c) => {
    if (!confirm(`¿Olvidar la foto de "${c.nombre}"?`)) return;
    guardar(sinCombo(lista, c.clave));
    setAbierta("");
  };

  return (
    <div className="card">
      <h2>
        🍽️ Combinaciones con foto
        <span className="count">{lista.length}</span>
      </h2>

      <p className="muted" style={{ margin: "-4px 0 10px", fontSize: 12 }}>
        La foto del plato servido, no del ingrediente. Se guardan solas cuando
        publicas un plato con foto en <b>Carta</b>, y desde ahí en adelante esa mezcla
        sale con su imagen sin que tengas que buscarla.
      </p>

      {lista.length === 0 ? (
        <p className="empty">
          Todavía ninguna.
          <br />
          Arma un plato en <b>Carta</b>, súbele la foto y queda aprendida.
        </p>
      ) : (
        lista.map((c) => (
          <div key={c.clave}>
            <div className="row">
              <button
                className={"btn icon foto" + (c.foto ? " puesta" : "")}
                aria-label="Cambiar la foto"
                onClick={() => setAbierta(abierta === c.clave ? "" : c.clave)}
              >
                {c.foto ? <MiniFoto id={c.foto} className="mini-fila" /> : "📷"}
              </button>

              <div className="combo-texto">{c.nombre || "Sin nombre"}</div>

              <button
                className="btn icon del"
                aria-label="Olvidar esta combinación"
                onClick={() => borrar(c)}
              >
                ✕
              </button>
            </div>

            {abierta === c.clave && (
              <CampoFoto
                id={c.foto || ""}
                titulo={c.nombre || "Foto de la combinación"}
                pista="Sale sola cada vez que se arme esta mezcla"
                onCambio={(idFoto) => cambiarFoto(c.clave, idFoto)}
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}
