import { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, hashPin, recordar } from "../firebase";

const CLAVE_LOCAL = "restaurante.acceso";
const Ctx = createContext(null);

/**
 * Roles del sistema.
 *
 *  - Libre  : Menú, Pedido y la pantalla de Cocina. Cualquiera con el celular
 *             puede tomar pedidos sin digitar nada.
 *  - Admin  : Caja y Ajustes. Piden el PIN una sola vez por dispositivo.
 *
 * Si todavía no hay PIN configurado, todo queda abierto — así el dueño puede
 * entrar la primera vez y ponerlo.
 */
export function AdminProvider({ children }) {
  const [pinHash, setPinHash] = useState(undefined); // undefined = cargando
  const [esAdmin, setEsAdmin] = useState(false);

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
    if (!pinHash) return setEsAdmin(true); // sin PIN, no hay nada que proteger
    setEsAdmin(recordar.leer(CLAVE_LOCAL) === pinHash);
  }, [pinHash]);

  const entrar = async (pin) => {
    const h = await hashPin(pin);
    if (h !== pinHash) return false;
    recordar.guardar(CLAVE_LOCAL, h);
    setEsAdmin(true);
    return true;
  };

  const salir = () => {
    recordar.borrar(CLAVE_LOCAL);
    setEsAdmin(false);
  };

  return (
    <Ctx.Provider
      value={{ cargando: pinHash === undefined, hayPin: !!pinHash, esAdmin, entrar, salir }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAdmin = () => useContext(Ctx);
