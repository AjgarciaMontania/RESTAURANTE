import { createContext, useContext, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, hashPin, recordar } from "../firebase";

/** Autorización de esta sesión: se borra al cerrar la app. */
const CLAVE_SESION = "restaurante.admin";
/** Autorización permanente del equipo: solo la usa el TV de la cocina. */
const CLAVE_EQUIPO = "restaurante.equipoCocina";

/** Minutos sin tocar la pantalla tras los cuales se cierra la sesión. */
const INACTIVIDAD_MIN = 5;

const Ctx = createContext(null);

const sesion = {
  leer(k) {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  guardar(k, v) {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* sin almacenamiento: solo dura mientras la pantalla esté abierta */
    }
  },
  borrar(k) {
    try {
      sessionStorage.removeItem(k);
    } catch {
      /* nada que hacer */
    }
  },
};

/**
 * Roles del sistema.
 *
 *  - Libre : Menú y Pedido. El mesero toma pedidos sin digitar nada.
 *  - Admin : Cocina, Caja y Ajustes.
 *
 * La sesión de administrador vive mientras la app esté abierta: al cerrarla y
 * volver a abrirla, vuelve a pedir el PIN. La excepción es el TV de la cocina,
 * que se autoriza una sola vez y queda recordado para siempre — si no, se
 * quedaría bloqueado cada vez que se reinicia.
 *
 * Si todavía no hay PIN configurado, todo queda abierto, para que el dueño
 * pueda entrar la primera vez y ponerlo.
 */
export function AdminProvider({ children }) {
  const [pinHash, setPinHash] = useState(undefined); // undefined = cargando
  const [esAdmin, setEsAdmin] = useState(false);
  const [equipoCocina, setEquipoCocina] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "config", "acceso"),
        (s) => setPinHash(s.exists() ? s.data().pinHash || null : null),
        () => setPinHash(null)
      ),
    []
  );

  useEffect(() => {
    if (pinHash === undefined) return;
    if (!pinHash) {
      setEsAdmin(true);
      setEquipoCocina(true);
      return;
    }
    setEsAdmin(sesion.leer(CLAVE_SESION) === pinHash);
    setEquipoCocina(recordar.leer(CLAVE_EQUIPO) === pinHash);
  }, [pinHash]);

  /**
   * @param {string} pin
   * @param {boolean} permanente  true solo en el TV: recuerda el equipo para siempre
   */
  const entrar = async (pin, permanente = false) => {
    const h = await hashPin(pin);
    if (h !== pinHash) return false;
    sesion.guardar(CLAVE_SESION, h);
    ultimaActividad.current = Date.now();
    setEsAdmin(true);
    if (permanente) {
      recordar.guardar(CLAVE_EQUIPO, h);
      setEquipoCocina(true);
    }
    return true;
  };

  /** Cierra solo la sesión: el TV sigue autorizado y no se bloquea. */
  const cerrarSesion = () => {
    sesion.borrar(CLAVE_SESION);
    setEsAdmin(false);
  };

  /** Salida explícita: también olvida este equipo. */
  const salir = () => {
    cerrarSesion();
    recordar.borrar(CLAVE_EQUIPO);
    setEquipoCocina(false);
  };

  /**
   * Cierre por inactividad.
   *
   * Si el celular queda quieto varios minutos sobre el mostrador, la sesión de
   * administrador se cierra sola y vuelve a pedir el PIN. Se mide con la hora
   * real y no con un temporizador, porque Android congela los temporizadores
   * cuando la app pasa a segundo plano.
   */
  const ultimaActividad = useRef(Date.now());

  useEffect(() => {
    if (!esAdmin) return;

    const tocar = () => {
      ultimaActividad.current = Date.now();
    };
    const eventos = ["pointerdown", "keydown", "wheel", "touchstart"];
    eventos.forEach((e) => window.addEventListener(e, tocar, { passive: true }));

    const revisar = () => {
      if (Date.now() - ultimaActividad.current > INACTIVIDAD_MIN * 60000) cerrarSesion();
    };
    const t = setInterval(revisar, 15000);
    document.addEventListener("visibilitychange", revisar);

    return () => {
      eventos.forEach((e) => window.removeEventListener(e, tocar));
      clearInterval(t);
      document.removeEventListener("visibilitychange", revisar);
      };
  }, [esAdmin]);

  return (
    <Ctx.Provider
      value={{
        cargando: pinHash === undefined,
        hayPin: !!pinHash,
        esAdmin,
        equipoCocina,
        entrar,
        salir,
        inactividadMin: INACTIVIDAD_MIN,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAdmin = () => useContext(Ctx);
