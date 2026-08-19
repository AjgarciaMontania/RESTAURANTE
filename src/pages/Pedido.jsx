import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, hoy } from "../firebase";
import { useAdmin } from "../lib/admin.jsx";
import {
  PRECIOS_DEF,
  TIPO_DESECHABLE,
  armarLinea,
  estadoPago,
  lineaDesechables,
  money,
  receta,
  totalLineas,
  uid,
} from "../lib/negocio";
import SelectorCliente from "../components/SelectorCliente.jsx";

import {
  MENU_ID,
  MENU_VACIO,
  conNombre,
  idDiario,
  menuDelDia,
} from "../lib/menu";

export default function Pedido() {
  const fecha = hoy();
  const { esAdmin } = useAdmin();
  const [params, setParams] = useSearchParams();

  const [fijo, setFijo] = useState(MENU_VACIO);
  const [diario, setDiario] = useState(MENU_VACIO);
  const [precios, setPrecios] = useState(PRECIOS_DEF);
  /** Pedidos de hoy que todavía se pueden corregir. */
  const [abiertos, setAbiertos] = useState([]);
  /** Pedido que se está corrigiendo, o null si es uno nuevo. */
  const [editando, setEditando] = useState(null);
  const [verAbiertos, setVerAbiertos] = useState(false);
  const armador = useRef(null);

  const [mesa, setMesa] = useState("");
  /** Cliente amarrado al pedido; queda pegado hasta la caja y los fiados. */
  const [clienteSel, setClienteSel] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [paraLlevar, setParaLlevar] = useState(false);
  const [items, setItems] = useState([]);
  /** Precio de desechable digitado a mano, cuando en Ajustes no es fijo. */
  const [desechUnit, setDesechUnit] = useState(null);

  // Constructor de almuerzo
  const [caldoSel, setCaldoSel] = useState(null);
  const [sopaSel, setSopaSel] = useState(null);
  const [principioSel, setPrincipioSel] = useState(null);
  const [protSel, setProtSel] = useState([]);
  const [huevoSel, setHuevoSel] = useState([]);
  const [especial, setEspecial] = useState(false);
  const [cant, setCant] = useState(1);

  const [enviando, setEnviando] = useState(false);
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
    return () => {
      a();
      b();
      c();
    };
  }, [fecha]);

  /**
   * Pedidos del día que todavía se pueden corregir.
   *
   * El mesero solo alcanza los que siguen en la cocina: si el plato ya salió,
   * cambiarlo es decisión del administrador. Con PIN de admin se ven todos.
   */
  useEffect(() => {
    const q = query(collection(db, "pedidos"), where("fecha", "==", fecha));
    return onSnapshot(q, (snap) =>
      setAbiertos(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => !p.anulado && (esAdmin || p.estado === "pendiente"))
          .sort((a, b) => b.numero - a.numero)
      )
    );
  }, [fecha, esAdmin]);

  useEffect(
    () =>
      onSnapshot(collection(db, "clientes"), (s) =>
        setClientes(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    []
  );

  // Solo lo disponible hoy. Si nadie marcó nada, se muestra el catálogo
  // completo con un aviso: mejor eso a dejar al mesero sin poder trabajar.
  const { menu, sinSeleccion } = useMemo(() => menuDelDia(fijo, diario), [fijo, diario]);

  const caldos = conNombre(menu.caldos);
  const sopas = conNombre(menu.sopas);
  const principios = conNombre(menu.principios);
  const proteinas = conNombre(menu.proteinas);
  const huevos = conNombre(menu.huevos);
  const adicionales = conNombre(menu.adicionales);
  const especiales = conNombre(menu.especiales);
  // Fijas: no pasan por el menú de hoy, están disponibles siempre.
  const meriendas = conNombre(menu.meriendas);

  // El huevo cuenta como una proteína más para el precio, pero en la
  // descripción va aparte y rotulado, para que en la cocina no se confunda.
  const previa = useMemo(
    () =>
      armarLinea({
        caldo: caldoSel,
        sopa: sopaSel,
        principio: principioSel,
        proteinas: protSel,
        huevos: huevoSel,
        especial,
        precios,
      }),
    [caldoSel, sopaSel, principioSel, protSel, huevoSel, especial, precios]
  );

  /**
   * El empaque de "para llevar" no se agrega a mano: se recalcula solo cada
   * vez que cambia el pedido, y desaparece si se desmarca "para llevar".
   */
  const desechables = useMemo(() => {
    const l = lineaDesechables(items, paraLlevar, precios);
    if (!l) return null;
    return desechUnit == null ? l : { ...l, precioUnit: desechUnit };
  }, [items, paraLlevar, precios, desechUnit]);

  const lineas = useMemo(
    () => (desechables ? [...items, desechables] : items),
    [items, desechables]
  );

  const total = totalLineas(lineas);

  const alternar = (lista, set) => (x) =>
    set((s) => (s.find((y) => y.id === x.id) ? s.filter((y) => y.id !== x.id) : [...s, x]));

  /** Caldo y sopa son excluyentes: elegir uno descarta el otro. */
  const elegirCaldo = (c) => {
    setCaldoSel(caldoSel?.id === c.id ? null : c);
    setSopaSel(null);
  };
  const elegirSopa = (x) => {
    setSopaSel(sopaSel?.id === x.id ? null : x);
    setCaldoSel(null);
  };

  const toggleProt = alternar(protSel, setProtSel);
  const toggleHuevo = alternar(huevoSel, setHuevoSel);

  const limpiarArmador = () => {
    setCaldoSel(null);
    setSopaSel(null);
    setPrincipioSel(null);
    setProtSel([]);
    setHuevoSel([]);
    setEspecial(false);
    setCant(1);
  };

  const agregarAlmuerzo = () => {
    if (!previa) return;
    // La receta viaja con el renglón: es lo que permite repetirlo o corregirlo
    // después, incluso con el pedido ya enviado a la cocina.
    const compo = receta({
      caldo: caldoSel,
      sopa: sopaSel,
      principio: principioSel,
      proteinas: protSel,
      huevos: huevoSel,
      especial,
    });
    setItems((s) => [...s, { id: uid(), cant, ...previa, compo }]);
    limpiarArmador();
  };

  /** Devuelve un plato al armador para repetirlo o corregirlo. */
  const cargarReceta = (c) => {
    if (!c) return;
    setCaldoSel(c.caldo || null);
    setSopaSel(c.sopa || null);
    setPrincipioSel(c.principio || null);
    setProtSel(c.proteinas || []);
    setHuevoSel(c.huevos || []);
    setEspecial(!!c.especial);
    setCant(1);
    armador.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** Lo copia al armador sin tocar el original: para el plato de al lado. */
  const repetirLinea = (i) => cargarReceta(i.compo);

  /** Lo saca del pedido y lo devuelve al armador para corregirlo. */
  const corregirLinea = (i) => {
    cargarReceta(i.compo);
    setCant(i.cant);
    quitar(i.id);
  };

  /**
   * Renglón que se cobra aparte del almuerzo.
   *
   * `rotulo` antepone la palabra al nombre para que en la cocina no se
   * confunda con un plato. `acumula` hace que volver a tocar el mismo botón
   * suba la cantidad en vez de abrir otro renglón: pedir tres empanadas es lo
   * normal, tener tres renglones de empanada no.
   */
  const agregarSuelto = (fila, tipo, { rotulo = "", acumula = false } = {}) => {
    const descripcion = (rotulo ? `${rotulo}: ` : "") + fila.nombre.toUpperCase();
    const nueva = {
      id: uid(),
      cant: 1,
      tipo,
      descripcion,
      precioUnit: Number(fila.precio) || 0,
      fijo: Number(fila.precio) > 0,
    };

    setItems((s) => {
      if (acumula) {
        const k = s.findIndex((x) => x.tipo === tipo && x.descripcion === descripcion);
        if (k >= 0) return s.map((x, j) => (j === k ? { ...x, cant: x.cant + 1 } : x));
      }
      return [...s, nueva];
    });
  };

  const editarItem = (id, campo, valor) =>
    setItems((s) => s.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));

  const quitar = (id) => setItems((s) => s.filter((i) => i.id !== id));

  /** El cliente viaja con el pedido: caja y fiados lo necesitan amarrado. */
  const datosCliente = () => ({
    cliente: clienteSel?.nombre || "",
    clienteId: clienteSel?.id || "",
    clienteTel: clienteSel?.telefono || "",
  });

  /** Trae un pedido ya enviado al talonario para corregirlo. */
  const abrirPedido = (p) => {
    setEditando({
      id: p.id,
      numero: p.numero,
      estado: p.estado,
      cobrado: estadoPago(p) !== "porCobrar",
    });
    setMesa(p.mesa || "");
    setClienteSel(p.clienteId ? { id: p.clienteId, nombre: p.cliente, telefono: p.clienteTel || "" } : null);
    setParaLlevar(!!p.paraLlevar);
    // El renglón de desechables se vuelve a calcular solo: no se carga.
    setItems((p.items || []).filter((i) => i.tipo !== TIPO_DESECHABLE).map((i) => ({ ...i, id: uid() })));
    setDesechUnit(null);
    limpiarArmador();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const salirEdicion = () => {
    setEditando(null);
    setItems([]);
    setMesa("");
    setClienteSel(null);
    setParaLlevar(false);
    setDesechUnit(null);
    limpiarArmador();
    if (params.get("editar")) setParams({}, { replace: true });
  };

  // Entrada desde Caja:  #/pedido?editar=<id>
  const pedirEditar = params.get("editar");
  useEffect(() => {
    if (!pedirEditar || editando?.id === pedirEditar) return;
    const p = abiertos.find((x) => x.id === pedirEditar);
    if (p) abrirPedido(p);
  }, [pedirEditar, abiertos]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async () => {
    if (!items.length || enviando) return;

    // Corregir un pedido existente en vez de crear uno nuevo
    if (editando) {
      setEnviando(true);
      try {
        const cambios = {
          mesa: mesa.trim(),
          ...datosCliente(),
          paraLlevar,
          items: lineas.map(({ id, ...r }) => ({ ...r, total: r.cant * r.precioUnit })),
          total,
          modificado: true,
          modificadoEn: serverTimestamp(),
        };
        // Si ya estaba cobrado, el valor cambió: hay que volver a liquidarlo
        // para que la caja no quede descuadrada.
        if (editando.cobrado) {
          cambios.pago = "porCobrar";
          cambios.abonado = 0;
        }
        await updateDoc(doc(db, "pedidos", editando.id), cambios);
        const n = editando.numero;
        salirEdicion();
        setToast(
          `Pedido #${n} corregido ✓${editando.cobrado ? " — vuelve a cobrarlo en Caja" : ""}`
        );
        setTimeout(() => setToast(""), 3000);
      } catch (e) {
        console.error(e);
        alert("No se pudo guardar el cambio. Revisa la conexión.");
      } finally {
        setEnviando(false);
      }
      return;
    }

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
        ...datosCliente(),
        paraLlevar,
        // Se sirve primero y se liquida después, desde Caja
        pago: "porCobrar",
        abonado: 0,
        items: lineas.map(({ id, ...r }) => ({ ...r, total: r.cant * r.precioUnit })),
        total,
        estado: "pendiente",
        anulado: false,
        modificado: false,
        creado: serverTimestamp(),
      });


      setItems([]);
      setMesa("");
      setClienteSel(null);
      setParaLlevar(false);
      setDesechUnit(null);
      setToast(`Pedido #${numero} enviado a cocina ✓`);
      setTimeout(() => setToast(""), 2200);
    } catch (e) {
      console.error(e);
      alert("No se pudo enviar el pedido. Revisa la conexión.");
    } finally {
      setEnviando(false);
    }
  };

  const sinMenu =
    !caldos.length &&
    !sopas.length &&
    !principios.length &&
    !proteinas.length &&
    !huevos.length &&
    !adicionales.length &&
    !especiales.length &&
    !meriendas.length;

  if (sinMenu)
    return (
      <div className="card">
        <h2>🧾 Talonario</h2>
        <p className="empty">
          Todavía no hay nada en el menú.
          <br />
          Ve a la pestaña <b>Menú</b> y escribe primero tu catálogo.
        </p>
      </div>
    );

  return (
    <>
      {editando ? (
        <div className="aviso editando">
          <div>
            ✎ Estás corrigiendo el <b>pedido #{editando.numero}</b>
            {editando.estado === "entregado" && " (ya entregado)"}.
            {editando.cobrado && (
              <>
                {" "}
                <b>Ya estaba cobrado:</b> al guardar se reabre el cobro y hay que
                liquidarlo otra vez en Caja.
              </>
            )}
          </div>
          <button className="btn chico" onClick={salirEdicion}>
            Cancelar
          </button>
        </div>
      ) : (
        abiertos.length > 0 && (
          // Plegado por defecto: casi siempre se entra a tomar un pedido nuevo,
          // no a corregir, y en el celular cada centímetro cuenta.
          <div className="card plegable">
            <button className="plegar" onClick={() => setVerAbiertos((v) => !v)}>
              <h2>
                ✎ Corregir un pedido
                <span className="count">{abiertos.length}</span>
                <span className="flecha">{verAbiertos ? "▾" : "▸"}</span>
              </h2>
            </button>

            {verAbiertos && (
              <>
                <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
                  {esAdmin
                    ? "Toca el pedido que quieras corregir."
                    : "Solo mientras siga en la cocina. Después lo corrige el administrador."}
                </p>
                <div className="chips">
                  {abiertos.map((p) => (
                    <button key={p.id} className="chip" onClick={() => abrirPedido(p)}>
                      #{p.numero}
                      <span className="p">
                        {[p.mesa && `Mesa ${p.mesa}`, p.cliente, money(p.total)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      )}

      {sinSeleccion && !editando && (
        <div className="aviso">
          ⚠️ Nadie ha marcado el <b>menú de hoy</b>, así que aquí sale el catálogo
          completo. Ve a <b>Menú → Menú de hoy</b> y marca lo que hay.
        </div>
      )}

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
            <div style={{ marginBottom: precios.usarParaLlevar ? 10 : 0 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Cliente (opcional) — queda amarrado hasta la caja
              </div>
              <SelectorCliente
                clientes={clientes}
                valor={clienteSel}
                onElegir={setClienteSel}
              />
            </div>
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

      {(caldos.length > 0 ||
        sopas.length > 0 ||
        principios.length > 0 ||
        proteinas.length > 0 ||
        huevos.length > 0) && (
        <div className="card" ref={armador}>
          <h2>🍲 Armar almuerzo</h2>

          {caldos.length > 0 && (
            <>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
                🍲 CALDOS <span style={{ opacity: .7 }}>(desayuno)</span>
              </p>
              <div className="chips" style={{ marginBottom: 14 }}>
                {caldos.map((c) => (
                  <button
                    key={c.id}
                    className={"chip" + (caldoSel?.id === c.id ? " on" : "")}
                    onClick={() => elegirCaldo(c)}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            </>
          )}

          {sopas.length > 0 && (
            <>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
                🥣 SOPAS <span style={{ opacity: .7 }}>(almuerzo)</span>
              </p>
              <div className="chips" style={{ marginBottom: 14 }}>
                {sopas.map((x) => (
                  <button
                    key={x.id}
                    className={"chip" + (sopaSel?.id === x.id ? " on" : "")}
                    onClick={() => elegirSopa(x)}
                  >
                    {x.nombre}
                  </button>
                ))}
              </div>
            </>
          )}

          {principios.length > 0 && (
            <>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
                🫘 PRINCIPIOS <span style={{ opacity: .7 }}>(va incluido)</span>
              </p>
              <div className="chips" style={{ marginBottom: 14 }}>
                {principios.map((x) => (
                  <button
                    key={x.id}
                    className={"chip" + (principioSel?.id === x.id ? " on" : "")}
                    onClick={() => setPrincipioSel(principioSel?.id === x.id ? null : x)}
                  >
                    {x.nombre}
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

          {huevos.length > 0 && (
            <>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
                🍳 HUEVOS <span style={{ opacity: .7 }}>(cuentan como proteína)</span>
              </p>
              <div className="chips" style={{ marginBottom: 14 }}>
                {huevos.map((h) => (
                  <button
                    key={h.id}
                    className={"chip" + (huevoSel.find((x) => x.id === h.id) ? " on" : "")}
                    onClick={() => toggleHuevo(h)}
                  >
                    {h.nombre}
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

      {meriendas.length > 0 && (
        <div className="card">
          <h2>
            🥟 Meriendas
            <span className="count fija">Siempre</span>
          </h2>
          <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
            Se cobran aparte. Toca varias veces para subir la cantidad.
          </p>
          <div className="chips">
            {meriendas.map((m) => {
              const puestas = items
                .filter((i) => i.tipo === "merienda" && i.descripcion.endsWith(m.nombre.toUpperCase()))
                .reduce((n, i) => n + i.cant, 0);

              return (
                <button
                  key={m.id}
                  className={"chip" + (puestas ? " on" : "")}
                  onClick={() =>
                    agregarSuelto(m, "merienda", { rotulo: "MERIENDA", acumula: true })
                  }
                >
                  {puestas > 0 && <b style={{ marginRight: 6 }}>{puestas}×</b>}
                  {m.nombre} <span className="p">{money(m.precio)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <h2>
          {editando ? `🧾 Pedido #${editando.numero}` : "🧾 Pedido"}
          {(mesa || clienteSel || paraLlevar) && (
            <span className="count">
              {[mesa && `Mesa ${mesa}`, clienteSel?.nombre, paraLlevar && "Para llevar"]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </h2>

        {items.length === 0 ? (
          <p className="empty">Todavía no has agregado nada</p>
        ) : (
          <div className="lineas">
            {items.some((i) => i.compo) && (
              <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
                <b>↻</b> repite el plato para armar el siguiente · <b>✎</b> lo devuelve
                arriba para corregirlo · <b>✕</b> lo quita
              </p>
            )}
            {items.map((i) => (
              <div className="linea" key={i.id}>
                <div className="l-top">
                  <div className="l-desc">{i.descripcion}</div>
                  {i.compo && (
                    <>
                      <button
                        className="btn icon"
                        title="Repetir este plato para armar el siguiente"
                        aria-label="Repetir plato"
                        onClick={() => repetirLinea(i)}
                      >
                        ↻
                      </button>
                      <button
                        className="btn icon"
                        title="Corregir este plato"
                        aria-label="Corregir plato"
                        onClick={() => corregirLinea(i)}
                      >
                        ✎
                      </button>
                    </>
                  )}
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

            {desechables && (
              <div className="linea auto">
                <div className="l-top">
                  <div className="l-desc">
                    🥡 DESECHABLES
                    <span className="muted" style={{ display: "block", fontSize: 12, fontWeight: 400 }}>
                      {desechables.cant} empaque{desechables.cant === 1 ? "" : "s"}, calculado según
                      lo que lleva el pedido
                    </span>
                  </div>
                </div>

                <div className="l-ctrl">
                  <span className="l-unit">×{desechables.cant}</span>
                  {desechables.fijo ? (
                    <span className="l-unit">{money(desechables.precioUnit)} c/u</span>
                  ) : (
                    <input
                      className="l-input"
                      type="number"
                      inputMode="numeric"
                      value={desechables.precioUnit || ""}
                      placeholder="$"
                      onChange={(e) => setDesechUnit(Number(e.target.value) || 0)}
                    />
                  )}
                  <span className="l-total">
                    {money(desechables.cant * desechables.precioUnit)}
                  </span>
                </div>
              </div>
            )}

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
          {enviando
            ? "Guardando…"
            : editando
            ? `✔ Guardar cambios en #${editando.numero} · ${money(total)}`
            : `📺 Enviar a cocina · ${money(total)}`}
        </button>

        {editando && (
          <button className="btn block ghost" style={{ marginTop: 8 }} onClick={salirEdicion}>
            Cancelar y dejarlo como estaba
          </button>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
