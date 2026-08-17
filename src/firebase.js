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

/**
 * SHA-256 en hexadecimal — el PIN nunca se guarda en texto plano.
 *
 * crypto.subtle solo existe en contextos seguros (https). Si por alguna razón
 * no está disponible se usa una alternativa simple, para que la app no se
 * quede bloqueada sin poder validar el PIN.
 */
export async function hashPin(pin) {
  const texto = "restaurante:" + pin;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < texto.length; i++) {
    h1 = Math.imul(h1 ^ texto.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 + texto.charCodeAt(i), 2246822519) >>> 0;
  }
  return "alt" + h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/** localStorage puede fallar (modo incógnito, WebView restringido). */
export const recordar = {
  leer(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  guardar(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      console.warn("No se pudo recordar este dispositivo:", e);
    }
  },
  borrar(k) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nada que hacer */
    }
  },
};

/**
 * Zona horaria del restaurante.
 *
 * Se fija a propósito: si un celular o un TV Box tiene mal la hora o la zona,
 * la app seguiría mostrando la hora de Colombia y, sobre todo, los pedidos
 * seguirían cayendo en el día correcto.
 */
export const ZONA = "America/Bogota";

const fmtFecha = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de hoy en Colombia, formato YYYY-MM-DD. Es el id del menú del día. */
export function hoy() {
  return fmtFecha.format(new Date());
}

/** Hora de Colombia, para el reloj de la cocina. */
export function horaColombia(ms) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}
