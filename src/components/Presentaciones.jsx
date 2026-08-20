import { MAX_PRESENTACIONES, presentacionesDe } from "../lib/menu";
import { uid } from "../lib/negocio";
import CampoFoto from "./CampoFoto.jsx";

/**
 * Las presentaciones de un plato del catálogo.
 *
 * El arroz con pollo se sirve con aguacate, con plátano o solo. Es el mismo
 * plato con la misma receta, así que no tiene sentido escribirlo tres veces en
 * el menú: se escribe una vez y aquí se le guardan las fotos, una por forma de
 * servirlo. El precio propio solo se llena cuando de verdad cambia.
 *
 * @param {object} props
 * @param {object} props.fila      Fila del menú fijo
 * @param {(presentaciones: object[]) => void} props.onCambio
 */
export default function Presentaciones({ fila, onCambio }) {
  const lista = presentacionesDe(fila);

  const cambiar = (id, campo, valor) =>
    onCambio(lista.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));

  const agregar = () =>
    onCambio([...lista, { id: uid(), nombre: "", foto: "", precio: 0 }]);

  const quitar = (id) => {
    if (!confirm("¿Quitar esta presentación?")) return;
    onCambio(lista.filter((p) => p.id !== id));
  };

  return (
    <div className="presentaciones">
      <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
        Formas de servir <b>{fila.nombre || "este plato"}</b>. Cada una sale como su
        propia tarjeta en la carta del comedor, con su foto.
      </p>

      {lista.length === 0 && (
        <p className="empty" style={{ padding: "4px 0" }}>
          Sin fotos todavía
        </p>
      )}

      {lista.map((p, i) => (
        <div className="presentacion" key={p.id || i}>
          <div className="row">
            <input
              type="text"
              value={p.nombre}
              placeholder="Con aguacate (opcional)"
              onChange={(e) => cambiar(p.id, "nombre", e.target.value)}
            />
            <input
              className="price-input"
              type="number"
              inputMode="numeric"
              value={p.precio || ""}
              placeholder="$ igual"
              title="Solo si esta presentación cuesta distinto"
              onChange={(e) => cambiar(p.id, "precio", Number(e.target.value) || 0)}
            />
            <button
              className="btn icon del"
              aria-label="Quitar presentación"
              onClick={() => quitar(p.id)}
            >
              ✕
            </button>
          </div>

          <CampoFoto
            id={p.foto}
            titulo={p.nombre || "Foto de esta presentación"}
            pista="Se sube una vez y sale sola en la carta"
            onCambio={(idFoto) => cambiar(p.id, "foto", idFoto)}
          />
        </div>
      ))}

      {lista.length < MAX_PRESENTACIONES && (
        <button className="btn block ghost" onClick={agregar}>
          + Agregar presentación
        </button>
      )}
    </div>
  );
}
