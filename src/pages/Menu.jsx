import { useState } from "react";
import MenuFijo from "./MenuFijo.jsx";
import MenuDiario from "./MenuDiario.jsx";
import Carta from "./Carta.jsx";

/**
 * Tres vistas del mismo menú:
 *  - Hoy   : lo que hay disponible, elegido del catálogo. Es lo que ve el talonario.
 *  - Fijo  : el catálogo completo, todo lo que la casa sabe preparar.
 *  - Carta : los platos de hoy con foto, para la pantalla del comedor.
 */
export default function Menu() {
  const [vista, setVista] = useState("hoy");

  return (
    <>
      <div className="seg tres" style={{ marginBottom: 14 }}>
        <button className={vista === "hoy" ? "on" : ""} onClick={() => setVista("hoy")}>
          📅 Hoy
        </button>
        <button className={vista === "fijo" ? "on" : ""} onClick={() => setVista("fijo")}>
          📖 Fijo
        </button>
        <button className={vista === "carta" ? "on" : ""} onClick={() => setVista("carta")}>
          📷 Carta
        </button>
      </div>

      {vista === "hoy" && <MenuDiario />}
      {vista === "fijo" && <MenuFijo />}
      {vista === "carta" && <Carta />}
    </>
  );
}
