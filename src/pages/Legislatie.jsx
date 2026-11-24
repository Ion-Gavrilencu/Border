import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  Search,
  RefreshCw,
  Link2,
  LoaderCircle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  FileText,
  Folder,
  Grid2X2,
  List,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/authStore";
import TelegramGallery from "../components/TelegramGallery";
import { toast } from "sonner";
import Swal from "sweetalert2";
import "./Legislatie.css";
const PAGE_SIZES = [8, 12, 24];
const getDate = (item) => item.law_date || item.created_at || item.createdAt || "";
const getTimestamp = (item) => {
  const time = new Date(getDate(item)).getTime();
  return Number.isFinite(time) ? time : 0;
};
const getTags = (item) => {
  const tags = item.tags || item.etichete;
  if (Array.isArray(tags))
    return tags.map((tag) => (typeof tag === "string" ? tag : tag?.name)).filter(Boolean);
  if (typeof tags === "string")
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  return [];
};
const isArchived = (item) =>
  item.is_archived === true || item.archived === true || item.status === "archived";
const getAttachmentCount = (item) => {
  if (Array.isArray(item.attachments)) return item.attachments.length;
  const count = item.attachments_count ?? item.attachment_count ?? item.files_count;
  return Number.isFinite(Number(count)) && count !== undefined && count !== null
    ? Number(count)
    : null;
};
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const tokens = (value) => normalize(value).match(/[\p{L}\p{N}]+/gu) || [];
const formatDate = (value) => {
  const d = new Date(value || "");
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("ro-RO", { timeZone: "UTC" }) : "";
};
const getType = (item) => {
  const value = normalize(item.law_number || "") + " " + normalize(item.title || "");
  if (/^\s*(?:legea?|legi)\b/.test(value)) return "lege";
  if (/^\s*(?:hotarare(?:a)?|hg|h\s*\.\s*g)\b/.test(value)) return "hotărâre";
  if (/^\s*ordin(?:ul)?\b/.test(value)) return "ordin";
  if (/^\s*regulament(?:ul)?\b/.test(value)) return "regulament";
  return "other";
};
const getLegislationDisplayTitle = (item) => {
  const title = String(item.title || "Act normativ fără titlu").trim();
  const number = String(item.law_number ?? "").trim();
  return !number || normalize(title).startsWith(normalize(number)) ? title : `${number} — ${title}`;
};
const matches = (item, query) => {
  const fields = [
    item.title,
    item.law_number,
    formatDate(item.law_date),
    ...getTags(item),
    getType(item),
  ];
  const text = normalize(fields.join(" "));
  const words = tokens(text);
  const terms = tokens(query).map((t) => (t === "legea" ? "lege" : t === "hg" ? "hotarare" : t));
  return terms.length
    ? terms.every((t) => (/^\d+$/.test(t) ? words.includes(t) : text.includes(t)))
    : !query.trim() || text.includes(normalize(query));
};
function Legislatie() {
  const navigate = useNavigate();
  const location = useLocation();
  const emailTargetId = new URLSearchParams(location.search).get("open");
  const dashboardTargetId = location.state?.openDocumentId;
  const targetId = emailTargetId || dashboardTargetId;
  const [highlightedId, setHighlightedId] = useState(null);
  const [pendingTarget, setPendingTarget] = useState(() =>
    targetId == null ? null : String(targetId),
  );
  const { user } = useAuth();
  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";
  const canDelete = user?.role === "ADMIN";
  const [legislatie, setLegislatie] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [galleryLegislation, setGalleryLegislation] = useState(null);
  const [tab, setTab] = useState("all");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [menuId, setMenuId] = useState(null);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [attachmentFilter, setAttachmentFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [openingId, setOpeningId] = useState(null);
  const openLock = useRef(false);
  const deleteLock = useRef(false);
  const activeFilters =
    Number(filterType !== "all") +
    Number(!!fromDate) +
    Number(!!toDate) +
    Number(attachmentFilter !== "all");
  const resetFilters = () => {
    setQuery("");
    setFilterType("all");
    setFromDate("");
    setToDate("");
    setAttachmentFilter("all");
    setPage(1);
  };
  useEffect(() => {
    setMenuId(null);
  }, [query, fromDate, toDate, attachmentFilter, filterType, tab, sort, page, pageSize, view]);
  useEffect(() => {
    if (menuId === null) return;
    const outside = (e) => {
      if (!e.target.closest?.(".legislatie-menu-wrap")) setMenuId(null);
    };
    const escape = (e) => {
      if (e.key === "Escape") setMenuId(null);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menuId]);
  const copyLink = async (item) => {
    try {
      await navigator.clipboard.writeText(
        new URL(`${location.pathname}?open=${encodeURIComponent(item.id)}`, window.location.origin)
          .href,
      );
      toast.success("Link copiat.");
    } catch {
      toast.error("Nu s-a putut copia linkul.");
    }
    setMenuId(null);
  };
  const favoriteKey = user?.id == null ? null : `legislatie-favorites:${user.id}`;
  const [favoriteState, setFavoriteState] = useState({ key: null, ids: [] });
  const favorites = favoriteState.key === favoriteKey ? favoriteState.ids : [];
  useEffect(() => {
    try {
      const stored = JSON.parse((favoriteKey && localStorage.getItem(favoriteKey)) || "[]");
      setFavoriteState({ key: favoriteKey, ids: Array.isArray(stored) ? stored.map(String) : [] });
    } catch {
      setFavoriteState({ key: favoriteKey, ids: [] });
    }
  }, [favoriteKey]);
  useEffect(() => {
    let active = true;
    async function loadLegislatie() {
      try {
        setLoading(true);
        setError("");
        const response = await api.get("/legislatie");
        if (active) {
          if (!Array.isArray(response.data?.legislatie)) throw new Error("Răspuns invalid");
          setLegislatie(response.data.legislatie);
          if (refreshKey > 0) toast.success("Lista actelor normative a fost actualizată.");
        }
      } catch (err) {
        if (active) {
          const message = err.response?.data?.message || "Nu s-au putut încărca actele normative.";
          setError(message);
          if (refreshKey > 0) toast.error(message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadLegislatie();
    return () => {
      active = false;
    };
  }, [refreshKey]);
  const toggleFavorite = (id) => {
    if (!favoriteKey || favoriteState.key !== favoriteKey) {
      toast.error("Favoritele nu sunt disponibile momentan.");
      return;
    }
    const wasFavorite = favorites.includes(String(id));
    const next = wasFavorite
      ? favorites.filter((value) => value !== String(id))
      : [...favorites, String(id)];
    try {
      localStorage.setItem(favoriteKey, JSON.stringify(next));
      setFavoriteState({ key: favoriteKey, ids: next });
      toast.success(
        wasFavorite ? "Act normativ eliminat din favorite." : "Act normativ adăugat la favorite.",
      );
    } catch {
      toast.error("Nu s-a putut actualiza lista de favorite.");
    }
  };
  const handleOpenLegislation = async (legislation) => {
    if (openLock.current) return;
    openLock.current = true;
    setOpeningId(legislation.id);
    let newTab;
    try {
      newTab = window.open("about:blank", "_blank");
      if (newTab) newTab.opener = null;
      const response = await api.get(`/attachments/legislatie/${legislation.id}`);
      const attachments = Array.isArray(response.data?.attachments)
        ? response.data.attachments
        : [];
      const images = attachments.filter(
        (i) =>
          i.attachment_type !== "link" &&
          (i.file_category === "image" || i.mime_type?.startsWith("image/")),
      );
      const pdf = attachments.find(
        (i) =>
          i.attachment_type !== "link" &&
          (i.file_category === "pdf" ||
            i.mime_type === "application/pdf" ||
            /\.pdf$/i.test(i.original_name || i.file_name || i.name || "")),
      );
      if (images.length && !pdf) {
        newTab?.close();
        setGalleryLegislation(legislation);
        return;
      }
      const attachment = pdf || attachments[0];
      if (!attachment) {
        newTab?.close();
        toast.info("Acest act normativ nu are atașamente.");
        return;
      }
      if (!newTab || newTab.closed)
        throw new Error("Permite ferestrele pop-up și încearcă din nou.");
      if (attachment.attachment_type === "link") {
        if (!/^https?:\/\//i.test(attachment.url || "")) throw new Error("Link invalid.");
        newTab.location.replace(attachment.url);
        return;
      }
      const responseFile = await api.get(`/attachments/file/${attachment.id}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(responseFile.data);
      try {
        newTab.location.replace(url);
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (err) {
      newTab?.close();
      toast.error(
        err.response?.data?.message || err.message || "Documentul nu a putut fi deschis.",
      );
    } finally {
      openLock.current = false;
      setOpeningId(null);
    }
  };
  const handleDeleteLegislation = async (item) => {
    if (!canDelete || deleteLock.current || loading) return;
    deleteLock.current = true;
    try {
      const result = await Swal.fire({
        title: "Ștergi actul normativ?",
        text: `„${item.title}” va fi șters definitiv.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Da, șterge",
        cancelButtonText: "Anulează",
        confirmButtonColor: "#c43b47",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
      });
      if (!result.isConfirmed) return;
      setDeletingId(item.id);
      setError("");
      await api.delete(`/legislatie/${item.id}`);
      setLegislatie((current) => current.filter((entry) => entry.id !== item.id));
      if (galleryLegislation?.id === item.id) {
        setGalleryLegislation(null);
      }
      setMenuId(null);
      toast.success("Actul normativ a fost șters.");
    } catch (err) {
      console.error("Eroare ștergere act normativ:", err);
      const message = err.response?.data?.message || "Actul normativ nu a putut fi șters.";
      setError(message);
      toast.error(message);
    } finally {
      deleteLock.current = false;
      setDeletingId(null);
    }
  };
  const archivedCount = legislatie.filter(isArchived).length;
  const recentIds = useMemo(
    () =>
      new Set(
        [...legislatie]
          .filter((item) => !isArchived(item))
          .sort((a, b) => getTimestamp(b) - getTimestamp(a))
          .slice(0, 5)
          .map((item) => String(item.id)),
      ),
    [legislatie],
  );
  const visible = useMemo(() => {
    let items = legislatie.filter((item) => {
      const archived = isArchived(item);
      if ((tab === "archived") !== archived) return false;
      if (tab === "favorites" && !favorites.includes(String(item.id))) return false;
      if (tab === "recent" && !recentIds.has(String(item.id))) return false;
      if (filterType !== "all" && getType(item) !== filterType) return false;
      const date = String(item.law_date || "").slice(0, 10);
      if ((fromDate && (!date || date < fromDate)) || (toDate && (!date || date > toDate)))
        return false;
      const count = getAttachmentCount(item);
      if (attachmentFilter === "with" && !(count > 0)) return false;
      if (attachmentFilter === "without" && count !== 0) return false;
      if (!matches(item, query)) return false;
      return true;
    });
    return [...items].sort((a, b) => {
      if (sort === "number-asc" || sort === "number-desc") {
        const num = (x) =>
          tokens(x.law_number).find((t) => /^\d+$/.test(t)) || String(x.law_number || "");
        const cmp = num(a).localeCompare(num(b), "ro", { numeric: true });
        return sort === "number-asc" ? cmp : -cmp;
      }
      if (sort === "newest" && query.trim()) {
        const q = tokens(query).find((t) => /^\d+$/.test(t));
        const score = (x) => Number(!!q && tokens(x.law_number).find((t) => /^\d+$/.test(t)) === q);
        if (score(a) !== score(b)) return score(b) - score(a);
      }
      if (sort === "oldest") return getTimestamp(a) - getTimestamp(b);
      if (sort === "az") return String(a.title || "").localeCompare(String(b.title || ""), "ro");
      if (sort === "za") return String(b.title || "").localeCompare(String(a.title || ""), "ro");
      return getTimestamp(b) - getTimestamp(a);
    });
  }, [
    legislatie,
    tab,
    favorites,
    recentIds,
    filterType,
    sort,
    query,
    fromDate,
    toDate,
    attachmentFilter,
  ]);
  useEffect(() => {
    if (targetId != null && /^[1-9]\d*$/.test(String(targetId))) {
      setPendingTarget(String(targetId));
      setHighlightedId(String(targetId));
    }
  }, [targetId, location.key]);
  useEffect(() => {
    if (loading || error || pendingTarget === null) return;
    const target = legislatie.find((item) => String(item.id) === pendingTarget);
    if (!target) {
      setPendingTarget(null);
      toast.error("Actul normativ nu a fost găsit.");
      return;
    }
    const desiredTab = isArchived(target) ? "archived" : "all";
    if (
      tab !== desiredTab ||
      filterType !== "all" ||
      query ||
      fromDate ||
      toDate ||
      attachmentFilter !== "all"
    ) {
      setTab(desiredTab);
      resetFilters();
      return;
    }
    const index = visible.findIndex((item) => String(item.id) === pendingTarget);
    if (index < 0) return;
    const desiredPage = Math.floor(index / pageSize) + 1;
    if (page !== desiredPage) {
      setPage(desiredPage);
      return;
    }
    const frame = requestAnimationFrame(() => {
      const card = Array.from(document.querySelectorAll("[data-legislatie-id]")).find(
        (element) => element.getAttribute("data-legislatie-id") === pendingTarget,
      );
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingTarget(null);
      // Păstrăm parametrul ?open=ID în adresă pentru partajarea linkului.
      if (location.state) {
        navigate(location.pathname + location.search, {
          replace: true,
          state: null,
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [
    loading,
    error,
    query,
    fromDate,
    toDate,
    attachmentFilter,
    pendingTarget,
    legislatie,
    tab,
    filterType,
    visible,
    pageSize,
    page,
    navigate,
    location.pathname,
  ]);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  useEffect(() => {
    if (!pendingTarget && page > totalPages) setPage(totalPages);
  }, [page, totalPages, pendingTarget]);
  const pageItems = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const changeTab = (value) => {
    setTab(value);
    setPage(1);
    setMenuId(null);
  };
  const changeFilter = (value) => {
    setFilterType(value);
    setPage(1);
  };
  return (
    <div className="legislatie-page">
      <header className="legislatie-header">
        <div className="legislatie-heading">
          <div className="legislatie-eyebrow">
            <FileText size={21} /> ACTE NORMATIVE
          </div>
          <h1>Acte normative</h1>
          <p className="legislatie-description">
            Lista actelor normative disponibile în platformă.
          </p>
          {canEdit && (
            <button
              type="button"
              className="legislation-add-button"
              onClick={() => navigate("/legislatie/adauga")}
            >
              <Plus size={23} /> Adaugă act normativ
            </button>
          )}
        </div>
        <div className="legislatie-hero-art" aria-hidden="true">
          <div className="legislatie-art-back" />
          <div className="legislatie-art-front">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="legislatie-art-bookmark" />
        </div>
      </header>
      {error && (
        <div className="legislation-error" role="alert">
          {error}
        </div>
      )}
      <div className="legislatie-tabs">
        <div className="legislatie-tab-group">
          <button
            className={`legislatie-tab ${tab === "all" ? "active" : ""}`}
            onClick={() => changeTab("all")}
          >
            <List size={20} /> Toate{" "}
            <span>{legislatie.filter((item) => !isArchived(item)).length}</span>
          </button>
          <button
            className={`legislatie-tab ${tab === "recent" ? "active" : ""}`}
            onClick={() => changeTab("recent")}
          >
            <Clock3 size={20} /> Recente <span>{recentIds.size}</span>
          </button>
          <button
            className={`legislatie-tab ${tab === "favorites" ? "active" : ""}`}
            onClick={() => changeTab("favorites")}
          >
            <Star size={20} /> Importante{" "}
            <span>
              {
                legislatie.filter(
                  (item) => !isArchived(item) && favorites.includes(String(item.id)),
                ).length
              }
            </span>
          </button>
          {archivedCount > 0 && (
            <button
              className={`legislatie-tab ${tab === "archived" ? "active" : ""}`}
              onClick={() => changeTab("archived")}
            >
              <Archive size={20} /> Arhivate <span>{archivedCount}</span>
            </button>
          )}
        </div>
        <button
          className={`legislatie-filter-button ${filtersOpen ? "selected" : ""}`}
          onClick={() => setFiltersOpen((value) => !value)}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={20} /> Filtre {activeFilters > 0 && <b>{activeFilters}</b>}
        </button>
      </div>
      <div className="legislatie-searchbar">
        <label>
          <Search size={19} />
          <input
            type="search"
            aria-label="Caută acte normative"
            placeholder="Caută după titlu, număr sau an..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          {query && (
            <button
              type="button"
              aria-label="Șterge căutarea"
              onClick={() => {
                setQuery("");
                setPage(1);
              }}
            >
              <X size={18} />
            </button>
          )}
        </label>
        <button
          type="button"
          disabled={loading || deletingId !== null}
          onClick={() => {
            if (!deleteLock.current) setRefreshKey((k) => k + 1);
          }}
        >
          <RefreshCw size={18} /> Actualizează
        </button>
      </div>
      {filtersOpen && (
        <section className="legislatie-filter-panel" aria-label="Filtre acte normative">
          <label htmlFor="legislatie-type">Tip act normativ</label>
          <select
            id="legislatie-type"
            value={filterType}
            onChange={(event) => changeFilter(event.target.value)}
          >
            <option value="all">Toate tipurile</option>
            <option value="lege">Lege</option>
            <option value="hotărâre">Hotărâre</option>
            <option value="ordin">Ordin</option>
            <option value="regulament">Regulament</option>
            <option value="other">Alte tipuri</option>
          </select>
          <label>
            De la data{" "}
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Până la data{" "}
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Atașamente{" "}
            <select
              value={attachmentFilter}
              onChange={(e) => {
                setAttachmentFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Toate</option>
              <option value="with">Cu atașamente</option>
              <option value="without">Fără atașamente</option>
            </select>
          </label>
          <button
            onClick={() => {
              resetFilters();
              setFiltersOpen(false);
            }}
          >
            <X size={16} /> Resetează
          </button>
        </section>
      )}
      {(query || activeFilters > 0) && (
        <div className="legislatie-active-filters">
          <span>Filtre active</span>
          <button type="button" onClick={resetFilters}>
            Resetează filtrele
          </button>
        </div>
      )}
      <div className="legislatie-toolbar">
        <strong>
          {visible.length} {visible.length === 1 ? "act normativ" : "acte normative"}
        </strong>
        <div className="legislatie-toolbar-controls">
          <label htmlFor="legislatie-sort">Sortare:</label>
          <div className="legislatie-select-wrap">
            <CalendarDays size={20} />
            <select
              id="legislatie-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Data (cele mai noi)</option>
              <option value="oldest">Data (cele mai vechi)</option>
              <option value="az">Titlu (A–Z)</option>
              <option value="za">Titlu (Z–A)</option>
              <option value="number-asc">Număr crescător</option>
              <option value="number-desc">Număr descrescător</option>
            </select>
            <ChevronDown size={17} />
          </div>
          <div className="legislatie-view-switch">
            <button
              aria-label="Vizualizare listă"
              title="Listă"
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
            >
              <List size={21} />
            </button>
            <button
              aria-label="Vizualizare grilă"
              title="Grilă"
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
            >
              <Grid2X2 size={20} />
            </button>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="legislation-loading">Se încarcă actele normative...</div>
      ) : pageItems.length === 0 ? (
        <div className="legislation-empty">
          {legislatie.length === 0
            ? "Nu există acte normative."
            : "Nu există acte normative pentru filtrele selectate."}
        </div>
      ) : (
        <div className={`legislatie-cards ${view === "grid" ? "grid-view" : ""}`}>
          {pageItems.map((item, index) => {
            const tags = getTags(item);
            const count = getAttachmentCount(item);
            const favorite = favorites.includes(String(item.id));
            return (
              <article
                className="legislatie-card"
                style={
                  highlightedId === String(item.id)
                    ? {
                        outline: "3px solid #2563eb",
                        outlineOffset: "3px",
                        borderRadius: "16px",
                      }
                    : undefined
                }
                key={item.id}
                data-legislatie-id={item.id}
              >
                <div className={`legislatie-card-icon tone-${index % 3}`}>
                  <FileText size={32} />
                </div>
                <div className="legislatie-card-main">
                  <button
                    className="legislatie-card-title"
                    disabled={openingId !== null}
                    onClick={() => handleOpenLegislation(item)}
                  >
                    {getLegislationDisplayTitle(item)}{" "}
                    {openingId === item.id && (
                      <LoaderCircle size={16} className="legislatie-spin" />
                    )}
                  </button>
                  <div className="legislatie-card-meta">
                    <Folder size={17} />
                    <span>Categorie:</span>
                    <span className="legislatie-category">Acte normative</span>
                  </div>
                  {tags.length > 0 && (
                    <div className="legislatie-card-meta">
                      <Tag size={17} />
                      <span>Etichete:</span>
                      <div className="legislatie-tags">
                        {tags.map((tag, i) => (
                          <span key={`${tag}-${i}`}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.law_date && (
                    <div className="legislatie-card-detail">{formatDate(item.law_date)}</div>
                  )}
                </div>
                <div className="legislatie-card-top-actions">
                  <button
                    className={`legislatie-star ${favorite ? "is-favorite" : ""}`}
                    title={
                      favorite ? "Elimină de la importante (local)" : "Marchează important (local)"
                    }
                    aria-label={favorite ? "Elimină de la importante" : "Marchează important"}
                    aria-pressed={favorite}
                    onClick={() => toggleFavorite(item.id)}
                  >
                    <Star size={23} fill={favorite ? "currentColor" : "none"} />
                  </button>
                  <div className="legislatie-menu-wrap">
                    <button
                      title="Mai multe opțiuni"
                      aria-label="Mai multe opțiuni"
                      aria-expanded={menuId === item.id}
                      onClick={() => setMenuId(menuId === item.id ? null : item.id)}
                    >
                      <MoreVertical size={22} />
                    </button>
                    {menuId === item.id && (
                      <div className="legislatie-menu">
                        <button
                          onClick={() => {
                            setMenuId(null);
                            handleOpenLegislation(item);
                          }}
                        >
                          <FileText size={16} /> Deschide
                        </button>
                        <button type="button" onClick={() => copyLink(item)}>
                          <Link2 size={16} /> Copiază linkul
                        </button>
                        {canEdit && (
                          <button onClick={() => navigate(`/legislatie/${item.id}/edit`)}>
                            <Pencil size={16} /> Editează
                          </button>
                        )}
                        {canDelete && (
                          <button className="danger" onClick={() => handleDeleteLegislation(item)}>
                            <Trash2 size={16} /> Șterge
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="legislatie-card-footer">
                  <button
                    className="legislatie-attachments"
                    disabled={openingId !== null}
                    onClick={() => handleOpenLegislation(item)}
                  >
                    <Paperclip size={20} />
                    {count === null
                      ? "Vezi atașamente"
                      : `${count} ${count === 1 ? "fișier atașat" : "fișiere atașate"}`}
                  </button>
                  <div className="legislatie-card-actions">
                    {canEdit && (
                      <button
                        className="legislatie-edit"
                        onClick={() => navigate(`/legislatie/${item.id}/edit`)}
                      >
                        <Pencil size={18} /> Editează
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="legislatie-delete"
                        disabled={deletingId !== null}
                        onClick={() => handleDeleteLegislation(item)}
                      >
                        <Trash2 size={18} /> {deletingId === item.id ? "Se șterge..." : "Șterge"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!loading && visible.length > 0 && (
        <footer className="legislatie-pagination">
          <div className="legislatie-pagination-info">
            Afișate {(currentPage - 1) * pageSize + 1} –{" "}
            {Math.min(currentPage * pageSize, visible.length)} din {visible.length} acte normative
          </div>
          <div className="legislatie-page-buttons">
            <button
              aria-label="Prima pagină"
              disabled={currentPage === 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft size={19} />
            </button>
            <button
              aria-label="Pagina precedentă"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={19} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  totalPages <= 5 || Math.abs(p - currentPage) <= 1 || p === 1 || p === totalPages,
              )
              .map((p, i, array) => (
                <span key={p} className="legislatie-page-entry">
                  {i > 0 && p - array[i - 1] > 1 && <span className="legislatie-ellipsis">…</span>}
                  <button
                    aria-current={p === currentPage ? "page" : undefined}
                    className={p === currentPage ? "active" : ""}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              aria-label="Pagina următoare"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={19} />
            </button>
            <button
              aria-label="Ultima pagină"
              disabled={currentPage === totalPages}
              onClick={() => setPage(totalPages)}
            >
              <ChevronsRight size={19} />
            </button>
          </div>
          <label className="legislatie-page-size">
            Elemente pe pagină:{" "}
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </footer>
      )}
      {galleryLegislation && (
        <TelegramGallery
          entityType="legislatie"
          entityId={galleryLegislation.id}
          title={galleryLegislation.title}
          onClose={() => setGalleryLegislation(null)}
        />
      )}
    </div>
  );
}
export default Legislatie;
