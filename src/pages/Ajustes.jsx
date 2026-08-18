import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, hashPin } from "../firebase";
import { PRECIOS_DEF } from "../lib/negocio";
import { useVersionCorta } from "../lib/version.js";
import { useAdmin } from "../lib/admin.jsx";
import { PLANTILLAS_DEF, VARIABLES, armarMensaje } from "../lib/fiados.js";
import { money } from "../lib/negocio";

const OPCIONES = [
  {
    key: "usarMesas",
    label: "Número de mesa",
    si: "El talonario pide la mesa y el TV la muestra en la comanda.",
    no: "Apagado: el talonario arranca directo en el menú.",
  },
  {
    key: "usarCliente",
    label: "Nombre del cliente",
    si: "Se puede escribir a nombre de quién va el pedido; aparece en el TV.",
    no: "Apagado: no se pide el nombre.",
  },
  {
    key: "usarParaLlevar",
    label: "Para llevar",
    si: "El mesero marca si la comida se empaca o se sirve en el local.",
    no: "Apagado: nunca se marca ni se muestra en el TV.",
  },
  {
    key: "usarFiados",
    label: "Fiados",
    si: "Se puede dejar un pedido debiendo y se lleva la cuenta del cliente.",
    no: "Apagado: todos los pedidos se cobran de una.",
  },
];

/** Datos de mentira para la vista previa del mensaje. */
const EJEMPLO = {
  cliente: "Javier Ramírez",
  fecha: "17 de agosto de 2026",
  detalle: "1× CALDO DE PESCADO + ARROZ, PECHUGA",
  monto: money(12000),
  saldo: money(36000),
  negocio: "Restaurante",
};

const MENSAJES = [
  { key: "fiado", titulo: "Cuando queda debiendo", icono: "📒" },
  { key: "abono", titulo: "Cuando abona", icono: "💵" },
  { key: "estado", titulo: "Estado de cuenta", icono: "📄" },
];

const CAMPOS = [
  { key: "almuerzoNormal", label: "Almuerzo normal", ayuda: "Caldo o sopa + proteína, principio y huevos, en un solo cobro" },
  { key: "almuerzoEspecial", label: "Almuerzo especial", ayuda: "Cuando el pedido se marca como Especial" },
  { key: "soloCaldo", label: "Solo caldo o sopa", ayuda: "Cuando piden el líquido sin proteína" },
  { key: "soloSeco", label: "Solo seco", ayuda: "Cuando piden únicamente la proteína" },
];

export default function Ajustes() {
  const [p, setP] = useState(PRECIOS_DEF);
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState("");
  const [tienePin, setTienePin] = useState(false);
  const [msgs, setMsgs] = useState(PLANTILLAS_DEF);
  const [verPrevia, setVerPrevia] = useState("");
  const version = useVersionCorta();
  const { salir, entrar, inactividadMin } = useAdmin();

  useEffect(() => {
    const a = onSnapshot(doc(db, "config", "precios"), (s) => {
      if (s.exists()) setP({ ...PRECIOS_DEF, ...s.data() });
    });
    const b = onSnapshot(doc(db, "config", "acceso"), (s) =>
      setTienePin(!!s.data()?.pinHash)
    );
    const c = onSnapshot(doc(db, "config", "mensajes"), (s) =>
      setMsgs(s.exists() ? { ...PLANTILLAS_DEF, ...s.data() } : PLANTILLAS_DEF)
    );
    return () => {
      a();
      b();
      c();
    };
  }, []);

  const guardarMensajes = async () => {
    await setDoc(doc(db, "config", "mensajes"), msgs, { merge: true });
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  };

  /** Las opciones de un solo toque se guardan solas, sin botón. */
  const guardarOpcion = async (campo, valor) => {
    setP((s) => ({ ...s, [campo]: valor }));
    await setDoc(doc(db, "config", "precios"), { [campo]: valor }, { merge: true });
  };

  const quitarPin = async () => {
    if (!confirm("¿Quitar el PIN? Cualquiera con la dirección podrá entrar.")) return;
    await setDoc(doc(db, "config", "acceso"), { pinHash: "" });
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  };

  const guardarPin = async () => {
    if (!/^\d{4}$/.test(pin)) return alert("El PIN debe ser de 4 dígitos.");
    const h = await hashPin(pin);
    await setDoc(doc(db, "config", "acceso"), { pinHash: h });
    // Quien acaba de poner el PIN no debería quedar afuera de inmediato
    setTimeout(() => entrar(pin), 300);
    setPin("");
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  };

  const guardar = async () => {
    await setDoc(doc(db, "config", "precios"), p, { merge: true });
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  };

  return (
    <>
      <div className="card">
        <h2>📋 Datos del pedido</h2>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 6px" }}>
          Prende solo lo que uses. Lo que apagues desaparece del talonario y del TV.
        </p>
        {OPCIONES.map((o) => (
          <div
            key={o.key}
            className={"switch" + (p[o.key] ? " on" : "")}
            onClick={() => guardarOpcion(o.key, !p[o.key])}
            role="switch"
            aria-checked={!!p[o.key]}
            style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 10 }}
          >
            <span className="pista" />
            <span className="txt">
              {o.label}
              <small>{p[o.key] ? o.si : o.no}</small>
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>💵 Precios base</h2>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
          Marca <b>Fijo</b> para que el precio quede bloqueado al tomar el pedido. Si lo
          desmarcas, el mesero podrá cambiarlo en cada línea del talonario.
        </p>

        {CAMPOS.map((c) => (
          <div
            key={c.key}
            style={{ borderTop: "1px solid var(--line)", padding: "12px 0" }}
          >
            <div style={{ fontWeight: 700 }}>{c.label}</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{c.ayuda}</div>
            <div className="row">
              <input
                type="number"
                inputMode="numeric"
                value={p[c.key] ?? ""}
                onChange={(e) => setP({ ...p, [c.key]: Number(e.target.value) || 0 })}
              />
              <button
                className={"chip" + (p[c.key + "Fijo"] ? " on" : "")}
                onClick={() => setP({ ...p, [c.key + "Fijo"]: !p[c.key + "Fijo"] })}
              >
                {p[c.key + "Fijo"] ? "🔒 Fijo" : "✏️ Editable"}
              </button>
            </div>
          </div>
        ))}

        <button className="btn primary block" style={{ marginTop: 14 }} onClick={guardar}>
          Guardar precios
        </button>
      </div>

      <div className="card">
        <h2>🍳 Cocina</h2>
        <div style={{ fontWeight: 700 }}>Quitar la comanda del TV sola</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          Pasado este tiempo la comanda se marca como entregada y libera espacio en
          la pantalla. El botón «Entregado» sigue funcionando para sacarla antes.
        </div>
        <div className="chips">
          {[0, 10, 15, 30, 45, 60].map((m) => (
            <button
              key={m}
              className={"chip" + ((p.autoEntregarMin ?? 30) === m ? " on" : "")}
              onClick={() => guardarOpcion("autoEntregarMin", m)}
            >
              {m === 0 ? "Nunca" : `${m} min`}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>💬 Mensajes de WhatsApp</h2>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
          Escríbelos como quieras. Lo que va entre llaves se reemplaza por los datos
          reales al momento de enviar.
        </p>

        <div style={{ fontWeight: 700, marginBottom: 6 }}>Nombre del negocio</div>
        <input
          type="text"
          placeholder="Ej: Restaurante Doña Rosa"
          value={p.nombreNegocio ?? ""}
          onChange={(e) => setP({ ...p, nombreNegocio: e.target.value })}
          onBlur={(e) => guardarOpcion("nombreNegocio", e.target.value)}
        />

        <div
          className="muted"
          style={{
            fontSize: 12, marginTop: 14, padding: "10px 12px",
            background: "var(--surface-2)", borderRadius: 9,
          }}
        >
          <b style={{ color: "var(--text)" }}>Palabras que puedes usar</b>
          {VARIABLES.map((x) => (
            <div key={x.v} style={{ marginTop: 4 }}>
              <code>{x.v}</code> — {x.q}
            </div>
          ))}
        </div>

        {MENSAJES.map((m) => (
          <div key={m.key} style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {m.icono} {m.titulo}
            </div>
            <textarea
              rows={8}
              value={msgs[m.key] ?? ""}
              onChange={(e) => setMsgs({ ...msgs, [m.key]: e.target.value })}
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1.5 }}
            />
            <div className="acciones" style={{ marginTop: 8 }}>
              <button
                className="btn chico"
                onClick={() => setVerPrevia(verPrevia === m.key ? "" : m.key)}
              >
                {verPrevia === m.key ? "Ocultar" : "Ver ejemplo"}
              </button>
              <button
                className="btn chico"
                onClick={() => setMsgs({ ...msgs, [m.key]: PLANTILLAS_DEF[m.key] })}
              >
                Restaurar
              </button>
            </div>

            {verPrevia === m.key && (
              <div className="burbuja">
                {armarMensaje(msgs[m.key], {
                  ...EJEMPLO,
                  negocio: p.nombreNegocio || EJEMPLO.negocio,
                  detalle:
                    m.key === "estado"
                      ? "• 2026-08-12 — consumo: $12.000\n• 2026-08-15 — abono: $10.000\n• 2026-08-17 — consumo: $12.000"
                      : EJEMPLO.detalle,
                })}
              </div>
            )}
          </div>
        ))}

        <button className="btn primary block" style={{ marginTop: 14 }} onClick={guardarMensajes}>
          Guardar mensajes
        </button>
      </div>

      <div className="card">
        <h2>📺 Pantalla del TV</h2>
        <p className="muted" style={{ fontSize: 14, margin: "0 0 10px" }}>
          En el TV abre esta misma dirección terminada en <b>#/cocina</b> y déjala en
          pantalla completa. Los pedidos entran solos, sin recargar.
        </p>
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 13,
            wordBreak: "break-all",
          }}
        >
          {typeof window !== "undefined" &&
            window.location.href.split("#")[0] + "#/cocina"}
        </div>
      </div>

      <div className="card">
        <h2>🔐 PIN de acceso</h2>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
          {tienePin
            ? "Hay un PIN activo. Si lo cambias, todos los dispositivos tendrán que digitar el nuevo (incluido el TV)."
            : "Todavía no hay PIN. Ponle uno para que nadie más pueda entrar con la dirección de la página."}
        </p>
        <div className="row">
          <input
            type="number"
            inputMode="numeric"
            placeholder="4 dígitos"
            value={pin}
            onChange={(e) => setPin(e.target.value.slice(0, 4))}
          />
          <button className="btn primary" onClick={guardarPin} disabled={pin.length !== 4}>
            {tienePin ? "Cambiar" : "Activar"}
          </button>
        </div>

        <div
          className="muted"
          style={{ fontSize: 13, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}
        >
          <b style={{ color: "var(--text)" }}>Qué protege el PIN</b>
          <div style={{ marginTop: 6 }}>🔓 <b>Menú</b> y <b>Pedido</b> — libres, sin PIN</div>
          <div>🔒 <b>Cocina</b>, <b>Caja</b> y <b>Ajustes</b> — solo administrador</div>
          <div style={{ marginTop: 6 }}>
            La sesión se cierra al salir de la app y también tras{" "}
            <b>{inactividadMin} minutos</b> sin tocar la pantalla. El TV es la
            excepción: se autoriza una vez y queda recordado.
          </div>
        </div>

        {tienePin && (
          <>
            <button className="btn block" style={{ marginTop: 12 }} onClick={salir}>
              Cerrar sesión de administrador en este equipo
            </button>
            <button className="btn block del" style={{ marginTop: 8 }} onClick={quitarPin}>
              Quitar el PIN
            </button>
          </>
        )}
      </div>

      <p className="muted" style={{ textAlign: "center", fontSize: 12, marginBottom: 24 }}>
        Versión <b>v{version}</b> · si el TV muestra otra, todavía no se ha
        actualizado
      </p>

      {ok && <div className="toast">Guardado ✓</div>}
    </>
  );
}
