import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

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

/** Fecha local (Colombia) en formato YYYY-MM-DD, usada como id del menú del día */
export function hoy() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 10);
}
