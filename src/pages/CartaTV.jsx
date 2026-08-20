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

/**
 * Cuántas fichas caben de ancho en una zona que ocupa toda la pantalla.
 *
 * Es la medida que manda en toda la carta: la tarjeta siempre mide un sexto
 * del ancho útil. Una zona de media pantalla lleva la mitad de columnas, así
 * que la tarjeta le queda igual de grande. Por eso agregar o quitar una
 * categoría ya no cambia el tamaño de nada.
 */
const COLS_ZONA = 6;

/** Ancho de la tarjeta y hueco entre tarjetas, medidos en em. */
const ANCHO_EM = 30;
const HUECO_EM = 0.9;

/**
 * Entre qué límites se mueve la parte del alto que se lleva la foto.
 *
 * Es una sola medida para toda la carta, no una por tarjeta: si cada foto se
 * quedara con lo que le sobre a su texto, dos tarjetas de la misma zona
 * tendrían fotos de distinto alto según si el nombre cupo en uno o en dos
 * renglones. En una pantalla alta la foto se lleva el tope; en una bajita cede
 * hasta el mínimo antes que ponerse a achicar la letra.
 */
const FOTO_MAX = 0.58;
const FOTO_MIN = 0.45;

/**
 * Cada cuánto rotan las tandas.
 *
 * Todos los bloques cambian a la vez y con el mismo ritmo: lo que no cabe en
 * su zona espera su turno en vez de obligar a encoger la carta entera. Diez
 * segundos alcanzan para leer una tanda sin sentir que la pantalla apura.
 */
const TURNO = 10000;

/**
 * Cómo se reparte la pantalla según cuántos bloques haya hoy.
 *
 * `cols` y `filas` son cuántas de las dos columnas y de los dos renglones del
 * tablero ocupa la zona. Con los tres bloques el menú del día va arriba de
 * lado a lado, y abajo las meriendas y los especiales a medias.
 */
const ZONAS = {
  3: {
    orden: ["corriente", "merienda", "especial"],
    zona: { corriente: { cols: 2, filas: 1 }, merienda: { cols: 1, filas: 1 }, especial: { cols: 1, filas: 1 } },
  },
  2: { zona: { cols: 2, filas: 1 } },
  1: { zona: { cols: 2, filas: 2 } },
};

/** Cuántas fichas caben en una zona: media pantalla de ancho, la mitad. */
const cupoDe = (z) => ((z.cols === 2 ? COLS_ZONA : COLS_ZONA / 2) * z.filas);
const columnasDe = (z) => (z.cols === 2 ? COLS_ZONA : COLS_ZONA / 2);

/**
 * La carta en el TV del comedor: lo que hay hoy, con foto y precio.
 *
 * Se abre con  .../#/carta  en pantalla completa. La pantalla se parte en
 * zonas fijas y lo que no cabe se turna, así que el tamaño de las tarjetas no
 * depende de cuántos platos haya. Se actualiza sin recargar.
 */
export default function CartaTV() {
  const [fecha, setFecha] = useState(hoy());
  const [platos, setPlatos] = useState([]);
  const [fijo, setFijo] = useState(MENU_VACIO);
  const [precios, setPrecios] = useState(PRECIOS_DEF);
  const [ahora, setAhora] = useState(Date.now());
  const [zoom, setZoom] = useState(() => Number(recordar.leer(CLAVE_ZOOM)) || 1);
  const [listas, setListas] = useState(0);
  /** Cuál tanda de meriendas está en pantalla en este momento. */
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
  const conContenido = BLOQUES.filter((b) => grupos[b.clave].length > 0);
  const hayVarios = conContenido.length > 1;
  const vacia = conContenido.length === 0;

  /**
   * El reparto del día: qué zona le toca a cada bloque y cuántas fichas le
   * caben. De ahí sale en cuántas tandas se turna cada uno.
   */
  const reparto = ZONAS[conContenido.length] || ZONAS[1];
  const enPantalla = (reparto.orden || conContenido.map((b) => b.clave))
    .map((clave) => {
      const b = BLOQUES.find((x) => x.clave === clave);
      const lista = grupos[clave] || [];
      const zona = reparto.zona[clave] || reparto.zona;
      const cupo = cupoDe(zona);
      return { ...b, lista, zona, cupo, lotes: Math.max(1, Math.ceil(lista.length / cupo)) };
    })
    .filter((x) => x.lista.length);

  /** El bloque que más se turna manda el ciclo: así todos cambian a la vez. */
  const masLotes = Math.max(1, ...enPantalla.map((x) => x.lotes));

  /**
   * El tamaño de letra sale de una cuenta, no de tantear hasta que quepa.
   *
   * Antes se probaba tamaño por tamaño hasta que el tablero cupiera, y por eso
   * al agregar una categoría se encogía todo. Ahora la tarjeta siempre mide un
   * sexto del ancho útil, así que el tamaño de letra sale directo de ahí; solo
   * si la pantalla es muy baja se le baja para no dejar la foto sin alto.
   */
  useLayoutEffect(() => {
    const el = tablero.current;
    if (!el) return;

    const ajustar = () => {
      // En el celular la carta se lee bajando, con su tamaño normal.
      if (window.innerWidth <= 720) {
        el.style.fontSize = "";
        return;
      }

      const zonas = el.querySelector(".carta-bloques");
      if (!zonas) return;

      // Por ancho: `COLS_ZONA` tarjetas de `ANCHO_EM` más sus huecos tienen que
      // dar justo el ancho del tablero.
      const ancho = zonas.clientWidth;
      let f = (ancho / (COLS_ZONA * ANCHO_EM + (COLS_ZONA - 1) * HUECO_EM)) * zoom;
      el.style.fontSize = f.toFixed(2) + "px";

      // Por alto: el texto tiene que caber en la parte que no es foto. Se mide
      // el renglonaje más alto de la carta, porque una tarjeta con el nombre en
      // dos líneas manda sobre las demás. Dos pasadas, porque el rótulo también
      // crece con la letra y cambia el alto de la tarjeta.
      for (let i = 0; i < 2; i++) {
        const ficha = el.querySelector(".plato");
        if (!ficha) return;

        const alto = ficha.getBoundingClientRect().height;
        const emTexto = Math.max(
          ...[...el.querySelectorAll(".plato-cuerpo")].map((t) => t.scrollHeight / f)
        );
        if (!alto || !Number.isFinite(emTexto) || emTexto <= 0) return;

        // Primero cede la foto; solo si ni cediendo alcanza, baja la letra.
        const parte = Math.min(FOTO_MAX, 1 - (emTexto * f) / alto);
        el.style.setProperty("--foto", (Math.max(FOTO_MIN, parte) * 100).toFixed(1) + "%");
        if (parte >= FOTO_MIN) break;

        f = (alto * (1 - FOTO_MIN)) / emTexto;
        el.style.fontSize = f.toFixed(2) + "px";
      }
    };

    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [platos, fijo, zoom, listas, turno]);

  // Todas las tandas cambian al tiempo y con el mismo ritmo.
  useEffect(() => {
    setTurno(0);
    if (masLotes < 2) return;
    const t = setInterval(() => setTurno((i) => i + 1), TURNO);
    return () => clearInterval(t);
  }, [masLotes]);

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
        <div className="carta-bloques">
          {enPantalla.map((b) => {
            const tanda = turno % b.lotes;
            const visibles = b.lista.slice(tanda * b.cupo, tanda * b.cupo + b.cupo);
            const columnas = columnasDe(b.zona);

            return (
              <section
                className={"carta-bloque " + b.clave}
                key={b.clave}
                style={{ gridColumn: `span ${b.zona.cols}`, gridRow: `span ${b.zona.filas}` }}
              >
                {/* El rótulo solo aparece si de verdad hay dos grupos: con un
                    solo tipo de plato, un encabezado suelto sobra. */}
                {hayVarios && <h2 className="carta-rotulo">{b.titulo}</h2>}

                <div
                  className="carta-grid"
                  /* Los renglones son los de la zona, no los que se llenen:
                     así una tanda corta conserva el tamaño de tarjeta en vez
                     de estirarse hasta ocupar toda la pantalla de alto. */
                  style={{ "--cols": String(columnas), "--filas": String(b.zona.filas) }}
                >
                  {visibles.map((p) => {
                    const { titulo, subtitulo, detalles } = resumenPlato(p);
                    const fotos = (p.fotos || []).filter(Boolean);

                    return (
                      // La tanda va en la llave para que cada cambio vuelva a
                      // entrar con su animación en vez de cambiar de golpe.
                      <article
                        className={"plato " + b.clave + (b.lotes > 1 ? " rota" : "")}
                        key={b.lotes > 1 ? `${tanda}:${p.id}` : p.id}
                      >
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

                {b.lotes > 1 && (
                  <div className="carta-puntos" aria-hidden="true">
                    {Array.from({ length: b.lotes }, (_, i) => (
                      <span key={i} className={i === tanda ? "on" : ""} />
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
