import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db, hoy } from "../firebase";
import { ETIQUETA_TIPO, esAlmuerzo, money } from "../lib/negocio";

export default function Caja() {
  const [fecha, setFecha] = useState(hoy());
  const [pedidos, setPedidos] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "pedidos"), where("fecha", "==", fecha));
    return onSnapshot(q, (snap) =>
      setPedidos(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.numero - b.numero)
      )
    );
  }, [fecha]);

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

    return {
      validos,
      anulados: pedidos.length - validos.length,
      total: validos.reduce((s, p) => s + (p.total || 0), 0),
      almuerzos,
      porTipo,
    };
  }, [pedidos]);

  const anular = async (p) => {
    if (!confirm(`¿Anular el pedido #${p.numero}? No se contará en la caja.`)) return;
    await updateDoc(doc(db, "pedidos", p.id), { anulado: true });
  };

  const exportarCSV = () => {
    const filas = [
      ["Pedido", "Mesa", "Cliente", "Para llevar", "Cant", "Descripcion", "P.Unitario", "Total"],
    ];
    for (const p of r.validos)
      for (const i of p.items || [])
        filas.push([
          p.numero,
          p.mesa || "",
          p.cliente || "",
          p.paraLlevar ? "Si" : "No",
          i.cant,
          i.descripcion,
          i.precioUnit,
          i.cant * i.precioUnit,
        ]);
    filas.push([], ["", "", "", "", "", "", "TOTAL DEL DIA", r.total]);

    const csv = filas.map((f) => f.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `caja-${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="card">
        <h2>📅 Cierre de caja</h2>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>

      <div className="card">
        <h2>📊 Resumen del día</h2>
        <div className="kpis">
          <div className="kpi total">
            <div className="v">{money(r.total)}</div>
            <div className="l">Total en caja</div>
          </div>
          <div className="kpi">
            <div className="v">{r.almuerzos}</div>
            <div className="l">Almuerzos vendidos</div>
          </div>
          <div className="kpi">
            <div className="v">{r.validos.length}</div>
            <div className="l">Pedidos</div>
          </div>
          <div className="kpi">
            <div className="v">{r.anulados}</div>
            <div className="l">Anulados</div>
          </div>
        </div>
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
                <td colSpan={2} className="n">TOTAL</td>
                <td className="n">{money(r.total)}</td>
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
            <div
              key={p.id}
              style={{
                borderTop: "1px solid var(--line)",
                padding: "10px 0",
                opacity: p.anulado ? 0.45 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <b>#{p.numero}</b>
                {p.mesa && <span className="muted">Mesa {p.mesa}</span>}
                {p.cliente && <span className="muted">{p.cliente}</span>}
                {p.paraLlevar && <span className="badge llevar">para llevar</span>}
                <span className={"badge " + (p.estado === "entregado" ? "list" : "pend")}>
                  {p.anulado ? "anulado" : p.estado}
                </span>
                <b style={{ marginLeft: "auto" }}>{money(p.total)}</b>
                {!p.anulado && (
                  <button className="btn icon del" onClick={() => anular(p)}>✕</button>
                )}
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {(p.items || []).map((i) => `${i.cant}× ${i.descripcion}`).join(" · ")}
              </div>
            </div>
          ))
        )}
      </div>

      <button className="btn block ghost" style={{ marginBottom: 20 }} onClick={exportarCSV}>
        ⬇️ Descargar CSV del día
      </button>
    </>
  );
}
