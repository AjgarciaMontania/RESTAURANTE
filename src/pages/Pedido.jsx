import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db, hoy } from "../firebase";
import {
  PRECIOS_DEF,
  armarLinea,
  money,
  totalLineas,
  uid,
} from "../lib/negocio";

const MENU_VACIO = { caldos: [], proteinas: [], adicionales: [], especiales: [] };

export default function Pedido() {
  const fecha = hoy();
  const [menu, setMenu] = useState(MENU_VACIO);
  const [precios, setPrecios] = useState(PRECIOS_DEF);

  const [mesa, setMesa] = useState("");
  const [cliente, setCliente] = useState("");
  const [paraLlevar, setParaLlevar] = useState(false);
  const [items, setItems] = useState([]);

  // Constructor de almuerzo
  const [caldoSel, setCaldoSel] = useState(null);
  const [protSel, setProtSel] = useState([]);
  const [especial, setEspecial] = useState(false);
  const [cant, setCant] = useState(1);

  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const a = onSnapshot(doc(db, "menus", fecha), (s) =>
      setMenu(s.exists() ? { ...MENU_VACIO, ...s.data() } : MENU_VACIO)
    );
    const b = onSnapshot(doc(db, "config", "precios"), (s) =>
      setPrecios(s.exists() ? { ...PRECIOS_DEF, ...s.data() } : PRECIOS_DEF)
    );
    return () => {
      a();
      b();
    };
  }, [fecha]);

  const conNombre = (arr) => (arr || []).filter((x) => x.nombre?.trim());

  const caldos = conNombre(menu.caldos);
  const proteinas = conNombre(menu.proteinas);
  const adicionales = conNombre(menu.adicionales);
  const especiales = conNombre(menu.especiales);

  const previa = useMemo(
    () => armarLinea({ caldo: caldoSel, proteinas: protSel, especial, precios }),
    [caldoSel, protSel, especial, precios]
  );

  const total = totalLineas(items);

  const toggleProt = (p) =>
    setProtSel((s) =>
      s.find((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, p]
    );

  const agregarAlmuerzo = () => {
    if (!previa) return;
    setItems((s) => [...s, { id: uid(), cant, ...previa }]);
    setCaldoSel(null);
    setProtSel([]);
    setEspecial(false);
    setCant(1);
  };

  const agregarSuelto = (fila, tipo) =>
    setItems((s) => [
      ...s,
      {
        id: uid(),
        cant: 1,
        tipo,
        descripcion: fila.nombre.toUpperCase(),
        precioUnit: Number(fila.precio) || 0,
        fijo: Number(fila.precio) > 0,
      },
    ]);

  const editarItem = (id, campo, valor) =>
    setItems((s) => s.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));

  const quitar = (id) => setItems((s) => s.filter((i) => i.id !== id));


  const enviar = async () => {
    if (!items.length || enviando) return;
    setEnviando(true);
    try {
      // Consecutivo diario seguro (aunque haya varios meseros a la vez)
      const numero = await runTransaction(db, async (tx) => {
        const ref = doc(db, "contadores", fecha);
        const snap = await tx.get(ref);
        const n = (snap.exists() ? snap.data().ultimo || 0 : 0) + 1;
        tx.set(ref, { ultimo: n }, { merge: true });
        return n;
      });

      await addDoc(collection(db, "pedidos"), {
        numero,
        fecha,
        mesa: mesa.trim(),
        cliente: cliente.trim(),
        paraLlevar,
        // Se sirve primero y se liquida después, desde Caja
        pago: "porCobrar",
        abonado: 0,
        items: items.map(({ id, ...r }) => ({ ...r, total: r.cant * r.precioUnit })),
        total,
        estado: "pendiente",
        anulado: false,
        creado: serverTimestamp(),
      });


      setItems([]);
      setMesa("");
      setCliente("");
      setParaLlevar(false);
      setToast(`Pedido #${numero} enviado a cocina ✓`);
      setTimeout(() => setToast(""), 2200);
    } catch (e) {
      console.error(e);
      alert("No se pudo enviar el pedido. Revisa la conexión.");
    } finally {
      setEnviando(false);
    }
  };

  const sinMenu = !caldos.length && !proteinas.length && !adicionales.length && !especiales.length;

  if (sinMenu)
    return (
      <div className="card">
        <h2>🧾 Talonario</h2>
        <p className="empty">
          Todavía no has armado el menú de hoy.
          <br />
          Ve a la pestaña <b>Menú</b> y agrega los caldos y proteínas.
        </p>
      </div>
    );

  return (
    <>
      {(precios.usarMesas || precios.usarCliente || precios.usarParaLlevar) && (
        <div className="card">
          <h2>📋 Datos del pedido</h2>

          {precios.usarMesas && (
            <input
              type="text"
              inputMode="numeric"
              placeholder="Número de mesa (ej: 4)"
              value={mesa}
              onChange={(e) => setMesa(e.target.value)}
              style={{ marginBottom: precios.usarCliente || precios.usarParaLlevar ? 8 : 0 }}
            />
          )}

          {precios.usarCliente && (
            <input
              type="text"
              placeholder="Nombre del cliente (opcional)"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              style={{ marginBottom: precios.usarParaLlevar ? 8 : 0 }}
            />
          )}

          {precios.usarParaLlevar && (
            <div className="seg">
              <button className={!paraLlevar ? "on" : ""} onClick={() => setParaLlevar(false)}>
                🍽️ Para la mesa
              </button>
              <button className={paraLlevar ? "on" : ""} onClick={() => setParaLlevar(true)}>
                🥡 Para llevar
              </button>
            </div>
          )}
        </div>
      )}

      {(caldos.length > 0 || proteinas.length > 0) && (
        <div className="card">
          <h2>🍲 Armar almuerzo</h2>

          {caldos.length > 0 && (
            <>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>CALDOS</p>
              <div className="chips" style={{ marginBottom: 14 }}>
                {caldos.map((c) => (
                  <button
                    key={c.id}
                    className={"chip" + (caldoSel?.id === c.id ? " on" : "")}
                    onClick={() => setCaldoSel(caldoSel?.id === c.id ? null : c)}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            </>
          )}

          {proteinas.length > 0 && (
            <>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
                PROTEÍNAS <span style={{ opacity: .7 }}>(puedes elegir varias)</span>
              </p>
              <div className="chips" style={{ marginBottom: 14 }}>
                {proteinas.map((p) => (
                  <button
                    key={p.id}
                    className={"chip" + (protSel.find((x) => x.id === p.id) ? " on" : "")}
                    onClick={() => toggleProt(p)}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="seg" style={{ marginBottom: 12 }}>
            <button className={!especial ? "on" : ""} onClick={() => setEspecial(false)}>
              Normal
            </button>
            <button className={especial ? "on" : ""} onClick={() => setEspecial(true)}>
              Especial
            </button>
          </div>

          <div className="row">
            <div className="stepper">
              <button onClick={() => setCant((c) => Math.max(1, c - 1))}>−</button>
              <span>{cant}</span>
              <button onClick={() => setCant((c) => c + 1)}>+</button>
            </div>
            <button className="btn primary" style={{ flex: 1 }} disabled={!previa} onClick={agregarAlmuerzo}>
              {previa ? `Agregar · ${money(previa.precioUnit * cant)}` : "Elige caldo o proteína"}
            </button>
          </div>

          {previa && (
            <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
              {previa.descripcion}
            </p>
          )}
        </div>
      )}

      {adicionales.length > 0 && (
        <div className="card">
          <h2>➕ Adicional</h2>
          <div className="chips">
            {adicionales.map((a) => (
              <button key={a.id} className="chip" onClick={() => agregarSuelto(a, "adicional")}>
                {a.nombre} <span className="p">{money(a.precio)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {especiales.length > 0 && (
        <div className="card">
          <h2>⭐ Especiales</h2>
          <div className="chips">
            {especiales.map((a) => (
              <button key={a.id} className="chip" onClick={() => agregarSuelto(a, "especial")}>
                {a.nombre} <span className="p">{money(a.precio)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>
          🧾 Pedido
          {(mesa || cliente || paraLlevar) && (
            <span className="count">
              {[mesa && `Mesa ${mesa}`, cliente, paraLlevar && "Para llevar"]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </h2>

        {items.length === 0 ? (
          <p className="empty">Todavía no has agregado nada</p>
        ) : (
          <div className="lineas">
            {items.map((i) => (
              <div className="linea" key={i.id}>
                <div className="l-top">
                  <div className="l-desc">{i.descripcion}</div>
                  <button
                    className="btn icon del"
                    aria-label="Quitar línea"
                    onClick={() => quitar(i.id)}
                  >
                    ✕
                  </button>
                </div>

                <div className="l-ctrl">
                  <div className="stepper">
                    <button onClick={() => editarItem(i.id, "cant", Math.max(1, i.cant - 1))}>−</button>
                    <span>{i.cant}</span>
                    <button onClick={() => editarItem(i.id, "cant", i.cant + 1)}>+</button>
                  </div>

                  {i.fijo ? (
                    <span className="l-unit">{money(i.precioUnit)} c/u</span>
                  ) : (
                    <input
                      className="l-input"
                      type="number"
                      inputMode="numeric"
                      value={i.precioUnit || ""}
                      placeholder="$"
                      onChange={(e) =>
                        editarItem(i.id, "precioUnit", Number(e.target.value) || 0)
                      }
                    />
                  )}

                  <span className="l-total">{money(i.cant * i.precioUnit)}</span>
                </div>
              </div>
            ))}

            <div className="l-final">
              <span>Total</span>
              <b>{money(total)}</b>
            </div>
          </div>
        )}

        <button
          className="btn primary block"
          style={{ marginTop: 14 }}
          disabled={!items.length || enviando}
          onClick={enviar}
        >
          {enviando ? "Enviando…" : `📺 Enviar a cocina · ${money(total)}`}
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
