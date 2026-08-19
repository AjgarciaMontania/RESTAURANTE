import { useEffect, useRef, useState } from "react";
import { leerFoto, pesoFoto, subirFoto } from "../lib/fotos";

/**
 * Una casilla de foto: se toma con la cámara o se elige de la galería.
 *
 * La imagen se encoge y se comprime en el mismo celular antes de subirla, así
 * que da igual que la cámara dispare a 12 megapíxeles.
 */
export default function CampoFoto({ id, titulo, pista, onCambio }) {
  const [vista, setVista] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const archivo = useRef(null);

  useEffect(() => {
    let vivo = true;
    if (!id) {
      setVista("");
      return;
    }
    leerFoto(id).then((d) => vivo && setVista(d));
    return () => {
      vivo = false;
    };
  }, [id]);

  const elegir = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    setError("");
    setSubiendo(true);
    try {
      const nuevo = await subirFoto(f);
      onCambio(nuevo);
    } catch (err) {
      console.error(err);
      setError("No se pudo subir la foto. Intenta con otra.");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="foto-campo">
      <div className="foto-marco" onClick={() => !subiendo && archivo.current?.click()}>
        {vista ? (
          <img src={vista} alt={titulo} />
        ) : (
          <div className="foto-vacia">{subiendo ? "Subiendo…" : "📷"}</div>
        )}
        {subiendo && vista && <div className="foto-cargando">Subiendo…</div>}
      </div>

      <div className="foto-datos">
        <b>{titulo}</b>
        {pista && <span className="muted">{pista}</span>}
        {vista && <span className="muted">{pesoFoto(vista)}</span>}
        {error && <span style={{ color: "var(--danger)" }}>{error}</span>}

        <div className="acciones" style={{ marginTop: 6 }}>
          <button
            className="btn chico"
            disabled={subiendo}
            onClick={() => archivo.current?.click()}
          >
            {vista ? "Cambiar" : "📷 Tomar o elegir"}
          </button>
          {vista && (
            <button className="btn chico del" disabled={subiendo} onClick={() => onCambio("")}>
              Quitar
            </button>
          )}
        </div>
      </div>

      <input
        ref={archivo}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={elegir}
      />
    </div>
  );
}
