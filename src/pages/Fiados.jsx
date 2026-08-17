import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, hoy } from "../firebase";
import { PRECIOS_DEF, money } from "../lib/negocio";
import {
  PLANTILLAS_DEF,
  armarMensaje,
  detalleCuenta,
  enlaceWhatsApp,
  fechaLarga,
  saldoDe,
} from "../lib/fiados";

export default function Fiados() {
  const [clientes, setClientes] = useState([]);
  const [movs, setMovs] = useState([]);
  const [plantillas, setPlantillas] = useState(PLANTILLAS_DEF);
  const [negocio, setNegocio] = useState(PRECIOS_DEF.nombreNegocio);

  const [abierto, setAbierto] = useState(null); // id del cliente desplegado
  const [abono, setAbono] = useState("");
  const [nuevo, setNuevo] = useState(null); // { nombre, telefono, cedula }

  useEffect(() => {
    const a = onSnapshot(collection(db, "clientes"), (s) =>
      setClientes(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const b = onSnapshot(collection(db, "fiados"), (s) =>
      setMovs(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const c = onSnapshot(doc(db, "config", "mensajes"), (s) =>
      setPlantillas(s.exists() ? { ...PLANTILLAS_DEF, ...s.data() } : PLANTILLAS_DEF)
    );
    const d = onSnapshot(doc(db, "config", "precios"), (s) =>
      setNegocio(s.data()?.nombreNegocio || PRECIOS_DEF.nombreNegocio)
    );
    return () => {
      a();
      b();
      c();
      d();
    };
  }, []);

  const cuentas = useMemo(() => {
    const porCliente = {};
    for (const m of movs) (porCliente[m.clienteId] ||= []).push(m);
    return clientes
      .map((c) => {
        const mm = porCliente[c.id] || [];
        return { ...c, movs: mm, saldo: saldoDe(mm) };
      })
      .sort((a, b) => b.saldo - a.saldo || a.nombre.localeCompare(b.nombre));
  }, [clientes, movs]);

  const totalPorCobrar = cuentas.reduce((s, c) => s + Math.max(0, c.saldo), 0);
  const deudores = cuentas.filter((c) => c.saldo > 0).length;

  const crearCliente = async () => {
    const n = (nuevo?.nombre || "").trim();
    if (!n) return alert("Escribe al menos el nombre.");
    await addDoc(collection(db, "clientes"), {
      nombre: n,
      telefono: (nuevo.telefono || "").trim(),
      cedula: (nuevo.cedula || "").trim(),
      creado: serverTimestamp(),
    });
    setNuevo(null);
  };

  const registrarAbono = async (c) => {
    const monto = Number(abono) || 0;
    if (monto <= 0) return alert("Escribe el valor del abono.");

    await addDoc(collection(db, "fiados"), {
      clienteId: c.id,
      clienteNombre: c.nombre,
      tipo: "abono",
      monto,
      detalle: "",
      fecha: hoy(),
      creado: serverTimestamp(),
    });

    const nuevoSaldo = c.saldo - monto;
    setAbono("");

    if (c.telefono) {
      const msg = armarMensaje(plantillas.abono, {
        cliente: c.nombre,
        fecha: fechaLarga(hoy()),
        monto: money(monto),
        saldo: money(Math.max(0, nuevoSaldo)),
        detalle: "",
        negocio,
      });
      window.open(enlaceWhatsApp(c.telefono, msg), "_blank");
    }
  };

  const mandarEstado = (c) => {
    const msg = armarMensaje(plantillas.estado, {
      cliente: c.nombre,
      fecha: fechaLarga(hoy()),
      detalle: detalleCuenta(c.movs) || "Sin movimientos",
      monto: money(c.saldo),
      saldo: money(Math.max(0, c.saldo)),
      negocio,
    });
    window.open(enlaceWhatsApp(c.telefono, msg), "_blank");
  };

  const borrarMovimiento = async (m) => {
    if (!confirm(`¿Eliminar este movimiento de ${money(m.monto)}?`)) return;
    await deleteDoc(doc(db, "fiados", m.id));
  };

  return (
    <>
      <div className="card">
        <h2>📒 Fiados</h2>
        <div className="kpis">
          <div className="kpi total">
            <div className="v">{money(totalPorCobrar)}</div>
            <div className="l">Por cobrar</div>
          </div>
          <div className="kpi">
            <div className="v">{deudores}</div>
            <div className="l">Deben</div>
          </div>
        </div>
        <button
          className="btn ghost block"
          style={{ marginTop: 12 }}
          onClick={() => setNuevo({ nombre: "", telefono: "", cedula: "" })}
        >
          + Nuevo cliente
        </button>
      </div>

      {nuevo && (
        <div className="card">
          <h2>👤 Nuevo cliente</h2>
          <input
            type="text"
            placeholder="Nombre completo"
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            style={{ marginBottom: 8 }}
          />
          <input
            type="tel"
            inputMode="numeric"
            placeholder="Celular (ej: 3001234567)"
            value={nuevo.telefono}
            onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })}
            style={{ marginBottom: 8 }}
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Cédula (opcional)"
            value={nuevo.cedula}
            onChange={(e) => setNuevo({ ...nuevo, cedula: e.target.value })}
            style={{ marginBottom: 10 }}
          />
          <div className="acciones">
            <button className="btn primary" onClick={crearCliente}>Guardar</button>
            <button className="btn" onClick={() => setNuevo(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>
          👥 Clientes <span className="count">{cuentas.length}</span>
        </h2>

        {cuentas.length === 0 ? (
          <p className="empty">Todavía no hay clientes registrados</p>
        ) : (
          cuentas.map((c) => (
            <div className="ped" key={c.id}>
              <div
                className="ped-cab"
                style={{ cursor: "pointer" }}
                onClick={() => setAbierto(abierto === c.id ? null : c.id)}
              >
                <b className="num">{c.nombre}</b>
                {c.telefono && <span className="muted">{c.telefono}</span>}
                <b className="plata" style={{ color: c.saldo > 0 ? "var(--danger)" : "var(--verde)" }}>
                  {money(Math.max(0, c.saldo))}
                </b>
              </div>

              {abierto === c.id && (
                <div style={{ marginTop: 10 }}>
                  {c.movs.length === 0 ? (
                    <p className="empty">Sin movimientos</p>
                  ) : (
                    <table className="tal">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Concepto</th>
                          <th className="n">Valor</th>
                          <th style={{ width: 34 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {c.movs
                          .slice()
                          .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
                          .map((m) => (
                            <tr key={m.id}>
                              <td>{m.fecha}</td>
                              <td>
                                {m.tipo === "abono" ? (
                                  <b style={{ color: "var(--verde)" }}>Abono</b>
                                ) : (
                                  m.detalle || "Consumo"
                                )}
                              </td>
                              <td className="n" style={{ color: m.tipo === "abono" ? "var(--verde)" : undefined }}>
                                {m.tipo === "abono" ? "−" : ""}
                                {money(m.monto)}
                              </td>
                              <td>
                                <button
                                  className="btn icon del"
                                  style={{ minWidth: 32, minHeight: 32, padding: "0 8px" }}
                                  onClick={() => borrarMovimiento(m)}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}

                  <div className="row" style={{ marginTop: 12 }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Valor del abono"
                      value={abono}
                      onChange={(e) => setAbono(e.target.value)}
                    />
                    <button className="btn primary" onClick={() => registrarAbono(c)}>
                      Abonar
                    </button>
                  </div>

                  <button
                    className="btn block"
                    style={{ marginTop: 8 }}
                    onClick={() => mandarEstado(c)}
                  >
                    💬 Enviar estado de cuenta
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
