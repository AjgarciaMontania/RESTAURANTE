import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  MUSICA_DEF,
  MUSICA_ID,
  ordenDePistas,
  siguientePista,
  volumenValido,
} from "../lib/musica.js";

/**
 * La música de fondo de las pantallas del comedor.
 *
 * Va en una esquina y casi no se ve: un botón redondo que se aclara al pasar
 * el mouse. La idea es dejarla sonando y olvidarse.
 *
 * El navegador NO deja que una página arranque sonido sola —es una regla suya
 * contra las páginas que gritan al abrirlas—, así que la primera vez hay que
 * tocar el botón. De ahí en adelante sigue sola, cambia de canción cuando una
 * termina y vuelve a empezar la lista al acabarse.
 */
export default function Musica() {
  const [cfg, setCfg] = useState(MUSICA_DEF);
  /** Archivos escogidos de este equipo; valen mientras no se recargue. */
  const [locales, setLocales] = useState([]);
  const [sonando, setSonando] = useState(false);
  const [i, setI] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState("");

  const audio = useRef(null);
  const archivos = useRef(null);

  useEffect(
    () =>
      onSnapshot(doc(db, "config", MUSICA_ID), (s) =>
        setCfg(s.exists() ? { ...MUSICA_DEF, ...s.data() } : MUSICA_DEF)
      ),
    []
  );

  /** Lo del equipo manda: si escogió archivos, es lo que quiere oír ahora. */
  const pistas = useMemo(() => {
    const lista = locales.length ? locales : cfg.pistas || [];
    return ordenDePistas(lista, cfg.aleatorio);
  }, [locales, cfg.pistas, cfg.aleatorio]);

  // Si cambia la lista, se arranca de nuevo desde el principio.
  useEffect(() => setI(0), [pistas.length]);

  useEffect(() => {
    if (audio.current) audio.current.volume = volumenValido(cfg.volumen);
  }, [cfg.volumen, i]);

  // Los enlaces temporales de los archivos locales se sueltan al cambiarlos.
  useEffect(
    () => () => locales.forEach((p) => p.url?.startsWith("blob:") && URL.revokeObjectURL(p.url)),
    [locales]
  );

  const actual = pistas[i] || null;

  const tocar = async () => {
    const el = audio.current;
    if (!el || !actual) return;
    try {
      el.volume = volumenValido(cfg.volumen);
      await el.play();
      setSonando(true);
      setAviso("");
    } catch {
      setSonando(false);
      setAviso("El navegador no dejó arrancar el sonido. Vuelve a tocar el botón.");
    }
  };

  const parar = () => {
    audio.current?.pause();
    setSonando(false);
  };

  const saltar = () => {
    setI((k) => siguientePista(k, pistas.length));
    // El navegador ya tiene permiso, así que la siguiente arranca sola.
    if (sonando) setTimeout(() => audio.current?.play().catch(() => setSonando(false)), 0);
  };

  const escoger = (e) => {
    const elegidos = [...(e.target.files || [])];
    if (!elegidos.length) return;
    setLocales(
      elegidos.map((f, k) => ({
        id: "local" + k,
        nombre: f.name.replace(/\.[a-z0-9]+$/i, ""),
        url: URL.createObjectURL(f),
      }))
    );
    setI(0);
    setAviso("");
  };

  // Apagada en Ajustes y sin archivos escogidos: ni se asoma.
  if (!cfg.activa && !locales.length) return null;

  return (
    <div className={"musica" + (abierto ? " abierta" : "") + (sonando ? " sonando" : "")}>
      <audio
        ref={audio}
        src={actual?.url || ""}
        onEnded={saltar}
        onError={() => {
          setAviso("Esa pista no se pudo abrir. Saltando a la siguiente…");
          saltar();
        }}
      />

      <button
        className="musica-btn"
        onClick={() => (sonando ? parar() : tocar())}
        title={sonando ? "Pausar la música" : "Poner música"}
        aria-label={sonando ? "Pausar la música" : "Poner música"}
      >
        {sonando ? "❚❚" : "▶"}
      </button>

      <button
        className="musica-btn chico"
        onClick={() => setAbierto((v) => !v)}
        title="Opciones de música"
        aria-label="Opciones de música"
      >
        ♪
      </button>

      {abierto && (
        <div className="musica-panel">
          <p className="musica-ahora">
            {actual ? actual.nombre : "Sin pistas cargadas"}
            {pistas.length > 1 && (
              <em>
                {" "}
                · {i + 1} de {pistas.length}
              </em>
            )}
          </p>

          <div className="musica-acciones">
            <button className="musica-btn chico" onClick={saltar} disabled={pistas.length < 2}>
              ⏭
            </button>
            <button className="musica-btn chico" onClick={() => archivos.current?.click()}>
              📁 De este equipo
            </button>
          </div>

          {locales.length > 0 && (
            <p className="musica-nota">
              Sonando {locales.length} archivo{locales.length === 1 ? "" : "s"} de este
              computador. Al recargar la página hay que volver a escogerlos.
            </p>
          )}
          {aviso && <p className="musica-nota alerta">{aviso}</p>}

          <input
            ref={archivos}
            type="file"
            accept="audio/*"
            multiple
            hidden
            onChange={escoger}
          />
        </div>
      )}
    </div>
  );
}
