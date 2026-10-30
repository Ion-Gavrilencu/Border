import { useEffect, useMemo, useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import {
  Archive,
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

import "./Legislatie.css";

const PAGE_SIZES = [8, 12, 24];

const getDate = (item) =>
  item.law_date || item.created_at || item.createdAt || "";

const getTimestamp = (item) => {
  const time = new Date(getDate(item)).getTime();

  return Number.isFinite(time) ? time : 0;
};

const getTags = (item) => {
  const tags = item.tags || item.etichete;

  if (Array.isArray(tags))
    return tags

      .map((tag) => (typeof tag === "string" ? tag : tag?.name))

      .filter(Boolean);

  if (typeof tags === "string")
    return tags

      .split(",")

      .map((tag) => tag.trim())

      .filter(Boolean);

  return [];
};

const isArchived = (item) =>
  item.is_archived === true ||
  item.archived === true ||
  item.status === "archived";

const getAttachmentCount = (item) => {
  if (Array.isArray(item.attachments)) return item.attachments.length;

  const count =
    item.attachments_count ?? item.attachment_count ?? item.files_count;

  return Number.isFinite(Number(count)) && count !== undefined && count !== null
    ? Number(count)
    : null;
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

  const [favorites, setFavorites] = useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("legislatie-favorites") || "[]",
      );

      return Array.isArray(stored) ? stored.map(String) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let active = true;

    async function loadLegislatie() {
      try {
        setLoading(true);

        setError("");

        const response = await api.get("/legislatie");

        if (active) setLegislatie(response.data.legislatie || []);
      } catch (err) {
        if (active)
          setError(
            err.response?.data?.message ||
              "Nu s-au putut încărca actele normative.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadLegislatie();

    return () => {
      active = false;
    };
  }, []);

  const toggleFavorite = (id) => {
    const next = favorites.includes(String(id))
      ? favorites.filter((value) => value !== String(id))
      : [...favorites, String(id)];

    setFavorites(next);

    try {
      localStorage.setItem("legislatie-favorites", JSON.stringify(next));
    } catch {
      /* Storage may be unavailable */
    }
  };

  const handleOpenLegislation = async (legislation) => {
    const newTab = window.open("about:blank", "_blank");

    if (newTab) newTab.opener = null;

    try {
      setError("");

      const response = await api.get(
        `/attachments/legislatie/${legislation.id}`,
      );

      const attachments = response.data.attachments || [];

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

        setGalleryLegislation(legislation);

        return;
      }

      const attachment = pdf || attachments[0];

      if (!attachment) {
        newTab?.close();

        window.alert(
          "Acest act normativ nu are documente sau linkuri atașate.",
        );

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
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      newTab?.close();

      console.error("Eroare deschidere act normativ:", err);

      setError("Nu s-a putut deschide documentul sau linkul actului normativ.");
    }
  };

  const handleDeleteLegislation = async (item) => {
    if (!canDelete || deletingId !== null) return;

    if (
      !window.confirm(
        `Sigur dorești să ștergi actul normativ "${item.title}"?\n\nAceastă acțiune nu poate fi anulată.`,
      )
    )
      return;

    setDeletingId(item.id);

    setError("");

    try {
      await api.delete(`/legislatie/${item.id}`);

      setLegislatie((current) =>
        current.filter((entry) => entry.id !== item.id),
      );

      if (galleryLegislation?.id === item.id) setGalleryLegislation(null);

      setMenuId(null);
    } catch (err) {
      console.error("Eroare ștergere act normativ:", err);

      setError(
        err.response?.data?.message || "Actul normativ nu a putut fi șters.",
      );
    } finally {
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

      if (tab === "archived") return archived;

      if (archived) return false;

      if (tab === "favorites" && !favorites.includes(String(item.id)))
        return false;

      if (tab === "recent" && !recentIds.has(String(item.id))) return false;

      if (
        filterType !== "all" &&
        !String(item.title || "")
          .toLowerCase()

          .includes(filterType)
      )
        return false;

      return true;
    });

    return [...items].sort((a, b) => {
      if (sort === "oldest") return getTimestamp(a) - getTimestamp(b);

      if (sort === "az")
        return String(a.title || "").localeCompare(String(b.title || ""), "ro");

      if (sort === "za")
        return String(b.title || "").localeCompare(String(a.title || ""), "ro");

      return getTimestamp(b) - getTimestamp(a);
    });
  }, [legislatie, tab, favorites, recentIds, filterType, sort]);

  useEffect(() => {
    if (targetId != null && /^[1-9]\d*$/.test(String(targetId))) {
      setPendingTarget(String(targetId));
      setHighlightedId(String(targetId));
    }
  }, [targetId, location.key]);

  useEffect(() => {
    if (loading || pendingTarget === null) return;

    const target = legislatie.find((item) => String(item.id) === pendingTarget);

    if (!target) {
      setPendingTarget(null);

      return;
    }

    const desiredTab = isArchived(target) ? "archived" : "all";

    if (tab !== desiredTab || filterType !== "all") {
      setTab(desiredTab);

      setFilterType("all");

      return;
    }

    const index = visible.findIndex(
      (item) => String(item.id) === pendingTarget,
    );

    if (index < 0) return;

    const desiredPage = Math.floor(index / pageSize) + 1;

    if (page !== desiredPage) {
      setPage(desiredPage);

      return;
    }

    const frame = requestAnimationFrame(() => {
      const card = Array.from(
        document.querySelectorAll("[data-legislatie-id]"),
      ).find(
        (element) =>
          element.getAttribute("data-legislatie-id") === pendingTarget,
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

  const pageItems = visible.slice(
    (currentPage - 1) * pageSize,

    currentPage * pageSize,
  );

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
                  (item) =>
                    !isArchived(item) && favorites.includes(String(item.id)),
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
          <SlidersHorizontal size={20} /> Filtre
        </button>
      </div>

      {filtersOpen && (
        <section
          className="legislatie-filter-panel"
          aria-label="Filtre acte normative"
        >
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
          </select>

          <button
            onClick={() => {
              changeFilter("all");

              setFiltersOpen(false);
            }}
          >
            <X size={16} /> Resetează
          </button>
        </section>
      )}

      <div className="legislatie-toolbar">
        <strong>
          {visible.length}{" "}
          {visible.length === 1 ? "act normativ" : "acte normative"}
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
        <div className="legislation-loading">
          Se încarcă actele normative...
        </div>
      ) : pageItems.length === 0 ? (
        <div className="legislation-empty">
          {legislatie.length === 0
            ? "Nu există acte normative."
            : "Nu există acte normative pentru filtrele selectate."}
        </div>
      ) : (
        <div
          className={`legislatie-cards ${view === "grid" ? "grid-view" : ""}`}
        >
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
                    onClick={() => handleOpenLegislation(item)}
                  >
                    {item.title || "Act normativ fără titlu"}
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

                  {item.law_number && (
                    <div className="legislatie-card-detail">
                      Nr. {item.law_number}
                      {item.law_date
                        ? ` · ${new Date(item.law_date).toLocaleDateString("ro-RO")}`
                        : ""}
                    </div>
                  )}
                </div>

                <div className="legislatie-card-top-actions">
                  <button
                    className={`legislatie-star ${favorite ? "is-favorite" : ""}`}
                    title={
                      favorite
                        ? "Elimină de la importante (local)"
                        : "Marchează important (local)"
                    }
                    aria-label={
                      favorite
                        ? "Elimină de la importante"
                        : "Marchează important"
                    }
                    onClick={() => toggleFavorite(item.id)}
                  >
                    <Star size={23} fill={favorite ? "currentColor" : "none"} />
                  </button>

                  <div className="legislatie-menu-wrap">
                    <button
                      title="Mai multe opțiuni"
                      aria-label="Mai multe opțiuni"
                      aria-expanded={menuId === item.id}
                      onClick={() =>
                        setMenuId(menuId === item.id ? null : item.id)
                      }
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

                        {canEdit && (
                          <button
                            onClick={() =>
                              navigate(`/legislatie/${item.id}/edit`)
                            }
                          >
                            <Pencil size={16} /> Editează
                          </button>
                        )}

                        {canDelete && (
                          <button
                            className="danger"
                            onClick={() => handleDeleteLegislation(item)}
                          >
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
                        <Trash2 size={18} />{" "}
                        {deletingId === item.id ? "Se șterge..." : "Șterge"}
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
            {Math.min(currentPage * pageSize, visible.length)} din{" "}
            {visible.length} acte normative
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
                  totalPages <= 5 ||
                  Math.abs(p - currentPage) <= 1 ||
                  p === 1 ||
                  p === totalPages,
              )

              .map((p, i, array) => (
                <span key={p} className="legislatie-page-entry">
                  {i > 0 && p - array[i - 1] > 1 && (
                    <span className="legislatie-ellipsis">…</span>
                  )}

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
