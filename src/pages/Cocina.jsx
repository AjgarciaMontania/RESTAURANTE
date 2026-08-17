import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db, hoy } from "../firebase";

/** Pantalla para el TV. Se abre con  .../#/cocina  en modo pantalla completa. */
export default function Cocina() {
  const [fecha, setFecha] = useState(hoy());
  const [pedidos, setPedidos] = useState([]);
  const [ahora, setAhora] = useState(Date.now());

  // Reloj + cambio automático de día a medianoche
  useEffect(() => {
    const t = setInterval(() => {
      setAhora(Date.now());
      setFecha((f) => (hoy() !== f ? hoy() : f));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "pedidos"), where("fecha", "==", fecha));
    return onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.estado === "pendiente" && !p.anulado)
        .sort((a, b) => a.numero - b.numero);
      setPedidos(list);
    });
  }, [fecha]);

  const entregar = (id) => updateDoc(doc(db, "pedidos", id), { estado: "entregado" });

  const minutos = (p) => {
    const ms = p.creado?.toMillis?.();
    return ms ? Math.floor((ahora - ms) / 60000) : 0;
  };

  const reloj = new Date(ahora).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="tv">
      <div className="tv-head">
        <h1>🍽️ COCINA</h1>
        <span className="muted" style={{ fontSize: 22 }}>
          {pedidos.length} pendiente{pedidos.length === 1 ? "" : "s"}
        </span>
        <span className="r">{reloj}</span>
      </div>

      {pedidos.length === 0 ? (
        <div className="tv-empty">
          ✅ No hay pedidos pendientes
          <br />
          <span style={{ fontSize: 20 }}>Los nuevos aparecen aquí automáticamente</span>
        </div>
      ) : (
        <div className="tv-grid">
          {pedidos.map((p) => {
            const m = minutos(p);
            return (
              <div className={"tv-card" + (m >= 15 ? " viejo" : "")} key={p.id}>
                <h3>
                  #{p.numero}
                  {p.mesa && <span className="mesa">Mesa {p.mesa}</span>}
                </h3>
                <ul>
                  {p.items.map((i, k) => (
                    <li key={k}>
                      <span className="cant">{i.cant}×</span>
                      {i.descripcion}
                    </li>
                  ))}
                </ul>
                <div className="pie">
                  <span className="t">hace {m} min</span>
                  <button className="btn primary" onClick={() => entregar(p.id)}>
                    ✓ Entregado
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
