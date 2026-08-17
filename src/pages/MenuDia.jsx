import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, hoy, ZONA } from "../firebase";

const VACIO = { caldos: [], proteinas: [], adicionales: [], especiales: [] };
const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * Secciones del menú.
 *  - precioPh: texto de la casilla de precio.
 *  - opcional: el precio se puede dejar en blanco y entonces manda el precio
 *    base de Ajustes. Si lo digitas, ese valor pisa al base para esa fila.
 */
const SECCIONES = [
  { key: "caldos", titulo: "Caldos", icono: "🍲", ph: "Ej: Pescado", precioPh: "$ opcional", opcional: true },
  { key: "proteinas", titulo: "Proteínas", icono: "🍗", ph: "Ej: Pechuga", precioPh: "$ opcional", opcional: true },
  { key: "adicionales", titulo: "Adicional", icono: "➕", ph: "Ej: Porción de arroz", precioPh: "$", opcional: false },
  { key: "especiales", titulo: "Especiales", icono: "⭐", ph: "Ej: Bandeja paisa", precioPh: "$", opcional: false },
];

export default function MenuDia() {
  const fecha = hoy();
  const [menu, setMenu] = useState(VACIO);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState("");

  useEffect(() => {
    // Si la conexión está lenta no dejamos la pantalla colgada en "Cargando…"
    const t = setTimeout(() => setCargando(false), 5000);
    const off = onSnapshot(
      doc(db, "menus", fecha),
      (snap) => {
        setMenu(snap.exists() ? { ...VACIO, ...snap.data() } : VACIO);
        setCargando(false);
      },
      (err) => {
        console.error(err);
        setCargando(false);
      }
    );
    return () => {
      clearTimeout(t);
      off();
    };
  }, [fecha]);

  const guardar = async (siguiente) => {
    setMenu(siguiente);
    try {
      await setDoc(doc(db, "menus", fecha), { ...siguiente, fecha }, { merge: true });
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar. Revisa la conexión.");
    }
  };

  const agregar = (key) =>
    guardar({ ...menu, [key]: [...menu[key], { id: uid(), nombre: "", precio: 0 }] });

  const editar = (key, id, campo, valor) =>
    guardar({
      ...menu,
      [key]: menu[key].map((f) => (f.id === id ? { ...f, [campo]: valor } : f)),
    });

  const borrar = (key, id) =>
    guardar({ ...menu, [key]: menu[key].filter((f) => f.id !== id) });

  const mostrarToast = (t) => {
    setToast(t);
    setTimeout(() => setToast(""), 1800);
  };

  if (cargando) return <p className="empty">Cargando menú…</p>;

  const f = new Date(fecha + "T12:00:00Z").toLocaleDateString("es-CO", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fechaLarga = f.charAt(0).toUpperCase() + f.slice(1);

  return (
    <>
      <div className="card">
        <h2>📅 Menú del día</h2>
        <div style={{ fontSize: 19, fontWeight: 700 }}>{fechaLarga}</div>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
          Todo lo que escribas aquí se guarda solo y aparece de una vez en el talonario.
          En <b>Caldos</b> y <b>Proteínas</b> el precio es opcional: déjalo vacío para usar
          el precio base de Ajustes, o digítalo para fijarlo solo en esa fila.
        </p>
      </div>

      <div className="grid-2">
        {SECCIONES.map((s) => (
          <div className="card" key={s.key}>
            <h2>
              {s.icono} {s.titulo}
              <span className="count">{menu[s.key].length}</span>
            </h2>

            {menu[s.key].length === 0 && (
              <p className="empty">Sin filas todavía</p>
            )}

            {menu[s.key].map((fila) => (
              <div className="row" key={fila.id}>
                <input
                  type="text"
                  value={fila.nombre}
                  placeholder={s.ph}
                  onChange={(e) => editar(s.key, fila.id, "nombre", e.target.value)}
                />
                <input
                  className="price-input"
                  type="number"
                  inputMode="numeric"
                  value={fila.precio || ""}
                  placeholder={s.precioPh}
                  onChange={(e) =>
                    editar(s.key, fila.id, "precio", Number(e.target.value) || 0)
                  }
                />
                <button
                  className="btn icon del"
                  onClick={() => borrar(s.key, fila.id)}
                  aria-label="Eliminar fila"
                >
                  ✕
                </button>
              </div>
            ))}

            <button className="btn block ghost" onClick={() => agregar(s.key)}>
              + Agregar fila
            </button>
          </div>
        ))}
      </div>

      <button
        className="btn primary block"
        onClick={() => mostrarToast("Menú guardado ✓")}
        style={{ marginBottom: 20 }}
      >
        Listo
      </button>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
