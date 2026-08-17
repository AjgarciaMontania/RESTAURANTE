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
import {
  ETIQUETA_TIPO,
  PRECIOS_DEF,
  entroACaja,
  esAlmuerzo,
  estadoPago,
  money,
  quedoDebiendo,
} from "../lib/negocio";
import SelectorCliente from "../components/SelectorCliente.jsx";

export default function Caja() {
  const [fecha, setFecha] = useState(hoy());
  const [vista, setVista] = useState("cobrar");
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cfg, setCfg] = useState(PRECIOS_DEF);

  // Panel de cobro abierto
  const [cobrando, setCobrando] = useState(null); // id del pedido
  const [recibido, setRecibido] = useState("");
  const [clienteSel, setClienteSel] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "pedidos"), where("fecha", "==", fecha));
    return onSnapshot(q, (snap) =>
      setPedidos(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.numero - b.numero)
      )
    );
  }, [fecha]);

  useEffect(() => {
    const a = onSnapshot(collection(db, "clientes"), (s) =>
      setClientes(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const b = onSnapshot(doc(db, "config", "precios"), (s) =>
      setCfg(s.exists() ? { ...PRECIOS_DEF, ...s.data() } : PRECIOS_DEF)
    );
    return () => {
      a();
      b();
    };
  }, []);

  const r = useMemo(() => {
    const validos = pedidos.filter((p) => !p.anulado);
    const porTipo = {};
    let almuerzos = 0;

    for (const p of validos)
      for (const i of p.items || []) {
        const t = porTipo[i.tipo] || { cant: 0, monto: 0 };
        t.cant += i.cant;
        t.monto += i.cant * i.precioUnit;
        porTipo[i.tipo] = t;
        if (esAlmuerzo(i.tipo)) almuerzos += i.cant;
      }

    const pendientes = validos.filter((p) => estadoPago(p) === "porCobrar");

    return {
      validos,
      pendientes,
      anulados: pedidos.length - validos.length,
      enCaja: validos.reduce((s, p) => s + entroACaja(p), 0),
      fiado: validos.reduce((s, p) => s + quedoDebiendo(p), 0),
      sinCobrar: pendientes.reduce((s, p) => s + (p.total || 0), 0),
      vendido: validos.reduce((s, p) => s + (p.total || 0), 0),
      almuerzos,
      porTipo,
    };
  }, [pedidos]);

  const abrirCobro = (p) => {
    setCobrando(cobrando === p.id ? null : p.id);
    setRecibido(String(p.total || ""));
    setClienteSel(null);
  };

  /**
   * Anota la deuda en la cuenta del cliente.
   *
   * No manda WhatsApp aquí: queda marcada como "sin avisar" y desde Fiados se
   * envía un solo mensaje con todo lo pendiente, cuando el dueño quiera.
   */
  const anotarDeuda = async (p, monto, cliente) => {
    const detalle = (p.items || []).map((i) => `${i.cant}× ${i.descripcion}`).join(", ");

    await addDoc(collection(db, "fiados"), {
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      tipo: "deuda",
      monto,
      detalle,
      numero: p.numero,
      fecha: p.fecha,
      avisado: false,
      creado: serverTimestamp(),
    });
  };

  const cobrar = async (p) => {
    const total = p.total || 0;
    const rec = Math.max(0, Math.min(total, Number(recibido) || 0));
    const falta = total - rec;

    if (falta > 0 && !clienteSel)
      return alert(`Faltan ${money(falta)}. Elige a quién se le fía esa diferencia.`);

    await updateDoc(doc(db, "pedidos", p.id), {
      pago: falta === 0 ? "pagado" : rec === 0 ? "fiado" : "parcial",
      abonado: rec,
      clienteId: falta > 0 ? clienteSel.id : "",
      clienteFiado: falta > 0 ? clienteSel.nombre : "",
      cobrado: serverTimestamp(),
    });

    if (falta > 0) await anotarDeuda(p, falta, clienteSel);

    setCobrando(null);
    setClienteSel(null);
    setRecibido("");
  };

  const reabrir = (p) =>
    updateDoc(doc(db, "pedidos", p.id), { pago: "porCobrar", abonado: 0 });

  const anular = async (p) => {
    if (!confirm(`¿Anular el pedido #${p.numero}? Queda registrado pero no suma a la caja.`))
      return;
    await updateDoc(doc(db, "pedidos", p.id), { anulado: true });
  };

  const reactivar = (p) => updateDoc(doc(db, "pedidos", p.id), { anulado: false });

  const eliminar = async (p) => {
    if (
      !confirm(
        `¿ELIMINAR el pedido #${p.numero}?\n\nDesaparece por completo y no se puede recuperar. ` +
          `Si solo quieres que no sume a la caja, usa Anular.`
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "pedidos", p.id));
    } catch (e) {
      console.error(e);
      alert(
        "Firestore no permitió borrar el pedido.\n\n" +
          "Publica de nuevo las reglas del archivo firestore.rules en la consola de Firebase."
      );
    }
  };

  const exportarCSV = () => {
    const filas = [
      [
        "Pedido", "Mesa", "Cliente", "Para llevar", "Estado", "Debe",
        "Cant", "Descripcion", "P.Unitario", "Total",
      ],
    ];
    for (const p of r.validos)
      for (const i of p.items || [])
        filas.push([
          p.numero,
          p.mesa || "",
          p.cliente || "",
          p.paraLlevar ? "Si" : "No",
          estadoPago(p),
          p.clienteFiado || "",
          i.cant,
          i.descripcion,
          i.precioUnit,
          i.cant * i.precioUnit,
        ]);
    filas.push(
      [],
      ["", "", "", "", "", "", "", "", "EN CAJA", r.enCaja],
      ["", "", "", "", "", "", "", "", "FIADO", r.fiado],
      ["", "", "", "", "", "", "", "", "SIN COBRAR", r.sinCobrar],
      ["", "", "", "", "", "", "", "", "VENDIDO", r.vendido]
    );

    const csv = filas.map((f) => f.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `caja-${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const etiquetaEstado = (p) => {
    const e = estadoPago(p);
    if (p.anulado) return <span className="badge pend">anulado</span>;
    if (e === "porCobrar") return <span className="badge pend">por cobrar</span>;
    if (e === "pagado") return <span className="badge list">pagado</span>;
    if (e === "fiado")
      return <span className="badge fiado">fiado · {p.clienteFiado || "cliente"}</span>;
    return (
      <span className="badge fiado">
        abonó {money(p.abonado)} · debe {money(quedoDebiendo(p))}
      </span>
    );
  };

  return (
    <>
      <div className="card">
        <h2>📅 Caja</h2>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />

        <div className="seg" style={{ marginTop: 12 }}>
          <button className={vista === "cobrar" ? "on" : ""} onClick={() => setVista("cobrar")}>
            Por cobrar {r.pendientes.length > 0 && `(${r.pendientes.length})`}
          </button>
          <button className={vista === "resumen" ? "on" : ""} onClick={() => setVista("resumen")}>
            Resumen del día
          </button>
        </div>
      </div>

      {vista === "cobrar" ? (
        <div className="card">
          <h2>
            💵 Pendientes de cobrar <span className="count">{r.pendientes.length}</span>
          </h2>

          {r.pendientes.length === 0 ? (
            <p className="empty">Todo cobrado. No queda ningún pedido por liquidar.</p>
          ) : (
            r.pendientes.map((p) => (
              <div className="ped" key={p.id}>
                <div className="ped-cab">
                  <b className="num">#{p.numero}</b>
                  {p.mesa && <span className="muted">Mesa {p.mesa}</span>}
                  {p.cliente && <span className="muted">{p.cliente}</span>}
                  {p.paraLlevar && <span className="badge llevar">para llevar</span>}
                  <b className="plata">{money(p.total)}</b>
                </div>

                <div className="muted" style={{ fontSize: 13, margin: "4px 0 8px" }}>
                  {(p.items || []).map((i) => `${i.cant}× ${i.descripcion}`).join(" · ")}
                </div>

                {cobrando === p.id ? (
                  <div className="cobro">
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                      ¿Cuánto entregó?
                    </div>
                    <div className="row">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={recibido}
                        onChange={(e) => setRecibido(e.target.value)}
                      />
                      <button className="btn chico" onClick={() => setRecibido(String(p.total))}>
                        Todo
                      </button>
                      <button className="btn chico" onClick={() => setRecibido("0")}>
                        Nada
                      </button>
                    </div>

                    {(() => {
                      const rec = Math.max(0, Math.min(p.total || 0, Number(recibido) || 0));
                      const falta = (p.total || 0) - rec;

                      if (falta <= 0)
                        return (
                          <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
                            Paga completo: entran <b>{money(rec)}</b> a la caja.
                          </p>
                        );

                      if (!cfg.usarFiados)
                        return (
                          <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
                            Los fiados están apagados en Ajustes, así que no se puede
                            dejar un saldo pendiente.
                          </p>
                        );

                      return (
                        <div style={{ marginTop: 10 }}>
                          <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                            Quedan debiendo{" "}
                            <b style={{ color: "var(--danger)" }}>{money(falta)}</b>. ¿A nombre
                            de quién? Se anota en su cuenta; el aviso por WhatsApp lo mandas
                            tú desde Fiados.
                          </div>
                          <SelectorCliente
                            clientes={clientes}
                            valor={clienteSel}
                            onElegir={setClienteSel}
                          />
                        </div>
                      );
                    })()}

                    <div className="acciones" style={{ marginTop: 12 }}>
                      <button className="btn primary" onClick={() => cobrar(p)}>
                        Registrar cobro
                      </button>
                      <button className="btn" onClick={() => setCobrando(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="acciones">
                    <button className="btn primary chico" onClick={() => abrirCobro(p)}>
                      💵 Cobrar
                    </button>
                    <button className="btn chico" onClick={() => anular(p)}>
                      ⊘ Anular
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="card">
            <h2>📊 Resumen del día</h2>
            <div className="kpis">
              <div className="kpi total">
                <div className="v">{money(r.enCaja)}</div>
                <div className="l">En caja</div>
              </div>
              <div className="kpi">
                <div className="v" style={{ color: r.fiado ? "var(--danger)" : undefined }}>
                  {money(r.fiado)}
                </div>
                <div className="l">Fiado</div>
              </div>
              <div className="kpi">
                <div className="v" style={{ color: r.sinCobrar ? "#8a6412" : undefined }}>
                  {money(r.sinCobrar)}
                </div>
                <div className="l">Sin cobrar</div>
              </div>
              <div className="kpi">
                <div className="v">{r.almuerzos}</div>
                <div className="l">Almuerzos</div>
              </div>
            </div>

            <p className="muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
              Vendido <b>{money(r.vendido)}</b> en {r.validos.length} pedidos
              {r.anulados > 0 && ` · ${r.anulados} anulado${r.anulados === 1 ? "" : "s"}`}
              {r.pendientes.length > 0 && (
                <>
                  {" · "}
                  <b style={{ color: "#8a6412" }}>
                    {r.pendientes.length} sin liquidar
                  </b>
                </>
              )}
            </p>
          </div>

          {Object.keys(r.porTipo).length > 0 && (
            <div className="card">
              <h2>🍽️ Desglose</h2>
              <table className="tal">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th className="n">Cantidad</th>
                    <th className="n">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(r.porTipo).map(([tipo, v]) => (
                    <tr key={tipo}>
                      <td>{ETIQUETA_TIPO[tipo] || tipo}</td>
                      <td className="n">{v.cant}</td>
                      <td className="n">{money(v.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="n">VENDIDO</td>
                    <td className="n">{money(r.vendido)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="card">
            <h2>
              🧾 Pedidos <span className="count">{pedidos.length}</span>
            </h2>
            {pedidos.length === 0 ? (
              <p className="empty">No hay pedidos en esta fecha</p>
            ) : (
              pedidos.map((p) => (
                <div key={p.id} className={"ped" + (p.anulado ? " anulado" : "")}>
                  <div className="ped-cab">
                    <b className="num">#{p.numero}</b>
                    {p.mesa && <span className="muted">Mesa {p.mesa}</span>}
                    {p.cliente && <span className="muted">{p.cliente}</span>}
                    {p.paraLlevar && <span className="badge llevar">para llevar</span>}
                    {etiquetaEstado(p)}
                    <b className="plata">{money(p.total)}</b>
                  </div>

                  <div className="muted" style={{ fontSize: 13, margin: "4px 0 8px" }}>
                    {(p.items || []).map((i) => `${i.cant}× ${i.descripcion}`).join(" · ")}
                  </div>

                  <div className="acciones">
                    {p.anulado ? (
                      <button className="btn chico" onClick={() => reactivar(p)}>
                        ↩︎ Reactivar
                      </button>
                    ) : (
                      <>
                        {estadoPago(p) !== "porCobrar" && (
                          <button className="btn chico" onClick={() => reabrir(p)}>
                            ↩︎ Reabrir cobro
                          </button>
                        )}
                        <button className="btn chico" onClick={() => anular(p)}>
                          ⊘ Anular
                        </button>
                      </>
                    )}
                    <button className="btn chico del" onClick={() => eliminar(p)}>
                      🗑 Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button className="btn block ghost" style={{ marginBottom: 20 }} onClick={exportarCSV}>
            ⬇️ Descargar CSV del día
          </button>
        </>
      )}
    </>
  );
}
