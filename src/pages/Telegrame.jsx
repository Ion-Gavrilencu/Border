import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Swal from "sweetalert2";
import {
  AlertCircle,
  List,
  LayoutGrid,
  SlidersHorizontal,
  Folder,
  Tag,
  Clock3,
  MoreVertical,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/authStore";
import TelegramGallery from "../components/TelegramGallery";
import "./Telegrame.css";
const INITIAL_PAGE_SIZE = 8;
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const tokens = (value) => normalize(value).match(/[\p{L}\p{N}]+/gu) || [];
const matchesTelegram = (telegram, query) => {
  const terms = tokens(query);
  const fields = [
    telegram.title,
    telegram.number,
    telegram.created_by_name,
    telegram.created_by_username,
    formatDate(telegram.telegram_date),
    "telegrama telegrame",
  ];
  const text = normalize(fields.join(" "));
  const words = tokens(text);
  return terms.length
    ? terms.every((term) => (/^\d+$/.test(term) ? words.includes(term) : text.includes(term)))
    : !query.trim() || text.includes(normalize(query));
};
const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};
const dateValue = (value) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};
function Telegrame() {
  const navigate = useNavigate();
  const location = useLocation();
  const emailTelegramId = new URLSearchParams(location.search).get("open");
  const dashboardTelegramId =
    location.state?.openDocumentType === "telegrama" ? location.state?.openDocumentId : null;
  const targetTelegramId = emailTelegramId || dashboardTelegramId;
  const handledTarget = useRef(null);
  const [highlightedTelegramId, setHighlightedTelegramId] = useState(null);
  const pendingScrollId = useRef(null);
  const { user } = useAuth();
  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";
  const canDelete = user?.role === "ADMIN";
  const [telegrame, setTelegrame] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [favoriteBusyId, setFavoriteBusyId] = useState(null);
  const [galleryTelegram, setGalleryTelegram] = useState(null);
  const [query, setQuery] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sort, setSort] = useState("date-desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(INITIAL_PAGE_SIZE);
  const [view, setView] = useState("list");
  const [tab, setTab] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [attachmentFilter, setAttachmentFilter] = useState("all");
  const [openingId, setOpeningId] = useState(null);
  const openLock = useRef(false);
  const mutationLock = useRef(false);
  const fetchLock = useRef(false);
  const searchInput = useRef(null);
  const listRef = useRef(null);
  const activeFilters =
    Number(Boolean(fromDate)) + Number(Boolean(toDate)) + Number(attachmentFilter !== "all");
  const resetFilters = () => {
    setQuery("");
    setFromDate("");
    setToDate("");
    setAttachmentFilter("all");
    setOnlyFavorites(false);
    setTab("all");
    setSort("date-desc");
    setPage(1);
  };
  useEffect(() => {
    if (menuId == null) return;
    const outside = (e) => {
      if (!e.target.closest?.(".telegrame-more-wrap")) setMenuId(null);
    };
    const escape = (e) => {
      if (e.key === "Escape") {
        setMenuId(null);
        document.querySelector('[data-telegram-id="' + menuId + '"] .telegrame-more')?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menuId]);
  const fetchTelegrame = useCallback(async ({ silent = false } = {}) => {
    if (fetchLock.current || mutationLock.current) return;
    fetchLock.current = true;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await api.get("/telegrame");
      setTelegrame(Array.isArray(response.data?.telegrame) ? response.data.telegrame : []);
      setError("");
    } catch (err) {
      console.error("Eroare încărcare telegrame:", err);
      const message = err.response?.data?.message || "Telegramele nu au putut fi încărcate.";
      setError(message);
      if (silent) toast.error(message);
    } finally {
      fetchLock.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    fetchTelegrame();
  }, [fetchTelegrame]);
  useEffect(() => {
    if (!pendingScrollId.current) setPage(1);
  }, [query, onlyFavorites, sort, tab, pageSize, fromDate, toDate, attachmentFilter]);
  useEffect(() => {
    setMenuId(null);
  }, [query, tab, sort, page, pageSize, view, fromDate, toDate, attachmentFilter]);
  const filteredTelegrams = useMemo(() => {
    return telegrame
      .filter((telegram) => {
        if ((onlyFavorites || tab === "important") && !telegram.is_favorite) return false;
        if (tab === "recent") {
          const timestamp = dateValue(telegram.telegram_date || telegram.created_at);
          if (!timestamp || timestamp < Date.now() - 30 * 86400000) return false;
        }
        const date = String(telegram.telegram_date || "").slice(0, 10);
        if ((fromDate && (!date || date < fromDate)) || (toDate && (!date || date > toDate)))
          return false;
        if (attachmentFilter === "with" && !(Number(telegram.attachments_count) > 0)) return false;
        if (attachmentFilter === "without" && Number(telegram.attachments_count) > 0) return false;
        return matchesTelegram(telegram, query);
      })
      .sort((a, b) => {
        if (sort === "number-asc" || sort === "number-desc") {
          const cmp = String(a.number ?? "").localeCompare(String(b.number ?? ""), "ro", {
            numeric: true,
          });
          return sort === "number-asc" ? cmp : -cmp;
        }
        if (query.trim() && sort === "date-desc") {
          const q = tokens(query).filter((t) => /^\d+$/.test(t));
          if (q.length === 1) {
            const score = (o) => Number(tokens(o.number).find((t) => /^\d+$/.test(t)) === q[0]);
            if (score(a) !== score(b)) return score(b) - score(a);
          }
        }
        if (sort === "date-asc")
          return (
            dateValue(a.telegram_date) - dateValue(b.telegram_date) || Number(a.id) - Number(b.id)
          );
        if (sort === "title-asc")
          return String(a.title ?? "").localeCompare(String(b.title ?? ""), "ro");
        if (sort === "title-desc")
          return String(b.title ?? "").localeCompare(String(a.title ?? ""), "ro");
        return (
          dateValue(b.telegram_date) - dateValue(a.telegram_date) || Number(b.id) - Number(a.id)
        );
      });
  }, [telegrame, query, onlyFavorites, sort, tab, fromDate, toDate, attachmentFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredTelegrams.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  useEffect(() => {
    if (!pendingScrollId.current && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const visibleTelegrams = filteredTelegrams.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  // Linkuri directe din e-mail (?open=ID) și navigare din Dashboard.
  useEffect(() => {
    if (loading || error || targetTelegramId == null) return;
    const targetId = String(targetTelegramId);
    if (handledTarget.current === location.key) return;
    handledTarget.current = location.key;
    if (!/^[1-9]\d*$/.test(targetId)) {
      toast.error("Linkul către telegramă este invalid.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    const exists = telegrame.some((item) => String(item.id) === targetId);
    if (!exists) {
      toast.error("Telegrama selectată nu a fost găsită.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    pendingScrollId.current = targetId;
    setHighlightedTelegramId(targetId);
    setFromDate("");
    setToDate("");
    setAttachmentFilter("all");
    setQuery("");
    setOnlyFavorites(false);
    setTab("all");
    setSort("date-desc");
    setPageSize(INITIAL_PAGE_SIZE);
    setView("list");
  }, [loading, error, targetTelegramId, telegrame, navigate, location.pathname, location.key]);
  // Selectează pagina corectă după resetarea filtrelor.
  useEffect(() => {
    const targetId = pendingScrollId.current;
    if (!targetId || loading || error) return;
    if (
      query ||
      fromDate ||
      toDate ||
      attachmentFilter !== "all" ||
      onlyFavorites ||
      tab !== "all" ||
      sort !== "date-desc" ||
      pageSize !== INITIAL_PAGE_SIZE ||
      view !== "list"
    )
      return;
    const index = filteredTelegrams.findIndex((item) => String(item.id) === targetId);
    if (index < 0) return;
    const targetPage = Math.floor(index / pageSize) + 1;
    if (page !== targetPage) {
      setPage(targetPage);
      return;
    }
    const frame = requestAnimationFrame(() => {
      const element = Array.from(document.querySelectorAll("[data-telegram-id]")).find(
        (node) => node.dataset.telegramId === targetId,
      );
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      pendingScrollId.current = null;
      navigate(location.pathname, { replace: true, state: null });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    filteredTelegrams,
    error,
    fromDate,
    toDate,
    attachmentFilter,
    page,
    pageSize,
    loading,
    query,
    onlyFavorites,
    tab,
    sort,
    view,
    navigate,
    location.pathname,
  ]);
  const favoritesCount = telegrame.filter((telegram) => telegram.is_favorite).length;
  const recentCount = telegrame.filter((telegram) => {
    const timestamp = dateValue(telegram.telegram_date || telegram.created_at);
    return timestamp && timestamp >= Date.now() - 30 * 86400000;
  }).length;
  const firstItem = filteredTelegrams.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(currentPage * pageSize, filteredTelegrams.length);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => totalPages <= 7 || p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1,
  );
  const handleOpenTelegram = async (telegram) => {
    if (openLock.current) return;
    openLock.current = true;
    setOpeningId(telegram.id);
    // Deschidem o filă sincron cu clicul, pentru PDF/linkuri.
    // Dacă documentul conține numai imagini, fila se închide și apare galeria.
    let newTab;
    try {
      newTab = window.open("about:blank", "_blank");
      if (newTab) newTab.opener = null;
      const response = await api.get(`/attachments/telegrame/${telegram.id}`);
      const attachments = Array.isArray(response.data?.attachments)
        ? response.data.attachments
        : [];
      const images = attachments.filter(
        (item) =>
          item.attachment_type !== "link" &&
          (item.file_category === "image" || item.mime_type?.startsWith("image/")),
      );
      const pdf = attachments.find(
        (item) =>
          item.attachment_type !== "link" &&
          (item.file_category === "pdf" ||
            item.mime_type === "application/pdf" ||
            /\.pdf$/i.test(item.original_name || item.file_name || item.name || "")),
      );
      // Și o singură fotografie se deschide în galerie.
      if (!pdf && images.length > 0) {
        newTab?.close();
        setGalleryTelegram(telegram);
        return;
      }
      const attachment = pdf || attachments[0];
      if (!attachment) {
        newTab?.close();
        toast.info("Această telegramă nu are documente sau linkuri atașate.");
        return;
      }
      if (attachment.attachment_type === "link") {
        const url = attachment.url;
        if (!/^https?:\/\//i.test(url || "")) {
          throw new Error("Link invalid");
        }
        if (newTab && !newTab.closed) newTab.location.replace(url);
        else toast.error("Browserul a blocat fila. Permite ferestrele pop-up și încearcă din nou.");
        return;
      }
      // Fișierele private se descarcă autentificat, nu prin URL direct.
      const fileResponse = await api.get(`/attachments/file/${attachment.id}`, {
        responseType: "blob",
      });
      const blobUrl = URL.createObjectURL(fileResponse.data);
      if (newTab && !newTab.closed) {
        newTab.location.replace(blobUrl);
      } else {
        toast.error("Browserul a blocat fila. Permite ferestrele pop-up și încearcă din nou.");
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      newTab?.close();
      console.error("Eroare deschidere telegramă:", err);
      toast.error("Nu s-a putut deschide documentul sau linkul telegramei.");
    } finally {
      openLock.current = false;
      setOpeningId(null);
    }
  };
  const handleFavorite = async (telegram) => {
    if (mutationLock.current || fetchLock.current) return;
    mutationLock.current = true;
    setFavoriteBusyId(telegram.id);
    try {
      if (telegram.is_favorite) await api.delete(`/telegrame/${telegram.id}/favorite`);
      else await api.post(`/telegrame/${telegram.id}/favorite`);
      setTelegrame((items) =>
        items.map((item) =>
          item.id === telegram.id ? { ...item, is_favorite: !telegram.is_favorite } : item,
        ),
      );
      toast.success(
        telegram.is_favorite
          ? "Telegramă eliminată din favorite."
          : "Telegramă adăugată la favorite.",
      );
    } catch (err) {
      console.error("Eroare favorite:", err);
      toast.error(err.response?.data?.message || "Nu s-a putut actualiza lista de favorite.");
    } finally {
      mutationLock.current = false;
      setFavoriteBusyId(null);
    }
  };
  const handleDeleteTelegram = async (telegram) => {
    if (!canDelete || mutationLock.current || fetchLock.current) return;
    mutationLock.current = true;
    try {
      const result = await Swal.fire({
        title: "Ștergi telegrama?",
        text: `„${telegram.title}” va fi ștearsă definitiv.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Da, șterge",
        cancelButtonText: "Anulează",
        confirmButtonColor: "#c43b47",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
      });
      if (!result.isConfirmed) return;
      setDeletingId(telegram.id);
      setError("");
      await api.delete(`/telegrame/${telegram.id}`);
      setTelegrame((items) => items.filter((item) => item.id !== telegram.id));
      if (galleryTelegram?.id === telegram.id) setGalleryTelegram(null);
      toast.success("Telegrama a fost ștearsă.");
    } catch (err) {
      console.error("Eroare ștergere telegramă:", err);
      const message = err.response?.data?.message || "Telegrama nu a putut fi ștearsă.";
      setError(message);
      toast.error(message);
    } finally {
      mutationLock.current = false;
      setDeletingId(null);
    }
  };
  const favoriteButton = (telegram) => (
    <button
      type="button"
      className={`telegrame-star ${telegram.is_favorite ? "is-active" : ""}`}
      onClick={() => handleFavorite(telegram)}
      disabled={favoriteBusyId !== null || deletingId !== null || loading || refreshing}
      aria-pressed={Boolean(telegram.is_favorite)}
      aria-label={telegram.is_favorite ? "Elimină din favorite" : "Adaugă la favorite"}
    >
      {favoriteBusyId === telegram.id ? (
        <LoaderCircle size={22} className="telegrame-spin" />
      ) : (
        <Star size={23} fill={telegram.is_favorite ? "currentColor" : "none"} />
      )}
    </button>
  );
  const management = (telegram) => (
    <div className="telegrame-manage">
      {canEdit && (
        <button
          type="button"
          className="telegrame-edit"
          onClick={() => navigate(`/telegrame/${telegram.id}/edit`)}
        >
          <Pencil size={18} /> Editează
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          className="telegrame-delete"
          disabled={deletingId !== null || favoriteBusyId !== null || loading || refreshing}
          onClick={() => handleDeleteTelegram(telegram)}
        >
          {deletingId === telegram.id ? (
            <LoaderCircle size={18} className="telegrame-spin" />
          ) : (
            <Trash2 size={18} />
          )}{" "}
          Șterge
        </button>
      )}
    </div>
  );
  const renderCard = (telegram, index) => (
    <article
      className={`telegrame-document telegrame-document-${index % 3} ${String(telegram.id) === highlightedTelegramId ? "telegrame-document-highlighted" : ""}`}
      key={telegram.id}
      data-telegram-id={telegram.id}
      style={
        String(telegram.id) === highlightedTelegramId
          ? {
              outline: "3px solid #2563eb",
              outlineOffset: "3px",
              scrollMarginTop: "100px",
            }
          : undefined
      }
    >
      <div className="telegrame-document-main">
        <div className="telegrame-document-icon">
          <FileText size={30} strokeWidth={2.2} />
        </div>
        <div className="telegrame-document-body">
          <button
            className="telegrame-document-title"
            type="button"
            disabled={openingId !== null}
            onClick={() => handleOpenTelegram(telegram)}
          >
            {telegram.number ? `TELEGRAMĂ Nr. ${telegram.number} — ` : ""}
            {telegram.title}
            {openingId === telegram.id && <LoaderCircle size={16} className="telegrame-spin" />}
          </button>
          <div className="telegrame-document-meta">
            <span>
              <Folder size={17} /> <span className="telegrame-meta-muted">Categorie:</span>{" "}
              <strong>Telegrame interne</strong>
            </span>
            <span>
              <CalendarDays size={17} /> <span className="telegrame-meta-muted">Data:</span>{" "}
              {formatDate(telegram.telegram_date)}
            </span>
            <span className="telegrame-author">
              <Tag size={17} /> <span className="telegrame-meta-muted">Adăugat de:</span>{" "}
              {telegram.created_by_name || telegram.created_by_username || "—"}
            </span>
          </div>
        </div>
        <div className="telegrame-document-tools">
          {favoriteButton(telegram)}
          <div className="telegrame-more-wrap">
            <button
              className="telegrame-more"
              type="button"
              aria-label="Mai multe opțiuni"
              aria-expanded={menuId === telegram.id}
              onClick={() => setMenuId(menuId === telegram.id ? null : telegram.id)}
            >
              <MoreVertical size={23} />
            </button>
            {menuId === telegram.id && (
              <div className="telegrame-popover">
                <button
                  type="button"
                  onClick={() => {
                    setMenuId(null);
                    handleOpenTelegram(telegram);
                  }}
                >
                  <FileText size={16} /> Deschide documentul
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setMenuId(null);
                    try {
                      const url = new URL(window.location.href);
                      url.search = "";
                      url.hash = "";
                      url.searchParams.set("open", String(telegram.id));
                      await navigator.clipboard.writeText(url.href);
                      toast.success("Link intern copiat.");
                    } catch {
                      toast.error("Linkul nu a putut fi copiat.");
                    }
                  }}
                >
                  Copiază linkul intern
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuId(null);
                      navigate(`/telegrame/${telegram.id}/edit`);
                    }}
                  >
                    Editează
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuId(null);
                      handleDeleteTelegram(telegram);
                    }}
                  >
                    Șterge
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="telegrame-document-footer">
        <button
          type="button"
          className="telegrame-attachment"
          disabled={openingId !== null}
          onClick={() => handleOpenTelegram(telegram)}
        >
          <Paperclip size={20} />
          {Number(telegram.attachments_count) || 0}{" "}
          {(Number(telegram.attachments_count) || 0) === 1 ? "fișier atașat" : "fișiere atașate"}
        </button>
        {management(telegram)}
      </div>
    </article>
  );
  return (
    <div className="telegrame-page">
      <header className="telegrame-hero">
        <div className="telegrame-hero-copy">
          <div className="telegrame-eyebrow">
            <FileText size={20} /> DOCUMENTE INTERNE
          </div>
          <h1>Telegrame interne</h1>
          <p>Lista telegramelor disponibile în platformă.</p>
          {canEdit && (
            <button
              type="button"
              className="telegrame-add-button"
              onClick={() => navigate("/telegrame/adauga")}
            >
              <Plus size={22} /> Adaugă telegramă
            </button>
          )}
        </div>
        <div className="telegrame-hero-art" aria-hidden="true">
          <div className="telegrame-art-sheet telegrame-art-sheet-back">
            <span />
            <span />
            <span />
          </div>
          <div className="telegrame-art-sheet telegrame-art-sheet-front">
            <span />
            <span />
            <span />
            <span />
            <i />
          </div>
        </div>
      </header>
      {error && (
        <div className="telegrame-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            disabled={loading || refreshing || favoriteBusyId !== null || deletingId !== null}
            onClick={() => fetchTelegrame({ silent: true })}
            aria-label="Reîncarcă"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      )}
      <section className="telegrame-register" aria-label="Registrul telegramelor">
        <div className="telegrame-tabs">
          <button
            aria-pressed={tab === "all"}
            className={tab === "all" ? "is-active" : ""}
            type="button"
            onClick={() => {
              setTab("all");
              setOnlyFavorites(false);
            }}
          >
            <List size={20} /> Toate <b>{telegrame.length}</b>
          </button>
          <button
            aria-pressed={tab === "recent"}
            className={tab === "recent" ? "is-active" : ""}
            type="button"
            onClick={() => {
              setTab("recent");
              setOnlyFavorites(false);
            }}
          >
            <Clock3 size={20} /> Recente <b>{recentCount}</b>
          </button>
          <button
            aria-pressed={tab === "important"}
            className={tab === "important" ? "is-active" : ""}
            type="button"
            onClick={() => {
              setTab("important");
              setOnlyFavorites(true);
            }}
          >
            <Star size={20} /> Importante <b>{favoritesCount}</b>
          </button>
          <button
            type="button"
            className={`telegrame-filters-toggle ${showFilters ? "is-active" : ""}`}
            aria-expanded={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={20} /> Filtre {activeFilters > 0 && <b>{activeFilters}</b>}
          </button>
        </div>
        <div className="telegrame-extra-filters">
          <label className="telegrame-search">
            <Search size={18} />
            <input
              ref={searchInput}
              type="search"
              maxLength={120}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută după titlu, număr sau autor..."
              aria-label="Caută telegrame"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Șterge căutarea">
                <X size={17} />
              </button>
            )}
          </label>
          <button
            type="button"
            className="telegrame-refresh"
            disabled={loading || refreshing || favoriteBusyId !== null || deletingId !== null}
            onClick={() => fetchTelegrame({ silent: true })}
          >
            <RefreshCw size={18} className={refreshing ? "telegrame-spin" : ""} /> Actualizează
          </button>
        </div>
        {showFilters && (
          <div className="telegrame-advanced-filters">
            <label>
              De la
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>
            <label>
              Până la
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
            <label>
              Atașamente
              <select
                value={attachmentFilter}
                onChange={(e) => setAttachmentFilter(e.target.value)}
              >
                <option value="all">Toate</option>
                <option value="with">Cu atașamente</option>
                <option value="without">Fără atașamente</option>
              </select>
            </label>
            <button type="button" className="telegrame-refresh" onClick={resetFilters}>
              Resetează filtrele
            </button>
          </div>
        )}
        {(query || activeFilters > 0) && (
          <div className="telegrame-filter-summary">
            <span>{filteredTelegrams.length} rezultate filtrate</span>
            <button type="button" onClick={resetFilters}>
              Șterge filtrele
            </button>
          </div>
        )}
        <div className="telegrame-list-toolbar" ref={listRef}>
          <h2>
            {filteredTelegrams.length} {filteredTelegrams.length === 1 ? "telegramă" : "telegrame"}
          </h2>
          <div className="telegrame-list-controls">
            <span className="telegrame-sort-label">Sortare:</span>
            <label className="telegrame-sort">
              <CalendarDays size={19} />
              <select
                aria-label="Sortează telegramele"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="date-desc">Data (cele mai noi)</option>
                <option value="date-asc">Data (cele mai vechi)</option>
                <option value="title-asc">Titlu (A–Z)</option>
                <option value="title-desc">Titlu (Z–A)</option>
                <option value="number-asc">Număr crescător</option>
                <option value="number-desc">Număr descrescător</option>
              </select>
            </label>
            <div className="telegrame-view-switch" role="group" aria-label="Mod de afișare">
              <button
                type="button"
                className={view === "list" ? "is-active" : ""}
                aria-label="Afișare listă"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List size={21} />
              </button>
              <button
                type="button"
                className={view === "grid" ? "is-active" : ""}
                aria-label="Afișare grilă"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <LayoutGrid size={21} />
              </button>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="telegrame-loading">
            <LoaderCircle className="telegrame-spin" size={24} /> Se încarcă telegramele...
          </div>
        ) : visibleTelegrams.length === 0 ? (
          <div className="telegrame-empty">
            <FileText size={36} />
            <strong>
              {error ? "Nu s-au putut încărca telegramele." : "Nu am găsit telegrame."}
            </strong>
            <span>
              {error
                ? "Reîncearcă încărcarea listei."
                : "Modifică filtrele sau termenul de căutare."}
            </span>
            <button
              type="button"
              className="telegrame-refresh"
              onClick={error ? () => fetchTelegrame() : resetFilters}
            >
              {error ? "Reîncearcă" : "Resetează filtrele"}
            </button>
          </div>
        ) : (
          <div className={`telegrame-documents ${view === "grid" ? "is-grid" : ""}`}>
            {visibleTelegrams.map(renderCard)}
          </div>
        )}
        {!loading && filteredTelegrams.length > 0 && (
          <footer className="telegrame-pagination">
            <span className="telegrame-page-status">
              Afișate {firstItem} – {lastItem} din {filteredTelegrams.length} telegrame
            </span>
            <div className="telegrame-page-buttons">
              <button
                type="button"
                disabled={currentPage === 1}
                aria-label="Prima pagină"
                onClick={() => {
                  setPage(1);
                  listRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
                }}
              >
                <ChevronsLeft size={19} />
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                aria-label="Pagina anterioară"
                onClick={() => {
                  setPage(currentPage - 1);
                  listRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
                }}
              >
                <ChevronLeft size={19} />
              </button>
              {pages.map((p, i) => (
                <span className="telegrame-page-item" key={p}>
                  {i > 0 && p - pages[i - 1] > 1 && <span className="telegrame-ellipsis">…</span>}
                  <button
                    type="button"
                    className={p === currentPage ? "is-active" : ""}
                    aria-current={p === currentPage ? "page" : undefined}
                    onClick={() => {
                      setPage(p);
                      listRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
                    }}
                  >
                    {p}
                  </button>
                </span>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                aria-label="Pagina următoare"
                onClick={() => {
                  setPage(currentPage + 1);
                  listRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
                }}
              >
                <ChevronRight size={19} />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                aria-label="Ultima pagină"
                onClick={() => {
                  setPage(totalPages);
                  listRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
                }}
              >
                <ChevronsRight size={19} />
              </button>
            </div>
            <label className="telegrame-page-size">
              Elemente pe pagină:
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                <option value={8}>8</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
              </select>
            </label>
          </footer>
        )}
      </section>
      {galleryTelegram && (
        <TelegramGallery
          entityType="telegrame"
          entityId={galleryTelegram.id}
          title={galleryTelegram.title}
          onClose={() => setGalleryTelegram(null)}
        />
      )}
    </div>
  );
}
export default Telegrame;
