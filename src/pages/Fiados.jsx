import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, hoy } from "../firebase";
import { PRECIOS_DEF, money } from "../lib/negocio";
import {
  PLANTILLAS_DEF,
  armarMensaje,
  detalleCuenta,
  enlaceWhatsApp,
  fechaLarga,
  netoPendiente,
  plantillaPara,
  saldoDe,
  sinAvisar,
} from "../lib/fiados";

/** Atajos para no escribir el concepto y el precio a mano. */
const ATAJOS = [
  { key: "almuerzoNormal", nombre: "Almuerzo" },
  { key: "almuerzoEspecial", nombre: "Almuerzo especial" },
  { key: "soloCaldo", nombre: "Caldo" },
  { key: "soloSeco", nombre: "Seco" },
];

const FORM_VACIO = { fecha: "", concepto: "", cant: 1, valor: "" };

export default function Fiados() {
  const [clientes, setClientes] = useState([]);
  const [movs, setMovs] = useState([]);
  const [plantillas, setPlantillas] = useState(PLANTILLAS_DEF);
  const [cfg, setCfg] = useState(PRECIOS_DEF);

  const [abierto, setAbierto] = useState(null); // cliente desplegado
  const [abono, setAbono] = useState("");
  const [nuevo, setNuevo] = useState(null); // alta de cliente
  const [form, setForm] = useState(null); // { modo: 'consumo' | 'saldo', ...FORM_VACIO }

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
      setCfg(s.exists() ? { ...PRECIOS_DEF, ...s.data() } : PRECIOS_DEF)
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
  const porAvisar = cuentas.filter((c) => sinAvisar(c.movs).length > 0).length;

  const abrirWhatsApp = (c, plantilla, datos) => {
    window.open(
      enlaceWhatsApp(
        c.telefono,
        armarMensaje(plantilla, { negocio: cfg.nombreNegocio || "Restaurante", ...datos })
      ),
      "_blank"
    );
  };

  /**
   * Avisa de una sola vez todo lo que el cliente todavía no sabe.
   *
   * Nada se manda solo: los movimientos se van acumulando como "sin avisar" y
   * es el dueño quien decide cuándo mandar el mensaje, en uno consolidado.
   */
  const avisarPendientes = async (c) => {
    const pend = sinAvisar(c.movs);
    if (!pend.length) return;
    if (!c.telefono) return alert(`${c.nombre} no tiene celular registrado.`);

    const clave = plantillaPara(pend);
    const neto = netoPendiente(c.movs);

    abrirWhatsApp(c, plantillas[clave], {
      cliente: c.nombre,
      fecha: fechaLarga(hoy()),
      detalle: detalleCuenta(pend),
      monto: money(Math.abs(neto)),
      saldo: money(Math.max(0, c.saldo)),
    });

    await Promise.all(
      pend.map((m) => updateDoc(doc(db, "fiados", m.id), { avisado: true }))
    );
  };

  const marcarAvisados = async (c) => {
    const pend = sinAvisar(c.movs);
    if (!pend.length) return;
    await Promise.all(
      pend.map((m) => updateDoc(doc(db, "fiados", m.id), { avisado: true }))
    );
  };

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
      avisado: false,
      creado: serverTimestamp(),
    });
    setAbono("");
  };

  const abrirForm = (modo) =>
    setForm({ modo, ...FORM_VACIO, fecha: hoy(), concepto: modo === "saldo" ? "" : "Almuerzo" });

  /** Guarda un consumo cargado a mano, o el saldo que traía del cuaderno. */
  const guardarForm = async (c) => {
    const esSaldo = form.modo === "saldo";
    const cant = esSaldo ? 1 : Math.max(1, Number(form.cant) || 1);
    const valor = Number(form.valor) || 0;
    const monto = cant * valor;

    if (monto <= 0) return alert("Escribe un valor mayor que cero.");
    if (!esSaldo && !form.concepto.trim()) return alert("Escribe el concepto.");

    const detalle = esSaldo
      ? "Saldo anterior del cuaderno"
      : `${cant}× ${form.concepto.trim()}`;

    await addDoc(collection(db, "fiados"), {
      clienteId: c.id,
      clienteNombre: c.nombre,
      tipo: "deuda",
      monto,
      detalle,
      fecha: form.fecha,
      manual: true,
      // Nada se avisa solo: queda pendiente y el dueño decide cuándo mandarlo.
      // Lo viejo entra ya avisado, para no ofrecer mensajes de hace meses.
      avisado: form.fecha !== hoy(),
      creado: serverTimestamp(),
    });

    setForm(null);
  };

  const mandarEstado = (c) => {
    if (!c.telefono) return alert(`${c.nombre} no tiene celular registrado.`);
    abrirWhatsApp(c, plantillas.estado, {
      cliente: c.nombre,
      fecha: fechaLarga(hoy()),
      detalle: detalleCuenta(c.movs) || "Sin movimientos",
      monto: money(c.saldo),
      saldo: money(Math.max(0, c.saldo)),
    });
  };

  const borrarMovimiento = async (m) => {
    if (!confirm(`¿Eliminar este movimiento de ${money(m.monto)}?`)) return;
    await deleteDoc(doc(db, "fiados", m.id));
  };

  const totalForm = form
    ? (form.modo === "saldo" ? 1 : Math.max(1, Number(form.cant) || 1)) *
      (Number(form.valor) || 0)
    : 0;

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
          <div className="kpi">
            <div className="v" style={{ color: porAvisar ? "#8a6412" : undefined }}>
              {porAvisar}
            </div>
            <div className="l">Sin avisar</div>
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
                onClick={() => {
                  setAbierto(abierto === c.id ? null : c.id);
                  setForm(null);
                }}
              >
                <b className="num">{c.nombre}</b>
                {c.telefono && <span className="muted">{c.telefono}</span>}
                {sinAvisar(c.movs).length > 0 && (
                  <span className="badge pend">
                    {sinAvisar(c.movs).length} sin avisar
                  </span>
                )}
                <b
                  className="plata"
                  style={{ color: c.saldo > 0 ? "var(--danger)" : "var(--verde)" }}
                >
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
                              <td style={{ whiteSpace: "nowrap" }}>{m.fecha}</td>
                              <td>
                                {m.tipo === "abono" ? (
                                  <b style={{ color: "var(--verde)" }}>Abono</b>
                                ) : (
                                  m.detalle || "Consumo"
                                )}
                                {!m.avisado && (
                                  <span
                                    className="muted"
                                    style={{ display: "block", fontSize: 11 }}
                                  >
                                    sin avisar
                                  </span>
                                )}
                              </td>
                              <td
                                className="n"
                                style={{ color: m.tipo === "abono" ? "var(--verde)" : undefined }}
                              >
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

                  {form ? (
                    <div className="cobro" style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 10 }}>
                        {form.modo === "saldo"
                          ? "💼 Saldo que traía del cuaderno"
                          : "➕ Agregar consumo"}
                      </div>

                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                        Fecha
                      </div>
                      <input
                        type="date"
                        value={form.fecha}
                        max={hoy()}
                        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                      />

                      {form.modo === "consumo" && (
                        <>
                          <div className="muted" style={{ fontSize: 12, margin: "10px 0 6px" }}>
                            Atajos
                          </div>
                          <div className="chips">
                            {ATAJOS.map((a) => (
                              <button
                                key={a.key}
                                className="chip"
                                onClick={() =>
                                  setForm({
                                    ...form,
                                    concepto: a.nombre,
                                    valor: String(cfg[a.key] ?? ""),
                                  })
                                }
                              >
                                {a.nombre} <span className="p">{money(cfg[a.key])}</span>
                              </button>
                            ))}
                          </div>

                          <div className="muted" style={{ fontSize: 12, margin: "10px 0 4px" }}>
                            Concepto
                          </div>
                          <input
                            type="text"
                            placeholder="Ej: Almuerzo"
                            value={form.concepto}
                            onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                          />

                          <div className="muted" style={{ fontSize: 12, margin: "10px 0 4px" }}>
                            Cantidad y valor de cada uno
                          </div>
                          <div className="row">
                            <div className="stepper">
                              <button
                                onClick={() =>
                                  setForm({ ...form, cant: Math.max(1, Number(form.cant) - 1) })
                                }
                              >
                                −
                              </button>
                              <span>{form.cant}</span>
                              <button
                                onClick={() => setForm({ ...form, cant: Number(form.cant) + 1 })}
                              >
                                +
                              </button>
                            </div>
                            <input
                              type="number"
                              inputMode="numeric"
                              placeholder="Valor c/u"
                              value={form.valor}
                              onChange={(e) => setForm({ ...form, valor: e.target.value })}
                            />
                          </div>
                        </>
                      )}

                      {form.modo === "saldo" && (
                        <>
                          <div className="muted" style={{ fontSize: 12, margin: "10px 0 4px" }}>
                            Cuánto debía a esa fecha
                          </div>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="Ej: 85000"
                            value={form.valor}
                            onChange={(e) => setForm({ ...form, valor: e.target.value })}
                          />
                        </>
                      )}

                      <p className="muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
                        Se le suman <b style={{ color: "var(--danger)" }}>{money(totalForm)}</b> a
                        la cuenta de {c.nombre}.
                        {form.fecha === hoy()
                          ? " Queda pendiente de avisar; tú decides cuándo mandarlo."
                          : " Por ser de una fecha anterior, no se ofrece avisar."}
                      </p>

                      <div className="acciones" style={{ marginTop: 12 }}>
                        <button className="btn primary" onClick={() => guardarForm(c)}>
                          Guardar
                        </button>
                        <button className="btn" onClick={() => setForm(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="acciones" style={{ marginTop: 12 }}>
                      <button className="btn chico" onClick={() => abrirForm("consumo")}>
                        ➕ Agregar consumo
                      </button>
                      <button className="btn chico" onClick={() => abrirForm("saldo")}>
                        💼 Saldo anterior
                      </button>
                    </div>
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

                  {sinAvisar(c.movs).length > 0 && (
                    <div
                      style={{
                        marginTop: 12, padding: "12px", borderRadius: 10,
                        background: "#fbf3e0", border: "1px solid #ecd9ac",
                      }}
                    >
                      <div style={{ fontSize: 13, marginBottom: 8 }}>
                        Hay <b>{sinAvisar(c.movs).length} movimiento
                        {sinAvisar(c.movs).length === 1 ? "" : "s"}</b> que{" "}
                        {c.nombre} todavía no sabe. Se le manda todo en un solo mensaje.
                      </div>
                      <div className="acciones">
                        <button className="btn primary chico" onClick={() => avisarPendientes(c)}>
                          💬 Avisar por WhatsApp
                        </button>
                        <button className="btn chico" onClick={() => marcarAvisados(c)}>
                          Ya le avisé
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    className="btn block"
                    style={{ marginTop: 10 }}
                    onClick={() => mandarEstado(c)}
                  >
                    💬 Enviar estado de cuenta completo
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
