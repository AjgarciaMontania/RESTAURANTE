import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { ZONA, db, hoy } from "../firebase";
import {
  CLAVES_DIARIAS,
  MENU_ID,
  MENU_VACIO,
  SECCIONES,
  conNombre,
  diarioVacio,
  idDiario,
  menuVacio,
} from "../lib/menu";
import { money } from "../lib/negocio";

/** Ayer, en formato YYYY-MM-DD. */
const ayer = () => {
  const d = new Date(hoy() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const DIARIAS = SECCIONES.filter((s) => !s.siempre);
const FIJAS = SECCIONES.filter((s) => s.siempre);

/**
 * Lo que hay hoy.
 *
 * Del catálogo se marca lo que se va a ofrecer, y eso es lo único que ve el
 * talonario. Cada día amanece en blanco; el botón de copiar el día anterior
 * evita tener que marcarlo todo otra vez cuando el menú se repite.
 *
 * Las meriendas no se marcan: son fijas, se ofrecen todos los días tal como
 * estén en el catálogo.
 */
export default function MenuDiario() {
  const fecha = hoy();
  const [fijo, setFijo] = useState(MENU_VACIO);
  const [sel, setSel] = useState(MENU_VACIO);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const a = onSnapshot(doc(db, "menus", MENU_ID), (s) =>
      setFijo(s.exists() ? { ...MENU_VACIO, ...s.data() } : MENU_VACIO)
    );
    const b = onSnapshot(
      doc(db, "menus", idDiario(fecha)),
      (s) => {
        setSel(s.exists() ? { ...MENU_VACIO, ...s.data() } : MENU_VACIO);
        setCargando(false);
      },
      () => setCargando(false)
    );
    return () => {
      a();
      b();
    };
  }, [fecha]);

  const guardar = async (siguiente) => {
    setSel(siguiente);
    try {
      await setDoc(doc(db, "menus", idDiario(fecha)), { ...siguiente, fecha }, { merge: true });
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar. Revisa la conexión.");
    }
  };

  const alternar = (key, id) => {
    const activos = sel[key] || [];
    guardar({
      ...sel,
      [key]: activos.includes(id) ? activos.filter((x) => x !== id) : [...activos, id],
    });
  };

  const todos = (key) => guardar({ ...sel, [key]: conNombre(fijo[key]).map((f) => f.id) });
  const ninguno = (key) => guardar({ ...sel, [key]: [] });

  const copiarAyer = async () => {
    const d = await getDoc(doc(db, "menus", idDiario(ayer()))).catch(() => null);
    if (!d?.exists() || diarioVacio(d.data()))
      return alert("Ayer no quedó ningún menú guardado.");
    const copia = { ...sel };
    for (const k of CLAVES_DIARIAS) copia[k] = d.data()[k] || [];
    await guardar(copia);
    setToast("Copiado el menú de ayer ✓");
    setTimeout(() => setToast(""), 1800);
  };

  const limpiar = () => {
    if (!confirm("¿Quitar todo lo marcado para hoy?")) return;
    const vacio = { ...sel };
    for (const k of CLAVES_DIARIAS) vacio[k] = [];
    guardar(vacio);
  };

  if (cargando) return <p className="empty">Cargando…</p>;

  const catalogoVacio = menuVacio(fijo);
  const totalActivos = CLAVES_DIARIAS.reduce((n, k) => n + (sel[k]?.length || 0), 0);

  if (catalogoVacio)
    return (
      <div className="card">
        <h2>📅 Menú de hoy</h2>
        <p className="empty">
          Todavía no hay catálogo.
          <br />
          Ve a <b>Menú fijo</b> y escribe primero lo que sabes preparar.
        </p>
      </div>
    );

  const d = new Date(fecha + "T12:00:00Z").toLocaleDateString("es-CO", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const dia = d.charAt(0).toUpperCase() + d.slice(1);

  return (
    <>
      <div className="card">
        <h2>📅 Menú de hoy</h2>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{dia}</div>
        <p className="muted" style={{ margin: "6px 0 12px", fontSize: 13 }}>
          Marca lo que hay hoy. Solo eso aparece en el talonario.
          {totalActivos === 0 && (
            <>
              {" "}
              <b style={{ color: "#8a6412" }}>
                Sin nada marcado, el talonario muestra el menú completo.
              </b>
            </>
          )}
        </p>

        <div className="kpis" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="kpi total">
            <div className="v">{totalActivos}</div>
            <div className="l">Marcados hoy</div>
          </div>
          <div className="kpi">
            <div className="v">
              {CLAVES_DIARIAS.reduce((n, k) => n + conNombre(fijo[k]).length, 0)}
            </div>
            <div className="l">En el catálogo</div>
          </div>
        </div>

        <div className="acciones" style={{ marginTop: 12 }}>
          <button className="btn chico" onClick={copiarAyer}>↩︎ Copiar el de ayer</button>
          <button className="btn chico del" onClick={limpiar}>Quitar todo</button>
        </div>
      </div>

      {DIARIAS.map((s) => {
        const filas = conNombre(fijo[s.key]);
        if (!filas.length) return null;
        const activos = sel[s.key] || [];

        return (
          <div className="card" key={s.key}>
            <h2>
              {s.icono} {s.titulo}
              <span className="count">
                {activos.length} de {filas.length}
              </span>
            </h2>

            <div className="acciones" style={{ marginBottom: 10 }}>
              <button className="btn chico" onClick={() => todos(s.key)}>Todo</button>
              <button className="btn chico" onClick={() => ninguno(s.key)}>Nada</button>
            </div>

            <div className="chips">
              {filas.map((f) => (
                <button
                  key={f.id}
                  className={"chip" + (activos.includes(f.id) ? " on" : "")}
                  onClick={() => alternar(s.key, f.id)}
                >
                  {f.nombre}
                  {Number(f.precio) > 0 && <span className="p">{money(f.precio)}</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Las fijas no se marcan: se muestran para que se vea qué hay siempre. */}
      {FIJAS.map((s) => {
        const filas = conNombre(fijo[s.key]);
        if (!filas.length) return null;

        return (
          <div className="card fija" key={s.key}>
            <h2>
              {s.icono} {s.titulo}
              <span className="count fija">Siempre</span>
            </h2>
            <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>
              No hay que marcarlas: van al talonario todos los días. Para quitar o
              agregar, ve a <b>Menú fijo</b>.
            </p>

            <div className="chips">
              {filas.map((f) => (
                <span key={f.id} className="chip on quieto">
                  {f.nombre}
                  {Number(f.precio) > 0 && <span className="p">{money(f.precio)}</span>}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
