import { ZONA, money } from "./negocio.js";

/**
 * Plantillas de los mensajes de WhatsApp.
 *
 * El dueño las puede reescribir desde Ajustes. Las palabras entre llaves se
 * reemplazan por los datos reales al momento de enviar.
 */
export const PLANTILLAS_DEF = {
  fiado:
    "Buenas, {cliente} 👋\n\n" +
    "Hoy {fecha} quedó pendiente:\n" +
    "{detalle}\n" +
    "Valor: {monto}\n\n" +
    "Su saldo con nosotros queda en *{saldo}*.\n\n" +
    "Gracias por su compra.\n" +
    "{negocio}",
  abono:
    "Buenas, {cliente} 👋\n\n" +
    "Recibimos su abono de {monto} el {fecha}.\n" +
    "Su nuevo saldo es de *{saldo}*.\n\n" +
    "Muchas gracias.\n" +
    "{negocio}",
  estado:
    "Buenas, {cliente} 👋\n\n" +
    "Este es su estado de cuenta al {fecha}:\n" +
    "{detalle}\n\n" +
    "Saldo pendiente: *{saldo}*\n\n" +
    "{negocio}",
};

/** Las que se pueden usar dentro de las plantillas. */
export const VARIABLES = [
  { v: "{cliente}", q: "Nombre del cliente" },
  { v: "{fecha}", q: "Fecha del movimiento" },
  { v: "{detalle}", q: "Lo que se llevó, o el listado de la cuenta" },
  { v: "{monto}", q: "Valor de este movimiento" },
  { v: "{saldo}", q: "Saldo total que queda debiendo" },
  { v: "{negocio}", q: "Nombre de tu restaurante" },
];

/** Reemplaza las llaves por los datos reales. */
export function armarMensaje(plantilla, datos) {
  return Object.entries(datos).reduce(
    (txt, [k, val]) => txt.split(`{${k}}`).join(val ?? ""),
    plantilla || ""
  );
}

/**
 * Deja el número listo para WhatsApp: solo dígitos y con indicativo de
 * Colombia si el dueño escribió únicamente el celular.
 */
export function numeroWhatsApp(tel) {
  const d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("57")) return d;
  if (d.length === 10) return "57" + d;
  return d;
}

/** Enlace que abre WhatsApp con el mensaje ya escrito. */
export function enlaceWhatsApp(tel, mensaje) {
  const n = numeroWhatsApp(tel);
  const t = encodeURIComponent(mensaje);
  return n ? `https://wa.me/${n}?text=${t}` : `https://wa.me/?text=${t}`;
}

export const fechaLarga = (fecha) => {
  const f = new Date(fecha + "T12:00:00Z").toLocaleDateString("es-CO", {
    timeZone: ZONA,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return f;
};

/** Saldo de un cliente: lo que debe menos lo que ha abonado. */
export function saldoDe(movimientos) {
  return movimientos.reduce(
    (s, m) => s + (m.tipo === "abono" ? -m.monto : m.monto),
    0
  );
}

/** Resumen de la cuenta para el mensaje de estado. */
export function detalleCuenta(movimientos) {
  return movimientos
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .map((m) => {
      const signo = m.tipo === "abono" ? "abono" : "consumo";
      return `• ${m.fecha} — ${signo}: ${money(m.monto)}${m.detalle ? ` (${m.detalle})` : ""}`;
    })
    .join("\n");
}
