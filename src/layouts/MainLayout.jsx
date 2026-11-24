import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authStore";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard,
  GraduationCap,
  Megaphone,
  FileText,
  Scale,
  Info,
  Settings,
  Activity,
  LogOut,
  User,
  Search,
  ArrowUpRight,
  LoaderCircle,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import api from "../services/api";
import { sendMonitoringHeartbeat, recordMonitoringPageView } from "../services/monitoringService";
import NotificationBell from "../components/layout/NotificationBell";
import "./MainLayout.css";

const SEARCH_CATEGORIES = [
  ["all", "Toate"],
  ["legislatie", "Legislație"],
  ["telegrama", "Telegrame"],
  ["ordin", "Ordine"],
  ["informatie", "Informații"],
];
const normalizeSearch = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ro");
const searchCategory = (item) => {
  const type = String(item.type ?? "").toLowerCase();
  return ["informatii", "informatii_utile", "informatii-utile"].includes(type)
    ? "informatie"
    : type;
};
const documentNumber = (item) => item.number ?? item.document_number ?? item.nr ?? item.numar ?? "";
const tokensOf = (term) => normalizeSearch(term).match(/[\p{L}\p{N}]+/gu) ?? [];
function relevance(item, term) {
  const q = normalizeSearch(term.trim());
  const title = normalizeSearch(item.title);
  const number = normalizeSearch(documentNumber(item));
  const tokens = tokensOf(q);
  const words = tokensOf(`${title} ${number}`);
  if (number && number === q) return 1000;
  if (/^\d+$/.test(q) && number && tokensOf(number)[0] === q) return 900;
  if (title === q) return 800;
  if (tokens.length && tokens.every((token) => words.includes(token))) return 500;
  if (title.includes(q)) return 200;
  return tokens.filter((token) => words.includes(token)).length * 20;
}
function Highlight({ value, query }) {
  const source = String(value ?? "");
  const tokens = new Set(tokensOf(query));
  return source
    .split(/([\p{L}\p{N}\p{M}]+)/gu)
    .map((part, index) =>
      tokens.has(normalizeSearch(part)) ? <mark key={index}>{part}</mark> : part,
    );
}

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState("");
  const MAX_SEARCH_LENGTH = 120;
  const [searchResults, setSearchResults] = useState([]);
  const [searchCategoryFilter, setSearchCategoryFilter] = useState("all");
  const [searchRetry, setSearchRetry] = useState(0);
  const [recentSearches, setRecentSearches] = useState([]);
  const visibleSearchResults = useMemo(
    () =>
      searchResults
        .filter(
          (item) => searchCategoryFilter === "all" || searchCategory(item) === searchCategoryFilter,
        )
        .sort(
          (a, b) =>
            (b.relevance ?? relevance(b, searchTerm)) - (a.relevance ?? relevance(a, searchTerm)),
        ),
    [searchResults, searchCategoryFilter, searchTerm],
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    setRecentSearches([]);
    setSearchTerm("");
    setSearchResults([]);
    setShowSearchResults(false);
    setSearchCategoryFilter("all");
  }, [user?.id]);

  useEffect(() => {
    setActiveSearchIndex(-1);
  }, [searchCategoryFilter, searchResults]);

  useEffect(() => {
    if (showSearchResults && activeSearchIndex >= 0) {
      document
        .getElementById(`border-search-option-${activeSearchIndex}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [activeSearchIndex, showSearchResults]);

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
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const value = searchTerm.trim();
    if (!value || !user?.id) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(false);
      return;
    }
    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(false);
    setActiveSearchIndex(-1);
    setSearchResults([]);
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(
          `/search?q=${encodeURIComponent(value)}&type=${encodeURIComponent(searchCategoryFilter)}`,
          {
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;
        const rows = response.data?.results;
        if (!Array.isArray(rows)) throw new Error("Răspuns invalid la căutare.");
        setSearchResults(
          rows.filter(
            (item) =>
              item?.id != null &&
              SEARCH_CATEGORIES.some(([key]) => key !== "all" && key === searchCategory(item)),
          ),
        );
      } catch (error) {
        if (
          controller.signal.aborted ||
          error.code === "ERR_CANCELED" ||
          error.name === "CanceledError"
        )
          return;
        console.error("Eroare la căutare:", error);
        setSearchResults([]);
        setSearchError(true);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, searchRetry, searchCategoryFilter, user?.id]);

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
    if (item?.id == null || !item?.type) return;
    const destinations = {
      telegrama: "/telegrame",
      ordin: "/ordine",
      legislatie: "/legislatie",
      informatie: "/informatii-utile",
      informatii: "/informatii-utile",
      informatii_utile: "/informatii-utile",
      "informatii-utile": "/informatii-utile",
    };
    const destination = destinations[String(item.type).toLowerCase()];
    if (!destination) {
      toast.error("Categoria rezultatului nu este recunoscută.");
      return;
    }
    const term = searchTerm.trim();
    if (term)
      setRecentSearches((old) =>
        [term, ...old.filter((x) => normalizeSearch(x) !== normalizeSearch(term))].slice(0, 6),
      );
    setSearchTerm("");
    setSearchResults([]);
    setShowSearchResults(false);
    setActiveSearchIndex(-1);
    setSearchCategoryFilter("all");
    // Parametrul open este deja interpretat de InformatiiUtile.
    // Alte pagini pot adopta același contract fără modificarea backendului.
    navigate(`${destination}?open=${encodeURIComponent(String(item.id))}`, {
      state: { openDocumentId: item.id, fromGlobalSearch: true },
    });
  };

  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchResults(true);
      }
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, []);

  return (
    <div className="app-layout app-layout-modern">
      <Toaster position="top-right" richColors closeButton duration={4000} />
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
            <span>Pagina principală</span>
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
          <NavLink to="/testare" onClick={() => setSidebarOpen(false)}>
            <GraduationCap size={20} />
            <span>Testare profesională</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          {user?.role === "ADMIN" && (
            <NavLink to="/monitorizare-utilizatori" onClick={() => setSidebarOpen(false)}>
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
          <button type="button" className="logout-button" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Deconectare</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
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
              maxLength={MAX_SEARCH_LENGTH}
              role="combobox"
              aria-expanded={showSearchResults}
              aria-controls={showSearchResults ? "border-global-search-results" : undefined}
              aria-activedescendant={
                showSearchResults &&
                !searchLoading &&
                activeSearchIndex >= 0 &&
                visibleSearchResults[activeSearchIndex]
                  ? `border-search-option-${activeSearchIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-label="Caută în documente"
              placeholder="Caută în BORDER..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setSearchLoading(Boolean(event.target.value.trim()));
                setSearchResults([]);
                setSearchError(false);
                setShowSearchResults(true);
              }}
              onFocus={() => {
                setShowSearchResults(true);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Escape") {
                  setShowSearchResults(false);
                  event.currentTarget.blur();
                } else if (
                  ["ArrowDown", "ArrowUp"].includes(event.key) &&
                  !searchLoading &&
                  visibleSearchResults.length
                ) {
                  event.preventDefault();
                  setShowSearchResults(true);
                  const count = visibleSearchResults.length;
                  setActiveSearchIndex((index) =>
                    event.key === "ArrowDown"
                      ? (index + 1) % count
                      : index < 0
                        ? count - 1
                        : (index - 1 + count) % count,
                  );
                } else if (
                  event.key === "Enter" &&
                  showSearchResults &&
                  !searchLoading &&
                  visibleSearchResults.length
                ) {
                  event.preventDefault();
                  handleSearchResultClick(
                    visibleSearchResults[activeSearchIndex] || visibleSearchResults[0],
                  );
                }
              }}
            />
            {searchTerm && (
              <button
                type="button"
                className="search-clear"
                aria-label="Șterge căutarea"
                onClick={() => {
                  setSearchTerm("");
                  setSearchResults([]);
                  setShowSearchResults(true);
                  setSearchCategoryFilter("all");
                  searchInputRef.current?.focus();
                }}
              >
                <X size={16} />
              </button>
            )}
            {showSearchResults && (
              <motion.div
                aria-label="Panou de căutare"
                className="search-results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="border-search-tools">
                  <div
                    className="border-search-filters"
                    role="group"
                    aria-label="Categorii de căutare"
                  >
                    {SEARCH_CATEGORIES.map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={searchCategoryFilter === key}
                        onClick={() => setSearchCategoryFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="border-search-summary" aria-live="polite">
                    {!searchTerm.trim()
                      ? "Căutări recente"
                      : searchLoading
                        ? "Se caută…"
                        : searchError
                          ? "Căutare indisponibilă"
                          : `${visibleSearchResults.length} rezultate afișate`}
                    {!searchTerm.trim() && recentSearches.length > 0 && (
                      <button type="button" onClick={() => setRecentSearches([])}>
                        Șterge istoricul
                      </button>
                    )}
                  </div>
                </div>
                {!searchTerm.trim() &&
                  (recentSearches.length ? (
                    recentSearches.map((term) => (
                      <button
                        type="button"
                        className="border-search-recent"
                        key={term}
                        onClick={() => {
                          setSearchTerm(term);
                          setSearchLoading(true);
                          setSearchCategoryFilter("all");
                          searchInputRef.current?.focus();
                        }}
                      >
                        {term}
                      </button>
                    ))
                  ) : (
                    <div className="search-message">Caută după titlu, număr sau cuvinte-cheie.</div>
                  ))}
                {searchTerm.trim() &&
                  (searchLoading ? (
                    <div className="search-message">
                      <LoaderCircle size={16} className="search-spinner" /> Se caută...
                    </div>
                  ) : searchError ? (
                    <div className="search-message">
                      Căutarea nu este disponibilă momentan.{" "}
                      <button
                        type="button"
                        className="border-search-retry"
                        onClick={() => setSearchRetry((n) => n + 1)}
                      >
                        Reîncearcă
                      </button>
                    </div>
                  ) : !visibleSearchResults.length ? (
                    <div className="search-message">
                      Nu au fost găsite rezultate. Încearcă alt termen sau altă categorie.
                    </div>
                  ) : null)}
                <div
                  id="border-global-search-results"
                  role="listbox"
                  aria-label="Rezultatele căutării"
                >
                  {!searchLoading &&
                    !searchError &&
                    searchTerm.trim() &&
                    visibleSearchResults.map((item, index) => (
                      <button
                        type="button"
                        id={`border-search-option-${index}`}
                        key={`${item.type}-${item.id}`}
                        role="option"
                        aria-selected={index === activeSearchIndex}
                        className={`search-result-item ${index === activeSearchIndex ? "is-active" : ""}`}
                        onMouseEnter={() => setActiveSearchIndex(index)}
                        onClick={() => handleSearchResultClick(item)}
                      >
                        <div className="search-result-icon">
                          {searchCategory(item) === "telegrama" ? (
                            <Megaphone size={17} />
                          ) : searchCategory(item) === "ordin" ? (
                            <FileText size={17} />
                          ) : searchCategory(item) === "legislatie" ? (
                            <Scale size={17} />
                          ) : (
                            <Info size={17} />
                          )}
                        </div>
                        <div className="search-result-content">
                          {documentNumber(item) !== "" && (
                            <span className="border-search-number">
                              <Highlight value={documentNumber(item)} query={searchTerm} />
                            </span>
                          )}
                          <strong>
                            <Highlight value={item.title} query={searchTerm} />
                          </strong>
                          {item.approximate_match && <span>Potrivire aproximativă</span>}
                          <span>
                            {searchCategory(item) === "telegrama"
                              ? "Telegramă"
                              : searchCategory(item) === "ordin"
                                ? "Ordin intern"
                                : searchCategory(item) === "legislatie"
                                  ? "Act legislativ"
                                  : "Informație utilă"}
                          </span>
                        </div>
                        <ArrowUpRight size={16} className="search-result-arrow" />
                      </button>
                    ))}
                </div>
                <div className="border-search-footer">
                  ↑ ↓ Navigare · Enter Deschide · Esc Închide
                </div>
              </motion.div>
            )}
          </div>
          <div className="topbar-right">
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
                  {user?.avatarURL || user?.avatar_url ? (
                    <img
                      src={(() => {
                        const avatar = user.avatarURL || user.avatar_url;

                        return avatar.startsWith("/")
                          ? `${
                              new URL(api.defaults.baseURL || "/api", window.location.origin).origin
                            }${avatar}`
                          : avatar;
                      })()}
                      alt="Fotografie de profil"
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <User size={19} />
                  )}
                </div>
                <div>
                  <strong>{user?.fullName || user?.username || "Utilizator"}</strong>
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
