import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authStore";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard,
  Megaphone,
  FileText,
  Scale,
  Info,
  Settings,
  Activity,
  LogOut,
  User,
  Search,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import api from "../services/api";
import {
  sendMonitoringHeartbeat,
  recordMonitoringPageView,
} from "../services/monitoringService";
import NotificationBell from "../components/layout/NotificationBell";
import SearchDocumentPreview from "../components/SearchDocumentPreview";
import "./MainLayout.css";

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const userMenuRef = useRef(null);
  const searchInputRef = useRef(null);

  // Actualizează prezența doar cât timp utilizatorul este autentificat.
  useEffect(() => {
    if (!user?.id) return;
    let disposed = false;
    const ping = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      try {
        await sendMonitoringHeartbeat();
      } catch (error) {
        // Monitorizarea nu trebuie să blocheze navigarea în aplicație.
        if (!disposed && import.meta.env.DEV) {
          console.warn("Heartbeat monitorizare indisponibil:", error);
        }
      }
    };
    ping();
    const interval = window.setInterval(ping, 30000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const path = location.pathname;

    const trackPage = async () => {
      try {
        await recordMonitoringPageView(path);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Nu s-a putut înregistra accesarea paginii:", error);
        }
      }
    };

    trackPage();
  }, [user?.id, location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
    setShowUserMenu(false);
    setShowSearchResults(false);
    setMobileSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onEscape = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [sidebarOpen]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const value = searchTerm.trim();
    if (!value) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchLoading(false);
      setSearchError(false);
      return;
    }
    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(false);
    setShowSearchResults(true);
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(
          `/search?q=${encodeURIComponent(value)}`,
          {
            signal: controller.signal,
          },
        );
        setSearchResults(response.data.results || []);
      } catch (error) {
        if (error.code === "ERR_CANCELED" || error.name === "CanceledError")
          return;
        console.error("Eroare la căutare:", error);
        setSearchResults([]);
        setSearchError(true);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Eroare la deconectare:", error);
      toast.error("Deconectarea nu a reușit. Încearcă din nou.");
    }
  };

  const handleSearchResultClick = (item) => {
    if (!item?.id || !item?.type) return;
    setPreviewItem({ id: item.id, type: item.type, title: item.title });
    setSearchTerm("");
    setSearchResults([]);
    setShowSearchResults(false);
    setMobileSearchOpen(false);
  };

  const openMobileSearch = () => {
    setMobileSearchOpen(true);
    setShowUserMenu(false);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  return (
    <div className="app-layout app-layout-modern">
      <Toaster position="top-right" richColors closeButton duration={4000} />
      <SearchDocumentPreview
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Închide meniul"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}
        id="app-sidebar"
        aria-label="Navigare principală"
      >
        <div className="sidebar-brand-row">
          <NavLink
            to="/dashboard"
            className="sidebar-logo"
            aria-label="BORDER - Dashboard"
            onClick={() => setSidebarOpen(false)}
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
          <button
            type="button"
            className="sidebar-close"
            aria-label="Închide meniul"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={22} />
          </button>
        </div>
        <nav className="sidebar-menu">
          <NavLink to="/dashboard" onClick={() => setSidebarOpen(false)}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/telegrame" onClick={() => setSidebarOpen(false)}>
            <Megaphone size={20} />
            <span>Telegrame</span>
          </NavLink>
          <NavLink to="/ordine" onClick={() => setSidebarOpen(false)}>
            <FileText size={20} />
            <span>Ordine interne</span>
          </NavLink>
          <NavLink to="/legislatie" onClick={() => setSidebarOpen(false)}>
            <Scale size={20} />
            <span>Acte normative</span>
          </NavLink>
          <NavLink to="/informatii-utile" onClick={() => setSidebarOpen(false)}>
            <Info size={20} />
            <span>Informații utile</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          {user?.role === "ADMIN" && (
            <NavLink
              to="/monitorizare-utilizatori"
              onClick={() => setSidebarOpen(false)}
            >
              <Activity size={20} />
              <span>Monitorizare utilizatori</span>
            </NavLink>
          )}
          {user?.role === "ADMIN" && (
            <NavLink to="/admin" onClick={() => setSidebarOpen(false)}>
              <Settings size={20} />
              <span>Administrare</span>
            </NavLink>
          )}
          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            <span>Deconectare</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header
          className={`topbar ${mobileSearchOpen ? "topbar--search-open" : ""}`}
        >
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Deschide meniul"
            aria-controls="app-sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={23} />
          </button>

          <div className="topbar-search" ref={searchRef}>
            <Search size={19} />
            <input
              ref={searchInputRef}
              type="search"
              aria-label="Caută în documente"
              placeholder="Caută în pagină..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onFocus={() => {
                if (searchTerm.trim()) setShowSearchResults(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setShowSearchResults(false);
                  setMobileSearchOpen(false);
                }
              }}
            />
            <button
              type="button"
              className="mobile-search-close"
              aria-label="Închide căutarea"
              onClick={() => {
                setMobileSearchOpen(false);
                setSearchTerm("");
                setShowSearchResults(false);
              }}
            >
              <X size={20} />
            </button>
            {showSearchResults && (
              <motion.div
                className="search-results"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                {searchLoading ? (
                  <div className="search-message">Se caută...</div>
                ) : searchError ? (
                  <div className="search-message">
                    Căutarea nu este disponibilă momentan.
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="search-message">
                    Nu au fost găsite rezultate.
                  </div>
                ) : (
                  searchResults.map((item) => (
                    <button
                      type="button"
                      key={`${item.type}-${item.id}`}
                      className="search-result-item"
                      onClick={() => handleSearchResultClick(item)}
                    >
                      <div className="search-result-icon">
                        {item.type === "telegrama" ? (
                          <Megaphone size={17} />
                        ) : item.type === "ordin" ? (
                          <FileText size={17} />
                        ) : item.type === "legislatie" ? (
                          <Scale size={17} />
                        ) : (
                          <Info size={17} />
                        )}
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
              </motion.div>
            )}
          </div>
          <div className="topbar-right">
            <button
              type="button"
              className="icon-button mobile-search-button"
              aria-label="Caută documente"
              onClick={openMobileSearch}
            >
              <Search size={21} />
            </button>
            <NotificationBell />
            <div className="user-menu-container" ref={userMenuRef}>
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
                <motion.div
                  className="user-dropdown"
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.16 }}
                >
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
                </motion.div>
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
