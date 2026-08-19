import { useEffect, useState } from "react";
import { fotoEnCache, leerFoto } from "../lib/fotos";

/** Miniatura de una foto guardada, para las listas. */
export default function MiniFoto({ id, className = "mini" }) {
  const [src, setSrc] = useState(() => fotoEnCache(id));

  useEffect(() => {
    let vivo = true;
    if (!id) return;
    leerFoto(id).then((d) => vivo && setSrc(d));
    return () => {
      vivo = false;
    };
  }, [id]);

  if (!src) return <div className={className + " vacia"} />;
  return <img className={className} src={src} alt="" />;
}
