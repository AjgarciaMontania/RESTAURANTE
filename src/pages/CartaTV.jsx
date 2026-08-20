import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { ZONA, db, hoy, horaColombia, recordar } from "../firebase";
import { PRECIOS_DEF, money } from "../lib/negocio";
import { MENU_ID, MENU_VACIO } from "../lib/menu";
import {
  BLOQUES,
  platosDeMeriendas,
  precioPlato,
  resumenPlato,
  separarPlatos,
} from "../lib/carta";
import { fotoEnCache, leerFoto } from "../lib/fotos";
import { useVersionCorta } from "../lib/version.js";

const CLAVE_ZOOM = "restaurante.cartaZoom";
const BASE = 16;
const MIN_ESCALA = 0.42;
/**
 * A diferencia de la cocina, la carta también crece: es una cartelera para el
 * cliente y se ve pobre con tres platos chiquitos en un TV de 65".
 */
const MAX_ESCALA = 3;
const PASO = 0.05;

/**
 * Cuánto dura cada merienda en pantalla.
 *
 * Van de a una y rotando: son muchas y pequeñas, y si salen todas juntas o
 * roban el ancho de los almuerzos, la carta pierde el orden. Tres segundos
 * alcanzan para leer el nombre y el precio sin cansar.
 */
const TURNO_MERIENDA = 3000;


/**
 * La carta en el TV del comedor: lo que hay hoy, con foto y precio.
 *
 * Se abre con  .../#/carta  en pantalla completa. Igual que la de cocina, se
 * achica sola hasta que todo quepa, y se actualiza sin recargar.
 */
export default function CartaTV() {
  const [fecha, setFecha] = useState(hoy());
  const [platos, setPlatos] = useState([]);
  const [fijo, setFijo] = useState(MENU_VACIO);
  const [precios, setPrecios] = useState(PRECIOS_DEF);
  const [ahora, setAhora] = useState(Date.now());
  const [zoom, setZoom] = useState(() => Number(recordar.leer(CLAVE_ZOOM)) || 1);
  const [listas, setListas] = useState(0);
  /** Cuál merienda está en pantalla en este momento. */
  const [turno, setTurno] = useState(0);

  const tablero = useRef(null);
  const version = useVersionCorta();

  // Reloj + cambio de día a medianoche
  useEffect(() => {
    const t = setInterval(() => {
      setAhora(Date.now());
      setFecha((f) => (hoy() !== f ? hoy() : f));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const a = onSnapshot(query(collection(db, "platos"), where("fecha", "==", fecha)), (s) =>
      setPlatos(
        s.docs
          .map((x) => ({ id: x.id, ...x.data() }))
          .sort((p, q) => (p.creado?.toMillis?.() || 0) - (q.creado?.toMillis?.() || 0))
      )
    );
    const b = onSnapshot(doc(db, "config", "precios"), (s) =>
      setPrecios(s.exists() ? { ...PRECIOS_DEF, ...s.data() } : PRECIOS_DEF)
    );
    // Las meriendas salen del catálogo, no de la carta del día: son fijas.
    const c = onSnapshot(doc(db, "menus", MENU_ID), (s) =>
      setFijo(s.exists() ? { ...MENU_VACIO, ...s.data() } : MENU_VACIO)
    );
    return () => {
      a();
      b();
      c();
    };
  }, [fecha]);

  // Los especiales van en su propio bloque: es lo que le da cara a la carta.
  // Las meriendas también, y esas salen solas del catálogo.
  const grupos = { ...separarPlatos(platos), merienda: platosDeMeriendas(fijo) };
  const cuantasMeriendas = grupos.merienda.length;
  const conContenido = BLOQUES.filter((b) => grupos[b.clave].length > 0);
  const hayVarios = conContenido.length > 1;
  const vacia = conContenido.length === 0;
  /**
   * Especiales y meriendas comparten renglón cuando los dos tienen algo.
   *
   * Son bloques cortos —un especial, una merienda a la vez— y apilados dejan
   * la carta en tres renglones: el ajuste automático encoge todo para que
   * quepa y los platos se ven diminutos desde la mesa.
   */
  const pareado = grupos.especial.length > 0 && grupos.merienda.length > 0;

  /** Igual que en cocina: se reduce el tamaño hasta que todo quepa. */
  useLayoutEffect(() => {
    const el = tablero.current;
    if (!el) return;

    const desborda = () => {
      const r = document.documentElement;
      return r.scrollHeight > window.innerHeight + 2 || r.scrollWidth > window.innerWidth + 1;
    };

    const poner = (f) => el.style.fontSize = (BASE * f).toFixed(2) + "px";

    const ajustar = () => {
      let f = zoom;
      poner(f);
      let vueltas = 0;

      // En un celular la carta se lee bajando, no encogiéndola hasta que no se
      // vea nada. El ajuste automático es cosa del TV.
      if (window.innerWidth <= 720) return;

      if (desborda()) {
        while (desborda() && f > MIN_ESCALA && vueltas++ < 60) poner((f -= PASO));
        return;
      }

      // Sobra pantalla: se agranda hasta justo antes de desbordar.
      const tope = MAX_ESCALA * zoom;
      while (!desborda() && f < tope && vueltas++ < 60) poner((f += PASO));
      if (desborda()) poner(f - PASO);
    };

    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [platos, fijo, zoom, listas]);

  // Las meriendas se turnan: una a la vez, cambiando sola.
  useEffect(() => {
    setTurno(0);
    if (cuantasMeriendas < 2) return;
    const t = setInterval(
      () => setTurno((i) => (i + 1) % cuantasMeriendas),
      TURNO_MERIENDA
    );
    return () => clearInterval(t);
  }, [cuantasMeriendas]);

  const cambiarZoom = (paso) => {
    const z = Math.min(1.6, Math.max(0.6, Number((zoom + paso).toFixed(2))));
    setZoom(z);
    recordar.guardar(CLAVE_ZOOM, String(z));
  };

  const d = new Date(fecha + "T12:00:00Z").toLocaleDateString("es-CO", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const dia = d.charAt(0).toUpperCase() + d.slice(1);

  return (
    <div className="tv carta" ref={tablero}>
      <header className="tv-head">
        <span className="tv-marca" aria-hidden="true">
          <Plato />
        </span>
        <h1>{precios.nombreNegocio || "Menú de hoy"}</h1>
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
          <div className="tv-reloj">{horaColombia(ahora)}</div>
        </div>
      </header>

      <span className="tv-version" title="Versión instalada en este equipo">
        v{version}
      </span>

      {vacia ? (
        <div className="tv-empty">
          <Plato />
          <h2>Ya viene el menú</h2>
          <p>Los platos de hoy aparecen aquí solos, sin recargar</p>
        </div>
      ) : (
        <div className={"carta-bloques" + (pareado ? " pareado" : "")}>
          {BLOQUES.map((b) => {
            const delBloque = grupos[b.clave];
            if (!delBloque.length) return null;

            return (
              <section className={"carta-bloque " + b.clave} key={b.clave}>
                {/* El rótulo solo aparece si de verdad hay dos grupos: con un
                    solo tipo de plato, un encabezado suelto sobra. */}
                {hayVarios && <h2 className="carta-rotulo">{b.titulo}</h2>}

                <div className="carta-grid">
                  {(b.clave === "merienda" && delBloque.length > 1
                    ? [delBloque[turno % delBloque.length]]
                    : delBloque
                  ).map((p) => {
                    const { titulo, subtitulo, detalles } = resumenPlato(p);
                    const fotos = (p.fotos || []).filter(Boolean);

                    return (
                      <article className={"plato " + b.clave} key={p.id}>
                        <div className="plato-foto">
                          <Foto id={fotos[0]} onListo={() => setListas((n) => n + 1)} />
                          {fotos[1] && (
                            <div className="plato-foto2">
                              <Foto id={fotos[1]} onListo={() => setListas((n) => n + 1)} />
                            </div>
                          )}
                        </div>

                        <div className="plato-cuerpo">
                          <h2>{titulo}</h2>
                          {subtitulo && <p className="plato-presenta">{subtitulo}</p>}
                          <ul>
                            {detalles.map((x, k) => (
                              <li key={k}>
                                <span aria-hidden="true">{x.ic}</span> {x.txt}
                              </li>
                            ))}
                          </ul>
                          {p.nota && <p className="plato-nota">{p.nota}</p>}
                          <div className="plato-precio">{money(precioPlato(p, precios))}</div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {b.clave === "merienda" && delBloque.length > 1 && (
                  <div className="carta-puntos" aria-hidden="true">
                    {delBloque.map((x, i) => (
                      <span key={x.id} className={i === turno % delBloque.length ? "on" : ""} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Trae la foto de Firestore y avisa cuando ya ocupa su espacio. */
function Foto({ id, onListo }) {
  const [src, setSrc] = useState(() => fotoEnCache(id));

  useEffect(() => {
    let vivo = true;
    if (!id) return;
    leerFoto(id).then((x) => vivo && setSrc(x));
    return () => {
      vivo = false;
    };
  }, [id]);

  if (!src)
    return (
      <div className="plato-sinfoto">
        <Plato />
      </div>
    );
  return <img src={src} alt="" onLoad={onListo} />;
}

/** Marca de la casa: plato con cubiertos, en SVG para que se vea nítido. */
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
