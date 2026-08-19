import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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

  const avisar = (t) => {
    setToast(t);
    setTimeout(() => setToast(""), 2000);
  };

  const cambiar = (parche) => setBorrador((b) => ({ ...b, ...parche }));

  const ponerFoto = (i, idFoto) =>
    setBorrador((b) => {
      const fotos = [...(b.fotos || [])];
      fotos[i] = idFoto;
      return { ...b, fotos };
    });

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
          comedor. El precio lo pone solo, con las mismas reglas de cobro.
        </p>
        <div className="acciones">
          {!borrador && (
            <button className="btn primary chico" onClick={() => setBorrador({ ...PLATO_VACIO })}>
              ➕ Armar plato
            </button>
          )}
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

          {Array.from({ length: MAX_FOTOS }).map((_, i) => (
            <CampoFoto
              key={i}
              id={(borrador.fotos || [])[i] || ""}
              titulo={ROTULOS_FOTO[i].titulo}
              pista={ROTULOS_FOTO[i].pista}
              onCambio={(idFoto) => ponerFoto(i, idFoto)}
            />
          ))}

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
                        setBorrador({ ...PLATO_VACIO, ...p });
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
