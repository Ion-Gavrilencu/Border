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
import "./Ordine.css";
const INITIAL_PAGE_SIZE = 8;
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
function Ordine() {
  const navigate = useNavigate();
  const location = useLocation();
  const emailOrderId = new URLSearchParams(location.search).get("open");
  const dashboardOrderId =
    location.state?.openDocumentType === "ordin"
      ? location.state?.openDocumentId
      : null;
  const targetOrderId = emailOrderId || dashboardOrderId;
  const handledTarget = useRef(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState(null);
  const pendingScrollId = useRef(null);
  const { user } = useAuth();
  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";
  const canDelete = user?.role === "ADMIN";
  const [ordine, setOrdine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [favoriteBusyId, setFavoriteBusyId] = useState(null);
  const [galleryOrder, setGalleryOrder] = useState(null);
  const [query, setQuery] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sort, setSort] = useState("date-desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(INITIAL_PAGE_SIZE);
  const [view, setView] = useState("list");
  const [tab, setTab] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const fetchOrdine = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await api.get("/ordine");
      setOrdine(
        Array.isArray(response.data?.ordine) ? response.data.ordine : [],
      );
      setError("");
    } catch (err) {
      console.error("Eroare încărcare ordine:", err);
      const message =
        err.response?.data?.message || "Ordinele nu au putut fi încărcate.";
      setError(message);
      if (silent) toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    fetchOrdine();
  }, [fetchOrdine]);
  useEffect(() => {
    setPage(1);
  }, [query, onlyFavorites, sort, tab, pageSize]);
  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ro-RO");
    return ordine
      .filter((order) => {
        if ((onlyFavorites || tab === "important") && !order.is_favorite)
          return false;
        if (tab === "recent") {
          const timestamp = dateValue(order.order_date || order.created_at);
          if (!timestamp || timestamp < Date.now() - 30 * 86400000)
            return false;
        }
        if (!normalized) return true;
        return [
          order.title,
          order.number,
          order.created_by_name,
          order.created_by_username,
        ].some((value) =>
          String(value ?? "")
            .toLocaleLowerCase("ro-RO")
            .includes(normalized),
        );
      })
      .sort((a, b) => {
        if (sort === "date-asc")
          return (
            dateValue(a.order_date) - dateValue(b.order_date) ||
            Number(a.id) - Number(b.id)
          );
        if (sort === "title-asc")
          return String(a.title ?? "").localeCompare(
            String(b.title ?? ""),
            "ro",
          );
        if (sort === "title-desc")
          return String(b.title ?? "").localeCompare(
            String(a.title ?? ""),
            "ro",
          );
        return (
          dateValue(b.order_date) - dateValue(a.order_date) ||
          Number(b.id) - Number(a.id)
        );
      });
  }, [ordine, query, onlyFavorites, sort, tab]);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  // Linkuri directe din e-mail (?open=ID) și navigare din Dashboard.
  useEffect(() => {
    if (loading || error || targetOrderId == null) return;

    const targetId = String(targetOrderId);
    if (handledTarget.current === targetId) return;
    handledTarget.current = targetId;

    if (!/^[1-9]\d*$/.test(targetId)) {
      toast.error("Linkul către ordin este invalid.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    const exists = ordine.some((item) => String(item.id) === targetId);
    if (!exists) {
      toast.error("Ordinul selectat nu a fost găsit.");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    pendingScrollId.current = targetId;
    setHighlightedOrderId(targetId);
    setQuery("");
    setOnlyFavorites(false);
    setTab("all");
    setSort("date-desc");
    setPageSize(INITIAL_PAGE_SIZE);
    setView("list");
  }, [loading, error, targetOrderId, ordine, navigate, location.pathname]);

  // Selectează pagina corectă după resetarea filtrelor.
  useEffect(() => {
    const targetId = pendingScrollId.current;
    if (!targetId || loading) return;
    if (
      query ||
      onlyFavorites ||
      tab !== "all" ||
      sort !== "date-desc" ||
      pageSize !== INITIAL_PAGE_SIZE ||
      view !== "list"
    )
      return;

    const index = filteredOrders.findIndex(
      (item) => String(item.id) === targetId,
    );
    if (index < 0) return;

    const targetPage = Math.floor(index / pageSize) + 1;
    if (page !== targetPage) {
      setPage(targetPage);
      return;
    }

    const frame = requestAnimationFrame(() => {
      const element = Array.from(
        document.querySelectorAll("[data-order-id]"),
      ).find((node) => node.dataset.orderId === targetId);
      if (!element) return;

      element.scrollIntoView({ behavior: "smooth", block: "center" });
      pendingScrollId.current = null;
      navigate(location.pathname, { replace: true, state: null });
    });

    return () => cancelAnimationFrame(frame);
  }, [
    filteredOrders,
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

  const favoritesCount = ordine.filter((order) => order.is_favorite).length;
  const recentCount = ordine.filter((order) => {
    const timestamp = dateValue(order.order_date || order.created_at);
    return timestamp && timestamp >= Date.now() - 30 * 86400000;
  }).length;
  const firstItem = filteredOrders.length
    ? (currentPage - 1) * pageSize + 1
    : 0;
  const lastItem = Math.min(currentPage * pageSize, filteredOrders.length);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) =>
      totalPages <= 7 ||
      p === 1 ||
      p === totalPages ||
      Math.abs(p - currentPage) <= 1,
  );
  const handleOpenOrder = async (order) => {
    // Deschidem fila imediat după clic pentru a evita blocarea popup-ului.
    const newTab = window.open("about:blank", "\_blank");
    if (newTab) newTab.opener = null;
    try {
      const response = await api.get(`/attachments/ordine/${order.id}`);
      const attachments = Array.isArray(response.data?.attachments)
        ? response.data.attachments
        : [];
      const images = attachments.filter(
        (item) =>
          item.attachment_type !== "link" &&
          (item.file_category === "image" ||
            item.mime_type?.startsWith("image/")),
      );
      const pdf = attachments.find(
        (item) =>
          item.attachment_type !== "link" &&
          (item.file_category === "pdf" ||
            item.mime_type === "application/pdf" ||
            /\.pdf$/i.test(
              item.original_name || item.file_name || item.name || "",
            )),
      );
      if (!pdf && images.length > 1) {
        newTab?.close();
        setGalleryOrder(order);
        return;
      }
      const attachment = pdf || attachments[0];
      if (!attachment) {
        newTab?.close();
        toast.info("Acest ordin nu are documente sau linkuri atașate.");
        return;
      }
      let url;
      if (attachment.attachment_type === "link") {
        url = attachment.url;
        if (!/^https?:\/\//i.test(url || "")) throw new Error("Link invalid");
      } else {
        url = `${api.defaults.baseURL}/attachments/file/${attachment.id}`;
      }
      if (newTab && !newTab.closed) newTab.location.replace(url);
      else window.open(url, "\_blank", "noopener,noreferrer");
    } catch (err) {
      newTab?.close();
      console.error("Eroare deschidere ordin:", err);
      toast.error("Nu s-a putut deschide documentul sau linkul ordinului.");
    }
  };
  const handleFavorite = async (order) => {
    if (favoriteBusyId !== null) return;
    setFavoriteBusyId(order.id);
    try {
      if (order.is_favorite) await api.delete(`/ordine/${order.id}/favorite`);
      else await api.post(`/ordine/${order.id}/favorite`);
      setOrdine((items) =>
        items.map((item) =>
          item.id === order.id
            ? { ...item, is_favorite: !order.is_favorite }
            : item,
        ),
      );
      toast.success(
        order.is_favorite
          ? "Ordin eliminat din favorite."
          : "Ordin adăugat la favorite.",
      );
    } catch (err) {
      console.error("Eroare favorite:", err);
      toast.error(
        err.response?.data?.message ||
          "Nu s-a putut actualiza lista de favorite.",
      );
    } finally {
      setFavoriteBusyId(null);
    }
  };
  const handleDeleteOrder = async (order) => {
    if (!canDelete || deletingId !== null) return;
    const result = await Swal.fire({
      title: "Ștergi ordinul?",
      text: `„${order.title}” va fi șters definitiv.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Da, șterge",
      cancelButtonText: "Anulează",
      confirmButtonColor: "#c43b47",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setDeletingId(order.id);
    setError("");
    try {
      await api.delete(`/ordine/${order.id}`);
      setOrdine((items) => items.filter((item) => item.id !== order.id));
      if (galleryOrder?.id === order.id) setGalleryOrder(null);
      toast.success("Ordinul a fost șters.");
    } catch (err) {
      console.error("Eroare ștergere ordin:", err);
      const message =
        err.response?.data?.message || "Ordinul nu a putut fi șters.";
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };
  const favoriteButton = (order) => (
    <button
      type="button"
      className={`ordine-star ${order.is_favorite ? "is-active" : ""}`}
      onClick={() => handleFavorite(order)}
      disabled={favoriteBusyId !== null}
      aria-pressed={Boolean(order.is_favorite)}
      aria-label={
        order.is_favorite ? "Elimină din favorite" : "Adaugă la favorite"
      }
    >
      {favoriteBusyId === order.id ? (
        <LoaderCircle size={22} className="ordine-spin" />
      ) : (
        <Star size={23} fill={order.is_favorite ? "currentColor" : "none"} />
      )}
    </button>
  );
  const management = (order) => (
    <div className="ordine-manage">
      {canEdit && (
        <button
          type="button"
          className="ordine-edit"
          onClick={() => navigate(`/ordine/${order.id}/edit`)}
        >
          <Pencil size={18} /> Editează
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          className="ordine-delete"
          disabled={deletingId !== null}
          onClick={() => handleDeleteOrder(order)}
        >
          {deletingId === order.id ? (
            <LoaderCircle size={18} className="ordine-spin" />
          ) : (
            <Trash2 size={18} />
          )}{" "}
          Șterge
        </button>
      )}
    </div>
  );
  const renderCard = (order, index) => (
    <article
      className={`ordine-document ordine-document-${index % 3} ${String(order.id) === highlightedOrderId ? "ordine-document-highlighted" : ""}`}
      key={order.id}
      data-order-id={order.id}
      style={
        String(order.id) === highlightedOrderId
          ? {
              outline: "3px solid #2563eb",
              outlineOffset: "3px",
              scrollMarginTop: "100px",
            }
          : undefined
      }
    >
      <div className="ordine-document-main">
        <div className="ordine-document-icon">
          <FileText size={30} strokeWidth={2.2} />
        </div>
        <div className="ordine-document-body">
          <button
            className="ordine-document-title"
            type="button"
            onClick={() => handleOpenOrder(order)}
          >
            {order.number ? `ORDIN Nr. ${order.number} — ` : ""}
            {order.title}
          </button>
          <div className="ordine-document-meta">
            <span>
              <Folder size={17} />{" "}
              <span className="ordine-meta-muted">Categorie:</span>{" "}
              <strong>Ordine interne</strong>
            </span>
            <span>
              <CalendarDays size={17} />{" "}
              <span className="ordine-meta-muted">Data:</span>{" "}
              {formatDate(order.order_date)}
            </span>
            <span className="ordine-author">
              <Tag size={17} />{" "}
              <span className="ordine-meta-muted">Adăugat de:</span>{" "}
              {order.created_by_name || order.created_by_username || "—"}
            </span>
          </div>
        </div>
        <div className="ordine-document-tools">
          {favoriteButton(order)}
          <div className="ordine-more-wrap">
            <button
              className="ordine-more"
              type="button"
              aria-label="Mai multe opțiuni"
              aria-expanded={menuId === order.id}
              onClick={() => setMenuId(menuId === order.id ? null : order.id)}
            >
              <MoreVertical size={23} />
            </button>
            {menuId === order.id && (
              <div className="ordine-popover">
                <button
                  type="button"
                  onClick={() => {
                    setMenuId(null);
                    handleOpenOrder(order);
                  }}
                >
                  Deschide documentul
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuId(null);
                      navigate(`/ordine/${order.id}/edit`);
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
                      handleDeleteOrder(order);
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
      <div className="ordine-document-footer">
        <button
          type="button"
          className="ordine-attachment"
          onClick={() => handleOpenOrder(order)}
        >
          <Paperclip size={20} />
          {Number(order.attachments_count) || 0}{" "}
          {(Number(order.attachments_count) || 0) === 1
            ? "fișier atașat"
            : "fișiere atașate"}
        </button>
        {management(order)}
      </div>
    </article>
  );
  return (
    <div className="ordine-page">
      <header className="ordine-hero">
        <div className="ordine-hero-copy">
          <div className="ordine-eyebrow">
            <FileText size={20} /> DOCUMENTE INTERNE
          </div>
          <h1>Ordine interne</h1>
          <p>Lista ordinelor interne disponibile în platformă.</p>
          {canEdit && (
            <button
              type="button"
              className="ordine-add-button"
              onClick={() => navigate("/ordine/adauga")}
            >
              <Plus size={22} /> Adaugă ordin
            </button>
          )}
        </div>
        <div className="ordine-hero-art" aria-hidden="true">
          <div className="ordine-art-sheet ordine-art-sheet-back">
            <span />
            <span />
            <span />
          </div>
          <div className="ordine-art-sheet ordine-art-sheet-front">
            <span />
            <span />
            <span />
            <span />
            <i />
          </div>
        </div>
      </header>
      {error && (
        <div className="ordine-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchOrdine({ silent: true })}
            aria-label="Reîncarcă"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      )}
      <section className="ordine-register" aria-label="Registrul ordinelor">
        <div className="ordine-tabs">
          <button
            className={tab === "all" ? "is-active" : ""}
            type="button"
            onClick={() => {
              setTab("all");
              setOnlyFavorites(false);
            }}
          >
            <List size={20} /> Toate <b>{ordine.length}</b>
          </button>
          <button
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
            className={`ordine-filters-toggle ${showFilters ? "is-active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={20} /> Filtre
          </button>
        </div>
        {showFilters && (
          <div className="ordine-extra-filters">
            <label className="ordine-search">
              <Search size={18} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Caută după titlu, număr sau autor..."
                aria-label="Caută ordine"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Șterge căutarea"
                >
                  <X size={17} />
                </button>
              )}
            </label>
            <button
              type="button"
              className="ordine-refresh"
              disabled={loading || refreshing}
              onClick={() => fetchOrdine({ silent: true })}
            >
              <RefreshCw
                size={18}
                className={refreshing ? "ordine-spin" : ""}
              />{" "}
              Actualizează
            </button>
          </div>
        )}
        <div className="ordine-list-toolbar">
          <h2>
            {filteredOrders.length}{" "}
            {filteredOrders.length === 1 ? "ordin intern" : "ordine interne"}
          </h2>
          <div className="ordine-list-controls">
            <span className="ordine-sort-label">Sortare:</span>
            <label className="ordine-sort">
              <CalendarDays size={19} />
              <select
                aria-label="Sortează ordinele"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="date-desc">Data (cele mai noi)</option>
                <option value="date-asc">Data (cele mai vechi)</option>
                <option value="title-asc">Titlu (A–Z)</option>
                <option value="title-desc">Titlu (Z–A)</option>
              </select>
            </label>
            <div
              className="ordine-view-switch"
              role="group"
              aria-label="Mod de afișare"
            >
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
          <div className="ordine-loading">
            <LoaderCircle className="ordine-spin" size={24} /> Se încarcă
            ordinele...
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="ordine-empty">
            <FileText size={36} />
            <strong>
              {error
                ? "Nu s-au putut încărca ordinele."
                : "Nu am găsit ordine."}
            </strong>
            <span>
              {error
                ? "Reîncearcă încărcarea listei."
                : "Modifică filtrele sau termenul de căutare."}
            </span>
          </div>
        ) : (
          <div
            className={`ordine-documents ${view === "grid" ? "is-grid" : ""}`}
          >
            {visibleOrders.map(renderCard)}
          </div>
        )}
        {!loading && filteredOrders.length > 0 && (
          <footer className="ordine-pagination">
            <span className="ordine-page-status">
              Afișate {firstItem} – {lastItem} din {filteredOrders.length}{" "}
              ordine interne
            </span>
            <div className="ordine-page-buttons">
              <button
                type="button"
                disabled={currentPage === 1}
                aria-label="Prima pagină"
                onClick={() => setPage(1)}
              >
                <ChevronsLeft size={19} />
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                aria-label="Pagina anterioară"
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={19} />
              </button>
              {pages.map((p, i) => (
                <span className="ordine-page-item" key={p}>
                  {i > 0 && p - pages[i - 1] > 1 && (
                    <span className="ordine-ellipsis">…</span>
                  )}
                  <button
                    type="button"
                    className={p === currentPage ? "is-active" : ""}
                    aria-current={p === currentPage ? "page" : undefined}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                </span>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                aria-label="Pagina următoare"
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight size={19} />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                aria-label="Ultima pagină"
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight size={19} />
              </button>
            </div>
            <label className="ordine-page-size">
              Elemente pe pagină:
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={8}>8</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
              </select>
            </label>
          </footer>
        )}
      </section>
      {galleryOrder && (
        <TelegramGallery
          entityType="ordine"
          entityId={galleryOrder.id}
          title={galleryOrder.title}
          onClose={() => setGalleryOrder(null)}
        />
      )}
    </div>
  );
}
export default Ordine;
