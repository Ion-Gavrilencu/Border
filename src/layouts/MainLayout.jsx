import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Megaphone,
  FileText,
  Scale,
  Info,
  Settings,
  LogOut,
  Bell,
  User
} from "lucide-react";

import "./MainLayout.css";

function MainLayout() {
    const navigate = useNavigate();
const { user, logout } = useAuth();

const handleLogout = async () => {
  await logout();
  navigate("/login", { replace: true });
};
  return (
    <div className="app-layout">

      <aside className="sidebar">

        <div className="sidebar-logo">
          <div className="logo-box">PS</div>

          <div>
            <h2>Platforma</h2>
            <span>de Serviciu</span>
          </div>
        </div>

        <nav className="sidebar-menu">

          <NavLink to="/dashboard">
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/telegrame">
            <Megaphone size={20} />
            <span>Telegrame</span>
          </NavLink>

          <NavLink to="/ordine">
            <FileText size={20} />
            <span>Ordine interne</span>
          </NavLink>

          <NavLink to="/legislatie">
            <Scale size={20} />
            <span>Legislație</span>
          </NavLink>

          <NavLink to="/informatii-utile">
            <Info size={20} />
            <span>Informații utile</span>
          </NavLink>

        </nav>

        <div className="sidebar-bottom">

          {user?.role === "ADMIN" && (
  <NavLink to="/admin">
    <Settings size={20} />
    <span>Administrare</span>
  </NavLink>
)}

          <button className="logout-button" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Deconectare</span>
          </button>

        </div>

      </aside>

      <div className="main-area">

        <header className="topbar">

          <div>
            <h3>Platforma de Serviciu</h3>
          </div>

          <div className="topbar-right">

            <button className="icon-button">
              <Bell size={21} />
              <span className="notification-dot"></span>
            </button>

            <div className="user-info">
              <div className="user-avatar">
                <User size={19} />
              </div>

              <div>
                <strong>Utilizator</strong>
                <small>Personal</small>
              </div>
            </div>

          </div>

        </header>

        <main className="content">
          <Outlet />
        </main>

      </div>

    </div>
  );
}

export default MainLayout;