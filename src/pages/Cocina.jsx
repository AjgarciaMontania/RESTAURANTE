import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db, hoy, horaColombia, recordar, ZONA } from "../firebase";
import { useVersionCorta } from "../lib/version.js";

/** Minutos a partir de los cuales la comanda se marca como atrasada. */
const AVISO = 10;
const URGENTE = 18;

/** Renglones que no son el almuerzo: en la cocina tienen que saltar a la vista. */
const EXTRAS = {
  adicional: { texto: "Adicional", clase: "adicional" },
  especial: { texto: "Especial", clase: "especial" },
  huevo: { texto: "Huevo", clase: "huevo" },
  // La merienda ya viene rotulada en la descripción; no le hace falta insignia.
  merienda: { clase: "merienda" },
};

const CLAVE_ZOOM = "restaurante.tvZoom";
const BASE = 16;
const MIN_ESCALA = 0.42;

/** Pantalla para el TV. Se abre con  .../#/cocina  en pantalla completa. */
export default function Cocina() {
  const [fecha, setFecha] = useState(hoy());
  const [pedidos, setPedidos] = useState([]);
  const [entregados, setEntregados] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const [zoom, setZoom] = useState(() => Number(recordar.leer(CLAVE_ZOOM)) || 1);
  const [autoMin, setAutoMin] = useState(0);

  const tablero = useRef(null);
  const version = useVersionCorta();

  useEffect(
    () =>
      onSnapshot(doc(db, "config", "precios"), (s) =>
        setAutoMin(s.exists() ? Number(s.data().autoEntregarMin ?? 30) : 30)
      ),
    []
  );

  // Reloj + cambio automático de día a medianoche
  useEffect(() => {
    const t = setInterval(() => {
      setAhora(Date.now());
      setFecha((f) => (hoy() !== f ? hoy() : f));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "pedidos"), where("fecha", "==", fecha));
    return onSnapshot(q, (snap) => {
      const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => !p.anulado);
      setPedidos(todos.filter((p) => p.estado === "pendiente").sort((a, b) => a.numero - b.numero));
      setEntregados(todos.filter((p) => p.estado === "entregado").length);
    });
  }, [fecha]);

  /**
   * Ajuste automático: empieza en el tamaño elegido y lo va reduciendo hasta
   * que todas las comandas quepan sin desbordar la pantalla del TV.
   */
  useLayoutEffect(() => {
    const el = tablero.current;
    if (!el) return;

    const desborda = () => {
      const r = document.documentElement;
      return r.scrollHeight > window.innerHeight + 2 || r.scrollWidth > window.innerWidth + 1;
    };

    const ajustar = () => {
      let f = zoom;
      el.style.fontSize = BASE * f + "px";
      let vueltas = 0;
      while (desborda() && f > MIN_ESCALA && vueltas++ < 40) {
        f -= 0.035;
        el.style.fontSize = (BASE * f).toFixed(2) + "px";
      }
    };

    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [pedidos, entregados, zoom]);

  const cambiarZoom = (paso) => {
    const z = Math.min(1.6, Math.max(0.6, Number((zoom + paso).toFixed(2))));
    setZoom(z);
    recordar.guardar(CLAVE_ZOOM, String(z));
  };

  const entregar = (id) => updateDoc(doc(db, "pedidos", id), { estado: "entregado" });

  /**
   * Limpieza automática: una comanda que lleva demasiado tiempo en pantalla ya
   * salió de la cocina, así que se marca sola como entregada y libera espacio.
   * El botón manual sigue estando para cuando se quiere sacar antes.
   */
  useEffect(() => {
    if (!autoMin) return;
    const limite = autoMin * 60000;
    for (const p of pedidos) {
      const ms = p.creado?.toMillis?.();
      if (ms && ahora - ms > limite) {
        updateDoc(doc(db, "pedidos", p.id), { estado: "entregado", autoEntregado: true }).catch(
          (e) => console.warn("No se pudo cerrar la comanda sola:", e)
        );
      }
    }
  }, [pedidos, ahora, autoMin]);

  const minutos = (p) => {
    const ms = p.creado?.toMillis?.();
    return ms ? Math.max(0, Math.floor((ahora - ms) / 60000)) : 0;
  };

  const reloj = horaColombia(ahora);
  const d = new Date(fecha + "T12:00:00Z").toLocaleDateString("es-CO", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const dia = d.charAt(0).toUpperCase() + d.slice(1);

  return (
    <div className="tv" ref={tablero}>
      <header className="tv-head">
        <span className="tv-marca" aria-hidden="true">
          <Plato />
        </span>
        <h1>Cocina</h1>
        <span className="tv-dia">{dia}</span>

        <div className="tv-metricas">
          <div className="tv-zoom">
            <button onClick={() => cambiarZoom(-0.1)} disabled={zoom <= 0.6} title="Más pequeño">
              −
            </button>
            <button onClick={() => cambiarZoom(0.1)} disabled={zoom >= 1.6} title="Más grande">
              +
            </button>
          </div>
          <div className="tv-met">
            <b>{pedidos.length}</b>
            <span>en preparación</span>
          </div>
          <div className="tv-met ok">
            <b>{entregados}</b>
            <span>entregados</span>
          </div>
          <div className="tv-reloj">{reloj}</div>
        </div>
      </header>

      <span className="tv-version" title="Versión instalada en este equipo">
        v{version}
      </span>

      {pedidos.length === 0 ? (
        <div className="tv-empty">
          <Plato />
          <h2>Todo al día</h2>
          <p>Las comandas nuevas aparecen aquí solas, sin recargar</p>
        </div>
      ) : (
        <div className="tv-grid">
          {pedidos.map((p) => {
            const m = minutos(p);
            const estado = m >= URGENTE ? "urgente" : m >= AVISO ? "aviso" : "";
            const piezas = (p.items || []).reduce((s, i) => s + i.cant, 0);

            return (
              <article className={"ticket " + estado} key={p.id}>
                <div className="ticket-cinta" />

                <header className="ticket-head">
                  <span className="num">#{p.numero}</span>
                  <div className="etiquetas">
                    {p.mesa && <span className="etq mesa">Mesa {p.mesa}</span>}
                    {p.paraLlevar && <span className="etq llevar">🥡 Para llevar</span>}
                  </div>
                </header>

                {p.cliente && (
                  <div className="ticket-cliente">
                    <Persona />
                    <span>{p.cliente}</span>
                  </div>
                )}

                <ul className="ticket-items">
                  {(p.items || []).map((i, k) => {
                    const extra = EXTRAS[i.tipo];
                    // El principio y los huevos salen en su propio renglón
                    const rotulos = [
                      { txt: i.principio, ic: "🫘", clase: "principio" },
                      { txt: i.huevos, ic: "🍳", clase: "huevos" },
                    ].filter((r) => r.txt && i.descripcion.includes(r.txt));

                    const plato = rotulos.reduce(
                      (d, r) => d.replace(" + " + r.txt, "").replace(r.txt, ""),
                      i.descripcion
                    );

                    return (
                      <li key={k} className={extra ? "extra " + extra.clase : ""}>
                        <span className="cant">{i.cant}</span>
                        <span className="desc">
                          {plato || i.descripcion}
                          {extra?.texto && <em className="marca">{extra.texto}</em>}
                          {rotulos.map((r) => (
                            <span key={r.clase} className={"rotulo " + r.clase}>
                              {r.ic} {r.txt}
                            </span>
                          ))}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <footer className="ticket-pie">
                  <span className="tiempo">
                    {m === 0 ? "Recién entró" : `Hace ${m} min`}
                    <em>
                      {piezas} {piezas === 1 ? "plato" : "platos"}
                    </em>
                  </span>
                  <button className="btn-listo" onClick={() => entregar(p.id)}>
                    Entregado
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Silueta para el nombre del cliente. */
function Persona() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.5-8 5.5V22h16v-2.5c0-3-3.6-5.5-8-5.5Z" />
    </svg>
  );
}

/** Marca de la casa: plato con cubiertos, en SVG para que se vea nítido en el TV. */
function Plato() {
  return (
    <svg viewBox="0 0 512 512" fill="none">
      <circle cx="256" cy="258" r="128" stroke="#d8a94f" strokeWidth="20" />
      <circle cx="256" cy="258" r="72" fill="#d8a94f" opacity=".16" />
      <g fill="#f0e7d6">
        <rect x="106" y="92" width="17" height="122" rx="8.5" />
        <rect x="139" y="92" width="17" height="122" rx="8.5" />
        <rect x="172" y="92" width="17" height="122" rx="8.5" />
        <path d="M100 196h89c0 33-18 52-35 57v155a10 10 0 0 1-20 0V253c-17-5-34-24-34-57z" />
        <path d="M372 92c27 0 44 35 44 87 0 36-13 59-30 67v162a15 15 0 0 1-30 0V246c-17-8-30-31-30-67 0-52 19-87 46-87z" />
      </g>
    </svg>
  );
}
