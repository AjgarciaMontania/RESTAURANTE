/**
 * Música de fondo para las pantallas del comedor.
 *
 * Las canciones pueden venir de dos lados, y los dos conviven:
 *
 *   1. Enlaces guardados en Firestore. Sirven en cualquier equipo y sobreviven
 *      a un reinicio, pero tienen que ser direcciones a un archivo de audio de
 *      verdad (que termine en .mp3, .m4a, .ogg…). Un enlace de YouTube o de
 *      Spotify NO sirve: esas páginas no entregan el archivo, y además el
 *      navegador no deja tomarlo de otro sitio sin permiso.
 *
 *   2. Archivos del propio equipo, escogidos desde la pantalla. No hay que
 *      subir nada a ninguna parte y suenan de una, pero valen solo mientras no
 *      se recargue la página: el navegador no guarda el permiso para volver a
 *      abrirlos solo.
 */

/** Dónde se guarda la lista compartida. */
export const MUSICA_ID = "musica";

export const MUSICA_DEF = {
  /** Si está apagada, la pantalla ni siquiera muestra el control. */
  activa: false,
  /** De 0 a 1. Fondo de comedor: bajito. */
  volumen: 0.35,
  /** Barajar en vez de sonar siempre en el mismo orden. */
  aleatorio: true,
  /** [{ id, nombre, url }] */
  pistas: [],
};

/** Extensiones que un navegador sabe reproducir sin ayuda de nadie. */
const EXTENSIONES = [".mp3", ".m4a", ".aac", ".ogg", ".oga", ".wav", ".flac", ".webm", ".opus"];

/**
 * ¿El enlace apunta a un archivo de audio?
 *
 * No es capricho: si se le pasa una página en vez de un archivo, el reproductor
 * falla callado y el usuario queda sin saber por qué no suena. Mejor avisarle
 * cuando lo está pegando.
 */
export function esEnlaceDeAudio(url) {
  const limpia = (url || "").trim().toLowerCase().split("?")[0].split("#")[0];
  if (!/^https?:\/\//.test(limpia)) return false;
  return EXTENSIONES.some((e) => limpia.endsWith(e));
}

/** Un nombre presentable sacado del propio enlace, para no pedirlo aparte. */
export function nombreDesdeUrl(url) {
  try {
    const archivo = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    const sinExt = archivo.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim();
    if (!sinExt) return "Pista";
    return sinExt.charAt(0).toUpperCase() + sinExt.slice(1);
  } catch {
    return "Pista";
  }
}

/** Deja la lista lista para guardar en Firestore, sin `undefined`. */
export const limpiarPistas = (pistas = []) =>
  pistas
    .filter((p) => p && (p.url || "").trim())
    .map((p, i) => ({
      id: p.id || `p${i}`,
      nombre: (p.nombre || "").trim() || nombreDesdeUrl(p.url),
      url: (p.url || "").trim(),
    }));

/**
 * El orden en que van a sonar.
 *
 * Barajado con Fisher-Yates, y siempre devuelve una lista nueva: la de entrada
 * viene de Firestore y no se toca.
 */
export function ordenDePistas(pistas = [], aleatorio = false, azar = Math.random) {
  const lista = [...pistas];
  if (!aleatorio) return lista;

  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

/** La siguiente, dando la vuelta al llegar al final. */
export const siguientePista = (i, total) => (total > 0 ? (i + 1) % total : 0);

/** El volumen que de verdad se le puede pasar al reproductor. */
export const volumenValido = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return MUSICA_DEF.volumen;
  return Math.min(1, Math.max(0, n));
};
