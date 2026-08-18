import { HashRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import Menu from "./pages/Menu.jsx";
import Pedido from "./pages/Pedido.jsx";
import Cocina from "./pages/Cocina.jsx";
import Fiados from "./pages/Fiados.jsx";
import Caja from "./pages/Caja.jsx";
import Ajustes from "./pages/Ajustes.jsx";
import SoloAdmin from "./SoloAdmin.jsx";
import { AdminProvider, useAdmin } from "./lib/admin.jsx";
import { useAutoActualizar } from "./lib/version.js";
import { useBotonAtras } from "./lib/atras.js";

const TABS = [
  { to: "/", ic: "📝", label: "Menú" },
  { to: "/pedido", ic: "🧾", label: "Pedido" },
  { to: "/fiados", ic: "📒", label: "Fiados", admin: true },
  { to: "/cocina", ic: "📺", label: "Cocina", admin: true },
  { to: "/caja", ic: "📊", label: "Caja", admin: true },
  { to: "/ajustes", ic: "⚙️", label: "Ajustes", admin: true },
];

function Shell() {
  const { pathname } = useLocation();
  const { esAdmin, hayPin } = useAdmin();
  useAutoActualizar();
  useBotonAtras();

  // La vista de TV va a pantalla completa, sin barras
  const kiosco = pathname.startsWith("/cocina");

  if (kiosco) {
    return (
      <Routes>
        <Route
          path="/cocina"
          element={
            <SoloAdmin titulo="Pantalla de cocina" permanente pantalla>
              <Cocina />
            </SoloAdmin>
          }
        />
      </Routes>
    );
  }

  const bajoLlave = hayPin && !esAdmin;

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">🍽️</div>
        <h1>RESTAURANTE</h1>
        <div className="spacer" />
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Menu />} />
          <Route path="/pedido" element={<Pedido />} />
          <Route
            path="/fiados"
            element={
              <SoloAdmin titulo="Fiados">
                <Fiados />
              </SoloAdmin>
            }
          />
          <Route
            path="/caja"
            element={
              <SoloAdmin titulo="Cierre de caja">
                <Caja />
              </SoloAdmin>
            }
          />
          <Route
            path="/ajustes"
            element={
              <SoloAdmin titulo="Ajustes">
                <Ajustes />
              </SoloAdmin>
            }
          />
        </Routes>
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === "/"}>
            <span className="ic">
              {t.ic}
              {t.admin && bajoLlave && <i className="llave">🔒</i>}
            </span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AdminProvider>
        <Shell />
      </AdminProvider>
    </HashRouter>
  );
}
