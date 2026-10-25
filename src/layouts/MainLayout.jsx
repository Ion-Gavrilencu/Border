import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Megaphone,
  FileText,
  Scale,
  Info,
  Settings,
  LogOut,
  Bell,
  User,
  Search,
  ChevronDown,
} from "lucide-react";
import api from "../services/api";
import "./MainLayout.css";

function MainLayout() {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  useEffect(() => {
    const value = searchTerm.trim();

    if (!value) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);

        const response = await api.get(
          `/search?q=${encodeURIComponent(value)}`,
        );

        setSearchResults(response.data.results || []);
        setShowSearchResults(true);
      } catch (error) {
        console.error("Eroare la căutare:", error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearchResultClick = (item) => {
    if (item.type === "telegrama") {
      navigate(`/telegrame/${item.id}`);
    }

    if (item.type === "ordin") {
      navigate(`/ordine/${item.id}`);
    }

    if (item.type === "legislatie") {
      navigate(`/legislatie/${item.id}`);
    }

    if (item.type === "informatii") {
      navigate(`/informatii-utile/${item.id}`);
    }

    setSearchTerm("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        

<NavLink
  to="/dashboard"
  className="sidebar-logo"
  aria-label="BORDER - Mergi la Dashboard"
>
  <img
    src={`${import.meta.env.BASE_URL}images/border-logo.png`}
    alt="Emblema BORDER"
    className="border-logo-image"
  />

  <div className="border-logo-text">
    <h2>BORDER</h2>
    <span>PORTAL INFORMAȚIONAL</span>
  </div>
</NavLink>



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
          

          <div className="topbar-search">
            <Search size={19} />

            <input
              type="text"
              placeholder="Caută în documente..."
              value={searchTerm}
              onChange={handleSearch}
            />

            {showSearchResults && (
              <div className="search-results">
                {searchLoading ? (
                  <div className="search-message">Se caută...</div>
                ) : searchResults.length === 0 ? (
                  <div className="search-message">
                    Nu au fost găsite rezultate.
                  </div>
                ) : (
                  searchResults.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      className="search-result-item"
                      onClick={() => handleSearchResultClick(item)}
                    >
                      <div className="search-result-icon">
                        {item.type === "telegrama" && <Megaphone size={17} />}

                        {item.type === "ordin" && <FileText size={17} />}

                        {item.type === "legislatie" && <Scale size={17} />}

                        {item.type === "informatii" && <Info size={17} />}
                      </div>

                      <div className="search-result-content">
                        <strong>{item.title}</strong>

                        <span>
                          {item.type === "telegrama"
                            ? "Telegramă"
                            : item.type === "ordin"
                              ? "Ordin intern"
                              : item.type === "legislatie"
                                ? "Act legislativ"
                                : "Informație utilă"}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="topbar-right">
            <button className="icon-button">
              <Bell size={21} />
              <span className="notification-dot"></span>
            </button>

            
<div className="user-menu-container">
  <button
    type="button"
    className="user-info user-menu-trigger"
    onClick={() => setShowUserMenu((prev) => !prev)}
    aria-expanded={showUserMenu}
    aria-haspopup="true"
  >
    <div className="user-avatar">
      <User size={19} />
    </div>

    <div>
      <strong>
        {user?.fullName || user?.username || "Utilizator"}
      </strong>
      <small>
        {user?.role === "ADMIN"
          ? "Administrator"
          : user?.role === "EDITOR"
            ? "Editor"
            : "Utilizator"}
      </small>
    </div>

    <ChevronDown size={16} />
  </button>

  {showUserMenu && (
    <div className="user-dropdown">
      <button
        type="button"
        onClick={() => {
          setShowUserMenu(false);
          navigate("/profil");
        }}
      >
        <User size={18} />
        <span>Profilul meu și setări</span>
      </button>

      <div className="user-dropdown-divider" />

      <button
        type="button"
        className="user-dropdown-logout"
        onClick={() => {
          setShowUserMenu(false);
          handleLogout();
        }}
      >
        <LogOut size={18} />
        <span>Deconectare</span>
      </button>
    </div>
  )}
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
