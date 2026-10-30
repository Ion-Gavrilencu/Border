import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import { toast } from "sonner";

import Swal from "sweetalert2";

import {
  BookOpen,
  Plus,
  X,
  ArrowUpRight,
  Pencil,
  Trash2,
  FolderOpen,
  FileText,
  ArrowDownUp,
  CalendarDays,
  UserRound,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Video,
  Link2,
  Eye,
  Download,
  Star,
  MoreVertical,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import api from "../services/api";

import { useAuth } from "../context/AuthContext";

import "./InformatiiUtile.css";

import TelegramGallery from "../components/TelegramGallery";

const getInfoFormat = (item) => {
  const value = String(
    item.format ||
      item.file_format ||
      item.mime_type ||
      item.original_name ||
      "",
  ).toLowerCase();

  if (value.includes("pdf")) return "PDF";

  if (value.includes("doc")) return "DOCX";

  if (value.includes("xls")) return "XLSX";

  if (value.includes("zip")) return "ZIP";

  if (value.includes("image") || /\.(jpg|jpeg|png|webp)$/.test(value))
    return "IMG";

  if (value.includes("video") || /\.(mp4|webm)$/.test(value)) return "VIDEO";

  if (item.url) return "LINK";

  return "—";
};

const formatBytes = (n) =>
  !Number(n) ? "—" : `${(Number(n) / 1048576).toFixed(1)} MB`;

const getCategoryTone = (value) => {
  const name = String(value || "").toLocaleLowerCase("ro-RO");

  if (name.includes("procedur")) return "proceduri";

  if (name.includes("legisla") || name.includes("normativ"))
    return "legislatie";

  if (name.includes("inform") || name.includes("contact")) return "informativ";

  return "ghiduri";
};

const formatDate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("ro-RO", {
        day: "2-digit",

        month: "short",

        year: "numeric",
      }).format(date);
};

function ModernFilter({ icon: Icon, label, value, options, onChange }) {
  const [open, setOpen] = useState(false);

  const rootRef = useRef(null);

  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;

    const handleOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handleOutside);

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutside);

      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className={`info-filter ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="info-filter-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="info-filter-icon">
          <Icon size={18} />
        </span>

        <span className="info-filter-copy">
          <span className="info-filter-caption">{label}</span>

          <strong>{selected?.label || label}</strong>
        </span>

        <ChevronDown className="info-filter-chevron" size={16} />
      </button>

      {open && (
        <div className="info-filter-menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              className={`info-filter-option ${value === option.value ? "is-active" : ""}`}
              onClick={() => {
                onChange(option.value);

                setOpen(false);
              }}
            >
              <span>{option.label}</span>

              {value === option.value && <CheckCircle2 size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InformatiiUtile() {
  const { user } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const navigationHandledRef = useRef(null);
  const [targetInfoId, setTargetInfoId] = useState(null);

  const [informatii, setInformatii] = useState([]);

  const [loading, setLoading] = useState(true);

  const [deletingId, setDeletingId] = useState(null);

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] = useState("success");

  const [category, setCategory] = useState("Toate");

  const [page, setPage] = useState(1);

  const [formatFilter, setFormatFilter] = useState("Toate");

  const [checkedIds, setCheckedIds] = useState([]);

  const [selectedInfo, setSelectedInfo] = useState(null);

  const [pageSize, setPageSize] = useState(10);

  const [importantOnly, setImportantOnly] = useState(false);

  const [favoriteBusy, setFavoriteBusy] = useState([]);

  const [menuId, setMenuId] = useState(null);

  const [attachmentMeta, setAttachmentMeta] = useState({});

  const [sort, setSort] = useState("recent");

  const [viewer, setViewer] = useState(null);

  const [gallery, setGallery] = useState(null);

  const [openingId, setOpeningId] = useState(null);

  const [openingCardId, setOpeningCardId] = useState(null);

  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

  const canDelete = user?.role === "ADMIN";

  const notify = (text, type = "success") => {
    setMessage(text);

    setMessageType(type);

    if (type === "error") toast.error(text);
    else toast.success(text);
  };

  const loadInformatii = useCallback(async () => {
    try {
      setLoading(true);

      const response = await api.get("/informatii-utile");

      setInformatii(
        Array.isArray(response.data.informatii) ? response.data.informatii : [],
      );
    } catch (error) {
      console.error("GET INFORMATII UTILE:", error);

      notify(
        error.response?.data?.message ||
          "Informațiile nu au putut fi încărcate.",

        "error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInformatii();
  }, [loadInformatii]);

  const categories = useMemo(() => {
    const names = informatii

      .map((item) => String(item.category || "").trim())

      .filter(Boolean);

    return [
      "Toate",

      ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "ro")),
    ];
  }, [informatii]);

  const filtered = useMemo(() => {
    const items = informatii.filter((item) => {
      const matchesCategory =
        category === "Toate" || String(item.category || "").trim() === category;

      const format = attachmentMeta[item.id]?.format || getInfoFormat(item);

      const matchesFormat = formatFilter === "Toate" || format === formatFilter;

      return (
        matchesCategory &&
        matchesFormat &&
        (!importantOnly || item.is_favorite === true)
      );
    });

    return [...items].sort((a, b) => {
      if (sort === "az")
        return String(a.title || "").localeCompare(String(b.title || ""), "ro");

      if (sort === "za")
        return String(b.title || "").localeCompare(String(a.title || ""), "ro");

      return (
        (new Date(b.created_at || 0).getTime() || Number(b.id) || 0) -
        (new Date(a.created_at || 0).getTime() || Number(a.id) || 0)
      );
    });
  }, [informatii, category, sort, formatFilter, importantOnly, attachmentMeta]);

  // Navigare din Dashboard la informația selectată, fără rute sau componente noi.
  useEffect(() => {
    const requestedId = location.state?.openDocumentId;
    if (loading || requestedId == null) return;

    const navigationKey = `${location.key}:${requestedId}`;
    if (navigationHandledRef.current === navigationKey) return;
    navigationHandledRef.current = navigationKey;

    const target = informatii.find(
      (item) => String(item.id) === String(requestedId),
    );
    if (!target) {
      toast.error("Informația selectată nu a fost găsită.");
      return;
    }

    // Resetăm filtrele pentru ca documentul să fie inclus în rezultate.
    setCategory("Toate");
    setFormatFilter("Toate");
    setImportantOnly(false);
    setSort("recent");
    setTargetInfoId(String(requestedId));
  }, [loading, informatii, location.key, location.state]);

  // După resetarea filtrelor calculăm pagina care conține informația.
  useEffect(() => {
    if (targetInfoId === null || loading) return;
    const index = filtered.findIndex(
      (item) => String(item.id) === targetInfoId,
    );
    if (index < 0) return;
    setPage(Math.floor(index / pageSize) + 1);
  }, [targetInfoId, loading, filtered, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const currentPage = Math.min(page, totalPages);

  const visibleItems = filtered.slice(
    (currentPage - 1) * pageSize,

    currentPage * pageSize,
  );

  // Evidențiem și aducem în zona vizibilă documentul, pe mobil și desktop.
  useEffect(() => {
    if (targetInfoId === null || loading) return;
    if (!visibleItems.some((item) => String(item.id) === targetInfoId)) return;

    const frame = window.requestAnimationFrame(() => {
      const element = Array.from(
        document.querySelectorAll("[data-info-document-id]"),
      ).find(
        (node) =>
          node.getAttribute("data-info-document-id") === targetInfoId &&
          node.getClientRects().length > 0,
      );
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTargetInfoId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [targetInfoId, loading, visibleItems]);

  // Fișierele sunt private: le cerem cu tokenul Axios și le deschidem ca Blob.

  const openMaterial = async (attachment) => {
    if (
      attachment.attachment_type === "file" &&
      (attachment.file_category === "image" ||
        attachment.mime_type?.startsWith("image/"))
    ) {
      if (viewer?.item) {
        setGallery({ item: viewer.item, initialAttachmentId: attachment.id });

        setViewer(null);
      }

      return;
    }

    if (attachment.attachment_type === "link") {
      try {
        const target = new URL(attachment.url);

        if (!["https:", "http:"].includes(target.protocol)) throw new Error();

        window.open(target.href, "_blank", "noopener,noreferrer");
      } catch {
        notify("Linkul salvat nu este valid.", "error");
      }

      return;
    }

    // Fila se creează la clic, înainte de așteptarea răspunsului API.

    const tab = window.open("", "_blank");

    try {
      setOpeningId(attachment.id);

      const response = await api.get(`/attachments/file/${attachment.id}`, {
        responseType: "blob",
      });

      const blobUrl = URL.createObjectURL(response.data);

      if (tab) {
        tab.location.replace(blobUrl);
      } else {
        const link = document.createElement("a");

        link.href = blobUrl;

        link.download =
          attachment.original_name || attachment.name || "document";

        document.body.appendChild(link);

        link.click();

        link.remove();
      }

      // Nu revocăm imediat: browserul are nevoie de URL pentru vizualizare.

      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    } catch (error) {
      tab?.close();

      console.error("OPEN ATTACHMENT:", error);

      notify(
        error.response?.data?.message || "Materialul nu a putut fi deschis.",

        "error",
      );
    } finally {
      setOpeningId(null);
    }
  };

  const openUsefulInfo = async (item) => {
    if (openingCardId !== null) return;

    // Deschidem anticipat fila pentru linkuri și documente.

    const preopenedTab = window.open("", "_blank");

    try {
      setOpeningCardId(item.id);

      const response = await api.get(
        `/attachments/informatii_utile/${item.id}`,
      );

      const attachments = Array.isArray(response.data?.attachments)
        ? response.data.attachments
        : [];

      const images = attachments.filter(
        (attachment) =>
          attachment.attachment_type === "file" &&
          (attachment.file_category === "image" ||
            attachment.mime_type?.startsWith("image/")),
      );

      // Dacă toate materialele sunt fotografii,

      // deschidem direct galeria, indiferent de numărul lor.

      if (attachments.length > 0 && images.length === attachments.length) {
        preopenedTab?.close();

        setViewer(null);

        setGallery({ item, initialAttachmentId: images[0].id });

        return;
      }

      // Un singur material: îl deschidem direct.

      if (attachments.length === 1) {
        const attachment = attachments[0];

        if (attachment.attachment_type === "link") {
          const url = new URL(attachment.url);

          if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error("Link invalid.");
          }

          if (preopenedTab) {
            preopenedTab.location.replace(url.href);
          } else {
            window.open(url.href, "_blank", "noopener,noreferrer");
          }

          return;
        }

        const fileResponse = await api.get(
          `/attachments/file/${attachment.id}`,

          { responseType: "blob" },
        );

        const blobUrl = URL.createObjectURL(fileResponse.data);

        if (preopenedTab) {
          preopenedTab.location.replace(blobUrl);
        } else {
          const link = document.createElement("a");

          link.href = blobUrl;

          link.download =
            attachment.original_name || attachment.name || "document";

          document.body.appendChild(link);

          link.click();

          link.remove();
        }

        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
        }, 120000);

        return;
      }

      // Materiale mixte sau informație numai text.

      preopenedTab?.close();

      setGallery(null);

      setViewer({ item, attachments });
    } catch (error) {
      preopenedTab?.close();

      console.error("OPEN USEFUL INFO:", error);

      notify(
        error.response?.data?.message ||
          error.message ||
          "Nu s-a putut deschide materialul.",

        "error",
      );
    } finally {
      setOpeningCardId(null);
    }
  };

  const handleDelete = async (item) => {
    if (!canDelete || deletingId !== null) return;

    const result = await Swal.fire({
      title: "Ștergi informația?",

      text: `„${item.title}” va fi eliminată definitiv.`,

      icon: "warning",

      showCancelButton: true,

      confirmButtonText: "Da, șterge",

      cancelButtonText: "Anulează",

      confirmButtonColor: "#c43d52",

      cancelButtonColor: "#64748b",

      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setDeletingId(item.id);

      setMessage("");

      await api.delete(`/informatii-utile/${item.id}`);

      setInformatii((current) =>
        current.filter((entry) => entry.id !== item.id),
      );

      notify("Informația a fost ștearsă.");
    } catch (error) {
      console.error("DELETE INFORMATII UTILE:", error);

      notify(
        error.response?.data?.message || "Informația nu a putut fi ștearsă.",

        "error",
      );
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const missing = visibleItems.filter(
      (item) => !Object.prototype.hasOwnProperty.call(attachmentMeta, item.id),
    );

    if (!missing.length) return undefined;

    Promise.all(
      missing.map(async (item) => {
        try {
          const response = await api.get(
            `/attachments/informatii_utile/${item.id}`,
          );

          const attachments = Array.isArray(response.data?.attachments)
            ? response.data.attachments
            : [];

          const file = attachments.find(
            (entry) => entry.attachment_type === "file",
          );

          return [
            item.id,

            {
              count: attachments.length,

              format: file
                ? getInfoFormat(file)
                : attachments.some((a) => a.attachment_type === "link")
                  ? "LINK"
                  : "—",
            },
          ];
        } catch {
          return [item.id, { count: null, format: "—" }];
        }
      }),
    ).then((entries) => {
      if (!cancelled)
        setAttachmentMeta((old) => ({
          ...old,

          ...Object.fromEntries(entries),
        }));
    });

    return () => {
      cancelled = true;
    };
  }, [visibleItems.map((item) => item.id).join(",")]);

  const isImportant = (item) => item.is_favorite === true;

  const toggleFavorite = async (item) => {
    if (favoriteBusy.includes(item.id)) return;

    const next = !isImportant(item);

    setFavoriteBusy((ids) => [...ids, item.id]);

    try {
      if (next) await api.post(`/informatii-utile/${item.id}/favorite`);
      else await api.delete(`/informatii-utile/${item.id}/favorite`);

      setInformatii((items) =>
        items.map((entry) =>
          entry.id === item.id ? { ...entry, is_favorite: next } : entry,
        ),
      );

      toast.success(
        next ? "Adăugat la importante." : "Eliminat din importante.",
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Nu s-a putut actualiza favoritul.",
      );
    } finally {
      setFavoriteBusy((ids) => ids.filter((id) => id !== item.id));
    }
  };

  const goPage = (next) => setPage(Math.max(1, Math.min(totalPages, next)));

  const pageNumbers = Array.from(
    { length: totalPages },

    (_, i) => i + 1,
  ).filter(
    (n) =>
      totalPages <= 7 ||
      n === 1 ||
      n === totalPages ||
      Math.abs(n - currentPage) <= 1,
  );

  const pagination = (
    <nav className="info-pages" aria-label="Paginare">
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => goPage(1)}
        aria-label="Prima pagină"
      >
        <ChevronsLeft size={19} />
      </button>

      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => goPage(currentPage - 1)}
        aria-label="Pagina precedentă"
      >
        <ChevronLeft size={19} />
      </button>

      {pageNumbers.map((n, index) => (
        <span className="info-page-slot" key={n}>
          {index > 0 && n - pageNumbers[index - 1] > 1 && (
            <span className="info-ellipsis">…</span>
          )}

          <button
            type="button"
            className={currentPage === n ? "active" : ""}
            onClick={() => goPage(n)}
            aria-current={currentPage === n ? "page" : undefined}
          >
            {n}
          </button>
        </span>
      ))}

      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => goPage(currentPage + 1)}
        aria-label="Pagina următoare"
      >
        <ChevronRight size={19} />
      </button>

      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => goPage(totalPages)}
        aria-label="Ultima pagină"
      >
        <ChevronsRight size={19} />
      </button>
    </nav>
  );

  return (
    <main className="informatii-page informatii-modern">
      <header className="informatii-hero">
        <div className="informatii-hero-copy">
          <div className="informatii-eyebrow">
            <BookOpen size={21} /> CENTRU DE RESURSE
          </div>

          <h1>Informații utile</h1>

          <p className="informatii-description">
            Găsește rapid proceduri, ghiduri și informații necesare activității
            de serviciu.
          </p>

          {canEdit && (
            <button
              type="button"
              className="informatii-add-button"
              onClick={() => navigate("/informatii-utile/adauga")}
            >
              <Plus size={22} /> Adaugă informație
            </button>
          )}
        </div>

        <div className="informatii-hero-art" aria-hidden="true">
          <div className="info-art-back" />

          <FileText size={100} strokeWidth={1.2} />

          <span>i</span>
        </div>
      </header>

      {message && (
        <div className={`informatii-message ${messageType}`} role="status">
          {messageType === "error" ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}

          <span>{message}</span>

          <button
            type="button"
            onClick={() => setMessage("")}
            aria-label="Închide mesajul"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="informatii-toolbar" aria-label="Filtrare și ordonare">
        <ModernFilter
          icon={FolderOpen}
          label="Categorie"
          value={category}
          options={categories.map((name) => ({
            value: name,

            label: name === "Toate" ? "Toate categoriile" : name,
          }))}
          onChange={(value) => {
            setCategory(value);

            setPage(1);
          }}
        />

        <ModernFilter
          icon={FileText}
          label="Format"
          value={formatFilter}
          options={[
            { value: "Toate", label: "Toate formatele" },

            ...["PDF", "DOCX", "XLSX", "ZIP", "IMG", "VIDEO", "LINK", "—"].map(
              (name) => ({
                value: name,

                label: name === "—" ? "Nespecificat" : name,
              }),
            ),
          ]}
          onChange={(value) => {
            setFormatFilter(value);

            setPage(1);
          }}
        />

        <ModernFilter
          icon={ArrowDownUp}
          label="Ordonare"
          value={sort}
          options={[
            { value: "recent", label: "Cele mai recente" },

            { value: "az", label: "Titlu A–Z" },

            { value: "za", label: "Titlu Z–A" },
          ]}
          onChange={(value) => {
            setSort(value);

            setPage(1);
          }}
        />

        <ModernFilter
          icon={Star}
          label="Importante"
          value={importantOnly ? "da" : "toate"}
          options={[
            { value: "toate", label: "Toate" },

            { value: "da", label: "Doar importante" },
          ]}
          onChange={(value) => {
            setImportantOnly(value === "da");

            setPage(1);
          }}
        />
      </section>

      <section className="informatii-data">
        <div className="informatii-results">
          <span>
            {loading
              ? "Se încarcă..."
              : `${filtered.length} ${filtered.length === 1 ? "rezultat" : "rezultate"}`}
          </span>

          <button type="button" disabled={loading} onClick={loadInformatii}>
            <RefreshCw size={19} /> Actualizează
          </button>
        </div>

        {loading ? (
          <div className="informatii-state">
            <div className="informatii-spinner" />

            <p>Se încarcă informațiile utile...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="informatii-state">
            <FolderOpen size={38} />

            <h3>
              {informatii.length
                ? "Nu am găsit rezultate"
                : "Nu există încă informații utile"}
            </h3>

            <p>
              {informatii.length
                ? "Modifică filtrele pentru a vedea alte rezultate."
                : "Materialele publicate vor apărea aici."}
            </p>

            <button
              type="button"
              onClick={() => {
                setCategory("Toate");

                setFormatFilter("Toate");

                setImportantOnly(false);

                setPage(1);
              }}
            >
              Resetează filtrele
            </button>
          </div>
        ) : (
          <>
            <div className="informatii-desktop-layout">
              <div className="informatii-table-scroll">
                <table className="informatii-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label="Selectează pagina"
                          checked={
                            visibleItems.length > 0 &&
                            visibleItems.every((item) =>
                              checkedIds.includes(item.id),
                            )
                          }
                          onChange={(e) =>
                            setCheckedIds((ids) =>
                              e.target.checked
                                ? [
                                    ...new Set([
                                      ...ids,

                                      ...visibleItems.map((i) => i.id),
                                    ]),
                                  ]
                                : ids.filter(
                                    (id) =>
                                      !visibleItems.some((i) => i.id === id),
                                  ),
                            )
                          }
                        />
                      </th>

                      <th>#</th>

                      <th>Document</th>

                      <th>Descriere</th>

                      <th>Categorie</th>

                      <th>Format</th>

                      <th>Data</th>

                      <th>Important</th>

                      <th>Fișiere</th>

                      <th>Adăugat de</th>

                      <th>Acțiuni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleItems.map((item, index) => (
                      <tr key={item.id} data-info-document-id={String(item.id)}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Selectează ${item.title}`}
                            checked={checkedIds.includes(item.id)}
                            onChange={(e) =>
                              setCheckedIds((ids) =>
                                e.target.checked
                                  ? [...new Set([...ids, item.id])]
                                  : ids.filter((id) => id !== item.id),
                              )
                            }
                          />
                        </td>

                        <td>{(currentPage - 1) * pageSize + index + 1}</td>

                        <td>
                          <button
                            type="button"
                            className="info-title-button"
                            onClick={() => openUsefulInfo(item)}
                          >
                            <span
                              className={`info-file-icon tone-${getCategoryTone(item.category)}`}
                            >
                              <FileText size={25} />
                            </span>

                            <strong>{item.title}</strong>
                          </button>
                        </td>

                        <td className="info-description-cell">
                          {item.content?.trim() ||
                            "Apasă pentru a deschide materialul atașat."}
                        </td>

                        <td>
                          <span
                            className={`info-table-badge tone-${getCategoryTone(item.category)}`}
                          >
                            {item.category || "General"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`info-format-badge format-${(attachmentMeta[item.id]?.format || getInfoFormat(item)).toLowerCase()}`}
                          >
                            {attachmentMeta[item.id]?.format ||
                              getInfoFormat(item)}
                          </span>
                        </td>

                        <td>{formatDate(item.created_at) || "—"}</td>

                        <td>
                          <button
                            type="button"
                            className="info-favorite-button"
                            aria-label={
                              isImportant(item)
                                ? "Elimină din importante"
                                : "Adaugă la importante"
                            }
                            aria-pressed={isImportant(item)}
                            disabled={favoriteBusy.includes(item.id)}
                            onClick={() => toggleFavorite(item)}
                          >
                            <Star
                              size={22}
                              className={
                                isImportant(item)
                                  ? "info-star active"
                                  : "info-star"
                              }
                              fill={isImportant(item) ? "currentColor" : "none"}
                            />
                          </button>
                        </td>

                        <td>
                          <span className="info-attachment-count">
                            <Paperclip size={16} />

                            {attachmentMeta[item.id]?.count ?? "—"}
                          </span>
                        </td>

                        <td>
                          {item.created_by_name ||
                            item.created_by_username ||
                            "—"}
                        </td>

                        <td>
                          <div className="info-table-actions">
                            {canEdit && (
                              <button
                                type="button"
                                title="Editează"
                                onClick={() =>
                                  navigate(`/informatii-utile/${item.id}/edit`)
                                }
                              >
                                <Pencil size={19} />
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                title="Șterge"
                                className="danger"
                                disabled={deletingId !== null}
                                onClick={() => handleDelete(item)}
                              >
                                <Trash2 size={19} />
                              </button>
                            )}

                            <button
                              type="button"
                              title="Deschide"
                              onClick={() => openUsefulInfo(item)}
                            >
                              <MoreVertical size={19} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="informatii-mobile-list">
              {visibleItems.map((item) => (
                <article
                  className="informatii-card"
                  key={item.id}
                  data-info-document-id={String(item.id)}
                >
                  <span
                    className={`informatii-card-icon tone-${getCategoryTone(item.category)}`}
                  >
                    <FileText size={30} />
                  </span>

                  <div className="informatii-card-content">
                    <span
                      className={`info-table-badge tone-${getCategoryTone(item.category)}`}
                    >
                      {item.category || "General"}
                    </span>

                    <button
                      type="button"
                      className="informatii-card-title"
                      onClick={() => openUsefulInfo(item)}
                    >
                      {item.title}
                    </button>

                    <p>
                      {item.content?.trim() ||
                        "Apasă pentru a deschide materialul atașat."}
                    </p>

                    <div className="informatii-card-meta">
                      <span>
                        <UserRound size={16} />

                        {item.created_by_name ||
                          item.created_by_username ||
                          "—"}
                      </span>

                      <span>
                        <CalendarDays size={16} />

                        {formatDate(item.created_at) || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="informatii-card-top-actions">
                    <span className="informatii-card-id">#{item.id}</span>

                    <button
                      type="button"
                      className="info-favorite-button"
                      aria-label={
                        isImportant(item)
                          ? "Elimină din importante"
                          : "Adaugă la importante"
                      }
                      aria-pressed={isImportant(item)}
                      disabled={favoriteBusy.includes(item.id)}
                      onClick={() => toggleFavorite(item)}
                    >
                      <Star
                        size={22}
                        className={
                          isImportant(item) ? "info-star active" : "info-star"
                        }
                        fill={isImportant(item) ? "currentColor" : "none"}
                      />
                    </button>

                    <button
                      type="button"
                      aria-label="Deschide materialul"
                      onClick={() => openUsefulInfo(item)}
                    >
                      <MoreVertical size={21} />
                    </button>
                  </div>

                  <div className="informatii-card-footer">
                    <button
                      type="button"
                      className="informatii-file-link"
                      onClick={() => openUsefulInfo(item)}
                    >
                      <Paperclip size={20} />

                      {attachmentMeta[item.id]?.count == null
                        ? "Fișiere atașate"
                        : `${attachmentMeta[item.id].count} ${attachmentMeta[item.id].count === 1 ? "fișier atașat" : "fișiere atașate"}`}
                    </button>

                    <div className="informatii-actions">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/informatii-utile/${item.id}/edit`)
                          }
                        >
                          <Pencil size={18} /> Editează
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          className="danger"
                          disabled={deletingId !== null}
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 size={18} /> Șterge
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <footer className="info-pagination">
              <span className="info-pagination-summary">
                Afișate {(currentPage - 1) * pageSize + 1} –{" "}
                {Math.min(currentPage * pageSize, filtered.length)} din{" "}
                {filtered.length} rezultate
              </span>

              {pagination}

              <label className="info-pagination-size">
                Elemente pe pagină:{" "}
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));

                    setPage(1);
                  }}
                >
                  <option value={3}>3</option>

                  <option value={10}>10</option>

                  <option value={20}>20</option>

                  <option value={50}>50</option>
                </select>
              </label>
            </footer>
          </>
        )}
      </section>

      {gallery && (
        <TelegramGallery
          entityType="informatii_utile"
          entityId={gallery.item.id}
          title={gallery.item.title}
          initialAttachmentId={gallery.initialAttachmentId}
          onClose={() => setGallery(null)}
        />
      )}

      {viewer && (
        <div
          className="informatii-viewer-backdrop"
          onClick={() => setViewer(null)}
        >
          <section
            className="informatii-viewer-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Materiale: ${viewer.item.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="informatii-viewer-header">
              <div>
                <h2>{viewer.item.title}</h2>

                <p>
                  {viewer.attachments.length
                    ? "Selectează materialul pe care vrei să îl deschizi."
                    : "Conținutul informației"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewer(null)}
                aria-label="Închide"
              >
                <X size={20} />
              </button>
            </div>

            {viewer.attachments.length ? (
              <div className="informatii-viewer-list">
                {viewer.attachments.map((attachment) => {
                  const isLink = attachment.attachment_type === "link";

                  const category = attachment.file_category;

                  return (
                    <button
                      type="button"
                      key={attachment.id}
                      className="informatii-viewer-item"
                      disabled={openingId === attachment.id}
                      onClick={() => openMaterial(attachment)}
                    >
                      {isLink ? (
                        <Link2 size={21} />
                      ) : category === "image" ? (
                        <ImageIcon size={21} />
                      ) : category === "video" ? (
                        <Video size={21} />
                      ) : (
                        <FileText size={21} />
                      )}

                      <span>
                        {attachment.original_name ||
                          attachment.name ||
                          "Material atașat"}
                      </span>

                      <ExternalLink size={17} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="informatii-viewer-text">
                {viewer.item.content?.trim() ||
                  "Nu există materiale atașate acestui card."}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default InformatiiUtile;
