import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, hoy } from "../firebase";
import { MENU_ID, MENU_VACIO, idDiario, menuDelDia, menuVacio } from "../lib/menu";
import { PRECIOS_DEF, money } from "../lib/negocio";
import {
  BLOQUES,
  MAX_FOTOS,
  PLATO_VACIO,
  ROTULOS_FOTO,
  esEspecial,
  fotosSugeridas,
  hayPlato,
  limpiarPlato,
  precioPlato,
  resumenPlato,
  separarPlatos,
} from "../lib/carta";
import ArmadorPlato from "../components/ArmadorPlato.jsx";
import CampoFoto from "../components/CampoFoto.jsx";
import MiniFoto from "../components/MiniFoto.jsx";

/**
 * La carta de hoy: los platos con foto que se muestran al cliente en el TV.
 *
 * Se arma con lo que esté marcado en el menú de hoy, así que nunca se puede
 * publicar un plato que la cocina no tiene.
 */
/** Ayer, en formato YYYY-MM-DD. */
const ayer = () => {
  const d = new Date(hoy() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export default function Carta() {
  const fecha = hoy();
  const [fijo, setFijo] = useState(MENU_VACIO);
  const [diario, setDiario] = useState(MENU_VACIO);
  const [precios, setPrecios] = useState(PRECIOS_DEF);
  const [platos, setPlatos] = useState([]);
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const a = onSnapshot(doc(db, "menus", MENU_ID), (s) =>
      setFijo(s.exists() ? { ...MENU_VACIO, ...s.data() } : MENU_VACIO)
    );
    const b = onSnapshot(doc(db, "menus", idDiario(fecha)), (s) =>
      setDiario(s.exists() ? { ...MENU_VACIO, ...s.data() } : MENU_VACIO)
    );
    const c = onSnapshot(doc(db, "config", "precios"), (s) =>
      setPrecios(s.exists() ? { ...PRECIOS_DEF, ...s.data() } : PRECIOS_DEF)
    );
    const d = onSnapshot(query(collection(db, "platos"), where("fecha", "==", fecha)), (s) =>
      setPlatos(
        s.docs
          .map((x) => ({ id: x.id, ...x.data() }))
          .sort((p, q) => (p.creado?.toMillis?.() || 0) - (q.creado?.toMillis?.() || 0))
      )
    );
    return () => {
      a();
      b();
      c();
      d();
    };
  }, [fecha]);

  const { menu } = useMemo(() => menuDelDia(fijo, diario), [fijo, diario]);
  const grupos = useMemo(() => separarPlatos(platos), [platos]);

  /**
   * Qué foto puso el catálogo en cada casilla.
   *
   * Sirve para distinguir la foto que llegó sola de la que el dueño escogió a
   * mano: la automática se reemplaza al cambiar el plato, la suya se respeta.
   */
  const fotoDelMenu = useRef(["", ""]);

  const avisar = (t) => {
    setToast(t);
    setTimeout(() => setToast(""), 2000);
  };

  /**
   * Cambia el plato y trae las fotos del menú fijo.
   *
   * La foto se subió una sola vez, pegada a la fila del catálogo: aquí solo
   * aparece. Si el dueño puso otra a mano en esa casilla, no se le toca.
   */
  const cambiar = (parche) =>
    setBorrador((b) => {
      const siguiente = { ...b, ...parche };
      const sugeridas = fotosSugeridas(siguiente);
      const fotos = [...(siguiente.fotos || [])];

      for (let i = 0; i < MAX_FOTOS; i++) {
        const puesta = fotos[i] || "";
        if (puesta && puesta !== fotoDelMenu.current[i]) continue; // la eligió él
        fotos[i] = sugeridas[i] || "";
        fotoDelMenu.current[i] = sugeridas[i] || "";
      }

      return { ...siguiente, fotos };
    });

  /** Foto puesta a mano: manda sobre la del menú. */
  const ponerFoto = (i, idFoto) =>
    setBorrador((b) => {
      fotoDelMenu.current[i] = "";
      const fotos = [...(b.fotos || [])];
      fotos[i] = idFoto;
      return { ...b, fotos };
    });

  /** Abre el armador en limpio, o con un plato ya guardado. */
  const abrirBorrador = (p) => {
    // Lo guardado cuenta como escogido a mano: no se pisa solo.
    fotoDelMenu.current = ["", ""];
    setBorrador(p);
  };

  const guardar = async () => {
    if (!hayPlato(borrador) || guardando) return;
    setGuardando(true);
    try {
      const datos = limpiarPlato(borrador);
      if (borrador.id) {
        await updateDoc(doc(db, "platos", borrador.id), datos);
      } else {
        await addDoc(collection(db, "platos"), { ...datos, fecha, creado: serverTimestamp() });
      }
      setBorrador(null);
      avisar(borrador.id ? "Plato actualizado ✓" : "Plato publicado ✓");
    } catch (e) {
      console.error(e);
      alert(
        "No se pudo guardar el plato.\n\n" +
          "Si es la primera vez, publica de nuevo las reglas del archivo " +
          "firestore.rules en la consola de Firebase."
      );
    } finally {
      setGuardando(false);
    }
  };

  /**
   * Rearma la carta de ayer con sus fotos.
   *
   * En un corrientazo el menú se repite mucho: es más rápido copiar y quitar
   * lo que hoy no hay que volver a armar y fotografiar todo desde cero.
   */
  const copiarAyer = async () => {
    setGuardando(true);
    try {
      const s = await getDocs(
        query(collection(db, "platos"), where("fecha", "==", ayer()))
      );
      const deAyer = s.docs.map((d) => d.data());
      if (!deAyer.length) {
        alert("Ayer no quedó ninguna carta guardada.");
        return;
      }
      if (
        platos.length &&
        !confirm(`Se agregan ${deAyer.length} plato(s) a la carta de hoy. ¿Seguimos?`)
      )
        return;

      for (const p of deAyer)
        await addDoc(collection(db, "platos"), {
          ...limpiarPlato(p),
          fecha,
          creado: serverTimestamp(),
        });

      avisar(`Copiados ${deAyer.length} plato(s) ✓`);
    } catch (e) {
      console.error(e);
      alert("No se pudo copiar la carta de ayer.");
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (p) => {
    if (!confirm("¿Quitar este plato de la carta?")) return;
    await deleteDoc(doc(db, "platos", p.id)).catch((e) => {
      console.error(e);
      alert("No se pudo quitar el plato.");
    });
  };

  if (menuVacio(menu))
    return (
      <div className="card">
        <h2>📷 Carta de hoy</h2>
        <p className="empty">
          Primero marca en <b>Menú de hoy</b> lo que hay,
          <br />y aquí armas los platos con foto.
        </p>
      </div>
    );

  return (
    <>
      <div className="card">
        <h2>
          📷 Carta de hoy
          <span className="count">{platos.length}</span>
        </h2>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
          Arma el plato como en el talonario, súbele la foto y sale en la pantalla del
          comedor. El precio lo pone solo, con las mismas reglas de cobro. La foto
          también: se sube una vez en <b>Menú fijo</b> y de ahí en adelante aparece sola
          cada vez que armes ese plato.
        </p>
        <div className="acciones">
          {!borrador && (
            <button className="btn primary chico" onClick={() => abrirBorrador({ ...PLATO_VACIO })}>
              ➕ Armar plato
            </button>
          )}
          <button className="btn chico" disabled={guardando} onClick={copiarAyer}>
            ↩︎ Copiar la de ayer
          </button>
          <a className="btn chico" href="#/carta" target="_blank" rel="noreferrer">
            📺 Abrir la pantalla
          </a>
        </div>
      </div>

      {borrador && (
        <div className="card">
          <h2>{borrador.id ? "✎ Editando el plato" : "➕ Nuevo plato"}</h2>

          <ArmadorPlato menu={menu} sel={borrador} onCambio={cambiar} />

          {!borrador.deLaCasa && (
            <div className="seg" style={{ marginBottom: 12 }}>
              <button
                className={!borrador.especial ? "on" : ""}
                onClick={() => cambiar({ especial: false })}
              >
                Normal
              </button>
              <button
                className={borrador.especial ? "on" : ""}
                onClick={() => cambiar({ especial: true })}
              >
                Especial
              </button>
            </div>
          )}

          <input
            type="text"
            placeholder="Nota corta (opcional): con jugo natural"
            value={borrador.nota || ""}
            maxLength={60}
            onChange={(e) => cambiar({ nota: e.target.value })}
            style={{ marginBottom: 14 }}
          />

          {Array.from({ length: MAX_FOTOS }).map((_, i) => {
            const puesta = (borrador.fotos || [])[i] || "";
            const delMenu = !!puesta && puesta === fotoDelMenu.current[i];

            return (
              <CampoFoto
                key={i}
                id={puesta}
                titulo={ROTULOS_FOTO[i].titulo}
                pista={delMenu ? "✓ Viene del Menú fijo" : ROTULOS_FOTO[i].pista}
                onCambio={(idFoto) => ponerFoto(i, idFoto)}
              />
            );
          })}

          {hayPlato(borrador) && (
            <div className={"previa-carta" + (esEspecial(borrador) ? " especial" : "")}>
              <div style={{ minWidth: 0 }}>
                <b>{resumenPlato(borrador).titulo}</b>
                <div className="muted" style={{ fontSize: 12 }}>
                  Sale en <b>{esEspecial(borrador) ? "Especiales de la casa" : "Menú del día"}</b>
                </div>
              </div>
              <span className="plata">{money(precioPlato(borrador, precios))}</span>
            </div>
          )}

          <div className="acciones" style={{ marginTop: 12 }}>
            <button
              className="btn primary"
              disabled={!hayPlato(borrador) || guardando}
              onClick={guardar}
            >
              {guardando ? "Guardando…" : borrador.id ? "Guardar cambios" : "Publicar en la carta"}
            </button>
            <button className="btn" onClick={() => setBorrador(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {platos.length === 0 && !borrador && (
        <div className="card">
          <p className="empty">
            La carta está vacía.
            <br />
            Arma el primer plato y súbele la foto.
          </p>
        </div>
      )}

      {BLOQUES.map((b) =>
        grupos[b.clave].length === 0 ? null : (
          <div key={b.clave}>
            <p className="rotulo-bloque">{b.titulo}</p>
            {grupos[b.clave].map((p) => {
              const { titulo, detalles } = resumenPlato(p);
              return (
                <div className={"card plato-fila " + b.clave} key={p.id}>
            <div className="plato-minis">
              {(p.fotos || []).filter(Boolean).length === 0 ? (
                <div className="mini vacia">📷</div>
              ) : (
                (p.fotos || []).filter(Boolean).map((f) => <MiniFoto key={f} id={f} />)
              )}
            </div>

            <div className="plato-texto">
              <b>{titulo}</b>
              {detalles.map((d, k) => (
                <span key={k} className="muted">
                  {d.ic} {d.txt}
                </span>
              ))}
              {p.nota && <span className="muted">“{p.nota}”</span>}
              <span className="plata">{money(precioPlato(p, precios))}</span>
            </div>

                  <div className="plato-acciones">
                    <button
                      className="btn icon"
                      aria-label="Editar plato"
                      onClick={() => {
                        abrirBorrador({ ...PLATO_VACIO, ...p });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      ✎
                    </button>
                    <button
                      className="btn icon del"
                      aria-label="Quitar plato"
                      onClick={() => borrar(p)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
