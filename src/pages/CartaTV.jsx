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
import Musica from "../components/Musica.jsx";

const CLAVE_ZOOM = "restaurante.cartaZoom";

/**
 * Entre cuántas fichas de ancho puede repartirse una zona de pantalla completa.
 *
 * El número exacto lo calcula el componente con la forma de la pantalla, para
 * que la foto quede siempre en 5:4 sin recortar el plato: en un TV alto caben
 * pocas y grandes, en una ventana bajita caben más y más angostas. Sea cual
 * sea, es el mismo para toda la carta —una zona de media pantalla lleva la
 * mitad—, así que la tarjeta mide igual en los tres bloques y agregar una
 * categoría no cambia el tamaño de nada. Siempre par, para que la mitad dé
 * exacta.
 */
const COLS_MIN = 4;
const COLS_MAX = 12;

/** Proporción de la foto: 5 de ancho por 4 de alto. */
const FOTO_RATIO = 0.8;

/** Ancho de la tarjeta y hueco entre tarjetas, medidos en em. */
const ANCHO_EM = 30;
const HUECO_EM = 0.9;

/**
 * Qué parte del alto de la tarjeta puede llevarse la foto.
 *
 * La foto se estira hasta donde arranca el texto: así no queda espacio en
 * blanco debajo del precio. Es una sola medida para toda la carta, no una por
 * tarjeta —se calcula con el texto más largo que haya—, porque si cada foto se
 * quedara con lo que le sobre a la suya, dos tarjetas vecinas quedarían con
 * fotos de distinto alto según si el nombre cupo en uno o en dos renglones.
 */
const FOTO_MAX = 0.82;
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
const columnasDe = (z, cols) => (z.cols === 2 ? cols : cols / 2);
const cupoDe = (z, cols) => columnasDe(z, cols) * z.filas;

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
  /** Cuántas fichas de ancho lleva una zona de pantalla completa. */
  const [cols, setCols] = useState(6);

  const tablero = useRef(null);
  /**
   * Cuántas veces se ha corregido el número de columnas sin que cambie el
   * menú. Cambiar de columnas cambia el ancho de la tarjeta, y con él cómo
   * parte el texto, así que la cuenta podría quedar rebotando entre dos
   * valores. Con dos correcciones ya está afinado; de ahí en adelante se
   * queda quieto.
   */
  const pasos = useRef(0);
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
      const cupo = cupoDe(zona, cols);
      return { ...b, lista, zona, cupo, lotes: Math.max(1, Math.ceil(lista.length / cupo)) };
    })
    .filter((x) => x.lista.length);

  /** El bloque que más se turna manda el ciclo: así todos cambian a la vez. */
  const masLotes = Math.max(1, ...enPantalla.map((x) => x.lotes));

  /**
   * Cuántas columnas y de qué tamaño: una cuenta, no tantear hasta que quepa.
   *
   * La zona siempre es media pantalla de alto, y ahí adentro tiene que caber la
   * tarjeta entera: la foto en 5:4 más el texto. De esa igualdad sale el ancho
   * de tarjeta que le sirve a esta pantalla, y de ahí cuántas caben de ancho y
   * qué tamaño de letra les toca.
   *
   *   alto de tarjeta = foto + texto = 0.8·ancho + texto
   *   ancho = ANCHO_EM · letra   y   texto = emTexto · letra
   *
   * Despejando la letra sale directo, sin probar tamaño por tamaño. Como el
   * alto de zona no depende de cuántos bloques haya, la tarjeta mide igual con
   * una, dos o tres categorías: lo que sobra se turna.
   */
  useLayoutEffect(() => {
    const el = tablero.current;
    if (!el) return;

    /**
     * Cuánto mide de verdad el texto de una tarjeta.
     *
     * Hay que soltarlo un momento de la rejilla para medirlo: mientras esté
     * ocupando su casilla, lo que se lee es el alto de la casilla y no el del
     * texto, y la cuenta se quedaría dando vueltas sobre sí misma.
     */
    const medirTexto = (t) => {
      const antes = t.getAttribute("style") || "";
      t.style.flex = "none";
      t.style.height = "auto";
      const alto = t.getBoundingClientRect().height;
      t.setAttribute("style", antes);
      return alto;
    };

    const ajustar = () => {
      // En el celular la carta se lee bajando, con su tamaño normal.
      if (window.innerWidth <= 720) {
        el.style.fontSize = "";
        return;
      }

      const zonas = el.querySelector(".carta-bloques");
      const ficha = el.querySelector(".plato-cuerpo");
      if (!zonas || !ficha) return;

      const previo = parseFloat(getComputedStyle(el).fontSize) || 16;
      const ancho = zonas.clientWidth;
      const alto = zonas.clientHeight;
      if (!ancho || !alto) return;

      // Lo que ocupan texto y rótulo, medido en em: no cambia al cambiar la
      // letra, así que sirve para despejar de una.
      const emTexto = Math.max(
        ...[...el.querySelectorAll(".plato-cuerpo")].map((t) => medirTexto(t) / previo)
      );
      const rotulo = el.querySelector(".carta-rotulo");
      const emRotulo = rotulo ? rotulo.getBoundingClientRect().height / previo + 0.45 : 0;
      if (!Number.isFinite(emTexto) || emTexto <= 0) return;

      // Dos zonas de alto, con su hueco (1em) y su rótulo cada una.
      const letra = alto / (2 * (FOTO_RATIO * ANCHO_EM + emTexto + emRotulo) + 1);

      // Cuántas tarjetas de ese ancho caben, en par para que la media zona dé
      // exacta, y la letra final para que llenen el ancho justo.
      const cabe = ancho / (ANCHO_EM * letra + HUECO_EM * letra);
      const n = Math.max(COLS_MIN, Math.min(COLS_MAX, Math.round(cabe / 2) * 2));
      const f = (ancho / (n * ANCHO_EM + (n - 1) * HUECO_EM)) * zoom;

      el.style.fontSize = f.toFixed(2) + "px";
      if (n !== cols && pasos.current < 2) {
        pasos.current += 1;
        setCols(n);
      }

      // La foto se estira hasta donde arranca el texto, para que no quede
      // espacio en blanco. La medida se saca por zona y no para toda la carta:
      // dentro de una zona las tarjetas van lado a lado y tienen que quedar
      // iguales, pero un bloque de nombres largos no tiene por qué achicarle la
      // foto al bloque de al lado.
      for (const bloque of el.querySelectorAll(".carta-bloque")) {
        const tarjeta = bloque.querySelector(".plato");
        if (!tarjeta) continue;

        const altoTarjeta = tarjeta.getBoundingClientRect().height;
        const emTexto2 = Math.max(
          ...[...bloque.querySelectorAll(".plato-cuerpo")].map((t) => medirTexto(t) / f)
        );
        if (!altoTarjeta || !Number.isFinite(emTexto2)) continue;

        const parte = Math.min(FOTO_MAX, 1 - (emTexto2 * f) / altoTarjeta);
        bloque.style.setProperty("--foto", (Math.max(FOTO_MIN, parte) * 100).toFixed(1) + "%");
      }
    };

    const reajustar = () => {
      pasos.current = 0;
      ajustar();
    };

    ajustar();
    window.addEventListener("resize", reajustar);
    return () => window.removeEventListener("resize", reajustar);
  }, [platos, fijo, zoom, listas, turno, cols]);

  // Menú nuevo, tanda nueva o zoom nuevo: la cuenta de columnas vuelve a abrirse.
  useEffect(() => {
    pasos.current = 0;
  }, [platos, fijo, zoom, turno]);

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

      <Musica />

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
            const columnas = columnasDe(b.zona, cols);

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
