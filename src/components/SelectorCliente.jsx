import { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Elegir un cliente de la lista, o registrarlo al vuelo si es nuevo.
 * Se usa al liquidar un pedido que queda debiendo.
 */
export default function SelectorCliente({ clientes, valor, onElegir }) {
  const [busca, setBusca] = useState("");
  const [tel, setTel] = useState("");
  const [guardando, setGuardando] = useState(false);

  const coincidencias = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return clientes.slice(0, 6);
    return clientes.filter((c) => c.nombre.toLowerCase().includes(t)).slice(0, 6);
  }, [clientes, busca]);

  if (valor)
    return (
      <div className="row">
        <div style={{ flex: 1 }}>
          <b>{valor.nombre}</b>
          <div className="muted" style={{ fontSize: 13 }}>
            {valor.telefono || "⚠️ sin celular, no se le podrá avisar"}
          </div>
        </div>
        <button className="btn chico" onClick={() => onElegir(null)}>
          Cambiar
        </button>
      </div>
    );

  const registrar = async () => {
    const nombre = busca.trim();
    if (!nombre || guardando) return;
    setGuardando(true);
    try {
      const ref = await addDoc(collection(db, "clientes"), {
        nombre,
        telefono: tel.trim(),
        cedula: "",
        creado: serverTimestamp(),
      });
      onElegir({ id: ref.id, nombre, telefono: tel.trim() });
      setBusca("");
      setTel("");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <input
        type="text"
        placeholder="Buscar o escribir el nombre del cliente"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {coincidencias.length > 0 && (
        <div className="chips" style={{ marginTop: 8 }}>
          {coincidencias.map((c) => (
            <button key={c.id} className="chip" onClick={() => onElegir(c)}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {busca.trim() && coincidencias.length === 0 && (
        <>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="Celular, para avisarle por WhatsApp"
            value={tel}
            onChange={(e) => setTel(e.target.value)}
            style={{ marginTop: 8 }}
          />
          <button className="btn ghost block" style={{ marginTop: 8 }} onClick={registrar}>
            + Registrar «{busca.trim()}»
          </button>
        </>
      )}
    </>
  );
}
