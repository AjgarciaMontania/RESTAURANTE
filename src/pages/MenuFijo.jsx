import { useEffect, useRef, useState } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db, hoy } from "../firebase";
import {
  MENU_ID,
  MENU_VACIO,
  SECCIONES,
  fotoDe,
  menuVacio,
  presentacionesDe,
} from "../lib/menu";
import Presentaciones from "../components/Presentaciones.jsx";
import MiniFoto from "../components/MiniFoto.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);

/** El catálogo de la casa: todo lo que el restaurante sabe preparar. */
export default function MenuFijo() {
  const [menu, setMenu] = useState(MENU_VACIO);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState("");
  /** Fila cuyo panel de foto está abierto: "proteinas:ab12". */
  const [fotoAbierta, setFotoAbierta] = useState("");

  /**
   * Lo que falta por mandar a Firestore.
   *
   * Escribir dispara un guardado por tecla, y la respuesta del servidor llega
   * con lo de hace dos letras y pisa lo que se acaba de escribir. Por eso se
   * espera un momento antes de mandar, y mientras haya algo pendiente lo local
   * manda sobre lo que llegue de la nube.
   */
  const pendiente = useRef(null);
  const temporizador = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setCargando(false), 5000);
    const off = onSnapshot(
      doc(db, "menus", MENU_ID),
      async (snap) => {
        // Se está escribiendo: no se pisa lo que el dueño acaba de teclear.
        if (pendiente.current) return;

        if (snap.exists() && !menuVacio(snap.data())) {
          setMenu({ ...MENU_VACIO, ...snap.data() });
        } else {
          // Primera vez con el menú fijo: se hereda el del día para no
          // tener que volver a escribirlo todo.
          const delDia = await getDoc(doc(db, "menus", hoy())).catch(() => null);
          if (delDia?.exists() && !menuVacio(delDia.data())) {
            const heredado = { ...MENU_VACIO, ...delDia.data() };
            delete heredado.fecha;
            setMenu(heredado);
            await setDoc(doc(db, "menus", MENU_ID), heredado, { merge: true });
          } else {
            setMenu(MENU_VACIO);
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

  /** Guarda en la pantalla al instante y en la nube un momento después. */
  const guardar = (siguiente) => {
    setMenu(siguiente);
    pendiente.current = siguiente;

    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(async () => {
      const datos = pendiente.current;
      try {
        await setDoc(doc(db, "menus", MENU_ID), datos, { merge: true });
        if (pendiente.current === datos) pendiente.current = null;
      } catch (e) {
        console.error(e);
        pendiente.current = null;
        alert("No se pudo guardar. Revisa la conexión.");
      }
    }, 700);
  };

  // Si se sale de la pestaña con algo a medio guardar, se manda de una.
  useEffect(
    () => () => {
      if (!pendiente.current) return;
      clearTimeout(temporizador.current);
      setDoc(doc(db, "menus", MENU_ID), pendiente.current, { merge: true }).catch((e) =>
        console.error("No se alcanzó a guardar el menú:", e)
      );
    },
    []
  );

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
        <h2>📖 Menú fijo</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Es tu catálogo: todo lo que sabes preparar. Se escribe una vez y ahí se queda.
          Lo que se ofrece cada día se elige en <b>Menú de hoy</b>.
        </p>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
          El <b>caldo</b> es del desayuno y la <b>sopa</b> del almuerzo. Los <b>huevos</b>{" "}
          cuentan como una proteína más y el <b>principio</b> va incluido en el plato. El
          precio de cada fila es opcional y solo manda cuando el plato va solo.
        </p>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
          El botón 📷 de cada fila guarda las <b>fotos para la carta del comedor</b>. Un
          mismo plato puede tener varias <b>presentaciones</b> —con aguacate, con
          plátano, solo— y cada una sale como su propia tarjeta. Se suben una vez y de
          ahí en adelante aparecen solas.
        </p>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
          Las <b>meriendas</b> son la excepción: llevan su propio precio, se cobran
          siempre aparte y salen todos los días en el talonario sin tener que marcarlas
          en <b>Menú de hoy</b>.
        </p>
      </div>

      <div className="grid-2">
        {SECCIONES.map((s) => (
          <div className="card" key={s.key}>
            <h2>
              {s.icono} {s.titulo}
              <span className={"count" + (s.siempre ? " fija" : "")}>
                {s.siempre ? "Siempre" : menu[s.key].length}
              </span>
            </h2>

            {s.nota && (
              <p className="muted" style={{ margin: "-4px 0 10px", fontSize: 12 }}>
                {s.nota}
              </p>
            )}

            {menu[s.key].length === 0 && <p className="empty">Sin filas todavía</p>}

            {menu[s.key].map((fila) => {
              const llave = s.key + ":" + fila.id;
              const cuantas = s.conFoto ? presentacionesDe(fila).length : 0;
              const portada = s.conFoto ? fotoDe(fila) : "";

              return (
                <div key={fila.id}>
                  <div className="row">
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
                      placeholder={s.conPrecio ? "$" : "$ opcional"}
                      onChange={(e) =>
                        editar(s.key, fila.id, "precio", Number(e.target.value) || 0)
                      }
                    />

                    {s.conFoto && (
                      <button
                        className={"btn icon foto" + (cuantas ? " puesta" : "")}
                        title="Fotos para la carta del comedor"
                        aria-label="Fotos del plato"
                        onClick={() => setFotoAbierta(fotoAbierta === llave ? "" : llave)}
                      >
                        {portada ? <MiniFoto id={portada} className="mini-fila" /> : "📷"}
                        {cuantas > 1 && <i className="cuantas">{cuantas}</i>}
                      </button>
                    )}

                    <button
                      className="btn icon del"
                      onClick={() => borrar(s.key, fila.id)}
                      aria-label="Eliminar fila"
                    >
                      ✕
                    </button>
                  </div>

                  {s.conFoto && fotoAbierta === llave && (
                    <Presentaciones
                      fila={fila}
                      onCambio={(lista) => editar(s.key, fila.id, "presentaciones", lista)}
                    />
                  )}
                </div>
              );
            })}

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
