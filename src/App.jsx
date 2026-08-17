import { HashRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import MenuDia from "./pages/MenuDia.jsx";
import Pedido from "./pages/Pedido.jsx";
import Cocina from "./pages/Cocina.jsx";
import Caja from "./pages/Caja.jsx";
import Ajustes from "./pages/Ajustes.jsx";

const TABS = [
  { to: "/", ic: "📝", label: "Menú" },
  { to: "/pedido", ic: "🧾", label: "Pedido" },
  { to: "/cocina", ic: "📺", label: "Cocina" },
  { to: "/caja", ic: "📊", label: "Caja" },
  { to: "/ajustes", ic: "⚙️", label: "Ajustes" },
];

function Shell() {
  const { pathname } = useLocation();
  // La vista de TV va a pantalla completa, sin barras
  const kiosco = pathname.startsWith("/cocina");

  if (kiosco) {
    return (
      <Routes>
        <Route path="/cocina" element={<Cocina />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">🍽️</div>
        <h1>RESTAURANTE</h1>
        <div className="spacer" />
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<MenuDia />} />
          <Route path="/pedido" element={<Pedido />} />
          <Route path="/caja" element={<Caja />} />
          <Route path="/ajustes" element={<Ajustes />} />
        </Routes>
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === "/"}>
            <span className="ic">{t.ic}</span>
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
      <Shell />
    </HashRouter>
  );
}
