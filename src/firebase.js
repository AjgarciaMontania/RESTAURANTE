import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCMj7HWzzoz_5f5x38JVB5DGVB0Hlv1ygM",
  authDomain: "restaurante-c0b66.firebaseapp.com",
  projectId: "restaurante-c0b66",
  storageBucket: "restaurante-c0b66.firebasestorage.app",
  messagingSenderId: "753277705919",
  appId: "1:753277705919:web:92aad1a479450db549b00a",
};

const app = initializeApp(firebaseConfig);

/**
 * Caché local persistente: si el WiFi del local se cae, la app sigue funcionando
 * con los datos del día y sincroniza sola apenas vuelve la conexión.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

/**
 * Sesión anónima: no le pide nada al usuario, pero le da a Firestore una
 * identidad con la cual las reglas de seguridad pueden bloquear a cualquiera
 * que intente escribir en la base por fuera de la app.
 */
export const auth = getAuth(app);
export const sesionLista = signInAnonymously(auth).catch((e) => {
  console.error("No se pudo iniciar sesión anónima:", e);
});

/** SHA-256 en hexadecimal — el PIN nunca se guarda en texto plano. */
export async function hashPin(pin) {
  const datos = new TextEncoder().encode("restaurante:" + pin);
  const buf = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Fecha local (Colombia) en formato YYYY-MM-DD, usada como id del menú del día */
export function hoy() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 10);
}
