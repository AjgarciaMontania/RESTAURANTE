import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { uid } from "./negocio";

/**
 * Fotos de los platos, sin Firebase Storage.
 *
 * Storage exige el plan Blaze (tarjeta de crédito), así que la foto se encoge
 * y se comprime aquí mismo en el celular y se guarda como texto en Firestore.
 * Cada foto va en su propio documento (`fotos/{id}`) por dos razones: el tope
 * de 1 MB de Firestore aplica por documento, y así el TV puede cargar la lista
 * de platos al instante y traer las imágenes después.
 */

/** Lado mayor de la foto guardada. De sobra para un TV de 65". */
const LADOS = [1280, 1024, 800, 640];
const CALIDADES = [0.74, 0.64, 0.55, 0.45];

/** Tope del texto guardado. El límite real de Firestore es ~1 MB. */
export const TOPE = 320_000;

/**
 * Miniatura para la galería.
 *
 * Va en su propio documento (`fotos/m_<id>`) con la marca `esMini`, para que
 * la galería pueda traer cincuenta fotos de 6 KB en vez de cincuenta de 200.
 * Queda dentro de la misma colección `fotos`, así que no hay que tocar las
 * reglas de Firestore.
 */
const MINI_LADO = 240;
const MINI_CALIDAD = 0.6;
const idMini = (id) => "m_" + id;

/** Carga el archivo respetando la orientación con la que se tomó la foto. */
async function abrir(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* WebView viejo: se sigue con el camino de abajo */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((ok, mal) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = mal;
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

const dibujar = (img, lado) => {
  const w = img.width || img.naturalWidth;
  const h = img.height || img.naturalHeight;
  const f = Math.min(1, lado / Math.max(w, h));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(w * f);
  lienzo.height = Math.round(h * f);
  const ctx = lienzo.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  return lienzo;
};

/**
 * Encoge y comprime hasta que quepa, bajando primero la calidad y después el
 * tamaño. Devuelve un data URL listo para guardar.
 */
function apretar(img, tope) {
  let ultimo = "";
  for (const lado of LADOS) {
    const lienzo = dibujar(img, lado);
    for (const q of CALIDADES) {
      ultimo = lienzo.toDataURL("image/jpeg", q);
      if (ultimo.length <= tope) return ultimo;
    }
  }
  if (ultimo.length > tope) throw new Error("La foto es demasiado pesada.");
  return ultimo;
}

export async function comprimir(file, tope = TOPE) {
  const img = await abrir(file);
  try {
    return apretar(img, tope);
  } finally {
    img.close?.();
  }
}

/** Guarda la foto con su miniatura y devuelve su id. */
export async function subirFoto(file) {
  const img = await abrir(file);
  let datos, mini;
  try {
    datos = apretar(img, TOPE);
    mini = dibujar(img, MINI_LADO).toDataURL("image/jpeg", MINI_CALIDAD);
  } finally {
    img.close?.();
  }

  const id = uid() + uid();
  await setDoc(doc(db, "fotos", id), { datos, bytes: datos.length, creado: serverTimestamp() });
  // La miniatura va aparte: si falla, la foto igual quedó guardada.
  await setDoc(doc(db, "fotos", idMini(id)), {
    esMini: true,
    de: id,
    mini,
    creado: serverTimestamp(),
  }).catch((e) => console.warn("No se pudo guardar la miniatura:", e));

  cache.set(id, datos);
  return id;
}

/**
 * Todas las fotos ya subidas, en miniatura, de la más nueva a la más vieja.
 *
 * Nada se borra solo: una foto buena de un plato que hoy no está sigue ahí
 * para el día que vuelva a la carta.
 */
export async function listarGaleria() {
  const s = await getDocs(query(collection(db, "fotos"), where("esMini", "==", true)));
  return s.docs
    .map((d) => ({ id: d.data().de, mini: d.data().mini, ms: d.data().creado?.toMillis?.() || 0 }))
    .filter((x) => x.id && x.mini)
    .sort((a, b) => b.ms - a.ms);
}

/** Memoria de esta sesión: el TV no vuelve a pedir la misma foto. */
const cache = new Map();
const enVuelo = new Map();

export function fotoEnCache(id) {
  return cache.get(id) || "";
}

export function leerFoto(id) {
  if (!id) return Promise.resolve("");
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  if (enVuelo.has(id)) return enVuelo.get(id);

  const p = getDoc(doc(db, "fotos", id))
    .then((s) => {
      const datos = s.exists() ? s.data().datos || "" : "";
      cache.set(id, datos);
      return datos;
    })
    .catch(() => "")
    .finally(() => enVuelo.delete(id));

  enVuelo.set(id, p);
  return p;
}

/** Peso legible, para avisarle al usuario cuánto ocupó la foto. */
export const pesoFoto = (texto) => {
  const kb = Math.round(((texto || "").length * 0.75) / 1024);
  return kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB";
};
