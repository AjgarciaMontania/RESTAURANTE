import { useState } from "react";
import MenuFijo from "./MenuFijo.jsx";
import MenuDiario from "./MenuDiario.jsx";

/**
 * Dos vistas del mismo menú:
 *  - Hoy   : lo que hay disponible, elegido del catálogo. Es lo que ve el talonario.
 *  - Fijo  : el catálogo completo, todo lo que la casa sabe preparar.
 */
export default function Menu() {
  const [vista, setVista] = useState("hoy");

  return (
    <>
      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={vista === "hoy" ? "on" : ""} onClick={() => setVista("hoy")}>
          📅 Menú de hoy
        </button>
        <button className={vista === "fijo" ? "on" : ""} onClick={() => setVista("fijo")}>
          📖 Menú fijo
        </button>
      </div>

      {vista === "hoy" ? <MenuDiario /> : <MenuFijo />}
    </>
  );
}
