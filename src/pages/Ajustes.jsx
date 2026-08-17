import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, hashPin } from "../firebase";
import { PRECIOS_DEF } from "../lib/negocio";

const CAMPOS = [
  { key: "almuerzoNormal", label: "Almuerzo normal", ayuda: "Caldo + proteína en un solo cobro" },
  { key: "almuerzoEspecial", label: "Almuerzo especial", ayuda: "Cuando el pedido se marca como Especial" },
  { key: "soloCaldo", label: "Solo caldo", ayuda: "Cuando piden únicamente el caldo" },
  { key: "soloSeco", label: "Solo seco", ayuda: "Cuando piden únicamente la proteína" },
];

export default function Ajustes() {
  const [p, setP] = useState(PRECIOS_DEF);
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState("");
  const [tienePin, setTienePin] = useState(false);

  useEffect(() => {
    const a = onSnapshot(doc(db, "config", "precios"), (s) => {
      if (s.exists()) setP({ ...PRECIOS_DEF, ...s.data() });
    });
    const b = onSnapshot(doc(db, "config", "acceso"), (s) =>
      setTienePin(!!s.data()?.pinHash)
    );
    return () => {
      a();
      b();
    };
  }, []);

  const guardarPin = async () => {
    if (!/^\d{4}$/.test(pin)) return alert("El PIN debe ser de 4 dígitos.");
    await setDoc(doc(db, "config", "acceso"), { pinHash: await hashPin(pin) });
    localStorage.setItem("restaurante.acceso", await hashPin(pin));
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
      </div>

      {ok && <div className="toast">Guardado ✓</div>}
    </>
  );
}
