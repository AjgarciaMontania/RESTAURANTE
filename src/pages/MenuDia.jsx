import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db, hoy } from "../firebase";

/** El menú es uno solo y queda fijo: no hay que rehacerlo cada día. */
export const MENU_ID = "fijo";

const VACIO = {
  caldos: [],
  sopas: [],
  principios: [],
  proteinas: [],
  huevos: [],
  adicionales: [],
  especiales: [],
};
const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * Secciones del menú.
 *
 * En todas se puede escribir un precio. Donde es `opcional`, dejarlo vacío
 * hace que mande el precio base de Ajustes; en Huevos, además, un precio en
 * blanco significa que va incluido y solo es una indicación para la cocina.
 */
const SECCIONES = [
  { key: "caldos", titulo: "Caldos", icono: "🍲", ph: "Ej: Pescado", precioPh: "$ opcional" },
  { key: "sopas", titulo: "Sopas", icono: "🥣", ph: "Ej: Verduras", precioPh: "$ opcional" },
  { key: "principios", titulo: "Principios", icono: "🫘", ph: "Ej: Frijoles", precioPh: "$ opcional" },
  { key: "proteinas", titulo: "Proteínas", icono: "🍗", ph: "Ej: Pechuga", precioPh: "$ opcional" },
  { key: "huevos", titulo: "Huevos", icono: "🍳", ph: "Ej: Revueltos", precioPh: "$ opcional" },
  { key: "adicionales", titulo: "Adicional", icono: "➕", ph: "Ej: Porción de arroz", precioPh: "$" },
  { key: "especiales", titulo: "Especiales", icono: "⭐", ph: "Ej: Bandeja paisa", precioPh: "$" },
];

const vacio = (m) => Object.values(m).every((v) => !Array.isArray(v) || v.length === 0);

export default function MenuDia() {
  const [menu, setMenu] = useState(VACIO);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setCargando(false), 5000);
    const off = onSnapshot(
      doc(db, "menus", MENU_ID),
      async (snap) => {
        if (snap.exists() && !vacio(snap.data())) {
          setMenu({ ...VACIO, ...snap.data() });
        } else {
          // Primera vez con el menú fijo: se hereda el del día para no
          // tener que volver a escribirlo todo.
          const delDia = await getDoc(doc(db, "menus", hoy())).catch(() => null);
          if (delDia?.exists() && !vacio(delDia.data())) {
            const heredado = { ...VACIO, ...delDia.data() };
            delete heredado.fecha;
            setMenu(heredado);
            await setDoc(doc(db, "menus", MENU_ID), heredado, { merge: true });
          } else {
            setMenu(VACIO);
          }
        }
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
  }, []);

  const guardar = async (siguiente) => {
    setMenu(siguiente);
    try {
      await setDoc(doc(db, "menus", MENU_ID), siguiente, { merge: true });
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

  if (cargando) return <p className="empty">Cargando menú…</p>;

  return (
    <>
      <div className="card">
        <h2>📖 Menú de la casa</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Este menú queda fijo: se escribe una vez y ahí se queda, día tras día. Todo
          se guarda solo mientras escribes. Cámbialo cuando cambie tu carta.
        </p>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
          El <b>caldo</b> es del desayuno y la <b>sopa</b> del almuerzo: cumplen el mismo
          papel y se cobran igual, pero no se piden juntos. Los <b>Huevos</b> cuentan como
          una proteína más, y el <b>principio</b> (frijoles, alverjas, macarrones) va
          incluido en el plato sin sumar nada.
          El precio de cada fila es opcional y solo manda cuando el plato va solo.
        </p>
      </div>

      <div className="grid-2">
        {SECCIONES.map((s) => (
          <div className="card" key={s.key}>
            <h2>
              {s.icono} {s.titulo}
              <span className="count">{menu[s.key].length}</span>
            </h2>

            {menu[s.key].length === 0 && <p className="empty">Sin filas todavía</p>}

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
        onClick={() => {
          setToast("Menú guardado ✓");
          setTimeout(() => setToast(""), 1800);
        }}
        style={{ marginBottom: 20 }}
      >
        Listo
      </button>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
