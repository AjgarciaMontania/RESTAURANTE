import { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, hashPin, recordar } from "../firebase";

/** Autorización de esta sesión: se borra al cerrar la app. */
const CLAVE_SESION = "restaurante.admin";
/** Autorización permanente del equipo: solo la usa el TV de la cocina. */
const CLAVE_EQUIPO = "restaurante.equipoCocina";

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
    setEsAdmin(true);
    if (permanente) {
      recordar.guardar(CLAVE_EQUIPO, h);
      setEquipoCocina(true);
    }
    return true;
  };

  const salir = () => {
    sesion.borrar(CLAVE_SESION);
    recordar.borrar(CLAVE_EQUIPO);
    setEsAdmin(false);
    setEquipoCocina(false);
  };

  return (
    <Ctx.Provider
      value={{
        cargando: pinHash === undefined,
        hayPin: !!pinHash,
        esAdmin,
        equipoCocina,
        entrar,
        salir,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAdmin = () => useContext(Ctx);
